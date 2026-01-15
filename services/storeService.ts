
import { Product, Sale, Customer, CartItem, Tag, StoreSettings, User } from '../types';
import { GoogleDriveUtils } from '../utils/googleDrive';

interface StoreData {
  products: Product[];
  tags: Tag[];
  sales: Sale[];
  customers: Customer[];
  users: User[];
  settings: StoreSettings;
}

// Initial Data for fresh starts
const initialTags: Tag[] = []; // Start clean, no pre-filled tags

const initialProducts: Product[] = []; // Start clean, no pre-filled products
const initialCustomers: Customer[] = [];
const initialUsers: User[] = [];

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
  nasUrl: 'http://localhost:3000/api/storage',
  syncToNas: false
};

const defaultData: StoreData = {
  products: initialProducts,
  tags: initialTags,
  sales: [],
  customers: initialCustomers,
  users: initialUsers,
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

  // Helper to trigger browser notification
  sendBrowserNotification(title: string, body: string) {
      if (cache?.settings?.notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
          new Notification(title, { body, icon: '/vite.svg' });
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

        // 1. Try Google Sheet if Session exists
        if (session) {
            console.log("Loading from Google Sheet...");
            try {
                remoteData = await GoogleDriveUtils.loadFromSheet(session.accessToken, session.spreadsheetId);
            } catch (err) {
                console.warn("Cloud load failed, trying alternates:", err);
            }
        } 
        
        // 2. Try configured NAS if Google failed or not active
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

        // 3. Fallback to default local server (if not explicit NAS)
        if (!remoteData && !syncToNas) {
            console.log("Trying default local server...");
            try {
                const res = await fetch('/api/storage');
                if (res.ok) {
                    const json = await res.json();
                    if (json) remoteData = json;
                }
            } catch (err) {
                console.log("Local server unreachable, using browser storage.");
            }
        }

        // 4. Process or Fallback
        if (remoteData) {
            resolve(this._processRemoteData(remoteData));
        } else {
            console.log("Using local browser storage.");
            resolve(this._fallbackToLocal());
        }
    });
    
    return loadPromise.then(d => { loadPromise = null; return d; });
  },

  _processRemoteData(data: any): StoreData {
    console.log("Remote/Server storage loaded.");
    // Merge defaults to ensure new fields in 'settings' don't break old backups
    cache = { 
        ...defaultData, 
        ...data, 
        settings: { ...defaultData.settings, ...data.settings }
    };
    
    // Ensure LocalStorage configs are consistent with loaded settings
    if (cache?.settings) {
        if (cache.settings.nasUrl) localStorage.setItem(LS_NAS_URL, cache.settings.nasUrl);
        if (cache.settings.syncToNas !== undefined) localStorage.setItem(LS_SYNC_NAS, String(cache.settings.syncToNas));
    }
    
    // Update local backup
    localStorage.setItem(LS_BACKUP_KEY, JSON.stringify(cache));
    lastBackupTime = new Date().toISOString();
    localStorage.setItem('noor_last_backup', lastBackupTime);
    return cache as StoreData;
  },

  _fallbackToLocal(): StoreData {
    const local = localStorage.getItem(LS_BACKUP_KEY);
    // Recover settings from LocalStorage keys if cache is rebuilt from scratch/defaults
    const nasUrl = localStorage.getItem(LS_NAS_URL);
    const syncToNas = localStorage.getItem(LS_SYNC_NAS) === 'true';

    let data = local ? { ...defaultData, ...JSON.parse(local) } : JSON.parse(JSON.stringify(defaultData));
    
    // Apply local connection config overrides
    if (nasUrl) data.settings.nasUrl = nasUrl;
    data.settings.syncToNas = syncToNas;

    cache = data;
    return cache as StoreData;
  },

  // Core: Save data
  async saveData(): Promise<void> {
    if (!cache) return;
    
    // 1. Always save to LocalStorage immediately
    localStorage.setItem(LS_BACKUP_KEY, JSON.stringify(cache));
    lastBackupTime = new Date().toISOString();
    localStorage.setItem('noor_last_backup', lastBackupTime);

    // Persist Connection settings separately for boot-up
    if (cache.settings.nasUrl) localStorage.setItem(LS_NAS_URL, cache.settings.nasUrl);
    localStorage.setItem(LS_SYNC_NAS, String(cache.settings.syncToNas));

    // 2. Debounced Sync to Backend (Cloud or Local Server)
    if (saveTimeout) clearTimeout(saveTimeout);
    
    saveTimeout = setTimeout(async () => {
      const session = GoogleDriveUtils.getSession();
      
      try {
        // Sync to Google
        if (session) {
             await GoogleDriveUtils.saveToSheet(session.accessToken, session.spreadsheetId, cache);
             console.log("Synced to Google Sheet");
        } 
        
        // Sync to NAS / Local Server (Can happen concurrently with Google if both enabled)
        if (cache?.settings.syncToNas && cache?.settings.nasUrl) {
             const res = await fetch(cache.settings.nasUrl, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify(cache)
             });
             if (res.ok) console.log("Synced to NAS: " + cache.settings.nasUrl);
        } else if (!session) {
            // Default fallback if no Google and no Custom NAS -> Local API
            // Only if NOT using custom NAS, to avoid double save
             const res = await fetch('/api/storage', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify(cache)
             });
        }
      } catch (err) {
        console.error("Remote save error:", err);
      }
    }, 2000); // 2 second debounce
  },

  // --- Data Management ---
  async getRawData(): Promise<StoreData> {
    return await this.loadData();
  },

  async importData(newData: any): Promise<void> {
    if (!newData.products || !Array.isArray(newData.products)) {
        throw new Error("Invalid backup file: missing products data");
    }
    cache = { ...defaultData, ...newData };
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
      window.location.reload();
  },

  // --- Auth & Users ---
  // Note: App authentication (PIN) is distinct from Google Auth (Data Storage)
  async authenticate(username: string, pin: string): Promise<User | null> {
    const data = await this.loadData();
    const user = data.users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.pin === pin);
    if (user) {
        user.lastLogin = new Date().toISOString();
        this.saveData();
        return user;
    }
    return null;
  },

  async registerUser(userData: { username: string, pin: string, name: string, role: 'admin' | 'staff' }): Promise<User> {
    const data = await this.loadData();
    if (data.users.find(u => u.username.toLowerCase() === userData.username.toLowerCase())) {
        throw new Error("Username already taken");
    }
    const newUser: User = {
        id: generateId(),
        ...userData,
        lastLogin: new Date().toISOString()
    };
    data.users.push(newUser);
    this.saveData();
    return newUser;
  },

  // --- Inventory ---
  async getInventory(): Promise<Product[]> {
    const data = await this.loadData();
    return data.products;
  },

  async addProduct(product: Omit<Product, 'id'>): Promise<Product> {
    const data = await this.loadData();
    const newProduct = { 
        ...product, 
        id: generateId(),
        createdAt: new Date().toISOString()
    };
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
            name: p.name || 'Unknown Product',
            sku: p.sku || generateId().slice(0, 6),
            stock: p.stock || 0,
            unit: p.unit || 'pcs',
            lowStockThreshold: data.settings.lowStockDefault,
            buyPrice: p.buyPrice || 0,
            sellPrice: p.sellPrice || 0,
            wholesalePrice: p.wholesalePrice || 0,
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
      
      // Notification Trigger: Low Stock
      if (updates.stock !== undefined && updates.stock < oldStock) {
         if (updates.stock <= data.products[index].lowStockThreshold) {
             this.sendBrowserNotification(
                 "Low Stock Alert", 
                 `${data.products[index].name} is running low (${updates.stock} left)`
             );
         }
      }
      this.saveData();
    }
  },

  async deleteProduct(id: string): Promise<void> {
    const data = await this.loadData();
    data.products = data.products.filter(p => p.id !== id);
    this.saveData();
  },

  // --- Tags ---
  async getTags(): Promise<Tag[]> {
    const data = await this.loadData();
    return data.tags;
  },

  async addTag(tag: Omit<Tag, 'id'>): Promise<Tag> {
    const data = await this.loadData();
    const newTag = { ...tag, id: generateId() };
    data.tags.push(newTag);
    this.saveData();
    return newTag;
  },

  async deleteTag(id: string): Promise<void> {
    const data = await this.loadData();
    data.tags = data.tags.filter(t => t.id !== id);
    this.saveData();
  },

  // --- Sales ---
  async getSales(): Promise<Sale[]> {
    const data = await this.loadData();
    return data.sales;
  },

  async createSale(saleData: { items: CartItem[], customerId?: string, customerName: string, subtotal: number, tax: number, total: number, amountPaid?: number, servedBy?: string, paymentMethod?: string }): Promise<Sale> {
    const data = await this.loadData();
    
    // Determine paid amount and dues
    const amountPaid = saleData.amountPaid !== undefined ? saleData.amountPaid : saleData.total;
    const dueAmount = saleData.total - amountPaid;

    const newSale: Sale = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      ...saleData,
      amountPaid // Store partial payment info
    };
    data.sales.push(newSale);

    // Update Stock
    for (const soldItem of saleData.items) {
      const productIndex = data.products.findIndex(p => p.id === soldItem.id);
      if (productIndex !== -1) {
        data.products[productIndex].stock = Math.max(0, data.products[productIndex].stock - soldItem.quantity);
        
        // Notification Trigger
        if (data.products[productIndex].stock <= data.products[productIndex].lowStockThreshold) {
            this.sendBrowserNotification(
                "Stock Alert",
                `${data.products[productIndex].name} reached low stock after sale.`
            );
        }
      }
    }

    // Update Customer Logic
    if (saleData.customerId) {
      const custIndex = data.customers.findIndex(c => c.id === saleData.customerId);
      if (custIndex !== -1) {
        data.customers[custIndex].visitCount += 1;
        data.customers[custIndex].totalSpent += saleData.total;
        data.customers[custIndex].history.push(newSale.id);

        // Update Dues: Add calculating remaining balance (if any)
        if (dueAmount > 0) {
            data.customers[custIndex].totalDues = (data.customers[custIndex].totalDues || 0) + dueAmount;
        }
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

    // 1. Revert Stock for Old Items
    oldSale.items.forEach(oldItem => {
      const pIndex = data.products.findIndex(p => p.id === oldItem.id);
      if (pIndex !== -1) {
        data.products[pIndex].stock += oldItem.quantity;
      }
    });

    // 2. Apply Stock for New Items
    updatedSale.items.forEach(newItem => {
      const pIndex = data.products.findIndex(p => p.id === newItem.id);
      if (pIndex !== -1) {
        data.products[pIndex].stock = Math.max(0, data.products[pIndex].stock - newItem.quantity);
      }
    });

    // 3. Update Customer Dues
    if (oldSale.customerId) {
      const custIndex = data.customers.findIndex(c => c.id === oldSale.customerId);
      if (custIndex !== -1) {
        // Reverse old financials
        const oldPaid = oldSale.amountPaid ?? (oldSale.paymentMethod === 'Pay Later' ? 0 : oldSale.total);
        const oldDue = oldSale.total - oldPaid;
        data.customers[custIndex].totalSpent -= oldSale.total;
        data.customers[custIndex].totalDues -= oldDue;

        // Apply new financials
        const newPaid = updatedSale.amountPaid ?? (updatedSale.paymentMethod === 'Pay Later' ? 0 : updatedSale.total);
        const newDue = updatedSale.total - newPaid;
        data.customers[custIndex].totalSpent += updatedSale.total;
        data.customers[custIndex].totalDues += newDue;
      }
    }

    // 4. Update Record
    data.sales[index] = updatedSale;
    this.saveData();
  },

  async deleteSales(ids: string[]): Promise<void> {
    const data = await this.loadData();
    const idSet = new Set(ids);
    data.sales = data.sales.filter(s => !idSet.has(s.id));
    this.saveData();
  },

  // --- Customers ---
  async getCustomers(): Promise<Customer[]> {
    const data = await this.loadData();
    return data.customers;
  },

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
      history: []
    };
    data.customers.push(newCustomer);
    this.saveData();
    return newCustomer;
  },

  async deleteCustomer(id: string): Promise<void> {
    const data = await this.loadData();
    data.customers = data.customers.filter(c => c.id !== id);
    this.saveData();
  },

  // --- Settings ---
  async getSettings(): Promise<StoreSettings> {
    const data = await this.loadData();
    return data.settings;
  },

  async saveSettings(settings: StoreSettings): Promise<void> {
    const data = await this.loadData();
    data.settings = settings;
    this.saveData();
  }
};

export { StoreService };
