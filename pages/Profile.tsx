import React, { useEffect, useState, useRef } from 'react';
import { User } from '../types';
import { Card, Button, Input, Modal } from '../components/UI';
import { User as UserIcon, LogOut, Shield, Download, Upload, TriangleAlert, Cloud, ChevronRight, Clock, Database, Loader2, Sparkles, Lock, Settings } from 'lucide-react';
import { StoreService } from '../services/storeService';

interface ProfileProps {
  user: User | null;
  onLogin: (user: User) => void;
  onLogout: () => void;
}

export const Profile: React.FC<ProfileProps> = ({ user, onLogin, onLogout }) => {
  // --- Auth State ---
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authLoading, setAuthLoading] = useState(false);
  const [isFirstRun, setIsFirstRun] = useState(false);
  const [authError, setAuthError] = useState('');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');

  // --- Profile/Settings State ---
  const [dbStatus, setDbStatus] = useState<'cloud' | 'local'>('local');
  const [isSyncing, setIsSyncing] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  
  // Account Modal State
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountType, setAccountType] = useState<'system' | 'custom'>('system');
  const [customCreds, setCustomCreds] = useState({ email: '', key: '' });
  const [currentAccountLabel, setCurrentAccountLabel] = useState('System Default');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkUsers();
    if (user) {
        checkStatus();
        loadAccountInfo();
        const lastTime = StoreService.getLastBackupTime();
        if (lastTime) setLastBackup(new Date(lastTime).toLocaleString());
    }
  }, [user]);

  const checkUsers = async () => {
    const hasUsers = await StoreService.hasUsers();
    if (!hasUsers) {
      setAuthMode('register');
      setIsFirstRun(true);
    }
  };

  const checkStatus = () => {
    const enabled = StoreService.isCloudEnabled();
    setDbStatus(enabled ? 'cloud' : 'local');
  };

  const loadAccountInfo = () => {
      const config = StoreService.getCloudConfig();
      if (config) {
          setAccountType('custom');
          setCustomCreds(config);
          setCurrentAccountLabel(config.email);
      } else {
          setAccountType('system');
          setCustomCreds({ email: '', key: '' });
          setCurrentAccountLabel('System Default');
      }
  };

  // --- Auth Handlers ---
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      if (authMode === 'login') {
        const authenticatedUser = await StoreService.authenticate(username, pin);
        if (authenticatedUser) {
          onLogin(authenticatedUser);
          setUsername('');
          setPin('');
        } else {
          setAuthError('Invalid username or PIN');
        }
      } else {
        if (pin.length < 4) {
             setAuthError('PIN must be at least 4 digits');
             setAuthLoading(false);
             return;
        }
        const newUser = await StoreService.registerUser({
          username,
          pin,
          name: name || username,
          role: isFirstRun ? 'admin' : 'staff'
        });
        onLogin(newUser);
        setIsFirstRun(false);
      }
    } catch (err: any) {
      setAuthError(err.message || "Authentication failed");
    } finally {
      setAuthLoading(false);
    }
  };

  // --- Profile Handlers ---
  const handleExport = async () => {
      const data = await StoreService.getRawData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `noor_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleImportClick = () => {
      fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = async (e) => {
          try {
              const json = JSON.parse(e.target?.result as string);
              if (confirm("This will overwrite all current store data with the backup file. Are you sure?")) {
                   await StoreService.importData(json);
              }
          } catch (err) {
              alert("Failed to parse backup file. Invalid JSON.");
          }
      };
      reader.readAsText(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleBackupNow = async () => {
      setIsSyncing(true);
      await StoreService.saveData(); 
      setTimeout(() => {
          setIsSyncing(false);
          const lastTime = StoreService.getLastBackupTime();
          if (lastTime) setLastBackup(new Date(lastTime).toLocaleString());
      }, 1500);
  };

  // Toggle switch handler
  const handleToggleSwitch = async () => {
      if (dbStatus === 'local') {
          // Enable
          StoreService.enableCloud();
          setDbStatus('cloud');
          // Try loading immediately
          await StoreService.loadData();
      } else {
          // Disable
          if (confirm("Stop backing up to Google Drive?")) {
              StoreService.disconnectCloud();
              setDbStatus('local');
          }
      }
  };

  const handleSaveAccount = () => {
      if (accountType === 'system') {
          StoreService.clearCloudConfig();
          setCurrentAccountLabel('System Default');
      } else {
          if (!customCreds.email || !customCreds.key) {
              alert("Please enter both Service Account Email and Private Key");
              return;
          }
          StoreService.setCloudConfig(customCreds.email, customCreds.key);
          setCurrentAccountLabel(customCreds.email);
      }
      
      // Auto-enable cloud if we change account settings
      StoreService.enableCloud();
      setDbStatus('cloud');
      setShowAccountModal(false);
      
      // Try fetching to verify/load
      StoreService.loadData().then(() => {
          const lastTime = StoreService.getLastBackupTime();
          if (lastTime) setLastBackup(new Date(lastTime).toLocaleString());
      }).catch(() => {
          alert("Could not connect with these settings.");
      });
  };

  const handleReset = async () => {
      await StoreService.factoryReset();
      onLogout();
  };

  // --- RENDER: Not Logged In ---
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in">
         <div className="w-full max-w-[400px]">
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 mb-4">
                    <Sparkles size={32} />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Welcome to Noor</h1>
                <p className="text-gray-500 mt-2 font-medium">Please sign in to access your profile.</p>
            </div>

            <Card className="!p-8 shadow-xl border-gray-100">
                <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">
                    {authMode === 'login' ? 'Sign In' : (isFirstRun ? 'Setup Admin' : 'Staff Register')}
                </h2>
                <form onSubmit={handleAuth} className="space-y-5">
                    {authMode === 'register' && (
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
                    {authError && (
                    <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm font-medium text-center border border-red-100">
                        {authError}
                    </div>
                    )}
                    <Button type="submit" className="w-full py-3.5 flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20 text-base" disabled={authLoading}>
                    {authLoading && <Loader2 className="animate-spin mr-2" size={20}/>}
                    {authMode === 'login' ? 'Access Profile' : 'Create Account'}
                    </Button>
                </form>
                {!isFirstRun && (
                    <div className="mt-8 text-center pt-6 border-t border-gray-50">
                    <button 
                        onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(''); }}
                        className="text-sm text-indigo-600 hover:text-indigo-800 font-semibold flex items-center justify-center gap-1 mx-auto transition-colors"
                    >
                        {authMode === 'login' ? 'Register New Staff' : 'Back to Login'} 
                        <ChevronRight size={14} strokeWidth={2.5}/>
                    </button>
                    </div>
                )}
            </Card>
         </div>
      </div>
    );
  }

  // --- RENDER: Logged In ---
  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24 animate-in fade-in">
        
        {/* User Card */}
        <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
            <div className="absolute top-0 right-0 p-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-2xl"></div>
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 p-2">
                <div className="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border-2 border-white/30 shadow-inner">
                    <UserIcon size={40} className="text-white" />
                </div>
                <div className="text-center md:text-left">
                    <h2 className="text-3xl font-bold">{user.name}</h2>
                    <p className="text-blue-100 mb-3">@{user.username}</p>
                    <div className="flex gap-2 justify-center md:justify-start">
                        <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                            <Shield size={12}/> {user.role}
                        </span>
                    </div>
                </div>
            </div>
        </Card>

        {/* WhatsApp Style Google Drive Backup */}
        <Card className="overflow-hidden border-0 shadow-sm">
            <div className="bg-gray-50/50 p-4 border-b border-gray-100 flex items-center gap-3">
                <div className="bg-white p-2 rounded-full border border-gray-100 shadow-sm text-gray-600">
                    <Database size={20} />
                </div>
                <div>
                    <h3 className="font-bold text-gray-800">Chat & Store Backup</h3>
                    <p className="text-xs text-gray-500">Back up your products and history to Google Drive.</p>
                </div>
            </div>

            <div className="p-0">
                {/* Last Backup Status */}
                <div className="p-4 flex items-start gap-4 border-b border-gray-50">
                     <div className="mt-1 text-gray-400">
                        <Clock size={20} />
                     </div>
                     <div className="flex-1">
                        <div className="text-sm font-medium text-gray-800">Last Backup</div>
                        <div className="text-sm text-gray-500 mt-1">{lastBackup || 'Never'}</div>
                     </div>
                </div>

                {/* Main Action Area */}
                <div className="p-4 space-y-4">
                     <Button 
                        onClick={handleBackupNow}
                        disabled={dbStatus === 'local' || isSyncing}
                        className={`w-full py-3 flex items-center justify-center gap-2 rounded-lg font-bold shadow-md transition-all ${dbStatus === 'local' ? 'bg-gray-200 text-gray-400 shadow-none cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white shadow-green-200'}`}
                     >
                        {isSyncing ? <Loader2 size={18} className="animate-spin" /> : 'Back Up'}
                     </Button>
                     <p className="text-xs text-gray-400 text-center px-4">
                        Back up your data to Google Drive. You can restore them when you reinstall Noor.
                     </p>
                </div>

                {/* Settings Rows */}
                <div className="border-t border-gray-100">
                    {/* Toggle Row */}
                    <div className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                        <div className="text-sm font-bold text-gray-800">Back up to Google Drive</div>
                        <button 
                            onClick={handleToggleSwitch}
                            className={`w-12 h-6 rounded-full transition-colors relative ${dbStatus === 'cloud' ? 'bg-green-500' : 'bg-gray-300'}`}
                        >
                             <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${dbStatus === 'cloud' ? 'translate-x-7' : 'translate-x-1'}`}></div>
                        </button>
                    </div>

                    {/* Account Selection Row */}
                    <div 
                        className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between cursor-pointer border-t border-gray-100" 
                        onClick={() => setShowAccountModal(true)}
                    >
                         <div className="flex items-center gap-4">
                            <div className="text-gray-400"><Cloud size={20} /></div>
                            <div>
                                <div className="text-sm font-bold text-gray-800">Google Account</div>
                                <div className="text-sm text-gray-500 truncate max-w-[200px]">
                                    {currentAccountLabel}
                                </div>
                            </div>
                         </div>
                         <ChevronRight size={18} className="text-gray-400" />
                    </div>
                </div>
            </div>
        </Card>

        {/* Local Data Management (Advanced) */}
        <div className="pt-4">
            <h3 className="font-bold text-gray-400 text-xs uppercase tracking-wider mb-3 px-2">Advanced Storage</h3>
            <Card>
                <button 
                    onClick={handleExport}
                    className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors group text-left border-b border-gray-50 last:border-0"
                >
                    <div className="flex items-center gap-3">
                        <Download size={18} className="text-gray-400 group-hover:text-blue-500"/>
                        <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">Export Backup (JSON)</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-300"/>
                </button>

                <button 
                    onClick={handleImportClick}
                    className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors group text-left"
                >
                    <div className="flex items-center gap-3">
                        <Upload size={18} className="text-gray-400 group-hover:text-indigo-500"/>
                        <span className="text-sm font-medium text-gray-700 group-hover:text-indigo-700">Import Backup (JSON)</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-300"/>
                </button>
            </Card>

            <div className="mt-8 flex justify-center">
                 <button onClick={() => setShowResetConfirm(true)} className="text-xs text-red-400 hover:text-red-600 font-medium flex items-center gap-1 px-4 py-2 hover:bg-red-50 rounded-lg transition-colors">
                     <TriangleAlert size={14}/> Factory Reset App
                 </button>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
        </div>

        <Button 
            variant="neutral" 
            className="w-full py-4 flex items-center justify-center gap-2 mt-4 text-red-500 hover:text-red-600 hover:bg-red-50 border-red-100"
            onClick={onLogout}
        >
            <LogOut size={20}/> Sign Out
        </Button>

        {/* Modal: Account Selection */}
        <Modal isOpen={showAccountModal} onClose={() => setShowAccountModal(false)} title="Google Account">
            <div className="space-y-4">
                <div 
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${accountType === 'system' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
                    onClick={() => setAccountType('system')}
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${accountType === 'system' ? 'border-blue-500' : 'border-gray-400'}`}>
                            {accountType === 'system' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                        </div>
                        <div>
                            <div className="font-bold text-gray-800">System Default</div>
                            <div className="text-xs text-gray-500">Use pre-configured server account</div>
                        </div>
                    </div>
                </div>

                <div 
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${accountType === 'custom' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
                    onClick={() => setAccountType('custom')}
                >
                     <div className="flex items-center gap-3 mb-2">
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${accountType === 'custom' ? 'border-blue-500' : 'border-gray-400'}`}>
                            {accountType === 'custom' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                        </div>
                        <div>
                            <div className="font-bold text-gray-800">Custom Service Account</div>
                            <div className="text-xs text-gray-500">Use your own Drive Service Account</div>
                        </div>
                    </div>
                    
                    {accountType === 'custom' && (
                        <div className="space-y-3 pl-7 mt-2 animate-in fade-in">
                            <Input 
                                placeholder="Service Account Email" 
                                value={customCreds.email}
                                onChange={(e) => setCustomCreds({...customCreds, email: e.target.value})}
                                className="text-sm"
                            />
                            <textarea 
                                placeholder="Private Key (Begin with -----BEGIN PRIVATE KEY-----)" 
                                value={customCreds.key}
                                onChange={(e) => setCustomCreds({...customCreds, key: e.target.value})}
                                className="w-full rounded-lg px-4 py-2 text-sm bg-white border border-gray-200 focus:border-blue-500 outline-none h-24"
                            />
                        </div>
                    )}
                </div>

                <Button className="w-full mt-4" onClick={handleSaveAccount}>
                    Save Account
                </Button>
            </div>
        </Modal>

        {/* Modal: Factory Reset */}
        <Modal 
            isOpen={showResetConfirm} 
            onClose={() => setShowResetConfirm(false)} 
            title="Factory Reset"
        >
            <div className="text-center">
                <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <TriangleAlert size={32}/>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Everything?</h3>
                <p className="text-sm text-gray-600 mb-6">
                    This will wipe all products, sales, and customer data. This action cannot be undone unless you have a backup.
                </p>
                <div className="flex gap-3">
                    <Button variant="neutral" className="flex-1" onClick={() => setShowResetConfirm(false)}>Cancel</Button>
                    <Button variant="danger" className="flex-1" onClick={handleReset}>Yes, Reset</Button>
                </div>
            </div>
        </Modal>

        <div className="text-center text-xs text-gray-400 pt-8 pb-4">Noor POS v1.3.0</div>
    </div>
  );
};