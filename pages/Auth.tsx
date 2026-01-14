import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { Input } from '../components/UI';
import { GoogleDriveUtils } from '../utils/googleDrive';
import { Sparkles, Loader2, Database, AlertTriangle, User as UserIcon, CheckCircle2 } from 'lucide-react';

interface AuthProps {
  onLogin: (user: User) => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [isGoogleReady, setIsGoogleReady] = useState(false);

  // Use VITE_GOOGLE_CLIENT_ID from environment
  const CLIENT_ID = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';

  useEffect(() => {
    // Check if Google Script is loaded
    const checkGoogle = setInterval(() => {
        if ((window as any).google?.accounts?.oauth2) {
            setIsGoogleReady(true);
            clearInterval(checkGoogle);
        }
    }, 500);
    return () => clearInterval(checkGoogle);
  }, []);

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

  const handleGuestLogin = () => {
    // Guest User for Local/Server Mode
    const guestUser: User = {
      id: 'guest',
      username: 'guest',
      name: 'Guest User',
      role: 'admin',
      pin: '0000'
    };
    onLogin(guestUser);
  };

  const handleGoogleLogin = async () => {
    if (!CLIENT_ID) {
        setError("Missing Client ID in env variables. Use Guest Mode.");
        return;
    }

    if (!isGoogleReady) {
        setError("Google Service not ready. Check internet or ad-blockers.");
        return;
    }

    setLoading(true);
    setError('');
    setStatus('Initializing Login...');

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
      console.error("Auth Error:", err);
      setLoading(false);
      
      let msg = "Login failed.";
      if (err?.error === 'popup_closed_by_user') {
          msg = "Login cancelled. Popup closed.";
      } else if (err?.error === 'access_denied') {
          msg = "Access denied. Permissions required.";
      } else if (err?.message) {
          msg = err.message;
      }
      
      setError(msg);
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
              <h2 className="text-xl font-bold text-gray-800">Welcome</h2>
              <p className="text-sm text-gray-400 mt-1">Choose how you want to store your data.</p>
          </div>

          <div className="space-y-4">
             {/* Google Login */}
             <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className={`w-full flex items-center justify-center gap-3 border border-gray-300 font-bold py-3 px-4 rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-70
                    ${isGoogleReady ? 'bg-white hover:bg-gray-50 text-gray-700' : 'bg-gray-50 text-gray-400 cursor-not-allowed'}
                `}
             >
                {loading ? (
                    <Loader2 size={24} className="animate-spin text-indigo-600" />
                ) : (
                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-6 h-6" alt="Google" />
                )}
                <span>{loading ? 'Connecting...' : 'Continue with Google'}</span>
             </button>

             {!isGoogleReady && !loading && (
                 <p className="text-[10px] text-center text-gray-400">Loading Google Services...</p>
             )}

             <div className="relative py-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
                <div className="relative flex justify-center text-xs"><span className="px-2 bg-white text-gray-400">OR</span></div>
             </div>

             {/* Guest Mode */}
             <button
                onClick={handleGuestLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 text-indigo-700 font-bold py-3 px-4 rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-70"
             >
                <UserIcon size={20} />
                <span>Guest / Local Server Mode</span>
             </button>

             {loading && (
                 <div className="flex items-center justify-center gap-2 text-xs text-indigo-600 font-medium animate-pulse pt-2">
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