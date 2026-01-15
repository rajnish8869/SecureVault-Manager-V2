import React from 'react';
import { Icons } from '../icons/Icons';
export const NumberPad: React.FC<{ 
  onPress: (digit: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
}> = ({ onPress, onBackspace, disabled }) => {
  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  return (
    <div className="grid grid-cols-3 gap-4 max-w-[280px] mx-auto">
      {digits.map(d => (
        <button
          key={d}
          onClick={() => onPress(d)}
          disabled={disabled}
          className="w-20 h-20 rounded-full bg-vault-800 border border-vault-700 hover:bg-vault-700 active:bg-vault-accent active:border-vault-accent transition-all duration-150 flex items-center justify-center text-2xl font-semibold text-white shadow-lg disabled:opacity-50"
        >
          {d}
        </button>
      ))}
      <div />
      <button
          onClick={() => onPress('0')}
          disabled={disabled}
          className="w-20 h-20 rounded-full bg-vault-800 border border-vault-700 hover:bg-vault-700 active:bg-vault-accent active:border-vault-accent transition-all duration-150 flex items-center justify-center text-2xl font-semibold text-white shadow-lg disabled:opacity-50"
        >
          0
      </button>
      <button
          onClick={onBackspace}
          disabled={disabled}
          className="w-20 h-20 rounded-full hover:bg-vault-800/50 active:bg-vault-700 transition-all flex items-center justify-center text-vault-400 disabled:opacity-50"
        >
          <Icons.Backspace />
      </button>
    </div>
  );
};