import React, {
  forwardRef,
  useImperativeHandle,
  useState,
  useRef,
} from "react";
import { CredentialValidationService } from "../services/CredentialValidationService";
import Button from "../components/ui/Button";
import SegmentedControl from "../components/ui/SegmentedControl";
import PinDisplay from "../components/shared/PinDisplay";
import NumberPad from "../components/shared/NumberPad";
import PasswordInput from "../components/shared/PasswordInput";
import Input from "../components/ui/Input";
import Icon from "../components/icons/Icons";
import { LockType } from "../types";

interface RecoverySetupViewHandle {
  handleBack: () => boolean;
}

interface RecoverySetupViewProps {
  onSetup: (password: string, lockType: LockType) => void;
  isProcessing: boolean;
}

const RecoverySetupView = forwardRef<
  RecoverySetupViewHandle,
  RecoverySetupViewProps
>(({ onSetup, isProcessing }, ref) => {
  const [step, setStep] = useState<"type" | "pin-1" | "pin-2" | "password">(
    "type"
  );
  const [lockType, setLockType] = useState<LockType>("pin");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [pinStrength, setPinStrength] = useState(0);
  const [passwordStrength, setPasswordStrength] = useState(0);

  useImperativeHandle(ref, () => ({
    handleBack: () => {
      if (step !== "type") {
        setStep(
          step === "pin-2" || step === "pin-1"
            ? "type"
            : step === "password"
            ? "type"
            : "type"
        );
        setPin("");
        setPinConfirm("");
        setPassword("");
        setPasswordConfirm("");
        setError("");
        return true;
      }
      return false;
    },
  }));

  const handlePinDigit = (digit: string) => {
    if (step === "pin-1") {
      if (digit === "backspace") {
        setPin(pin.slice(0, -1));
      } else if (pin.length < 6) {
        const newPin = pin + digit;
        setPin(newPin);
        const strength =
          CredentialValidationService.calculatePinStrength(newPin);
        setPinStrength(strength);
        setError("");
      }
    } else if (step === "pin-2") {
      if (digit === "backspace") {
        setPinConfirm(pinConfirm.slice(0, -1));
      } else if (pinConfirm.length < 6) {
        setPinConfirm(pinConfirm + digit);
        setError("");
      }
    }
  };

  const handlePinNext = () => {
    const validation = CredentialValidationService.validatePin(pin);
    if (!validation.isValid) {
      setError(validation.message);
      return;
    }
    setStep("pin-2");
    setError("");
  };

  const handlePinConfirm = () => {
    if (pin !== pinConfirm) {
      setError("PINs do not match");
      return;
    }
    onSetup(pin, "pin");
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    const strength =
      CredentialValidationService.calculatePasswordStrength(value);
    setPasswordStrength(strength);
    setError("");
  };

  const handlePasswordConfirmChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setPasswordConfirm(e.target.value);
    setError("");
  };

  const handlePasswordSubmit = () => {
    const validation = CredentialValidationService.validatePassword(password);
    if (!validation.isValid) {
      setError(validation.message);
      return;
    }
    if (password !== passwordConfirm) {
      setError("Passwords do not match");
      return;
    }
    onSetup(password, "password");
  };

  const lockTypeOptions = [
    { label: "PIN", value: "pin" },
    { label: "Password", value: "password" },
  ];

  const getStrengthColor = (strength: number) => {
    switch (strength) {
      case 0:
        return "text-red-500";
      case 1:
        return "text-orange-500";
      case 2:
        return "text-yellow-500";
      case 3:
        return "text-green-500";
      default:
        return "text-gray-500";
    }
  };

  const getStrengthLabel = (strength: number) => {
    switch (strength) {
      case 0:
        return "Weak";
      case 1:
        return "Fair";
      case 2:
        return "Good";
      case 3:
        return "Strong";
      default:
        return "Unknown";
    }
  };

  return (
    <div className="min-h-screen bg-vault-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-vault-accent/20 rounded-full flex items-center justify-center">
            <Icon icon="lock" size={32} className="text-vault-accent" />
          </div>
          <h1 className="text-3xl font-bold text-slate-100 mb-2">
            Set New Credentials
          </h1>
          <p className="text-slate-400">Create your new lock security</p>
        </div>

        {step === "type" && (
          <div className="space-y-6">
            <p className="text-slate-300 text-center">
              Choose your preferred security method:
            </p>
            <SegmentedControl
              options={lockTypeOptions}
              value={lockType}
              onChange={(value) => {
                setLockType(value as LockType);
                setStep(value === "pin" ? "pin-1" : "password");
                setError("");
              }}
            />
          </div>
        )}

        {step === "pin-1" && (
          <div className="space-y-6">
            <div>
              <p className="text-slate-300 text-center mb-4">
                Enter your new PIN:
              </p>
              <PinDisplay pin={pin} />
              {pin.length > 0 && (
                <div className="mt-4 text-center">
                  <p
                    className={`text-sm font-medium ${getStrengthColor(
                      pinStrength
                    )}`}
                  >
                    Strength: {getStrengthLabel(pinStrength)}
                  </p>
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500 rounded-lg p-3">
                <p className="text-red-300 text-sm text-center">{error}</p>
              </div>
            )}

            <NumberPad onDigit={handlePinDigit} />

            <Button
              onClick={handlePinNext}
              disabled={pin.length !== 6 || isProcessing}
              className="w-full"
            >
              {isProcessing ? "Processing..." : "Next"}
            </Button>

            <Button
              onClick={() => setStep("type")}
              variant="ghost"
              className="w-full"
              disabled={isProcessing}
            >
              Back
            </Button>
          </div>
        )}

        {step === "pin-2" && (
          <div className="space-y-6">
            <div>
              <p className="text-slate-300 text-center mb-4">
                Confirm your PIN:
              </p>
              <PinDisplay pin={pinConfirm} />
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500 rounded-lg p-3">
                <p className="text-red-300 text-sm text-center">{error}</p>
              </div>
            )}

            <NumberPad onDigit={handlePinDigit} />

            <Button
              onClick={handlePinConfirm}
              disabled={pinConfirm.length !== 6 || isProcessing}
              className="w-full"
            >
              {isProcessing ? "Processing..." : "Confirm PIN"}
            </Button>

            <Button
              onClick={() => {
                setPin("");
                setPinConfirm("");
                setStep("pin-1");
                setError("");
              }}
              variant="ghost"
              className="w-full"
              disabled={isProcessing}
            >
              Back
            </Button>
          </div>
        )}

        {step === "password" && (
          <div className="space-y-6">
            <div>
              <label className="block text-slate-300 text-center mb-4">
                Create a strong password:
              </label>
              <PasswordInput
                value={password}
                onChange={handlePasswordChange}
                placeholder="Enter password"
                autoFocus
              />
              {password.length > 0 && (
                <div className="mt-3 text-center">
                  <p
                    className={`text-sm font-medium ${getStrengthColor(
                      passwordStrength
                    )}`}
                  >
                    Strength: {getStrengthLabel(passwordStrength)}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-slate-300 text-center mb-4">
                Confirm password:
              </label>
              <Input
                type="password"
                value={passwordConfirm}
                onChange={handlePasswordConfirmChange}
                placeholder="Confirm password"
              />
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500 rounded-lg p-3">
                <p className="text-red-300 text-sm text-center">{error}</p>
              </div>
            )}

            <Button
              onClick={handlePasswordSubmit}
              disabled={!password || !passwordConfirm || isProcessing}
              className="w-full"
            >
              {isProcessing ? "Processing..." : "Set Password"}
            </Button>

            <Button
              onClick={() => setStep("type")}
              variant="ghost"
              className="w-full"
              disabled={isProcessing}
            >
              Back
            </Button>
          </div>
        )}
      </div>
    </div>
  );
});

RecoverySetupView.displayName = "RecoverySetupView";

export default RecoverySetupView;
