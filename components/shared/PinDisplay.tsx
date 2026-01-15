import React from 'react';
export const PinDisplay: React.FC<{ value: string; length?: number }> = ({ value, length = 6 }) => {
  return (
    <div className="flex justify-center gap-4 mb-8">
      {Array.from({ length }).map((_, i) => (
        <div
          key={i}
          className={`w-4 h-4 rounded-full transition-all duration-300 ${
            i < value.length 
              ? 'bg-vault-accent scale-110 shadow-lg shadow-blue-500/50' 
              : 'bg-vault-700 scale-100'
          }`}
        />
      ))}
    </div>
  );
};