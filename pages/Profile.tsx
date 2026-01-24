
import React, { useEffect, useState, useRef } from 'react';
import { User, StoreSettings, DeletedItem, Tab } from '../types';
import { Card, Button, Input, Modal, Badge } from '../components/UI';
import { 
  LogOut, AlertTriangle, Cloud, Store, MapPin, 
  Bell, Save, Upload, ChevronRight, 
  Server, HardDrive, Image as ImageIcon, FileText, 
  ExternalLink, Loader2, Trash2, RotateCcw, 
  Printer, Scan, Smartphone, RefreshCw, 
  ArchiveRestore, ShieldCheck, ShieldAlert, FileWarning, Database, 
  Settings2, Zap, Link, CheckCircle2, Globe, CalendarClock,
  Download, Palette, FileJson, Activity, Info, UserPlus, Share2, 
  Eye, Users, Shield, Cpu, Gauge, Terminal, HelpCircle, Percent,
  DatabaseZap, Lock, Briefcase, FileSearch, Trash, History, Power,
  Building2, Landmark, Fingerprint, AtSign, Layout, BellRing, Trash2 as TrashIcon, Network,
  X, Check, Pencil, Volume2, VolumeX, BellOff, List, Phone, Moon, Map, LogIn, ChevronDown, ChevronUp
} from 'lucide-react';
import { StoreService } from '../services/storeService';
import { GoogleDriveUtils, DriveFile } from '../utils/googleDrive';

const THEME_COLORS = [
    { name: 'Indigo', hex: '#4f46e5' },
    { name: 'Emerald', hex: '#10b981' },
    { name: 'Rose', hex: '#f43f5e' },
    { name: 'Violet', hex: '#8b5cf6' },
    { name: 'Amber', hex: '#f59e0b' }
];

interface ProfileProps {
  user: User | null;
  onLogin: (user: User) => void;
  onLogout: () => void;
}

