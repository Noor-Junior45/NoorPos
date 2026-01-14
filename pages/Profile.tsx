import React, { useEffect, useState, useRef } from 'react';
import { User, StoreSettings } from '../types';
import { Card, Button, Input, Modal } from '../components/UI';
import { User as UserIcon, LogOut, Shield, Download, Upload, AlertTriangle, Cloud, ChevronRight, Clock, Database, Loader2, Sparkles, Lock, Settings, Store, Phone, MapPin, Mail, Bell, CheckSquare, Save } from 'lucide-react';
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
  
  // Store Settings State
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [tempProfile, setTempProfile] = useState<Partial<StoreSettings>>({});

  // Notification State
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  // Account Modal State
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [customCreds, setCustomCreds] = useState({ email: '', key: '' });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkUsers();
    if (user) {
        checkStatus();
        loadSettings();
        const lastTime = StoreService.getLastBackupTime();
        if (lastTime) setLastBackup(new Date(lastTime).toLocaleString());
        
        if ('Notification' in window) {
            setNotificationPermission(Notification.permission);
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

  const loadSettings = async () => {
      const s = await StoreService.getSettings();
      setStoreSettings(s);
      
      const config = StoreService.getCloudConfig();
      if (config) {
          setCustomCreds(config);
      }
  };

  const checkStatus = () => {
    const enabled = StoreService.isCloudEnabled();
    setDbStatus(enabled ? 'cloud' : 'local');
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

  // --- Profile Editing ---
  const handleStartEdit = () => {
      if (storeSettings) {
          setTempProfile({
              storeName: storeSettings.storeName,
              storeAddress: storeSettings.storeAddress,
              storePhone: storeSettings.storePhone,
              storeEmail: storeSettings.storeEmail
          });
          setIsEditingProfile(true);
      }
  };

  const handleSaveProfile = async () => {
      if (!storeSettings) return;
      const newSettings = { ...storeSettings, ...tempProfile };
      await StoreService.saveSettings(newSettings);
      setStoreSettings(newSettings);
      setIsEditingProfile(false);
  };

  // --- Notifications ---
  const handleToggleNotifications = async () => {
      if (!('Notification' in window)) {
          alert("This browser does not support desktop notifications");
          return;
      }

      if (notificationPermission !== 'granted') {
          const permission = await Notification.requestPermission();
          setNotificationPermission(permission);
          if (permission === 'granted' && storeSettings) {
              const newSettings = { ...storeSettings, notificationsEnabled: true };
              await StoreService.saveSettings(newSettings);
              setStoreSettings(newSettings);
              new Notification("Noor POS", { body: "Notifications enabled successfully!" });
          }
      } else {
          // If already granted, user is toggling logic in app
          if (storeSettings) {
              const newStatus = !storeSettings.notificationsEnabled;
              const newSettings = { ...storeSettings, notificationsEnabled: newStatus };
              await StoreService.saveSettings(newSettings);
              setStoreSettings(newSettings);
          }
      }
  };

  // --- Cloud Logic ---
  const handleSaveAccount = () => {
      if (!customCreds.email || !customCreds.key) {
          alert("Please enter both Service Account Email and Private Key");
          return;
      }
      StoreService.setCloudConfig(customCreds.email, customCreds.key);
      
      // Auto-enable cloud
      StoreService.enableCloud();
      setDbStatus('cloud');
      setShowAccountModal(false);
      
      // Try fetching to verify/load
      StoreService.loadData().then(() => {
          const lastTime = StoreService.getLastBackupTime();
          if (lastTime) setLastBackup(new Date(lastTime).toLocaleString());
          alert("Drive Linked Successfully!");
      }).catch(() => {
          alert("Could not connect with these settings. Please check credentials.");
      });
  };

  const handleDisconnectDrive = () => {
      if (confirm("Disconnect Google Drive? Your local data will remain safe.")) {
          StoreService.disconnectCloud();
          StoreService.clearCloudConfig();
          setDbStatus('local');
          setCustomCreds({ email: '', key: '' });
      }
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

  // --- Export/Import ---
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

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (e) => {
          try {
              const json = JSON.parse(e.target?.result as string);
              if (confirm("Overwrite data with backup?")) {
                   await StoreService.importData(json);
              }
          } catch (err) { alert("Invalid backup file."); }
      };
      reader.readAsText(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleReset = async () => {
      await StoreService.factoryReset();
      onLogout();
  };

  // --- RENDER: Login Screen ---
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
                            <Input className="!pl-10 !bg-white !border-gray-200 focus:!border-indigo-500 !rounded-xl !py-3" placeholder="e.g. John Doe" value={name} onChange={e => setName(e.target.value)} required />
                        </div>
                    </div>
                    )}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Username</label>
                        <div className="relative">
                            <UserIcon size={18} className="absolute left-3.5 top-3.5 text-gray-400"/>
                            <Input className="!pl-10 !bg-white !border-gray-200 focus:!border-indigo-500 !rounded-xl !py-3" placeholder="e.g. admin" value={username} onChange={e => setUsername(e.target.value)} required />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">PIN Code</label>
                        <div className="relative">
                            <Lock size={18} className="absolute left-3.5 top-3.5 text-gray-400"/>
                            <Input type="password" className="!pl-10 font-mono tracking-widest !bg-white !border-gray-200 focus:!border-indigo-500 !rounded-xl !py-3" placeholder="••••" value={pin} onChange={e => setPin(e.target.value)} required maxLength={8} />
                        </div>
                    </div>
                    {authError && <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm font-medium text-center border border-red-100">{authError}</div>}
                    <Button type="submit" className="w-full py-3.5 flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20 text-base" disabled={authLoading}>
                        {authLoading && <Loader2 className="animate-spin mr-2" size={20}/>}
                        {authMode === 'login' ? 'Access Profile' : 'Create Account'}
                    </Button>
                </form>
                {!isFirstRun && (
                    <div className="mt-8 text-center pt-6 border-t border-gray-50">
                    <button onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(''); }} className="text-sm text-indigo-600 hover:text-indigo-800 font-semibold flex items-center justify-center gap-1 mx-auto transition-colors">
                        {authMode === 'login' ? 'Register New Staff' : 'Back to Login'} <ChevronRight size={14} strokeWidth={2.5}/>
                    </button>
                    </div>
                )}
            </Card>
         </div>
      </div>
    );
  }

  // --- RENDER: Logged In (Redesigned) ---
  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-32 animate-in fade-in">
        
        {/* 1. Profile Header */}
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                    {user.name.charAt(0)}
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{user.name}</h1>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>@{user.username}</span>
                        <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                        <span className="uppercase text-xs font-bold bg-gray-100 px-2 py-0.5 rounded text-gray-600">{user.role}</span>
                    </div>
                </div>
            </div>
            <Button variant="neutral" onClick={onLogout} className="!px-3 !py-2 text-red-500 hover:text-red-600 hover:bg-red-50 border-red-100">
                <LogOut size={18} />
            </Button>
        </div>

        {/* 2. Store Settings */}
        <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-black/5">
            <div className="bg-gradient-to-r from-gray-50 to-white p-4 border-b border-gray-100 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Store size={20} className="text-blue-600"/>
                    <h2 className="font-bold text-gray-800">Store Profile</h2>
                </div>
                {!isEditingProfile ? (
                    <button onClick={handleStartEdit} className="text-blue-600 text-xs font-bold hover:underline">EDIT</button>
                ) : (
                    <div className="flex gap-2">
                        <button onClick={() => setIsEditingProfile(false)} className="text-gray-400 text-xs font-bold hover:text-gray-600">CANCEL</button>
                        <button onClick={handleSaveProfile} className="text-green-600 text-xs font-bold hover:text-green-700 flex items-center gap-1"><Save size={12}/> SAVE</button>
                    </div>
                )}
            </div>
            
            <div className="p-5 space-y-4">
                {isEditingProfile ? (
                    <div className="space-y-3 animate-in fade-in">
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase">Store Name</label>
                            <Input value={tempProfile.storeName} onChange={e => setTempProfile({...tempProfile, storeName: e.target.value})} className="!py-2"/>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase">Address</label>
                            <Input value={tempProfile.storeAddress} onChange={e => setTempProfile({...tempProfile, storeAddress: e.target.value})} className="!py-2"/>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase">Phone</label>
                                <Input value={tempProfile.storePhone} onChange={e => setTempProfile({...tempProfile, storePhone: e.target.value})} className="!py-2"/>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase">Email</label>
                                <Input value={tempProfile.storeEmail} onChange={e => setTempProfile({...tempProfile, storeEmail: e.target.value})} className="!py-2"/>
                            </div>
                        </div>
                        <p className="text-xs text-blue-500 bg-blue-50 p-2 rounded">These details will appear on your PDF Invoices.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div>
                            <div className="text-lg font-bold text-gray-900">{storeSettings?.storeName}</div>
                            <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                                <MapPin size={14} className="shrink-0"/> {storeSettings?.storeAddress}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-gray-50">
                            <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">
                                <Phone size={14}/> {storeSettings?.storePhone}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">
                                <Mail size={14}/> {storeSettings?.storeEmail || 'No email set'}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Card>

        {/* 3. Settings & Notifications */}
        <Card className="p-0 overflow-hidden shadow-sm ring-1 ring-black/5">
             <div className="p-4 border-b border-gray-100 font-bold text-gray-800 flex items-center gap-2">
                 <Settings size={20} className="text-gray-600"/> App Settings
             </div>
             <div className="divide-y divide-gray-100">
                 {/* Notifications Toggle */}
                 <div className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                     <div className="flex items-center gap-3">
                         <div className={`p-2 rounded-full ${storeSettings?.notificationsEnabled ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-400'}`}>
                             <Bell size={20} />
                         </div>
                         <div>
                             <div className="font-medium text-gray-900">Notifications</div>
                             <div className="text-xs text-gray-500">
                                 {storeSettings?.notificationsEnabled ? 'On (Browser & App)' : 'Off'}
                             </div>
                         </div>
                     </div>
                     <button 
                        onClick={handleToggleNotifications}
                        className={`w-12 h-6 rounded-full transition-colors relative ${storeSettings?.notificationsEnabled ? 'bg-green-500' : 'bg-gray-200'}`}
                     >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${storeSettings?.notificationsEnabled ? 'translate-x-7' : 'translate-x-1'}`}></div>
                     </button>
                 </div>
                 
                 {/* Sound Effects Toggle (Read only visual for now or hook to storeSettings same way) */}
                 <div className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                     <div className="flex items-center gap-3">
                         <div className="p-2 rounded-full bg-blue-100 text-blue-600">
                             <Sparkles size={20} />
                         </div>
                         <div className="font-medium text-gray-900">Sound Effects</div>
                     </div>
                     <div className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">ON</div>
                 </div>
             </div>
        </Card>

        {/* 4. Google Drive Sync */}
        <Card className="p-0 overflow-hidden shadow-md ring-1 ring-black/5">
            <div className="bg-white p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white border border-gray-200 rounded-xl flex items-center justify-center shadow-sm">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg" alt="Drive" className="w-7 h-7" />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 text-lg">Google Drive Backup</h3>
                        <p className="text-sm text-gray-500">
                            {dbStatus === 'cloud' ? 'Your personal server is active.' : 'Link your account to sync data.'}
                        </p>
                    </div>
                </div>
                
                {dbStatus === 'cloud' ? (
                    <div className="flex flex-col gap-2">
                        <Button onClick={handleBackupNow} className="bg-green-600 hover:bg-green-700 text-white shadow-green-200 w-full md:w-auto">
                            {isSyncing ? <Loader2 size={18} className="animate-spin"/> : 'Sync Now'}
                        </Button>
                        <button onClick={handleDisconnectDrive} className="text-xs text-red-500 hover:text-red-700 font-medium text-center">
                            Unlink Account
                        </button>
                    </div>
                ) : (
                    <Button onClick={() => setShowAccountModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200">
                        Connect Drive
                    </Button>
                )}
            </div>
            
            {dbStatus === 'cloud' && (
                <div className="bg-gray-50 px-5 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                        <CheckSquare size={12} className="text-green-500"/> Linked: {customCreds.email || 'System Default'}
                    </div>
                    <div>Last Backup: {lastBackup || 'Never'}</div>
                </div>
            )}
        </Card>

        {/* 5. Advanced Data Actions */}
        <div className="pt-4 flex flex-col gap-3">
            <h3 className="font-bold text-gray-400 text-xs uppercase tracking-wider px-2">Advanced Actions</h3>
            
            <button onClick={handleExport} className="w-full bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between group hover:border-blue-300 transition-all">
                <div className="flex items-center gap-3">
                    <Download size={20} className="text-gray-400 group-hover:text-blue-500"/>
                    <span className="font-medium text-gray-700">Export Backup File</span>
                </div>
                <ChevronRight size={18} className="text-gray-300"/>
            </button>

            <button onClick={handleImportClick} className="w-full bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between group hover:border-purple-300 transition-all">
                <div className="flex items-center gap-3">
                    <Upload size={20} className="text-gray-400 group-hover:text-purple-500"/>
                    <span className="font-medium text-gray-700">Import Backup File</span>
                </div>
                <ChevronRight size={18} className="text-gray-300"/>
            </button>

            <button onClick={() => setShowResetConfirm(true)} className="w-full bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between group hover:border-red-300 hover:bg-red-50 transition-all mt-2">
                <div className="flex items-center gap-3">
                    <AlertTriangle size={20} className="text-red-400"/>
                    <span className="font-medium text-red-600">Factory Reset App</span>
                </div>
            </button>
            
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
        </div>

        {/* --- Modals --- */}

        {/* Connect Drive Modal (Styled like OAuth Link) */}
        <Modal isOpen={showAccountModal} onClose={() => setShowAccountModal(false)} title="Link Google Drive" className="!max-w-md">
            <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg" alt="Drive" className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-gray-900 text-lg">Use Your Personal Server</h3>
                <p className="text-sm text-gray-500 mt-1 px-4">
                    Connect a Google Service Account to use your own Drive storage as a private backend server.
                </p>
            </div>

            <div className="space-y-4 text-left">
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Service Account Email</label>
                    <Input 
                        placeholder="service-account@project.iam.gserviceaccount.com" 
                        value={customCreds.email}
                        onChange={(e) => setCustomCreds({...customCreds, email: e.target.value})}
                        className="text-sm"
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Private Key</label>
                    <textarea 
                        placeholder="-----BEGIN PRIVATE KEY----- ..." 
                        value={customCreds.key}
                        onChange={(e) => setCustomCreds({...customCreds, key: e.target.value})}
                        className="w-full rounded-lg px-4 py-3 text-xs font-mono bg-gray-50 border border-gray-200 focus:border-blue-500 outline-none h-32 resize-none"
                    />
                </div>
                
                <Button className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold" onClick={handleSaveAccount}>
                    Link Account
                </Button>
                <p className="text-[10px] text-gray-400 text-center">
                    Data is encrypted and stored directly on your configured Drive.
                </p>
            </div>
        </Modal>

        <Modal isOpen={showResetConfirm} onClose={() => setShowResetConfirm(false)} title="Factory Reset">
            <div className="text-center">
                <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle size={32}/>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Are you absolutely sure?</h3>
                <p className="text-sm text-gray-600 mb-6">
                    This action will delete all products, sales history, and customer data from this device. This cannot be undone.
                </p>
                <div className="flex gap-3">
                    <Button variant="neutral" className="flex-1" onClick={() => setShowResetConfirm(false)}>Cancel</Button>
                    <Button variant="danger" className="flex-1" onClick={handleReset}>Yes, Reset</Button>
                </div>
            </div>
        </Modal>

        <div className="text-center text-xs text-gray-400 pt-8 pb-4">Noor POS v1.4.0 • Enterprise Edition</div>
    </div>
  );
};