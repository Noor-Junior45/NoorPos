
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { Input } from '../components/UI';
import { GoogleDriveUtils } from '../utils/googleDrive';
import { Loader2, Database, AlertTriangle, User as UserIcon, CheckCircle2, ExternalLink, ShieldCheck } from 'lucide-react';

interface AuthProps {
  onLogin: (user: User) => void;
}

// Use 'any' cast for the custom element to bypass IntrinsicElements check robustly
const AmpAd = 'amp-ad' as any;

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [apiErrorLink, setApiErrorLink] = useState<string | null>(null);
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
    setApiErrorLink(null);
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
      let link = null;

      if (err?.error === 'popup_closed_by_user') {
          msg = "Login cancelled. Popup closed.";
      } else if (err?.error === 'access_denied') {
          msg = "Access denied. Permissions required.";
      } else if (err?.message) {
          msg = err.message;

          // Check for API disabled error
          if (msg.includes("Google Sheets API") && (msg.includes("disabled") || msg.includes("not been used"))) {
             msg = "Google Sheets API is not enabled for this Project/Client ID.";
             // Try to extract the link provided by Google
             const urlRegex = /(https?:\/\/[^\s]+)/g;
             const matches = err.message.match(urlRegex);
             if (matches && matches[0]) {
                 link = matches[0];
             } else {
                 link = "https://console.developers.google.com/apis/library/sheets.googleapis.com";
             }
          }
      }
      
      setError(msg);
      setApiErrorLink(link);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#f8fafc]">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[420px] animate-in fade-in zoom-in duration-500">
          
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
                  <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm font-medium text-center border border-red-100 flex flex-col items-center gap-2 justify-center">
                      <div className="flex items-center gap-2"><AlertTriangle size={16} /> {error}</div>
                      {apiErrorLink && (
                          <a 
                              href={apiErrorLink} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="mt-1 flex items-center gap-1 text-xs font-bold text-red-700 underline hover:text-red-900 bg-red-100 px-3 py-1.5 rounded-lg"
                          >
                              <ExternalLink size={12} /> Enable Google Sheets API
                          </a>
                      )}
                  </div>
              )}
            </div>
          </div>

          {/* Links Section */}
          <div className="text-center mt-8">
              <div className="flex items-center justify-center gap-4 text-xs font-bold text-gray-500">
                  <a 
                      href="/privacy.html" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="hover:text-indigo-600 flex items-center gap-1 transition-colors"
                  >
                      <ShieldCheck size={14} /> Privacy Policy
                  </a>
                  <span className="text-gray-300">•</span>
                  <a 
                      href="https://terms-conditions-store.vercel.app" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="hover:text-indigo-600 transition-colors"
                  >
                      Terms of Service
                  </a>
              </div>
          </div>
          
          <div className="text-center mt-4 text-[10px] font-medium text-gray-400">
            Noor POS System v1.6
          </div>
        </div>
      </div>

      {/* Ad Unit (AMP) */}
      <div className="w-full flex justify-center mt-4 pb-2">
          <AmpAd width="100vw" height="320"
                type="adsense"
                data-ad-client="ca-pub-5865716270182311"
                data-ad-slot="4491985099"
                data-auto-format="rspv"
                data-full-width="">
            {/* Using spread with any cast to bypass detailed prop check for 'overflow' */}
            <div {...{ overflow: "" } as any}></div>
          </AmpAd>
      </div>
    </div>
  );
};
