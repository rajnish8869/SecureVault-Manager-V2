import React, { useState, forwardRef, useImperativeHandle } from "react";
import {
  Card,
  Button,
  PasswordInput,
  PinDisplay,
  NumberPad,
  Icons,
} from "../components/UI";
import type { LockType } from "../types";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { InputValidator } from "../services/InputValidator";
import { CredentialValidationService } from "../services/CredentialValidationService";
import { RecoveryKeyService } from "../services/RecoveryKeyService";

interface SetupViewProps {
  onSetup: (
    password: string,
    type: LockType,
    recoveryKey: string
  ) => Promise<void>;
  isProcessing: boolean;
}

export interface SetupViewHandle {
  handleBack: () => boolean;
}

type SetupStep = "CREDENTIALS" | "RECOVERY_KEY" | "RECOVERY_CONFIRM";

export const SetupView = forwardRef<SetupViewHandle, SetupViewProps>(
  ({ onSetup, isProcessing }, ref) => {
    const [setupStep, setSetupStep] = useState<SetupStep>("CREDENTIALS");
    const [targetType, setTargetType] = useState<LockType>("PIN");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [pinStep, setPinStep] = useState<"CREATE" | "CONFIRM">("CREATE");
    const [tempPin, setTempPin] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [credentialValid, setCredentialValid] = useState(false);

    const [recoveryKey, setRecoveryKey] = useState<string>("");
    const [recoveryKeyType, setRecoveryKeyType] = useState<
      "ALPHANUMERIC" | "MNEMONIC"
    >("MNEMONIC");
    const [recoveryConfirm, setRecoveryConfirm] = useState("");
    const [recoveryError, setRecoveryError] = useState<string | null>(null);
    const [showRecoveryWarning, setShowRecoveryWarning] = useState(false);

    useImperativeHandle(
      ref,
      () => ({
        handleBack: () => {
          if (setupStep === "RECOVERY_KEY") {
            setSetupStep("CREDENTIALS");
            setRecoveryKey("");
            setRecoveryConfirm("");
            setRecoveryError(null);
            setShowRecoveryWarning(false);
            return true;
          }
          if (setupStep === "RECOVERY_CONFIRM") {
            setSetupStep("RECOVERY_KEY");
            setRecoveryConfirm("");
            setRecoveryError(null);
            return true;
          }
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
      [setupStep, targetType, pinStep]
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

      const validation = CredentialValidationService.validatePassword(
        password,
        {
          requireComplexity: true,
          minLength: 8,
        }
      );

      if (!validation.valid) {
        setError(validation.feedback[0]);
        return;
      }

      setError(null);
      setSetupStep("RECOVERY_KEY");
      generateNewRecoveryKey();
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
              setSetupStep("RECOVERY_KEY");
              generateNewRecoveryKey();
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

    const generateNewRecoveryKey = () => {
      const key = RecoveryKeyService.generateRecoveryKey("MNEMONIC");
      setRecoveryKey(key.key);
      setRecoveryKeyType(key.type);
      setRecoveryConfirm("");
      setRecoveryError(null);
      setShowRecoveryWarning(false);
    };

    const handleRecoveryKeyConfirm = () => {
      if (!showRecoveryWarning) {
        setShowRecoveryWarning(true);
        return;
      }

      const normalized = RecoveryKeyService.normalizeKey(recoveryConfirm);
      if (!recoveryKey || !normalized) {
        setRecoveryError("Please enter your recovery key");
        return;
      }

      const normalizedOriginal = RecoveryKeyService.normalizeKey(recoveryKey);
      if (normalized !== normalizedOriginal) {
        setRecoveryError("Recovery key does not match. Try again.");
        return;
      }

      setRecoveryError(null);
      setSetupStep("RECOVERY_CONFIRM");
    };

    const handleFinalSetup = async () => {
      const credentialToSubmit = targetType === "PIN" ? tempPin : password;
      if (!credentialToSubmit) {
        setRecoveryError("Credential missing");
        return;
      }
      await onSetup(credentialToSubmit, targetType, recoveryKey);
    };

    const handleCopyRecoveryKey = () => {
      try {
        navigator.clipboard.writeText(recoveryKey);
        setRecoveryError("✓ Copied to clipboard");
        setTimeout(() => setRecoveryError(null), 2000);
      } catch (e) {
        setRecoveryError("Failed to copy");
      }
    };

    const handleDownloadRecoveryKey = async () => {
      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `recovery-key-${timestamp}.txt`;
      const content = `SecureVault Recovery Key\nGenerated: ${new Date().toLocaleString()}\n\n${recoveryKey}\n\n[WARNING] Keep this key secure and confidential. Anyone with this key can access your vault.`;

      const stringToBytes = (str: string): string => {
        const bytes = new TextEncoder().encode(str);
        const binaryString = String.fromCharCode(...bytes);
        return btoa(binaryString);
      };

      try {
        await Filesystem.writeFile({
          path: filename,
          data: stringToBytes(content),
          directory: Directory.Documents,
          recursive: true,
        });

        setRecoveryError(`✓ Saved to Documents folder`);
        setTimeout(() => setRecoveryError(null), 3000);
      } catch (e: any) {
        try {
          await Filesystem.writeFile({
            path: filename,
            data: stringToBytes(content),
            directory: Directory.ExternalStorage,
            recursive: true,
          });

          setRecoveryError(`✓ Saved to storage`);
          setTimeout(() => setRecoveryError(null), 3000);
        } catch (secondError) {
          try {
            const blob = new Blob([content], {
              type: "text/plain;charset=utf-8",
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            link.style.display = "none";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            setRecoveryError("✓ Downloaded");
            setTimeout(() => setRecoveryError(null), 2000);
          } catch (fallbackError) {
            setRecoveryError("Failed to save recovery key");
          }
        }
      }
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

    if (setupStep === "RECOVERY_KEY") {
      return (
        <div className="h-dvh w-full bg-vault-950 flex flex-col font-sans overflow-hidden">
          <div className="flex-1 flex flex-col items-center justify-center px-6 min-h-0 pt-safe pb-8">
            <div className="w-full max-w-sm flex flex-col items-center gap-6">
              <div className="w-16 h-16 bg-vault-900 rounded-2xl flex items-center justify-center text-yellow-400 border border-vault-800">
                <Icons.AlertCircle className="w-8 h-8" />
              </div>

              <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold text-white">Recovery Key</h1>
                <p className="text-sm text-vault-400">
                  Save this key securely. You'll need it to recover access if
                  you lose your PIN/password.
                </p>
              </div>

              <Card className="w-full p-4 bg-red-950/20 border border-red-900/30">
                <p className="text-xs text-red-300 font-medium">
                  ⚠️ Store this key in a secure location. Losing both PIN and
                  recovery key = permanent data loss.
                </p>
              </Card>

              <Card className="w-full p-4 bg-vault-900/50 border-vault-800 font-mono text-sm text-vault-100 break-all max-h-48 overflow-y-auto">
                {recoveryKeyType === "MNEMONIC"
                  ? RecoveryKeyService.formatRecoveryKeyForDisplay(
                      recoveryKey,
                      "MNEMONIC"
                    )
                  : recoveryKey}
              </Card>

              <div className="w-full flex gap-2">
                <Button
                  onClick={handleCopyRecoveryKey}
                  className="flex-1 bg-vault-800 hover:bg-vault-700 text-white text-sm"
                >
                  <Icons.Copy className="w-4 h-4 mr-1" />
                  Copy
                </Button>
                <Button
                  onClick={handleDownloadRecoveryKey}
                  className="flex-1 bg-vault-800 hover:bg-vault-700 text-white text-sm"
                >
                  <Icons.Download className="w-4 h-4 mr-1" />
                  Download
                </Button>
              </div>

              <div className="w-full space-y-3">
                <label className="text-xs text-vault-400 font-medium">
                  Re-enter recovery key to confirm you've saved it:
                </label>
                <textarea
                  value={recoveryConfirm}
                  onChange={(e) => {
                    setRecoveryConfirm(e.target.value);
                    setRecoveryError(null);
                  }}
                  placeholder="Paste or type your recovery key here..."
                  className="w-full px-4 py-3 bg-vault-900 border border-vault-800 rounded-lg text-white placeholder-vault-600 text-sm font-mono focus:outline-none focus:border-vault-accent resize-none h-28"
                />
                {recoveryError && (
                  <p
                    className={`text-xs ${
                      recoveryError.includes("✓") ||
                      recoveryError.includes("Copied") ||
                      recoveryError.includes("Downloaded")
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    {recoveryError}
                  </p>
                )}
              </div>

              <Button
                className="w-full"
                onClick={handleRecoveryKeyConfirm}
                disabled={isProcessing || !recoveryConfirm}
              >
                {showRecoveryWarning
                  ? isProcessing
                    ? "Continuing..."
                    : "I've Saved & Confirmed My Key"
                  : "I've Written Down My Key"}
              </Button>
            </div>
          </div>
        </div>
      );
    }

    if (setupStep === "RECOVERY_CONFIRM") {
      return (
        <div className="h-dvh w-full bg-vault-950 flex flex-col font-sans overflow-hidden">
          <div className="flex-1 flex flex-col items-center justify-center px-6 min-h-0 pt-safe pb-8">
            <div className="w-full max-w-sm flex flex-col items-center gap-6">
              <div className="w-16 h-16 bg-vault-900 rounded-2xl flex items-center justify-center text-green-400 border border-vault-800">
                <Icons.CheckCircle className="w-8 h-8" />
              </div>

              <div className="text-center space-y-3">
                <h1 className="text-2xl font-bold text-white">All Set!</h1>
                <p className="text-sm text-vault-400">
                  Your vault is protected with a strong{" "}
                  {targetType === "PIN" ? "PIN" : "password"} and recovery key.
                </p>
              </div>

              <Card className="w-full p-4 bg-green-950/20 border border-green-900/30">
                <p className="text-xs text-green-300 font-medium">
                  ✓ PIN/Password set
                  <br />
                  ✓ Recovery key saved
                  <br />
                  Ready to secure your files!
                </p>
              </Card>

              <Button
                className="w-full"
                onClick={handleFinalSetup}
                disabled={isProcessing}
              >
                {isProcessing ? "Creating Vault..." : "Complete Setup"}
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="h-dvh w-full bg-vault-950 flex flex-col font-sans overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center px-6 min-h-0 pt-safe">
          <div className="w-full max-w-sm flex flex-col items-center gap-6">
            <div className="w-24 h-24 bg-vault-900 rounded-3xl flex items-center justify-center text-vault-accent border border-vault-800 shadow-xl">
              <Icons.Shield className="w-12 h-12" />
            </div>

            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-white">Setup Vault</h1>
              <p className="text-sm text-vault-400">
                {targetType === "PASSWORD"
                  ? "Create a strong password"
                  : pinStep === "CREATE"
                  ? "Create a 6-digit PIN"
                  : "Confirm your PIN"}
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
                              ? getStrengthColor(
                                  getPinStrength()!.score
                                ).replace("text", "bg")
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
                      placeholder="Password (min 8 chars)"
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
                  {isProcessing ? "Saving..." : "Continue to Recovery"}
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
  }
);
