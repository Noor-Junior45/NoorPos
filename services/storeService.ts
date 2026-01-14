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
const initialTags: Tag[] = [
  { id: 't1', name: 'Fruits', color: '#fbbf24' },
  { id: 't2', name: 'Dairy', color: '#3b82f6' },
  { id: 't3', name: 'Bakery', color: '#d97706' },
  { id: 't4', name: 'Beverage', color: '#8b5cf6' },
];

const initialProducts: Product[] = []; // Start clean
const initialCustomers: Customer[] = [];
const initialUsers: User[] = [];

const defaultSettings: StoreSettings = {
  storeName: '',
  storeAddress: '',
  storePhone: '',
  storeEmail: '',
  expiryAlertDays: 7,
  lowStockDefault: 10,
  soundEnabled: true,
  notificationsEnabled: true,
  currencySymbol: '₹'
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

  // Core: Load data
  async loadData(): Promise<StoreData> {
    if (cache) return cache;
    if (loadPromise) return loadPromise;

    const session = GoogleDriveUtils.getSession();

    // 1. If Logged In, try Google Sheet
    if (session) {
        console.log("Loading from Google Sheet...");
        loadPromise = GoogleDriveUtils.loadFromSheet(session.accessToken, session.spreadsheetId)
          .then((remoteData) => {
             if (remoteData) {
                 return this._processRemoteData(remoteData);
             } else {
                 console.log("Sheet empty, using default/local.");
                 return this._fallbackToLocal();
             }
          })
          .catch(err => {
            console.warn("Cloud load failed (falling back to local):", err.message);
            // If token invalid, maybe prompt relogin? For now fallback.
            return this._fallbackToLocal();
          })
          .finally(() => { loadPromise = null; });
          
        return loadPromise as Promise<StoreData>;
    }

    // 2. Fallback to Local
    return this._fallbackToLocal();
  },

  _processRemoteData(data: any): StoreData {
    console.log("Remote storage loaded.");
    // Merge defaults to ensure new fields in 'settings' don't break old backups
    cache = { 
        ...defaultData, 
        ...data, 
        settings: { ...defaultData.settings, ...data.settings }
    };
    
    // Update local backup
    localStorage.setItem(LS_BACKUP_KEY, JSON.stringify(cache));
    lastBackupTime = new Date().toISOString();
    localStorage.setItem('noor_last_backup', lastBackupTime);
    return cache as StoreData;
  },

  _fallbackToLocal(): StoreData {
    const local = localStorage.getItem(LS_BACKUP_KEY);
    cache = local ? { ...defaultData, ...JSON.parse(local) } : JSON.parse(JSON.stringify(defaultData));
    return cache as StoreData;
  },

  // Core: Save data
  async saveData(): Promise<void> {
    if (!cache) return;
    
    // 1. Always save to LocalStorage immediately
    localStorage.setItem(LS_BACKUP_KEY, JSON.stringify(cache));
    lastBackupTime = new Date().toISOString();
    localStorage.setItem('noor_last_backup', lastBackupTime);

    // 2. If Logged In, Sync to Google Sheet (Debounced)
    const session = GoogleDriveUtils.getSession();
    if (!session) return;

    if (saveTimeout) clearTimeout(saveTimeout);
    
    saveTimeout = setTimeout(async () => {
      try {
        await GoogleDriveUtils.saveToSheet(session.accessToken, session.spreadsheetId, cache);
        console.log("Synced to Google Sheet");
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
      data.products[index] = { ...data.products[index], ...updates };
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

  async createSale(saleData: { items: CartItem[], customerId?: string, customerName: string, subtotal: number, tax: number, total: number, servedBy?: string, paymentMethod?: string }): Promise<Sale> {
    const data = await this.loadData();
    const newSale: Sale = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      ...saleData
    };
    data.sales.push(newSale);

    for (const soldItem of saleData.items) {
      const productIndex = data.products.findIndex(p => p.id === soldItem.id);
      if (productIndex !== -1) {
        data.products[productIndex].stock = Math.max(0, data.products[productIndex].stock - soldItem.quantity);
      }
    }

    if (saleData.customerId) {
      const custIndex = data.customers.findIndex(c => c.id === saleData.customerId);
      if (custIndex !== -1) {
        data.customers[custIndex].visitCount += 1;
        data.customers[custIndex].totalSpent += saleData.total;
        data.customers[custIndex].history.push(newSale.id);

        if (saleData.paymentMethod === 'Pay Later') {
            data.customers[custIndex].totalDues = (data.customers[custIndex].totalDues || 0) + saleData.total;
        }
      }
    }

    this.saveData();
    return newSale;
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