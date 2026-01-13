export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  stock: number;
  unit: string; // e.g. 'kg', 'pcs', 'l'
  lowStockThreshold: number;
  buyPrice: number;
  sellPrice: number;
  wholesalePrice?: number; // New field for wholesale
  taxRate?: number; // Percentage
  expiryDate?: string; // ISO Date string YYYY-MM-DD
  manufacturingDate?: string; // ISO Date string YYYY-MM-DD
  createdAt?: string; // ISO Date string for registration time
  location?: string;
  tagId?: string; // Links to Tag entity
  category?: string; // Legacy support
  capacity?: string;
}

export interface StoreSettings {
  expiryAlertDays: number; // Days before expiry to warn
  lowStockDefault: number; // Default threshold for new products
  soundEnabled: boolean;
  currencySymbol: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  location?: string;
  totalSpent: number;
  visitCount: number;
  history: string[]; // Sale IDs
}

export interface Sale {
  id: string;
  customerId?: string; // Optional if guest
  customerName: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  timestamp: string; // ISO string
}

export enum Tab {
  WAREHOUSE = 'WAREHOUSE',
  POS = 'POS',
  CUSTOMERS = 'CUSTOMERS'
}

export interface Alert {
  id: string;
  type: 'warning' | 'danger' | 'info';
  message: string;
}