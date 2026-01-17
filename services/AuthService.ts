import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";
import { CryptoService } from "./CryptoService";
import { BiometricService } from "./BiometricService";
import { RateLimitService } from "./RateLimitService";
import { RecoveryKeyService } from "./RecoveryKeyService";
import type { LockType, IntruderSettings } from "../types";

const SALT_KEY = "vault_salt";
const VERIFIER_REAL = "vault_verifier_real";
const VERIFIER_DECOY = "vault_verifier_decoy";
const TYPE_KEY = "vault_lock_type";
const BIO_ENABLED_KEY = "vault_bio_enabled";
const INTRUDER_CONFIG_KEY = "vault_intruder_config";
const RECOVERY_KEY_HASH = "vault_recovery_key_hash";
const RECOVERY_KEY_SALT = "vault_recovery_key_salt";
const LOCKOUT_STATE_KEY = "vault_lockout_state";
const RECOVERY_ATTEMPTS_KEY = "vault_recovery_attempts";
export class AuthService {
  static async isInitialized(): Promise<boolean> {
    const { value } = await Preferences.get({ key: VERIFIER_REAL });
    return !!value;
  }
  static async getSalt(): Promise<string | null> {
    const { value } = await Preferences.get({ key: SALT_KEY });
    return value;
  }
  static async initializeVault(
    password: string,
    type: LockType
  ): Promise<{ salt: string }> {
    const salt = await CryptoService.generateSalt();
    const verifier = await CryptoService.hashForVerification(password, salt);
    await Preferences.set({ key: SALT_KEY, value: salt });
    await Preferences.set({ key: VERIFIER_REAL, value: verifier });
    await Preferences.set({ key: TYPE_KEY, value: type });
    return { salt };
  }
  static async verifyCredentials(
    password: string
  ): Promise<{ success: boolean; mode?: "REAL" | "DECOY"; salt?: string }> {
    const salt = await this.getSalt();
    const realRes = await Preferences.get({ key: VERIFIER_REAL });
    const decoyRes = await Preferences.get({ key: VERIFIER_DECOY });
    if (!salt || !realRes.value)
      throw new Error("Vault corrupted or not initialized");
    const inputHash = await CryptoService.hashForVerification(password, salt);
    if (inputHash === realRes.value) {
      return { success: true, mode: "REAL", salt };
    } else if (decoyRes.value && inputHash === decoyRes.value) {
      return { success: true, mode: "DECOY", salt };
    }
    return { success: false };
  }
  static async getLockType(): Promise<LockType> {
    const { value } = await Preferences.get({ key: TYPE_KEY });
    return (value as LockType) || "PASSWORD";
  }
  static async updateCredentials(
    newSalt: string,
    newVerifier: string,
    newType: LockType
  ) {
    await Preferences.set({ key: SALT_KEY, value: newSalt });
    await Preferences.set({ key: VERIFIER_REAL, value: newVerifier });
    await Preferences.set({ key: TYPE_KEY, value: newType });
    await Preferences.remove({ key: VERIFIER_DECOY });
  }
  static async setDecoyCredential(password: string, salt: string) {
    const verifier = await CryptoService.hashForVerification(password, salt);
    await Preferences.set({ key: VERIFIER_DECOY, value: verifier });
  }
  static async removeDecoyCredential() {
    await Preferences.remove({ key: VERIFIER_DECOY });
  }
  static async hasDecoy(): Promise<boolean> {
    const { value } = await Preferences.get({ key: VERIFIER_DECOY });
    return !!value;
  }
  static async checkBiometricAvailability(): Promise<boolean> {
    try {
      const capabilities = await BiometricService.detectCapabilities();
      return capabilities.available && capabilities.isEnrolled;
    } catch (e) {
      console.error("[AuthService] Error checking biometric availability:", e);
      return false;
    }
  }
  static async getBiometricEnabled(): Promise<boolean> {
    try {
      return await BiometricService.isEnabled();
    } catch (e) {
      console.error("[AuthService] Error getting biometric enabled status:", e);
      return false;
    }
  }
  static async setBiometricEnabled(enabled: boolean, password?: string) {
    try {
      await BiometricService.setEnabled(enabled, password);
    } catch (e) {
      console.error("[AuthService] Error setting biometric enabled status:", e);
      throw e;
    }
  }
  static async authenticateBiometric(): Promise<{
    success: boolean;
    password?: string;
    error?: string;
  }> {
    try {
      const enabled = await this.getBiometricEnabled();
      if (!enabled) {
        console.warn("[AuthService] Biometrics not enabled");
        return { success: false, error: "Biometrics not enabled" };
      }
      const available = await this.checkBiometricAvailability();
      if (!available) {
        console.warn("[AuthService] Biometrics not available");
        return { success: false, error: "Biometrics not available" };
      }
      const result = await BiometricService.authenticate();
      return {
        success: result.success,
        password: result.password,
        error: result.errorMessage,
      };
    } catch (e: any) {
      console.error("[AuthService] Biometric authentication error:", e);
      return { success: false, error: e.message || "Authentication error" };
    }
  }
  static async getBiometricPassword(): Promise<string | null> {
    try {
      return await BiometricService.getStoredPassword();
    } catch (e) {
      console.error("[AuthService] Error getting biometric password:", e);
      return null;
    }
  }
  static async getIntruderSettings(): Promise<IntruderSettings> {
    const { value } = await Preferences.get({ key: INTRUDER_CONFIG_KEY });
    if (value) {
      return JSON.parse(value) as IntruderSettings;
    }
    return { enabled: false, photoCount: 1, source: "FRONT" };
  }
  static async setIntruderSettings(settings: IntruderSettings) {
    await Preferences.set({
      key: INTRUDER_CONFIG_KEY,
      value: JSON.stringify(settings),
    });
  }
  static async wipeAll() {
    await Preferences.clear();
    RateLimitService.resetAttempts();
  }

