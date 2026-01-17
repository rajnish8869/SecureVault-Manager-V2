import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { CryptoService } from "./CryptoService";
import { InputValidator } from "./InputValidator";
import type { VaultItem } from "../types";
const VAULT_DIR = "secure_vault";
export class StorageService {
  static async initDirectory() {
    try {
      await Filesystem.mkdir({
        path: VAULT_DIR,
        directory: Directory.Data,
        recursive: true,
      });
    } catch (e) {}
    try {
      await Filesystem.mkdir({
        path: `${VAULT_DIR}/pending_intruders`,
        directory: Directory.Data,
        recursive: true,
      });
    } catch (e) {}
  }
  static async saveMetadata(
    mode: "REAL" | "DECOY",
    items: VaultItem[],
    key: CryptoKey
  ) {
    // Validate mode
    if (mode !== "REAL" && mode !== "DECOY") {
      throw new Error("Invalid vault mode");
    }

    // Validate metadata
    const validation = InputValidator.validateMetadata(items);
    if (!validation.valid) {
      throw new Error("Invalid metadata: " + validation.errors.join(", "));
    }

    const json = JSON.stringify(items);
    const blob = new Blob([json], { type: "application/json" });
    const encrypted = await CryptoService.encryptBlob(blob, key);
    await Filesystem.writeFile({
      path: `${VAULT_DIR}/meta_${mode.toLowerCase()}.json`,
      data: JSON.stringify(encrypted),
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
  }
  static async loadMetadata(
    mode: "REAL" | "DECOY",
    key: CryptoKey
  ): Promise<VaultItem[]> {
    try {
      const result = await Filesystem.readFile({
        path: `${VAULT_DIR}/meta_${mode.toLowerCase()}.json`,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });
      const fileData =
        typeof result.data === "string" ? JSON.parse(result.data) : result.data;
      const decryptedBuffer = await CryptoService.decryptBlob(
        fileData.content,
        fileData.iv,
        key
      );
      const dec = new TextDecoder();
      return JSON.parse(dec.decode(decryptedBuffer));
    } catch (e) {
      return [];
    }
  }
  static async saveFile(id: string, blob: Blob, key: CryptoKey) {
    // Validate file ID to prevent path traversal
    const { valid, sanitized } = InputValidator.sanitizeFileId(id);
    if (!valid || !sanitized) {
      throw new Error("Invalid file ID");
    }

    const encrypted = await CryptoService.encryptBlob(blob, key);
    await Filesystem.writeFile({
      path: `${VAULT_DIR}/${sanitized}.enc`,
      data: JSON.stringify(encrypted),
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
  }
  static async loadFile(id: string, key: CryptoKey): Promise<Blob> {
    // Validate file ID to prevent path traversal
    const { valid, sanitized } = InputValidator.sanitizeFileId(id);
    if (!valid || !sanitized) {
      throw new Error("Invalid file ID");
    }

    const result = await Filesystem.readFile({
      path: `${VAULT_DIR}/${sanitized}.enc`,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
    const fileData =
      typeof result.data === "string" ? JSON.parse(result.data) : result.data;
    const decryptedBuffer = await CryptoService.decryptBlob(
      fileData.content,
      fileData.iv,
      key
    );
    return new Blob([decryptedBuffer]);
  }
  static async deleteFile(id: string) {
    // Validate file ID to prevent path traversal
    const { valid, sanitized } = InputValidator.sanitizeFileId(id);
    if (!valid || !sanitized) {
      throw new Error("Invalid file ID");
    }

    try {
      await Filesystem.deleteFile({
        path: `${VAULT_DIR}/${sanitized}.enc`,
        directory: Directory.Data,
      });
    } catch (e) {}
  }
  static async copyFile(sourceId: string, destId: string) {
    // Validate file IDs
    const source = InputValidator.sanitizeFileId(sourceId);
    const dest = InputValidator.sanitizeFileId(destId);

    if (!source.valid || !source.sanitized || !dest.valid || !dest.sanitized) {
      throw new Error("Invalid file ID");
    }

    try {
      const fileInfo = await this.getFileInfo(sourceId);
      if (fileInfo?.isChunked) {
        await Filesystem.mkdir({
          path: `${VAULT_DIR}/${dest.sanitized}_chunks`,
          directory: Directory.Data,
          recursive: true,
        }).catch(() => {});
        for (let i = 0; i < fileInfo.chunks; i++) {
          try {
            const chunkResult = await Filesystem.readFile({
              path: `${VAULT_DIR}/${source.sanitized}_chunks/chunk_${i}.enc`,
              directory: Directory.Data,
              encoding: Encoding.UTF8,
            });
            await Filesystem.writeFile({
              path: `${VAULT_DIR}/${dest.sanitized}_chunks/chunk_${i}.enc`,
              data: chunkResult.data,
              directory: Directory.Data,
              encoding: Encoding.UTF8,
            });
          } catch (e) {}
        }
        try {
          const metaResult = await Filesystem.readFile({
            path: `${VAULT_DIR}/${source.sanitized}.chunk_meta`,
            directory: Directory.Data,
            encoding: Encoding.UTF8,
          });
          await Filesystem.writeFile({
            path: `${VAULT_DIR}/${dest.sanitized}.chunk_meta`,
            data: metaResult.data,
            directory: Directory.Data,
            encoding: Encoding.UTF8,
          });
        } catch (e) {}
      } else {
        await Filesystem.copy({
          from: `${VAULT_DIR}/${source.sanitized}.enc`,
          to: `${VAULT_DIR}/${dest.sanitized}.enc`,
          directory: Directory.Data,
          toDirectory: Directory.Data,
        });
      }
    } catch (e) {
      throw new Error(`Failed to copy file ${sourceId}`);
    }
  }
  static async savePendingIntruder(filename: string, base64: string) {
    // Sanitize filename to prevent path traversal
    let sanitized: string;
    try {
      sanitized = InputValidator.sanitizeFileName(filename);
    } catch (e) {
      throw new Error("Invalid intruder filename");
    }

    // Validate base64 isn't too large (reasonable limit for intruder photos)
    if (base64.length > 50000000) {
      // ~50MB limit
      throw new Error("Intruder file too large");
    }

    await Filesystem.writeFile({
      path: `${VAULT_DIR}/pending_intruders/${sanitized}`,
      data: base64,
      directory: Directory.Data,
    });
  }
  static async getPendingIntruders(): Promise<
    { name: string; data: string }[]
  > {
    try {
      const result = await Filesystem.readdir({
        path: `${VAULT_DIR}/pending_intruders`,
        directory: Directory.Data,
      });
      const files: { name: string; data: string }[] = [];
      for (const file of result.files) {
        const read = await Filesystem.readFile({
          path: `${VAULT_DIR}/pending_intruders/${file.name}`,
          directory: Directory.Data,
        });
        files.push({ name: file.name, data: read.data as string });
      }
      return files;
    } catch (e) {
      return [];
    }
  }
  static async deletePendingIntruder(filename: string) {
    // Sanitize filename to prevent path traversal
    let sanitized: string;
    try {
      sanitized = InputValidator.sanitizeFileName(filename);
    } catch (e) {
      throw new Error("Invalid intruder filename");
    }

    await Filesystem.deleteFile({
      path: `${VAULT_DIR}/pending_intruders/${sanitized}`,
      directory: Directory.Data,
    });
  }
  static async wipeVault() {
    try {
      await Filesystem.rmdir({
        path: VAULT_DIR,
        directory: Directory.Data,
        recursive: true,
      });
    } catch (e) {}
  }
  static async writePublicFile(
    filename: string,
    base64Data: string
  ): Promise<string> {
    // Sanitize filename to prevent path traversal
    let sanitized: string;
    try {
      sanitized = InputValidator.sanitizeFileName(filename);
    } catch (e) {
      throw new Error("Invalid filename");
    }

    // Validate base64 data
    if (
      !base64Data ||
      typeof base64Data !== "string" ||
      base64Data.length > 100000000
    ) {
      throw new Error("Invalid or oversized file data");
    }

    try {
      await Filesystem.writeFile({
        path: sanitized,
        data: base64Data,
        directory: Directory.Documents,
      });
      return `Documents/${sanitized}`;
    } catch (e) {
      throw new Error("Failed to write to Documents");
    }
  }
  static async initializeChunkedFile(fileId: string) {
    // Validate file ID
    const { valid, sanitized } = InputValidator.sanitizeFileId(fileId);
    if (!valid || !sanitized) {
      throw new Error("Invalid file ID");
    }

    try {
      await Filesystem.mkdir({
        path: `${VAULT_DIR}/${sanitized}_chunks`,
        directory: Directory.Data,
        recursive: true,
      });
    } catch (e) {}
  }
  static async saveFileChunk(
    fileId: string,
    chunkIndex: number,
    chunkBlob: Blob,
    key: CryptoKey
  ) {
    // Validate file ID and chunk index
    const { valid, sanitized } = InputValidator.sanitizeFileId(fileId);
    if (!valid || !sanitized) {
      throw new Error("Invalid file ID");
    }

    if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex > 9999) {
      throw new Error("Invalid chunk index");
    }

    const encrypted = await CryptoService.encryptBlob(chunkBlob, key);
    await Filesystem.writeFile({
      path: `${VAULT_DIR}/${sanitized}_chunks/chunk_${chunkIndex}.enc`,
      data: JSON.stringify(encrypted),
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
  }
  static async loadFileChunk(
    fileId: string,
    chunkIndex: number,
    key: CryptoKey
  ): Promise<Blob> {
    // Validate file ID and chunk index
    const { valid, sanitized } = InputValidator.sanitizeFileId(fileId);
    if (!valid || !sanitized) {
      throw new Error("Invalid file ID");
    }

    if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex > 9999) {
      throw new Error("Invalid chunk index");
    }

    const result = await Filesystem.readFile({
      path: `${VAULT_DIR}/${sanitized}_chunks/chunk_${chunkIndex}.enc`,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
    const fileData =
      typeof result.data === "string" ? JSON.parse(result.data) : result.data;
    const decryptedBuffer = await CryptoService.decryptBlob(
      fileData.content,
      fileData.iv,
      key
    );
    return new Blob([decryptedBuffer]);
  }
  static async finalizeChunkedFile(fileId: string, totalChunks: number) {
    // Validate file ID and total chunks
    const { valid, sanitized } = InputValidator.sanitizeFileId(fileId);
    if (!valid || !sanitized) {
      throw new Error("Invalid file ID");
    }

    if (
      !Number.isInteger(totalChunks) ||
      totalChunks < 1 ||
      totalChunks > 10000
    ) {
      throw new Error("Invalid chunk count");
    }

    const metadata = {
      isChunked: true,
      chunks: totalChunks,
      timestamp: Date.now(),
    };
    await Filesystem.writeFile({
      path: `${VAULT_DIR}/${sanitized}.chunk_meta`,
      data: JSON.stringify(metadata),
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
  }
  static async getFileInfo(
    fileId: string
  ): Promise<{ isChunked: boolean; chunks: number } | null> {
    // Validate file ID
    const { valid, sanitized } = InputValidator.sanitizeFileId(fileId);
    if (!valid || !sanitized) {
      return null;
    }

    try {
      const result = await Filesystem.readFile({
        path: `${VAULT_DIR}/${sanitized}.chunk_meta`,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });
      const metadata =
        typeof result.data === "string" ? JSON.parse(result.data) : result.data;

      // Validate metadata structure
      if (!metadata.isChunked && metadata.chunks === undefined) {
        return null;
      }

      return {
        isChunked: metadata.isChunked || false,
        chunks: Math.min(metadata.chunks || 1, 10000), // Cap at 10000
      };
    } catch (e) {
      return null;
    }
  }
  static async cleanupChunkedFile(fileId: string) {
    // Validate file ID
    const { valid, sanitized } = InputValidator.sanitizeFileId(fileId);
    if (!valid || !sanitized) {
      throw new Error("Invalid file ID");
    }

    try {
      await Filesystem.rmdir({
        path: `${VAULT_DIR}/${sanitized}_chunks`,
        directory: Directory.Data,
        recursive: true,
      });
    } catch (e) {}
    try {
      await Filesystem.deleteFile({
        path: `${VAULT_DIR}/${sanitized}.chunk_meta`,
        directory: Directory.Data,
      });
    } catch (e) {}
  }
  static async deleteChunkedFile(fileId: string) {
    const fileInfo = await this.getFileInfo(fileId);
    if (fileInfo?.isChunked) {
      await this.cleanupChunkedFile(fileId);
    } else {
      await this.deleteFile(fileId);
    }
  }
}
