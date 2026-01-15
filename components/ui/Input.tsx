import React from 'react';
export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className = '', ...props }) => (
  <input 
    className={`w-full bg-vault-900 border border-vault-700 rounded-lg px-4 py-3 text-white placeholder-vault-500 focus:outline-none focus:border-vault-accent focus:ring-1 focus:ring-vault-accent transition-all disabled:opacity-50 ${className}`}
    {...props}
  />
);