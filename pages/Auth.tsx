
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { Input } from '../components/UI';
import { GoogleDriveUtils } from '../utils/googleDrive';
import { Loader2, Database, AlertTriangle, User as UserIcon, CheckCircle2, ExternalLink, ShieldCheck, HelpCircle } from 'lucide-react';

interface AuthProps {
  onLogin: (user: User) => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [apiErrorLink, setApiErrorLink] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [isGoogleReady, setIsGoogleReady] = useState(false);
  const [showOriginHelp, setShowOriginHelp] = useState(false);

  // New Client ID provided by user
  const CLIENT_ID = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '476350386539-t8l51erhtfmkiee2rbar7mko8jnqa8n9.apps.googleusercontent.com';

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
        setError("Missing Client ID. Please configure your Google Cloud Console.");
        return;
    }
    if (!isGoogleReady) {
        setError("Google Service not ready. Check internet or ad-blockers.");
        return;
    }
    setLoading(true);
    setError('');
    setShowOriginHelp(false);
    setApiErrorLink(null);
    setStatus('Initializing Login...');
    try {
      const accessToken = await GoogleDriveUtils.initGoogleLogin(CLIENT_ID);
      setStatus('Accessing Google Drive...');
      const sheetId = await GoogleDriveUtils.findOrCreateBackend(accessToken);
      setStatus('Syncing Database...');
      const profile = await GoogleDriveUtils.getUserProfile(accessToken);
      GoogleDriveUtils.saveSession({ accessToken, spreadsheetId: sheetId, profile });
      handleSuccess(profile);
    } catch (err: any) {
      console.error("Auth Error:", err);
      setLoading(false);
      let msg = "Login failed.";
      let link = null;
      
      // GIS library errors often come back as objects
      if (err?.error === 'popup_closed_by_user') {
          msg = "Login cancelled. Popup closed.";
      } else if (err?.error === 'access_denied') {
          msg = "Access denied. Permissions required.";
      } else if (err?.error === 'idpiframe_initialization_failed') {
          msg = "Origin Mismatch (Error 400). Authorized domains need to be set in Google Console.";
          setShowOriginHelp(true);
      } else if (err?.message) {
          msg = err.message;
          if (msg.includes("Google Sheets API") && (msg.includes("disabled") || msg.includes("not been used"))) {
             msg = "Google Sheets API is not enabled for this Project.";
             const urlRegex = /(https?:\/\/[^\s]+)/g;
             const matches = err.message.match(urlRegex);
             link = matches ? matches[0] : "https://console.developers.google.com/apis/library/sheets.googleapis.com";
          }
      }
      setError(msg);
      setApiErrorLink(link);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center bg-[#f8fafc] p-6">
        <div className="w-full max-w-[420px] mx-auto animate-in fade-in zoom-in duration-500">
          <div className="text-center mb-10">
              <img 
                  src="https://lh3.googleusercontent.com/p/AF1QipPlp0QUwcp2FOnTGiGNf5fqWnskinCj4QxRKa3o=s1360-w1360-h1020-rw" 
                  alt="Noor POS Logo" 
                  className="w-28 h-28 rounded-full shadow-2xl shadow-indigo-200 mx-auto mb-6 border-4 border-white object-cover"
              />
              <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Noor POS</h1>
              <p className="text-gray-500 mt-3 text-lg font-bold tracking-wide">Smart Store Management Tool</p>
          </div>

          <div className="bg-white rounded-3xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] p-8 border border-gray-100">
            <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">Welcome</h2>
                <p className="text-sm text-gray-400 mt-1">Choose how you want to store your data.</p>
            </div>
            <div className="space-y-4">
              <button
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className={`w-full flex items-center justify-center gap-3 border border-gray-300 font-bold py-3 px-4 rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-70 ${isGoogleReady ? 'bg-white hover:bg-gray-50 text-gray-700' : 'bg-gray-50 text-gray-400 cursor-not-allowed'}`}
              >
                  {loading ? <Loader2 size={24} className="animate-spin text-indigo-600" /> : <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-6 h-6" alt="Google" />}
                  <span>{loading ? 'Connecting...' : 'Continue with Google'}</span>
              </button>
              {!isGoogleReady && !loading && <p className="text-[10px] text-center text-gray-400">Loading Google Services...</p>}
              <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
                  <div className="relative flex justify-center text-xs"><span className="px-2 bg-white text-gray-400">OR</span></div>
              </div>
              <button
                  onClick={handleGuestLogin}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 text-indigo-700 font-bold py-3 px-4 rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-70"
              >
                  <UserIcon size={20} />
                  <span>Guest / Local Server Mode</span>
              </button>
              
              {loading && <div className="flex items-center justify-center gap-2 text-xs text-indigo-600 font-medium animate-pulse pt-2"><Database size={14} />{status}</div>}
              
              {error && (
                  <div className="p-4 rounded-2xl bg-red-50 text-red-600 text-xs font-medium border border-red-100 flex flex-col items-center gap-3">
                      <div className="flex items-start gap-2">
                          <AlertTriangle size={18} className="shrink-0 mt-0.5" /> 
                          <span>{error}</span>
                      </div>
                      
                      {showOriginHelp && (
                          <div className="bg-white/80 p-3 rounded-xl border border-red-100 text-[10px] leading-relaxed text-gray-600">
                              <strong>Fix:</strong> You must add <code>{window.location.origin}</code> to <strong>"Authorized JavaScript origins"</strong> in your Google Cloud Console.
                          </div>
                      )}

                      {apiErrorLink && (
                        <a href={apiErrorLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] font-black text-red-700 underline hover:text-red-900 bg-red-100 px-4 py-2 rounded-xl">
                          <ExternalLink size={12} /> Enable Google Sheets API
                        </a>
                      )}
                  </div>
              )}
            </div>
          </div>
          
          <div className="text-center mt-8">
              <div className="flex items-center justify-center gap-4 text-xs font-bold text-gray-500">
                  <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 flex items-center gap-1 transition-colors"><ShieldCheck size={14} /> Privacy Policy</a>
                  <span className="text-gray-300">•</span>
                  <a href="https://terms-conditions-store.vercel.app" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 transition-colors">Terms of Service</a>
              </div>
          </div>
          <div className="text-center mt-4 text-[10px] font-medium text-gray-400">Noor POS System v1.6.1</div>
        </div>
    </div>
  );
};
