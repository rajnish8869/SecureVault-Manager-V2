import React from 'react';
export const Toggle: React.FC<{ checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }> = ({ checked, onChange, disabled }) => (
  <button 
    onClick={() => !disabled && onChange(!checked)}
    disabled={disabled}
    className={`w-14 h-8 rounded-full transition-colors relative ${checked ? 'bg-vault-accent' : 'bg-vault-700'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
  >
    <div className={`absolute top-1 left-1 bg-white w-6 h-6 rounded-full shadow-md transition-transform ${checked ? 'translate-x-6' : 'translate-x-0'}`} />
  </button>
);