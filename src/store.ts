// src/store.ts
import {
  AppState,
  Invoice,
  InstallmentPayment,
  TreasuryEntry,
  ShiftArchive,
  ShiftSummary,
  ShiftResetSettings,
} from "./types";

const STATE_KEY = "appState";
const SHIFT_KEY = "activeShift";

// ============================
// 🔧 ID Generator
// ============================
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================
// ⚙️ ShiftResetSettings Default
// ============================
export function getDefaultShiftResetSettings(): ShiftResetSettings {
  return {
    resetSales: true,
    resetPurchases: true,
    resetMaintenance: true,
    resetInstallments: true,
    resetAccessorySales: true,
    resetAccessoryPurchases: true,
    resetReturnSales: true,
    resetReturnPurchases: true,
  };
}

// ============================
// ⚙️ Default State
// ============================
function buildDefaultState(): AppState {
  return {
    invoices: [],
    products: [],
    customers: [],
    suppliers: [],
    settings: {
      shopName: "مدير المبيعات",
      currency: "EGP",
      taxRate: 0,
      autoStartShift: true,
      shiftResetSettings: getDefaultShiftResetSettings(),
    },
    treasury: { balance: 0, entries: [] },
    installmentsLedger: { totalReceived: 0, payments: [] },
    shiftArchives: [],
    bundles: [],
    users: [],
  };
}

// ============================
// ✅ mergeWithDefaults
// ============================
export function mergeWithDefaults(saved: any): AppState {
  if (!saved || typeof saved !== "object") return buildDefaultState();

  return {
    invoices:      Array.isArray(saved.invoices)      ? saved.invoices      : [],
    products:      Array.isArray(saved.products)      ? saved.products      : [],
    customers:     Array.isArray(saved.customers)     ? saved.customers     : [],
    suppliers:     Array.isArray(saved.suppliers)     ? saved.suppliers     : [],
    shiftArchives: Array.isArray(saved.shiftArchives) ? saved.shiftArchives : [],
    bundles:       Array.isArray(saved.bundles)       ? saved.bundles       : [],
    users:         Array.isArray(saved.users)         ? saved.users         : [],
    treasury: {
      balance: typeof saved.treasury?.balance === "number"
        ? saved.treasury.balance : 0,
      entries: Array.isArray(saved.treasury?.entries)
        ? saved.treasury.entries : [],
    },
    installmentsLedger: {
      totalReceived: typeof saved.installmentsLedger?.totalReceived === "number"
        ? saved.installmentsLedger.totalReceived : 0,
      payments: Array.isArray(saved.installmentsLedger?.payments)
        ? saved.installmentsLedger.payments : [],
    },
    settings: {
      shopName:       saved.settings?.shopName       ?? "مدير المبيعات",
      currency:       saved.settings?.currency       ?? "EGP",
      taxRate:        saved.settings?.taxRate        ?? 0,
      autoStartShift: saved.settings?.autoStartShift ?? true,
      invoicePrefix:  saved.settings?.invoicePrefix,
      printOnSave:    saved.settings?.printOnSave,
      shopPhone:      saved.settings?.shopPhone,
      shopAddress:    saved.settings?.shopAddress,
      shiftResetSettings: {
        ...getDefaultShiftResetSettings(),
        ...(saved.settings?.shiftResetSettings ?? {}),
      },
    },
  };
}

// ============================
// ✅ Load State
// ============================
export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return buildDefaultState();

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error("localStorage data corrupted, resetting...");
      localStorage.removeItem(STATE_KEY);
      return buildDefaultState();
    }

    if (!parsed || typeof parsed !== "object") {
      return buildDefaultState();
    }

    return mergeWithDefaults(parsed);
  } catch (err) {
    console.error("loadState error:", err);
    return buildDefaultState();
  }
}

