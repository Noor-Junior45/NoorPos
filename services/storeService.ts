
import { Product, Sale, Customer, CartItem, Tag, StoreSettings, User, DeletedItem, Payment } from '../types';
import { GoogleDriveUtils, DriveFile } from '../utils/googleDrive';
import { getApiUrl } from './apiConfig';

interface StoreData {
  products: Product[];
  tags: Tag[];
  sales: Sale[];
  customers: Customer[];
  users: User[];
  deletedItems: DeletedItem[];
  settings: StoreSettings;
  logs?: string[];
}

const defaultSettings: StoreSettings = {
  storeName: '',
  storeAddress: '',
  storePhone: '',
  storeEmail: '',
  logo: '',
  expiryAlertDays: 7,
  lowStockDefault: 10,
  soundEnabled: true,
  notificationsEnabled: false,
  emailAlertsEnabled: false, // Default off
  currencySymbol: '₹',
  recycleBinRetentionDays: 30,
  directPrintEnabled: false,
  printPaperSize: 'A4',
  scannerPreference: 'both', 
  nasUrl: 'http://localhost:3000/api/storage',
  syncToNas: false,
  globalDefaultTax: 0,
  maxDiscountLimit: 100
};

const defaultData: StoreData = {
  products: [],
  tags: [],
  sales: [],
  customers: [],
  users: [],
  deletedItems: [],
  settings: defaultSettings,
  logs: []
};

const LS_BACKUP_KEY = 'glassstore_offline_backup';
const LS_NAS_URL = 'noor_nas_url';
const LS_SYNC_NAS = 'noor_sync_nas';
const LS_POS_DRAFT = 'noor_pos_draft';

