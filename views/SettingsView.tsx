import React, { useState, useEffect } from "react";
import {
  Card,
  Button,
  PasswordInput,
  Toggle,
  SegmentedControl,
  Icons,
} from "../components/UI";
import type { LockType } from "../types";
interface SettingsViewProps {
  lockType: LockType;
  bioAvailable: boolean;
  bioEnabled: boolean;
  bioError?: string | null;
  hasDecoy: boolean;
  onBack: () => void;
  onUpdateCredentials: (
    oldPw: string,
    newPw: string,
    newType: LockType
  ) => Promise<void>;
  onReset: () => void;
  onToggleBio: (enabled: boolean) => Promise<void>;
  onSetupDecoy: (pass: string, confirm: string) => void;
  onRemoveDecoy: () => void;
  onOpenIntruder: () => void;
  isProcessing: boolean;
}
export const SettingsView: React.FC<SettingsViewProps> = ({
  lockType,
  bioAvailable,
  bioEnabled,
  bioError,
  hasDecoy,
  onBack,
  onUpdateCredentials,
  onReset,
  onToggleBio,
  onSetupDecoy,
  onRemoveDecoy,
  onOpenIntruder,
  isProcessing,
}) => {
  const [form, setForm] = useState({
    old: "",
    new: "",
    confirm: "",
    type: lockType,
  });
  const [credError, setCredError] = useState<string | null>(null);
  const [showDecoySetup, setShowDecoySetup] = useState(false);
  const [decoyForm, setDecoyForm] = useState({ pass: "", confirm: "" });
  const [decoyError, setDecoyError] = useState<string | null>(null);
  const [bioToggleLoading, setBioToggleLoading] = useState(false);
  const [bioToggleError, setBioToggleError] = useState<string | null>(null);
  const [bioPasswordPrompt, setBioPasswordPrompt] = useState(false);
  const [bioPassword, setBioPassword] = useState("");
  const [bioPasswordError, setBioPasswordError] = useState<string | null>(null);
  useEffect(() => {
    setForm((f) => ({ ...f, new: "", confirm: "" }));
    setCredError(null);
  }, [form.type]);
  const PIN_LENGTH = 6;
  const MIN_PASS_LENGTH = 8;
  const validateCreds = () => {
    setCredError(null);
    if (!form.old) {
      setCredError("Current password is required");
      return false;
    }
    if (form.type === "PIN") {
      if (form.new.length !== PIN_LENGTH) {
        setCredError(`PIN must be exactly ${PIN_LENGTH} digits`);
        return false;
      }
    } else {
      if (form.new.length < MIN_PASS_LENGTH) {
        setCredError(`Password must be at least ${MIN_PASS_LENGTH} characters`);
        return false;
      }
    }
    if (form.new !== form.confirm) {
      setCredError("New credentials do not match");
      return false;
    }
    return true;
  };
  const handleUpdate = () => {
    if (validateCreds()) {
      onUpdateCredentials(form.old, form.new, form.type)
        .then(() => {
          setForm({ old: "", new: "", confirm: "", type: form.type });
        })
        .catch(() => {});
    }
  };
  const validateDecoy = () => {
    setDecoyError(null);
    if (lockType === "PIN") {
      if (decoyForm.pass.length !== PIN_LENGTH) {
        setDecoyError(`Decoy PIN must be exactly ${PIN_LENGTH} digits`);
        return false;
      }
    } else {
      if (decoyForm.pass.length < MIN_PASS_LENGTH) {
        setDecoyError(
          `Decoy Password must be at least ${MIN_PASS_LENGTH} characters`
        );
        return false;
      }
    }
    if (decoyForm.pass !== decoyForm.confirm) {
      setDecoyError("Decoy credentials do not match");
      return false;
    }
    return true;
  };
  const handleBioToggle = async (enabled: boolean) => {
    if (enabled) {
      setBioPasswordPrompt(true);
      setBioPassword("");
      setBioPasswordError(null);
    } else {
      setBioToggleError(null);
      setBioToggleLoading(true);
      try {
        await onToggleBio(enabled);
      } catch (e: any) {
        const errorMsg = e.message || "Failed to update biometric setting";
        setBioToggleError(errorMsg);
      } finally {
        setBioToggleLoading(false);
      }
    }
  };
  const handleBioPasswordConfirm = async () => {
    if (!bioPassword) {
      setBioPasswordError("Password is required");
      return;
    }
    setBioToggleError(null);
    setBioToggleLoading(true);
    try {
      await onToggleBio(true);
      setBioPasswordPrompt(false);
      setBioPassword("");
    } catch (e: any) {
      const errorMsg = e.message || "Failed to enable biometric";
      setBioToggleError(errorMsg);
      setBioPasswordError(errorMsg);
    } finally {
      setBioToggleLoading(false);
    }
  };
  const handleDecoySubmit = () => {
    if (validateDecoy()) {
      onSetupDecoy(decoyForm.pass, decoyForm.confirm);
      setShowDecoySetup(false);
      setDecoyForm({ pass: "", confirm: "" });
    }
  };
  return (
    <div className="animate-in fade-in slide-in-from-right-8 duration-300 bg-vault-950 min-h-dvh flex flex-col">
      <header className="sticky top-0 z-40 bg-vault-950/80 backdrop-blur-xl border-b border-vault-800 pt-safe px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-full text-vault-400 hover:text-white hover:bg-vault-800 transition-colors"
          >
            <Icons.ArrowLeft />
          </button>
          <h2 className="font-bold text-lg text-white">Settings</h2>
        </div>
      </header>
      <main className="flex-1 p-4 max-w-2xl mx-auto space-y-8 pb-safe overflow-y-auto w-full">
        <section className="space-y-3">
          <h3 className="text-xs font-bold text-vault-500 uppercase tracking-wider px-1">
            Security Monitoring
          </h3>
          <Card className="p-1">
            <button
              onClick={onOpenIntruder}
              className="w-full flex items-center justify-between p-4 rounded-lg bg-vault-800 hover:bg-vault-750 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20 group-hover:scale-110 transition-transform">
                  <Icons.Camera />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-white group-hover:text-red-400 transition-colors">
                    Intruder Selfie
                  </h3>
                  <p className="text-xs text-vault-400">
                    Capture photos of failed unlock attempts
                  </p>
                </div>
              </div>
              <div className="text-vault-500 group-hover:text-white transition-colors rotate-180">
                <Icons.ArrowLeft />
              </div>
            </button>
          </Card>
        </section>
        <section className="space-y-3">
          <h3 className="text-xs font-bold text-vault-500 uppercase tracking-wider px-1">
            General
          </h3>
          <Card className="divide-y divide-vault-700/50">
            {bioAvailable ? (
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-vault-400">
                      <Icons.Fingerprint />
                    </div>
                    <div>
                      <h4 className="font-medium text-white">
                        Biometric Unlock
                      </h4>
                      <p className="text-xs text-vault-400">
                        Use fingerprint or face unlock
                      </p>
                    </div>
                  </div>
                  <Toggle
                    checked={bioEnabled}
                    onChange={handleBioToggle}
                    disabled={bioToggleLoading}
                  />
                </div>
                {bioToggleError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
                    <Icons.Alert className="text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-200">{bioToggleError}</p>
                  </div>
                )}
                {bioError && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-start gap-2">
                    <Icons.Alert className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-200">{bioError}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 space-y-2 opacity-60">
                <div className="flex items-center gap-3">
                  <div className="text-vault-600">
                    <Icons.Fingerprint />
                  </div>
                  <div>
                    <h4 className="font-medium text-vault-300">
                      Biometric Unlock
                    </h4>
                    <p className="text-xs text-vault-500">
                      Not supported on this device
                    </p>
                  </div>
                </div>
              </div>
            )}
            {/* Decoy */}
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-amber-500">
                    <Icons.Shield />
                  </div>
                  <div>
                    <h4 className="font-medium text-white">Coercion Defense</h4>
                    <p className="text-xs text-vault-400">
                      Setup a decoy vault with fake files
                    </p>
                  </div>
                </div>
                <Toggle
                  checked={hasDecoy}
                  onChange={() =>
                    hasDecoy ? onRemoveDecoy() : setShowDecoySetup(true)
                  }
                />
              </div>
              {showDecoySetup && !hasDecoy && (
                <div className="bg-vault-900/50 rounded-xl border border-vault-700 p-4 space-y-4 animate-in slide-in-from-top-2">
                  <div className="flex items-start gap-2 text-amber-500/90 bg-amber-500/10 p-3 rounded-lg text-xs mb-2 leading-relaxed">
                    <Icons.Alert />
                    <p>
                      Your decoy credential type must match your main vault (
                      {lockType}) to effectively fool intruders.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-vault-400">
                        DECOY {lockType}
                      </label>
                      <PasswordInput
                        value={decoyForm.pass}
                        onChange={(v) =>
                          setDecoyForm((s) => ({ ...s, pass: v }))
                        }
                        placeholder={`Enter Decoy ${
                          lockType === "PIN" ? `(${PIN_LENGTH} digits)` : ""
                        }`}
                        numeric={lockType === "PIN"}
                        maxLength={lockType === "PIN" ? PIN_LENGTH : undefined}
                        error={!!decoyError}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-vault-400">
                        CONFIRM DECOY
                      </label>
                      <PasswordInput
                        value={decoyForm.confirm}
                        onChange={(v) =>
                          setDecoyForm((s) => ({ ...s, confirm: v }))
                        }
                        placeholder="Repeat to confirm"
                        numeric={lockType === "PIN"}
                        maxLength={lockType === "PIN" ? PIN_LENGTH : undefined}
                        error={!!decoyError}
                      />
                    </div>
                    {decoyError && (
                      <p className="text-xs text-red-400 font-medium">
                        {decoyError}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="ghost"
                      className="flex-1"
                      onClick={() => {
                        setShowDecoySetup(false);
                        setDecoyForm({ pass: "", confirm: "" });
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                      onClick={handleDecoySubmit}
                    >
                      Enable Decoy
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </section>
        {/* Change Credentials */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold text-vault-500 uppercase tracking-wider px-1">
            Authentication
          </h3>
          <Card className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="bg-vault-900/50 p-1 rounded-lg border border-vault-700">
                <SegmentedControl
                  options={[
                    { label: "PIN Code", value: "PIN" },
                    { label: "Password", value: "PASSWORD" },
                  ]}
                  value={form.type}
                  onChange={(v) => setForm((s) => ({ ...s, type: v }))}
                />
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-vault-400">
                    CURRENT {lockType}
                  </label>
                  <PasswordInput
                    value={form.old}
                    onChange={(v) => setForm((s) => ({ ...s, old: v }))}
                    placeholder={`Enter Current ${lockType}`}
                    numeric={lockType === "PIN"}
                    maxLength={lockType === "PIN" ? PIN_LENGTH : undefined}
                  />
                </div>
                <hr className="border-vault-700/50" />
                <div className="space-y-1">
                  <label className="text-xs font-bold text-vault-400">
                    NEW {form.type}
                  </label>
                  <PasswordInput
                    value={form.new}
                    onChange={(v) => setForm((s) => ({ ...s, new: v }))}
                    placeholder={
                      form.type === "PIN"
                        ? `Enter ${PIN_LENGTH} digits`
                        : `Min ${MIN_PASS_LENGTH} characters`
                    }
                    numeric={form.type === "PIN"}
                    maxLength={form.type === "PIN" ? PIN_LENGTH : undefined}
                    error={!!credError}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-vault-400">
                    CONFIRM NEW
                  </label>
                  <PasswordInput
                    value={form.confirm}
                    onChange={(v) => setForm((s) => ({ ...s, confirm: v }))}
                    placeholder="Repeat to confirm"
                    numeric={form.type === "PIN"}
                    maxLength={form.type === "PIN" ? PIN_LENGTH : undefined}
                    error={!!credError}
                  />
                </div>
                {credError && (
                  <p className="text-xs text-red-400 font-medium bg-red-500/10 p-2 rounded">
                    {credError}
                  </p>
                )}
              </div>
              <Button
                className="w-full"
                onClick={handleUpdate}
                disabled={isProcessing || !form.old || !form.new}
              >
                {isProcessing ? "Updating..." : "Update Credentials"}
              </Button>
            </div>
          </Card>
        </section>
        <section className="space-y-3">
          <h3 className="text-xs font-bold text-red-500/70 uppercase tracking-wider px-1">
            Danger Zone
          </h3>
          <Card className="p-6 border-red-500/20 bg-red-500/5 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="text-red-500 mt-1">
                <Icons.Alert />
              </div>
              <div>
                <h4 className="font-bold text-red-100">Factory Reset</h4>
                <p className="text-xs text-red-200/60 leading-relaxed">
                  This will permanently delete all encrypted files, intruder
                  logs, and settings. This action cannot be undone.
                </p>
              </div>
            </div>
            <Button variant="danger" className="w-full" onClick={onReset}>
              Reset Vault & Wipe Data
            </Button>
          </Card>
        </section>
      </main>
      {bioPasswordPrompt && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-sm p-6 space-y-6">
            <div>
              <h3 className="font-bold text-lg text-white">
                Enable Biometric Unlock
              </h3>
              <p className="text-sm text-vault-300 mt-1">
                Enter your password to securely store it for biometric
                authentication
              </p>
            </div>
            <PasswordInput
              value={bioPassword}
              onChange={setBioPassword}
              placeholder="Enter your password"
              disabled={bioToggleLoading}
            />
            {bioPasswordError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
                <Icons.Alert className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-200">{bioPasswordError}</p>
              </div>
            )}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setBioPasswordPrompt(false);
                  setBioPassword("");
                  setBioPasswordError(null);
                }}
                disabled={bioToggleLoading}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleBioPasswordConfirm}
                disabled={!bioPassword || bioToggleLoading}
              >
                {bioToggleLoading ? "Enabling..." : "Enable"}
              </Button>
            </div>
          </Card>
        </div>
      )}{" "}
    </div>
  );
};
