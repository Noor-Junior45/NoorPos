import { Product, Sale, Customer, CartItem, Tag, StoreSettings } from '../types';

// Keys for LocalStorage
const INV_KEY = 'glassstore_inventory';
const SALES_KEY = 'glassstore_sales';
const CUST_KEY = 'glassstore_customers';
const TAGS_KEY = 'glassstore_tags';
const SETTINGS_KEY = 'glassstore_settings';

// Helper for UUID generation with polyfill
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments where crypto is restricted (e.g. non-localhost HTTP)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Seed data
const initialTags: Tag[] = [
  { id: 't1', name: 'Fruits', color: '#fbbf24' }, // Amber
  { id: 't2', name: 'Dairy', color: '#3b82f6' },  // Blue
  { id: 't3', name: 'Bakery', color: '#d97706' }, // Orange
  { id: 't4', name: 'Beverage', color: '#8b5cf6' }, // Violet
];

const initialProducts: Product[] = [
  { id: '1', name: 'Organic Bananas', sku: '12345', stock: 150, unit: 'kg', lowStockThreshold: 20, buyPrice: 0.5, sellPrice: 1.2, wholesalePrice: 0.8, location: 'Aisle 1', tagId: 't1', expiryDate: '2024-12-30', createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: '2', name: 'Almond Milk', sku: '67890', stock: 8, unit: 'l', lowStockThreshold: 10, buyPrice: 2.0, sellPrice: 4.5, wholesalePrice: 3.5, location: 'Fridge 2', expiryDate: '2024-10-15', tagId: 't2', createdAt: new Date().toISOString() },
  { id: '3', name: 'Whole Wheat Bread', sku: '54321', stock: 25, unit: 'pcs', lowStockThreshold: 5, buyPrice: 1.5, sellPrice: 3.0, wholesalePrice: 2.2, location: 'Aisle 3', tagId: 't3', manufacturingDate: '2024-10-01', expiryDate: '2024-10-08', createdAt: new Date().toISOString() },
  { id: '4', name: 'Premium Coffee', sku: '99887', stock: 5, unit: 'pack', lowStockThreshold: 8, buyPrice: 8.0, sellPrice: 15.0, wholesalePrice: 12.0, location: 'Aisle 4', tagId: 't4', createdAt: new Date().toISOString() },
];

const initialCustomers: Customer[] = [
  { id: 'c1', name: 'John Doe', phone: '555-0123', location: 'New York', totalSpent: 0, visitCount: 0, history: [] },
];

const defaultSettings: StoreSettings = {
  expiryAlertDays: 7,
  lowStockDefault: 10,
  soundEnabled: true,
  currencySymbol: '₹'
};

