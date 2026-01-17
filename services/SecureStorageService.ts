import { Preferences } from "@capacitor/preferences";
import { CryptoService } from "./CryptoService";

/**
 * SecureStorageService: Provides encrypted storage for sensitive data like biometric passwords.
 *
 * Uses AES-GCM encryption with a static salt derived from the service identifier.
 * This ensures passwords are NOT stored in plain text in device preferences.
 *
 * For future enhancement:
 * - On Android: Use Android Keystore for hardware-backed encryption
 * - On iOS: Use Keychain for hardware-backed encryption
 * - The encryption key should ideally be derived from device-specific data
 */

const SECURE_STORAGE_SALT = "secure_storage_v1"; // Static salt for service-level encryption

export class SecureStorageService {
  /**
   * Encrypts and stores a sensitive value securely.
   * The value is encrypted using AES-GCM before storing in Preferences.
   */
  static async setSecure(key: string, value: string): Promise<void> {
    try {
      // Derive encryption key from static salt
      const encryptionKey = await CryptoService.deriveKey(
        SECURE_STORAGE_SALT,
        this.getServiceSalt()
      );

      // Create a blob and encrypt it
      const blob = new Blob([value], { type: "text/plain" });
      const encrypted = await CryptoService.encryptBlob(blob, encryptionKey);

      // Store encrypted data with IV
      const encryptedData = JSON.stringify({
        iv: encrypted.iv,
        content: encrypted.content,
        version: 1, // For future migration support
      });

      await Preferences.set({ key, value: encryptedData });
    } catch (e) {
      console.error(
        `[SecureStorageService] Error setting secure value for key "${key}":`,
        e
      );
      throw new Error(
        `Failed to securely store sensitive data: ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    }
  }

  /**
   * Retrieves and decrypts a sensitive value.
   * Returns null if the value doesn't exist or decryption fails.
   */
  static async getSecure(key: string): Promise<string | null> {
    try {
      const result = await Preferences.get({ key });
      if (!result || !result.value) {
        return null;
      }

      const encryptedData = JSON.parse(result.value);

      // Validate structure
      if (!encryptedData.iv || !encryptedData.content) {
        console.warn(
          `[SecureStorageService] Invalid encrypted data format for key "${key}"`
        );
        return null;
      }

      // Derive the same encryption key
      const encryptionKey = await CryptoService.deriveKey(
        SECURE_STORAGE_SALT,
        this.getServiceSalt()
      );

      // Decrypt
      const decryptedBuffer = await CryptoService.decryptBlob(
        encryptedData.content,
        encryptedData.iv,
        encryptionKey
      );

      // Convert buffer back to string
      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch (e) {
      console.error(
        `[SecureStorageService] Error retrieving secure value for key "${key}":`,
        e
      );
      // Return null instead of throwing to allow graceful degradation
      return null;
    }
  }

  /**
   * Removes a securely stored value.
   */
  static async removeSecure(key: string): Promise<void> {
    try {
      await Preferences.remove({ key });
    } catch (e) {
      console.error(
        `[SecureStorageService] Error removing secure value for key "${key}":`,
        e
      );
      throw e;
    }
  }

  /**
   * Migration helper: Migrates plain-text stored passwords to encrypted storage.
   * This should be called once during app upgrade to secure existing credentials.
   *
   * @param plainKey - The key where plain-text password is stored
   * @param secureKey - The key where encrypted password should be stored
   */
  static async migrateToSecureStorage(
    plainKey: string,
    secureKey: string
  ): Promise<boolean> {
    try {
      // Try to read plain-text value
      const plainResult = await Preferences.get({ key: plainKey });
      if (!plainResult || !plainResult.value) {
        return false; // Nothing to migrate
      }

      const plainPassword = plainResult.value;

      // Store securely
      await this.setSecure(secureKey, plainPassword);

      // Remove plain-text value
      await Preferences.remove({ key: plainKey });

      console.log(
        `[SecureStorageService] Successfully migrated ${plainKey} to ${secureKey}`
      );
      return true;
    } catch (e) {
      console.error(
        `[SecureStorageService] Migration from ${plainKey} to ${secureKey} failed:`,
        e
      );
      return false;
    }
  }

  /**
   * Generates a service-specific salt for encryption.
   * This salt is constant and unique to the SecureStorageService.
   * In a production app, this could incorporate device-specific identifiers.
   */
  private static getServiceSalt(): string {
    // Use a static salt that's different from vault operations
    // In production, consider including device identifiers for additional security
    const encoder = new TextEncoder();
    const encoded = encoder.encode("vault_secure_storage_service");
    return btoa(String.fromCharCode(...Array.from(encoded)));
  }
}
