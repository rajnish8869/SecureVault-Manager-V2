import React, { useState } from 'react';
import { Icons } from '../icons/Icons';
export const PasswordInput: React.FC<{
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
  numeric?: boolean;
  maxLength?: number;
  error?: boolean;
}> = ({ value, onChange, placeholder = "Enter Password", disabled, numeric, maxLength, error }) => {
  const [show, setShow] = useState(false);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (numeric) {
      val = val.replace(/[^0-9]/g, '');
    }
    onChange(val);
  };
  return (
    <div className="relative group">
      <input
        type={show ? "text" : "password"}
        inputMode={numeric ? "numeric" : "text"}
        pattern={numeric ? "[0-9]*" : undefined}
        maxLength={maxLength}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full bg-vault-900 border rounded-lg px-4 py-3 pr-12 text-white placeholder-vault-600 focus:outline-none transition-all disabled:opacity-50 font-medium tracking-wide ${
          error 
            ? 'border-red-500/50 focus:border-red-500 focus:ring-1 focus:ring-red-500/20' 
            : 'border-vault-700 focus:border-vault-accent focus:ring-1 focus:ring-vault-accent'
        }`}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors ${
            error ? 'text-red-400 hover:bg-red-500/10' : 'text-vault-500 hover:text-white hover:bg-vault-800'
        }`}
        tabIndex={-1}
      >
        {show ? <Icons.EyeOff /> : <Icons.Eye />}
      </button>
    </div>
  );
};