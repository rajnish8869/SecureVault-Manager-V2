import type { FileMetadata, FileTypeCategory } from "../types";
import { FileTypeDetector } from "./FileTypeDetector";
interface CachedThumbnail {
  base64: string;
  width: number;
  height: number;
  timestamp: number;
}
interface ThumbnailCache {
  [fileId: string]: CachedThumbnail;
}
export class FilePreviewService {
  private static thumbnailCache: ThumbnailCache = {};
  private static cacheSize = 0;
  private static MAX_CACHE_SIZE = 50 * 1024 * 1024;
  private static THUMBNAIL_MAX_WIDTH = 200;
  private static THUMBNAIL_MAX_HEIGHT = 200;
  private static CACHE_TTL = 24 * 60 * 60 * 1000;
  static async generateMetadata(
    file: Blob,
    fileName: string,
    fileId: string,
    generateThumbnail: boolean = true
  ): Promise<FileMetadata> {
    try {
      const detection = await FileTypeDetector.detectType(file, fileName);
      const sizeFormatted = FileTypeDetector.formatFileSize(file.size);
      const metadata: FileMetadata = {
        name: fileName,
        size: file.size,
        mimeType: detection.mimeType,
        category: detection.category,
        sizeFormatted,
        canPreviewInApp: FileTypeDetector.canPreviewInApp(detection.category),
        canOpenNatively: !FileTypeDetector.canPreviewInApp(detection.category),
      };
      if (
        generateThumbnail &&
        detection.category === "IMAGE" &&
        file.size < 10 * 1024 * 1024
      ) {
        try {
          const thumbnail = await this.generateImageThumbnail(file, fileId);
          if (thumbnail) {
            metadata.thumbnail = thumbnail.base64;
            metadata.thumbnailWidth = thumbnail.width;
            metadata.thumbnailHeight = thumbnail.height;
          }
        } catch (error) {}
      }
      if (
        generateThumbnail &&
        detection.category === "VIDEO" &&
        file.size < 100 * 1024 * 1024
      ) {
        try {
          const thumbnail = await this.generateVideoThumbnail(file, fileId);
          if (thumbnail) {
            metadata.thumbnail = thumbnail.base64;
            metadata.thumbnailWidth = thumbnail.width;
            metadata.thumbnailHeight = thumbnail.height;
          }
        } catch (error) {}
      }
      return metadata;
    } catch (error) {
      return {
        name: fileName,
        size: file.size,
        mimeType: file.type || "application/octet-stream",
        category: "UNKNOWN",
        sizeFormatted: FileTypeDetector.formatFileSize(file.size),
        canPreviewInApp: false,
        canOpenNatively: true,
      };
    }
  }
  private static async generateImageThumbnail(
    blob: Blob,
    fileId: string
  ): Promise<{ base64: string; width: number; height: number } | null> {
    const cached = this.thumbnailCache[fileId];
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return {
        base64: cached.base64,
        width: cached.width,
        height: cached.height,
      };
    }
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              resolve(null);
              return;
            }
            let width = img.width;
            let height = img.height;
            const maxDim = Math.max(width, height);
            if (maxDim > this.THUMBNAIL_MAX_WIDTH) {
              const scale = this.THUMBNAIL_MAX_WIDTH / maxDim;
              width = Math.floor(width * scale);
              height = Math.floor(height * scale);
            }
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
            const sizeBytes = dataUrl.length;
            if (this.cacheSize + sizeBytes > this.MAX_CACHE_SIZE) {
              this.evictOldestCacheEntry();
            }
            this.thumbnailCache[fileId] = {
              base64: dataUrl,
              width,
              height,
              timestamp: Date.now(),
            };
            this.cacheSize += sizeBytes;
            resolve({
              base64: dataUrl,
              width,
              height,
            });
          } catch (error) {
            resolve(null);
          }
        };
        img.onerror = () => {
          resolve(null);
        };
        img.src = e.target?.result as string;
      };
      reader.onerror = () => {
        resolve(null);
      };
      reader.readAsDataURL(blob);
    });
  }
  private static async generateVideoThumbnail(
    blob: Blob,
    fileId: string
  ): Promise<{ base64: string; width: number; height: number } | null> {
    const cached = this.thumbnailCache[fileId];
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return {
        base64: cached.base64,
        width: cached.width,
        height: cached.height,
      };
    }
    return new Promise((resolve) => {
      try {
        const url = URL.createObjectURL(blob);
        const video = document.createElement("video");
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve(null);
          return;
        }
        video.onloadedmetadata = () => {
          try {
            const width = Math.min(video.videoWidth, this.THUMBNAIL_MAX_WIDTH);
            const height = Math.min(
              video.videoHeight,
              this.THUMBNAIL_MAX_HEIGHT
            );
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(video, 0, 0, width, height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
            const sizeBytes = dataUrl.length;
            if (this.cacheSize + sizeBytes > this.MAX_CACHE_SIZE) {
              this.evictOldestCacheEntry();
            }
            this.thumbnailCache[fileId] = {
              base64: dataUrl,
              width,
              height,
              timestamp: Date.now(),
            };
            this.cacheSize += sizeBytes;
            URL.revokeObjectURL(url);
            resolve({
              base64: dataUrl,
              width,
              height,
            });
          } catch (error) {
            console.error("Error drawing video frame:", error);
            URL.revokeObjectURL(url);
            resolve(null);
          }
        };
        video.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(null);
        };
        video.src = url;
        video.currentTime = Math.min(1, video.duration || 1);
      } catch (error) {
        resolve(null);
      }
    });
  }
  private static evictOldestCacheEntry(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();
    for (const [key, value] of Object.entries(this.thumbnailCache)) {
      if (value.timestamp < oldestTime) {
        oldestTime = value.timestamp;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      const removed = this.thumbnailCache[oldestKey];
      this.cacheSize -= removed.base64.length;
      delete this.thumbnailCache[oldestKey];
    }
  }
  static clearCache(): void {
    this.thumbnailCache = {};
    this.cacheSize = 0;
  }
  static removeCacheEntry(fileId: string): void {
    const entry = this.thumbnailCache[fileId];
    if (entry) {
      this.cacheSize -= entry.base64.length;
      delete this.thumbnailCache[fileId];
    }
  }
  static getCacheSizeMb(): number {
    return this.cacheSize / (1024 * 1024);
  }
  static getCacheEntryCount(): number {
    return Object.keys(this.thumbnailCache).length;
  }
  static setMaxCacheSizeMb(sizeMb: number): void {
    this.MAX_CACHE_SIZE = sizeMb * 1024 * 1024;
  }
  static getPlaceholderIcon(category: FileTypeCategory): string {
    const iconMap: Record<FileTypeCategory, string> = {
      IMAGE: "🖼️",
      VIDEO: "🎬",
      AUDIO: "🎵",
      PDF: "📄",
      TEXT: "📝",
      DOCUMENT: "📗",
      SPREADSHEET: "📊",
      ARCHIVE: "🗂️",
      APK: "📦",
      UNKNOWN: "❓",
    };
    return iconMap[category] || "❓";
  }
  static calculateThumbnailDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number = this.THUMBNAIL_MAX_WIDTH,
    maxHeight: number = this.THUMBNAIL_MAX_HEIGHT
  ): { width: number; height: number } {
    const scale = Math.min(
      maxWidth / originalWidth,
      maxHeight / originalHeight,
      1
    );
    return {
      width: Math.floor(originalWidth * scale),
      height: Math.floor(originalHeight * scale),
    };
  }
  static secureWipeCache(): void {
    for (const [key, value] of Object.entries(this.thumbnailCache)) {
      const bytes = new Uint8Array(value.base64.length);
      delete this.thumbnailCache[key];
    }
    this.cacheSize = 0;
  }
}
