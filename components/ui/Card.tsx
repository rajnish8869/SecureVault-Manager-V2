import React from 'react';
export const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({ children, className = '', onClick }) => (
  <div onClick={onClick} className={`bg-vault-800 rounded-xl border border-vault-700 shadow-xl overflow-hidden ${className}`}>
    {children}
  </div>
);