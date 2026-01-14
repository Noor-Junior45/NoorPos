import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { Input } from '../components/UI';
import { GoogleDriveUtils } from '../utils/googleDrive';
import { Sparkles, Loader2, Database, AlertTriangle } from 'lucide-react';

interface AuthProps {
  onLogin: (user: User) => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  // Use VITE_GOOGLE_CLIENT_ID from environment
  // Using optional chaining (?) to safely access env, preventing crash if undefined
  const CLIENT_ID = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';

  const handleSuccess = (profile: any) => {
    const user: User = {
      id: profile.email,
      username: profile.email.split('@')[0],
      name: profile.name,
      role: 'admin',
      pin: '0000'
    };
    onLogin(user);
  };

  const handleGoogleLogin = async () => {
    if (!CLIENT_ID) {
        setError("Configuration Error: VITE_GOOGLE_CLIENT_ID is missing.");
        return;
    }

    setLoading(true);
    setError('');
    setStatus('Connecting to Google...');

    try {
      // 1. Get Token
      const accessToken = await GoogleDriveUtils.initGoogleLogin(CLIENT_ID);
      setStatus('Accessing Google Drive...');

      // 2. Find or Create Sheet
      const sheetId = await GoogleDriveUtils.findOrCreateBackend(accessToken);
      setStatus('Syncing Database...');

      // 3. Get Profile
      const profile = await GoogleDriveUtils.getUserProfile(accessToken);
      
      // 4. Save Session
      GoogleDriveUtils.saveSession({
        accessToken,
        spreadsheetId: sheetId,
        profile
      });
      
      // 5. Login to App
      handleSuccess(profile);

    } catch (err: any) {
      console.error(err);
      setError("Login failed. Check popup blockers or console errors.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#f8fafc]">
      <div className="w-full max-w-[420px] animate-in fade-in zoom-in duration-500">
        
        <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 mb-4">
                <Sparkles size={32} />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Noor</h1>
            <p className="text-gray-500 mt-2 font-medium">Smart Store Management</p>
        </div>

        <div className="bg-white rounded-3xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] p-8 border border-gray-100">
          <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">Login</h2>
              <p className="text-sm text-gray-400 mt-1">Connect your Google Drive to store data securely.</p>
          </div>

          <div className="space-y-6">
             <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold py-3 px-4 rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-70"
             >
                {loading ? (
                    <Loader2 size={24} className="animate-spin text-indigo-600" />
                ) : (
                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-6 h-6" alt="Google" />
                )}
                <span>{loading ? 'Connecting...' : 'Continue with Google'}</span>
             </button>

             {loading && (
                 <div className="flex items-center justify-center gap-2 text-xs text-indigo-600 font-medium animate-pulse">
                     <Database size={14} />
                     {status}
                 </div>
             )}

             {error && (
                <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm font-medium text-center border border-red-100 flex items-center gap-2 justify-center">
                    <AlertTriangle size={16} /> {error}
                </div>
             )}
          </div>
        </div>
        
        <div className="text-center mt-8 text-xs font-medium text-gray-400">
           Noor POS System v1.5
        </div>
      </div>
    </div>
  );
};