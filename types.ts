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
  wholesalePrice?: number;
  taxRate?: number;
  expiryDate?: string;
  manufacturingDate?: string;
  createdAt?: string;
  location?: string;
  tagId?: string;
  category?: string;
  capacity?: string;
}

export interface StoreSettings {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  storeEmail?: string;
  logo?: string;
  
  expiryAlertDays: number;
  lowStockDefault: number;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  currencySymbol: string;
  recycleBinRetentionDays: number;
  directPrintEnabled: boolean;
  scannerPreference: 'phone' | 'machine' | 'both'; // New: Scanner preference

  nasUrl?: string;
  syncToNas?: boolean;
}

export interface CartItem extends Product {
  quantity: number;
  discount?: number; // Cash discount per line item
}

export interface Payment {
  id: string;
  amount: number;
  date: string;
  method: string;
  note?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  location?: string;
  totalSpent: number;
  totalDues: number;
  visitCount: number;
  history: string[];
  payments?: Payment[];
}

export interface User {
  id: string;
  username: string;
  pin: string;
  role: 'admin' | 'staff';
  name: string;
  lastLogin?: string;
}

export interface Sale {
  id: string;
  customerId?: string;
  customerName: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  amountPaid?: number;
  timestamp: string;
  servedBy?: string;
  paymentMethod?: string;
}

export interface DeletedItem {
  id: string;
  originalId: string;
  type: 'product' | 'customer' | 'sale' | 'tag';
  data: any;
  deletedAt: string;
}

export enum Tab {
  WAREHOUSE = 'WAREHOUSE',
  POS = 'POS',
  DASHBOARD = 'DASHBOARD',
  CUSTOMERS = 'CUSTOMERS',
  PROFILE = 'PROFILE'
}

export interface Alert {
  id: string;
  type: 'warning' | 'danger' | 'info';
  message: string;
}