import React from 'react';
import { Icons } from '../icons/Icons';

export const FloatingActionButton: React.FC<{ onClick: () => void; isOpen?: boolean }> = ({ onClick, isOpen }) => (
  <button 
    onClick={onClick}
    className={`fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.5)] flex items-center justify-center text-white active:scale-90 transition-all duration-300 z-40 mb-safe ${
        isOpen ? 'bg-red-500 hover:bg-red-600 rotate-45' : 'bg-vault-accent hover:bg-blue-600 rotate-0'
    }`}
    aria-label={isOpen ? "Close menu" : "Add item"}
  >
    <Icons.Plus className="w-8 h-8" />
  </button>
);