import React, { useState, forwardRef, useImperativeHandle } from "react";
import {
  Card,
  Button,
  PasswordInput,
  PinDisplay,
  NumberPad,
  Icons,
} from "./UI";
import type { LockType } from "../types";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { CredentialValidationService } from "../services/CredentialValidationService";

interface RecoverySetupViewProps {
  onSetup: (password: string, type: LockType) => Promise<void>;
  isProcessing: boolean;
}

export interface RecoverySetupViewHandle {
  handleBack: () => boolean;
}

export const RecoverySetupView = forwardRef<
  RecoverySetupViewHandle,
  RecoverySetupViewProps
>(({ onSetup, isProcessing }, ref) => {
  const [targetType, setTargetType] = useState<LockType>("PIN");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pinStep, setPinStep] = useState<"CREATE" | "CONFIRM">("CREATE");
  const [tempPin, setTempPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [credentialValid, setCredentialValid] = useState(false);

  useImperativeHandle(
    ref,
    () => ({
      handleBack: () => {
        if (targetType === "PIN" && pinStep === "CONFIRM") {
          setPinStep("CREATE");
          setTempPin("");
          setPassword("");
          setError(null);
          return true;
        }
        if (targetType === "PASSWORD") {
          setTargetType("PIN");
          setPassword("");
          setConfirm("");
          setError(null);
          return true;
        }
        return false;
      },
    }),
    [targetType, pinStep]
  );

  const validatePin = (pin: string): boolean => {
    const validation = CredentialValidationService.validatePin(pin, {
      checkPattern: true,
    });
    return validation.valid;
  };

  const validatePassword = (pwd: string): boolean => {
    const validation = CredentialValidationService.validatePassword(pwd, {
      requireComplexity: true,
      minLength: 8,
    });
    return validation.valid;
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (targetType === "PASSWORD" && value && confirm) {
      const valid = validatePassword(value) && value === confirm;
      setCredentialValid(valid);
    }
  };

  const handleConfirmChange = (value: string) => {
    setConfirm(value);
    if (password && value) {
      const valid = validatePassword(password) && password === value;
      setCredentialValid(valid);
    }
  };

  const handlePasswordSubmit = () => {
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    const validation = CredentialValidationService.validatePassword(password, {
      requireComplexity: true,
      minLength: 8,
    });

    if (!validation.valid) {
      setError(validation.feedback[0]);
      return;
    }

    setError(null);
    onSetup(password, "PASSWORD");
  };

  const handlePinDigit = (d: string) => {
    setError(null);
    if (password.length < 6) {
      const newVal = password + d;
      setPassword(newVal);
      if (newVal.length === 6) {
        if (!validatePin(newVal)) {
          setError("PIN has weak pattern. Use different digits.");
          setTimeout(() => {
            setPinStep("CREATE");
            setTempPin("");
            setPassword("");
            setError(null);
          }, 1500);
          return;
        }

        if (pinStep === "CREATE") {
          setTimeout(() => {
            setTempPin(newVal);
            setPassword("");
            setPinStep("CONFIRM");
          }, 200);
        } else {
          if (newVal === tempPin) {
            setError(null);
            setCredentialValid(true);
            onSetup(newVal, "PIN");
          } else {
            setError("PINs do not match. Try again.");
            try {
              Haptics.impact({ style: ImpactStyle.Heavy });
            } catch (e) {}
            setTimeout(() => {
              setPinStep("CREATE");
              setTempPin("");
              setPassword("");
              setError(null);
            }, 1500);
          }
        }
      }
    }
  };

  const handleBackspace = () => {
    setPassword((prev) => prev.slice(0, -1));
    setError(null);
  };

  const getPasswordStrength = () => {
    if (!password) return null;
    return CredentialValidationService.calculatePasswordStrength(password);
  };

  const getPinStrength = () => {
    if (!password) return null;
    return CredentialValidationService.calculatePinStrength(password);
  };

  const getStrengthColor = (score: number) => {
    if (score === 0) return "text-red-500";
    if (score === 1) return "text-orange-500";
    if (score === 2) return "text-yellow-500";
    return "text-green-500";
  };

  const getStrengthLabel = (score: number) => {
    if (score === 0) return "Weak";
    if (score === 1) return "Fair";
    if (score === 2) return "Good";
    return "Strong";
  };

  return (
    <div className="h-dvh w-full bg-vault-950 flex flex-col font-sans overflow-hidden">
      <div className="flex-1 flex flex-col items-center justify-center px-6 min-h-0 pt-safe">
        <div className="w-full max-w-sm flex flex-col items-center gap-6">
          <div className="w-24 h-24 bg-vault-900 rounded-3xl flex items-center justify-center text-vault-accent border border-vault-800 shadow-xl">
            <Icons.Shield className="w-12 h-12" />
          </div>

          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-white">
              Update Credentials
            </h1>
            <p className="text-sm text-vault-400">
              {targetType === "PASSWORD"
                ? "Create a new strong password"
                : pinStep === "CREATE"
                ? "Create a new 6-digit PIN"
                : "Confirm your new PIN"}
            </p>
          </div>

          {targetType === "PIN" ? (
            <div className="w-full py-4 min-h-[80px] flex flex-col items-center justify-center gap-4">
              <PinDisplay value={password} hasError={!!error} />
              {pinStep === "CREATE" && password && getPinStrength() && (
                <div className="w-full max-w-xs">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs text-vault-500 font-medium">
                      PIN Strength
                    </span>
                    <span
                      className={`text-xs font-bold ${getStrengthColor(
                        getPinStrength()!.score
                      )}`}
                    >
                      {getStrengthLabel(getPinStrength()!.score)}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded ${
                          i < getPinStrength()!.score
                            ? getStrengthColor(getPinStrength()!.score).replace(
                                "text",
                                "bg"
                              )
                            : "bg-vault-800"
                        }`}
                      />
                    ))}
                  </div>
                  {getPinStrength()!.feedback.length > 0 && (
                    <p className="text-xs text-vault-400 mt-2">
                      {getPinStrength()!.feedback[0]}
                    </p>
                  )}
                </div>
              )}
              {error && (
                <p className="text-red-400 text-xs font-medium animate-in fade-in">
                  {error}
                </p>
              )}
            </div>
          ) : (
            <Card className="w-full p-5 space-y-4 bg-vault-900/50 backdrop-blur border-vault-800">
              <div className="space-y-3">
                <div>
                  <PasswordInput
                    value={password}
                    onChange={handlePasswordChange}
                    placeholder="New Password (min 8 chars)"
                    error={!!error}
                  />
                  {password && getPasswordStrength() && (
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-vault-500 font-medium">
                          Strength
                        </span>
                        <span
                          className={`text-xs font-bold ${getStrengthColor(
                            getPasswordStrength()!.score
                          )}`}
                        >
                          {getStrengthLabel(getPasswordStrength()!.score)}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        {[0, 1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded ${
                              i < getPasswordStrength()!.score
                                ? getStrengthColor(
                                    getPasswordStrength()!.score
                                  ).replace("text", "bg")
                                : "bg-vault-800"
                            }`}
                          />
                        ))}
                      </div>
                      {getPasswordStrength()!.feedback.length > 0 && (
                        <div className="text-xs text-vault-400 space-y-1">
                          {getPasswordStrength()!.feedback.map((f, i) => (
                            <p key={i}>• {f}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <PasswordInput
                  value={confirm}
                  onChange={handleConfirmChange}
                  placeholder="Confirm Password"
                  error={!!error}
                />
              </div>
              {error && (
                <p className="text-red-400 text-xs text-center">{error}</p>
              )}
              <Button
                className="w-full"
                onClick={handlePasswordSubmit}
                disabled={!credentialValid || isProcessing}
              >
                {isProcessing ? "Updating..." : "Update Password"}
              </Button>
            </Card>
          )}
        </div>
      </div>

      <div className="pb-safe pt-4 bg-vault-950">
        {targetType === "PIN" ? (
          <>
            <NumberPad
              onPress={handlePinDigit}
              disabled={isProcessing || (!!error && pinStep === "CONFIRM")}
              leftSlot={
                <button
                  onClick={handleBackspace}
                  className="w-20 h-20 flex items-center justify-center text-vault-500 hover:text-white"
                >
                  <Icons.Backspace className="w-8 h-8" />
                </button>
              }
              rightSlot={<div />}
            />
            <div className="flex justify-center pb-4 mt-2">
              <button
                onClick={() => {
                  setTargetType("PASSWORD");
                  setPassword("");
                  setConfirm("");
                  setError(null);
                }}
                className="text-xs text-vault-500 hover:text-vault-300 font-medium py-2 px-4"
              >
                Switch to Password
              </button>
            </div>
          </>
        ) : (
          <div className="flex justify-center pb-8">
            <button
              onClick={() => {
                setTargetType("PIN");
                setPassword("");
                setTempPin("");
                setPinStep("CREATE");
                setError(null);
                setCredentialValid(false);
              }}
              className="text-sm text-vault-accent font-bold py-3 px-6 rounded-lg hover:bg-vault-900 transition-colors"
            >
              Switch to PIN Code
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
