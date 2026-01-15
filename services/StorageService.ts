import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { CryptoService } from "./CryptoService";
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
    const encrypted = await CryptoService.encryptBlob(blob, key);
    await Filesystem.writeFile({
      path: `${VAULT_DIR}/${id}.enc`,
      data: JSON.stringify(encrypted),
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
  }
  static async loadFile(id: string, key: CryptoKey): Promise<Blob> {
    const result = await Filesystem.readFile({
      path: `${VAULT_DIR}/${id}.enc`,
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
    try {
      await Filesystem.deleteFile({
        path: `${VAULT_DIR}/${id}.enc`,
        directory: Directory.Data,
      });
    } catch (e) {}
  }
  static async copyFile(sourceId: string, destId: string) {
    try {
      const fileInfo = await this.getFileInfo(sourceId);
      if (fileInfo?.isChunked) {
        await Filesystem.mkdir({
          path: `${VAULT_DIR}/${destId}_chunks`,
          directory: Directory.Data,
          recursive: true,
        }).catch(() => {});
        for (let i = 0; i < fileInfo.chunks; i++) {
          try {
            const chunkResult = await Filesystem.readFile({
              path: `${VAULT_DIR}/${sourceId}_chunks/chunk_${i}.enc`,
              directory: Directory.Data,
              encoding: Encoding.UTF8,
            });
            await Filesystem.writeFile({
              path: `${VAULT_DIR}/${destId}_chunks/chunk_${i}.enc`,
              data: chunkResult.data,
              directory: Directory.Data,
              encoding: Encoding.UTF8,
            });
          } catch (e) {}
        }
        try {
          const metaResult = await Filesystem.readFile({
            path: `${VAULT_DIR}/${sourceId}.chunk_meta`,
            directory: Directory.Data,
            encoding: Encoding.UTF8,
          });
          await Filesystem.writeFile({
            path: `${VAULT_DIR}/${destId}.chunk_meta`,
            data: metaResult.data,
            directory: Directory.Data,
            encoding: Encoding.UTF8,
          });
        } catch (e) {}
      } else {
        await Filesystem.copy({
          from: `${VAULT_DIR}/${sourceId}.enc`,
          to: `${VAULT_DIR}/${destId}.enc`,
          directory: Directory.Data,
          toDirectory: Directory.Data,
        });
      }
    } catch (e) {
      throw new Error(`Failed to copy file ${sourceId}`);
    }
  }
  static async savePendingIntruder(filename: string, base64: string) {
    await Filesystem.writeFile({
      path: `${VAULT_DIR}/pending_intruders/${filename}`,
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
    await Filesystem.deleteFile({
      path: `${VAULT_DIR}/pending_intruders/${filename}`,
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
    try {
      await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Documents,
      });
      return `Documents/${filename}`;
    } catch (e) {
      throw new Error("Failed to write to Documents");
    }
  }
  static async initializeChunkedFile(fileId: string) {
    try {
      await Filesystem.mkdir({
        path: `${VAULT_DIR}/${fileId}_chunks`,
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
    const encrypted = await CryptoService.encryptBlob(chunkBlob, key);
    await Filesystem.writeFile({
      path: `${VAULT_DIR}/${fileId}_chunks/chunk_${chunkIndex}.enc`,
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
    const result = await Filesystem.readFile({
      path: `${VAULT_DIR}/${fileId}_chunks/chunk_${chunkIndex}.enc`,
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
    const metadata = {
      isChunked: true,
      chunks: totalChunks,
      timestamp: Date.now(),
    };
    await Filesystem.writeFile({
      path: `${VAULT_DIR}/${fileId}.chunk_meta`,
      data: JSON.stringify(metadata),
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
  }
  static async getFileInfo(
    fileId: string
  ): Promise<{ isChunked: boolean; chunks: number } | null> {
    try {
      const result = await Filesystem.readFile({
        path: `${VAULT_DIR}/${fileId}.chunk_meta`,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });
      const metadata =
        typeof result.data === "string" ? JSON.parse(result.data) : result.data;
      return {
        isChunked: metadata.isChunked || false,
        chunks: metadata.chunks || 1,
      };
    } catch (e) {
      return null;
    }
  }
  static async cleanupChunkedFile(fileId: string) {
    try {
      await Filesystem.rmdir({
        path: `${VAULT_DIR}/${fileId}_chunks`,
        directory: Directory.Data,
        recursive: true,
      });
    } catch (e) {}
    try {
      await Filesystem.deleteFile({
        path: `${VAULT_DIR}/${fileId}.chunk_meta`,
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
