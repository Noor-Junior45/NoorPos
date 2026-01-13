import React, { useEffect, useState, useRef } from 'react';
import { User } from '../types';
import { Card, Button, Input, Modal } from '../components/UI';
import { User as UserIcon, LogOut, Shield, Database, Cloud, Wifi, WifiOff, HardDrive, Download, Upload, RefreshCw, AlertTriangle, Key, Link2, CheckCircle, X, Save, Lock, Sparkles, ChevronRight, Loader2 } from 'lucide-react';
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
  
  // Cloud Connection Modal State
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [cloudCreds, setCloudCreds] = useState({ email: '', key: '' });
  const [cloudError, setCloudError] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check if system has any users to determine if first run
    checkUsers();
    
    if (user) {
        checkStatus();
        // Load existing config into form if available (masked)
        const existing = StoreService.getCloudConfig();
        if (existing) {
            setCloudCreds({ email: existing.email, key: '●●●●●●●●●●●●●●●●' });
        }
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
    // Only check cloud status if configured, otherwise default to local
    const config = StoreService.getCloudConfig();
    if (!config) {
        setDbStatus('local');
        return;
    }

    StoreService.loadData().then(() => {
        setDbStatus('cloud');
    }).catch(() => {
        setDbStatus('local');
    });
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
          // Reset form
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

  const handleManualSync = async () => {
      setIsSyncing(true);
      await StoreService.saveData(); 
      setTimeout(() => {
          setIsSyncing(false);
          checkStatus();
          alert("Sync triggered successfully.");
      }, 1500);
  };

  const handleSaveCloudConfig = async () => {
    setCloudError('');
    if (!cloudCreds.email || !cloudCreds.key) {
        setCloudError("Please enter both Service Account Email and Private Key.");
        return;
    }

    let keyToSave = cloudCreds.key;
    if (keyToSave.includes('●')) {
        const existing = StoreService.getCloudConfig();
        if (existing) keyToSave = existing.key;
    }

    StoreService.setCloudConfig(cloudCreds.email, keyToSave);
    
    setIsSyncing(true);
    try {
        await StoreService.loadData(); 
        setDbStatus('cloud');
        setShowConnectModal(false);
        alert("Connected successfully! Data is now syncing.");
    } catch (e) {
        setCloudError("Connection failed. Check your credentials.");
        StoreService.disconnectCloud(); 
        setDbStatus('local');
    } finally {
        setIsSyncing(false);
    }
  };

  const handleDisconnect = () => {
      if(confirm("Disconnect from Google Drive? You will switch to offline mode.")) {
          StoreService.disconnectCloud();
          setDbStatus('local');
          setCloudCreds({ email: '', key: '' });
      }
  };

  const handleReset = async () => {
      await StoreService.factoryReset();
      onLogout(); // Log out after reset
  };

  // --- RENDER: Not Logged In (Auth Form) ---
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

  // --- RENDER: Logged In (Profile Dashboard) ---
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
                        <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                            PIN: ••••
                        </span>
                    </div>
                </div>
            </div>
        </Card>

        {/* Cloud Storage Status */}
        <Card>
            <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <Database size={20} className="text-gray-500"/> Cloud Backup
                </h3>
                {dbStatus === 'cloud' && (
                     <div className="flex gap-2">
                        <button 
                            onClick={handleManualSync} 
                            disabled={isSyncing}
                            className="text-xs flex items-center gap-1 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors font-medium"
                        >
                            <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""}/> {isSyncing ? "Syncing..." : "Sync Now"}
                        </button>
                    </div>
                )}
            </div>
            
            <div className={`p-4 rounded-xl border flex items-center gap-4 ${dbStatus === 'cloud' ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${dbStatus === 'cloud' ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'}`}>
                    {dbStatus === 'cloud' ? <Cloud size={24}/> : <WifiOff size={24}/>}
                </div>
                <div className="flex-1">
                    <h4 className={`font-bold ${dbStatus === 'cloud' ? 'text-green-800' : 'text-gray-700'}`}>
                        {dbStatus === 'cloud' ? 'Google Drive Linked' : 'Offline Mode'}
                    </h4>
                    <p className="text-xs text-gray-600 mt-1">
                        {dbStatus === 'cloud' 
                            ? `Connected to ${cloudCreds.email}` 
                            : 'Data is stored locally. Link Google Drive to sync across devices.'}
                    </p>
                </div>
                <div>
                     {dbStatus === 'cloud' ? (
                        <Button size="sm" variant="danger" onClick={handleDisconnect} className="!px-3 !py-1 text-xs">Disconnect</Button>
                     ) : (
                        <Button size="sm" onClick={() => setShowConnectModal(true)} className="!px-3 !py-1 text-xs flex items-center gap-1">
                            <Link2 size={12}/> Link Drive
                        </Button>
                     )}
                </div>
            </div>
        </Card>

        {/* Local Data Management */}
        <Card>
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Save size={20} className="text-gray-500"/> Local Data
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button 
                    onClick={handleExport}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-all group text-left"
                >
                    <div>
                        <div className="font-bold text-gray-700 group-hover:text-blue-700">Backup to File</div>
                        <div className="text-xs text-gray-400 mt-1">Download JSON</div>
                    </div>
                    <Download size={24} className="text-gray-300 group-hover:text-blue-500"/>
                </button>

                <button 
                    onClick={handleImportClick}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-all group text-left"
                >
                    <div>
                        <div className="font-bold text-gray-700 group-hover:text-indigo-700">Restore from File</div>
                        <div className="text-xs text-gray-400 mt-1">Upload JSON</div>
                    </div>
                    <Upload size={24} className="text-gray-300 group-hover:text-indigo-500"/>
                </button>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-100">
                <button 
                    onClick={() => setShowResetConfirm(true)}
                    className="w-full text-center text-xs text-red-500 hover:text-red-700 hover:underline flex items-center justify-center gap-1"
                >
                    <AlertTriangle size={12}/> Factory Reset App Data
                </button>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
        </Card>

        <Button 
            variant="danger" 
            className="w-full py-4 flex items-center justify-center gap-2 shadow-lg shadow-red-500/10"
            onClick={onLogout}
        >
            <LogOut size={20}/> Sign Out
        </Button>

        {/* Modal: Connect Google Drive */}
        <Modal 
            isOpen={showConnectModal} 
            onClose={() => setShowConnectModal(false)} 
            title="Link Google Drive"
        >
            <div className="space-y-4">
                <div className="bg-blue-50 p-3 rounded-lg flex gap-3 text-sm text-blue-800 mb-4">
                    <Cloud className="shrink-0 mt-0.5" size={18}/>
                    <p>Enter your Service Account credentials to enable cloud sync.</p>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Service Account Email</label>
                    <Input 
                        placeholder="service-account@project.iam.gserviceaccount.com"
                        value={cloudCreds.email}
                        onChange={(e) => setCloudCreds({...cloudCreds, email: e.target.value})}
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Private Key</label>
                    <textarea 
                        className="w-full rounded-lg px-4 py-2.5 text-base bg-gray-50 border-2 border-gray-200 text-gray-900 focus:outline-none focus:border-blue-500 h-24 text-xs font-mono"
                        placeholder="-----BEGIN PRIVATE KEY----- ..."
                        value={cloudCreds.key}
                        onChange={(e) => setCloudCreds({...cloudCreds, key: e.target.value})}
                    />
                </div>

                {cloudError && (
                    <div className="text-red-500 text-sm font-medium bg-red-50 p-2 rounded">{cloudError}</div>
                )}

                <Button onClick={handleSaveCloudConfig} disabled={isSyncing} className="w-full">
                    {isSyncing ? 'Connecting...' : 'Save & Connect'}
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
                    <AlertTriangle size={32}/>
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

        <div className="text-center text-xs text-gray-400 pt-8">Noor POS v1.3.0</div>
    </div>
  );
};