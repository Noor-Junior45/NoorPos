
import { Product, Sale, Customer, CartItem, Tag, StoreSettings, User, DeletedItem, Payment } from '../types';
import { GoogleDriveUtils } from '../utils/googleDrive';

interface StoreData {
  products: Product[];
  tags: Tag[];
  sales: Sale[];
  customers: Customer[];
  users: User[];
  deletedItems: DeletedItem[];
  settings: StoreSettings;
}

// Initial Data for fresh starts
const initialTags: Tag[] = []; 

const initialProducts: Product[] = []; 
const initialCustomers: Customer[] = [];
const initialUsers: User[] = [];
const initialDeletedItems: DeletedItem[] = [];

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
  currencySymbol: '₹',
  recycleBinRetentionDays: 30,
  directPrintEnabled: false,
  scannerPreference: 'both', // Default to both
  nasUrl: 'http://localhost:3000/api/storage',
  syncToNas: false
};

const defaultData: StoreData = {
  products: initialProducts,
  tags: initialTags,
  sales: [],
  customers: initialCustomers,
  users: initialUsers,
  deletedItems: initialDeletedItems,
  settings: defaultSettings
};

// LocalStorage Keys
const LS_BACKUP_KEY = 'glassstore_offline_backup';
const LS_NAS_URL = 'noor_nas_url';
const LS_SYNC_NAS = 'noor_sync_nas';

