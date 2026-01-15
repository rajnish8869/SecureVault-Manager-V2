import React, { useState, useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
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
import { SetupView } from "./views/SetupView";
import { LockScreen } from "./views/LockScreen";
import { VaultDashboard } from "./views/VaultDashboard";
import { SettingsView } from "./views/SettingsView";
import { IntruderLogsView } from "./views/IntruderLogsView";

type AppState =
  | "LOADING"
  | "SETUP"
  | "LOCKED"
  | "VAULT"
  | "SETTINGS"
  | "INTRUDER_LOGS";

type DialogType = "ALERT" | "CONFIRM" | "PROMPT";

interface DialogState {
  isOpen: boolean;
  type?: DialogType;
  title?: string;
  message?: string;
  variant?: string;
  inputProps?: { type: string; placeholder: string };
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
  const auth = useAuth();
  const vault = useVault(password);
  const intruder = useIntruder();
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
    variant = "info"
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
  useEffect(() => {
    if (!auth.isInitialized) {
      SecureVault.isInitialized().then((res) => {
        if (res.initialized) {
          auth.checkInit().then(() => setAppState("LOCKED"));
        } else {
          setAppState("SETUP");
        }
      });
    }
  }, []);
  useEffect(() => {
    if (appState === "VAULT" && password) {
      vault.loadFiles();
    }
  }, [appState, password]);
  useEffect(() => {
    const handleVis = () => {
      if (
        document.hidden &&
        !isPickingFile.current &&
        appState !== "SETUP" &&
        appState !== "LOADING"
      ) {
        SecureVault.lockVault();
        setAppState("LOCKED");
        setPassword(null);
        setIsDecoySession(false);
        failedAttempts.current = 0;
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
  const handleSetup = async (pw: string, type: LockType) => {
    setIsProcessing(true);
    try {
      await auth.setup(pw, type);
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
    const res = await auth.unlock(pw);
    setIsProcessing(false);
    if (res.success) {
      setPassword(pw);
      setIsDecoySession(res.mode === "DECOY");
      failedAttempts.current = 0;
      setAppState("VAULT");
    } else {
      failedAttempts.current++;
      if (failedAttempts.current % 2 === 0) {
        intruder.capture();
      }
    }
  };
  const handleBiometricUnlock = async () => {
    const pw = await auth.triggerBiometrics();
    if (pw) handleUnlock(pw);
  };
  const handleView = async (item: any) => {
    setIsProcessing(true);
    try {
      const { uri } = await vault.previewFile(item.id);
      setViewer({ item, uri });
    } catch (e: any) {
      showAlert("Error", "Could not preview: " + e.message);
    } finally {
      setIsProcessing(false);
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
  const [showIntruderModal, setShowIntruderModal] = useState(false);
  const [intruderSettingsForm, setIntruderSettingsForm] =
    useState<IntruderSettings>({
      enabled: false,
      photoCount: 1,
      source: "FRONT",
    });
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
        <SetupView onSetup={handleSetup} isProcessing={isProcessing} />
      )}
      {appState === "LOCKED" && (
        <LockScreen
          lockType={auth.lockType}
          onUnlock={handleUnlock}
          onBiometricAuth={handleBiometricUnlock}
          error={auth.error}
          clearError={() => auth.setError(null)}
          isProcessing={isProcessing}
          bioEnabled={auth.bioEnabled}
          bioAvailable={auth.bioAvailable}
        />
      )}
      {appState === "VAULT" && (
        <VaultDashboard
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
        />
      )}
    </div>
  );
}
