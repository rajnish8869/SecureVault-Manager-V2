import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import type { FileOpenResult, FileTypeCategory } from "../types";

/**
 * NativeFileOpener: Capacitor-based native file opener for Android/iOS
 * - Opens files with native apps via Capacitor File Opener
 * - Manages secure temp files on native platforms
 * - Platform detection and permission checks
 *
 * Note: Requires '@capacitor-community/file-opener' plugin to be installed:
 *   npm install @capacitor-community/file-opener
 * And registered in Android/iOS native code
 */

interface FileOpenerPlugin {
  open(options: {
    filePath: string;
    openWith?: string;
    iosIsEditable?: boolean;
  }): Promise<void>;
}

export class NativeFileOpener {
  private static fileOpenerPlugin: FileOpenerPlugin | null = null;
  private static TEMP_DIR = "temp_files";
  private static initialized = false;

  /**
   * Initialize native file opener plugin
   * Safe to call multiple times
   */
  static async initialize(): Promise<void> {
    if (this.initialized) return;

    if (!Capacitor.isNativePlatform()) {
      console.debug(
        "[NativeFileOpener] Running on web platform, native opener not available"
      );
      this.initialized = true;
      return;
    }

    try {
      // Dynamically import the plugin if available
      // This prevents errors on web platform
      const { FileOpener } = await import("@capacitor-community/file-opener");
      this.fileOpenerPlugin = FileOpener as any;

      // Create temp directory
      await this.ensureTempDir();
      this.initialized = true;
      console.debug("[NativeFileOpener] Native file opener initialized");
    } catch (error) {
      console.warn("[NativeFileOpener] Plugin not available:", error);
      this.initialized = true; // Mark as initialized but unavailable
    }
  }

