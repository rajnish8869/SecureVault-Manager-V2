import React, { useState } from "react";
import { Button, Card, Icons } from "./UI";

interface RecoveryKeyViewProps {
  onSubmit: (recoveryKey: string) => Promise<void>;
  onCancel: () => void;
  isProcessing: boolean;
}

export const RecoveryKeyView: React.FC<RecoveryKeyViewProps> = ({
  onSubmit,
  onCancel,
  isProcessing,
}) => {
  const [recoveryInput, setRecoveryInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!recoveryInput.trim()) {
      setError("Please enter your recovery key");
      return;
    }
    setError(null);
    await onSubmit(recoveryInput);
  };

  return (
    <div className="h-dvh w-full bg-vault-950 flex flex-col font-sans overflow-hidden">
      <div className="flex-1 flex flex-col items-center justify-center px-6 min-h-0 pt-safe pb-8">
        <div className="w-full max-w-sm flex flex-col items-center gap-6">
          <div className="w-20 h-20 bg-vault-900 rounded-2xl flex items-center justify-center text-amber-400 border border-vault-800">
            <Icons.Key className="w-10 h-10" />
          </div>

          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-white">Recover Access</h1>
            <p className="text-sm text-vault-400">
              Enter your recovery key to regain access to your vault
            </p>
          </div>

          <Card className="w-full p-4 bg-amber-950/20 border border-amber-900/30">
            <p className="text-xs text-amber-300 font-medium">
              ⓘ Your recovery key is the 12-word phrase you saved during setup
            </p>
          </Card>

          <div className="w-full space-y-3">
            <label className="text-xs text-vault-400 font-medium">
              Recovery Key
            </label>
            <textarea
              value={recoveryInput}
              onChange={(e) => {
                setRecoveryInput(e.target.value);
                setError(null);
              }}
              placeholder="Paste or type your 12-word recovery key..."
              className="w-full px-4 py-3 bg-vault-900 border border-vault-800 rounded-lg text-white placeholder-vault-600 text-sm font-mono focus:outline-none focus:border-vault-accent resize-none h-32"
              disabled={isProcessing}
            />
            {error && (
              <p className="text-red-400 text-xs font-medium">{error}</p>
            )}
          </div>

          <div className="w-full space-y-2">
            <Button
              onClick={handleSubmit}
              disabled={!recoveryInput.trim() || isProcessing}
              className="w-full"
            >
              {isProcessing ? "Verifying..." : "Unlock with Recovery Key"}
            </Button>
            <Button
              onClick={onCancel}
              disabled={isProcessing}
              className="w-full bg-vault-800 hover:bg-vault-700 text-white"
            >
              Back to Lock Screen
            </Button>
          </div>

          <Card className="w-full p-3 bg-red-950/20 border border-red-900/30">
            <p className="text-xs text-red-300">
              ⚠️ Incorrect recovery key entry may trigger additional security
              measures
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
};
