import React from 'react';
export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'danger' | 'ghost' | 'outline' }> = ({ 
  children, variant = 'primary', className = '', ...props 
}) => {
  const baseStyle = "px-4 py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-vault-accent hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20",
    danger: "bg-vault-danger hover:bg-red-600 text-white shadow-lg shadow-red-500/20",
    ghost: "bg-transparent hover:bg-vault-700 text-vault-400 hover:text-white",
    outline: "bg-transparent border border-vault-700 hover:bg-vault-700 text-vault-400 hover:text-white"
  };
  return (
    <button className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};