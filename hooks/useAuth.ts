import { useState, useEffect, useCallback } from "react";
import { SecureVault } from "../plugins/SecureVaultPlugin";
import type { LockType } from "../types";
export const useAuth = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [lockType, setLockType] = useState<LockType>("PASSWORD");
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [hasDecoy, setHasDecoy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bioError, setBioError] = useState<string | null>(null);
  const checkInit = useCallback(async () => {
    try {
      const { initialized } = await SecureVault.isInitialized();
      setIsInitialized(initialized);
      if (initialized) {
        const { type } = await SecureVault.getLockType();
        setLockType(type);
        try {
          const bioStatus = await SecureVault.checkBiometricAvailability();
          setBioAvailable(bioStatus.available);
        } catch (e) {
          setBioAvailable(false);
          setBioError("Could not check biometric support");
        }
        try {
          const bioConfig = await SecureVault.getBiometricStatus();
          setBioEnabled(bioConfig.enabled);
        } catch (e) {
          setBioEnabled(false);
        }
        const decoyStatus = await SecureVault.hasDecoy();
        setHasDecoy(decoyStatus.hasDecoy);
      }
    } catch (e) {}
  }, []);
  const unlock = async (password: string) => {
    setError(null);
    try {
      const res = await SecureVault.unlockVault(password);
      return { success: true, mode: res.mode };
    } catch (e: any) {
      setError(e.message || "Authentication failed");
      return { success: false, error: e.message };
    }
  };
  const setup = async (password: string, type: LockType) => {
    await SecureVault.initializeVault({ password, type });
    await checkInit();
  };
  const reset = async (password: string) => {
    await SecureVault.resetVault(password);
    setIsInitialized(false);
    setLockType("PASSWORD");
    setBioEnabled(false);
    setBioAvailable(false);
  };
  const updateCredentials = async (
    oldPw: string,
    newPw: string,
    newType: LockType
  ) => {
    await SecureVault.updateCredentials({
      oldPassword: oldPw,
      newPassword: newPw,
      newType,
    });
    setLockType(newType);
  };
  const triggerBiometrics = async () => {
    try {
      const res = await SecureVault.authenticateBiometric();
      if (res.success && res.password) {
        return res.password;
      }
    } catch (e) {}
    return null;
  };
  const toggleBiometrics = async (enabled: boolean, password?: string) => {
    try {
      await SecureVault.setBiometricStatus({ enabled, password });
      setBioEnabled(enabled);
      setBioError(null);
    } catch (e: any) {
      const errorMsg = e.message || "Failed to update biometric setting";
      setBioError(errorMsg);
      throw e;
    }
  };
  const setupDecoy = async (decoyPass: string, masterPass: string) => {
    await SecureVault.setDecoyCredential({
      decoyPassword: decoyPass,
      masterPassword: masterPass,
    });
    setHasDecoy(true);
  };
  const removeDecoy = async (masterPass: string) => {
    await SecureVault.removeDecoyCredential(masterPass);
    setHasDecoy(false);
  };
  useEffect(() => {
    checkInit();
  }, [checkInit]);
  return {
    isInitialized,
    lockType,
    bioAvailable,
    bioEnabled,
    hasDecoy,
    error,
    setError,
    bioError,
    setBioError,
    checkInit,
    unlock,
    setup,
    reset,
    updateCredentials,
    triggerBiometrics,
    toggleBiometrics,
    setupDecoy,
    removeDecoy,
  };
};
