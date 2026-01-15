import React from 'react';
export const SegmentedControl: React.FC<{
  options: { label: string; value: any }[];
  value: any;
  onChange: (value: any) => void;
  disabled?: boolean;
}> = ({ options, value, onChange, disabled }) => {
  return (
    <div className={`flex bg-vault-800 p-1 rounded-lg border border-vault-700 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          onClick={() => onChange(opt.value)}
          className={`flex-1 py-2 text-xs font-bold rounded transition-all ${
            value === opt.value
              ? 'bg-vault-accent text-white shadow'
              : 'text-vault-400 hover:text-white hover:bg-vault-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};