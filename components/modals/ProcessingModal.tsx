import React from 'react';
import { BaseModal } from './BaseModal';
export const ProcessingModal: React.FC<{
  isOpen: boolean;
  progress: number;
  status: string;
}> = ({ isOpen, progress, status }) => {
  return (
    <BaseModal isOpen={isOpen}>
        <div className="bg-vault-800 p-6 rounded-2xl w-full max-w-xs text-center space-y-4 shadow-2xl border border-vault-700">
        <div className="w-12 h-12 border-4 border-vault-accent border-t-transparent rounded-full animate-spin mx-auto"></div>
        <div>
            <h3 className="font-bold text-white">Processing...</h3>
            <p className="text-xs text-vault-400 mt-1 whitespace-pre-line">{status}</p>
        </div>
        <div className="h-1 bg-vault-900 rounded-full overflow-hidden">
            <div className="h-full bg-vault-accent transition-all duration-300" style={{width: `${progress}%`}} />
        </div>
        </div>
    </BaseModal>
  );
};