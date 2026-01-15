
import React, { useEffect, useState, useRef } from 'react';
import { User, StoreSettings } from '../types';
import { Card, Button, Input, Modal } from '../components/UI';
import { LogOut, AlertTriangle, Cloud, Settings, Store, Phone, MapPin, Mail, Bell, CheckSquare, Save, Download, Upload, ChevronRight, ChevronDown, Sparkles, Server, HardDrive, Image as ImageIcon, FileText, Headphones, ExternalLink, Users, UserPlus, Loader2 } from 'lucide-react';
import { StoreService } from '../services/storeService';
import { GoogleDriveUtils } from '../utils/googleDrive';

interface ProfileProps {
  user: User | null;
  onLogin: (user: User) => void;
  onLogout: () => void;
}

export const Profile: React.FC<ProfileProps> = ({ user, onLogin, onLogout }) => {
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingNas, setIsEditingNas] = useState(false);
  const [tempProfile, setTempProfile] = useState<Partial<StoreSettings>>({});
  const [tempNas, setTempNas] = useState<{ nasUrl: string, syncToNas: boolean }>({ nasUrl: '', syncToNas: false });
  const [googleProfile, setGoogleProfile] = useState<any>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [showTermsDropdown, setShowTermsDropdown] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  
  // Staff Sharing State
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [showShareSuccess, setShowShareSuccess] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  
  // Refs
  const storeNameRef = useRef<HTMLInputElement>(null);
  const storeAddrRef = useRef<HTMLInputElement>(null);
  const storePhoneRef = useRef<HTMLInputElement>(null);
  const storeEmailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
      const s = await StoreService.getSettings();
      setStoreSettings(s);
      
      const session = GoogleDriveUtils.getSession();
      if (session) {
          setGoogleProfile(session.profile);
      }
      
      const lastTime = StoreService.getLastBackupTime();
      if (lastTime) setLastBackup(new Date(lastTime).toLocaleString());
  };

  const handleStartEdit = () => {
      if (storeSettings) {
          setTempProfile({
              storeName: storeSettings.storeName,
              storeAddress: storeSettings.storeAddress,
              storePhone: storeSettings.storePhone,
              storeEmail: storeSettings.storeEmail,
              logo: storeSettings.logo
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
  
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setTempProfile(prev => ({ ...prev, logo: reader.result as string }));
          };
          reader.readAsDataURL(file);
      }
  };

  const handleStartEditNas = () => {
      if (storeSettings) {
          setTempNas({
              nasUrl: storeSettings.nasUrl || 'http://localhost:3000/api/storage',
              syncToNas: storeSettings.syncToNas || false
          });
          setIsEditingNas(true);
      }
  };

  const handleSaveNas = async () => {
      if (!storeSettings) return;
      const newSettings = { 
          ...storeSettings, 
          nasUrl: tempNas.nasUrl,
          syncToNas: tempNas.syncToNas
      };
      await StoreService.saveSettings(newSettings);
      setStoreSettings(newSettings);
      setIsEditingNas(false);
      alert("NAS configuration saved. App will try to sync on next action.");
  };

  const handleToggleNotifications = async () => {
      if (!storeSettings) return;
      
      const newState = !storeSettings.notificationsEnabled;
      
      if (newState) {
          if (!("Notification" in window)) {
              alert("This browser does not support desktop notifications");
              return;
          }
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') {
              alert("Notification permission denied");
              return;
          }
          new Notification("Notifications Enabled", { body: "You will now receive alerts for low stock." });
      }

      const newSettings = { ...storeSettings, notificationsEnabled: newState };
      await StoreService.saveSettings(newSettings);
      setStoreSettings(newSettings);
  };
  
  const handleInviteStaff = async () => {
      if (!inviteEmail || !inviteEmail.includes('@')) {
          alert("Please enter a valid email address.");
          return;
      }
      
      const session = GoogleDriveUtils.getSession();
      if (!session) {
          alert("You must be logged in with Google to share access.");
          return;
      }

      setIsInviting(true);
      try {
          await GoogleDriveUtils.shareDatabase(session.accessToken, session.spreadsheetId, inviteEmail);
          setInviteEmail('');
          setShowShareSuccess(true);
          setTimeout(() => setShowShareSuccess(false), 3000);
      } catch (err: any) {
          console.error(err);
          alert("Failed to share: " + (err.message || "Unknown Error"));
      } finally {
          setIsInviting(false);
      }
  };

  const handleLogout = async () => {
      if (confirm("Sign out? Local data will remain, but you will need to log in again to sync.")) {
          await StoreService.logout();
      }
  };
  
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
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-32 animate-in fade-in">
        
        {/* 1. Profile Header - Updated for Mobile Layout */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4 w-full">
                {googleProfile?.picture ? (
                    <img src={googleProfile.picture} alt="Profile" className="w-16 h-16 rounded-full shadow-lg border-2 border-white shrink-0" />
                ) : (
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shrink-0">
                        {user.name.charAt(0)}
                    </div>
                )}
                <div className="min-w-0 flex-1">
                    <h1 className="text-2xl font-bold text-gray-900 truncate">{googleProfile?.name || user.name}</h1>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span className="truncate">{googleProfile?.email || user.username}</span>
                        <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-700 font-bold border border-green-200 shrink-0">Online</span>
                    </div>
                </div>
            </div>
            <Button onClick={handleLogout} variant="neutral" className="w-full md:w-auto border-red-100 text-red-600 hover:bg-red-50 flex justify-center">
                <LogOut size={18} className="mr-2 inline"/> Sign Out
            </Button>
        </div>

        {/* 2. Store Settings */}
        <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-black/5">
            <div className="bg-white p-4 border-b border-gray-100 flex justify-between items-center">
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
            
            <div className="p-5">
                {isEditingProfile ? (
                    <div className="space-y-5 animate-in fade-in">
                        {/* Logo Upload */}
                        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                             <div className="w-20 h-20 rounded-lg bg-white border border-gray-200 flex items-center justify-center overflow-hidden">
                                 {tempProfile.logo ? (
                                     <img src={tempProfile.logo} alt="Logo" className="w-full h-full object-contain" />
                                 ) : (
                                     <ImageIcon className="text-gray-300" size={32} />
                                 )}
                             </div>
                             <div>
                                 <input 
                                    type="file" 
                                    ref={logoInputRef} 
                                    onChange={handleLogoUpload} 
                                    className="hidden" 
                                    accept="image/*" 
                                 />
                                 <Button size="sm" variant="neutral" onClick={() => logoInputRef.current?.click()} className="flex items-center gap-2">
                                     <Upload size={14}/> Upload Logo
                                 </Button>
                                 <p className="text-[10px] text-gray-400 mt-2">Recommended: 200x200px (PNG/JPG)</p>
                             </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Store Name</label>
                            <Input 
                                ref={storeNameRef}
                                value={tempProfile.storeName} 
                                onChange={e => setTempProfile({...tempProfile, storeName: e.target.value})} 
                                className="!py-3 !px-4 bg-white border-2 border-indigo-100 focus:border-indigo-500 shadow-sm"
                                placeholder="Enter Store Name"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Address</label>
                            <Input 
                                ref={storeAddrRef}
                                value={tempProfile.storeAddress} 
                                onChange={e => setTempProfile({...tempProfile, storeAddress: e.target.value})} 
                                className="!py-3 !px-4 bg-white border-2 border-indigo-100 focus:border-indigo-500 shadow-sm"
                                placeholder="Enter Address"
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Phone</label>
                                <Input 
                                    ref={storePhoneRef}
                                    value={tempProfile.storePhone} 
                                    onChange={e => setTempProfile({...tempProfile, storePhone: e.target.value})} 
                                    className="!py-3 !px-4 bg-white border-2 border-indigo-100 focus:border-indigo-500 shadow-sm"
                                    placeholder="Enter Phone"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Email</label>
                                <Input 
                                    ref={storeEmailRef}
                                    value={tempProfile.storeEmail} 
                                    onChange={e => setTempProfile({...tempProfile, storeEmail: e.target.value})} 
                                    className="!py-3 !px-4 bg-white border-2 border-indigo-100 focus:border-indigo-500 shadow-sm"
                                    placeholder="Enter Email"
                                />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                         {storeSettings?.logo && (
                             <div className="mb-4 flex justify-center">
                                 <img src={storeSettings.logo} alt="Store Logo" className="h-16 object-contain" />
                             </div>
                         )}
                        <div>
                            <div className="text-lg font-bold text-gray-900">
                                {storeSettings?.storeName || <span className="text-gray-400 italic font-normal">Store Name Not Set</span>}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                                <MapPin size={14} className="shrink-0"/> 
                                {storeSettings?.storeAddress || <span className="text-gray-400 italic">Address Not Set</span>}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-gray-50">
                            <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                <Phone size={14}/> 
                                {storeSettings?.storePhone || <span className="text-gray-400 italic">Phone Not Set</span>}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                <Mail size={14}/> 
                                {storeSettings?.storeEmail || <span className="text-gray-400 italic">Email Not Set</span>}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Card>

        {/* 3. Notifications */}
        <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-black/5">
             <div className="bg-white p-4 border-b border-gray-100 flex items-center gap-2">
                 <Bell size={20} className="text-amber-500"/>
                 <h2 className="font-bold text-gray-800">Notifications</h2>
             </div>
             <div className="p-5 flex items-center justify-between">
                 <div>
                     <div className="font-semibold text-gray-800">Browser Alerts</div>
                     <p className="text-sm text-gray-500">Get notified about low stock and critical events.</p>
                 </div>
                 <button 
                    onClick={handleToggleNotifications}
                    className={`w-14 h-8 rounded-full transition-all duration-300 relative shadow-inner ${storeSettings?.notificationsEnabled ? 'bg-amber-500' : 'bg-gray-200'}`}
                 >
                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 shadow-md ${storeSettings?.notificationsEnabled ? 'translate-x-7' : 'translate-x-1'}`}></div>
                </button>
             </div>
        </Card>

        {/* 4. NAS / Local Server Configuration */}
        <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-black/5">
             <div className="bg-white p-4 border-b border-gray-100 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <HardDrive size={20} className="text-purple-600"/>
                    <h2 className="font-bold text-gray-800">NAS / Server Facility</h2>
                </div>
                {!isEditingNas ? (
                    <button onClick={handleStartEditNas} className="text-blue-600 text-xs font-bold hover:underline">CONFIGURE</button>
                ) : (
                    <div className="flex gap-2">
                        <button onClick={() => setIsEditingNas(false)} className="text-gray-400 text-xs font-bold hover:text-gray-600">CANCEL</button>
                        <button onClick={handleSaveNas} className="text-green-600 text-xs font-bold hover:text-green-700 flex items-center gap-1"><Save size={12}/> SAVE</button>
                    </div>
                )}
             </div>
             
             {isEditingNas ? (
                 <div className="p-5 space-y-4 animate-in fade-in bg-purple-50/50">
                     <div className="flex items-center gap-3 mb-2">
                         <div className="p-2 bg-purple-100 rounded-lg text-purple-700"><Server size={20}/></div>
                         <div className="text-sm text-gray-600">
                             Enable syncing to a local Network Attached Storage (NAS) or custom server URL.
                         </div>
                     </div>
                     <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">NAS / Server URL</label>
                        <Input 
                            value={tempNas.nasUrl} 
                            onChange={e => setTempNas({...tempNas, nasUrl: e.target.value})} 
                            className="!py-3 !px-4 bg-white border-2 border-purple-200 focus:border-purple-500 shadow-sm"
                            placeholder="http://192.168.1.50:3000/api/storage"
                        />
                        <p className="text-[10px] text-gray-400 mt-1 ml-1">Example: http://localhost:3000/api/storage</p>
                     </div>
                     <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-purple-100">
                         <span className="font-bold text-gray-700 text-sm">Sync Data to NAS</span>
                         <button 
                            onClick={() => setTempNas({...tempNas, syncToNas: !tempNas.syncToNas})}
                            className={`w-12 h-7 rounded-full transition-all duration-300 relative shadow-inner ${tempNas.syncToNas ? 'bg-purple-600' : 'bg-gray-200'}`}
                         >
                            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform duration-300 shadow-md ${tempNas.syncToNas ? 'translate-x-6' : 'translate-x-1'}`}></div>
                         </button>
                     </div>
                 </div>
             ) : (
                 <div className="p-5">
                     {storeSettings?.syncToNas ? (
                         <div className="flex items-center justify-between">
                             <div className="flex items-center gap-3">
                                 <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center">
                                     <Cloud size={20}/>
                                 </div>
                                 <div>
                                     <div className="font-bold text-gray-800 text-sm">NAS Active</div>
                                     <div className="text-xs text-gray-500 truncate max-w-[200px]">{storeSettings.nasUrl}</div>
                                 </div>
                             </div>
                             <div className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded border border-green-200 uppercase">Connected</div>
                         </div>
                     ) : (
                         <div className="text-sm text-gray-400 italic text-center py-2">NAS facility disabled.</div>
                     )}
                 </div>
             )}
        </Card>

        {/* 5. Staff Sharing (Moved below NAS) */}
        {googleProfile && (
            <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-black/5">
                <div className="bg-white p-4 border-b border-gray-100 flex items-center gap-2">
                    <Users size={20} className="text-indigo-600"/>
                    <h2 className="font-bold text-gray-800">Staff Access & Sharing</h2>
                </div>
                <div className="p-5">
                    <div className="mb-4">
                        <p className="text-sm text-gray-600 mb-2">Invite staff members to access this store database. They must log in with their Google Account.</p>
                    </div>
                    <div className="flex gap-2">
                        <Input 
                            placeholder="staff.member@gmail.com" 
                            value={inviteEmail} 
                            onChange={(e) => setInviteEmail(e.target.value)}
                            className="flex-1 !py-2.5"
                        />
                        <Button 
                            onClick={handleInviteStaff} 
                            disabled={isInviting || !inviteEmail}
                            className="bg-indigo-600 hover:bg-indigo-700 w-28 flex items-center justify-center"
                        >
                            {isInviting ? <Loader2 size={18} className="animate-spin" /> : <><UserPlus size={18} className="mr-2"/> Invite</>}
                        </Button>
                    </div>
                    {showShareSuccess && (
                        <div className="mt-3 p-2 bg-green-50 text-green-700 text-sm rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                            <CheckSquare size={16}/> Invitation sent successfully!
                        </div>
                    )}
                </div>
            </Card>
        )}

        {/* 6. Sync Status */}
        <Card className="p-0 overflow-hidden shadow-md ring-1 ring-black/5">
            <div className="bg-white p-5">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center shadow-sm border border-green-100">
                         <img src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg" alt="Drive" className="w-7 h-7" />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 text-lg">Database Synced</h3>
                        <p className="text-sm text-gray-500">
                           Last saved: {lastBackup || 'Just now'}
                        </p>
                    </div>
                </div>
            </div>
            <div className="bg-gray-50 px-5 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-1 font-mono">
                    <CheckSquare size={12} className="text-green-500"/> 
                    {googleProfile?.email || 'Connected'}
                </div>
                <div>StoreManager_DB</div>
            </div>
        </Card>

        {/* 7. Actions */}
        <div className="pt-4 flex flex-col gap-3">
            <h3 className="font-bold text-gray-400 text-xs uppercase tracking-wider px-2">Data Management</h3>
            
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

        {/* 8. Support & Legal */}
        <div className="pt-2 flex flex-col gap-3">
            <h3 className="font-bold text-gray-400 text-xs uppercase tracking-wider px-2">Support & Legal</h3>
            
            <div className="overflow-hidden bg-white rounded-xl border border-gray-200 shadow-sm hover:border-blue-300 transition-all">
                <button 
                    onClick={() => setShowTermsDropdown(!showTermsDropdown)} 
                    className="w-full p-4 flex items-center justify-between group bg-white"
                >
                    <div className="flex items-center gap-3">
                        <FileText size={20} className="text-gray-400 group-hover:text-blue-500"/>
                        <span className="font-medium text-gray-700">Terms & Conditions</span>
                    </div>
                    {showTermsDropdown ? <ChevronDown size={18} className="text-gray-500"/> : <ChevronRight size={18} className="text-gray-300"/>}
                </button>
                
                {showTermsDropdown && (
                    <div className="px-4 pb-4 pt-0 bg-white animate-in slide-in-from-top-2">
                        <div className="pt-3 border-t border-gray-100">
                            <p className="text-xs text-gray-400 mb-2">Read our policies:</p>
                            <a 
                                href="https://terms-conditions-store.vercel.app" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors"
                            >
                                <ExternalLink size={16} className="text-gray-500"/>
                                <span className="text-sm font-bold text-gray-800">View Online</span>
                            </a>
                        </div>
                    </div>
                )}
            </div>

            <div className="overflow-hidden bg-white rounded-xl border border-gray-200 shadow-sm hover:border-green-300 transition-all">
                <button 
                    onClick={() => setShowContactDropdown(!showContactDropdown)} 
                    className="w-full p-4 flex items-center justify-between group bg-white"
                >
                    <div className="flex items-center gap-3">
                        <Headphones size={20} className="text-gray-400 group-hover:text-green-500"/>
                        <span className="font-medium text-gray-700">Contact Support</span>
                    </div>
                    {showContactDropdown ? <ChevronDown size={18} className="text-gray-500"/> : <ChevronRight size={18} className="text-gray-300"/>}
                </button>
                
                {showContactDropdown && (
                    <div className="px-4 pb-4 pt-0 bg-white animate-in slide-in-from-top-2">
                        <div className="pt-3 border-t border-gray-100">
                            <p className="text-xs text-gray-400 mb-2">Reach us at:</p>
                            <a href="mailto:newluckypharmacy@gmail.com" className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors">
                                <Mail size={16} className="text-gray-500"/>
                                <span className="text-sm font-bold text-gray-800">newluckypharmacy@gmail.com</span>
                            </a>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* Reset Confirm Modal */}
        <Modal isOpen={showResetConfirm} onClose={() => setShowResetConfirm(false)} title="Factory Reset">
            <div className="text-center">
                <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle size={32}/>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Are you absolutely sure?</h3>
                <p className="text-sm text-gray-600 mb-6">
                    This action will delete all products, sales history, and customer data from this device.
                </p>
                <div className="flex gap-3">
                    <Button variant="neutral" className="flex-1" onClick={() => setShowResetConfirm(false)}>Cancel</Button>
                    <Button variant="danger" className="flex-1" onClick={handleReset}>Yes, Reset</Button>
                </div>
            </div>
        </Modal>

        <div className="text-center text-xs text-gray-400 pt-8 pb-4">Noor POS v1.5.0 • Connected</div>
    </div>
  );
};
