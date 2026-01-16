import React, { useState, useEffect, forwardRef, useImperativeHandle } from "react";
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

export interface SettingsViewHandle {
  handleBack: () => boolean;
}

export const SettingsView = forwardRef<SettingsViewHandle, SettingsViewProps>(({
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
}, ref) => {
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

  useImperativeHandle(ref, () => ({
    handleBack: () => {
      if (bioPasswordPrompt) {
        setBioPasswordPrompt(false);
        setBioPassword("");
        setBioPasswordError(null);
        return true;
      }
      if (showDecoySetup) {
        setShowDecoySetup(false);
        setDecoyForm({ pass: "", confirm: "" });
        return true;
      }
      return false;
    }
  }), [bioPasswordPrompt, showDecoySetup]);

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
    <div className="h-dvh w-full bg-vault-950 flex flex-col font-sans overflow-hidden">
      {/* 
        HEADER SECTION 
        Sticky to top with safe area padding
      */}
      <header className="z-30 pt-safe flex-shrink-0 bg-vault-950/80 backdrop-blur-xl border-b border-vault-800 shadow-sm">
        <div className="px-4 h-14 flex items-center gap-4">
          <button
            onClick={onBack}
            className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-vault-400 hover:text-white hover:bg-vault-800 active:bg-vault-700 transition-colors"
          >
            <Icons.ArrowLeft className="w-6 h-6" />
          </button>
          <h2 className="font-bold text-lg text-white tracking-tight">Settings</h2>
        </div>
      </header>

      {/* 
        SCROLLABLE CONTENT
        Bottom padding for safe area
      */}
      <main className="flex-1 overflow-y-auto p-4 space-y-8 pb-safe w-full max-w-2xl mx-auto">
        
        {/* Security Monitoring */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold text-vault-500 uppercase tracking-wider px-1">
            Security Monitoring
          </h3>
          <Card className="p-1">
            <button
              onClick={onOpenIntruder}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-vault-800 hover:bg-vault-750 active:bg-vault-700 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20 group-hover:scale-110 transition-transform">
                  <Icons.Camera className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-white group-hover:text-red-400 transition-colors">
                    Intruder Selfie
                  </h3>
                  <p className="text-xs text-vault-400 mt-0.5">
                    Capture photos of failed unlock attempts
                  </p>
                </div>
              </div>
              <div className="text-vault-500 group-hover:text-white transition-colors rotate-180">
                <Icons.ArrowLeft className="w-5 h-5" />
              </div>
            </button>
          </Card>
        </section>

        {/* General Settings */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold text-vault-500 uppercase tracking-wider px-1">
            General
          </h3>
          <Card className="divide-y divide-vault-700/50 bg-vault-800">
            {/* Biometric */}
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${bioAvailable ? 'text-vault-accent bg-vault-accent/10' : 'text-vault-600 bg-vault-700/30'}`}>
                    <Icons.Fingerprint className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className={`font-medium text-sm ${bioAvailable ? 'text-white' : 'text-vault-500'}`}>
                      Biometric Unlock
                    </h4>
                    <p className="text-xs text-vault-400">
                      {bioAvailable ? 'Use fingerprint or face unlock' : 'Not supported on device'}
                    </p>
                  </div>
                </div>
                {bioAvailable && (
                    <Toggle
                        checked={bioEnabled}
                        onChange={handleBioToggle}
                        disabled={bioToggleLoading}
                    />
                )}
              </div>
              {bioToggleError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2 animate-fade-in">
                  <Icons.Alert className="text-red-500 w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-200">{bioToggleError}</p>
                </div>
              )}
              {bioError && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-start gap-2 animate-fade-in">
                  <Icons.Alert className="text-amber-500 w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-200">{bioError}</p>
                </div>
              )}
            </div>

            {/* Decoy Mode */}
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <Icons.Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-white">Coercion Defense</h4>
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
                <div className="bg-vault-900/50 rounded-xl border border-vault-700 p-4 space-y-4 animate-slide-up">
                  <div className="flex items-start gap-3 text-amber-500/90 bg-amber-500/10 p-3 rounded-lg text-xs mb-2 leading-relaxed">
                    <Icons.Alert className="w-5 h-5 shrink-0" />
                    <p>
                      Your decoy credential type must match your main vault (
                      <span className="font-bold">{lockType}</span>) to effectively fool intruders.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-vault-400 uppercase tracking-wider">
                        Decoy {lockType}
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
                      <label className="text-[10px] font-bold text-vault-400 uppercase tracking-wider">
                        Confirm Decoy
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
                      <p className="text-xs text-red-400 font-medium animate-fade-in">
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
                      className="flex-1 bg-amber-600 hover:bg-amber-700 text-white border-none"
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
          <Card className="p-5 space-y-6 bg-vault-800">
            <div className="space-y-4">
              <div className="bg-vault-900/50 p-1 rounded-xl border border-vault-700">
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
                  <label className="text-[10px] font-bold text-vault-400 uppercase tracking-wider">
                    Current {lockType}
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
                  <label className="text-[10px] font-bold text-vault-400 uppercase tracking-wider">
                    New {form.type}
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
                  <label className="text-[10px] font-bold text-vault-400 uppercase tracking-wider">
                    Confirm New
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
                  <p className="text-xs text-red-400 font-medium bg-red-500/10 p-2 rounded-lg border border-red-500/20 animate-fade-in">
                    {credError}
                  </p>
                )}
              </div>
              <Button
                className="w-full h-12 text-sm"
                onClick={handleUpdate}
                disabled={isProcessing || !form.old || !form.new}
              >
                {isProcessing ? "Updating..." : "Update Credentials"}
              </Button>
            </div>
          </Card>
        </section>

        {/* Danger Zone */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold text-red-500/70 uppercase tracking-wider px-1">
            Danger Zone
          </h3>
          <Card className="p-6 border-red-500/20 bg-red-900/10 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="text-red-500 mt-1">
                <Icons.Alert className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-red-100 text-sm">Factory Reset</h4>
                <p className="text-xs text-red-200/60 leading-relaxed mt-1">
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

      {/* Biometric Password Prompt Modal */}
      {bioPasswordPrompt && (
        <div className="absolute inset-0 bg-black/60 z-50 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-sm p-6 space-y-6 animate-shake bg-vault-800 border-vault-700 shadow-2xl">
            <div className="text-center">
              <h3 className="font-bold text-xl text-white">
                Confirm Password
              </h3>
              <p className="text-sm text-vault-400 mt-2">
                Enter your password to enable biometric unlock.
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
                <Icons.Alert className="text-red-500 w-4 h-4 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-200">{bioPasswordError}</p>
              </div>
            )}
            <div className="flex gap-3">
              <Button
                variant="ghost"
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
      )}
    </div>
  );
});