import React from 'react';

interface PinDisplayProps {
  value: string;
  length?: number;
  hasError?: boolean;
}

export const PinDisplay: React.FC<PinDisplayProps> = ({ value, length = 6, hasError }) => {
  return (
    <div className="flex justify-center gap-5 py-4">
      {Array.from({ length }).map((_, i) => {
        const isFilled = i < value.length;
        return (
          <div
            key={i}
            className={`
              w-4 h-4 rounded-full transition-all duration-200 border
              ${hasError 
                ? 'bg-red-500 border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.6)]' 
                : isFilled 
                  ? 'bg-vault-accent border-vault-accent scale-110 shadow-[0_0_12px_rgba(59,130,246,0.6)]' 
                  : 'bg-vault-900 border-vault-600'
              }
            `}
          />
        );
      })}
    </div>
  );
};