import React, { useState, useEffect, useRef } from 'react';
import { User, DeletedItem, StoreSettings } from '../types';
import { StoreService } from '../services/storeService';
import { GoogleDriveUtils } from '../utils/googleDrive';
import { Card, Button, Modal, Badge } from '../components/UI';
import { 
  Download, Upload, ChevronRight, Trash2, Clock, 
  FileText, ChevronDown, ExternalLink, Headphones, 
  Mail, AlertTriangle, LogOut, RotateCcw, Cloud, 
  CheckCircle, X, ShieldCheck 
} from 'lucide-react';

interface ProfileProps {
  user: User;
  onLogin: (user: User) => void;
  onLogout: () => void;
}

export const Profile: React.FC<ProfileProps> = ({ user, onLogout }) => {
  const [deletedItems, setDeletedItems] = useState<DeletedItem[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [showTermsDropdown, setShowTermsDropdown] = useState(false);
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isGoogleLinked, setIsGoogleLinked] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
    const session = GoogleDriveUtils.getSession();
    setIsGoogleLinked(!!session);
  }, []);

  const loadData = async () => {
    const items = await StoreService.getDeletedItems();
    const currentSettings = await StoreService.getSettings();
    setDeletedItems(items);
    setSettings(currentSettings);
  };

  const handleExport = async () => {
    const data = await StoreService.getRawData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `noor_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        await StoreService.importData(json);
        alert("Data imported successfully. The app will reload.");
      } catch (err) {
        alert("Invalid backup file.");
      }
    };
    reader.readAsText(file);
  };

  const handleRestore = async (id: string) => {
      await StoreService.restoreItem(id);
      loadData();
  };

  const handlePermanentDelete = async (id: string) => {
      await StoreService.permanentlyDelete(id);
      loadData();
  };

  const handleEmptyBin = async () => {
      if(confirm("Are you sure you want to permanently delete all items?")) {
          await StoreService.emptyRecycleBin();
          loadData();
      }
  };

  const handleFactoryReset = async () => {
      await StoreService.factoryReset();
      onLogout();
  };

  const handleLogout = async () => {
      await StoreService.logout();
      onLogout();
  };

  const recycleRetention = settings?.recycleBinRetentionDays || 30;

  return (
    <div className="pb-24 animate-in fade-in max-w-3xl mx-auto space-y-6">
        
        {/* Header Profile Card */}
        <div className="flex items-center gap-4 mb-6 pt-2 px-2">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-indigo-200">
                {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
                <h1 className="text-2xl font-bold text-gray-900">{user.name}</h1>
                <p className="text-gray-500 text-sm">@{user.username} • {user.role}</p>
            </div>
            <button onClick={handleLogout} className="ml-auto p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors" title="Logout">
                <LogOut size={20} />
            </button>
        </div>

        {/* Sync Status */}
        <Card className="border-0 shadow-sm ring-1 ring-black/5 bg-gradient-to-br from-white to-gray-50">
            <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-full ${isGoogleLinked ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'}`}>
                        <Cloud size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-800 text-sm">Cloud Sync</h3>
                        <p className="text-xs text-gray-500">{isGoogleLinked ? 'Connected to Google Drive' : 'Local Mode (Not Synced)'}</p>
                    </div>
                </div>
                {isGoogleLinked ? (
                    <div className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-full border border-green-100">
                        <CheckCircle size={14}/> Active
                    </div>
                ) : (
                    <div className="flex items-center gap-1 text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
                        Offline
                    </div>
                )}
            </div>
        </Card>
        
        {/* Actions */}
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
            
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
        </div>

        {/* Recycle Bin Card */}
        <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-black/5 hover:ring-blue-200 transition-all cursor-pointer mt-4" onClick={() => setShowRecycleBin(true)}>
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

        {/* Factory Reset */}
        <div className="pt-4">
            <button onClick={() => setShowResetConfirm(true)} className="w-full bg-white p-4 rounded-xl border border-red-200 shadow-sm flex items-center justify-between group hover:bg-red-50 transition-all">
                <div className="flex items-center gap-3">
                    <AlertTriangle size={20} className="text-red-400 group-hover:text-red-600"/>
                    <span className="font-medium text-red-600">Factory Reset App</span>
                </div>
            </button>
        </div>

        {/* Recycle Bin Modal */}
        <Modal isOpen={showRecycleBin} onClose={() => setShowRecycleBin(false)} title="Recycle Bin">
             <div className="flex justify-between items-center mb-4">
                 <p className="text-sm text-gray-500">Items are auto-deleted after {recycleRetention} days.</p>
                 {deletedItems.length > 0 && (
                     <Button size="sm" variant="danger" onClick={handleEmptyBin} className="text-xs">Empty Bin</Button>
                 )}
             </div>
             
             <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                 {deletedItems.length === 0 ? (
                     <div className="text-center py-10 text-gray-400">
                         <Trash2 size={32} className="mx-auto mb-2 opacity-20"/>
                         <p>Recycle bin is empty.</p>
                     </div>
                 ) : (
                     deletedItems.map(item => (
                         <div key={item.id} className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex justify-between items-center">
                             <div>
                                 <div className="font-bold text-gray-800 text-sm">
                                     {item.type === 'sale' ? `Sale #${item.originalId.slice(0,5)}` : (item.data.name || 'Unknown')}
                                 </div>
                                 <div className="text-xs text-gray-500 capitalize">
                                     {item.type} • Deleted {new Date(item.deletedAt).toLocaleDateString()}
                                 </div>
                             </div>
                             <div className="flex gap-2">
                                 <button onClick={() => handleRestore(item.id)} className="p-1.5 bg-blue-100 text-blue-600 rounded hover:bg-blue-200" title="Restore"><RotateCcw size={16}/></button>
                                 <button onClick={() => handlePermanentDelete(item.id)} className="p-1.5 bg-red-100 text-red-600 rounded hover:bg-red-200" title="Delete Forever"><X size={16}/></button>
                             </div>
                         </div>
                     ))
                 )}
             </div>
        </Modal>

        {/* Reset Confirm Modal */}
        <Modal isOpen={showResetConfirm} onClose={() => setShowResetConfirm(false)} title="Factory Reset">
            <div className="text-center py-4">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <AlertTriangle size={32} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Are you absolutely sure?</h3>
                <p className="text-sm text-gray-500 mb-6 px-4">
                    This action will <strong>permanently delete all data</strong> (products, sales, customers) from this device. If not backed up to Google Drive, data will be lost.
                </p>
                <div className="flex gap-3">
                    <Button variant="neutral" className="flex-1" onClick={() => setShowResetConfirm(false)}>Cancel</Button>
                    <Button variant="danger" className="flex-1" onClick={handleFactoryReset}>Yes, Reset</Button>
                </div>
            </div>
        </Modal>

    </div>
  );
};