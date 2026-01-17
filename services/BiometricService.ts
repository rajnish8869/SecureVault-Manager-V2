import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";
import { NativeBiometric } from "@capgo/capacitor-native-biometric";
import { SecureStorageService } from "./SecureStorageService";

export enum BiometricError {
  NOT_AVAILABLE = "NOT_AVAILABLE",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  HARDWARE_UNAVAILABLE = "HARDWARE_UNAVAILABLE",
  NOT_ENROLLED = "NOT_ENROLLED",
  AUTHENTICATION_FAILED = "AUTHENTICATION_FAILED",
  TIMEOUT = "TIMEOUT",
  CANCELLED_BY_USER = "CANCELLED_BY_USER",
  NOT_SUPPORTED_ON_PLATFORM = "NOT_SUPPORTED_ON_PLATFORM",
  UNKNOWN = "UNKNOWN",
}

export interface BiometricCapability {
  available: boolean;
  hasFingerprint: boolean;
  hasFaceUnlock: boolean;
  isEnrolled: boolean;
  error?: BiometricError;
  errorMessage?: string;
}

export interface BiometricAuthResult {
  success: boolean;
  error?: BiometricError;
  errorMessage?: string;
  password?: string;
}

const BIO_ENABLED_KEY = "vault_bio_enabled";
const BIO_CAPABILITY_CHECK_KEY = "vault_bio_capability_check";
const BIO_PASSWORD_KEY = "vault_bio_password";

export class BiometricService {
  static async detectCapabilities(): Promise<BiometricCapability> {
    try {
      if (!Capacitor.isNativePlatform()) {
        return {
          available: false,
          hasFingerprint: false,
          hasFaceUnlock: false,
          isEnrolled: false,
          error: BiometricError.NOT_SUPPORTED_ON_PLATFORM,
          errorMessage:
            "Biometrics only available on native platforms (Android/iOS)",
        };
      }

      const result = await NativeBiometric.isAvailable();

      if (!result.isAvailable) {
        return {
          available: false,
          hasFingerprint: false,
          hasFaceUnlock: false,
          isEnrolled: false,
          error: BiometricError.HARDWARE_UNAVAILABLE,
          errorMessage: "Device does not support biometric authentication",
        };
      }

      const biometryType = (result.biometryType || "fingerprint") as string;

      return {
        available: true,
        hasFingerprint:
          biometryType === "fingerprint" ||
          biometryType === "fingerprint,face" ||
          biometryType === "fingerprint,iris",
        hasFaceUnlock:
          biometryType === "face" ||
          biometryType === "fingerprint,face" ||
          biometryType === "face,iris",
        isEnrolled: result.isAvailable,
        error: undefined,
      };
    } catch (e: any) {
      let error = BiometricError.UNKNOWN;
      let errorMessage =
        e.message || "Unknown error during capability detection";

      if (e.message?.includes("permission") || e.message?.includes("denied")) {
        error = BiometricError.PERMISSION_DENIED;
        errorMessage = "Permission denied for biometric access";
      } else if (e.message?.includes("enrolled")) {
        error = BiometricError.NOT_ENROLLED;
        errorMessage = "No biometrics enrolled on device";
      } else if (
        e.message?.includes("not supported") ||
        e.message?.includes("unavailable")
      ) {
        error = BiometricError.HARDWARE_UNAVAILABLE;
        errorMessage = "Device does not support biometric authentication";
      }

      return {
        available: false,
        hasFingerprint: false,
        hasFaceUnlock: false,
        isEnrolled: false,
        error,
        errorMessage,
      };
    }
  }

  static async authenticate(): Promise<BiometricAuthResult> {
    try {
      const capabilities = await this.detectCapabilities();
      if (!capabilities.available) {
        return {
          success: false,
          error: capabilities.error || BiometricError.NOT_AVAILABLE,
          errorMessage: capabilities.errorMessage || "Biometrics not available",
        };
      }

      if (!capabilities.isEnrolled) {
        return {
          success: false,
          error: BiometricError.NOT_ENROLLED,
          errorMessage:
            "No biometrics enrolled. Please enroll in device settings.",
        };
      }

      try {
        // verifyIdentity returns void on success, and throws an exception on failure.
        // We do not check for a returned object.
        await NativeBiometric.verifyIdentity({
          reason: "Unlock your vault",
          title: "Biometric Authentication",
          subtitle: "Verify your identity to access your vault",
          description: "Use your fingerprint or face to unlock",
          negativeButtonText: "Cancel",
        });

        // If we reached here, authentication was successful
        const storedPassword = await this.getStoredPassword();
        return {
          success: true,
          password: storedPassword || undefined,
        };
      } catch (authError: any) {
        const errorMsg = authError.message || authError.toString();

        if (
          errorMsg.includes("cancelled") ||
          errorMsg.includes("user cancelled")
        ) {
          return {
            success: false,
            error: BiometricError.CANCELLED_BY_USER,
            errorMessage: "Biometric authentication cancelled",
          };
        }
        if (errorMsg.includes("timeout")) {
          return {
            success: false,
            error: BiometricError.TIMEOUT,
            errorMessage: "Biometric authentication timed out",
          };
        }
        if (
          errorMsg.includes("not supported") ||
          errorMsg.includes("unavailable")
        ) {
          return {
            success: false,
            error: BiometricError.NOT_AVAILABLE,
            errorMessage: "Biometrics not supported on this device",
          };
        }
        if (errorMsg.includes("permission") || errorMsg.includes("denied")) {
          return {
            success: false,
            error: BiometricError.PERMISSION_DENIED,
            errorMessage: "Permission denied for biometric authentication",
          };
        }
        if (errorMsg.includes("enrolled")) {
          return {
            success: false,
            error: BiometricError.NOT_ENROLLED,
            errorMessage: "No biometrics enrolled on device",
          };
        }

        return {
          success: false,
          error: BiometricError.AUTHENTICATION_FAILED,
          errorMessage: errorMsg || "Biometric authentication failed",
        };
      }
    } catch (e: any) {
      return {
        success: false,
        error: BiometricError.UNKNOWN,
        errorMessage:
          e.message || "Unknown error during biometric authentication",
      };
    }
  }

