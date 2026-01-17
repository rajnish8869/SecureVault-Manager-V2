import React, { useState, useEffect } from "react";
import {
  Button,
  PasswordInput,
  PinDisplay,
  NumberPad,
  Icons,
} from "../components/UI";
import type { LockType } from "../types";
import { Haptics, NotificationType } from "@capacitor/haptics";
import { InputValidator } from "../services/InputValidator";
import {
  RateLimitService,
  type LockoutState,
} from "../services/RateLimitService";

interface LockScreenProps {
  lockType: LockType;
  onUnlock: (password: string) => void;
  onBiometricAuth?: () => void;
  onRecoveryAttempt?: () => void;
  error: string | null;
  isProcessing: boolean;
  bioEnabled: boolean;
  bioAvailable: boolean;
  clearError: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({
  lockType,
  onUnlock,
  onBiometricAuth,
  onRecoveryAttempt,
  error,
  isProcessing,
  bioEnabled,
  bioAvailable,
  clearError,
}) => {
  const [input, setInput] = useState("");
  const [shake, setShake] = useState(false);
  const [displayError, setDisplayError] = useState<string | null>(null);
  const [lockoutState, setLockoutState] = useState<LockoutState>(
    RateLimitService.getState()
  );
  const [showRecoveryPrompt, setShowRecoveryPrompt] = useState(false);

  useEffect(() => {
    if (error) {
      triggerError(error);
    }
  }, [error]);

  useEffect(() => {
    if (lockoutState.isLocked) {
      RateLimitService.startCountdown((state) => {
        setLockoutState(state);
      });
    }
  }, [lockoutState.isLocked]);

  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;

    pollInterval = setInterval(() => {
      const currentState = RateLimitService.getState();
      setLockoutState(currentState);
    }, 300);

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };
  }, []);

  const triggerError = (msg: string) => {
    setDisplayError(msg);
    setShake(true);
    try {
      Haptics.notification({ type: NotificationType.Error });
    } catch (e) {}

    const t = setTimeout(() => {
      setShake(false);
      setInput("");
      clearError();
    }, 500);
    return () => clearTimeout(t);
  };

  const handlePinDigit = (d: string) => {
    if (isProcessing || RateLimitService.isLockedOut()) return;
    if (shake) return;

    if (displayError) setDisplayError(null);

    const sanitized = InputValidator.sanitizePin(d);
    if (!sanitized) return;

    if (input.length < 6) {
      const newVal = input + sanitized;
      setInput(newVal);
      if (newVal.length === 6) {
        const validation = InputValidator.validatePin(newVal);
        if (validation.valid) {
          setTimeout(() => onUnlock(newVal), 50);
        } else {
          triggerError("Invalid PIN format");
        }
      }
    }
  };

  const handleBackspace = () => {
    if (displayError) setDisplayError(null);
    setInput((prev) => prev.slice(0, -1));
    try {
      Haptics.impact({ style: "light" as any });
    } catch (e) {}
  };

  const isLocked = RateLimitService.isLockedOut();
  const lockoutMessage = RateLimitService.getLockoutMessage();

  return (
    <div className="h-dvh w-full bg-vault-950 flex flex-col overflow-hidden relative font-sans">
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-vault-900 to-transparent pointer-events-none opacity-50" />

      <div className="flex-1 flex flex-col items-center justify-end w-full px-6 pt-safe pb-8 min-h-0 z-10">
        <div className="flex flex-col items-center gap-6 w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col items-center gap-4 mb-4">
            <div className="w-24 h-24 bg-vault-900/50 rounded-3xl flex items-center justify-center text-vault-accent border border-vault-700/30 shadow-[0_0_40px_rgba(59,130,246,0.15)] backdrop-blur-sm">
              <Icons.Shield className="w-12 h-12" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white/90">
              SecureVault
            </h1>
          </div>

          <div className="min-h-[24px] flex items-center justify-center w-full px-4">
            {isLocked ? (
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm font-semibold text-red-400 text-center">
                  {lockoutMessage}
                </p>
                {lockoutState.remainingSeconds > 0 && (
                  <div className="w-24 h-1 bg-vault-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 transition-all duration-1000"
                      style={{
                        width: `${Math.max(
                          0,
                          100 - (lockoutState.remainingSeconds / 300) * 100
                        )}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            ) : displayError ? (
              <p className="text-sm font-semibold text-red-400 animate-shake text-center">
                {displayError}
              </p>
            ) : (
              <p className="text-sm text-vault-400 font-medium tracking-wide">
                {lockType === "PIN" ? "Enter PIN to unlock" : "Enter Password"}
              </p>
            )}
          </div>

          <div className="w-full">
            {lockType === "PASSWORD" ? (
              <div
                className={`space-y-4 transition-transform duration-100 ${
                  shake ? "translate-x-[-4px]" : ""
                } ${shake ? "animate-shake" : ""}`}
              >
                <PasswordInput
                  value={input}
                  onChange={(v) => {
                    setInput(v);
                    if (displayError) setDisplayError(null);
                  }}
                  placeholder="Password"
                  disabled={isProcessing || isLocked}
                  error={!!displayError}
                />
                <Button
                  onClick={() => onUnlock(input)}
                  disabled={!input || isProcessing || isLocked}
                  className="w-full h-12 text-sm font-bold uppercase tracking-wider shadow-lg"
                >
                  {isProcessing
                    ? "Verifying..."
                    : isLocked
                    ? "Locked"
                    : "Unlock"}
                </Button>
              </div>
            ) : (
              <div className={`py-2 ${shake ? "animate-shake" : ""}`}>
                <PinDisplay value={input} hasError={!!displayError} />
              </div>
            )}
          </div>

          {!isLocked && onRecoveryAttempt && (
            <button
              onClick={() => setShowRecoveryPrompt(!showRecoveryPrompt)}
              className="text-xs text-vault-400 hover:text-vault-300 font-medium py-2"
            >
              Lost your PIN/Password?
            </button>
          )}

          {showRecoveryPrompt && (
            <Button
              onClick={onRecoveryAttempt}
              className="w-full h-10 text-xs font-bold bg-amber-900/50 border border-amber-700/50 text-amber-300 hover:bg-amber-900 transition-colors"
            >
              Use Recovery Key
            </Button>
          )}
        </div>
      </div>

      <div className="pb-safe w-full pt-2 z-20">
        {lockType === "PIN" ? (
          <NumberPad
            onPress={handlePinDigit}
            disabled={isProcessing || isLocked}
            leftSlot={
              <button
                onClick={handleBackspace}
                className="w-20 h-20 rounded-full flex items-center justify-center text-vault-400 hover:text-white hover:bg-white/5 active:bg-white/10 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!input || isLocked}
                aria-label="Backspace"
              >
                <Icons.Backspace className="w-8 h-8" />
              </button>
            }
            rightSlot={
              bioEnabled && bioAvailable && onBiometricAuth && !isLocked ? (
                <button
                  onClick={onBiometricAuth}
                  className="w-20 h-20 rounded-full flex items-center justify-center text-vault-accent hover:text-blue-400 hover:bg-blue-500/10 active:bg-blue-500/20 active:scale-95 transition-all duration-200"
                  aria-label="Biometric Unlock"
                >
                  <Icons.Fingerprint className="w-9 h-9" />
                </button>
              ) : (
                <div className="w-20 h-20" />
              )
            }
          />
        ) : (
          bioEnabled &&
          bioAvailable &&
          onBiometricAuth &&
          !isLocked && (
            <div className="flex justify-center pb-8 pt-4">
              <button
                onClick={onBiometricAuth}
                className="flex flex-col items-center gap-2 text-vault-accent p-4 rounded-2xl hover:bg-vault-900/50 active:scale-95 transition-all"
              >
                <Icons.Fingerprint className="w-10 h-10" />
                <span className="text-xs font-bold uppercase tracking-wider opacity-80">
                  Use Biometrics
                </span>
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
};