  /**
   * Check if native platform is available
   */
  static isNativeAvailable(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Check if file opener plugin is available
   */
  static async isFileOpenerAvailable(): Promise<boolean> {
    await this.initialize();
    return this.fileOpenerPlugin !== null;
  }

  /**
   * Open file with native app
   * On Android: automatically detects appropriate app
   * On iOS: shows app selection menu
   */
  static async openFile(filePath: string, mimeType: string): Promise<void> {
    if (!this.fileOpenerPlugin) {
      throw new Error("File opener plugin not available");
    }

    try {
      await this.fileOpenerPlugin.open({
        filePath,
        openWith: mimeType,
        iosIsEditable: false, // Prevent editing in vault
      });
    } catch (error: any) {
      // Handle common error cases
      if (error.message?.includes("not found")) {
        throw new Error(`No app available to open ${mimeType}`);
      }
      throw error;
    }
  }

  /**
   * Copy file to temp directory with security considerations
   * Returns path suitable for native opener
   */
  static async copyToTempDirectory(
    blob: Blob,
    fileName: string
  ): Promise<string> {
    try {
      // Create unique filename to avoid collisions
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      const uniqueName = `${timestamp}_${random}_${fileName}`;
      const tempPath = `${this.TEMP_DIR}/${uniqueName}`;

      // Write file to app data directory
      const data = await this.blobToBase64(blob);
      await Filesystem.writeFile({
        path: tempPath,
        data,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });

      // Get full path for native opener
      const result = await Filesystem.getUri({
        path: tempPath,
        directory: Directory.Data,
      });

      console.debug("[NativeFileOpener] File copied to temp:", result.uri);
      return result.uri;
    } catch (error) {
      throw new Error(`Failed to copy file to temp directory: ${error}`);
    }
  }

  /**
   * Securely wipe file from temp directory
   * Overwrites content before deletion for security
   */
  static async securelyWipeFile(filePath: string): Promise<void> {
    try {
      if (!filePath.includes(this.TEMP_DIR)) {
        console.warn(
          "[NativeFileOpener] Attempted to wipe non-temp file:",
          filePath
        );
        return;
      }

      // Extract relative path from URI
      const relativePath = this.extractRelativePath(filePath);
      if (!relativePath) return;

      // Overwrite with dummy data before deletion (secure wipe)
      const zeroData = "X".repeat(1024); // 1KB of dummy data
      try {
        await Filesystem.writeFile({
          path: relativePath,
          data: zeroData,
          directory: Directory.Data,
          encoding: Encoding.UTF8,
        });
      } catch {
        // File may already be deleted, continue
      }

      // Delete the file
      await Filesystem.deleteFile({
        path: relativePath,
        directory: Directory.Data,
      });

      console.debug("[NativeFileOpener] File securely wiped:", relativePath);
    } catch (error) {
      console.warn("[NativeFileOpener] Failed to wipe temp file:", error);
      // Non-critical, continue
    }
  }

  /**
   * Clean up all temp files
   * Should be called on app exit or periodically
   */
  static async cleanupTempFiles(
    olderThanMs: number = 24 * 60 * 60 * 1000
  ): Promise<number> {
    try {
      const now = Date.now();
      const cutoffTime = now - olderThanMs;
      let deletedCount = 0;

      const result = await Filesystem.readdir({
        path: this.TEMP_DIR,
        directory: Directory.Data,
      });

      for (const file of result.files) {
        const filePath = `${this.TEMP_DIR}/${file.name}`;
        try {
          // Try to secure wipe
          await this.securelyWipeFile(filePath);
          deletedCount++;
        } catch (error) {
          console.warn(`Failed to clean up ${filePath}:`, error);
        }
      }

      console.debug(`[NativeFileOpener] Cleaned up ${deletedCount} temp files`);
      return deletedCount;
    } catch (error) {
      console.warn("[NativeFileOpener] Error cleaning temp directory:", error);
      return 0;
    }
  }

  /**
   * Ensure temp directory exists
   */
  private static async ensureTempDir(): Promise<void> {
    try {
      await Filesystem.mkdir({
        path: this.TEMP_DIR,
        directory: Directory.Data,
        recursive: true,
      });
    } catch (error: any) {
      // Directory may already exist, ignore
      if (!error.message?.includes("already exists")) {
        console.warn(
          "[NativeFileOpener] Failed to create temp directory:",
          error
        );
      }
    }
  }

  /**
   * Convert blob to base64 string
   */
  private static blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove "data:...;base64," prefix
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Extract relative path from full URI
   */
  private static extractRelativePath(uri: string): string | null {
    try {
      // Handle various URI formats
      if (uri.includes("file://")) {
        const path = decodeURIComponent(uri.replace("file://", ""));
        // Extract relative path from data directory
        const dataIdx = path.indexOf("/files/");
        if (dataIdx !== -1) {
          return path.substring(dataIdx + 7); // '/files/' is 7 chars
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get platform info
   */
  static getPlatformInfo(): {
    isNative: boolean;
    platform: "android" | "ios" | "web";
    version: string;
  } {
    const platform = Capacitor.getPlatform() as "android" | "ios" | "web";
    try {
      const webView = (Capacitor as any).getWebView?.();
      const version = webView?.version || "unknown";
      return {
        isNative: Capacitor.isNativePlatform(),
        platform,
        version,
      };
    } catch (error) {
      // Fallback when getWebView not available
      return {
        isNative: Capacitor.isNativePlatform(),
        platform,
        version: "unknown",
      };
    }
  }

  /**
   * Check specific platform
   */
  static isAndroid(): boolean {
    return Capacitor.getPlatform() === "android";
  }

  static isIOS(): boolean {
    return Capacitor.getPlatform() === "ios";
  }

  static isWeb(): boolean {
    return Capacitor.getPlatform() === "web";
  }

  /**
   * Handle file open with proper error handling and fallbacks
   */
  static async handleFileOpen(
    blob: Blob,
    fileName: string,
    mimeType: string
  ): Promise<FileOpenResult> {
    if (!this.isNativeAvailable()) {
      return {
        success: false,
        method: "UNSUPPORTED",
        uri: null,
        category: "UNKNOWN",
        error: "Native file opener not available",
      };
    }

    try {
      await this.initialize();

      if (!this.fileOpenerPlugin) {
        return {
          success: false,
          method: "UNSUPPORTED",
          uri: null,
          category: "UNKNOWN",
          error: "File opener plugin not installed",
        };
      }

      // Copy to temp directory
      const tempPath = await this.copyToTempDirectory(blob, fileName);

      // Attempt to open
      try {
        await this.openFile(tempPath, mimeType);
        return {
          success: true,
          method: "NATIVE",
          uri: tempPath,
          category: "UNKNOWN", // Would be populated by FileOpenService
          tempPath,
        };
      } catch (openError: any) {
        // Cleanup temp file if opening failed
        try {
          await this.securelyWipeFile(tempPath);
        } catch {
          // Ignore cleanup errors
        }

        return {
          success: false,
          method: "NATIVE",
          uri: null,
          category: "UNKNOWN",
          error: openError.message || "Failed to open file with native app",
        };
      }
    } catch (error: any) {
      return {
        success: false,
        method: "NATIVE",
        uri: null,
        category: "UNKNOWN",
        error: error.message || "Unknown error in native file opener",
      };
    }
  }

  /**
   * Get list of available apps that can handle MIME type
   * Android only - useful for showing app picker
   */
  static async getHandlingApps(mimeType: string): Promise<string[]> {
    if (!this.isAndroid()) {
      console.debug(
        "[NativeFileOpener] App detection only available on Android"
      );
      return [];
    }

    // This would require native Android code to query PackageManager
    // For now, return empty array
    // Implement via Capacitor plugin if needed
    return [];
  }
}
