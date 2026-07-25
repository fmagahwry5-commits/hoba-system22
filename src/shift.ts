import type {
  AppState, ShiftArchive, ShiftSummary,
  TreasuryEntry, TreasuryEntryType, InstallmentPayment,
  Bundle,
} from "./types";

export function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function generateInvoiceNumber(prefix = "INV", _list: any[] = []): string {
  const d = new Date();
  return `${prefix}-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;
}

const APP_STATE_KEY = "appState";
const ACTIVE_SHIFT_KEY = "activeShift";

const defaultState: AppState = {
  products: [],
  invoices: [],
  customers: [],
  suppliers: [],
  shiftArchives: [],
  treasury: { balance: 0, entries: [] },
  installmentsLedger: { totalReceived: 0, payments: [] },
  bundles: [],
  settings: {
    shopName: "",
    shopPhone: "",
    shopAddress: "",
    currency: "EGP",
    taxRate: 0,
    autoStartShift: true,
  },
};

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(APP_STATE_KEY);
    if (!raw) return { ...defaultState };
    const parsed = JSON.parse(raw) as any;
    return {
      products: Array.isArray(parsed.products) ? parsed.products : [],
      invoices: Array.isArray(parsed.invoices) ? parsed.invoices : [],
      customers: Array.isArray(parsed.customers) ? parsed.customers : [],
      suppliers: Array.isArray(parsed.suppliers) ? parsed.suppliers : [],
      shiftArchives: Array.isArray(parsed.shiftArchives) ? parsed.shiftArchives : [],
      treasury: {
        balance: Number(parsed.treasury?.balance) || 0,
        entries: Array.isArray(parsed.treasury?.entries) ? parsed.treasury.entries : [],
      },
      installmentsLedger: {
        totalReceived: Number(parsed.installmentsLedger?.totalReceived) || 0,
        payments: Array.isArray(parsed.installmentsLedger?.payments)
          ? parsed.installmentsLedger.payments
          : [],
      },
      bundles: Array.isArray(parsed.bundles) ? parsed.bundles : [],
      settings: { ...defaultState.settings, ...(parsed.settings ?? {}) },
    };
  } catch (err) {
    console.error("loadState error:", err);
    return { ...defaultState };
  }
}

export function saveState(state: AppState) {
  try {
    if (!state || typeof state !== "object") return;
    localStorage.setItem(APP_STATE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error("saveState error:", err);
  }
}

export function exportBackup(): string {
  return JSON.stringify(loadState(), null, 2);
}

export function importBackup(json: string): AppState {
  try {
    const parsed = JSON.parse(json) as any;
    const next: AppState = {
      products: Array.isArray(parsed.products) ? parsed.products : [],
      invoices: Array.isArray(parsed.invoices) ? parsed.invoices : [],
      customers: Array.isArray(parsed.customers) ? parsed.customers : [],
      suppliers: Array.isArray(parsed.suppliers) ? parsed.suppliers : [],
      shiftArchives: Array.isArray(parsed.shiftArchives) ? parsed.shiftArchives : [],
      treasury: {
        balance: Number(parsed.treasury?.balance) || 0,
        entries: Array.isArray(parsed.treasury?.entries) ? parsed.treasury.entries : [],
      },
      installmentsLedger: {
        totalReceived: Number(parsed.installmentsLedger?.totalReceived) || 0,
        payments: Array.isArray(parsed.installmentsLedger?.payments)
          ? parsed.installmentsLedger.payments
          : [],
      },
      bundles: Array.isArray(parsed.bundles) ? parsed.bundles : [],
      settings: { ...defaultState.settings, ...(parsed.settings ?? {}) },
    };
    saveState(next);
    return next;
  } catch {
    return loadState();
  }
}

// ========== الخزنة ==========
export function addTreasuryEntry(
  state: AppState,
  params: {
    type: TreasuryEntryType;
    description: string;
    amount: number;
    direction: "in" | "out";
    invoiceId?: string;
    invoiceNumber?: string;
    shiftId?: string;
  }
): AppState {
  try {
    const now = new Date();
    const currentBalance = Number(state.treasury?.balance) || 0;
    const newBalance =
      params.direction === "in"
        ? currentBalance + params.amount
        : currentBalance - params.amount;

    const entry: TreasuryEntry = {
      id: generateId(),
      date: now.toLocaleDateString("ar-EG"),
      time: now.toLocaleTimeString("ar-EG"),
      type: params.type,
      description: params.description,
      amount: params.amount,
      direction: params.direction,
      balance: newBalance,
      invoiceId: params.invoiceId,
      invoiceNumber: params.invoiceNumber,
      shiftId: params.shiftId,
    };

    return {
      ...state,
      treasury: {
        balance: newBalance,
        entries: [...(state.treasury?.entries ?? []), entry],
      },
    };
  } catch (err) {
    console.error("addTreasuryEntry error:", err);
    return state;
  }
}

// ========== الأقساط ==========
export function addInstallmentPayment(
  state: AppState,
  payment: Omit<InstallmentPayment, "id" | "date" | "time">
): AppState {
  try {
    const now = new Date();
    const newPayment: InstallmentPayment = {
      id: generateId(),
      date: now.toLocaleDateString("ar-EG"),
      time: now.toLocaleTimeString("ar-EG"),
      ...payment,
    };

    const stateWithLedger = {
      ...state,
      installmentsLedger: {
        totalReceived: (state.installmentsLedger?.totalReceived ?? 0) + payment.amount,
        payments: [...(state.installmentsLedger?.payments ?? []), newPayment],
      },
    };

    const stateWithTreasury = addTreasuryEntry(stateWithLedger, {
      type: "installment",
      description: `قسط مستلم - ${payment.customerName}${payment.invoiceRef ? ` | ف: ${payment.invoiceRef}` : ""}${payment.notes ? ` | ${payment.notes}` : ""}`,
      amount: payment.amount,
      direction: "in",
      shiftId: payment.shiftId,
    });

    return stateWithTreasury;
  } catch (err) {
    console.error("addInstallmentPayment error:", err);
    return state;
  }
}

// ========== الباكدج ==========
export function addBundle(state: AppState, bundle: Bundle): AppState {
  try {
    const safeBundles = Array.isArray(state.bundles) ? state.bundles : [];
    const exists = safeBundles.find((b) => b.id === bundle.id);
    return {
      ...state,
      bundles: exists
        ? safeBundles.map((b) => (b.id === bundle.id ? bundle : b))
        : [...safeBundles, bundle],
    };
  } catch (err) {
    console.error("addBundle error:", err);
    return state;
  }
}

export function updateBundle(state: AppState, bundle: Bundle): AppState {
  try {
    const safeBundles = Array.isArray(state.bundles) ? state.bundles : [];
    return {
      ...state,
      bundles: safeBundles.map((b) => (b.id === bundle.id ? bundle : b)),
    };
  } catch (err) {
    console.error("updateBundle error:", err);
    return state;
  }
}

export function deleteBundle(state: AppState, bundleId: string): AppState {
  try {
    const safeBundles = Array.isArray(state.bundles) ? state.bundles : [];
    return {
      ...state,
      bundles: safeBundles.filter((b) => b.id !== bundleId),
    };
  } catch (err) {
    console.error("deleteBundle error:", err);
    return state;
  }
}

// ========== الوردية ==========
export type Shift = { id: string };

export function getActiveShift(): Shift | null {
  try {
    const raw = localStorage.getItem(ACTIVE_SHIFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.id) return null;
    return parsed as Shift;
  } catch {
    return null;
  }
}

export function setActiveShift(shift: Shift) {
  try {
    if (!shift?.id) return;
    localStorage.setItem(ACTIVE_SHIFT_KEY, JSON.stringify(shift));
    window.dispatchEvent(new Event("shift:changed"));
  } catch (err) {
    console.error("setActiveShift error:", err);
  }
}

export function calcShiftSummary(
  invoices: AppState["invoices"],
  installments: InstallmentPayment[] = [],
  openingBalance = 0
): ShiftSummary {
  try {
    const safe = Array.isArray(invoices) ? invoices : [];
    const safeInst = Array.isArray(installments) ? installments : [];

    const closedSales = safe.filter((i) => i.type === "sale" && i.status === "closed");
    const closedPurchases = safe.filter((i) => i.type === "purchase" && i.status === "closed");
    const returnSales = safe.filter((i) => i.type === "return_sale" && i.status === "closed");
    const returnPurchases = safe.filter((i) => i.type === "return_purchase" && i.status === "closed");
    const maintenanceInvs = safe.filter((i) => i.type === "maintenance" && i.status === "closed");
    const pendingAll = safe.filter((i) => i.status === "pending");

    const totalSales = closedSales.reduce((s, i) => s + (Number(i.total) || 0), 0);
    const totalPurchases = closedPurchases.reduce((s, i) => s + (Number(i.total) || 0), 0);
    const totalReturnSales = returnSales.reduce((s, i) => s + (Number(i.total) || 0), 0);
    const totalReturnPurchases = returnPurchases.reduce((s, i) => s + (Number(i.total) || 0), 0);
    const totalMaintenance = maintenanceInvs.reduce((s, i) => s + (Number(i.total) || 0), 0);
    const totalPending = pendingAll.reduce((s, i) => s + (Number(i.total) || 0), 0);
    const totalInstallments = safeInst.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const netProfit = totalSales - totalPurchases - totalReturnSales + totalReturnPurchases;
    const closingBalance =
      (Number(openingBalance) || 0) + netProfit + totalMaintenance + totalInstallments;

    return {
      totalSales, totalPurchases, totalReturnSales, totalReturnPurchases,
      totalMaintenance, totalInstallments, totalPending,
      netProfit, maintenanceProfit: totalMaintenance,
      invoiceCount: safe.length,
      salesCount: closedSales.length,
      purchasesCount: closedPurchases.length,
      pendingCount: pendingAll.length,
      returnSalesCount: returnSales.length,
      returnPurchasesCount: returnPurchases.length,
      maintenanceCount: maintenanceInvs.length,
      openingBalance: Number(openingBalance) || 0,
      closingBalance,
    };
  } catch {
    return {
      totalSales: 0, totalPurchases: 0, totalReturnSales: 0, totalReturnPurchases: 0,
      totalMaintenance: 0, totalInstallments: 0, totalPending: 0,
      netProfit: 0, maintenanceProfit: 0, invoiceCount: 0,
      salesCount: 0, purchasesCount: 0, pendingCount: 0,
      returnSalesCount: 0, returnPurchasesCount: 0, maintenanceCount: 0,
      openingBalance: 0, closingBalance: 0,
    };
  }
}

export function closeActiveShift(autoRestart = false): AppState {
  try {
    const currentState = loadState();
    const activeShift = getActiveShift();
    const safe = Array.isArray(currentState.invoices) ? currentState.invoices : [];
    const allInstallments = Array.isArray(currentState.installmentsLedger?.payments)
      ? currentState.installmentsLedger.payments
      : [];
    const shiftInstallments = activeShift?.id
      ? allInstallments.filter((p) => p.shiftId === activeShift.id)
      : allInstallments;

    const openingBalance = Number(currentState.treasury?.balance) || 0;
    const summary = calcShiftSummary(safe, shiftInstallments, openingBalance);

    const archive: ShiftArchive = {
      shiftId: activeShift?.id ?? `shift-${Date.now()}`,
      closedAt: new Date().toISOString(),
      invoices: [...safe],
      installments: [...shiftInstallments],
      summary,
      totalSales: summary.totalSales,
      totalPurchases: summary.totalPurchases,
      netProfit: summary.netProfit,
    };

    const newState: AppState = {
      ...currentState,
      invoices: [],
      customers: (currentState.customers ?? []).map((c) => ({ ...c, balance: 0 })),
      suppliers: (currentState.suppliers ?? []).map((s) => ({ ...s, balance: 0 })),
      installmentsLedger: { totalReceived: 0, payments: [] },
      treasury: { balance: 0, entries: [] },
      // ✅ الباكدج تبقى كما هي بعد التقفيل
      bundles: Array.isArray(currentState.bundles) ? currentState.bundles : [],
      shiftArchives: [
        ...(Array.isArray(currentState.shiftArchives) ? currentState.shiftArchives : []),
        archive,
      ],
    };

    try { localStorage.removeItem(ACTIVE_SHIFT_KEY); } catch {}
    saveState(newState);
    window.dispatchEvent(new Event("shift:changed"));
    window.dispatchEvent(new Event("shift:closed"));

    if (autoRestart || newState.settings?.autoStartShift) {
      const newShift: Shift = { id: `shift-${Date.now()}` };
      try { localStorage.setItem(ACTIVE_SHIFT_KEY, JSON.stringify(newShift)); } catch {}
      setTimeout(() => window.dispatchEvent(new Event("shift:changed")), 100);
    }

    return newState;
  } catch (err) {
    console.error("closeActiveShift error:", err);
    try { localStorage.removeItem(ACTIVE_SHIFT_KEY); } catch {}
    window.dispatchEvent(new Event("shift:changed"));
    return loadState();
  }
}