import React from 'react';
export const Toggle: React.FC<{ checked: boolean; onChange: (checked: boolean) => void }> = ({ checked, onChange }) => (
  <button 
    onClick={() => onChange(!checked)}
    className={`w-14 h-8 rounded-full transition-colors relative ${checked ? 'bg-vault-accent' : 'bg-vault-700'}`}
  >
    <div className={`absolute top-1 left-1 bg-white w-6 h-6 rounded-full shadow-md transition-transform ${checked ? 'translate-x-6' : 'translate-x-0'}`} />
  </button>
);