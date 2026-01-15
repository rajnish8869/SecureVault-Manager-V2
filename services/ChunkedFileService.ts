import { CryptoService } from "./CryptoService";
import { StorageService } from "./StorageService";
interface ChunkProgress {
  totalChunks: number;
  currentChunk: number;
  bytesProcessed: number;
  totalBytes: number;
  percentComplete: number;
}
export class ChunkedFileService {
  private static readonly CHUNK_SIZE = 512 * 1024;
  private static readonly CHUNKING_THRESHOLD = 10 * 1024 * 1024;
  static async importFileChunked(
    fileBlob: Blob,
    fileName: string,
    fileId: string,
    encryptionKey: CryptoKey,
    onProgress?: (progress: ChunkProgress) => void
  ): Promise<void> {
    const totalBytes = fileBlob.size;
    if (totalBytes < this.CHUNKING_THRESHOLD) {
      onProgress?.({
        totalChunks: 1,
        currentChunk: 1,
        bytesProcessed: totalBytes,
        totalBytes,
        percentComplete: 100,
      });
      await StorageService.saveFile(fileId, fileBlob, encryptionKey);
      return;
    }
    const totalChunks = Math.ceil(totalBytes / this.CHUNK_SIZE);
    let bytesProcessed = 0;
    await StorageService.initializeChunkedFile(fileId);
    try {
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * this.CHUNK_SIZE;
        const end = Math.min(start + this.CHUNK_SIZE, totalBytes);
        const chunkBlob = fileBlob.slice(start, end);
        await StorageService.saveFileChunk(
          fileId,
          chunkIndex,
          chunkBlob,
          encryptionKey
        );
        bytesProcessed += chunkBlob.size;
        const percentComplete = Math.round((bytesProcessed / totalBytes) * 100);
        onProgress?.({
          totalChunks,
          currentChunk: chunkIndex + 1,
          bytesProcessed,
          totalBytes,
          percentComplete,
        });
        if (chunkIndex % 5 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }
      await StorageService.finalizeChunkedFile(fileId, totalChunks);
    } catch (error) {
      await StorageService.cleanupChunkedFile(fileId);
      throw error;
    }
  }
  static async loadFileChunked(
    fileId: string,
    encryptionKey: CryptoKey,
    onProgress?: (progress: ChunkProgress) => void
  ): Promise<Blob> {
    try {
      const fileInfo = await StorageService.getFileInfo(fileId);
      if (!fileInfo || !fileInfo.isChunked) {
        const blob = await StorageService.loadFile(fileId, encryptionKey);
        onProgress?.({
          totalChunks: 1,
          currentChunk: 1,
          bytesProcessed: blob.size,
          totalBytes: blob.size,
          percentComplete: 100,
        });
        return blob;
      }
      const totalChunks = fileInfo.chunks || 1;
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const chunkBlob = await StorageService.loadFileChunk(
          fileId,
          chunkIndex,
          encryptionKey
        );
        const arrayBuffer = await chunkBlob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        chunks.push(uint8Array);
        totalBytes += uint8Array.length;
        const percentComplete = Math.round(
          ((chunkIndex + 1) / totalChunks) * 100
        );
        onProgress?.({
          totalChunks,
          currentChunk: chunkIndex + 1,
          bytesProcessed: totalBytes,
          totalBytes,
          percentComplete,
        });
        if (chunkIndex % 5 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }
      const reconstructedArray = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) {
        reconstructedArray.set(chunk, offset);
        offset += chunk.length;
      }
      return new Blob([reconstructedArray]);
    } catch (error) {
      throw error;
    }
  }
  static getChunkSize(): number {
    return this.CHUNK_SIZE;
  }
  static getChunkingThreshold(): number {
    return this.CHUNKING_THRESHOLD;
  }
  static shouldChunk(fileSize: number): boolean {
    return fileSize > this.CHUNKING_THRESHOLD;
  }
}