let cache: StoreData | null = null;
let loadPromise: Promise<StoreData> | null = null;
let saveTimeout: any = null;
let lastBackupTime: string | null = localStorage.getItem('noor_last_backup');
let isCloudSyncHealthy = true; 
let isServerAvailable = true;

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const StoreService = {
  getLastBackupTime() { return lastBackupTime; },
  getSyncStatus() { return isCloudSyncHealthy; },

  async addLog(message: string) {
      const data = await this.loadData();
      if (!data.logs) data.logs = [];
      data.logs.unshift(`[${new Date().toLocaleTimeString()}] ${message}`);
      if (data.logs.length > 50) data.logs.pop();
      await this.saveData();
  },

  async loadData(): Promise<StoreData> {
    if (cache) return cache;
    if (loadPromise) return loadPromise;

    const session = GoogleDriveUtils.getSession();

    loadPromise = new Promise(async (resolve) => {
        let remoteData = null;

        if (session) {
            try {
                remoteData = await GoogleDriveUtils.loadFromSheet(session.accessToken, session.spreadsheetId);
                isCloudSyncHealthy = true;
            } catch (err: any) {
                isCloudSyncHealthy = false;
            }
        } 
        
        if (!remoteData && !session && isServerAvailable) {
            try {
                const res = await fetch(getApiUrl('/api/storage'));
                if (res.ok) {
                    const json = await res.json();
                    if (json) remoteData = json;
                }
            } catch (err) {
                isServerAvailable = false;
            }
        }

        if (remoteData) resolve(this._processRemoteData(remoteData));
        else resolve(this._fallbackToLocal());
    });
    
    return loadPromise.then((d) => { loadPromise = null; return d; });
  },

  _processRemoteData(data: any): StoreData {
    cache = { ...defaultData, ...data, settings: { ...defaultData.settings, ...data.settings } };
    localStorage.setItem(LS_BACKUP_KEY, JSON.stringify(cache));
    lastBackupTime = new Date().toISOString();
    localStorage.setItem('noor_last_backup', lastBackupTime);
    return cache;
  },

  _fallbackToLocal(): StoreData {
    const local = localStorage.getItem(LS_BACKUP_KEY);
    cache = local ? { ...defaultData, ...JSON.parse(local) } : JSON.parse(JSON.stringify(defaultData));
    return cache as StoreData;
  },

  async saveData(): Promise<void> {
    if (!cache) return;
    const session = GoogleDriveUtils.getSession();
    localStorage.setItem(LS_BACKUP_KEY, JSON.stringify(cache));

    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        if (session && isCloudSyncHealthy) {
            await GoogleDriveUtils.saveToSheet(session.accessToken, session.spreadsheetId, cache);
        } else if (isServerAvailable) {
            try {
                await fetch(getApiUrl('/api/storage'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(cache)
                });
            } catch (err) { isServerAvailable = false; }
        }
    }, 800);
  },

  async getInventory() { const data = await this.loadData(); return [...data.products]; },
  async getTags() { const data = await this.loadData(); return [...data.tags]; },
  async getSales() { const data = await this.loadData(); return [...data.sales]; },
  async getCustomers() { const data = await this.loadData(); return [...data.customers]; },
  async getSettings() { const data = await this.loadData(); return data.settings; },
  async saveSettings(settings: StoreSettings) { const data = await this.loadData(); data.settings = settings; await this.saveData(); },
  
  // Local Staff Management
  async addStaff(user: Omit<User, 'id'>) {
      const data = await this.loadData();
      const newUser = { ...user, id: generateId() };
      data.users.push(newUser);
      await this.saveData();
      await this.addLog(`Staff member added: ${user.name}`);
      return newUser;
  },

  async removeStaff(id: string) {
      const data = await this.loadData();
      const idx = data.users.findIndex(u => u.id === id);
      if (idx > -1) {
          const removed = data.users.splice(idx, 1)[0];
          await this.saveData();
          await this.addLog(`Staff member removed: ${removed.name}`);
      }
  },

  async addProduct(p: any) { const data = await this.loadData(); const np = { ...p, id: generateId(), createdAt: new Date().toISOString() }; data.products.push(np); await this.saveData(); return np; },
  async createSale(s: any) { const data = await this.loadData(); const ns = { ...s, id: generateId(), timestamp: new Date().toISOString() }; data.sales.push(ns); await this.saveData(); return ns; },
  async upsertCustomer(c: any) { const data = await this.loadData(); const nc = { ...c, id: c.id || generateId() }; const idx = data.customers.findIndex(cx => cx.id === nc.id); if(idx > -1) data.customers[idx] = nc; else data.customers.push(nc); await this.saveData(); return nc; },
  async getDeletedItems() { const data = await this.loadData(); return data.deletedItems || []; },
  savePOSDraft(d: any) { localStorage.setItem(LS_POS_DRAFT, JSON.stringify(d)); },
  getPOSDraft() { const d = localStorage.getItem(LS_POS_DRAFT); return d ? JSON.parse(d) : null; },
  clearPOSDraft() { localStorage.removeItem(LS_POS_DRAFT); },
  async logout() { GoogleDriveUtils.clearSession(); localStorage.removeItem(LS_BACKUP_KEY); window.location.reload(); },

  async updateProduct(id: string, updates: Partial<Product>) {
    const data = await this.loadData();
    const idx = data.products.findIndex(p => p.id === id);
    if (idx > -1) {
      data.products[idx] = { ...data.products[idx], ...updates };
      await this.saveData();
    }
  },

  async batchAddProducts(products: Partial<Product>[]) {
    const data = await this.loadData();
    const newProducts = products.map(p => ({
      ...p,
      id: generateId(),
      createdAt: new Date().toISOString()
    } as Product));
    data.products.push(...newProducts);
    await this.saveData();
  },

  async updateTag(id: string, updates: Partial<Tag>) {
    const data = await this.loadData();
    const idx = data.tags.findIndex(t => t.id === id);
    if (idx > -1) {
      data.tags[idx] = { ...data.tags[idx], ...updates };
      await this.saveData();
    }
  },

  async addTag(tag: Tag) {
    const data = await this.loadData();
    const nt = { ...tag, id: tag.id || generateId() };
    data.tags.push(nt);
    await this.saveData();
    return nt;
  },

  async deleteProduct(id: string) {
    const data = await this.loadData();
    const idx = data.products.findIndex(p => p.id === id);
    if (idx > -1) {
      const p = data.products.splice(idx, 1)[0];
      data.deletedItems.push({
        id: generateId(),
        originalId: p.id,
        type: 'product',
        data: p,
        deletedAt: new Date().toISOString()
      });
      await this.saveData();
    }
  },

  async deleteTag(id: string) {
    const data = await this.loadData();
    const idx = data.tags.findIndex(t => t.id === id);
    if (idx > -1) {
      const t = data.tags.splice(idx, 1)[0];
      data.deletedItems.push({
        id: generateId(),
        originalId: t.id,
        type: 'tag',
        data: t,
        deletedAt: new Date().toISOString()
      });
      await this.saveData();
    }
  },

  async deleteSales(ids: string[]) {
    const data = await this.loadData();
    ids.forEach(id => {
        const idx = data.sales.findIndex(s => s.id === id);
        if (idx > -1) {
            const s = data.sales.splice(idx, 1)[0];
            data.deletedItems.push({
                id: generateId(),
                originalId: s.id,
                type: 'sale',
                data: s,
                deletedAt: new Date().toISOString()
            });
        }
    });
    await this.saveData();
  },

  async updateSale(sale: Sale) {
    const data = await this.loadData();
    const idx = data.sales.findIndex(s => s.id === sale.id);
    if (idx > -1) {
        data.sales[idx] = sale;
        await this.saveData();
    }
  },

  async deleteCustomer(id: string) {
    const data = await this.loadData();
    const idx = data.customers.findIndex(c => c.id === id);
    if (idx > -1) {
      const c = data.customers.splice(idx, 1)[0];
      data.deletedItems.push({
        id: generateId(),
        originalId: c.id,
        type: 'customer',
        data: c,
        deletedAt: new Date().toISOString()
      });
      await this.saveData();
    }
  },

  async addCustomerPayment(customerId: string, amount: number, method: string, note: string, date: string, receiptImage?: string) {
      const data = await this.loadData();
      const customer = data.customers.find(c => c.id === customerId);
      if (customer) {
          if (!customer.payments) customer.payments = [];
          customer.payments.push({ id: generateId(), amount, method, note, date, receiptImage });
          customer.totalDues = Math.max(0, customer.totalDues - amount);
          await this.saveData();
      }
  },

  async restoreItem(id: string) {
      const data = await this.loadData();
      const idx = data.deletedItems.findIndex(item => item.id === id);
      if (idx > -1) {
          const item = data.deletedItems.splice(idx, 1)[0];
          if (item.type === 'product') data.products.push(item.data);
          else if (item.type === 'customer') data.customers.push(item.data);
          else if (item.type === 'sale') data.sales.push(item.data);
          else if (item.type === 'tag') data.tags.push(item.data);
          await this.saveData();
      }
  },

  async permanentlyDelete(id: string) {
      const data = await this.loadData();
      const idx = data.deletedItems.findIndex(item => item.id === id);
      if (idx > -1) {
          data.deletedItems.splice(idx, 1);
          await this.saveData();
      }
  },

  async emptyRecycleBin() {
      const data = await this.loadData();
      data.deletedItems = [];
      await this.saveData();
  },

  async getRawData() {
      return await this.loadData();
  },

  async importData(newData: any) {
      cache = { ...defaultData, ...newData, settings: { ...defaultData.settings, ...newData.settings } };
      await this.saveData();
      await this.addLog("Database manually imported");
  },

  async factoryReset() {
      localStorage.clear();
      window.location.reload();
  },

  async forceSync() {
      const session = GoogleDriveUtils.getSession();
      if (session) {
          loadPromise = null;
          cache = null;
          await this.loadData();
          await this.addLog("Manual cloud sync forced");
      }
  },

  async getCloudBackups(): Promise<DriveFile[]> {
      const session = GoogleDriveUtils.getSession();
      if (!session) return [];
      return await GoogleDriveUtils.listCloudBackups(session.accessToken);
  },

  async createCloudBackup() {
      const session = GoogleDriveUtils.getSession();
      if (!session) return;
      const data = await this.loadData();
      await GoogleDriveUtils.createCloudBackup(session.accessToken, data);
      await this.addLog("Cloud snapshot captured");
  },

  async restoreCloudBackup(fileId: string) {
      const session = GoogleDriveUtils.getSession();
      if (!session) return;
      const backupData = await GoogleDriveUtils.downloadBackupFile(session.accessToken, fileId);
      await this.importData(backupData);
      await this.addLog("Restored from cloud snapshot");
  }
};

export { StoreService };
