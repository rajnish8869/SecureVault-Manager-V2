import React, { useState } from 'react';
import { Card, Button, PasswordInput, PinDisplay, NumberPad, Icons } from '../components/UI';
import type { LockType } from '../types';
interface SetupViewProps {
  onSetup: (password: string, type: LockType) => Promise<void>;
  isProcessing: boolean;
}
export const SetupView: React.FC<SetupViewProps> = ({ onSetup, isProcessing }) => {
  const [targetType, setTargetType] = useState<LockType>('PASSWORD');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pinStep, setPinStep] = useState<'CREATE' | 'CONFIRM'>('CREATE');
  const [tempPin, setTempPin] = useState('');
  const handlePasswordSubmit = () => {
      if(password !== confirm) {
          alert("Passwords do not match");
          return;
      }
      onSetup(password, 'PASSWORD');
  };
  const handlePinDigit = (d: string) => {
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
                      alert("PINs do not match");
                      setPinStep('CREATE');
                      setTempPin('');
                      setPassword('');
                  }
              }
          }
      }
  };
  return (
    <div className="min-h-dvh flex items-center justify-center p-6 animate-in fade-in duration-500 bg-vault-950">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-4">
            <div className="w-20 h-20 mx-auto bg-vault-800 rounded-2xl flex items-center justify-center text-vault-accent shadow-xl border border-vault-700">
                <Icons.Shield />
            </div>
            <h1 className="text-2xl font-bold text-white">Welcome to SecureVault</h1>
            <p className="text-sm text-vault-400">Choose how you want to lock your files.</p>
        </div>
        {targetType === 'PASSWORD' ? (
            <Card className="p-6 space-y-6 shadow-2xl">
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => { setTargetType('PIN'); setPassword(''); }}
                        className="p-3 rounded-lg border text-sm font-bold transition-all bg-vault-800 border-vault-600 text-vault-400 hover:border-vault-500 hover:text-white"
                    >
                        PIN Code
                    </button>
                    <button className="p-3 rounded-lg border text-sm font-bold transition-all bg-vault-accent/20 border-vault-accent text-white shadow-inner">
                        Password
                    </button>
                </div>
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs text-vault-400 uppercase font-bold tracking-wider">Create Password</label>
                        <PasswordInput value={password} onChange={setPassword} placeholder="Min 8 characters" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-vault-400 uppercase font-bold tracking-wider">Confirm</label>
                        <PasswordInput value={confirm} onChange={setConfirm} placeholder="Repeat to confirm" />
                    </div>
                </div>
                <Button className="w-full shadow-lg shadow-blue-500/20" onClick={handlePasswordSubmit} disabled={!password || !confirm || isProcessing}>
                    {isProcessing ? 'Initializing...' : 'Set & Continue'}
                </Button>
            </Card>
        ) : (
            <div className="space-y-8 animate-in slide-in-from-right-8 duration-300">
                 <div className="flex justify-center mb-6">
                      <div className="flex bg-vault-800 p-1 rounded-lg border border-vault-700">
                          <button className="px-4 py-1.5 rounded bg-vault-accent text-white text-xs font-bold shadow-sm">PIN Code</button>
                          <button onClick={() => { setTargetType('PASSWORD'); setPassword(''); }} className="px-4 py-1.5 rounded text-vault-400 hover:text-white text-xs font-bold transition-colors">Password</button>
                      </div>
                  </div>
                  <div className="text-center">
                    <h3 className="text-lg font-medium text-white mb-6">
                      {pinStep === 'CREATE' ? 'Create your 6-digit PIN' : 'Confirm your PIN'}
                    </h3>
                    <PinDisplay value={password} />
                    <NumberPad 
                      onPress={handlePinDigit} 
                      onBackspace={() => setPassword(p => p.slice(0, -1))} 
                      disabled={isProcessing}
                    />
                  </div>
            </div>
        )}
      </div>
    </div>
  );
};