// Helper to simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const StoreService = {
  // --- Inventory ---
  async getInventory(): Promise<Product[]> {
    await delay(300);
    const data = localStorage.getItem(INV_KEY);
    return data ? JSON.parse(data) : initialProducts;
  },

  async addProduct(product: Omit<Product, 'id'>): Promise<Product> {
    await delay(300);
    const products = await this.getInventory();
    // Add createdAt automatically
    const newProduct = { 
        ...product, 
        id: generateId(),
        createdAt: new Date().toISOString()
    };
    products.push(newProduct);
    localStorage.setItem(INV_KEY, JSON.stringify(products));
    return newProduct;
  },

  async updateProduct(id: string, updates: Partial<Product>): Promise<void> {
    await delay(200);
    const products = await this.getInventory();
    const index = products.findIndex(p => p.id === id);
    if (index !== -1) {
      products[index] = { ...products[index], ...updates };
      localStorage.setItem(INV_KEY, JSON.stringify(products));
    }
  },

  async deleteProduct(id: string): Promise<void> {
    await delay(200);
    const products = await this.getInventory();
    const filtered = products.filter(p => p.id !== id);
    localStorage.setItem(INV_KEY, JSON.stringify(filtered));
  },

  // --- Tags ---
  async getTags(): Promise<Tag[]> {
    await delay(100);
    const data = localStorage.getItem(TAGS_KEY);
    return data ? JSON.parse(data) : initialTags;
  },

  async addTag(tag: Omit<Tag, 'id'>): Promise<Tag> {
    const tags = await this.getTags();
    const newTag = { ...tag, id: generateId() };
    tags.push(newTag);
    localStorage.setItem(TAGS_KEY, JSON.stringify(tags));
    return newTag;
  },

  async deleteTag(id: string): Promise<void> {
    // 1. Untag products first (don't delete them)
    const products = await this.getInventory();
    let inventoryUpdated = false;
    
    // Explicitly update products to remove the tag association
    const updatedProducts = products.map(p => {
        if (p.tagId === id) {
            inventoryUpdated = true;
            // Create copy and remove tagId property
            const newProduct = { ...p };
            delete newProduct.tagId;
            return newProduct;
        }
        return p;
    });

    if (inventoryUpdated) {
        localStorage.setItem(INV_KEY, JSON.stringify(updatedProducts));
    }

    // 2. Delete the tag itself
    const tags = await this.getTags();
    const filtered = tags.filter(t => t.id !== id);
    localStorage.setItem(TAGS_KEY, JSON.stringify(filtered));
  },

  // --- Sales ---
  async getSales(): Promise<Sale[]> {
    await delay(300);
    const data = localStorage.getItem(SALES_KEY);
    return data ? JSON.parse(data) : [];
  },

  async createSale(saleData: { items: CartItem[], customerId?: string, customerName: string, subtotal: number, tax: number, total: number }): Promise<Sale> {
    await delay(500);
    const sales = await this.getSales();
    const newSale: Sale = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      ...saleData
    };
    sales.push(newSale);
    localStorage.setItem(SALES_KEY, JSON.stringify(sales));

    // Update Inventory
    const products = await this.getInventory();
    for (const soldItem of saleData.items) {
      const productIndex = products.findIndex(p => p.id === soldItem.id);
      if (productIndex !== -1) {
        products[productIndex].stock = Math.max(0, products[productIndex].stock - soldItem.quantity);
      }
    }
    localStorage.setItem(INV_KEY, JSON.stringify(products));

    // Update Customer if exists
    if (saleData.customerId) {
      const customers = await this.getCustomers();
      const custIndex = customers.findIndex(c => c.id === saleData.customerId);
      if (custIndex !== -1) {
        customers[custIndex].visitCount += 1;
        customers[custIndex].totalSpent += saleData.total;
        customers[custIndex].history.push(newSale.id);
        localStorage.setItem(CUST_KEY, JSON.stringify(customers));
      }
    }

    return newSale;
  },

  // --- Customers ---
  async getCustomers(): Promise<Customer[]> {
    await delay(300);
    const data = localStorage.getItem(CUST_KEY);
    return data ? JSON.parse(data) : initialCustomers;
  },

  async upsertCustomer(customer: Partial<Customer>): Promise<Customer> {
    await delay(300);
    const customers = await this.getCustomers();
    
    if (customer.id) {
      const index = customers.findIndex(c => c.id === customer.id);
      if (index !== -1) {
        customers[index] = { ...customers[index], ...customer } as Customer;
        localStorage.setItem(CUST_KEY, JSON.stringify(customers));
        return customers[index];
      }
    }

    const newCustomer: Customer = {
      id: generateId(),
      name: customer.name || 'Unknown',
      phone: customer.phone || '',
      email: customer.email || '',
      location: customer.location || '',
      totalSpent: 0,
      visitCount: 0,
      history: []
    };
    customers.push(newCustomer);
    localStorage.setItem(CUST_KEY, JSON.stringify(customers));
    return newCustomer;
  },

  async deleteCustomer(id: string): Promise<void> {
    const customers = await this.getCustomers();
    const filtered = customers.filter(c => c.id !== id);
    localStorage.setItem(CUST_KEY, JSON.stringify(filtered));
  },

  // --- Settings ---
  async getSettings(): Promise<StoreSettings> {
    await delay(100);
    const data = localStorage.getItem(SETTINGS_KEY);
    return data ? JSON.parse(data) : defaultSettings;
  },

  async saveSettings(settings: StoreSettings): Promise<void> {
    await delay(200);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }
};