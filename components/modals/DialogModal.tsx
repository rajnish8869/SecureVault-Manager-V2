import React, { useState, useEffect } from "react";
import { BaseModal } from "./BaseModal";
import { Button } from "../ui/Button";
import { Icons } from "../icons/Icons";
import { InputValidator } from "../../services/InputValidator";
export interface DialogProps {
  isOpen: boolean;
  type: "ALERT" | "CONFIRM" | "PROMPT";
  title: string;
  message: string;
  variant?: "info" | "danger" | "success";
  onConfirm: (value?: string) => void;
  onCancel: () => void;
  inputProps?: {
    placeholder?: string;
    type?: "text" | "password" | "tel" | "number";
    defaultValue?: string;
  };
}
export const DialogModal: React.FC<DialogProps> = ({
  isOpen,
  type,
  title,
  message,
  variant = "info",
  onConfirm,
  onCancel,
  inputProps,
}) => {
  const [val, setVal] = useState(inputProps?.defaultValue || "");
  useEffect(() => {
    if (isOpen) setVal(inputProps?.defaultValue || "");
  }, [isOpen, inputProps?.defaultValue]);
  if (!isOpen) return null;
  const handleConfirm = () => {
    // Validate and sanitize input if it's a PROMPT
    if (type === "PROMPT" && val) {
      try {
        // Check for path traversal
        if (InputValidator.isPathTraversal(val)) {
          // Don't reveal that we detected path traversal, just reject
          return;
        }
        // Sanitize the input
        const sanitized = InputValidator.sanitizeFolderName(val);
        onConfirm(sanitized);
        setVal("");
      } catch (e) {
        // Validation error, don't proceed
        console.error("Input validation error:", e);
        return;
      }
    } else {
      onConfirm(val);
      setVal("");
    }
  };
  return (
    <BaseModal isOpen={isOpen}>
      <div
        className={`bg-vault-800 p-6 rounded-2xl w-full max-w-sm space-y-4 border shadow-2xl animate-in zoom-in-95 ${
          variant === "danger" ? "border-red-500/30" : "border-vault-700"
        }`}
      >
        <div className="text-center space-y-2">
          <div
            className={`flex justify-center mb-2 ${
              variant === "danger" ? "text-red-500" : "text-vault-accent"
            }`}
          >
            {variant === "danger" ? <Icons.Alert /> : <Icons.Shield />}
          </div>
          <h3
            className={`text-xl font-bold ${
              variant === "danger" ? "text-red-500" : "text-white"
            }`}
          >
            {title}
          </h3>
          <p className="text-sm text-vault-400 whitespace-pre-wrap">
            {message}
          </p>
        </div>
        {type === "PROMPT" && (
          <input
            autoFocus
            className="w-full bg-vault-900 border border-vault-700 rounded-lg p-3 text-white focus:border-vault-accent focus:outline-none placeholder-vault-600"
            {...inputProps}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            maxLength={255}
          />
        )}
        <div className="flex gap-3 pt-2">
          {type !== "ALERT" && (
            <Button variant="ghost" onClick={onCancel} className="flex-1">
              Cancel
            </Button>
          )}
          <Button
            variant={variant === "danger" ? "danger" : "primary"}
            className={`flex-1 ${type === "ALERT" ? "w-full" : ""}`}
            onClick={handleConfirm}
            disabled={type === "PROMPT" && !val}
          >
            {type === "ALERT" ? "OK" : "Confirm"}
          </Button>
        </div>
      </div>
    </BaseModal>
  );
};
