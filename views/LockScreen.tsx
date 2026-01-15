import React, { useState, useEffect } from 'react';
import { Button, PasswordInput, PinDisplay, NumberPad, Icons } from '../components/UI';
import type { LockType } from '../types';
interface LockScreenProps {
  lockType: LockType;
  onUnlock: (password: string) => void;
  onBiometricAuth?: () => void;
  error: string | null;
  isProcessing: boolean;
  bioEnabled: boolean;
  bioAvailable: boolean;
  clearError: () => void;
}
export const LockScreen: React.FC<LockScreenProps> = ({ 
    lockType, onUnlock, onBiometricAuth, error, isProcessing, bioEnabled, bioAvailable, clearError
}) => {
  const [input, setInput] = useState('');
  useEffect(() => {
      if(error && lockType === 'PIN') setInput('');
  }, [error, lockType]);
  const handlePinDigit = (d: string) => {
      if(isProcessing) return;
      clearError();
      if (input.length < 6) {
          const newVal = input + d;
          setInput(newVal);
          if (newVal.length === 6) {
              onUnlock(newVal);
          }
      }
  };
  const handleBackspace = () => {
      setInput(prev => prev.slice(0, -1));
      clearError();
  };
  return (
    <div className="h-dvh flex items-center justify-center p-6 bg-vault-950">
      <div className="w-full max-w-sm space-y-10 animate-in zoom-in-95 duration-500">
        <div className="text-center space-y-6">
           <div className="w-24 h-24 mx-auto bg-gradient-to-br from-vault-800 to-vault-900 rounded-3xl shadow-2xl flex items-center justify-center text-vault-accent border border-vault-700/50 ring-4 ring-vault-900 relative">
               <Icons.Shield />
           </div>
           <div>
               <h1 className="text-3xl font-bold tracking-tight text-white mb-2">SecureVault</h1>
               <p className="text-vault-400 font-medium">
                 {lockType === 'PIN' ? 'Enter PIN to Unlock' : 'Enter Password to Unlock'}
               </p>
           </div>
        </div>
        {lockType === 'PASSWORD' ? (
             <div className="space-y-4">
                <PasswordInput 
                  value={input} 
                  onChange={(v) => { setInput(v); clearError(); }} 
                  placeholder="Enter Password"
                  disabled={isProcessing}
                />
                <div className="flex gap-3 pt-2">
                  <Button onClick={() => onUnlock(input)} disabled={!input || isProcessing} className="w-full shadow-lg shadow-blue-500/20">
                    {isProcessing ? 'Verifying...' : 'Unlock Vault'}
                  </Button>
                  {bioEnabled && bioAvailable && onBiometricAuth && (
                    <button onClick={onBiometricAuth} className="px-4 rounded-lg bg-vault-800 border border-vault-700 text-vault-accent hover:bg-vault-700 hover:text-white transition-colors shadow-lg">
                      <Icons.Fingerprint />
                    </button>
                  )}
                </div>
             </div>
        ) : (
            <div className="space-y-8">
                 <PinDisplay value={input} />
                 <NumberPad onPress={handlePinDigit} onBackspace={handleBackspace} disabled={isProcessing} />
                 {bioEnabled && bioAvailable && onBiometricAuth && (
                  <div className="flex justify-center pt-2">
                    <button onClick={onBiometricAuth} className="p-4 rounded-full bg-vault-800 border border-vault-700 text-vault-accent hover:bg-vault-750 hover:text-white transition-all shadow-lg active:scale-95">
                      <Icons.Fingerprint />
                    </button>
                  </div>
                 )}
            </div>
        )}
        {error && (
           <div className="text-red-400 text-sm font-medium text-center bg-red-500/10 border border-red-500/20 p-3 rounded-xl animate-shake">
             {error}
           </div>
        )}
      </div>
    </div>
  );
};