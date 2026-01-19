import React, { useState, useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { SecureVault } from "./plugins/SecureVaultPlugin";
import type { VaultItem, LockType, IntruderSettings } from "./types";
import {
  Modal,
  DialogModal,
  ProcessingModal,
  FileViewer,
  Icons,
  Toggle,
  SegmentedControl,
  Button,
} from "./components/UI";
import { useAuth } from "./hooks/useAuth";
import { useVault } from "./hooks/useVault";
import { useIntruder } from "./hooks/useIntruder";
import { SetupView, type SetupViewHandle } from "./views/SetupView";
import { LockScreen } from "./views/LockScreen";
import {
  VaultDashboard,
  type VaultDashboardHandle,
} from "./views/VaultDashboard";
import { SettingsView, type SettingsViewHandle } from "./views/SettingsView";
import { IntruderLogsView } from "./views/IntruderLogsView";
import { RecoveryKeyView } from "./components/RecoveryKeyView";
import {
  RecoverySetupView,
  type RecoverySetupViewHandle,
} from "./components/RecoverySetupView";
import { RateLimitService } from "./services/RateLimitService";
import { AuthService } from "./services/AuthService";

type AppState =
  | "LOADING"
  | "SETUP"
  | "LOCKED"
  | "RECOVERY"
  | "RECOVERY_SETUP"
  | "VAULT"
  | "SETTINGS"
  | "INTRUDER_LOGS";

type DialogType = "ALERT" | "CONFIRM" | "PROMPT";

interface DialogState {
  isOpen: boolean;
  type?: DialogType;
  title?: string;
  message?: string;
  variant?: "info" | "danger" | "success";
  inputProps?: {
    placeholder?: string;
    type?: "text" | "password" | "tel" | "number";
    defaultValue?: string;
  };
  onConfirm?: (value?: string) => void;
  onCancel?: () => void;
}

interface ViewerState {
  item: VaultItem;
  uri: string | null;
}
export default function App() {
  const [appState, setAppState] = useState<AppState>("LOADING");
  const [password, setPassword] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const isPickingFile = useRef(false);
  const isBiometricActive = useRef(false);
  const auth = useAuth();
  const vault = useVault(password);
  const intruder = useIntruder();

  // Refs for child components to handle back navigation locally
  const vaultDashboardRef = useRef<VaultDashboardHandle>(null);
  const settingsRef = useRef<SettingsViewHandle>(null);
  const setupRef = useRef<SetupViewHandle>(null);
  const recoverySetupRef = useRef<RecoverySetupViewHandle>(null);

  const [dialog, setDialog] = useState<DialogState>({ isOpen: false });
  const closeDialog = () => setDialog({ ...dialog, isOpen: false });
  const showAlert = (title: string, msg: string) =>
    setDialog({
      isOpen: true,
      type: "ALERT",
      title,
      message: msg,
      onConfirm: closeDialog,
      onCancel: closeDialog,
    });
  const showConfirm = (
    title: string,
    msg: string,
    onConfirm: () => void,
    variant: "info" | "danger" | "success" = "info"
  ) =>
    setDialog({
      isOpen: true,
      type: "CONFIRM",
      title,
      message: msg,
      variant,
      onConfirm: () => {
        closeDialog();
        onConfirm();
      },
      onCancel: closeDialog,
    });
  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const [isDecoySession, setIsDecoySession] = useState(false);
  const failedAttempts = useRef(0);

  const [showIntruderModal, setShowIntruderModal] = useState(false);
  const [intruderSettingsForm, setIntruderSettingsForm] =
    useState<IntruderSettings>({
      enabled: false,
      photoCount: 1,
      source: "FRONT",
    });

  useEffect(() => {
    if (!auth.isInitialized) {
      SecureVault.isInitialized().then(async (res) => {
        if (res.initialized) {
          await auth.checkInit();
          await AuthService.loadLockoutState();
          setAppState("LOCKED");
        } else {
          setAppState("SETUP");
        }
      });
    }
  }, []);

  useEffect(() => {
    if (appState === "VAULT" && password) {
      vault.loadFiles();
      intruder.fetchLogs();
    }
  }, [appState, password]);

  useEffect(() => {
    const handleVis = () => {
      if (
        document.hidden &&
        !isPickingFile.current &&
        !isBiometricActive.current &&
        appState !== "SETUP" &&
        appState !== "LOADING"
      ) {
        SecureVault.lockVault();
        setAppState("LOCKED");
        setPassword(null);
        setIsDecoySession(false);
        setViewer(null);
        SecureVault.enablePrivacyScreen({ enabled: false });
      }
      if (!document.hidden && isPickingFile.current) {
        setTimeout(() => (isPickingFile.current = false), 1000);
      }
    };
    document.addEventListener("visibilitychange", handleVis);
    return () => document.removeEventListener("visibilitychange", handleVis);
  }, [appState]);

  // Back Button Handling
  useEffect(() => {
    const backHandler = CapacitorApp.addListener(
      "backButton",
      ({ canGoBack }) => {
        if (viewer) {
          setViewer(null);
          SecureVault.enablePrivacyScreen({ enabled: false });
          return;
        }
        if (dialog.isOpen) {
          closeDialog();
          return;
        }
        if (showIntruderModal) {
          setShowIntruderModal(false);
          return;
        }

        switch (appState) {
          case "VAULT":
            if (vaultDashboardRef.current?.handleBack()) return;
            if (!isPickingFile.current) {
              CapacitorApp.exitApp();
            }
            break;
          case "SETTINGS":
            if (settingsRef.current?.handleBack()) return;
            setAppState("VAULT");
            break;
          case "INTRUDER_LOGS":
            setAppState("SETTINGS");
            break;
          case "RECOVERY":
            setAppState("LOCKED");
            break;
          case "RECOVERY_SETUP":
            if (recoverySetupRef.current?.handleBack()) return;
            setAppState("LOCKED");
            break;
          case "SETUP":
            if (setupRef.current?.handleBack()) return;
            CapacitorApp.exitApp();
            break;
          case "LOCKED":
            CapacitorApp.exitApp();
            break;
          case "LOADING":
            break;
        }
      }
    );

    return () => {
      backHandler.then((h) => h.remove());
    };
  }, [appState, viewer, dialog.isOpen, showIntruderModal]);

  const handleSetup = async (
    pw: string,
    type: LockType,
    recoveryKey: string
  ) => {
    setIsProcessing(true);
    try {
      await auth.setup(pw, type);
      await AuthService.setRecoveryKey(recoveryKey);
      RateLimitService.resetAttempts();
      setAppState("LOCKED");
      showAlert("Success", "Vault setup complete.");
    } catch (e: any) {
      showAlert("Error", e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnlock = async (pw: string) => {
    setIsProcessing(true);

    if (RateLimitService.isLockedOut()) {
      setIsProcessing(false);
      showAlert("Locked", RateLimitService.getLockoutMessage());
      return;
    }

    const res = await auth.unlock(pw);
    setIsProcessing(false);

    if (res.success) {
      setPassword(pw);
      setIsDecoySession(res.mode === "DECOY");
      await AuthService.resetFailedAttempts();
      setAppState("VAULT");
    } else {
      await AuthService.recordFailedAttempt();
      const lockoutState = RateLimitService.getState();

      if (RateLimitService.isLockedOut()) {
        RateLimitService.startCountdown();
        showAlert("Too Many Attempts", RateLimitService.getLockoutMessage());
      }

      if (lockoutState.attemptCount % 2 === 0) {
        intruder.capture();
      }
    }
  };

  const handleRecoveryAttempt = () => {
    if (!AuthService.canAttemptRecovery()) {
      showAlert(
        "Recovery Locked",
        "Too many recovery attempts. Try again later."
      );
      return;
    }
    setAppState("RECOVERY");
  };

  const handleRecoveryKeySubmit = async (recoveryKeyInput: string) => {
    setIsProcessing(true);
    try {
      const isValid = await AuthService.verifyRecoveryKey(recoveryKeyInput);

      if (!isValid) {
        await AuthService.recordRecoveryAttempt();
        showAlert("Invalid", "Recovery key is incorrect. Try again.");
        setIsProcessing(false);
        return;
      }

      await AuthService.resetRecoveryAttempts();
      await AuthService.resetFailedAttempts();

      setAppState("RECOVERY_SETUP");
    } catch (e: any) {
      showAlert("Error", e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRecoverySetup = async (pw: string, type: LockType) => {
    setIsProcessing(true);
    try {
      await auth.recoverCredentials(pw, type);
      setPassword(pw);
      setAppState("VAULT");
      showAlert("Success", "PIN/Password updated successfully.");
    } catch (e: any) {
      showAlert("Error", e.message);
    } finally {
      setIsProcessing(false);
    }
  };
  const handleBiometricUnlock = async () => {
    isBiometricActive.current = true;
    try {
      const pw = await auth.triggerBiometrics();
      if (pw) handleUnlock(pw);
    } finally {
      // Small delay to ensure app has fully resumed before re-enabling lock check
      setTimeout(() => {
        isBiometricActive.current = false;
      }, 500);
    }
  };
  
  const handleView = async (item: any) => {
    // Only use streaming on Web for large files. 
    // On Native, we use previewFile() which writes to a temp file and plays natively (much more reliable for non-fragmented MP4).
    const isNative = Capacitor.isNativePlatform();
    const isLargeVideo = !isNative && item.mimeType.startsWith('video/') && item.size > 50 * 1024 * 1024;
    
    if (isLargeVideo) {
        // Skip decryption, just pass item. FileViewer will handle streaming logic.
        setViewer({ item, uri: null });
        return;
    }

    // Default path: Full decrypt (Memory Blob on Web, Temp File on Native)
    setIsProcessing(true);
    setProcessStatus("Preparing preview...");
    try {
      const { uri } = await vault.previewFile(item.id);
      setViewer({ item, uri });
    } catch (e: any) {
      showAlert("Error", "Could not preview: " + e.message);
    } finally {
      setIsProcessing(false);
      setProcessStatus("");
    }
  };

  // Fallback handler if streaming fails
  const handleLoadFull = async () => {
      if(!viewer?.item) return;
      setIsProcessing(true);
      setProcessStatus("Streaming unavailable. Loading full video...");
      try {
          const { uri } = await vault.previewFile(viewer.item.id);
          setViewer({ ...viewer, uri });
      } catch (e: any) {
          showAlert("Preview Failed", "Could not load video: " + e.message);
      } finally {
          setIsProcessing(false);
          setProcessStatus("");
      }
  };

  const handleNativeOpen = async () => {
      if(!viewer) return;
      setIsProcessing(true);
      setProcessStatus("Preparing for external app...");
      try {
          const { exportedPath } = await vault.exportFile(viewer.item.id);
          showAlert("Exported", `File exported to: ${exportedPath}`);
      } catch (e: any) {
          showAlert("Error", e.message);
      } finally {
          setIsProcessing(false);
          setProcessStatus("");
      }
  };

  const handleUpdateCreds = async (
    old: string,
    newPw: string,
    type: LockType
  ) => {
    setIsProcessing(true);
    try {
      await auth.updateCredentials(old, newPw, type);
      setPassword(newPw);
      showAlert("Success", "Credentials updated.");
    } catch (e: any) {
      showAlert("Error", e.message);
    } finally {
      setIsProcessing(false);
    }
  };
  const handleReset = () => {
    setDialog({
      isOpen: true,
      type: "PROMPT",
      title: "Confirm Reset",
      message: "Enter current password to wipe vault permanently.",
      inputProps: { type: "password", placeholder: "Current Password" },
      variant: "danger",
      onCancel: closeDialog,
      onConfirm: async (val: string) => {
        closeDialog();
        if (!val) return;
        setIsProcessing(true);
        try {
          await auth.reset(val);
          setAppState("SETUP");
          showAlert("Reset Complete", "Vault wiped.");
        } catch (e: any) {
          showAlert("Reset Failed", e.message);
        } finally {
          setIsProcessing(false);
        }
      },
    });
  };

  const openIntruderSettings = async () => {
    const s = await intruder.loadSettings();
    setIntruderSettingsForm(s);
    setShowIntruderModal(true);
  };
  const saveIntruderSettings = async () => {
    await intruder.saveSettings(intruderSettingsForm);
    setShowIntruderModal(false);
  };
  if (appState === "LOADING")
    return (
      <div className="min-h-screen bg-vault-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-vault-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  return (
    <div className="min-h-screen bg-vault-900 text-slate-100 font-sans">
      {appState === "SETUP" && (
        <SetupView
          ref={setupRef}
          onSetup={handleSetup}
          isProcessing={isProcessing}
        />
      )}
      {appState === "LOCKED" && (
        <LockScreen
          lockType={auth.lockType}
          onUnlock={handleUnlock}
          onBiometricAuth={handleBiometricUnlock}
          onRecoveryAttempt={handleRecoveryAttempt}
          error={auth.error}
          clearError={() => auth.setError(null)}
          isProcessing={isProcessing}
          bioEnabled={auth.bioEnabled}
          bioAvailable={auth.bioAvailable}
        />
      )}
      {appState === "RECOVERY" && (
        <RecoveryKeyView
          onSubmit={handleRecoveryKeySubmit}
          onCancel={() => setAppState("LOCKED")}
          isProcessing={isProcessing}
        />
      )}
      {appState === "RECOVERY_SETUP" && (
        <RecoverySetupView
          ref={recoverySetupRef}
          onSetup={handleRecoverySetup}
          isProcessing={isProcessing}
        />
      )}
      {appState === "VAULT" && (
        <VaultDashboard
          ref={vaultDashboardRef}
          vault={vault}
          isDecoy={isDecoySession}
          onView={handleView}
          onLock={() => {
            SecureVault.lockVault();
            setAppState("LOCKED");
            setPassword(null);
          }}
          onSettings={() => setAppState("SETTINGS")}
          onPickStart={() => (isPickingFile.current = true)}
          onProcessing={(loading, status) => {
            setIsProcessing(loading);
            if (status) setProcessStatus(status);
          }}
        />
      )}
      {appState === "SETTINGS" && (
        <SettingsView
          ref={settingsRef}
          lockType={auth.lockType}
          bioAvailable={auth.bioAvailable}
          bioEnabled={auth.bioEnabled}
          bioError={auth.bioError}
          hasDecoy={auth.hasDecoy}
          onBack={() => setAppState("VAULT")}
          onUpdateCredentials={handleUpdateCreds}
          onReset={handleReset}
          onToggleBio={(enabled) => auth.toggleBiometrics(enabled, password!)}
          onSetupDecoy={(p, c) => auth.setupDecoy(p, password!)}
          onRemoveDecoy={() => auth.removeDecoy(password!)}
          onOpenIntruder={openIntruderSettings}
          isProcessing={isProcessing}
        />
      )}
      {/* Intruder Settings Modal */}
      <Modal isOpen={showIntruderModal}>
        <div className="bg-vault-800 p-6 rounded-2xl w-full max-w-sm space-y-6 border border-vault-700">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-white">Intruder Settings</h3>
            <button onClick={() => setShowIntruderModal(false)}>
              <Icons.X />
            </button>
          </div>
          <div className="flex justify-between items-center bg-vault-900/50 p-3 rounded">
            <span>Enabled</span>
            <Toggle
              checked={intruderSettingsForm.enabled}
              onChange={(v) =>
                setIntruderSettingsForm((s: any) => ({ ...s, enabled: v }))
              }
            />
          </div>
          {intruderSettingsForm.enabled && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-vault-400">
                  PHOTOS
                </label>
                <SegmentedControl
                  options={[
                    { label: "1", value: 1 },
                    { label: "2", value: 2 },
                    { label: "3", value: 3 },
                  ]}
                  value={intruderSettingsForm.photoCount}
                  onChange={(v) =>
                    setIntruderSettingsForm((s) => ({
                      ...s,
                      photoCount: v as 1 | 2 | 3,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-vault-400">
                  SOURCE
                </label>
                <SegmentedControl
                  options={[
                    { label: "Front", value: "FRONT" },
                    { label: "Back", value: "BACK" },
                    { label: "Both", value: "BOTH" },
                  ]}
                  value={intruderSettingsForm.source}
                  onChange={(v) =>
                    setIntruderSettingsForm((s: any) => ({ ...s, source: v }))
                  }
                  disabled={!Capacitor.isNativePlatform()}
                />
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setShowIntruderModal(false);
                  setAppState("INTRUDER_LOGS");
                }}
                className="w-full"
              >
                View Logs
              </Button>
            </div>
          )}
          <Button onClick={saveIntruderSettings} className="w-full">
            Save
          </Button>
        </div>
      </Modal>
      {appState === "INTRUDER_LOGS" && (
        <IntruderLogsView
          logs={intruder.logs}
          onDelete={intruder.deleteLog}
          onViewImage={handleView}
          onBack={() => {
            setAppState("SETTINGS");
            setShowIntruderModal(false);
          }}
        />
      )}
      <ProcessingModal
        isOpen={isProcessing}
        status={processStatus}
        progress={progress}
      />
      <DialogModal
        isOpen={dialog.isOpen}
        type={dialog.type || "ALERT"}
        title={dialog.title}
        message={dialog.message}
        variant={dialog.variant}
        onConfirm={dialog.onConfirm}
        onCancel={dialog.onCancel}
        inputProps={dialog.inputProps}
      />
      {viewer && (
        <FileViewer
          item={viewer.item}
          uri={viewer.uri}
          onClose={() => {
            setViewer(null);
            SecureVault.enablePrivacyScreen({ enabled: false });
          }}
          onOpenNative={handleNativeOpen}
          onLoadFull={handleLoadFull}
        />
      )}
    </div>
  );
}