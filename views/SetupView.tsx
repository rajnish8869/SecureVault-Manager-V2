import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { Card, Button, PasswordInput, PinDisplay, NumberPad, Icons } from '../components/UI';
import type { LockType } from '../types';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

interface SetupViewProps {
  onSetup: (password: string, type: LockType) => Promise<void>;
  isProcessing: boolean;
}

export interface SetupViewHandle {
  handleBack: () => boolean;
}

export const SetupView = forwardRef<SetupViewHandle, SetupViewProps>(({ onSetup, isProcessing }, ref) => {
  const [targetType, setTargetType] = useState<LockType>('PIN'); // Default to PIN for modern mobile feel
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pinStep, setPinStep] = useState<'CREATE' | 'CONFIRM'>('CREATE');
  const [tempPin, setTempPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    handleBack: () => {
      // If confirming PIN, go back to create step
      if (targetType === 'PIN' && pinStep === 'CONFIRM') {
        setPinStep('CREATE');
        setTempPin('');
        setPassword('');
        setError(null);
        return true;
      }
      // If in password mode, switch back to PIN mode (default)
      if (targetType === 'PASSWORD') {
        setTargetType('PIN');
        setPassword('');
        setConfirm('');
        setError(null);
        return true;
      }
      return false; // Allow app exit
    }
  }), [targetType, pinStep]);

  const handlePasswordSubmit = () => {
      if(password !== confirm) {
          setError("Passwords do not match");
          return;
      }
      if(password.length < 8) {
          setError("Password must be at least 8 characters");
          return;
      }
      onSetup(password, 'PASSWORD');
  };

  const handlePinDigit = (d: string) => {
      setError(null);
      if(password.length < 6) {
          const newVal = password + d;
          setPassword(newVal);
          if(newVal.length === 6) {
              if(pinStep === 'CREATE') {
                  setTimeout(() => {
                      setTempPin(newVal);
                      setPassword('');
                      setPinStep('CONFIRM');
                  }, 200);
              } else {
                  if(newVal === tempPin) {
                      onSetup(newVal, 'PIN');
                  } else {
                      setError("PINs do not match. Try again.");
                      try { Haptics.impact({ style: ImpactStyle.Heavy }); } catch(e){}
                      setTimeout(() => {
                          setPinStep('CREATE');
                          setTempPin('');
                          setPassword('');
                          setError(null);
                      }, 1500);
                  }
              }
          }
      }
  };

  const handleBackspace = () => {
      setPassword(prev => prev.slice(0, -1));
      setError(null);
  };

  return (
    <div className="h-dvh w-full bg-vault-950 flex flex-col font-sans overflow-hidden">
        {/* Header */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 min-h-0 pt-safe">
            <div className="w-full max-w-sm flex flex-col items-center gap-6">
                <div className="w-24 h-24 bg-vault-900 rounded-3xl flex items-center justify-center text-vault-accent border border-vault-800 shadow-xl">
                    <Icons.Shield className="w-12 h-12" />
                </div>
                
                <div className="text-center space-y-2">
                    <h1 className="text-2xl font-bold text-white">Setup Vault</h1>
                    <p className="text-sm text-vault-400">
                        {targetType === 'PASSWORD' 
                            ? 'Create a strong password' 
                            : pinStep === 'CREATE' ? 'Create a 6-digit PIN' : 'Confirm your PIN'}
                    </p>
                </div>

                {targetType === 'PIN' ? (
                    <div className="w-full py-4 min-h-[80px] flex flex-col items-center justify-center">
                        <PinDisplay value={password} hasError={!!error} />
                        {error && <p className="text-red-400 text-xs font-medium mt-2 animate-in fade-in">{error}</p>}
                    </div>
                ) : (
                    <Card className="w-full p-5 space-y-4 bg-vault-900/50 backdrop-blur border-vault-800">
                        <div className="space-y-3">
                            <PasswordInput value={password} onChange={setPassword} placeholder="Password (min 8 chars)" error={!!error} />
                            <PasswordInput value={confirm} onChange={setConfirm} placeholder="Confirm Password" error={!!error} />
                        </div>
                        {error && <p className="text-red-400 text-xs text-center">{error}</p>}
                        <Button className="w-full" onClick={handlePasswordSubmit} disabled={!password || !confirm || isProcessing}>
                            {isProcessing ? 'Saving...' : 'Set Password'}
                        </Button>
                    </Card>
                )}
            </div>
        </div>

        {/* Footer / Keypad */}
        <div className="pb-safe pt-4 bg-vault-950">
            {targetType === 'PIN' ? (
                <>
                    <NumberPad 
                        onPress={handlePinDigit} 
                        disabled={isProcessing || (!!error && pinStep === 'CONFIRM')}
                        leftSlot={
                            <button onClick={handleBackspace} className="w-20 h-20 flex items-center justify-center text-vault-500 hover:text-white">
                                <Icons.Backspace className="w-8 h-8" />
                            </button>
                        }
                        rightSlot={
                            <div /> // Empty slot for balance
                        }
                    />
                    <div className="flex justify-center pb-4 mt-2">
                        <button 
                            onClick={() => { setTargetType('PASSWORD'); setPassword(''); setConfirm(''); }}
                            className="text-xs text-vault-500 hover:text-vault-300 font-medium py-2 px-4"
                        >
                            Switch to Password
                        </button>
                    </div>
                </>
            ) : (
                <div className="flex justify-center pb-8">
                    <button 
                        onClick={() => { setTargetType('PIN'); setPassword(''); setTempPin(''); setPinStep('CREATE'); setError(null); }}
                        className="text-sm text-vault-accent font-bold py-3 px-6 rounded-lg hover:bg-vault-900 transition-colors"
                    >
                        Switch to PIN Code
                    </button>
                </div>
            )}
        </div>
    </div>
  );
});