import React, { useState, useEffect } from 'react';
import { StoreService } from '../services/storeService';
import { User } from '../types';
import { Card, Button, Input } from '../components/UI';
import { Lock, User as UserIcon, Sparkles, ChevronRight, Loader2 } from 'lucide-react';

interface AuthProps {
  onLogin: (user: User) => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [isFirstRun, setIsFirstRun] = useState(false);
  const [error, setError] = useState('');
  
  // Form State
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    checkUsers();
  }, []);

  const checkUsers = async () => {
    setLoading(true);
    const hasUsers = await StoreService.hasUsers();
    setLoading(false);
    if (!hasUsers) {
      setMode('register');
      setIsFirstRun(true);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const user = await StoreService.authenticate(username, pin);
        if (user) {
          onLogin(user);
        } else {
          setError('Invalid username or PIN');
        }
      } else {
        if (pin.length < 4) {
             setError('PIN must be at least 4 digits');
             setLoading(false);
             return;
        }
        const newUser = await StoreService.registerUser({
          username,
          pin,
          name: name || username,
          role: isFirstRun ? 'admin' : 'staff'
        });
        onLogin(newUser);
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#f8fafc]">
      <div className="w-full max-w-[400px] animate-in fade-in zoom-in duration-500">
        
        <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 mb-4">
                <Sparkles size={32} />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Noor</h1>
            <p className="text-gray-500 mt-2 font-medium">Smart Store Management</p>
        </div>

        <div className="bg-white rounded-3xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] p-8 border border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">
            {mode === 'login' ? 'Sign In' : (isFirstRun ? 'Setup Admin' : 'Staff Register')}
          </h2>

          <form onSubmit={handleAuth} className="space-y-5">
            {mode === 'register' && (
               <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Full Name</label>
                  <div className="relative">
                    <UserIcon size={18} className="absolute left-3.5 top-3.5 text-gray-400"/>
                    <Input 
                      className="!pl-10 !bg-white !border-gray-200 focus:!border-indigo-500 !rounded-xl !py-3" 
                      placeholder="e.g. John Doe" 
                      value={name} 
                      onChange={e => setName(e.target.value)}
                      required
                    />
                  </div>
               </div>
            )}

            <div>
               <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Username</label>
               <div className="relative">
                 <UserIcon size={18} className="absolute left-3.5 top-3.5 text-gray-400"/>
                 <Input 
                   className="!pl-10 !bg-white !border-gray-200 focus:!border-indigo-500 !rounded-xl !py-3" 
                   placeholder="e.g. admin" 
                   value={username} 
                   onChange={e => setUsername(e.target.value)}
                   required
                 />
               </div>
            </div>

            <div>
               <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">PIN Code</label>
               <div className="relative">
                 <Lock size={18} className="absolute left-3.5 top-3.5 text-gray-400"/>
                 <Input 
                   type="password" 
                   className="!pl-10 font-mono tracking-widest !bg-white !border-gray-200 focus:!border-indigo-500 !rounded-xl !py-3" 
                   placeholder="••••" 
                   value={pin} 
                   onChange={e => setPin(e.target.value)}
                   required
                   maxLength={8}
                 />
               </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm font-medium text-center border border-red-100">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full py-3.5 flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20 text-base" disabled={loading}>
              {loading && <Loader2 className="animate-spin mr-2" size={20}/>}
              {mode === 'login' ? 'Access Store' : 'Create Account'}
            </Button>
          </form>

          {!isFirstRun && (
            <div className="mt-8 text-center pt-6 border-t border-gray-50">
              <button 
                onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-semibold flex items-center justify-center gap-1 mx-auto transition-colors"
              >
                {mode === 'login' ? 'Register New Staff' : 'Back to Login'} 
                <ChevronRight size={14} strokeWidth={2.5}/>
              </button>
            </div>
          )}
        </div>
        
        <div className="text-center mt-8 text-xs font-medium text-gray-400">
           Noor POS System v1.2
        </div>
      </div>
    </div>
  );
};