// In-memory cache
let cache: StoreData | null = null;
let loadPromise: Promise<StoreData> | null = null;
let saveTimeout: any = null;
let lastBackupTime: string | null = localStorage.getItem('noor_last_backup');
let isCloudSyncHealthy = true; // Safety flag

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
  
  getLastBackupTime() {
      return lastBackupTime;
  },

  sendBrowserNotification(title: string, body: string) {
      if (cache?.settings?.notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
          try {
              new Notification(title, { 
                  body, 
                  icon: 'https://lh3.googleusercontent.com/p/AF1QipPlp0QUwcp2FOnTGiGNf5fqWnskinCj4QxRKa3o=s1360-w1360-h1020-rw' 
              });
          } catch (e) {
              console.warn("Failed to trigger notification:", e);
          }
      }
  },

  // NEW: Manual Cloud Sync
  async forceSync(): Promise<boolean> {
      const session = GoogleDriveUtils.getSession();
      if (!session) return false;

      // Reset cache to force reload
      cache = null;
      loadPromise = null;
      
      try {
          // This will trigger a fresh fetch from Google Drive
          await this.loadData();
          
          // Check if the load resulted in a healthy cloud state
          if (!isCloudSyncHealthy) {
              throw new Error("Cloud sync failed. Check internet connection.");
          }
          return true;
      } catch (e) {
          console.error("Force sync failed", e);
          throw e;
      }
  },

  // Core: Load data
  async loadData(): Promise<StoreData> {
    if (cache) return cache;
    if (loadPromise) return loadPromise;

    const session = GoogleDriveUtils.getSession();
    const nasUrl = localStorage.getItem(LS_NAS_URL);
    const syncToNas = localStorage.getItem(LS_SYNC_NAS) === 'true';

    loadPromise = new Promise(async (resolve) => {
        let remoteData = null;

        // 1. Try Google Sheet
        if (session) {
            console.log("Loading from Google Sheet...");
            try {
                remoteData = await GoogleDriveUtils.loadFromSheet(session.accessToken, session.spreadsheetId);
                
                // If loadFromSheet returns data, we are good.
                // If it returns null, it usually means the sheet is empty or completely unreadable.
                
                isCloudSyncHealthy = true; // Assume healthy if no error thrown
            } catch (err) {
                console.error("Cloud load CRITICAL FAILURE:", err);
                // IMPORTANT: If cloud load fails, we mark sync as unhealthy to prevent auto-saving empty local data over cloud data.
                isCloudSyncHealthy = false;
                
                // If we have local backup, use it, but warn user
                const local = localStorage.getItem(LS_BACKUP_KEY);
                if (local) {
                    console.log("Falling back to offline cache due to cloud error.");
                    resolve(JSON.parse(local));
                    return;
                }
            }
        } 
        
        // 2. Try NAS
        if (!remoteData && syncToNas && nasUrl) {
            console.log(`Loading from NAS: ${nasUrl}...`);
            try {
                const res = await fetch(nasUrl);
                if (res.ok) {
                    const json = await res.json();
                    if (json) remoteData = json;
                }
            } catch (err) {
                 console.warn("NAS load failed:", err);
            }
        }

        // 3. Fallback Local Server / LocalStorage
        if (!remoteData) {
            // Only try local server if strictly not using NAS (Guest mode)
            if (!syncToNas && !session) {
                try {
                    const res = await fetch('/api/storage');
                    if (res.ok) {
                        const json = await res.json();
                        if (json) remoteData = json;
                    }
                } catch (err) {
                    console.log("Local server unreachable.");
                }
            }
        }

        if (remoteData) {
            resolve(this._processRemoteData(remoteData));
        } else {
            console.log("Using local browser storage.");
            resolve(this._fallbackToLocal());
        }
    });
    
    return loadPromise.then(async (d) => { 
        loadPromise = null; 
        // Run auto-cleanup logic on load
        await this._cleanupRecycleBin(d);
        return d; 
    });
  },

  async _cleanupRecycleBin(data: StoreData) {
      if (!data.deletedItems) data.deletedItems = [];
      const retentionDays = data.settings.recycleBinRetentionDays || 30;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const initialCount = data.deletedItems.length;
      data.deletedItems = data.deletedItems.filter(item => {
          const deletedAt = new Date(item.deletedAt);
          return deletedAt > cutoffDate;
      });

      // ONLY save if we actually removed something. 
      // Prevents "Save on Load" loop that causes data overwrite issues on new devices.
      if (data.deletedItems.length !== initialCount) {
          console.log(`Auto-cleaned ${initialCount - data.deletedItems.length} expired items from recycle bin.`);
          this.saveData();
      }
  },

  _processRemoteData(data: any): StoreData {
    cache = { 
        ...defaultData, 
        ...data, 
        settings: { ...defaultData.settings, ...data.settings }
    };
    
    if (cache?.settings) {
        if (cache.settings.nasUrl) localStorage.setItem(LS_NAS_URL, cache.settings.nasUrl);
        if (cache.settings.syncToNas !== undefined) localStorage.setItem(LS_SYNC_NAS, String(cache.settings.syncToNas));
    }
    
    localStorage.setItem(LS_BACKUP_KEY, JSON.stringify(cache));
    lastBackupTime = new Date().toISOString();
    localStorage.setItem('noor_last_backup', lastBackupTime);
    return cache as StoreData;
  },

  _fallbackToLocal(): StoreData {
    const local = localStorage.getItem(LS_BACKUP_KEY);
    const nasUrl = localStorage.getItem(LS_NAS_URL);
    const syncToNas = localStorage.getItem(LS_SYNC_NAS) === 'true';

    let data = local ? { ...defaultData, ...JSON.parse(local) } : JSON.parse(JSON.stringify(defaultData));
    
    if (nasUrl) data.settings.nasUrl = nasUrl;
    data.settings.syncToNas = syncToNas;

    cache = data;
    return cache as StoreData;
  },

  async saveData(): Promise<void> {
    if (!cache) return;
    
    // SAFETY CHECK: If cloud sync previously failed, DO NOT auto-save empty/stale data over the cloud.
    const session = GoogleDriveUtils.getSession();
    if (session && !isCloudSyncHealthy) {
        console.warn("Skipping Cloud Save: Sync is unhealthy. Please refresh to try connecting again.");
        return;
    }

    localStorage.setItem(LS_BACKUP_KEY, JSON.stringify(cache));
    lastBackupTime = new Date().toISOString();
    localStorage.setItem('noor_last_backup', lastBackupTime);

    if (cache.settings.nasUrl) localStorage.setItem(LS_NAS_URL, cache.settings.nasUrl);
    localStorage.setItem(LS_SYNC_NAS, String(cache.settings.syncToNas));

    if (saveTimeout) clearTimeout(saveTimeout);
    
    saveTimeout = setTimeout(async () => {
      try {
        if (session) {
             await GoogleDriveUtils.saveToSheet(session.accessToken, session.spreadsheetId, cache);
        } 
        
        if (cache?.settings.syncToNas && cache?.settings.nasUrl) {
             await fetch(cache.settings.nasUrl, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify(cache)
             });
        } else if (!session) {
             await fetch('/api/storage', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify(cache)
             });
        }
      } catch (err) {
        console.error("Remote save error:", err);
      }
    }, 2000);
  },

  // --- Recycle Bin Logic ---
  async getDeletedItems(): Promise<DeletedItem[]> {
      const data = await this.loadData();
      return data.deletedItems || [];
  },

  async restoreItem(deletedItemId: string): Promise<void> {
      const data = await this.loadData();
      const itemIndex = data.deletedItems.findIndex(i => i.id === deletedItemId);
      if (itemIndex === -1) return;

      const item = data.deletedItems[itemIndex];
      
      // Restore based on type
      if (item.type === 'product') {
          // Check if product with ID already exists (unlikely but possible if manually created)
          if (!data.products.find(p => p.id === item.data.id)) {
              data.products.push(item.data);
          } else {
              // ID collision, generate new ID
              data.products.push({ ...item.data, id: generateId(), name: item.data.name + ' (Restored)' });
          }
      } else if (item.type === 'customer') {
          if (!data.customers.find(c => c.id === item.data.id)) {
              data.customers.push(item.data);
          }
      } else if (item.type === 'sale') {
          if (!data.sales.find(s => s.id === item.data.id)) {
              data.sales.push(item.data);
              // Note: Stock adjustments are complex on restore. 
              // For simplicity, we just restore the record. User must adjust stock manually if needed.
          }
      } else if (item.type === 'tag') {
          if (!data.tags.find(t => t.id === item.data.id)) {
              data.tags.push(item.data);
          }
      }

      // Remove from bin
      data.deletedItems.splice(itemIndex, 1);
      this.saveData();
  },

  async permanentlyDelete(deletedItemId: string): Promise<void> {
      const data = await this.loadData();
      data.deletedItems = data.deletedItems.filter(i => i.id !== deletedItemId);
      this.saveData();
  },

  async emptyRecycleBin(): Promise<void> {
      const data = await this.loadData();
      data.deletedItems = [];
      this.saveData();
  },

  // --- General Methods ---
  async getRawData(): Promise<StoreData> { return await this.loadData(); },
  
  async importData(newData: any): Promise<void> {
    if (!newData.products || !Array.isArray(newData.products)) throw new Error("Invalid backup file");
    cache = { ...defaultData, ...newData };
    // Explicitly set healthy on import
    isCloudSyncHealthy = true; 
    await this.saveData();
    window.location.reload();
  },

  async factoryReset(): Promise<void> {
    cache = JSON.parse(JSON.stringify(defaultData));
    localStorage.removeItem(LS_NAS_URL);
    localStorage.removeItem(LS_SYNC_NAS);
    await this.saveData();
    window.location.reload();
  },

  async logout(): Promise<void> {
      GoogleDriveUtils.clearSession();
      // Clear local backup to ensure clean state for next user
      localStorage.removeItem(LS_BACKUP_KEY);
      cache = null;
      window.location.reload();
  },

  // --- Users ---
  async authenticate(username: string, pin: string): Promise<User | null> {
    const data = await this.loadData();
    const user = data.users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.pin === pin);
    if (user) { user.lastLogin = new Date().toISOString(); this.saveData(); return user; }
    return null;
  },

  async registerUser(userData: { username: string, pin: string, name: string, role: 'admin' | 'staff' }): Promise<User> {
    const data = await this.loadData();
    if (data.users.find(u => u.username.toLowerCase() === userData.username.toLowerCase())) throw new Error("Username taken");
    const newUser: User = { id: generateId(), ...userData, lastLogin: new Date().toISOString() };
    data.users.push(newUser);
    this.saveData();
    return newUser;
  },

  // --- Inventory (Updated with Soft Delete) ---
  async getInventory(): Promise<Product[]> { const data = await this.loadData(); return data.products; },

  async addProduct(product: Omit<Product, 'id'>): Promise<Product> {
    const data = await this.loadData();
    const newProduct = { ...product, id: generateId(), createdAt: new Date().toISOString() };
    data.products.push(newProduct);
    this.saveData();
    return newProduct;
  },

  async batchAddProducts(productsToAdd: Partial<Product>[]): Promise<void> {
    const data = await this.loadData();
    productsToAdd.forEach(p => {
        const matchedTag = data.tags.find(t => t.name.toLowerCase() === (p.category || '').toLowerCase());
        const newProduct: Product = {
            id: generateId(),
            name: p.name || 'Unknown',
            sku: p.sku || generateId().slice(0, 6),
            stock: p.stock || 0,
            unit: p.unit || 'pcs',
            lowStockThreshold: data.settings.lowStockDefault,
            buyPrice: p.buyPrice || 0,
            sellPrice: p.sellPrice || 0,
            location: 'Warehouse',
            tagId: matchedTag ? matchedTag.id : undefined,
            createdAt: new Date().toISOString(),
            ...p
        } as Product;
        data.products.push(newProduct);
    });
    this.saveData();
  },

  async updateProduct(id: string, updates: Partial<Product>): Promise<void> {
    const data = await this.loadData();
    const index = data.products.findIndex(p => p.id === id);
    if (index !== -1) {
      const oldStock = data.products[index].stock;
      data.products[index] = { ...data.products[index], ...updates };
      if (updates.stock !== undefined && updates.stock < oldStock) {
         if (updates.stock <= data.products[index].lowStockThreshold) {
             this.sendBrowserNotification("Low Stock Alert", `${data.products[index].name} is running low.`);
         }
      }
      this.saveData();
    }
  },

  async deleteProduct(id: string): Promise<void> {
    const data = await this.loadData();
    const product = data.products.find(p => p.id === id);
    if (product) {
        // Move to recycle bin
        if (!data.deletedItems) data.deletedItems = [];
        data.deletedItems.push({
            id: generateId(),
            originalId: product.id,
            type: 'product',
            data: product,
            deletedAt: new Date().toISOString()
        });
        
        data.products = data.products.filter(p => p.id !== id);
        this.saveData();
    }
  },

  // --- Tags (Updated with Soft Delete) ---
  async getTags(): Promise<Tag[]> { const data = await this.loadData(); return data.tags; },

  async addTag(tag: Omit<Tag, 'id'>): Promise<Tag> {
    const data = await this.loadData();
    const newTag = { ...tag, id: generateId() };
    data.tags.push(newTag);
    this.saveData();
    return newTag;
  },

  async deleteTag(id: string): Promise<void> {
    const data = await this.loadData();
    const tag = data.tags.find(t => t.id === id);
    if (tag) {
        if (!data.deletedItems) data.deletedItems = [];
        data.deletedItems.push({
            id: generateId(),
            originalId: tag.id,
            type: 'tag',
            data: tag,
            deletedAt: new Date().toISOString()
        });
        data.tags = data.tags.filter(t => t.id !== id);
        this.saveData();
    }
  },

  // --- Sales (Updated with Soft Delete) ---
  async getSales(): Promise<Sale[]> { const data = await this.loadData(); return data.sales; },

  async createSale(saleData: any): Promise<Sale> {
    const data = await this.loadData();
    const amountPaid = saleData.amountPaid !== undefined ? saleData.amountPaid : saleData.total;
    const dueAmount = saleData.total - amountPaid;

    const newSale: Sale = { id: generateId(), timestamp: new Date().toISOString(), ...saleData, amountPaid };
    data.sales.push(newSale);

    for (const soldItem of saleData.items) {
      const productIndex = data.products.findIndex(p => p.id === soldItem.id);
      if (productIndex !== -1) {
        data.products[productIndex].stock = Math.max(0, data.products[productIndex].stock - soldItem.quantity);
        if (data.products[productIndex].stock <= data.products[productIndex].lowStockThreshold) {
            this.sendBrowserNotification("Stock Alert", `${data.products[productIndex].name} reached low stock.`);
        }
      }
    }

    if (saleData.customerId) {
      const custIndex = data.customers.findIndex(c => c.id === saleData.customerId);
      if (custIndex !== -1) {
        data.customers[custIndex].visitCount += 1;
        data.customers[custIndex].totalSpent += saleData.total;
        data.customers[custIndex].history.push(newSale.id);
        if (dueAmount > 0) data.customers[custIndex].totalDues = (data.customers[custIndex].totalDues || 0) + dueAmount;
      }
    }
    this.saveData();
    return newSale;
  },

  async updateSale(updatedSale: Sale): Promise<void> {
    const data = await this.loadData();
    const index = data.sales.findIndex(s => s.id === updatedSale.id);
    if (index === -1) throw new Error("Sale not found");

    const oldSale = data.sales[index];
    // Revert old stock
    oldSale.items.forEach(oldItem => {
      const pIndex = data.products.findIndex(p => p.id === oldItem.id);
      if (pIndex !== -1) data.products[pIndex].stock += oldItem.quantity;
    });
    // Apply new stock
    updatedSale.items.forEach(newItem => {
      const pIndex = data.products.findIndex(p => p.id === newItem.id);
      if (pIndex !== -1) data.products[pIndex].stock = Math.max(0, data.products[pIndex].stock - newItem.quantity);
    });
    
    // Update Customer Dues Logic (simplified)
    if (oldSale.customerId) {
        const custIndex = data.customers.findIndex(c => c.id === oldSale.customerId);
        if (custIndex !== -1) {
            const oldPaid = oldSale.amountPaid ?? (oldSale.paymentMethod === 'Pay Later' ? 0 : oldSale.total);
            const oldDue = oldSale.total - oldPaid;
            const newPaid = updatedSale.amountPaid ?? (updatedSale.paymentMethod === 'Pay Later' ? 0 : updatedSale.total);
            const newDue = updatedSale.total - newPaid;
            data.customers[custIndex].totalSpent = data.customers[custIndex].totalSpent - oldSale.total + updatedSale.total;
            data.customers[custIndex].totalDues = data.customers[custIndex].totalDues - oldDue + newDue;
        }
    }

    data.sales[index] = updatedSale;
    this.saveData();
  },

  async deleteSales(ids: string[]): Promise<void> {
    const data = await this.loadData();
    const idSet = new Set(ids);
    
    // Move to bin
    const salesToDelete = data.sales.filter(s => idSet.has(s.id));
    if (!data.deletedItems) data.deletedItems = [];
    
    salesToDelete.forEach(s => {
        data.deletedItems.push({
            id: generateId(),
            originalId: s.id,
            type: 'sale',
            data: s,
            deletedAt: new Date().toISOString()
        });
        
        // Revert stock when deleted
        s.items.forEach(item => {
            const p = data.products.find(p => p.id === item.id);
            if(p) p.stock += item.quantity;
        });
    });

    data.sales = data.sales.filter(s => !idSet.has(s.id));
    this.saveData();
  },

  // --- Customers (Updated with Soft Delete & Payments) ---
  async getCustomers(): Promise<Customer[]> { const data = await this.loadData(); return data.customers; },

  async upsertCustomer(customer: Partial<Customer>): Promise<Customer> {
    const data = await this.loadData();
    if (customer.id) {
      const index = data.customers.findIndex(c => c.id === customer.id);
      if (index !== -1) {
        data.customers[index] = { ...data.customers[index], ...customer } as Customer;
        this.saveData();
        return data.customers[index];
      }
    }
    const newCustomer: Customer = { 
        id: generateId(), 
        name: customer.name || 'Unknown', 
        phone: customer.phone || '', 
        email: customer.email || '', 
        location: customer.location || '', 
        totalSpent: 0, 
        totalDues: 0, 
        visitCount: 0, 
        history: [],
        payments: []
    };
    data.customers.push(newCustomer);
    this.saveData();
    return newCustomer;
  },

  async addCustomerPayment(customerId: string, amount: number, method: string, note: string, dateStr?: string): Promise<Customer> {
      const data = await this.loadData();
      const index = data.customers.findIndex(c => c.id === customerId);
      if (index === -1) throw new Error("Customer not found");

      const payment: Payment = {
          id: generateId(),
          amount,
          date: dateStr || new Date().toISOString(),
          method,
          note
      };

      if (!data.customers[index].payments) data.customers[index].payments = [];
      data.customers[index].payments.push(payment);
      
      // Reduce Dues (Don't go below 0 for now, although credit is possible in real accounting)
      data.customers[index].totalDues = Math.max(0, (data.customers[index].totalDues || 0) - amount);
      
      this.saveData();
      return data.customers[index];
  },

  async deleteCustomer(id: string): Promise<void> {
    const data = await this.loadData();
    const customer = data.customers.find(c => c.id === id);
    if (customer) {
        if (!data.deletedItems) data.deletedItems = [];
        data.deletedItems.push({
            id: generateId(),
            originalId: customer.id,
            type: 'customer',
            data: customer,
            deletedAt: new Date().toISOString()
        });
        data.customers = data.customers.filter(c => c.id !== id);
        this.saveData();
    }
  },

  // --- Settings ---
  async getSettings(): Promise<StoreSettings> { const data = await this.loadData(); return data.settings; },

  async saveSettings(settings: StoreSettings): Promise<void> {
    const data = await this.loadData();
    data.settings = settings;
    this.saveData();
  }
};

export { StoreService };
