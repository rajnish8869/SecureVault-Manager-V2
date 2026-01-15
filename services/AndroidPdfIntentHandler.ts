import { Capacitor } from "@capacitor/core";
interface AndroidIntentOptions {
  action: string;
  type: string;
  data: string;
  flags?: number[];
}
interface AndroidIntentResult {
  success: boolean;
  error?: string;
  message?: string;
}
export class AndroidPdfIntentHandler {
  private static readonly ACTION_VIEW = "android.intent.action.VIEW";
  private static readonly ACTION_SEND = "android.intent.action.SEND";
  private static readonly FLAG_GRANT_READ_URI_PERMISSION = 0x00000001;
  private static readonly FLAG_GRANT_WRITE_URI_PERMISSION = 0x00000002;
  private static readonly FLAG_ACTIVITY_NEW_TASK = 0x10000000;
  private static readonly FLAG_ACTIVITY_CLEAR_TOP = 0x04000000;
  private static readonly PDF_MIME_TYPE = "application/pdf";
  private static readonly ALTERNATIVE_PDF_TYPES = [
    "application/x-pdf",
    "application/x-bzpdf",
    "application/x-gzpdf",
  ];
  static isAndroid(): boolean {
    return Capacitor.getPlatform() === "android";
  }
  static async isPdfViewerAvailable(): Promise<boolean> {
    if (!this.isAndroid()) {
      return false;
    }
    try {
      const result = await this.executeAndroidIntent({
        action: "CHECK_PDF_VIEWER",
        type: this.PDF_MIME_TYPE,
        data: "",
      });
      return result.success || false;
    } catch (error) {
      console.warn(
        "[AndroidPdfIntentHandler] Error checking PDF viewer availability:",
        error
      );
      return false;
    }
  }
  static async openPdfWithIntent(
    fileUri: string
  ): Promise<AndroidIntentResult> {
    if (!this.isAndroid()) {
      return {
        success: false,
        error: "Not running on Android platform",
      };
    }
    try {
      console.debug(
        "[AndroidPdfIntentHandler] Opening PDF with Intent:",
        this.sanitizeUri(fileUri)
      );
      if (!this.isValidUri(fileUri)) {
        return {
          success: false,
          error: "Invalid file URI format",
        };
      }
      const intentOptions = this.buildPdfIntent(fileUri);
      const result = await this.executeAndroidIntent(intentOptions);
      if (result.success) {
        console.debug("[AndroidPdfIntentHandler] PDF opened successfully");
      } else {
        console.error(
          "[AndroidPdfIntentHandler] Failed to open PDF:",
          result.error
        );
      }
      return result;
    } catch (error: any) {
      console.error("[AndroidPdfIntentHandler] Unexpected error:", error);
      return {
        success: false,
        error: `Unexpected error: ${error.message || error}`,
      };
    }
  }
  private static buildPdfIntent(fileUri: string): AndroidIntentOptions {
    const isContentUri = fileUri.startsWith("content:");
    const intentOptions: AndroidIntentOptions = {
      action: this.ACTION_VIEW,
      type: this.PDF_MIME_TYPE,
      data: fileUri,
      flags: [this.FLAG_ACTIVITY_NEW_TASK],
    };
    if (isContentUri) {
      intentOptions.flags!.push(this.FLAG_GRANT_READ_URI_PERMISSION);
      console.debug(
        "[AndroidPdfIntentHandler] Added FLAG_GRANT_READ_URI_PERMISSION for content URI"
      );
    }
    return intentOptions;
  }
  private static async executeAndroidIntent(
    options: AndroidIntentOptions
  ): Promise<AndroidIntentResult> {
    try {
      if (
        (Capacitor as any).exec &&
        typeof (Capacitor as any).exec === "function"
      ) {
        return new Promise((resolve) => {
          (Capacitor as any).exec(
            (result: any) => {
              console.debug(
                "[AndroidPdfIntentHandler] Intent executed successfully"
              );
              resolve({ success: true });
            },
            (error: any) => {
              console.error(
                "[AndroidPdfIntentHandler] Intent execution failed:",
                error
              );
              resolve({
                success: false,
                error: error?.message || String(error),
              });
            },
            "AndroidPdfIntentHandler",
            "openPdf",
            [options]
          );
        });
      }
      if ((window as any).Android && (window as any).Android.openPdf) {
        return new Promise((resolve) => {
          try {
            (window as any).Android.openPdf(
              options.data,
              (success: boolean) => {
                resolve({
                  success,
                  error: success ? undefined : "Failed to open PDF",
                });
              }
            );
          } catch (error) {
            resolve({
              success: false,
              error: `Bridge call failed: ${error}`,
            });
          }
        });
      }
      console.warn(
        "[AndroidPdfIntentHandler] No direct intent executor available, falling back to FileOpener"
      );
      return {
        success: false,
        error:
          "No Android intent handler available. Install plugin or update Capacitor.",
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Intent execution error: ${error.message || error}`,
      };
    }
  }
  private static isValidUri(uri: string): boolean {
    return (
      uri.startsWith("content:") ||
      uri.startsWith("file:") ||
      uri.startsWith("http:") ||
      uri.startsWith("https:")
    );
  }
  private static sanitizeUri(uri: string): string {
    if (uri.includes("vault") || uri.includes("data")) {
      return uri.replace(/\/[\w-]{36}\/.*$/, "/[REDACTED]");
    }
    return uri;
  }
  static async getAvailablePdfViewers(): Promise<string[]> {
    if (!this.isAndroid()) {
      return [];
    }
    try {
      const commonViewers = [
        "com.google.android.apps.docs",
        "com.adobe.reader",
        "org.sufficientlysecure.viewer",
        "com.foxit.mobile.pdf.lite",
      ];
      return commonViewers;
    } catch (error) {
      console.warn(
        "[AndroidPdfIntentHandler] Could not retrieve PDF viewer list:",
        error
      );
      return [];
    }
  }
}