export const Profile: React.FC<ProfileProps> = ({ user, onLogin, onLogout }) => {
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);
  const [rawData, setRawData] = useState<any>(null);
  const [storageUsage, setStorageUsage] = useState<string>('0 KB');
  
  // Settings State Management
  const [tempProfile, setTempProfile] = useState<Partial<StoreSettings>>({});
  const [isSyncing, setIsSyncing] = useState(false);

  // Split Fields for Edit Modal
  const [editPhoneCode, setEditPhoneCode] = useState('+91');
  const [editPhoneNumber, setEditPhoneNumber] = useState('');
  const [editAddressLine, setEditAddressLine] = useState('');
  const [editPincode, setEditPincode] = useState('');

  // Google & Auth
  const [googleProfile, setGoogleProfile] = useState<any>(null);
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  
  // Modals
  const [showBusinessModal, setShowBusinessModal] = useState(false);
  const [showNasModal, setShowNasModal] = useState(false);
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showRetentionModal, setShowRetentionModal] = useState(false);
  const [customRetentionDays, setCustomRetentionDays] = useState('');
  
  // Backup Dropdown State
  const [showBackupOptions, setShowBackupOptions] = useState(false);

  // Staff & Sharing
  const [shareEmail, setShareEmail] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [staffForm, setStaffForm] = useState<Omit<User, 'id'>>({ name: '', username: '', pin: '', role: 'staff' });

  // Data
  const [deletedItems, setDeletedItems] = useState<DeletedItem[]>([]);
  const [cloudBackups, setCloudBackups] = useState<DriveFile[]>([]);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [loading, setLoading] = useState(false);

  // Refs
  const logoInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
      setLoading(true);
      const data = await StoreService.getRawData();
      setRawData(data);
      setStoreSettings(data.settings);
      setDeletedItems(data.deletedItems || []);
      
      const session = GoogleDriveUtils.getSession();
      if (session) {
          setGoogleProfile(session.profile);
          setIsDriveConnected(true);
      } else {
          setIsDriveConnected(false);
      }

      const stringified = JSON.stringify(data);
      const bytes = new Blob([stringified]).size;
      setStorageUsage((bytes / 1024).toFixed(1) + ' KB');
      setLoading(false);
  };

  const updateSetting = async (key: keyof StoreSettings, value: any) => {
      if (!storeSettings) return;
      const newSettings = { ...storeSettings, [key]: value };
      setStoreSettings(newSettings);
      await StoreService.saveSettings(newSettings);
  };

  const toggleNotifications = async () => {
      if (!storeSettings) return;
      const newValue = !storeSettings.notificationsEnabled;
      
      if (newValue) {
          // Request Browser Permission
          if (!("Notification" in window)) {
              alert("This browser does not support desktop notifications");
              return;
          }
          
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
              updateSetting('notificationsEnabled', true);
              new Notification("Noor POS", { body: "Notifications are now active!" });
          } else {
              alert("Permission denied. Please check your browser settings.");
              updateSetting('notificationsEnabled', false);
          }
      } else {
          updateSetting('notificationsEnabled', false);
      }
  };

  const handleConnectDrive = async () => {
      const CLIENT_ID = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '476350386539-t8l51erhtfmkiee2rbar7mko8jnqa8n9.apps.googleusercontent.com';
      setIsConnectingDrive(true);
      try {
          if (!(window as any).google?.accounts?.oauth2) {
              alert("Google Services are initializing. Please wait a moment or refresh the page.");
              return;
          }

          const accessToken = await GoogleDriveUtils.initGoogleLogin(CLIENT_ID);
          const sheetId = await GoogleDriveUtils.findOrCreateBackend(accessToken);
          const profile = await GoogleDriveUtils.getUserProfile(accessToken);
          
          GoogleDriveUtils.saveSession({ accessToken, spreadsheetId: sheetId, profile });
          
          // Sync current local data to cloud immediately to preserve guest data
          if (rawData) {
              await GoogleDriveUtils.saveToSheet(accessToken, sheetId, rawData);
          }

          window.location.reload();
      } catch (err: any) {
          console.error(err);
          alert("Failed to connect Google Drive: " + (err.message || "Unknown error"));
      } finally {
          setIsConnectingDrive(false);
      }
  };

  const getRetentionLabel = (days?: number) => {
      if (days === 9999) return 'Never Delete';
      return `${days || 30} Days`;
  };

  const getDaysRemaining = (deletedAt: string) => {
      const days = storeSettings?.recycleBinRetentionDays || 30;
      if (days === 9999) return null;
      
      const deleteDate = new Date(deletedAt);
      const expiryDate = new Date(deleteDate.getTime() + (days * 24 * 60 * 60 * 1000));
      const now = new Date();
      
      const diffTime = expiryDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return diffDays > 0 ? diffDays : 0;
  };

  const openBusinessModal = () => {
      if (!storeSettings) return;
      setTempProfile({ ...storeSettings });

      // Parse Phone
      const phone = storeSettings.storePhone || '';
      // Regex to find country code (starts with +) and the rest
      const phoneMatch = phone.match(/^(\+\d+)\s?(.*)$/);
      if (phoneMatch) {
          setEditPhoneCode(phoneMatch[1]);
          setEditPhoneNumber(phoneMatch[2]);
      } else {
          // Default or simple number
          setEditPhoneCode('+91'); // Default to India
          setEditPhoneNumber(phone.replace(/^\+91/, '').trim());
      }

      // Parse Address (Assuming Pincode is last 6 digits if present, logic can be simple)
      const addr = storeSettings.storeAddress || '';
      const pinMatch = addr.match(/(\d{6})$/);
      if (pinMatch) {
          setEditPincode(pinMatch[1]);
          setEditAddressLine(addr.replace(pinMatch[1], '').replace(/,\s*$/, '').trim());
      } else {
          setEditPincode('');
          setEditAddressLine(addr);
      }

      setShowBusinessModal(true);
  };

  const handleSaveProfile = async () => {
      if (!storeSettings) return;
      setIsSyncing(true);
      try {
        // Construct composite fields
        const finalPhone = editPhoneNumber ? `${editPhoneCode} ${editPhoneNumber}`.trim() : '';
        const finalAddress = editAddressLine ? (editPincode ? `${editAddressLine}, ${editPincode}` : editAddressLine) : '';

        const newSettings = { 
            ...storeSettings, 
            ...tempProfile,
            storePhone: finalPhone,
            storeAddress: finalAddress
        };
        
        await StoreService.saveSettings(newSettings);
        setStoreSettings(newSettings);
        setShowBusinessModal(false);
        setShowNasModal(false);
      } finally {
        setIsSyncing(false);
      }
  };

  const handleExportData = async () => {
      const data = await StoreService.getRawData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `noor_pos_export_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (event) => {
          try {
              const content = event.target?.result as string;
              const data = JSON.parse(content);
              if (!data.products || !data.settings) throw new Error("Invalid file format.");
              if (confirm("THIS ACTION WILL OVERWRITE EVERYTHING. PROCEED?")) {
                  await StoreService.importData(data);
                  window.location.reload();
              }
          } catch (err) { alert("Import failed: File format not recognized."); }
      };
      reader.readAsText(file);
      e.target.value = '';
  };

  const handleAddStaff = async () => {
      if (!staffForm.name || !staffForm.username || !staffForm.pin) return;
      await StoreService.addStaff(staffForm);
      setStaffForm({ name: '', username: '', pin: '', role: 'staff' });
      setIsAddingStaff(false);
      loadData();
  };

  const handleRemoveStaff = async (id: string) => {
      if (confirm("Remove this staff member?")) {
          await StoreService.removeStaff(id);
          loadData();
      }
  };

  if (!user) return null;

  // Helper for Stack Buttons
  const ActionButton = ({ 
      icon: Icon, 
      label, 
      subLabel, 
      onClick, 
      colorClass = "bg-gray-50 text-gray-600",
      rightContent,
      className = ""
  }: { 
      icon: any, 
      label: string, 
      subLabel?: string, 
      onClick: () => void, 
      colorClass?: string,
      rightContent?: React.ReactNode,
      className?: string
  }) => (
      <button 
          onClick={onClick} 
          className={`w-full flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:border-gray-200 transition-all active:scale-[0.98] group ${className}`}
      >
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${colorClass}`}>
              <Icon size={22} />
          </div>
          <div className="flex-1 text-left min-w-0">
              <div className="font-bold text-gray-900 text-sm group-hover:text-indigo-600 transition-colors">{label}</div>
              {subLabel && <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{subLabel}</div>}
          </div>
          <div className="text-gray-300 group-hover:text-indigo-400 transition-colors">
              {rightContent || <ChevronRight size={20} />}
          </div>
      </button>
  );

  return (
    <div className="max-w-3xl mx-auto pb-32 animate-in fade-in space-y-6 px-2 md:px-0">
        
        {/* 1. TOP HEADER: User & Status */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
             <div className="flex items-center gap-5 w-full md:w-auto">
                <div className="relative shrink-0">
                    {googleProfile?.picture ? (
                        <img src={googleProfile.picture} className="w-16 h-16 rounded-2xl border-4 border-gray-50 shadow-sm" />
                    ) : (
                        <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-2xl font-black">{user.name.charAt(0)}</div>
                    )}
                    <div className={`absolute -bottom-2 -right-2 p-1.5 rounded-full border-4 border-white ${isDriveConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                        {isDriveConnected ? <CheckCircle2 size={12} className="text-white"/> : <AlertTriangle size={12} className="text-white"/>}
                    </div>
                </div>
                <div>
                    <h1 className="text-xl font-black text-gray-900">{user.name}</h1>
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mt-1">
                        {isDriveConnected ? 'Cloud Sync Active' : 'Local Mode'}
                    </div>
                </div>
             </div>
             <Button variant="neutral" onClick={() => StoreService.logout()} className="w-full md:w-auto border-2 border-gray-100 hover:border-red-100 hover:bg-red-50 hover:text-red-600 px-6 rounded-xl font-bold">Sign Out</Button>
        </div>

        {/* 2. Google Login Prompt for Guest Mode */}
        {!isDriveConnected && (
            <button 
                onClick={handleConnectDrive}
                disabled={isConnectingDrive}
                className="w-full bg-white p-4 rounded-[2rem] border border-gray-100 shadow-sm flex items-center justify-between group hover:border-blue-200 hover:shadow-md transition-all animate-in fade-in slide-in-from-top-2"
            >
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center border border-gray-100 group-hover:bg-white group-hover:scale-110 transition-transform">
                        <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-6 h-6" alt="Google" />
                    </div>
                    <div className="text-left">
                        <div className="font-black text-gray-900 text-sm group-hover:text-blue-600 transition-colors">Login with Google</div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sync Guest Data to Cloud</div>
                    </div>
                </div>
                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                    {isConnectingDrive ? <Loader2 size={18} className="animate-spin"/> : <LogIn size={18}/>}
                </div>
            </button>
        )}

        {/* 3. BUSINESS DETAILS CARD */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
            
            <div className="flex items-start justify-between mb-6 relative z-10">
                <div>
                    <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight">Store Profile</h2>
                    <p className="text-xs text-gray-400 font-bold mt-1">Business Identity & Branding</p>
                </div>
                <button onClick={openBusinessModal} className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all font-bold text-xs">EDIT</button>
            </div>
            
            <div className="flex items-center gap-5 mb-8 relative z-10">
                <div className="w-20 h-20 rounded-2xl bg-gray-50 border-2 border-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                    {storeSettings?.logo ? <img src={storeSettings.logo} className="w-full h-full object-contain" /> : <Store size={32} className="text-gray-300"/>}
                </div>
                <div className="min-w-0">
                    <div className="text-xl font-black text-gray-900 leading-tight mb-1 truncate">{storeSettings?.storeName || 'Store Name Not Set'}</div>
                    <div className="text-xs text-gray-500 font-bold uppercase tracking-wide truncate">{storeSettings?.businessTagline || 'No Tagline'}</div>
                </div>
            </div>

            <div className="space-y-4 relative z-10 mt-6 pl-1">
                {/* Clean unboxed layout as requested */}
                <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                        <MapPin size={14} className="text-gray-400"/>
                    </div>
                    <div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Location</div>
                        <div className="text-sm font-bold text-gray-900 leading-snug">{storeSettings?.storeAddress || 'Address Not Set'}</div>
                    </div>
                </div>

                <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                        <Phone size={14} className="text-gray-400"/>
                    </div>
                    <div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Contact Number</div>
                        <div className="text-sm font-bold text-gray-900">{storeSettings?.storePhone || 'Phone Not Set'}</div>
                    </div>
                </div>

                <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                        <Globe size={14} className="text-gray-400"/>
                    </div>
                    <div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Online Contact</div>
                        <div className="text-sm font-bold text-gray-900 break-all">{storeSettings?.storeEmail || 'Email Not Set'}</div>
                    </div>
                </div>
            </div>
        </div>

        {/* 4. OPERATIONS STACK */}
        <div className="space-y-4">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] ml-4">Operations Center</h3>
            
            <div className="space-y-3">
                <ActionButton 
                    icon={Users} 
                    label="Staff Management" 
                    subLabel={`${rawData?.users?.length || 0} active users`} 
                    onClick={() => setShowStaffModal(true)} 
                    colorClass="bg-indigo-50 text-indigo-600"
                />
                
                <ActionButton 
                    icon={Network} 
                    label="NAS / Local Server" 
                    subLabel="Configure relay endpoint" 
                    onClick={() => { setTempProfile({...storeSettings}); setShowNasModal(true); }} 
                    colorClass="bg-emerald-50 text-emerald-600"
                />
            </div>
        </div>

        {/* 5. PREFERENCES STACK (New Separate Boxes) */}
        <div className="space-y-4">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] ml-4">System Preferences</h3>
            
            <div className="space-y-3">
                <ActionButton 
                    icon={storeSettings?.soundEnabled ? Volume2 : VolumeX} 
                    label="Sound Effects" 
                    subLabel={storeSettings?.soundEnabled ? "Audio feedback enabled" : "Muted"} 
                    onClick={() => updateSetting('soundEnabled', !storeSettings?.soundEnabled)}
                    colorClass={storeSettings?.soundEnabled ? "bg-indigo-50 text-indigo-600" : "bg-gray-100 text-gray-400"}
                    rightContent={<div className={`w-10 h-6 rounded-full p-1 transition-colors ${storeSettings?.soundEnabled ? 'bg-indigo-500' : 'bg-gray-200'}`}><div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${storeSettings?.soundEnabled ? 'translate-x-4' : ''}`}></div></div>}
                />

                <ActionButton 
                    icon={storeSettings?.notificationsEnabled ? Bell : BellOff} 
                    label="Browser Alerts" 
                    subLabel={storeSettings?.notificationsEnabled ? "Push notifications on" : "Push notifications off"} 
                    onClick={toggleNotifications}
                    colorClass={storeSettings?.notificationsEnabled ? "bg-amber-50 text-amber-600" : "bg-gray-100 text-gray-400"}
                    rightContent={<div className={`w-10 h-6 rounded-full p-1 transition-colors ${storeSettings?.notificationsEnabled ? 'bg-amber-500' : 'bg-gray-200'}`}><div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${storeSettings?.notificationsEnabled ? 'translate-x-4' : ''}`}></div></div>}
                />

                <ActionButton 
                    icon={CalendarClock} 
                    label="Recycle Bin Policy" 
                    subLabel={`Auto-clear: ${getRetentionLabel(storeSettings?.recycleBinRetentionDays)}`} 
                    onClick={() => setShowRetentionModal(true)}
                    colorClass="bg-violet-50 text-violet-600"
                    rightContent={<div className="flex items-center gap-2"><span className="text-[10px] font-black bg-violet-100 text-violet-700 px-2 py-1 rounded uppercase">{storeSettings?.recycleBinRetentionDays || 30} Days</span><Pencil size={14} className="text-gray-300"/></div>}
                />

                <ActionButton 
                    icon={Palette} 
                    label="Theme & Appearance" 
                    subLabel="Customize app accent color" 
                    onClick={() => setShowThemeModal(true)}
                    colorClass="bg-pink-50 text-pink-600"
                    rightContent={<div className="w-5 h-5 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: storeSettings?.primaryColor || '#4f46e5' }}></div>}
                />
            </div>
        </div>

        {/* 6. DATA & STORAGE STACK */}
        <div className="space-y-4">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] ml-4">Data & Storage</h3>
            
            <div className="space-y-3">
                <ActionButton 
                    icon={isDriveConnected ? CheckCircle2 : AlertTriangle} 
                    label={isDriveConnected ? "Drive Connected" : "Connect Google Drive"}
                    subLabel={isDriveConnected ? "Sync active" : "Tap to sync local data"}
                    onClick={() => { if(!isDriveConnected) handleConnectDrive(); }}
                    colorClass={isDriveConnected ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"}
                    rightContent={isConnectingDrive ? <Loader2 size={18} className="animate-spin text-gray-400"/> : (isDriveConnected ? <RefreshCw size={18}/> : <LogIn size={18} className="text-gray-400"/>)}
                />

                <ActionButton 
                    icon={Cloud} 
                    label="Cloud Backups" 
                    subLabel="View snapshots & restore" 
                    onClick={() => { if(isDriveConnected) setShowBackupModal(true); else alert("Cloud login required"); }} 
                    colorClass="bg-blue-50 text-blue-600"
                />

                <ActionButton 
                    icon={Download} 
                    label="Export Backup" 
                    subLabel="Download JSON file" 
                    onClick={handleExportData} 
                    colorClass="bg-gray-100 text-gray-700"
                />

                <div className="relative">
                    <ActionButton 
                        icon={Upload} 
                        label="Import Backup" 
                        subLabel="Restore from JSON file" 
                        onClick={() => importInputRef.current?.click()} 
                        colorClass="bg-gray-100 text-gray-700"
                    />
                    <input type="file" ref={importInputRef} onChange={handleImportData} className="hidden" accept=".json" />
                </div>
            </div>
        </div>

        {/* 7. SYSTEM ZONE STACK */}
        <div className="space-y-4">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] ml-4">System Zone</h3>
            
            <div className="space-y-3">
                <ActionButton 
                    icon={Trash2} 
                    label="Recycle Bin" 
                    subLabel={`${deletedItems.length} items queued`} 
                    onClick={() => setShowRecycleBin(true)} 
                    colorClass="bg-rose-50 text-rose-500"
                    rightContent={<span className="text-xs font-black bg-rose-100 text-rose-600 px-2 py-1 rounded-md">{deletedItems.length}</span>}
                />

                <ActionButton 
                    icon={Terminal} 
                    label="System Logs" 
                    subLabel="View audit trail & errors" 
                    onClick={() => setShowLogsModal(true)} 
                    colorClass="bg-slate-100 text-slate-600"
                />

                <ActionButton 
                    icon={ShieldCheck} 
                    label="Privacy Policy" 
                    subLabel="Read terms of service" 
                    onClick={() => window.open('/privacy.html', '_blank')} 
                    colorClass="bg-slate-100 text-slate-600"
                    rightContent={<ExternalLink size={18}/>}
                />

                <ActionButton 
                    icon={FileWarning} 
                    label="Factory Reset" 
                    subLabel="Clear all app data" 
                    onClick={() => setShowResetConfirm(true)} 
                    colorClass="bg-red-50 text-red-600"
                    rightContent={<AlertTriangle size={18} className="text-red-400"/>}
                />
            </div>
        </div>

        {/* --- MODALS --- */}

        {/* 1. Business Details Modal */}
        <Modal isOpen={showBusinessModal} onClose={() => setShowBusinessModal(false)} title="Business Profile" className="!max-w-2xl">
            <div className="space-y-5">
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="w-20 h-20 bg-white rounded-xl border border-gray-200 flex items-center justify-center overflow-hidden relative group cursor-pointer" onClick={() => logoInputRef.current?.click()}>
                        {tempProfile.logo ? <img src={tempProfile.logo} className="w-full h-full object-contain" /> : <Store size={32} className="text-gray-300"/>}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Upload className="text-white" size={20}/></div>
                    </div>
                    <div className="flex-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Business Name</label>
                        <Input value={tempProfile.storeName} onChange={e => setTempProfile({...tempProfile, storeName: e.target.value})} placeholder="My Store" className="font-bold"/>
                        <input type="file" ref={logoInputRef} onChange={(e) => { const file = e.target.files?.[0]; if(file) { const r = new FileReader(); r.onloadend = () => setTempProfile({...tempProfile, logo: r.result as string}); r.readAsDataURL(file); } }} className="hidden" accept="image/*" />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 ml-1">Tagline</label><Input value={tempProfile.businessTagline} onChange={e => setTempProfile({...tempProfile, businessTagline: e.target.value})} placeholder="e.g. Best in Town" /></div>
                    <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 ml-1">GSTIN</label><Input value={tempProfile.gstNumber} onChange={e => setTempProfile({...tempProfile, gstNumber: e.target.value})} placeholder="GSTIN" /></div>
                    
                    {/* Split Phone Input */}
                    <div className="md:col-span-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 ml-1">Mobile Contact</label>
                        <div className="flex gap-2">
                            <select value={editPhoneCode} onChange={e => setEditPhoneCode(e.target.value)} className="w-24 rounded-lg px-2 py-2.5 bg-gray-50 border-2 border-gray-200 font-bold text-gray-900 outline-none">
                                <option value="+91">+91</option>
                                <option value="+1">+1</option>
                                <option value="+44">+44</option>
                                <option value="+971">+971</option>
                            </select>
                            <Input value={editPhoneNumber} onChange={e => setEditPhoneNumber(e.target.value)} placeholder="Mobile Number" className="flex-1" />
                        </div>
                    </div>

                    {/* Split Address Input */}
                    <div className="md:col-span-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 ml-1">Full Location</label>
                        <div className="flex gap-2">
                            <Input value={editAddressLine} onChange={e => setEditAddressLine(e.target.value)} placeholder="Street, Area, City" className="flex-[2]" />
                            <Input value={editPincode} onChange={e => setEditPincode(e.target.value)} placeholder="Pincode/Zip" className="flex-1" />
                        </div>
                    </div>

                    <div className="md:col-span-2"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 ml-1">Email</label><Input value={tempProfile.storeEmail} onChange={e => setTempProfile({...tempProfile, storeEmail: e.target.value})} placeholder="Email" /></div>
                </div>
                <Button className="w-full mt-4 py-4 rounded-xl font-black uppercase tracking-widest" onClick={handleSaveProfile} disabled={isSyncing}>{isSyncing ? <Loader2 className="animate-spin mx-auto"/> : "Save Changes"}</Button>
            </div>
        </Modal>

        {/* 2. Retention Policy Modal (Replaces Prompt) */}
        <Modal isOpen={showRetentionModal} onClose={() => setShowRetentionModal(false)} title="Retention Policy" className="!max-w-sm">
            <div className="space-y-4">
                <p className="text-sm text-gray-500">Automatically delete items from the recycle bin after a set period.</p>
                
                <div className="grid grid-cols-2 gap-3">
                    {[7, 30, 90, 365].map(days => (
                        <button 
                            key={days}
                            onClick={() => { updateSetting('recycleBinRetentionDays', days); setShowRetentionModal(false); }}
                            className={`py-3 rounded-xl border-2 font-bold text-sm transition-all ${storeSettings?.recycleBinRetentionDays === days ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-100 hover:border-violet-200 text-gray-600'}`}
                        >
                            {days} Days
                        </button>
                    ))}
                </div>
                
                <button 
                    onClick={() => { updateSetting('recycleBinRetentionDays', 9999); setShowRetentionModal(false); }}
                    className={`w-full py-3 rounded-xl border-2 font-bold text-sm transition-all ${storeSettings?.recycleBinRetentionDays === 9999 ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-100 hover:border-violet-200 text-gray-600'}`}
                >
                    Never Auto-Delete
                </button>

                <div className="relative pt-4 border-t border-gray-100">
                     <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Custom Duration (Days)</label>
                     <div className="flex gap-2">
                         <Input 
                            type="number" 
                            placeholder="e.g. 60" 
                            className="flex-1"
                            value={customRetentionDays}
                            onChange={(e) => setCustomRetentionDays(e.target.value)}
                         />
                         <Button onClick={() => { 
                             const d = parseInt(customRetentionDays); 
                             if(d > 0) { updateSetting('recycleBinRetentionDays', d); setShowRetentionModal(false); } else { alert("Enter a valid number"); }
                         }}>Set</Button>
                     </div>
                </div>
            </div>
        </Modal>

        {/* 3. NAS Modal */}
        <Modal isOpen={showNasModal} onClose={() => setShowNasModal(false)} title="Network Storage" className="!max-w-lg">
            <div className="space-y-6">
                <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 flex gap-4">
                    <Server size={32} className="text-emerald-600 shrink-0"/>
                    <div>
                        <h4 className="font-bold text-emerald-900 text-sm">Local Server Relay</h4>
                        <p className="text-xs text-emerald-700 mt-1">Mirror your transactions to a local Node.js server for redundancy.</p>
                    </div>
                </div>
                <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 ml-1">Server Endpoint</label>
                    <Input value={tempProfile.nasUrl} onChange={e => setTempProfile({...tempProfile, nasUrl: e.target.value})} placeholder="http://192.168.1.X:3000/api/storage" />
                </div>
                <label className="flex items-center gap-4 p-4 border-2 border-gray-100 rounded-xl cursor-pointer hover:bg-gray-50 transition-all">
                    <input type="checkbox" className="w-5 h-5 accent-emerald-600" checked={!!tempProfile.syncToNas} onChange={(e) => setTempProfile({...tempProfile, syncToNas: e.target.checked})}/>
                    <span className="font-bold text-gray-700 text-sm">Enable Live Sync</span>
                </label>
                <Button className="w-full py-4 rounded-xl font-black uppercase tracking-widest" onClick={handleSaveProfile} disabled={isSyncing}>{isSyncing ? <Loader2 className="animate-spin mx-auto"/> : "Update Configuration"}</Button>
            </div>
        </Modal>

        {/* 4. Theme Modal */}
        <Modal isOpen={showThemeModal} onClose={() => setShowThemeModal(false)} title="App Appearance" className="!max-w-sm">
            <div className="space-y-4">
                <p className="text-sm text-gray-500 mb-4">Choose an accent color for your dashboard.</p>
                <div className="grid grid-cols-5 gap-3 justify-items-center">
                    {THEME_COLORS.map(c => (
                        <button 
                            key={c.hex} 
                            onClick={() => { updateSetting('primaryColor', c.hex); setShowThemeModal(false); }}
                            className={`w-12 h-12 rounded-full transition-transform shadow-sm border-2 border-white ${storeSettings?.primaryColor === c.hex ? 'scale-110 ring-4 ring-offset-2 ring-gray-100' : 'hover:scale-105'}`}
                            style={{ backgroundColor: c.hex }}
                        />
                    ))}
                </div>
                <Button variant="neutral" className="w-full mt-4" onClick={() => setShowThemeModal(false)}>Close</Button>
            </div>
        </Modal>

        {/* 5. Staff Modal */}
        <Modal isOpen={showStaffModal} onClose={() => {setShowStaffModal(false); setIsAddingStaff(false);}} title="Staff Roster" className="!max-w-xl">
             <div className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Active Accounts</p>
                    <button onClick={() => setIsAddingStaff(!isAddingStaff)} className="text-blue-600 font-black text-[10px] uppercase tracking-widest hover:underline">{isAddingStaff ? 'View List' : '+ Add Staff'}</button>
                </div>

                {isAddingStaff ? (
                    <div className="space-y-4 animate-in fade-in zoom-in-95 bg-gray-50 p-5 rounded-2xl border border-gray-100">
                        <Input placeholder="Full Name" value={staffForm.name} onChange={e => setStaffForm({...staffForm, name: e.target.value})} className="!bg-white"/>
                        <Input placeholder="Username" value={staffForm.username} onChange={e => setStaffForm({...staffForm, username: e.target.value})} className="!bg-white"/>
                        <div className="grid grid-cols-2 gap-3">
                            <Input placeholder="PIN (4 digits)" type="password" maxLength={4} value={staffForm.pin} onChange={e => setStaffForm({...staffForm, pin: e.target.value})} className="!bg-white"/>
                            <select className="bg-white border-2 border-gray-200 rounded-lg px-3 py-2.5 font-bold text-sm outline-none" value={staffForm.role} onChange={e => setStaffForm({...staffForm, role: e.target.value as any})}>
                                <option value="staff">Staff Role</option>
                                <option value="admin">Admin Role</option>
                            </select>
                        </div>
                        <Button className="w-full py-3 font-black uppercase tracking-widest text-[10px]" onClick={handleAddStaff}>Authorize Access</Button>
                    </div>
                ) : (
                    <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1 no-scrollbar">
                        {rawData?.users?.length > 0 ? rawData.users.map((u: User) => (
                            <div key={u.id} className="flex justify-between items-center p-3 bg-white border border-gray-100 rounded-xl shadow-sm hover:border-indigo-200 transition-all">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-gray-900 text-white flex items-center justify-center font-black">{u.name.charAt(0)}</div>
                                    <div><div className="text-sm font-bold text-gray-950">{u.name}</div><div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{u.role}</div></div>
                                </div>
                                <button onClick={() => handleRemoveStaff(u.id)} className="p-2 text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"><Trash2 size={18}/></button>
                            </div>
                        )) : (
                            <div className="text-center py-8 text-gray-300 border-2 border-dashed border-gray-100 rounded-2xl">
                                <p className="text-[10px] font-black uppercase tracking-widest">No local staff found</p>
                            </div>
                        )}
                    </div>
                )}
             </div>
        </Modal>

        {/* 6. Logs Modal */}
        <Modal isOpen={showLogsModal} onClose={() => setShowLogsModal(false)} title="Audit Logs" className="!max-w-2xl">
            <div className="space-y-4">
                <div className="bg-gray-900 rounded-2xl p-5 font-mono text-[10px] text-emerald-400 max-h-[60vh] overflow-y-auto shadow-inner border-4 border-gray-800">
                    <div className="flex items-center gap-2 mb-4 border-b border-gray-800 pb-2 text-gray-500">
                        <Terminal size={14}/> SYSTEM_TRACE...
                    </div>
                    {rawData?.logs?.length > 0 ? rawData.logs.map((log: string, i: number) => (
                        <div key={i} className="py-1 border-b border-gray-800/30">
                            <span className="text-gray-600 mr-2">[{i+1}]</span> {log}
                        </div>
                    )) : <div className="text-center py-10 opacity-50">NO_EVENTS_FOUND</div>}
                </div>
                <Button variant="neutral" className="w-full py-3 font-black uppercase tracking-widest text-[10px]" onClick={() => setShowLogsModal(false)}>Close Session</Button>
            </div>
        </Modal>

        {/* 7. Cloud Snapshots Modal */}
        <Modal isOpen={showBackupModal} onClose={() => setShowBackupModal(false)} title="Vault Snapshots">
            <div className="space-y-6">
                <div className="relative z-20">
                     <Button 
                        onClick={() => setShowBackupOptions(!showBackupOptions)} 
                        className="w-full bg-blue-600 hover:bg-blue-700 flex justify-between items-center px-6 py-4 font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl shadow-xl shadow-blue-100"
                    >
                        <span className="flex items-center gap-3"><Cloud size={18} /> Backup Actions</span>
                        {showBackupOptions ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
                    </Button>
                    
                    {showBackupOptions && (
                        <div className="absolute top-full left-0 right-0 mt-3 bg-white border border-gray-100 rounded-2xl shadow-2xl p-2 animate-in fade-in zoom-in-95 origin-top">
                            <button 
                                onClick={async () => { 
                                    setIsCreatingBackup(true); 
                                    try { 
                                        await StoreService.createCloudBackup(); 
                                        const files = await StoreService.getCloudBackups(); 
                                        setCloudBackups(files); 
                                        setShowBackupOptions(false);
                                    } finally { 
                                        setIsCreatingBackup(false); 
                                    } 
                                }} 
                                disabled={isCreatingBackup}
                                className="w-full text-left px-4 py-3 hover:bg-blue-50 rounded-xl flex items-center gap-4 transition-colors group"
                            >
                                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                     {isCreatingBackup ? <Loader2 size={18} className="animate-spin"/> : <Cloud size={18}/>}
                                </div>
                                <div>
                                    <div className="font-bold text-gray-800 text-sm group-hover:text-blue-700">Create Cloud Snapshot</div>
                                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Save to Google Drive</div>
                                </div>
                            </button>

                            <button 
                                onClick={() => { handleExportData(); setShowBackupOptions(false); }} 
                                className="w-full text-left px-4 py-3 hover:bg-emerald-50 rounded-xl flex items-center gap-4 transition-colors group"
                            >
                                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                     <Download size={18}/>
                                </div>
                                <div>
                                    <div className="font-bold text-gray-800 text-sm group-hover:text-emerald-700">Local Export</div>
                                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Download JSON File</div>
                                </div>
                            </button>
                        </div>
                    )}
                </div>

                <div className="border-t border-gray-100 pt-4 relative z-10">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 ml-1">History</h3>
                    <div className="max-h-[35vh] overflow-y-auto space-y-2 no-scrollbar px-1">
                        {cloudBackups.length === 0 ? <p className="text-center text-gray-300 text-[10px] py-12 font-black uppercase tracking-widest opacity-40">Scanning for vault records...</p> : (
                            cloudBackups.map(file => (
                                <div key={file.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl group hover:border-blue-400 shadow-sm transition-all">
                                    <div className="min-w-0">
                                        <div className="font-bold text-gray-950 text-xs truncate">{file.name}</div>
                                        <div className="text-[9px] text-gray-400 font-bold mt-1 uppercase tracking-tighter">{new Date(file.createdTime || '').toLocaleString()}</div>
                                    </div>
                                    <button onClick={async () => { if(confirm("Overwrite current data?")) { setIsRestoring(true); try { await StoreService.restoreCloudBackup(file.id); window.location.reload(); } finally { setIsRestoring(false); } } }} disabled={isRestoring} className="p-3 text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-600 hover:text-white transition-all">
                                        <RefreshCw size={16} className={isRestoring ? "animate-spin" : ""}/>
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </Modal>

        {/* 8. Reset Confirmation Modal */}
        <Modal isOpen={showResetConfirm} onClose={() => setShowResetConfirm(false)} title="Security Protocol">
            <div className="text-center py-4">
                <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4 ring-8 ring-rose-50"><ShieldAlert size={32} /></div>
                <h3 className="text-lg font-black text-gray-950 mb-2">ERASE TERMINAL?</h3>
                <p className="text-xs text-gray-500 mb-6 px-4 font-medium">This wipes the local cache and logout session. Cloud files remain safe.</p>
                <div className="flex flex-col gap-3">
                    <Button variant="danger" className="w-full py-4 font-black uppercase tracking-widest bg-rose-600 rounded-2xl shadow-xl shadow-rose-100" onClick={() => StoreService.factoryReset()}>EXECUTE WIPE</Button>
                    <button className="py-2 font-black text-gray-300 uppercase text-[10px] tracking-widest hover:text-gray-500" onClick={() => setShowResetConfirm(false)}>Abort Protocol</button>
                </div>
            </div>
        </Modal>

        {/* 9. Recycle Bin Modal */}
        <Modal isOpen={showRecycleBin} onClose={() => setShowRecycleBin(false)} title="Secure Archive" className="!max-w-3xl h-[80vh] flex flex-col overflow-hidden bg-gray-50 rounded-[2.5rem]">
            <div className="flex-1 flex flex-col h-full overflow-hidden -mx-6 -mb-6">
                <div className="px-8 py-6 bg-white border-b border-gray-100 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3"><History size={20} className="text-gray-400"/><span className="text-[10px] text-gray-950 font-black uppercase tracking-widest">{deletedItems.length} Archived Objects</span></div>
                    {deletedItems.length > 0 && <button onClick={async () => { if(confirm("Permanently erase?")) { await StoreService.emptyRecycleBin(); loadData(); } }} className="text-rose-600 text-[10px] font-black uppercase tracking-widest hover:underline">Full Purge</button>}
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
                    {deletedItems.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-20"><FileSearch size={64} className="mb-4"/><p className="font-black uppercase tracking-widest text-[10px]">No deleted objects found</p></div>
                    ) : (
                        deletedItems.map(item => {
                            const daysLeft = getDaysRemaining(item.deletedAt);
                            return (
                                <div key={item.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center group transition-all hover:border-blue-200">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 border border-gray-100 shadow-inner group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors"><Database size={20}/></div>
                                        <div>
                                            <div className="text-sm font-black text-gray-950">{item.data.name || item.type.toUpperCase()}</div>
                                            <div className="text-[9px] text-gray-400 font-black uppercase tracking-widest mt-0.5">
                                                Purged: {new Date(item.deletedAt).toLocaleDateString()} 
                                                {daysLeft !== null && <span className="ml-2 text-rose-500">• Auto-delete in {daysLeft} days</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={async () => { await StoreService.restoreItem(item.id); loadData(); }} className="p-2.5 text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition-all active:scale-90" title="Restore"><RotateCcw size={16}/></button>
                                        <button onClick={async () => { if(confirm("Destroy forever?")) { await StoreService.permanentlyDelete(item.id); loadData(); } }} className="p-2.5 text-rose-500 bg-rose-50 rounded-xl hover:bg-rose-500 hover:text-white transition-all active:scale-90" title="Wipe"><Trash size={16}/></button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </Modal>
    </div>
  );
};
