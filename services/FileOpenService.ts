import type { FileOpenResult, FileOpenConfig, StreamProgress } from "../types";
import { FileTypeDetector } from "./FileTypeDetector";
import { FilePreviewService } from "./FilePreviewService";
import { NativeFileOpener } from "./NativeFileOpener";
import { CryptoService } from "./CryptoService";
import { StorageService } from "./StorageService";
interface DecryptedFileInfo {
  blob: Blob;
  fileName: string;
  mimeType: string;
}
export class FileOpenService {
  private static config: FileOpenConfig = {
    maxInMemorySize: 100,
    generateThumbnails: true,
    cacheThumbnails: true,
    maxCacheSize: 50,
    secureWipeTempFiles: true,
    operationTimeout: 30000,
  };
  private static activeOperations = new Map<string, AbortController>();
  private static progressCallbacks = new Map<
    string,
    (progress: StreamProgress) => void
  >();
  static async initialize(
    customConfig?: Partial<FileOpenConfig>
  ): Promise<void> {
    if (customConfig) {
      this.config = { ...this.config, ...customConfig };
    }
    if (NativeFileOpener.isNativeAvailable()) {
      await NativeFileOpener.initialize();
    }
  }
  static async openFile(
    blob: Blob,
    fileName: string,
    options?: {
      isVaultFile?: boolean;
      vaultFileId?: string;
      vaultPassword?: string;
      decryptionKey?: CryptoKey;
      onProgress?: (progress: StreamProgress) => void;
      preferNative?: boolean;
      forceNative?: boolean;
    }
  ): Promise<FileOpenResult> {
    const operationId = `${options?.vaultFileId || fileName}_${Date.now()}`;
    const abortController = new AbortController();
    this.activeOperations.set(operationId, abortController);
    if (options?.onProgress) {
      this.progressCallbacks.set(operationId, options.onProgress);
    }
    try {
      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, this.config.operationTimeout);
      try {
        const result = await this._openFileInternal(blob, fileName, {
          ...options,
          operationId,
          abortController,
        });
        clearTimeout(timeoutId);
        return result;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    } catch (error: any) {
      return this._handleError(error, fileName);
    } finally {
      this.activeOperations.delete(operationId);
      this.progressCallbacks.delete(operationId);
    }
  }
  private static async _openFileInternal(
    blob: Blob,
    fileName: string,
    options: {
      isVaultFile?: boolean;
      vaultFileId?: string;
      vaultPassword?: string;
      decryptionKey?: CryptoKey;
      onProgress?: (progress: StreamProgress) => void;
      preferNative?: boolean;
      forceNative?: boolean;
      operationId: string;
      abortController: AbortController;
    }
  ): Promise<FileOpenResult> {
    const detection = await FileTypeDetector.detectType(blob, fileName);
    let fileToOpen = blob;
    let tempPath: string | undefined;
    if (options.isVaultFile && options.decryptionKey) {
      try {
        this._reportProgress(options.operationId, {
          total: blob.size,
          loaded: 0,
          percent: 0,
        });
        fileToOpen = await StorageService.loadFile(
          options.vaultFileId || "",
          options.decryptionKey
        );
        tempPath = `vault:${options.vaultFileId}`;
        this._reportProgress(options.operationId, {
          total: blob.size,
          loaded: blob.size,
          percent: 100,
        });
      } catch (error) {
        return {
          success: false,
          method: "UNSUPPORTED",
          uri: null,
          category: detection.category,
          error: "Failed to decrypt vault file",
        };
      }
    }
    const method = this._determineOpenerMethod(
      detection.category,
      fileToOpen.size,
      {
        preferNative: options.preferNative,
        forceNative: options.forceNative,
      }
    );
    switch (method) {
      case "IN_APP":
        return this._openInApp(
          fileToOpen,
          fileName,
          detection.mimeType,
          detection.category
        );
      case "NATIVE":
        return this._openNative(
          fileToOpen,
          fileName,
          detection.mimeType,
          detection.category,
          tempPath
        );
      case "DOWNLOAD":
        return this._prepareDownload(
          fileToOpen,
          fileName,
          detection.mimeType,
          detection.category
        );
      case "UNSUPPORTED":
      default:
        return {
          success: false,
          method: "UNSUPPORTED",
          uri: null,
          category: detection.category,
          error: `File type not supported: ${detection.category}`,
        };
    }
  }
  private static async _openInApp(
    blob: Blob,
    fileName: string,
    mimeType: string,
    category: string
  ): Promise<FileOpenResult> {
    try {
      let uri: string;
      if (blob.size > (this.config.maxInMemorySize || 100) * 1024 * 1024) {
        uri = URL.createObjectURL(blob);
      } else {
        try {
          const base64 = await this._blobToBase64(blob);
          uri = `data:${mimeType};base64,${base64}`;
        } catch (base64Error) {
          uri = URL.createObjectURL(blob);
        }
      }
      return {
        success: true,
        method: "IN_APP",
        uri,
        category: category as any,
        wasDecrypted: false,
      };
    } catch (error: any) {
      return {
        success: false,
        method: "IN_APP",
        uri: null,
        category: category as any,
        error: `Failed to prepare in-app preview: ${error.message}`,
      };
    }
  }
  private static async _openNative(
    blob: Blob,
    fileName: string,
    mimeType: string,
    category: string,
    vaultTempPath?: string
  ): Promise<FileOpenResult> {
    if (!NativeFileOpener.isNativeAvailable()) {
      return {
        success: false,
        method: "NATIVE",
        uri: null,
        category: category as any,
        error: "Native file opener not available on this platform",
      };
    }
    try {
      const result = await NativeFileOpener.handleFileOpen(
        blob,
        fileName,
        mimeType
      );
      result.category = category as any;
      if (result.tempPath && this.config.secureWipeTempFiles) {
        setTimeout(async () => {
          try {
            await NativeFileOpener.securelyWipeFile(result.tempPath!);
          } catch (error) {
          }
        }, 10000);
      }
      return result;
    } catch (error: any) {
      return {
        success: false,
        method: "NATIVE",
        uri: null,
        category: category as any,
        error: error.message || "Failed to open with native app",
      };
    }
  }
  private static async _prepareDownload(
    blob: Blob,
    fileName: string,
    mimeType: string,
    category: string
  ): Promise<FileOpenResult> {
    try {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 100);
      return {
        success: true,
        method: "DOWNLOAD",
        uri: null,
        category: category as any,
      };
    } catch (error: any) {
      return {
        success: false,
        method: "DOWNLOAD",
        uri: null,
        category: category as any,
        error: `Failed to download file: ${error.message}`,
      };
    }
  }
  private static _determineOpenerMethod(
    category: string,
    fileSize: number,
    options: { preferNative?: boolean; forceNative?: boolean } = {}
  ): "IN_APP" | "NATIVE" | "DOWNLOAD" | "UNSUPPORTED" {
    if (
      category === "PDF" &&
      NativeFileOpener.isNativeAvailable() &&
      NativeFileOpener.isAndroid()
    ) {
      return "NATIVE";
    }
    if (options.forceNative && NativeFileOpener.isNativeAvailable()) {
      return "NATIVE";
    }
    if (
      ["IMAGE", "VIDEO", "AUDIO", "TEXT"].includes(category) &&
      !options.preferNative
    ) {
      return "IN_APP";
    }
    if (category === "PDF") {
      if (NativeFileOpener.isNativeAvailable()) {
        return "NATIVE";
      }
      return "IN_APP";
    }
    if (["DOCUMENT", "SPREADSHEET", "ARCHIVE", "APK"].includes(category)) {
      if (NativeFileOpener.isNativeAvailable()) {
        return "NATIVE";
      }
      if (NativeFileOpener.isWeb()) {
        return "DOWNLOAD";
      }
    }
    return "UNSUPPORTED";
  }
  static cancelOperation(operationId: string): void {
    const controller = this.activeOperations.get(operationId);
    if (controller) {
      controller.abort();
      this.activeOperations.delete(operationId);
    }
  }
  private static _reportProgress(
    operationId: string,
    progress: StreamProgress
  ): void {
    const callback = this.progressCallbacks.get(operationId);
    if (callback) {
      callback(progress);
    }
  }
  private static _blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  private static _handleError(error: any, fileName: string): FileOpenResult {
    let userMessage = "Failed to open file";
    if (error instanceof DOMException && error.name === "AbortError") {
      userMessage = "Operation timed out. File may be too large.";
    } else if (error.message?.includes("decrypt")) {
      userMessage = "Failed to decrypt vault file. Check your password.";
    } else if (error.message?.includes("not found")) {
      userMessage = `File not found: ${fileName}`;
    } else if (error.message?.includes("permission")) {
      userMessage = "Permission denied. Check app permissions.";
    } else if (error.message?.includes("MIME")) {
      userMessage = "Unrecognized file format";
    } else if (error.message?.includes("PDF viewer")) {
      userMessage = error.message;
    } else if (
      error.message?.includes("No app available") ||
      error.message?.includes("not installed")
    ) {
      if (fileName.toLowerCase().endsWith(".pdf")) {
        userMessage =
          "No PDF reader app installed. Please install Google PDF Viewer, Adobe Reader, or another PDF app.";
      } else {
        userMessage = `No app available to open this file type (${fileName})`;
      }
    }
    return {
      success: false,
      method: "UNSUPPORTED",
      uri: null,
      category: "UNKNOWN",
      error: userMessage,
    };
  }
  static async secureWipeData(filePath: string): Promise<void> {
    if (NativeFileOpener.isNativeAvailable()) {
      await NativeFileOpener.securelyWipeFile(filePath);
    }
  }
  static getConfig(): FileOpenConfig {
    return { ...this.config };
  }
  static updateConfig(updates: Partial<FileOpenConfig>): void {
    this.config = { ...this.config, ...updates };
  }
  static getPlatformInfo() {
    return {
      isNative: NativeFileOpener.isNativeAvailable(),
      platform: NativeFileOpener.getPlatformInfo(),
      hasFileOpener: NativeFileOpener.isFileOpenerAvailable(),
    };
  }
  static async cleanup(): Promise<void> {
    for (const [opId] of this.activeOperations) {
      this.cancelOperation(opId);
    }
    if (NativeFileOpener.isNativeAvailable()) {
      await NativeFileOpener.cleanupTempFiles(60 * 60 * 1000);
    }
    if (this.config.cacheThumbnails) {
      FilePreviewService.secureWipeCache();
    }
  }
}