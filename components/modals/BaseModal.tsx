import React from 'react';
export const BaseModal: React.FC<{ children: React.ReactNode; isOpen: boolean }> = ({ children, isOpen }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      {children}
    </div>
  );
};
export { BaseModal as Modal };