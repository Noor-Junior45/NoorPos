import React, { useEffect, useState, useRef, useMemo } from 'react';
import { User, StoreSettings, DeletedItem, Tab } from '../types';
import { Card, Button, Input, Modal, Badge } from '../components/UI';
import { LogOut, AlertTriangle, Cloud, Settings, Store, Phone, MapPin, Mail, Bell, CheckSquare, Save, Download, Upload, ChevronRight, ChevronDown, Sparkles, Server, HardDrive, Image as ImageIcon, FileText, Headphones, ExternalLink, Users, UserPlus, Loader2, Trash2, RotateCcw, Box, Receipt, Calendar, Clock, Printer, Scan, Smartphone, RefreshCw, ArchiveRestore, ShieldCheck, CloudOff } from 'lucide-react';
import { StoreService } from '../services/storeService';
import { GoogleDriveUtils, DriveFile } from '../utils/googleDrive';

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
  const [showPrivacyDropdown, setShowPrivacyDropdown] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  
  // Recycle Bin State
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [deletedItems, setDeletedItems] = useState<DeletedItem[]>([]);
  const [recycleRetention, setRecycleRetention] = useState(30);

  // Staff Sharing State
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [showShareSuccess, setShowShareSuccess] = useState(false);
  
  // Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Cloud Backup State
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [cloudBackups, setCloudBackups] = useState<DriveFile[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Gesture State
  const [touchStart, setTouchStart] = useState<{x: number, y: number} | null>(null);
  const [touchEnd, setTouchEnd] = useState<{x: number, y: number} | null>(null);
  const minSwipeDistance = 50;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  
  // Refs
  const storeNameRef = useRef<HTMLInputElement>(null);
  const storeAddrRef = useRef<HTMLInputElement>(null);
  const storePhoneRef = useRef<HTMLInputElement>(null);
  const storeEmailRef = useRef<HTMLInputElement>(null);

  // Environment Variable for Client ID
  const CLIENT_ID = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';

  // --- Browser/Gesture Back Navigation Handling ---
  useEffect(() => {
    const handleNavigationPop = (e: any) => {
        // Priority-based closing of Profile sub-views
        if (showBackupModal) {
            setShowBackupModal(false);
            return;
        }
        if (showRecycleBin) {
            setShowRecycleBin(false);
            return;
        }
        if (showResetConfirm) {
            setShowResetConfirm(false);
            return;
        }
        if (isEditingNas) {
            setIsEditingNas(false);
            return;
        }
        if (isEditingProfile) {
            setIsEditingProfile(false);
            return;
        }
    };

    window.addEventListener('app-navigation-pop' as any, handleNavigationPop);
    return () => window.removeEventListener('app-navigation-pop' as any, handleNavigationPop);
  }, [isEditingProfile, isEditingNas, showRecycleBin, showBackupModal, showResetConfirm]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
      const s = await StoreService.getSettings();
      setStoreSettings(s);
      setRecycleRetention(s.recycleBinRetentionDays || 30);
      
      const session = GoogleDriveUtils.getSession();
      if (session) {
          setGoogleProfile(session.profile);
      }
      
      const lastTime = StoreService.getLastBackupTime();
      if (lastTime) setLastBackup(new Date(lastTime).toLocaleString());

      const delItems = await StoreService.getDeletedItems();
      setDeletedItems(delItems);
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
          window.history.pushState({ tab: Tab.PROFILE, depth: 1 }, '');
          setIsEditingProfile(true);
      }
  };

  const handleSaveProfile = async () => {
      if (!storeSettings) return;
      const newSettings = { ...storeSettings, ...tempProfile };
      await StoreService.saveSettings(newSettings);
      setStoreSettings(newSettings);
      setIsEditingProfile(false);
      window.history.back();
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

  const handleSaveRetention = async (days: number) => {
      if (!storeSettings) return;
      setRecycleRetention(days);
      const newSettings = { ...storeSettings, recycleBinRetentionDays: days };
      await StoreService.saveSettings(newSettings);
      setStoreSettings(newSettings);
  };

  const handleRestoreItem = async (id: string) => {
      await StoreService.restoreItem(id);
      loadData(); // Refresh list
  };

  const handlePermanentDelete = async (id: string) => {
      if(confirm("Delete this item permanently? This cannot be undone.")) {
          await StoreService.permanentlyDelete(id);
          loadData();
      }
  };

  const handleEmptyBin = async () => {
      if(confirm("Are you sure? This will permanently remove all items in the recycle bin.")) {
          await StoreService.emptyRecycleBin();
          loadData();
      }
  };

  const groupedDeletedItems = useMemo(() => {
      const groups: Record<string, DeletedItem[]> = {};
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();

      deletedItems.forEach(item => {
          const d = new Date(item.deletedAt);
          let key = d.toDateString();
          if (key === today) key = 'Today';
          else if (key === yesterday) key = 'Yesterday';
          
          if (!groups[key]) groups[key] = [];
          groups[key].push(item);
      });
      return groups;
  }, [deletedItems]);

  const handleStartEditNas = () => {
      if (storeSettings) {
          setTempNas({
              nasUrl: storeSettings.nasUrl || 'http://localhost:3000/api/storage',
              syncToNas: storeSettings.syncToNas || false
          });
          window.history.pushState({ tab: Tab.PROFILE, depth: 1 }, '');
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
      window.history.back();
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
          if (Notification.permission === 'denied') {
              alert("Notification permission was previously denied. Please enable it in your browser site settings to receive alerts.");
              return;
          }
          try {
              const permission = await Notification.requestPermission();
              if (permission !== 'granted') {
                  alert("Notification permission denied. You won't receive stock alerts.");
                  return;
              }
              new Notification("Notifications Enabled", { 
                  body: "You will now receive alerts for low stock and important inventory events.",
                  icon: "https://lh3.googleusercontent.com/p/AF1QipPlp0QUwcp2FOnTGiGNf5fqWnskinCj4QxRKa3o=s1360-w1360-h1020-rw"
              });
          } catch (e) {
              console.warn("Failed to request notification permission:", e);
          }
      }

      const newSettings = { ...storeSettings, notificationsEnabled: newState };
      await StoreService.saveSettings(newSettings);
      setStoreSettings(newSettings);
  };

  const handleRequestPrinterPermission = async () => {
      if (!storeSettings) return;
      
      if (confirm("Allow Noor POS to access your local printing machines? This will open the print dialog immediately when clicking 'Print' instead of downloading files.")) {
          const newSettings = { ...storeSettings, directPrintEnabled: true };
          await StoreService.saveSettings(newSettings);
          setStoreSettings(newSettings);
          alert("Printer permission granted. Bills will now be sent directly to your system's print queue.");
      }
  };

  const handleToggleDirectPrint = async () => {
       if (!storeSettings) return;
       const newSettings = { ...storeSettings, directPrintEnabled: !storeSettings.directPrintEnabled };
       await StoreService.saveSettings(newSettings);
       setStoreSettings(newSettings);
  };

  const handleScannerPreferenceChange = async (pref: 'phone' | 'machine' | 'both') => {
      if (!storeSettings) return;
      const newSettings = { ...storeSettings, scannerPreference: pref };
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
  
  const handleGoogleConnect = async () => {
      setIsConnecting(true);
      try {
          const accessToken = await GoogleDriveUtils.initGoogleLogin(CLIENT_ID);
          const sheetId = await GoogleDriveUtils.findOrCreateBackend(accessToken);
          const profile = await GoogleDriveUtils.getUserProfile(accessToken);
          
          GoogleDriveUtils.saveSession({
            accessToken,
            spreadsheetId: sheetId,
            profile
          });
          
          alert("Account Connected! Your data will now sync to Google Drive.");
          window.location.reload(); 
      } catch (err: any) {
          console.error("Connect error:", err);
          alert("Failed to connect: " + (err.message || "Unknown error"));
      } finally {
          setIsConnecting(false);
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

  const handleForceSync = async () => {
      if (!googleProfile) {
          alert("Please connect a Google account first.");
          return;
      }
      setIsSyncing(true);
      try {
          await StoreService.forceSync();
          await loadData();
          alert("Cloud data synchronized successfully!");
      } catch (e) {
          alert("Sync failed. Check internet connection.");
      } finally {
          setIsSyncing(false);
      }
  };

  const handleOpenBackupModal = async () => {
      if (!googleProfile) {
          alert("Cloud backups require a connected Google account.");
          return;
      }
      window.history.pushState({ tab: Tab.PROFILE, depth: 1 }, '');
      setShowBackupModal(true);
      setIsLoadingBackups(true);
      try {
          // Attempt to list backups. If token expired (401), listCloudBackups will throw.
          try {
              const files = await StoreService.getCloudBackups();
              setCloudBackups(files);
          } catch (e: any) {
              if (e.message.includes('401') || e.message.includes('credentials') || e.message.includes('Auth')) {
                  if (CLIENT_ID) {
                      // Attempt Refresh for Listing
                      console.log("Token expired for listing backups, refreshing...");
                      await GoogleDriveUtils.refreshSession(CLIENT_ID);
                      const files = await StoreService.getCloudBackups(); // Retry
                      setCloudBackups(files);
                  } else {
                      throw e;
                  }
              } else {
                  throw e;
              }
          }
      } catch(e: any) {
          console.error(e);
      } finally {
          setIsLoadingBackups(false);
      }
  };

  const handleCreateCloudBackup = async () => {
      setIsCreatingBackup(true);
      try {
          await StoreService.createCloudBackup();
          const files = await StoreService.getCloudBackups();
          setCloudBackups(files);
          alert("Backup created successfully in Google Drive!");
      } catch (e: any) {
          // Handle 401 Unauthorized / Invalid Credentials
          if ((e.message.includes('401') || e.message.includes('credentials')) && CLIENT_ID) {
              try {
                  console.log("Token expired, attempting refresh...");
                  await GoogleDriveUtils.refreshSession(CLIENT_ID);
                  // Retry Operation once
                  await StoreService.createCloudBackup();
                  const files = await StoreService.getCloudBackups();
                  setCloudBackups(files);
                  alert("Backup created successfully (Session Refreshed)!");
                  return; // Exit success
              } catch (refreshErr: any) {
                  console.error("Refresh failed", refreshErr);
                  alert("Session expired. Please sign out and sign in again.");
              }
          } else {
              alert("Backup failed: " + e.message);
          }
      } finally {
          setIsCreatingBackup(false);
      }
  };

  const handleRestoreBackup = async (fileId: string) => {
      if(!confirm("Are you sure? This will replace your current data with the selected backup.")) return;
      
      setIsRestoring(true);
      try {
          await StoreService.restoreCloudBackup(fileId);
          setShowBackupModal(false);
          window.history.back();
      } catch (e: any) {
          // Handle 401 for Restore as well
          if ((e.message.includes('401') || e.message.includes('credentials')) && CLIENT_ID) {
              try {
                  await GoogleDriveUtils.refreshSession(CLIENT_ID);
                  await StoreService.restoreCloudBackup(fileId);
                  setShowBackupModal(false);
                  window.history.back();
                  return;
              } catch (refreshErr) {
                  alert("Session expired. Please re-login.");
              }
          }
          alert("Restore failed: " + e.message);
          setIsRestoring(false); 
      }
  };

  // --- Gesture Handlers ---
  const onTouchStart = (e: React.TouchEvent) => {
      setTouchEnd(null);
      setTouchStart({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
  };

  const onTouchMove = (e: React.TouchEvent) => {
      setTouchEnd({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
  };

  const onTouchEnd = () => {
      if (!touchStart || !touchEnd) return;
      const distanceX = touchStart.x - touchEnd.x;
      const distanceY = touchStart.y - touchEnd.y;
      const isRightSwipe = distanceX < -minSwipeDistance; 
      
      if (isRightSwipe && Math.abs(distanceX) > Math.abs(distanceY)) {
          if (showRecycleBin) {
              setShowRecycleBin(false);
              window.history.back();
          }
      }
  };

  if (!user) return null;

  const isGuest = user.id === 'guest' || !googleProfile;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-32 animate-in fade-in">
        
        {/* 1. Profile Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4 w-full">
                {googleProfile?.picture ? (
                    <img src={googleProfile.picture} alt="Profile" className="w-16 h-16 rounded-full shadow-lg border-2 border-white shrink-0" />
                ) : (
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-50 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shrink-0">
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

        {/* 1.5 Guest Connect CTA */}
        {isGuest && (
            <Card className="bg-indigo-600 text-white border-0 shadow-lg relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-16 bg-white/10 rounded-full -mr-8 -mt-8 blur-2xl group-hover:scale-110 transition-transform duration-700"></div>
                <div className="relative z-10 p-5">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm shrink-0">
                            <Cloud size={24} className="text-white"/>
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-lg leading-tight">Sync your Data</h3>
                            <p className="text-indigo-100 text-sm mt-1 mb-4 leading-relaxed">Connect your Google Account to backup data and access it from multiple devices.</p>
                            <Button 
                                onClick={handleGoogleConnect} 
                                disabled={isConnecting}
                                className="bg-white text-indigo-600 hover:bg-indigo-50 border-0 font-bold w-full sm:w-auto shadow-md flex items-center justify-center gap-3"
                            >
                                {isConnecting ? (
                                    <Loader2 size={18} className="animate-spin"/>
                                ) : (
                                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
                                )}
                                <span>{isConnecting ? 'Connecting...' : 'Sign In with Google'}</span>
                            </Button>
                        </div>
                    </div>
                </div>
            </Card>
        )}

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
                        <button onClick={() => { setIsEditingProfile(false); window.history.back(); }} className="text-gray-400 text-xs font-bold hover:text-gray-600">CANCEL</button>
                        <button onClick={handleSaveProfile} className="text-green-600 text-xs font-bold hover:text-green-700 flex items-center gap-1"><Save size={12}/> SAVE</button>
                    </div>
                )}
            </div>
            
            <div className="p-5">
                {isEditingProfile ? (
                    <div className="space-y-5 animate-in fade-in">
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

        {/* 8. Sync Status & Cloud Backups */}
        <Card className="p-0 overflow-hidden shadow-md ring-1 ring-black/5">
            <div className="bg-white p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm border ${googleProfile ? 'bg-green-50 border-green-100' : 'bg-gray-100 border-gray-200'}`}>
                         {googleProfile ? (
                            <img src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg" alt="Drive" className="w-7 h-7" />
                         ) : (
                            <CloudOff size={24} className="text-gray-400"/>
                         )}
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 text-lg">
                            {googleProfile ? 'Database Synced' : 'Drive Unconnected'}
                        </h3>
                        <p className="text-sm text-gray-500">
                           {googleProfile ? `Last saved: ${lastBackup || 'Just now'}` : 'Local storage only'}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={handleOpenBackupModal} 
                        className={`p-2.5 rounded-full border bg-white border-gray-200 shadow-sm transition-all ${googleProfile ? 'text-gray-600 hover:bg-gray-50 active:scale-95' : 'text-gray-300 cursor-not-allowed'}`}
                        title="Cloud Backups"
                        disabled={!googleProfile}
                    >
                        <ArchiveRestore size={20} />
                    </button>
                    <button 
                        onClick={handleForceSync} 
                        disabled={isSyncing || !googleProfile}
                        className={`p-2.5 rounded-full border transition-all ${isSyncing || !googleProfile ? 'bg-gray-100 text-gray-400' : 'bg-white text-blue-600 border-blue-100 hover:bg-blue-50 shadow-sm active:scale-95'}`}
                        title="Force Cloud Sync"
                    >
                        <RefreshCw size={20} className={isSyncing ? "animate-spin" : ""} />
                    </button>
                </div>
            </div>
            <div className="bg-gray-50 px-5 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <div className={`flex items-center gap-1 font-mono ${!googleProfile ? 'text-red-500' : 'text-green-600'}`}>
                    {googleProfile ? <CheckSquare size={12}/> : <AlertTriangle size={12}/>}
                    {googleProfile?.email || 'Not Connected'}
                </div>
                <div>{googleProfile ? 'StoreManager_DB' : 'Local_Cache'}</div>
            </div>
        </Card>

        {/* 3. Printer Configuration */}
        <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-black/5">
             <div className="bg-white p-4 border-b border-gray-100 flex items-center gap-2">
                 <Printer size={20} className="text-gray-700"/>
                 <h2 className="font-bold text-gray-800">Printer Configuration</h2>
             </div>
             <div className="p-5 space-y-4">
                 <div className="flex items-center justify-between gap-4">
                     <div>
                         <div className="font-semibold text-gray-800">Direct Thermal Printing</div>
                         <p className="text-sm text-gray-500">Automatically trigger print dialog without downloading PDF.</p>
                     </div>
                     <button 
                        onClick={handleToggleDirectPrint}
                        className={`w-14 h-8 shrink-0 rounded-full transition-all duration-300 relative shadow-inner ${storeSettings?.directPrintEnabled ? 'bg-blue-600' : 'bg-gray-200'}`}
                     >
                        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 shadow-md ${storeSettings?.directPrintEnabled ? 'translate-x-7' : 'translate-x-1'}`}></div>
                    </button>
                 </div>
                 
                 {!storeSettings?.directPrintEnabled && (
                     <div className="pt-2">
                         <Button onClick={handleRequestPrinterPermission} variant="neutral" className="w-full flex items-center justify-center gap-2 border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100">
                             <CheckSquare size={18} /> Grant Printer Access
                         </Button>
                         <p className="text-[10px] text-gray-400 mt-2 text-center italic">Enabling this prevents cluttering your 'Downloads' folder with invoice PDFs.</p>
                     </div>
                 )}
             </div>
        </Card>

        {/* 4. Barcode Scanner Preference */}
        <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-black/5">
             <div className="bg-white p-4 border-b border-gray-100 flex items-center gap-2">
                 <Scan size={20} className="text-red-500"/>
                 <h2 className="font-bold text-gray-800">Scanner Configuration</h2>
             </div>
             <div className="p-5 space-y-4">
                 <p className="text-sm text-gray-500">Choose how you want to input barcodes in POS and Warehouse.</p>
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                     {[
                         { id: 'phone', label: 'Phone Camera', icon: Smartphone },
                         { id: 'machine', label: 'External Machine', icon: Printer },
                         { id: 'both', label: 'Both Services', icon: Scan }
                     ].map(pref => (
                         <button
                            key={pref.id}
                            onClick={() => handleScannerPreferenceChange(pref.id as any)}
                            className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all gap-2 ${
                                storeSettings?.scannerPreference === pref.id 
                                ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm' 
                                : 'bg-white border-gray-100 text-gray-500 hover:bg-gray-50'
                            }`}
                         >
                            <pref.icon size={24} />
                            <span className="text-xs font-bold text-center">{pref.label}</span>
                            {storeSettings?.scannerPreference === pref.id && (
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                            )}
                         </button>
                     ))}
                 </div>
                 {storeSettings?.scannerPreference === 'machine' && (
                     <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex gap-2 items-start animate-in zoom-in-95">
                         <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0"/>
                         <p className="text-[10px] text-amber-800 font-medium">
                            Physical scanners behave like keyboards. Ensure the input box is focused before scanning. Camera scanning will be hidden to save battery.
                         </p>
                     </div>
                 )}
             </div>
        </Card>

        {/* 5. Notifications */}
        <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-black/5">
             <div className="bg-white p-4 border-b border-gray-100 flex items-center gap-2">
                 <Bell size={20} className="text-amber-500"/>
                 <h2 className="font-bold text-gray-800">Notifications</h2>
             </div>
             <div className="p-5 flex items-center justify-between gap-4">
                 <div>
                     <div className="font-semibold text-gray-800">Browser Alerts</div>
                     <p className="text-sm text-gray-500">Get notified about low stock and critical events.</p>
                 </div>
                 <button 
                    onClick={handleToggleNotifications}
                    className={`w-14 h-8 shrink-0 rounded-full transition-all duration-300 relative shadow-inner ${storeSettings?.notificationsEnabled ? 'bg-amber-500' : 'bg-gray-200'}`}
                 >
                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 shadow-md ${storeSettings?.notificationsEnabled ? 'translate-x-7' : 'translate-x-1'}`}></div>
                </button>
             </div>
        </Card>

        {/* 6. NAS / Local Server Configuration */}
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
                        <button onClick={() => { setIsEditingNas(false); window.history.back(); }} className="text-gray-400 text-xs font-bold hover:text-gray-600">CANCEL</button>
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
                     <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-purple-100 gap-3">
                         <span className="font-bold text-gray-700 text-sm">Sync Data to NAS</span>
                         <button 
                            onClick={() => setTempNas({...tempNas, syncToNas: !tempNas.syncToNas})}
                            className={`w-12 h-7 shrink-0 rounded-full transition-all duration-300 relative shadow-inner ${tempNas.syncToNas ? 'bg-purple-600' : 'bg-gray-200'}`}
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

        {/* 7. Staff Sharing */}
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
                    <div className="flex flex-col sm:flex-row gap-3">
                        <Input 
                            placeholder="staff.member@gmail.com" 
                            value={inviteEmail} 
                            onChange={(e) => setInviteEmail(e.target.value)}
                            className="flex-1 !py-2.5"
                        />
                        <Button 
                            onClick={handleInviteStaff} 
                            disabled={isInviting || !inviteEmail}
                            className="bg-indigo-600 hover:bg-indigo-700 w-full sm:w-28 flex items-center justify-center"
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

        {/* 9. Data Management Actions */}
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

            <button onClick={() => { setShowResetConfirm(true); window.history.pushState({ tab: Tab.PROFILE, depth: 1 }, ''); }} className="w-full bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between group hover:border-red-300 hover:bg-red-50 transition-all mt-2">
                <div className="flex items-center gap-3">
                    <AlertTriangle size={20} className="text-red-400"/>
                    <span className="font-medium text-red-600">Factory Reset App</span>
                </div>
            </button>
            
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
        </div>

        {/* Recycle Bin Card */}
        <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-black/5 hover:ring-blue-200 transition-all cursor-pointer mt-4" onClick={() => { setShowRecycleBin(true); window.history.pushState({ tab: Tab.PROFILE, depth: 1 }, ''); }}>
             <div className="bg-white p-4 border-b border-gray-100 flex items-center justify-between">
                 <div className="flex items-center gap-2">
                     <Trash2 size={20} className="text-red-500"/>
                     <h2 className="font-bold text-gray-800">Recycle Bin</h2>
                 </div>
                 <div className="bg-red-50 text-red-600 px-2 py-1 rounded-full text-xs font-bold border border-red-100">
                     {deletedItems.length} items
                 </div>
             </div>
             <div className="p-5 flex justify-between items-center">
                 <div>
                     <div className="text-sm font-medium text-gray-700">Recently Deleted</div>
                     <div className="text-xs text-gray-400 mt-1">Restore products, contacts & bills</div>
                 </div>
                 <div className="flex items-center gap-2 text-xs font-bold text-gray-500 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                     <Clock size={14} />
                     Keeps for {recycleRetention} days
                 </div>
             </div>
        </Card>

        {/* Support & Legal */}
        <div className="pt-2 flex flex-col gap-3">
            <h3 className="font-bold text-gray-400 text-xs uppercase tracking-wider px-2">Support & Legal</h3>
            <div className="overflow-hidden bg-white rounded-xl border border-gray-200 shadow-sm hover:border-blue-300 transition-all">
                <button onClick={() => setShowTermsDropdown(!showTermsDropdown)} className="w-full p-4 flex items-center justify-between group bg-white">
                    <div className="flex items-center gap-3">
                        <FileText size={20} className="text-gray-400 group-hover:text-blue-500"/>
                        <span className="font-medium text-gray-700">Terms & Conditions</span>
                    </div>
                    {showTermsDropdown ? <ChevronDown size={18} className="text-gray-500"/> : <ChevronRight size={18} className="text-gray-300"/>}
                </button>
                {showTermsDropdown && (
                    <div className="px-4 pb-4 pt-0 bg-white animate-in slide-in-from-top-2">
                        <div className="pt-3 border-t border-gray-100">
                            <a href="https://terms-conditions-store.vercel.app" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors">
                                <ExternalLink size={16} className="text-gray-500"/>
                                <span className="text-sm font-bold text-gray-800">View Online</span>
                            </a>
                        </div>
                    </div>
                )}
            </div>

            <div className="overflow-hidden bg-white rounded-xl border border-gray-200 shadow-sm hover:border-indigo-300 transition-all">
                <button onClick={() => setShowPrivacyDropdown(!showPrivacyDropdown)} className="w-full p-4 flex items-center justify-between group bg-white">
                    <div className="flex items-center gap-3">
                        <ShieldCheck size={20} className="text-gray-400 group-hover:text-indigo-500"/>
                        <span className="font-medium text-gray-700">Privacy Policy</span>
                    </div>
                    {showPrivacyDropdown ? <ChevronDown size={18} className="text-gray-500"/> : <ChevronRight size={18} className="text-gray-300"/>}
                </button>
                {showPrivacyDropdown && (
                    <div className="px-4 pb-4 pt-0 bg-white animate-in slide-in-from-top-2">
                        <div className="pt-3 border-t border-gray-100">
                            <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors">
                                <ExternalLink size={16} className="text-gray-500"/>
                                <span className="text-sm font-bold text-gray-800">Read Policy</span>
                            </a>
                        </div>
                    </div>
                )}
            </div>

            <div className="overflow-hidden bg-white rounded-xl border border-gray-200 shadow-sm hover:border-green-300 transition-all">
                <button onClick={() => setShowContactDropdown(!showContactDropdown)} className="w-full p-4 flex items-center justify-between group bg-white">
                    <div className="flex items-center gap-3">
                        <Headphones size={20} className="text-gray-400 group-hover:text-green-500"/>
                        <span className="font-medium text-gray-700">Contact Support</span>
                    </div>
                    {showContactDropdown ? <ChevronDown size={18} className="text-gray-500"/> : <ChevronRight size={18} className="text-gray-300"/>}
                </button>
                {showContactDropdown && (
                    <div className="px-4 pb-4 pt-0 bg-white animate-in slide-in-from-top-2">
                        <div className="pt-3 border-t border-gray-100">
                            <a href="mailto:newluckypharmacy@gmail.com" className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors">
                                <Mail size={16} className="text-gray-500"/>
                                <span className="text-sm font-bold text-gray-800">newluckypharmacy@gmail.com</span>
                            </a>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* Cloud Backups Modal */}
        <Modal isOpen={showBackupModal} onClose={() => { setShowBackupModal(false); window.history.back(); }} title="Cloud Backups">
            <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm text-blue-800">
                    <p>Backups are snapshot files saved in <strong>NoorPOS_Data/Backups</strong> in your Google Drive. They help recover data if the main sync fails.</p>
                </div>
                
                <Button 
                    onClick={handleCreateCloudBackup} 
                    disabled={isCreatingBackup}
                    className="w-full bg-blue-600 hover:bg-blue-700 flex justify-center items-center gap-2"
                >
                    {isCreatingBackup ? <Loader2 size={18} className="animate-spin"/> : <Cloud size={18} />}
                    Create New Backup Now
                </Button>

                <div className="border-t border-gray-100 pt-4 mt-4">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Available Backups</h3>
                    
                    {isLoadingBackups ? (
                        <div className="flex justify-center py-4"><Loader2 size={24} className="animate-spin text-gray-300"/></div>
                    ) : cloudBackups.length === 0 ? (
                        <p className="text-center text-gray-400 text-sm py-2">No backups found.</p>
                    ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                            {cloudBackups.map(file => (
                                <div key={file.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 transition-colors group">
                                    <div className="min-w-0">
                                        <div className="font-medium text-gray-800 text-sm truncate">{file.name}</div>
                                        <div className="text-[10px] text-gray-400">{new Date(file.createdTime || '').toLocaleString()}</div>
                                    </div>
                                    <button 
                                        onClick={() => handleRestoreBackup(file.id)}
                                        disabled={isRestoring}
                                        className="p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors opacity-0 group-hover:opacity-100"
                                        title="Restore this backup"
                                    >
                                        <RefreshCw size={16} className={isRestoring ? "animate-spin" : ""}/>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </Modal>

        {/* Recycle Bin Modal */}
        <Modal isOpen={showRecycleBin} onClose={() => { setShowRecycleBin(false); window.history.back(); }} title="Recycle Bin" className="!max-w-4xl h-[80vh] flex flex-col p-0">
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
                <div className="px-6 py-4 bg-white border-b border-gray-200 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500 font-bold">Auto-delete after:</span>
                        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                            {[7, 15, 30].map(days => (
                                <button key={days} onClick={() => handleSaveRetention(days)} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${recycleRetention === days ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>{days} days</button>
                            ))}
                        </div>
                    </div>
                    {deletedItems.length > 0 && (
                        <Button size="sm" variant="danger" onClick={handleEmptyBin} className="bg-red-100 text-red-600 border border-red-200 shadow-none hover:bg-red-200">Empty Bin</Button>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {deletedItems.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <Trash2 size={48} className="mb-4 opacity-20"/><p>Recycle bin is empty.</p>
                        </div>
                    ) : (
                        Object.entries(groupedDeletedItems).map(([dateLabel, items]) => (
                            <div key={dateLabel}>
                                <div className="flex items-center gap-2 mb-3">
                                    <Calendar size={16} className="text-gray-400"/><h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">{dateLabel}</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {(items as DeletedItem[]).map(item => {
                                        let Icon = Box; let name = "Unknown"; let detail = ""; let colorClass = "bg-blue-100 text-blue-600";
                                        if (item.type === 'product') { Icon = Box; name = item.data.name; detail = `Stock: ${item.data.stock}`; colorClass = "bg-blue-100 text-blue-600"; }
                                        else if (item.type === 'customer') { Icon = Users; name = item.data.name; detail = item.data.phone; colorClass = "bg-purple-100 text-purple-600"; }
                                        else if (item.type === 'sale') { Icon = Receipt; name = `Invoice #${item.data.id.slice(0,6).toUpperCase()}`; detail = `Amount: ₹${item.data.total}`; colorClass = "bg-green-100 text-green-600"; }
                                        return (
                                            <div key={item.id} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center group hover:border-blue-300 transition-colors">
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}><Icon size={20}/></div>
                                                    <div className="min-w-0"><div className="font-bold text-gray-800 text-sm truncate">{name}</div><div className="text-xs text-gray-400 truncate">{detail}</div></div>
                                                </div>
                                                <div className="flex items-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleRestoreItem(item.id)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"><RotateCcw size={16}/></button>
                                                    <button onClick={() => handlePermanentDelete(item.id)} className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors"><Trash2 size={16}/></button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </Modal>

        {/* Reset Confirm Modal */}
        <Modal isOpen={showResetConfirm} onClose={() => { setShowResetConfirm(false); window.history.back(); }} title="Factory Reset">
            <div className="text-center">
                <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle size={32}/></div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Are you absolutely sure?</h3>
                <p className="text-sm text-gray-600 mb-6">This action will delete all products, sales history, and customer data from this device.</p>
                <div className="flex gap-3"><Button variant="neutral" className="flex-1" onClick={() => { setShowResetConfirm(false); window.history.back(); }}>Cancel</Button><Button variant="danger" className="flex-1" onClick={handleReset}>Yes, Reset</Button></div>
            </div>
        </Modal>

        <div className="text-center text-xs text-gray-400 pt-8 pb-4">Noor POS v1.6.0 • Connected</div>
    </div>
  );
};
