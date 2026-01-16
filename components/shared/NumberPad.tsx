import React from 'react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

interface NumberPadProps {
  onPress: (digit: string) => void;
  disabled?: boolean;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
}

export const NumberPad: React.FC<NumberPadProps> = ({ onPress, disabled, leftSlot, rightSlot }) => {
  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  const handlePress = (d: string) => {
    if (!disabled) {
      try { Haptics.impact({ style: ImpactStyle.Light }); } catch (e) {}
      onPress(d);
    }
  };

  return (
    <div className="grid grid-cols-3 gap-x-6 gap-y-4 max-w-[300px] mx-auto select-none touch-manipulation pb-4">
      {digits.map(d => (
        <PadButton key={d} onClick={() => handlePress(d)} disabled={disabled}>
          {d}
        </PadButton>
      ))}
      <div className="flex items-center justify-center w-20 h-20">
        {leftSlot}
      </div>
      <PadButton onClick={() => handlePress('0')} disabled={disabled}>
        0
      </PadButton>
      <div className="flex items-center justify-center w-20 h-20">
        {rightSlot}
      </div>
    </div>
  );
};

const PadButton: React.FC<{ onClick: () => void; disabled?: boolean; children: React.ReactNode }> = ({ onClick, disabled, children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`
      w-20 h-20 rounded-full text-3xl font-light text-white
      transition-all duration-150 ease-out
      bg-vault-800/40 hover:bg-vault-800/80 active:bg-vault-700 active:scale-90
      flex items-center justify-center
      border border-transparent
      disabled:opacity-30 disabled:cursor-not-allowed
      touch-manipulation
      backdrop-blur-sm
    `}
  >
    {children}
  </button>
);