  static async generateRecoveryKey(): Promise<{
    key: string;
    type: "ALPHANUMERIC" | "MNEMONIC";
  }> {
    const recoveryKey = RecoveryKeyService.generateRecoveryKey("MNEMONIC");
    return recoveryKey;
  }

  static async setRecoveryKey(recoveryKeyString: string): Promise<void> {
    const salt = await CryptoService.generateSalt();
    const hash = await RecoveryKeyService.hashRecoveryKey(
      recoveryKeyString,
      salt
    );
    await Preferences.set({ key: RECOVERY_KEY_HASH, value: hash });
    await Preferences.set({ key: RECOVERY_KEY_SALT, value: salt });
  }

  static async verifyRecoveryKey(recoveryKeyString: string): Promise<boolean> {
    const saltRes = await Preferences.get({ key: RECOVERY_KEY_SALT });
    const hashRes = await Preferences.get({ key: RECOVERY_KEY_HASH });

    if (!saltRes.value || !hashRes.value) {
      return false;
    }

    const inputHash = await RecoveryKeyService.hashRecoveryKey(
      recoveryKeyString,
      saltRes.value
    );
    return inputHash === hashRes.value;
  }

  static async hasRecoveryKey(): Promise<boolean> {
    const res = await Preferences.get({ key: RECOVERY_KEY_HASH });
    return !!res.value;
  }

  static async loadLockoutState(): Promise<void> {
    const res = await Preferences.get({ key: LOCKOUT_STATE_KEY });
    if (res.value) {
      RateLimitService.deserializeState(res.value);
    }
  }

  static async saveLockoutState(): Promise<void> {
    const state = RateLimitService.getState();
    await Preferences.set({
      key: LOCKOUT_STATE_KEY,
      value: RateLimitService.serializeState(),
    });
  }

  static async recordFailedAttempt(): Promise<void> {
    RateLimitService.recordFailedAttempt();
    await this.saveLockoutState();
  }

  static async resetFailedAttempts(): Promise<void> {
    RateLimitService.resetAttempts();
    await this.saveLockoutState();
  }

  static isLockedOut(): boolean {
    return RateLimitService.isLockedOut();
  }

  static getLockoutState() {
    return RateLimitService.getState();
  }

  static async recordRecoveryAttempt(): Promise<void> {
    const res = await Preferences.get({ key: RECOVERY_ATTEMPTS_KEY });
    const attempts = res.value ? parseInt(res.value) : 0;
    await Preferences.set({
      key: RECOVERY_ATTEMPTS_KEY,
      value: (attempts + 1).toString(),
    });
  }

  static async getRecoveryAttempts(): Promise<number> {
    const res = await Preferences.get({ key: RECOVERY_ATTEMPTS_KEY });
    return res.value ? parseInt(res.value) : 0;
  }

  static async resetRecoveryAttempts(): Promise<void> {
    await Preferences.remove({ key: RECOVERY_ATTEMPTS_KEY });
  }

  static canAttemptRecovery(): boolean {
    return RateLimitService.canAttemptRecovery(3);
  }
}
