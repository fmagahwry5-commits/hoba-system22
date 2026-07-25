// src/types.ts - النسخة الكاملة المصححة

export type InvoiceType =
  | "sale"
  | "purchase"
  | "return_sale"
  | "return_purchase"
  | "maintenance"
  | "accessory_sale"
  | "accessory_purchase";

export type InvoiceStatus = "open" | "pending" | "closed" | "cancelled";

export type MaintenanceStatus =
  | "received"
  | "diagnosing"
  | "waiting_parts"
  | "repairing"
  | "ready"
  | "delivered"
  | "cancelled";

export type TreasuryEntryType =
  | "sale"
  | "purchase"
  | "return_sale"
  | "return_purchase"
  | "maintenance"
  | "accessory_sale"
  | "accessory_purchase"
  | "installment"
  | "deposit"
  | "withdraw"
  | "adjustment";

export interface MaintenanceInfo {
  // معلومات الجهاز
  deviceBrand?: string;
  deviceModel?: string;
  deviceType?: string;
  imei?: string;
  color?: string;
  accessories?: string;

  // معلومات الاستلام
  receivedDate?: string;
  receivedAt?: string;
  expectedDelivery?: string;

  // معلومات الصيانة
  maintenanceStatus?: MaintenanceStatus;
  customerComplaint?: string;
  diagnosis?: string;
  repairDescription?: string;
  technicianName?: string;

  // الضمان والدفع
  warranty?: string;
  warrantyDays?: number;
  advancePayment?: number;

  // ملاحظات
  notes?: string;
  internalNotes?: string;
}

export interface InvoiceItem {
  id: string;
  productId: string;
  productName: string;
  barcode?: string;
  quantity: number;
  unitPrice: number;
  costPrice?: number;
  discount?: number;
  discountType?: "amount" | "percent";
  total: number;
  notes?: string;
}

export interface Invoice {
  id: string;
  number: string;
  type: InvoiceType;
  status: InvoiceStatus;
  date: string;
  time?: string;
  createdAt?: string;
  updatedAt?: string;

  // العميل / المورد
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  supplierName?: string;
  supplierPhone?: string;
  supplierAddress?: string;

  // المبالغ
  items?: InvoiceItem[];
  subtotal?: number;
  discount?: number;
  discountType?: "amount" | "percent";
  tax?: number;
  total: number;
  paid: number;
  remaining?: number;

  // الصيانة
  maintenanceInfo?: MaintenanceInfo;

  // معلومات إضافية
  notes?: string;
  shiftId?: string;
  userId?: string;
  archivedShiftId?: string;
}

export interface Product {
  id: string;
  name: string;
  barcode?: string;
  category?: string;
  description?: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  minStock?: number;
  unit?: string;
  image?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  balance?: number;
  notes?: string;
  createdAt?: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  balance?: number;
  notes?: string;
  createdAt?: string;
}

export interface TreasuryEntry {
  id: string;
  type: TreasuryEntryType;
  direction: "in" | "out";
  amount: number;
  description: string;
  invoiceId?: string;
  invoiceNumber?: string;
  date: string;
  time?: string;
  createdAt?: string;
  shiftId?: string;
  runningBalance?: number;
}

export interface Treasury {
  balance: number;
  entries: TreasuryEntry[];
}

export interface InstallmentPayment {
  id: string;
  customerName: string;
  customerPhone?: string;
  amount: number;
  invoiceRef?: string;
  notes?: string;
  date: string;
  time?: string;
  shiftId?: string;
}

export interface InstallmentsLedger {
  totalReceived: number;
  payments: InstallmentPayment[];
}

export interface ShiftSummary {
  totalSales: number;
  totalPurchases: number;
  totalReturnSales: number;
  totalReturnPurchases: number;
  totalMaintenance: number;
  totalInstallments: number;
  totalAccessorySales: number;
  totalAccessoryPurchases: number;
  salesCount: number;
  purchasesCount: number;
  maintenanceCount: number;
  accessorySalesCount: number;
  netProfit?: number;
}

export interface ShiftArchive {
  id: string;
  startTime: string;
  endTime: string;
  invoices: Invoice[];
  installments: InstallmentPayment[];
  summary: ShiftSummary;
  openingBalance?: number;
  closingBalance?: number;
  notes?: string;
  isModified?: boolean;
  lastModified?: string;
  createdBy?: string;
}

// أضف هذا في src/types.ts - استبدل Bundle القديم

export interface BundleItem {
  productId: string;
  productName: string;
  quantity: number;
  originalPrice: number;
  bundlePrice: number;
}

export interface Bundle {
  id: string;
  name: string;
  description?: string;
  items: BundleItem[];
  originalTotal: number;
  bundlePrice: number;
  discount: number;
  discountPercent: number;
  isActive: boolean;
  createdAt?: string;
  barcode?: string;
  // للتوافق مع InvoiceForm القديم
  totalPrice?: number;
}
export interface User {
  id: string;
  name: string;
  username: string;
  password: string;
  role: "admin" | "employee";
  isActive?: boolean;
  createdAt?: string;
  lastLogin?: string;
  permissions?: string[];
}

export interface AppSettings {
  shopName?: string;
  shopPhone?: string;
  shopAddress?: string;
  currency: string;
  taxRate?: number;
  autoStartShift?: boolean;
  printReceipt?: boolean;
  lowStockAlert?: number;
  shiftResetSettings?: {
    resetInvoices?: boolean;
    resetInstallments?: boolean;
    resetMaintenance?: boolean;
  };
  theme?: "light" | "dark";
  language?: "ar" | "en";
}

export interface AppState {
  invoices: Invoice[];
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  treasury: Treasury;
  installmentsLedger: InstallmentsLedger;
  shiftArchives: ShiftArchive[];
  bundles?: Bundle[];
  settings: AppSettings;
  users?: User[];
  stockMovements?: StockMovementRecord[];
  version?: string;
}

export interface StockMovementRecord {
  id: string;
  type: "in" | "out" | "adjustment" | "transfer";
  productId: string;
  productName: string;
  quantity: number;
  previousStock: number;
  newStock: number;
  reason?: string;
  notes?: string;
  date: string;
  time?: string;
  shiftId?: string;
  createdBy?: string;
  cost?: number;

  
}