// ============================
// ✅ Save State
// ============================
export function saveState(state: AppState): void {
  try {
    if (!state || typeof state !== "object") return;
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch (err) {
    if (err instanceof DOMException && err.name === "QuotaExceededError") {
      console.error("Storage quota exceeded!");
    } else {
      console.error("saveState error:", err);
    }
  }
}

// ============================
// 🔄 Shift Management
// ============================
export function setActiveShift(shift: { id: string }): void {
  const data = {
    ...shift,
    openedAt: new Date().toLocaleString("ar-EG"),
  };
  localStorage.setItem(SHIFT_KEY, JSON.stringify(data));
}

export function getActiveShift(): { id: string; openedAt?: string } | null {
  try {
    const raw = localStorage.getItem(SHIFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.id ? parsed : null;
  } catch {
    return null;
  }
}

export function clearActiveShift(): void {
  localStorage.removeItem(SHIFT_KEY);
}

// ============================
// 📊 Shift Summary
// ============================
// في src/store.ts — استبدل دالة calcShiftSummary بهذه

export function calcShiftSummary(
  invoices: Invoice[],
  installments: InstallmentPayment[],
  _treasuryBalance: number
): ShiftSummary {
  const safeInvoices     = Array.isArray(invoices)     ? invoices     : [];
  const safeInstallments = Array.isArray(installments) ? installments : [];

  const closed             = safeInvoices.filter((i) => i?.status === "closed");
  const sales              = closed.filter((i) => i?.type === "sale");
  const purchases          = closed.filter((i) => i?.type === "purchase");
  const returnSales        = closed.filter((i) => i?.type === "return_sale");
  const returnPurchases    = closed.filter((i) => i?.type === "return_purchase");
  const maintenance        = closed.filter((i) => i?.type === "maintenance");
  const accessorySales     = closed.filter((i) => i?.type === "accessory_sale");
  const accessoryPurchases = closed.filter((i) => i?.type === "accessory_purchase");

  // ✅ احتساب المدفوع فعلياً (paid) بدلاً من قيمة الفاتورة (total)
  const totalSales              = sales.reduce((s, i) => s + (i.paid || 0), 0);
  const totalPurchases          = purchases.reduce((s, i) => s + (i.paid || 0), 0);
  const totalReturnSales        = returnSales.reduce((s, i) => s + (i.paid || 0), 0);
  const totalReturnPurchases    = returnPurchases.reduce((s, i) => s + (i.paid || 0), 0);
  const totalMaintenance        = maintenance.reduce((s, i) => s + (i.paid || 0), 0);
  const totalInstallments       = safeInstallments.reduce((s, p) => s + (p.amount || 0), 0);
  const totalAccessorySales     = accessorySales.reduce((s, i) => s + (i.paid || 0), 0);
  const totalAccessoryPurchases = accessoryPurchases.reduce((s, i) => s + (i.paid || 0), 0);

  const netSales     = totalSales - totalPurchases - totalReturnSales + totalReturnPurchases;
  const netAccessory = totalAccessorySales - totalAccessoryPurchases;
  const grandTotal   = netSales + totalMaintenance + totalInstallments + netAccessory;

  return {
    totalSales,
    totalPurchases,
    totalReturnSales,
    totalReturnPurchases,
    totalMaintenance,
    totalInstallments,
    totalAccessorySales,
    totalAccessoryPurchases,
    salesCount:              sales.length,
    purchasesCount:          purchases.length,
    returnSalesCount:        returnSales.length,
    returnPurchasesCount:    returnPurchases.length,
    maintenanceCount:        maintenance.length,
    installmentsCount:       safeInstallments.length,
    accessorySalesCount:     accessorySales.length,
    accessoryPurchasesCount: accessoryPurchases.length,
    netSales,
    netAccessory,
    grandTotal,
  };
}
// ============================
// 💰 Treasury
// ============================
export function addTreasuryEntry(
  state: AppState,
  entry: Omit<TreasuryEntry, "id" | "date" | "time">
): AppState {
  const now = new Date();
  const newEntry: TreasuryEntry = {
    ...entry,
    id:   generateId(),
    date: now.toLocaleDateString("ar-EG"),
    time: now.toLocaleTimeString("ar-EG"),
  };
  const treasury   = state.treasury ?? { balance: 0, entries: [] };
  const newBalance =
    entry.direction === "in"
      ? (treasury.balance || 0) + entry.amount
      : Math.max(0, (treasury.balance || 0) - entry.amount);

  return {
    ...state,
    treasury: {
      balance: newBalance,
      entries: [newEntry, ...(Array.isArray(treasury.entries) ? treasury.entries : [])],
    },
  };
}

// ============================
// 💳 Installments
// ============================
export function addInstallmentPayment(
  state: AppState,
  payment: Omit<InstallmentPayment, "id" | "date" | "time">
): AppState {
  const now = new Date();
  const newPayment: InstallmentPayment = {
    ...payment,
    id:   generateId(),
    date: now.toLocaleDateString("ar-EG"),
    time: now.toLocaleTimeString("ar-EG"),
  };
  const ledger = state.installmentsLedger ?? { totalReceived: 0, payments: [] };
  const newState: AppState = {
    ...state,
    installmentsLedger: {
      totalReceived: (ledger.totalReceived || 0) + payment.amount,
      payments:      [newPayment, ...(Array.isArray(ledger.payments) ? ledger.payments : [])],
    },
  };
  return addTreasuryEntry(newState, {
    type:        "installment",
    direction:   "in",
    description: `قسط - ${payment.customerName}${
      payment.invoiceRef ? ` | فاتورة: ${payment.invoiceRef}` : ""
    }`,
    amount: payment.amount,
  });
}

// ============================
// 📁 updateArchivedInvoice
// ============================
export function updateArchivedInvoice(
  state: AppState,
  archivedShiftId: string,
  updatedInvoice: Invoice
): AppState {
  const newArchives = (state.shiftArchives ?? []).map((archive: any) => {
    if (archive.id !== archivedShiftId) return archive;
    const newInvoices = (archive.invoices ?? []).map((inv: Invoice) =>
      inv.id === updatedInvoice.id ? updatedInvoice : inv
    );
    const installments = Array.isArray(archive.installments)
      ? archive.installments
      : [];
    const newSummary = calcShiftSummary(newInvoices, installments, 0);
    return { ...archive, invoices: newInvoices, summary: newSummary };
  });
  return { ...state, shiftArchives: newArchives };
}

// ============================
// 🔒 closeShiftWithSettings
// ============================
export function closeShiftWithSettings(
  state: AppState,
  resetSettings: ShiftResetSettings,
  autoRestart: boolean
): AppState {
  const shift = getActiveShift();
  if (!shift) return state;

  const nowStr  = new Date().toLocaleString("ar-EG");
  const summary = calcShiftSummary(
    state.invoices ?? [],
    state.installmentsLedger?.payments ?? [],
    state.treasury?.balance ?? 0
  );

  const archive: ShiftArchive = {
    id:              shift.id,
    openedAt:        shift.openedAt ?? "",
    closedAt:        nowStr,
    summary,
    invoices:        [...(state.invoices ?? [])],
    installments:    [...(state.installmentsLedger?.payments ?? [])],
    treasuryEntries: [...(state.treasury?.entries ?? [])],
    resetSettings,
  };

  const remainingInvoices = (state.invoices ?? []).filter((inv) => {
    if (!inv) return false;
    if (inv.status === "pending" || inv.status === "open") return true;
    if (inv.status !== "closed") return true;
    switch (inv.type) {
      case "sale":               return !resetSettings.resetSales;
      case "purchase":           return !resetSettings.resetPurchases;
      case "return_sale":        return !resetSettings.resetReturnSales;
      case "return_purchase":    return !resetSettings.resetReturnPurchases;
      case "maintenance":        return !resetSettings.resetMaintenance;
      case "accessory_sale":     return !resetSettings.resetAccessorySales;
      case "accessory_purchase": return !resetSettings.resetAccessoryPurchases;
      default: return true;
    }
  });

  const newInstallments = resetSettings.resetInstallments
    ? { totalReceived: 0, payments: [] }
    : (state.installmentsLedger ?? { totalReceived: 0, payments: [] });

  clearActiveShift();

  const newState: AppState = {
    ...state,
    invoices:           remainingInvoices,
    installmentsLedger: newInstallments,
    shiftArchives:      [archive, ...(state.shiftArchives ?? [])],
  };

  if (autoRestart) {
    const newShiftId = `shift-${Date.now()}`;
    setActiveShift({ id: newShiftId });
  }

  saveState(newState);
  return newState;
}

// ============================
// ✅ generateInvoiceNumber - مُصلَح بالكامل
// ============================
export function generateInvoiceNumber(
  invoicesOrAnything: any,
  type: string,
  prefix?: string
): string {
  // ✅ تأمين شامل: نقبل أي شيء ونحوله لمصفوفة آمنة
  let safeInvoices: any[] = [];

  if (Array.isArray(invoicesOrAnything)) {
    // ✅ حالة صحيحة: تم تمرير array مباشرة
    safeInvoices = invoicesOrAnything;
  } else if (
    invoicesOrAnything &&
    typeof invoicesOrAnything === "object" &&
    Array.isArray(invoicesOrAnything.invoices)
  ) {
    // ✅ حالة خاطئة: تم تمرير AppState بدل invoices array
    safeInvoices = invoicesOrAnything.invoices;
  } else {
    // ✅ أي حالة أخرى: مصفوفة فارغة
    safeInvoices = [];
  }

  // ✅ تحديد البادئة
  const typePrefix: Record<string, string> = {
    sale:               "INV",
    purchase:           "PUR",
    return_sale:        "RET",
    return_purchase:    "RPR",
    maintenance:        "MNT",
    accessory_sale:     "ACC",
    accessory_purchase: "ACP",
  };

  const pre =
    prefix && typeof prefix === "string" && prefix.trim().length > 0
      ? prefix.trim().toUpperCase()
      : (typePrefix[type] ?? "INV");

  // ✅ إيجاد أعلى رقم موجود لنفس البادئة
  const nums = safeInvoices
    .filter((inv: any) => {
      if (!inv || !inv.number || typeof inv.number !== "string") return false;
      const parts = inv.number.split("-");
      return parts.length >= 2 && parts[0] === pre;
    })
    .map((inv: any) => {
      const parts = String(inv.number).split("-");
      const num = parseInt(parts[parts.length - 1], 10);
      return isNaN(num) ? 0 : num;
    });

  const maxNum  = nums.length > 0 ? Math.max(...nums) : 0;
  const nextNum = String(maxNum + 1).padStart(4, "0");

  return `${pre}-${nextNum}`;
}