  /**
   * Securely stores the biometric password using encrypted storage.
   * The password is encrypted with AES-GCM before being persisted to device storage.
   * This prevents attackers from simply reading the stored password from device files.
   *
   * Future enhancement: Use platform-specific secure storage
   * - Android: Android Keystore (hardware-backed encryption if available)
   * - iOS: iOS Keychain
   */
  static async storePassword(password: string): Promise<void> {
    try {
      // Store password using encrypted storage instead of plain text
      await SecureStorageService.setSecure(BIO_PASSWORD_KEY, password);

      // Keep marker that biometric password exists (for backwards compatibility)
      await Preferences.set({ key: BIO_CAPABILITY_CHECK_KEY, value: "true" });

      console.log("[BiometricService] Password stored securely");
    } catch (e) {
      console.error("[BiometricService] Error storing password securely:", e);
      throw e;
    }
  }

  static async getStoredPassword(): Promise<string | null> {
    try {
      // First, try to retrieve from secure storage (encrypted)
      const encryptedPassword = await SecureStorageService.getSecure(
        BIO_PASSWORD_KEY
      );
      if (encryptedPassword) {
        return encryptedPassword;
      }

      // Fallback: Check for plain-text password from old installations
      // and migrate it to secure storage
      const plainResult = await Preferences.get({ key: BIO_PASSWORD_KEY });
      if (plainResult && plainResult.value) {
        console.warn(
          "[BiometricService] Found plain-text password, migrating to secure storage"
        );
        try {
          await SecureStorageService.setSecure(
            BIO_PASSWORD_KEY,
            plainResult.value
          );
          // Remove old plain-text value after migration
          await Preferences.remove({ key: BIO_PASSWORD_KEY });
          return plainResult.value;
        } catch (migrationError) {
          console.error(
            "[BiometricService] Failed to migrate password to secure storage:",
            migrationError
          );
          // Fall through and return null
        }
      }

      return null;
    } catch (e) {
      console.error("[BiometricService] Error retrieving password:", e);
      return null;
    }
  }

  static async clearStoredPassword(): Promise<void> {
    try {
      // Remove encrypted password
      await SecureStorageService.removeSecure(BIO_PASSWORD_KEY);

      // Also clear any old plain-text password (for migration)
      await Preferences.remove({ key: BIO_PASSWORD_KEY });

      // Remove capability marker
      await Preferences.remove({ key: BIO_CAPABILITY_CHECK_KEY });

      console.log("[BiometricService] Stored password cleared");
    } catch (e) {
      console.error("[BiometricService] Error clearing password:", e);
    }
  }

  static async isEnabled(): Promise<boolean> {
    try {
      const { value } = await Preferences.get({ key: BIO_ENABLED_KEY });
      return value === "true";
    } catch (e) {
      console.error("[BiometricService] Error checking enabled status:", e);
      return false;
    }
  }

  static async setEnabled(enabled: boolean, password?: string): Promise<void> {
    try {
      if (enabled) {
        const capabilities = await this.detectCapabilities();
        if (!capabilities.available) {
          throw new Error(
            capabilities.errorMessage ||
              "Biometrics not available on this device"
          );
        }
        if (!password) {
          throw new Error("Password is required to enable biometric unlock");
        }
        await this.storePassword(password);
      } else {
        await this.clearStoredPassword();
      }

      await Preferences.set({ key: BIO_ENABLED_KEY, value: String(enabled) });
    } catch (e) {
      console.error("[BiometricService] Error setting enabled status:", e);
      throw e;
    }
  }

  static getStatusMessage(capability: BiometricCapability): string {
    if (!capability.available) {
      if (capability.error === BiometricError.NOT_SUPPORTED_ON_PLATFORM) {
        return "Biometrics not available on this platform";
      }
      if (capability.error === BiometricError.HARDWARE_UNAVAILABLE) {
        return "Your device does not support biometric authentication";
      }
      if (capability.error === BiometricError.NOT_ENROLLED) {
        return "No biometrics enrolled. Please enroll in device settings.";
      }
      if (capability.error === BiometricError.PERMISSION_DENIED) {
        return "Permission denied. Please grant biometric permission in settings.";
      }
      return capability.errorMessage || "Biometrics not available";
    }

    const methods = [];
    if (capability.hasFingerprint) methods.push("Fingerprint");
    if (capability.hasFaceUnlock) methods.push("Face Unlock");
    if (methods.length === 0) return "Biometric available";
    return `Supports: ${methods.join(" & ")}`;
  }
}
