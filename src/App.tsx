// src/App.tsx - النسخة النهائية مع Supabase
import { useState, useCallback, useEffect, useMemo, useRef, useTransition } from "react";
import { AppState, Invoice, InvoiceType, Product, InstallmentPayment, Bundle } from "./types";
import {
  loadState, saveState, setActiveShift, generateId,
  calcShiftSummary, addTreasuryEntry, addInstallmentPayment
} from "./store";
import { useShift } from "./useShift";
import Dashboard from "./components/Dashboard";
import InvoiceForm from "./components/InvoiceForm";
import InvoiceRegistry from "./components/InvoiceRegistry";
import MaintenanceForm from "./components/MaintenanceForm";
import MaintenanceRegistry from "./components/MaintenanceRegistry";
import Products from "./components/Products";
import Settings from "./components/Settings";
import ShiftArchives from "./components/ShiftArchives";
import CloseShiftModal from "./components/CloseShiftModal";
import TreasuryPage from "./components/Treasury";
import InstallmentsPage from "./components/InstallmentsPage";
import DailyReport from "./components/DailyReport";
import BarcodeManager from "./components/BarcodeManager";
import CustomersLedger from "./components/CustomersLedger";
import Login from "./components/Login";
import UserManager from "./components/UserManager";
import PosMode from "./components/PosMode";
import BundleManager from "./components/BundleManager";
import InvoiceArchive from "./components/InvoiceArchive";
import StockMovement, { StockMovementsLog } from "./components/StockMovement";
import ExportCenter from "./components/ExportCenter";
import PrintInvoice from "./components/PrintInvoice";
import type { StockMovementRecord } from "./components/StockMovement";
import {
  LayoutDashboard, ShoppingCart, Package, Clock, FileText,
  Settings as SettingsIcon, Menu, X, BookOpen, Archive, Wallet,
  RotateCcw, Wrench, DollarSign, CalendarDays, Barcode, Users,
  TrendingUp, TrendingDown, RefreshCw, LogOut, ShieldCheck, Zap,
  Search, Gift, FolderOpen, ShoppingBag, ChevronRight, Download,
  AlertTriangle, CheckCircle, Info, Trash2, Printer,
  Cloud, CloudOff, Wifi, WifiOff, Clock as ClockIcon,
} from "lucide-react";
import React from "react";
import { flushSync } from "react-dom";
import { useSupabaseSync } from "./useSupabaseSync";

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════
type Page =
  | "dashboard" | "sales" | "purchases"
  | "return_sale" | "return_purchase"
  | "pending" | "registry" | "products"
  | "maintenance" | "archives" | "treasury"
  | "installments" | "daily_report"
  | "barcode" | "customers" | "settings" | "users"
  | "bundles" | "invoice_archive"
  | "accessory_sales" | "stock_movements";

type SyncStatus = "idle" | "syncing" | "saved" | "error" | "offline";

interface GlobalSearchResult {
  type: "invoice" | "product" | "customer" | "installment" | "maintenance" | "bundle";
  id: string; title: string; subtitle: string; meta: string; page: Page; data: any;
}

interface ToastMessage {
  id: string;
  type: "success" | "error" | "warning" | "info";
  message: string;
  duration?: number;
}

interface ConfirmDialogState {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  type?: "danger" | "warning";
}

const SUPABASE_ENABLED = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;
// ═══════════════════════════════════════════════════════════════════
// ✅ مؤشر المزامنة
// ═══════════════════════════════════════════════════════════════════
const SyncIndicator = React.memo(function SyncIndicator({
  syncStatus, lastSyncTime, isOnline, onManualSync, pendingSync, connectedDevices, deviceId,
}: {
  syncStatus: SyncStatus; lastSyncTime: Date | null; isOnline: boolean;
  onManualSync: () => void; pendingSync: boolean; connectedDevices: any[]; deviceId: string;
}) {
  const [show, setShow] = useState(false);

  const fmt = (d: Date | null) => {
    if (!d) return "لم تتم بعد";
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 10) return "الآن";
    if (s < 60) return `منذ ${s}ث`;
    if (s < 3600) return `منذ ${Math.floor(s / 60)}د`;
    return d.toLocaleTimeString("ar-EG");
  };

  const cfg: Record<SyncStatus, { icon: any; color: string; bg: string; label: string; spin: boolean }> = {
    idle: { icon: Cloud, color: "text-blue-500", bg: "bg-blue-50", label: "متزامن", spin: false },
    syncing: { icon: RefreshCw, color: "text-amber-500", bg: "bg-amber-50", label: "حفظ...", spin: true },
    saved: { icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-50", label: "محفوظ", spin: false },
    error: { icon: AlertTriangle, color: "text-red-500", bg: "bg-red-50", label: "خطأ", spin: false },
    offline: { icon: CloudOff, color: "text-gray-400", bg: "bg-gray-100", label: "أوفلاين", spin: false },
  };

  const c = cfg[syncStatus];
  const Icon = c.icon;
  const onlineDevices = connectedDevices.filter(d => d.isOnline);

  if (!SUPABASE_ENABLED) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setShow(s => !s)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl ${c.bg} transition-all hover:opacity-80 border border-transparent hover:border-gray-200`}
        title="حالة المزامنة السحابية"
      >
        <Icon size={14} className={`${c.color} ${c.spin ? "animate-spin" : ""}`} />
        <span className={`text-xs font-bold ${c.color} hidden sm:block`}>{c.label}</span>
        {pendingSync && !c.spin && <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />}
        {onlineDevices.length > 1 && (
          <span className="hidden sm:flex items-center justify-center w-4 h-4 bg-blue-500 text-white rounded-full text-[9px] font-black">
            {onlineDevices.length}
          </span>
        )}
      </button>

      {show && (
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setShow(false)} />
          <div className="absolute top-full left-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[100] w-72 overflow-hidden" dir="rtl">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white">
                  <Cloud size={16} />
                  <span className="font-black text-sm">المزامنة السحابية - Supabase</span>
                </div>
                <button onClick={() => setShow(false)} className="text-white/70 hover:text-white"><X size={14} /></button>
              </div>
            </div>

            <div className="p-4 space-y-3">
              <div className={`flex items-center gap-2.5 p-2.5 rounded-xl ${isOnline ? "bg-emerald-50" : "bg-red-50"}`}>
                {isOnline
                  ? <><Wifi size={14} className="text-emerald-500" /><span className="text-sm font-bold text-emerald-600">متصل بالإنترنت</span></>
                  : <><WifiOff size={14} className="text-red-400" /><span className="text-sm font-bold text-red-500">غير متصل</span></>
                }
              </div>

              <div className={`flex items-center gap-2.5 p-2.5 rounded-xl ${c.bg}`}>
                <Icon size={14} className={`${c.color} ${c.spin ? "animate-spin" : ""}`} />
                <span className={`text-sm font-bold ${c.color}`}>{c.label}</span>
                {pendingSync && (
                  <span className="mr-auto text-xs text-amber-600 font-semibold">⏳ بانتظار الإرسال</span>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-400">
                <ClockIcon size={11} />
                <span>آخر مزامنة: {fmt(lastSyncTime)}</span>
              </div>

              {onlineDevices.length > 0 && (
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                    <span className="text-xs font-black text-gray-600">
                      📱 الأجهزة المتصلة ({onlineDevices.length})
                    </span>
                  </div>
                  <div className="max-h-32 overflow-y-auto">
                    {onlineDevices.map((d: any) => (
                      <div key={d.deviceId || d.id} className={`flex items-center gap-2 px-3 py-2 border-b border-gray-50 last:border-0 ${(d.deviceId || d.id) === deviceId ? "bg-blue-50" : ""}`}>
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-gray-700 truncate">{d.deviceName}</div>
                          <div className="text-[10px] text-gray-400 truncate">{d.userName}</div>
                        </div>
                        {(d.deviceId || d.id) === deviceId && (
                          <span className="text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-black flex-shrink-0">أنت</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => { onManualSync(); setShow(false); }}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 active:scale-95 transition-all"
              >
                <RefreshCw size={13} />
                مزامنة الآن
              </button>

              {!SUPABASE_ENABLED && (
                <div className="text-xs text-gray-400 text-center bg-gray-50 rounded-xl p-2">
                  ⚠️ Supabase غير مفعل — أضف VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في .env
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
});
// ═══════════════════════════════════════════════════════════════════
// PURE UTILS
// ═══════════════════════════════════════════════════════════════════
function applyStockChange(products: Product[], invoice: Invoice, action: "apply" | "reverse"): Product[] {
  if (!invoice?.items?.length || !Array.isArray(products)) return products ?? [];
  const productMap = new Map(products.map(p => [p.id, { ...p }]));
  for (const item of invoice.items) {
    if (!item?.productId || !item.quantity || item.quantity <= 0) continue;
    const product = productMap.get(item.productId);
    if (!product) continue;
    let stock = Math.max(0, product.stock ?? 0);
    let reserved = Math.max(0, (product as any).reserved ?? 0);
    const qty = Math.abs(item.quantity);
    switch (invoice.type) {
      case "sale": case "accessory_sale":
        if (action === "apply") { stock = Math.max(0, stock - qty); reserved = Math.max(0, reserved - qty); }
        else stock = stock + qty;
        break;
      case "purchase": case "accessory_purchase":
        if (action === "apply") stock = stock + qty; else stock = Math.max(0, stock - qty);
        break;
      case "return_sale": stock = action === "apply" ? stock + qty : Math.max(0, stock - qty); break;
      case "return_purchase": stock = action === "apply" ? Math.max(0, stock - qty) : stock + qty; break;
      default: continue;
    }
    productMap.set(item.productId, { ...product, stock, reserved } as any);
  }
  return products.map(p => productMap.get(p.id) ?? p);
}

function reserveStockForPending(products: Product[], invoice: Invoice, action: "reserve" | "release"): Product[] {
  if (!invoice?.items?.length || !Array.isArray(products)) return products ?? [];
  if (!["sale", "accessory_sale"].includes(invoice.type)) return products;
  const productMap = new Map(products.map(p => [p.id, { ...p }]));
  for (const item of invoice.items) {
    if (!item?.productId || !item.quantity || item.quantity <= 0) continue;
    const product = productMap.get(item.productId);
    if (!product) continue;
    const qty = Math.abs(item.quantity);
    let reserved = Math.max(0, (product as any).reserved ?? 0);
    reserved = action === "reserve" ? reserved + qty : Math.max(0, reserved - qty);
    productMap.set(item.productId, { ...product, reserved } as any);
  }
  return products.map(p => productMap.get(p.id) ?? p);
}

function validateStockForSale(invoice: Invoice, products: Product[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!["sale", "accessory_sale"].includes(invoice.type)) return { valid: true, errors: [] };
  if (!invoice.items?.length) return { valid: true, errors: [] };
  const productMap = new Map(products.map(p => [p.id, p]));
  const requested = new Map<string, { name: string; totalQty: number }>();
  for (const item of invoice.items) {
    if (!item?.productId || !item.quantity) continue;
    const ex = requested.get(item.productId);
    if (ex) ex.totalQty += Math.abs(item.quantity);
    else requested.set(item.productId, { name: item.productName || "منتج غير معروف", totalQty: Math.abs(item.quantity) });
  }
  for (const [productId, { name, totalQty }] of requested) {
    const product = productMap.get(productId);
    if (!product) continue;
    const stock = product.stock ?? 0;
    if (stock <= 0) errors.push(`❌ "${name}" — المخزون نفد تماماً`);
    else if (totalQty > stock) errors.push(`⚠️ "${name}" — المطلوب (${totalQty}) > المتاح (${stock})`);
  }
  return { valid: errors.length === 0, errors };
}

const debouncedSave = (() => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastJson = "";
  return (state: AppState) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        const json = JSON.stringify(state);
        if (json !== lastJson) { saveState(state); lastJson = json; }
      } catch (e) { console.error("Save failed:", e); }
    }, 1000);
  };
})();

function performGlobalSearch(
  query: string, invoices: Invoice[], products: Product[],
  installments: InstallmentPayment[], currency: string, archives?: any[]
): GlobalSearchResult[] {
  const trimmed = query?.trim();
  if (!trimmed || trimmed.length < 2) return [];
  const q = trimmed.toLowerCase();
  const results: GlobalSearchResult[] = [];
  const typeLabels: Record<string, string> = {
    sale: "🛒 مبيعات", purchase: "📦 مشتريات",
    return_sale: "↩️ مرتجع بيع", return_purchase: "↪️ مرتجع شراء",
    maintenance: "🔧 صيانة", accessory_sale: "🛍️ اكسسوار",
    accessory_purchase: "📦 شراء اكسسوار"
  };
  const pageMap: Record<string, Page> = {
    sale: "sales", purchase: "purchases", return_sale: "return_sale",
    return_purchase: "return_purchase", maintenance: "maintenance",
    accessory_sale: "accessory_sales", accessory_purchase: "accessory_sales"
  };
  for (const inv of invoices) {
    if (!inv || results.length >= 20) break;
    const fields = [
      inv.number, inv.customerName, inv.customerPhone, inv.supplierName,
      inv.supplierPhone, inv.date, inv.maintenanceInfo?.imei,
      inv.maintenanceInfo?.deviceBrand, inv.maintenanceInfo?.deviceModel,
      inv.notes, ...(inv.items?.map(it => it?.productName) ?? [])
    ].filter(Boolean);
    if (fields.some(f => f?.toString().toLowerCase().includes(q))) {
      results.push({
        type: inv.type === "maintenance" ? "maintenance" : "invoice",
        id: inv.id,
        title: `${typeLabels[inv.type] ?? inv.type} — ${inv.number ?? ""}`,
        subtitle: [inv.customerName || inv.supplierName || "-", inv.customerPhone || inv.supplierPhone].filter(Boolean).join(" · "),
        meta: `📅 ${inv.date ?? ""} · 💰 ${(inv.paid ?? 0).toLocaleString()} ${currency} · الوردية الحالية`,
        page: pageMap[inv.type] ?? "registry",
        data: inv
      });
    }
  }
  if (archives?.length) {
    for (const arch of archives) {
      if (!arch || results.length >= 35) break;
      const archInvoices: Invoice[] = Array.isArray(arch.invoices) ? arch.invoices : [];
      for (const inv of archInvoices) {
        if (!inv || results.length >= 35) break;
        const fields = [
          inv.number, inv.customerName, inv.customerPhone, inv.supplierName,
          inv.supplierPhone, inv.date, inv.maintenanceInfo?.imei,
          ...(inv.items?.map(it => it?.productName) ?? [])
        ].filter(Boolean);
        if (fields.some(f => f?.toString().toLowerCase().includes(q))) {
          results.push({
            type: inv.type === "maintenance" ? "maintenance" : "invoice",
            id: `arch-${arch.id}-${inv.id}`,
            title: `${typeLabels[inv.type] ?? inv.type} — ${inv.number ?? ""} 🗂️`,
            subtitle: [inv.customerName || inv.supplierName || "-", inv.customerPhone || inv.supplierPhone].filter(Boolean).join(" · "),
            meta: `📅 ${inv.date ?? ""} · 💰 ${(inv.paid ?? 0).toLocaleString()} ${currency} · أرشيف: ${arch.date ?? arch.id}`,
            page: pageMap[inv.type] ?? "invoice_archive",
            data: { ...inv, archivedShiftId: arch.id }
          });
        }
      }
    }
  }
  for (const p of products) {
    if (!p || results.length >= 38) break;
    if (p.name?.toLowerCase().includes(q) || p.barcode?.includes(q) || p.category?.toLowerCase().includes(q)) {
      results.push({
        type: "product", id: p.id, title: `📦 ${p.name}`,
        subtitle: p.category ? `فئة: ${p.category}` : "منتج",
        meta: `مخزون: ${p.stock ?? 0} · سعر: ${(p.sellingPrice ?? 0).toLocaleString()} ${currency}`,
        page: "products", data: p
      });
    }
  }
  for (const p of installments) {
    if (!p || results.length >= 40) break;
    if (p.customerName?.toLowerCase().includes(q) || p.customerPhone?.includes(q)) {
      results.push({
        type: "installment", id: p.id, title: `💰 ${p.customerName}`,
        subtitle: p.customerPhone ?? "",
        meta: `${p.date ?? ""} · ${(p.amount ?? 0).toLocaleString()} ${currency}`,
        page: "installments", data: p
      });
    }
  }
  return results;
}
// ═══════════════════════════════════════════════════════════════════
// CONFIRM DIALOG
// ═══════════════════════════════════════════════════════════════════
const ConfirmDialog = React.memo(function ConfirmDialog({
  state, onCancel
}: {
  state: ConfirmDialogState; onCancel: () => void
}) {
  if (!state.open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998] flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in">
        <div className={`px-6 py-4 ${state.type === "danger" ? "bg-red-50 border-b border-red-100" : "bg-amber-50 border-b border-amber-100"}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${state.type === "danger" ? "bg-red-100" : "bg-amber-100"}`}>
              <AlertTriangle size={20} className={state.type === "danger" ? "text-red-600" : "text-amber-600"} />
            </div>
            <h3 className={`font-black text-base ${state.type === "danger" ? "text-red-800" : "text-amber-800"}`}>{state.title}</h3>
          </div>
        </div>
        <div className="px-6 py-4">
          <p className="text-gray-600 text-sm leading-relaxed">{state.message}</p>
        </div>
        <div className="flex gap-3 px-6 pb-5">
          <button
            onClick={() => { state.onConfirm(); onCancel(); }}
            className={`flex-1 py-2.5 rounded-xl font-black text-sm text-white transition-all active:scale-95 ${state.type === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-amber-500 hover:bg-amber-600"}`}
          >
            <Trash2 size={14} className="inline ml-1" />تأكيد
          </button>
          <button
            onClick={onCancel}
            autoFocus
            className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════
// PRINT AFTER SAVE MODAL
// ═══════════════════════════════════════════════════════════════════
const PrintAfterSaveModal = React.memo(function PrintAfterSaveModal({
  invoice, currency, onPrint, onSkip
}: {
  invoice: Invoice; currency: string; onPrint: () => void; onSkip: () => void
}) {
  const typeLabels: Record<string, string> = {
    sale: "🛒 فاتورة بيع", purchase: "📦 فاتورة شراء",
    return_sale: "↩️ مرتجع بيع", return_purchase: "↪️ مرتجع شراء",
    maintenance: "🔧 فاتورة صيانة", accessory_sale: "🛍️ فاتورة اكسسوار",
    accessory_purchase: "📦 شراء اكسسوار"
  };
  const typeColors: Record<string, string> = {
    sale: "from-blue-600 to-blue-700", purchase: "from-green-600 to-green-700",
    return_sale: "from-orange-500 to-orange-600", return_purchase: "from-purple-600 to-purple-700",
    maintenance: "from-violet-600 to-violet-700", accessory_sale: "from-amber-500 to-amber-600",
    accessory_purchase: "from-teal-600 to-teal-700"
  };
  const gradient = typeColors[invoice.type] || "from-blue-600 to-blue-700";
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[500] flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in">
        <div className={`bg-gradient-to-r ${gradient} px-6 py-5 text-white text-center`}>
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <CheckCircle size={28} className="text-white" />
          </div>
          <h3 className="font-black text-lg">تم الحفظ بنجاح! ✅</h3>
          <p className="text-white/80 text-sm mt-1">{typeLabels[invoice.type] || "فاتورة"} — {invoice.number || ""}</p>
        </div>
        <div className="px-5 py-4 bg-gray-50 border-b border-gray-100">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl px-3 py-2.5 border border-gray-100 text-center">
              <div className="text-xs text-gray-400 font-medium">الإجمالي</div>
              <div className="text-base font-black text-gray-800">
                {(invoice.total ?? 0).toLocaleString()}
                <span className="text-xs font-normal text-gray-400 mr-1">{currency}</span>
              </div>
            </div>
            <div className="bg-white rounded-xl px-3 py-2.5 border border-gray-100 text-center">
              <div className="text-xs text-gray-400 font-medium">المدفوع</div>
              <div className="text-base font-black text-emerald-600">
                {(invoice.paid ?? 0).toLocaleString()}
                <span className="text-xs font-normal text-gray-400 mr-1">{currency}</span>
              </div>
            </div>
            {(invoice.remaining ?? 0) > 0 && (
              <div className="col-span-2 bg-red-50 rounded-xl px-3 py-2 border border-red-100 text-center">
                <div className="text-xs text-red-400 font-medium">المتبقي</div>
                <div className="text-base font-black text-red-600">
                  {(invoice.remaining ?? 0).toLocaleString()}
                  <span className="text-xs font-normal text-red-400 mr-1">{currency}</span>
                </div>
              </div>
            )}
            {(invoice.customerName || invoice.supplierName) && (
              <div className="col-span-2 bg-white rounded-xl px-3 py-2 border border-gray-100">
                <div className="text-xs text-gray-400 font-medium">
                  {["sale", "return_sale", "maintenance", "accessory_sale"].includes(invoice.type) ? "العميل" : "المورد"}
                </div>
                <div className="text-sm font-bold text-gray-700 truncate">
                  {invoice.customerName || invoice.supplierName}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="px-5 py-4 space-y-2.5">
          <button
            onClick={onPrint}
            className={`w-full flex items-center justify-center gap-2.5 py-3.5 bg-gradient-to-r ${gradient} text-white rounded-xl font-black text-base hover:opacity-90 active:scale-95 shadow-lg transition-all`}
          >
            <Printer size={18} />طباعة الفاتورة
          </button>
          <button
            onClick={onSkip}
            className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 active:scale-95 transition-colors"
          >
            تخطي الطباعة
          </button>
        </div>
        <div className="px-5 pb-4 text-center">
          <p className="text-xs text-gray-400">يمكنك طباعة الفاتورة لاحقاً من السجل</p>
        </div>
      </div>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════════════════
const ToastContainer = React.memo(function ToastContainer({
  toasts, onRemove
}: {
  toasts: ToastMessage[]; onRemove: (id: string) => void
}) {
  if (toasts.length === 0) return null;
  const icons = {
    success: <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />,
    error: <X size={16} className="text-red-500 flex-shrink-0" />,
    warning: <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />,
    info: <Info size={16} className="text-blue-500 flex-shrink-0" />
  };
  const colors = {
    success: "border-emerald-200 bg-emerald-50",
    error: "border-red-200 bg-red-50",
    warning: "border-amber-200 bg-amber-50",
    info: "border-blue-200 bg-blue-50"
  };
  return (
    <div className="fixed bottom-4 left-4 z-[9999] flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map(toast => (
        <div key={toast.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg pointer-events-auto ${colors[toast.type]}`}>
          {icons[toast.type]}
          <span className="text-sm font-semibold text-gray-800 flex-1">{toast.message}</span>
          <button onClick={() => onRemove(toast.id)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════
// BALANCE CARDS
// ═══════════════════════════════════════════════════════════════════
const BalanceCard = React.memo(function BalanceCard({
  label, value, currency, color, icon: Icon, count
}: {
  label: string; value: number; currency: string; color: string; icon: any; count?: number
}) {
  return (
    <div className={`rounded-xl px-3 py-2.5 ${color}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={13} />
        <span className="text-xs font-semibold opacity-85">{label}</span>
        {count !== undefined && count > 0 && (
          <span className="text-xs opacity-60 mr-auto font-medium">({count})</span>
        )}
      </div>
      <div className="text-base font-black leading-tight">
        {(value ?? 0).toLocaleString()}
        <span className="text-xs font-normal opacity-60 mr-1">{currency}</span>
      </div>
    </div>
  );
});

const ShiftBalanceItem = React.memo(function ShiftBalanceItem({
  icon: Icon, label, count, value, currency, bg, border, iconColor, labelColor, valueColor
}: {
  icon: any; label: string; count?: number; value: number; currency: string;
  bg: string; border: string; iconColor: string; labelColor: string; valueColor: string
}) {
  return (
    <div className={`flex items-center gap-2 ${bg} ${border} border rounded-xl px-3 py-2 flex-shrink-0`}>
      <Icon size={14} className={`${iconColor} flex-shrink-0`} />
      <div>
        <div className={`text-xs font-medium ${labelColor} leading-tight`}>
          {label}{count !== undefined ? ` (${count})` : ""}
        </div>
        <div className={`text-sm font-black ${valueColor} leading-tight`}>
          {(value ?? 0).toLocaleString()} {currency}
        </div>
      </div>
    </div>
  );
});
// ═══════════════════════════════════════════════════════════════════
// GLOBAL SEARCH BAR
// ═══════════════════════════════════════════════════════════════════
const GlobalSearchBar = React.memo(function GlobalSearchBar({
  invoices, products, installments, currency, onNavigate, onEditInvoice, archives
}: {
  invoices: Invoice[]; products: Product[]; installments: InstallmentPayment[];
  currency: string; onNavigate: (page: Page) => void;
  onEditInvoice: (invoice: Invoice) => void; archives?: any[]
}) {
  const [inputValue, setInputValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [focused, setFocused] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataRef = useRef({ invoices, products, installments, currency, archives });

  useEffect(() => {
    dataRef.current = { invoices, products, installments, currency, archives };
  }, [invoices, products, installments, currency, archives]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 2) { setSearchQuery(""); setResults([]); return; }
    debounceRef.current = setTimeout(() => {
      startTransition(() => {
        const { invoices, products, installments, currency, archives } = dataRef.current;
        const r = performGlobalSearch(val, invoices, products, installments, currency, archives);
        setResults(r); setSearchQuery(val); setSelectedIdx(0);
      });
    }, 300);
  }, []);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const handleSelect = useCallback((r: GlobalSearchResult) => {
    if (r.type === "invoice" || r.type === "maintenance") onEditInvoice(r.data);
    else onNavigate(r.page);
    setInputValue(""); setSearchQuery(""); setResults([]); setFocused(false);
  }, [onEditInvoice, onNavigate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { if (results[selectedIdx]) handleSelect(results[selectedIdx]); }
    else if (e.key === "Escape") {
      setInputValue(""); setSearchQuery(""); setResults([]);
      setFocused(false); inputRef.current?.blur();
    }
  }, [results, selectedIdx, handleSelect]);

  return (
    <div className="relative">
      <div className={`flex items-center gap-2 border rounded-xl px-3 py-2.5 transition-all duration-200 ${focused ? "border-blue-400 bg-white shadow-lg w-80 lg:w-[420px]" : "border-gray-200 bg-gray-50 w-44 lg:w-72"}`}>
        <Search size={16} className={`flex-shrink-0 ${isPending ? "text-blue-400 animate-pulse" : focused ? "text-blue-500" : "text-gray-400"}`} />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          onKeyDown={handleKeyDown}
          placeholder="بحث شامل... (Ctrl+K)"
          className="flex-1 text-sm bg-transparent outline-none text-gray-700 placeholder-gray-400 min-w-0"
          data-global-search
          autoComplete="off"
          spellCheck={false}
        />
        {inputValue && (
          <button onClick={() => { setInputValue(""); setResults([]); inputRef.current?.focus(); }} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <X size={14} />
          </button>
        )}
      </div>
      {focused && searchQuery.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[200] overflow-hidden max-h-[60vh] overflow-y-auto min-w-[340px]">
          {results.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <Search size={28} className="mx-auto mb-2 opacity-20" />
              <div className="text-sm">لا توجد نتائج</div>
            </div>
          ) : (
            <>
              <div className="px-4 py-2.5 bg-gray-50 border-b sticky top-0 flex items-center justify-between">
                <span className="text-sm font-bold text-gray-600">نتائج البحث</span>
                <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-400">{results.length}</span>
              </div>
              {results.map((r, idx) => (
                <button
                  key={`${r.id}-${idx}`}
                  type="button"
                  onMouseDown={e => { e.preventDefault(); handleSelect(r); }}
                  className={`w-full text-right px-4 py-3 hover:bg-blue-50 border-b border-gray-50 flex items-center gap-3 ${idx === selectedIdx ? "bg-blue-50" : ""}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-800 text-sm truncate">{r.title}</div>
                    {r.subtitle && <div className="text-xs text-gray-500 truncate">{r.subtitle}</div>}
                    {r.meta && <div className="text-xs text-gray-400 truncate">{r.meta}</div>}
                  </div>
                  <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />
                </button>
              ))}
              <div className="px-4 py-2 bg-gray-50 border-t flex gap-4 text-xs text-gray-400">
                <span>↑↓ تنقل</span><span>Enter اختيار</span><span>Esc إغلاق</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════
// ERROR BOUNDARY
// ═══════════════════════════════════════════════════════════════════
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(e: Error) { return { hasError: true, error: e }; }
  componentDidCatch(e: Error, i: React.ErrorInfo) { console.error(e, i); }
  render() {
    if (this.state.hasError) return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-8" dir="rtl">
        <div className="bg-white rounded-2xl p-8 max-w-md text-center shadow-xl">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-black text-red-700 mb-2">حدث خطأ</h2>
          <p className="text-gray-500 text-sm mb-6">{this.state.error?.message}</p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold"
          >
            إعادة تشغيل
          </button>
        </div>
      </div>
    );
    return this.props.children;
  }
}
// ═══════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════
export default function App() {
  const [state, setState] = useState<AppState>(() => {
    try { return loadState(); }
    catch { try { localStorage.removeItem("appState"); } catch {} return loadState(); }
  });

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const [currentUser, setCurrentUser] = useState<any>(() => {
    try { const s = sessionStorage.getItem("currentUser"); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const currentUserRef = useRef(currentUser);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  const [page, setPage] = useState<Page>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [newInvoiceType, setNewInvoiceType] = useState<InvoiceType>("sale");
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [showInstallmentModal, setShowInstallmentModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [showPosMode, setShowPosMode] = useState(false);
  const [showExportCenter, setShowExportCenter] = useState(false);
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);
  const [showStockMovement, setShowStockMovement] = useState(false);
  const [stockMovementType, setStockMovementType] = useState<"in" | "out">("in");
  const [editingArchiveId, setEditingArchiveId] = useState<string | null>(null);
  const [quickInstallment, setQuickInstallment] = useState({
    customerName: "", customerPhone: "", amount: 0, invoiceRef: "", notes: ""
  });
  const [showPrintAfterSave, setShowPrintAfterSave] = useState(false);
  const [lastSavedInvoice, setLastSavedInvoice] = useState<Invoice | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    open: false, title: "", message: "", onConfirm: () => {}, type: "danger"
  });

  const showConfirm = useCallback((
    title: string, message: string, onConfirm: () => void, type: "danger" | "warning" = "danger"
  ) => {
    setConfirmDialog({ open: true, title, message, onConfirm, type });
  }, []);

  const hideConfirm = useCallback(() => {
    setConfirmDialog(prev => ({ ...prev, open: false }));
  }, []);

  const [, startTransition] = useTransition();
  const { hasActiveShift, closeShift, activeShift } = useShift();
  const isAdmin = currentUser?.role === "admin";
  const isAdminRef = useRef(isAdmin);
  useEffect(() => { isAdminRef.current = isAdmin; }, [isAdmin]);

  // ✅ Supabase Cloud Sync
  const handleCloudUpdate = useCallback((cloudState: AppState) => {
    if (!cloudState || typeof cloudState !== "object") return;
    setState(cloudState);
  }, []);

  const {
    syncStatus, lastSyncTime, isOnline, pendingSync,
    connectedDevices, manualSync, deviceId,
  } = useSupabaseSync(state, handleCloudUpdate, currentUser);

  // Modal refs
  const mRefs = useRef({
    invoiceForm: false, maintenanceForm: false, installmentModal: false,
    closeShiftModal: false, stockMovement: false, exportCenter: false,
    posMode: false, sidebar: false, hasActiveShift: false, printAfterSave: false
  });
  useEffect(() => { mRefs.current.invoiceForm = showInvoiceForm; }, [showInvoiceForm]);
  useEffect(() => { mRefs.current.maintenanceForm = showMaintenanceForm; }, [showMaintenanceForm]);
  useEffect(() => { mRefs.current.installmentModal = showInstallmentModal; }, [showInstallmentModal]);
  useEffect(() => { mRefs.current.closeShiftModal = showCloseShiftModal; }, [showCloseShiftModal]);
  useEffect(() => { mRefs.current.stockMovement = showStockMovement; }, [showStockMovement]);
  useEffect(() => { mRefs.current.exportCenter = showExportCenter; }, [showExportCenter]);
  useEffect(() => { mRefs.current.posMode = showPosMode; }, [showPosMode]);
  useEffect(() => { mRefs.current.sidebar = sidebarOpen; }, [sidebarOpen]);
  useEffect(() => { mRefs.current.hasActiveShift = hasActiveShift; }, [hasActiveShift]);
  useEffect(() => { mRefs.current.printAfterSave = showPrintAfterSave; }, [showPrintAfterSave]);

  // Computed
  const safeInvoices = useMemo(() => Array.isArray(state.invoices) ? state.invoices.filter(Boolean) : [], [state.invoices]);
  const safeProducts = useMemo(() => Array.isArray(state.products) ? state.products.filter(Boolean) : [], [state.products]);
  const safeCustomers = useMemo(() => Array.isArray(state.customers) ? state.customers.filter(Boolean) : [], [state.customers]);
  const safeSuppliers = useMemo(() => Array.isArray(state.suppliers) ? state.suppliers.filter(Boolean) : [], [state.suppliers]);
  const safeArchives = useMemo(() => Array.isArray(state.shiftArchives) ? state.shiftArchives.filter(Boolean) : [], [state.shiftArchives]);
  const safeInstallments = useMemo(() => state.installmentsLedger ?? { totalReceived: 0, payments: [] }, [state.installmentsLedger]);
  const safeBundles = useMemo(() => Array.isArray(state.bundles) ? state.bundles.filter(Boolean) : [], [state.bundles]) as Bundle[];
  const safeStockMovements = useMemo(() => Array.isArray((state as any).stockMovements) ? (state as any).stockMovements : [], [(state as any).stockMovements]) as StockMovementRecord[];
  const currency = state.settings?.currency ?? "EGP";
  const cs = useMemo(() => calcShiftSummary(safeInvoices, safeInstallments.payments, state.treasury?.balance ?? 0), [safeInvoices, safeInstallments.payments, state.treasury?.balance]);
  const pendingInvoices = useMemo(() => safeInvoices.filter(i => i.status === "pending"), [safeInvoices]);
  const maintenanceReadyCount = useMemo(() => safeInvoices.filter(i => i.type === "maintenance" && i.maintenanceInfo?.maintenanceStatus === "ready").length, [safeInvoices]);
  const netSales = useMemo(() => (cs.totalSales ?? 0) - (cs.totalPurchases ?? 0) - (cs.totalReturnSales ?? 0) + (cs.totalReturnPurchases ?? 0), [cs]);
  const netAccessory = useMemo(() => (cs.totalAccessorySales ?? 0) - (cs.totalAccessoryPurchases ?? 0), [cs]);
  const totalOverall = useMemo(() => netSales + (cs.totalMaintenance ?? 0) + (cs.totalInstallments ?? 0) + netAccessory, [netSales, cs, netAccessory]);

  // Toast
  const toastTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const showToast = useCallback((message: string, type: ToastMessage["type"] = "info", duration = 3500) => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts(prev => [...prev.slice(-4), { id, type, message, duration }]);
    if (duration > 0) {
      const timer = setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
        toastTimers.current.delete(id);
      }, duration);
      toastTimers.current.set(id, timer);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    const t = toastTimers.current.get(id);
    if (t) { clearTimeout(t); toastTimers.current.delete(id); }
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => () => { toastTimers.current.forEach(t => clearTimeout(t)); }, []);

  // Persistence
  useEffect(() => { debouncedSave(state); }, [state]);
  useEffect(() => {
    const save = () => { try { saveState(stateRef.current); } catch {} };
    window.addEventListener("beforeunload", save);
    return () => window.removeEventListener("beforeunload", save);
  }, []);
  useEffect(() => {
    try {
      if (currentUser) sessionStorage.setItem("currentUser", JSON.stringify(currentUser));
      else sessionStorage.removeItem("currentUser");
    } catch {}
  }, [currentUser]);

  // Modals
  const closeAllModals = useCallback(() => {
    if (mRefs.current.printAfterSave) { setShowPrintAfterSave(false); setLastSavedInvoice(null); return; }
    if (mRefs.current.exportCenter) { setShowExportCenter(false); return; }
    if (mRefs.current.stockMovement) { setShowStockMovement(false); return; }
    if (mRefs.current.invoiceForm) { setShowInvoiceForm(false); setEditingInvoice(null); setEditingArchiveId(null); return; }
    if (mRefs.current.maintenanceForm) { setShowMaintenanceForm(false); setEditingInvoice(null); setEditingArchiveId(null); return; }
    if (mRefs.current.installmentModal) { setShowInstallmentModal(false); setQuickInstallment({ customerName: "", customerPhone: "", amount: 0, invoiceRef: "", notes: "" }); return; }
    if (mRefs.current.closeShiftModal) { setShowCloseShiftModal(false); return; }
    if (mRefs.current.posMode) { setShowPosMode(false); return; }
    if (mRefs.current.sidebar) { setSidebarOpen(false); return; }
  }, []);

  const openForm = useCallback((type: InvoiceType) => {
    if (!mRefs.current.hasActiveShift) { showToast("يجب فتح وردية أولاً", "warning"); return; }
    setNewInvoiceType(type); setEditingInvoice(null); setEditingArchiveId(null); setShowInvoiceForm(true);
  }, [showToast]);

  const openMaintenanceForm = useCallback(() => {
    if (!mRefs.current.hasActiveShift) { showToast("يجب فتح وردية أولاً", "warning"); return; }
    setEditingInvoice(null); setEditingArchiveId(null); setShowMaintenanceForm(true);
  }, [showToast]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        document.querySelector<HTMLInputElement>("[data-global-search]")?.focus();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "e") { e.preventDefault(); setShowExportCenter(true); return; }
      if (e.key === "Escape") { closeAllModals(); return; }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      const anyOpen = mRefs.current.invoiceForm || mRefs.current.maintenanceForm || mRefs.current.installmentModal ||
        mRefs.current.closeShiftModal || mRefs.current.stockMovement || mRefs.current.exportCenter ||
        mRefs.current.posMode || mRefs.current.printAfterSave;
      if (anyOpen) return;
      switch (e.key) {
        case "F1": e.preventDefault(); openForm("sale"); break;
        case "F2": e.preventDefault(); openForm("purchase"); break;
        case "F3": e.preventDefault(); setPage("products"); break;
        case "F5": e.preventDefault(); setPage("dashboard"); break;
        case "F6": e.preventDefault(); setPage("registry"); break;
        case "F7": e.preventDefault(); openMaintenanceForm(); break;
        case "F8": e.preventDefault(); setShowInstallmentModal(true); break;
        case "F9": e.preventDefault(); setShowPosMode(true); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeAllModals, openForm, openMaintenanceForm]);

  const handleOpenShift = useCallback(() => {
    try { setActiveShift({ id: `shift-${Date.now()}` }); showToast("تم فتح الوردية", "success"); }
    catch { showToast("فشل فتح الوردية", "error"); }
  }, [showToast]);

  const confirmCloseShift = useCallback((autoRestart: boolean, rs?: any) => {
    try {
      setShowCloseShiftModal(false);
      const ns = (closeShift as any)(autoRestart, rs);
      setState(ns && Object.keys(ns).length > 0 ? ns : loadState());
      setShowInvoiceForm(false); setShowMaintenanceForm(false); setShowInstallmentModal(false);
      setEditingInvoice(null); setEditingArchiveId(null); setPage("dashboard");
      showToast("تم تقفيل الوردية", "success");
    } catch {
      setShowCloseShiftModal(false);
      try { setState(loadState()); } catch {}
      showToast("خطأ في تقفيل الوردية", "error");
    }
  }, [closeShift, showToast]);
    const updateArchivedInvoiceOnly = useCallback((invoice: Invoice, archiveId: string) => {
    setState(prev => {
      try {
        if (!invoice || !archiveId) return prev;
        const now = new Date();
        const edited: Invoice = {
          ...invoice,
          notes: invoice.notes
            ? `${invoice.notes}\n✏️ تعديل: ${now.toLocaleString("ar-EG")}`
            : `✏️ تعديل: ${now.toLocaleString("ar-EG")}`
        };
        (edited as any).lastEditedAt = now.toISOString();
        (edited as any).lastEditedBy = currentUserRef.current?.name ?? "admin";
        (edited as any).isEdited = true;
        delete (edited as any).archivedShiftId;
        const newArchives = (prev.shiftArchives ?? []).map((arch: any) => {
          if (!arch || String(arch.id) !== String(archiveId)) return arch;
          const oldInvs: Invoice[] = Array.isArray(arch.invoices) ? arch.invoices : [];
          const exists = oldInvs.some(i => i.id === edited.id);
          const newInvs = exists
            ? oldInvs.map(i => i.id === edited.id ? edited : i)
            : [...oldInvs, edited];
          const archInst = Array.isArray(arch.installments) ? arch.installments : [];
          return {
            ...arch, invoices: newInvs,
            summary: calcShiftSummary(newInvs, archInst, 0),
            lastModified: now.toISOString(), isModified: true
          };
        });
        return { ...prev, shiftArchives: newArchives };
      } catch { return prev; }
    });
  }, []);

  const handleSaveInvoice = useCallback((invoice: Invoice) => {
    if (!invoice) return;
    if (editingArchiveId) {
      updateArchivedInvoiceOnly(invoice, editingArchiveId);
      setShowInvoiceForm(false); setEditingInvoice(null); setEditingArchiveId(null);
      showToast("تم تعديل الفاتورة في الأرشيف", "success"); return;
    }
    if (invoice.status === "closed") {
      const cur = stateRef.current;
      const existing = cur.invoices.find(i => i.id === invoice.id);
      if (existing?.status !== "closed") {
        const check = validateStockForSale(invoice, cur.products);
        if (!check.valid) {
          check.errors.forEach((err, i) => setTimeout(() => showToast(err, "error", 5000), i * 600));
          return;
        }
      }
    }
    flushSync(() => {
      setState(prev => {
        try {
          const existing = prev.invoices.find(i => i.id === invoice.id);
          const oldStatus = existing?.status;
          if (invoice.status === "closed" && oldStatus !== "closed" && ["sale", "accessory_sale"].includes(invoice.type)) {
            const check = validateStockForSale(invoice, prev.products);
            if (!check.valid) return prev;
          }
          const newInvoices = existing
            ? prev.invoices.map(i => i.id === invoice.id ? invoice : i)
            : [...prev.invoices, invoice];
          let newProducts = prev.products;
          if (invoice.status === "closed" && oldStatus !== "closed") {
            newProducts = applyStockChange(prev.products, invoice, "apply");
            if (oldStatus === "pending") newProducts = reserveStockForPending(newProducts, invoice, "release");
          } else if (["cancelled", "open"].includes(invoice.status ?? "") && oldStatus === "closed") {
            newProducts = applyStockChange(prev.products, invoice, "reverse");
          } else if (invoice.status === "pending" && !existing) {
            newProducts = reserveStockForPending(prev.products, invoice, "reserve");
          } else if (invoice.status === "cancelled" && oldStatus === "pending") {
            newProducts = reserveStockForPending(prev.products, invoice, "release");
          }
          let newCustomers = prev.customers ?? [];
          let newSuppliers = prev.suppliers ?? [];
          const justClosed = invoice.status === "closed" && oldStatus !== "closed";
          const justPending = invoice.status === "pending" && !existing;
          if (justClosed || justPending) {
            if (["sale", "return_sale", "maintenance", "accessory_sale"].includes(invoice.type) && invoice.customerName?.trim()) {
              const name = invoice.customerName.trim().toLowerCase();
              const phone = invoice.customerPhone?.trim();
              const idx = newCustomers.findIndex(c =>
                c.name.trim().toLowerCase() === name || (phone && c.phone?.trim() === phone)
              );
              if (idx >= 0) {
                newCustomers = newCustomers.map((c, i) =>
                  i === idx ? { ...c, phone: phone || c.phone, balance: (c.balance ?? 0) + (invoice.remaining ?? 0) } : c
                );
              } else {
                newCustomers = [...newCustomers, {
                  id: generateId(), name: invoice.customerName.trim(),
                  phone: phone ?? "", address: "", balance: invoice.remaining ?? 0
                }];
              }
            }
            if (["purchase", "return_purchase", "accessory_purchase"].includes(invoice.type) && invoice.supplierName?.trim()) {
              const name = invoice.supplierName.trim().toLowerCase();
              const phone = invoice.supplierPhone?.trim();
              const idx = newSuppliers.findIndex(s =>
                s.name.trim().toLowerCase() === name || (phone && s.phone?.trim() === phone)
              );
              if (idx >= 0) {
                newSuppliers = newSuppliers.map((s, i) =>
                  i === idx ? { ...s, phone: phone || s.phone, balance: (s.balance ?? 0) + (invoice.remaining ?? 0) } : s
                );
              } else {
                newSuppliers = [...newSuppliers, {
                  id: generateId(), name: invoice.supplierName.trim(),
                  phone: phone ?? "", address: "", balance: invoice.remaining ?? 0
                }];
              }
            }
          }
          let ns: AppState = { ...prev, invoices: newInvoices, products: newProducts, customers: newCustomers, suppliers: newSuppliers };
          if (justClosed && (invoice.paid ?? 0) > 0) {
            const tmap: Record<string, any> = {
              sale: { type: "sale", direction: "in", description: `مبيعات - ${invoice.number}` },
              purchase: { type: "purchase", direction: "out", description: `مشتريات - ${invoice.number}` },
              return_sale: { type: "return_sale", direction: "out", description: `مرتجع بيع - ${invoice.number}` },
              return_purchase: { type: "return_purchase", direction: "in", description: `مرتجع شراء - ${invoice.number}` },
              maintenance: { type: "maintenance", direction: "in", description: `صيانة - ${invoice.number}` },
              accessory_sale: { type: "accessory_sale", direction: "in", description: `اكسسوار - ${invoice.number}` },
              accessory_purchase: { type: "accessory_purchase", direction: "out", description: `شراء اكسسوار - ${invoice.number}` },
            };
            const entry = tmap[invoice.type];
            if (entry) ns = addTreasuryEntry(ns, { ...entry, amount: invoice.paid, invoiceId: invoice.id, invoiceNumber: invoice.number });
          }
          return ns;
        } catch (err) { console.error(err); return prev; }
      });
    });
    setEditingInvoice(null); setEditingArchiveId(null);
    showToast("تم الحفظ بنجاح ✅", "success");
    setShowInvoiceForm(false);
    const isPrintable = invoice.status === "closed" &&
      ["sale", "purchase", "return_sale", "return_purchase", "maintenance", "accessory_sale", "accessory_purchase"].includes(invoice.type);
    if (isPrintable && !showPosMode) {
      setTimeout(() => { setLastSavedInvoice(invoice); setShowPrintAfterSave(true); }, 100);
    } else if (!showPosMode) {
      requestAnimationFrame(() => setShowInvoiceForm(true));
    }
  }, [editingArchiveId, showPosMode, updateArchivedInvoiceOnly, showToast]);

  const handlePrintAfterSave = useCallback(() => {
    if (!lastSavedInvoice) return;
    setShowPrintAfterSave(false); setPrintInvoice(lastSavedInvoice); setLastSavedInvoice(null);
    if (!showPosMode) setTimeout(() => setShowInvoiceForm(true), 200);
  }, [lastSavedInvoice, showPosMode]);

  const handleSkipPrint = useCallback(() => {
    setShowPrintAfterSave(false); setLastSavedInvoice(null);
    if (!showPosMode) requestAnimationFrame(() => setShowInvoiceForm(true));
  }, [showPosMode]);

  const handleDeleteInvoice = useCallback((id: string) => {
    if (!isAdminRef.current) { showToast("غير مصرح بالحذف", "error"); return; }
    showConfirm("حذف الفاتورة", "هل أنت متأكد من حذف هذه الفاتورة؟ لا يمكن التراجع عن هذا الإجراء.", () => {
      startTransition(() => {
        setState(prev => {
          const inv = prev.invoices.find(i => i.id === id);
          if (!inv) return prev;
          let newProducts = prev.products;
          if (inv.status === "closed") newProducts = applyStockChange(prev.products, inv, "reverse");
          else if (inv.status === "pending") newProducts = reserveStockForPending(prev.products, inv, "release");
          return { ...prev, invoices: prev.invoices.filter(i => i.id !== id), products: newProducts };
        });
      });
      showToast("تم حذف الفاتورة", "warning");
    }, "danger");
  }, [showToast, showConfirm]);

  const handleSaveMaintenance = useCallback((invoice: Invoice) => {
    if (!invoice) return;
    if (editingArchiveId) {
      updateArchivedInvoiceOnly(invoice, editingArchiveId);
      setShowMaintenanceForm(false); setEditingInvoice(null); setEditingArchiveId(null);
      showToast("تم تعديل الصيانة في الأرشيف", "success"); return;
    }
    setState(prev => {
      try {
        const existing = prev.invoices.find(i => i.id === invoice.id);
        const oldStatus = existing?.status;
        const newInvoices = existing
          ? prev.invoices.map(i => i.id === invoice.id ? invoice : i)
          : [...prev.invoices, invoice];
        let ns: AppState = { ...prev, invoices: newInvoices };
        if (invoice.status === "closed" && oldStatus !== "closed" && (invoice.paid ?? 0) > 0)
          ns = addTreasuryEntry(ns, {
            type: "maintenance", direction: "in",
            description: `صيانة - ${invoice.number}`,
            amount: invoice.paid, invoiceId: invoice.id, invoiceNumber: invoice.number
          });
        return ns;
      } catch { return prev; }
    });
    setShowMaintenanceForm(false); setEditingInvoice(null); setEditingArchiveId(null);
    if (invoice.status === "closed") {
      setTimeout(() => { setLastSavedInvoice(invoice); setShowPrintAfterSave(true); }, 100);
    }
    setPage("maintenance");
    showToast("تم حفظ الصيانة", "success");
  }, [editingArchiveId, updateArchivedInvoiceOnly, showToast]);

  const handleSaveStockMovement = useCallback((movement: StockMovementRecord, updatedProducts: Product[]) => {
    setState(prev => {
      const moves = Array.isArray((prev as any).stockMovements) ? (prev as any).stockMovements : [];
      return { ...prev, products: updatedProducts, stockMovements: [...moves, movement] } as any;
    });
    setShowStockMovement(false);
    showToast("تم تسجيل حركة المخزون", "success");
  }, [showToast]);

  const handleAddInstallment = useCallback((p: Omit<InstallmentPayment, "id" | "date" | "time">) => {
    setState(prev => {
      try { return addInstallmentPayment(prev, { ...p, shiftId: activeShift?.id }); }
      catch { return prev; }
    });
    showToast(`تم استلام ${p.amount?.toLocaleString()} ${currency}`, "success");
  }, [activeShift?.id, showToast, currency]);

  const handleUpdateInvoice = useCallback((inv: Invoice) => {
    setState(prev => ({ ...prev, invoices: prev.invoices.map(i => i.id === inv.id ? inv : i) }));
  }, []);

  const handleUpdateProducts = useCallback((products: Product[]) => {
    setState(prev => ({ ...prev, products }));
  }, []);

  const handleAddProduct = useCallback((product: Product) => {
    setState(prev => ({ ...prev, products: [...prev.products, product] }));
    showToast(`تمت إضافة ${product.name}`, "success");
  }, [showToast]);

  const handleUpdateBundles = useCallback((bundles: Bundle[]) => {
    setState(prev => ({ ...prev, bundles }));
  }, []);

  const handleWithdrawMaintenance = useCallback((amount: number, description: string) => {
    setState(prev => addTreasuryEntry(prev, {
      type: "withdraw", direction: "out",
      description: `سحب صيانة - ${description}`, amount
    }));
  }, []);

  const handleWithdrawInstallments = useCallback((amount: number, description: string) => {
    setState(prev => {
      const n1 = addTreasuryEntry(prev, {
        type: "withdraw", direction: "out",
        description: `سحب أقساط - ${description || "سحب"}`, amount
      });
      return {
        ...n1,
        installmentsLedger: {
          totalReceived: Math.max(0, (prev.installmentsLedger?.totalReceived ?? 0) - amount),
          payments: prev.installmentsLedger?.payments ?? []
        }
      };
    });
  }, []);

  const handleResetMaintenance = useCallback(() => {
    showConfirm("تصفير الصيانة", "هل تريد تصفير جميع فواتير الصيانة المغلقة؟", () => {
      setState(prev => ({
        ...prev,
        invoices: prev.invoices.map(i =>
          i.type === "maintenance" && i.status === "closed" ? { ...i, status: "open" as const } : i
        )
      }));
      showToast("تم تصفير الصيانة", "warning");
    }, "warning");
  }, [showToast, showConfirm]);

  const handleResetInstallments = useCallback(() => {
    showConfirm("تصفير الأقساط", "هل تريد تصفير جميع الأقساط؟", () => {
      setState(prev => ({ ...prev, installmentsLedger: { totalReceived: 0, payments: [] } }));
      showToast("تم تصفير الأقساط", "warning");
    }, "warning");
  }, [showToast, showConfirm]);
    const handleExportArchiveSection = useCallback((archive: any, section?: string) => {
    if (!archive) return;
    try {
      let title = ""; let headers: string[] = []; let rows: (string | number)[][] = [];
      const archDate = archive.date ?? archive.closedAt ?? "";
      const archInvoices: Invoice[] = Array.isArray(archive.invoices) ? archive.invoices : [];
      const filterByType = (types: string[]) => archInvoices.filter(inv => types.includes(inv.type));
      const invoiceHeaders = ["رقم الفاتورة", "التاريخ", "العميل/المورد", "الهاتف", "الإجمالي", "المدفوع", "المتبقي", "الحالة", "الأصناف"];
      const invoiceToRow = (inv: Invoice): (string | number)[] => [
        inv.number ?? "", inv.date ?? "", inv.customerName || inv.supplierName || "-",
        inv.customerPhone || inv.supplierPhone || "-",
        inv.total ?? 0, inv.paid ?? 0, inv.remaining ?? 0,
        inv.status === "closed" ? "مغلقة" : inv.status === "pending" ? "معلقة" : inv.status ?? "",
        inv.items?.map(it => `${it.productName || ""} x${it.quantity || 0}`).join(" | ") ?? ""
      ];
      const maintenanceHeaders = ["رقم الفاتورة", "التاريخ", "العميل", "الهاتف", "الجهاز", "IMEI", "العطل", "التكلفة", "المدفوع", "الحالة"];
      const maintenanceToRow = (inv: Invoice): (string | number)[] => [
        inv.number ?? "", inv.date ?? "", inv.customerName ?? "-", inv.customerPhone ?? "-",
        `${inv.maintenanceInfo?.deviceBrand ?? ""} ${inv.maintenanceInfo?.deviceModel ?? ""}`.trim() || "-",
        inv.maintenanceInfo?.imei ?? "-", inv.maintenanceInfo?.issue ?? "-",
        inv.total ?? 0, inv.paid ?? 0,
        inv.maintenanceInfo?.maintenanceStatus === "ready" ? "جاهز" : "قيد العمل"
      ];
      const installmentHeaders = ["اسم العميل", "الهاتف", "المبلغ", "التاريخ", "الوقت", "رقم الفاتورة", "ملاحظات"];
      const installmentToRow = (p: any): (string | number)[] => [
        p.customerName ?? "-", p.customerPhone ?? "-", p.amount ?? 0,
        p.date ?? "", p.time ?? "", p.invoiceRef ?? "-", p.notes ?? ""
      ];
      switch (section) {
        case "sales": title = `مبيعات - وردية ${archDate}`; headers = invoiceHeaders; rows = filterByType(["sale"]).map(invoiceToRow); break;
        case "purchases": title = `مشتريات - وردية ${archDate}`; headers = invoiceHeaders; rows = filterByType(["purchase"]).map(invoiceToRow); break;
        case "maintenance": title = `صيانة - وردية ${archDate}`; headers = maintenanceHeaders; rows = filterByType(["maintenance"]).map(maintenanceToRow); break;
        case "accessory": title = `اكسسوارات - وردية ${archDate}`; headers = invoiceHeaders; rows = filterByType(["accessory_sale", "accessory_purchase"]).map(invoiceToRow); break;
        case "installments": {
          title = `أقساط - وردية ${archDate}`; headers = installmentHeaders;
          const archInst = Array.isArray(archive.installments) ? archive.installments : [];
          rows = archInst.map(installmentToRow); break;
        }
        default: {
          title = `أرشيف وردية ${archDate} - كامل`; headers = ["النوع", ...invoiceHeaders];
          const tl: Record<string, string> = {
            sale: "مبيعات", purchase: "مشتريات", return_sale: "مرتجع بيع",
            return_purchase: "مرتجع شراء", maintenance: "صيانة",
            accessory_sale: "اكسسوار بيع", accessory_purchase: "اكسسوار شراء"
          };
          rows = archInvoices.map(inv => [tl[inv.type] ?? inv.type, ...invoiceToRow(inv)]);
        }
      }
      if (rows.length === 0) { showToast("لا توجد بيانات للتصدير", "warning"); return; }
      const csv = [headers, ...rows]
        .map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
        .join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/[/\\?%*:|"<>]/g, "-")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`✅ تم تصدير ${title} (${rows.length} سجل)`, "success");
    } catch (err) { console.error(err); showToast("فشل التصدير", "error"); }
  }, [showToast]);

  const nav = useCallback((p: Page) => { setPage(p); setSidebarOpen(false); }, []);

  const handleEditArchiveInvoice = useCallback((inv: Invoice) => {
    if (!inv) return;
    const archiveId = (inv as any).archivedShiftId ?? null;
    setEditingArchiveId(archiveId); setEditingInvoice(inv);
    if (inv.type === "maintenance") setShowMaintenanceForm(true);
    else { setNewInvoiceType(inv.type as InvoiceType); setShowInvoiceForm(true); }
  }, []);

  const updateState = useCallback((ns: AppState) => {
    if (!ns || typeof ns !== "object") return;
    setState(ns);
  }, []);

  const navGroups = useMemo(() => [
    {
      title: "الرئيسية", items: [
        { id: "dashboard" as Page, label: "لوحة التحكم", icon: LayoutDashboard, color: "text-blue-600" },
        { id: "daily_report" as Page, label: "التقرير اليومي", icon: CalendarDays, color: "text-sky-600" },
        { id: "customers" as Page, label: "العملاء والموردين", icon: Users, color: "text-blue-700" },
      ]
    },
    {
      title: "الفواتير", items: [
        { id: "sales" as Page, label: "المبيعات", icon: ShoppingCart, color: "text-blue-600" },
        { id: "purchases" as Page, label: "المشتريات", icon: Package, color: "text-green-600" },
        { id: "return_sale" as Page, label: "مرتجع مبيعات", icon: RotateCcw, color: "text-orange-600" },
        { id: "return_purchase" as Page, label: "مرتجع مشتريات", icon: RotateCcw, color: "text-purple-600" },
        { id: "pending" as Page, label: "المعلقة", icon: Clock, color: "text-amber-600" },
        { id: "registry" as Page, label: "السجل الشامل", icon: BookOpen, color: "text-purple-600" },
        { id: "invoice_archive" as Page, label: "الأرشيف", icon: FolderOpen, color: "text-teal-600" },
      ]
    },
    {
      title: "الخدمات", items: [
        { id: "maintenance" as Page, label: "الصيانة", icon: Wrench, color: "text-violet-600" },
        { id: "installments" as Page, label: "الأقساط", icon: DollarSign, color: "text-indigo-600" },
        { id: "accessory_sales" as Page, label: "فواتير الاكسسوار", icon: ShoppingBag, color: "text-amber-600" },
      ]
    },
    {
      title: "المخزون والإدارة", items: [
        { id: "products" as Page, label: "المنتجات", icon: FileText, color: "text-indigo-600" },
        { id: "stock_movements" as Page, label: "حركات المخزون", icon: TrendingUp, color: "text-emerald-600" },
        { id: "bundles" as Page, label: "الباكدج", icon: Gift, color: "text-amber-600" },
        { id: "barcode" as Page, label: "الباركود", icon: Barcode, color: "text-indigo-500" },
        ...(isAdmin ? [
          { id: "treasury" as Page, label: "الخزنة", icon: Wallet, color: "text-emerald-600" },
          { id: "users" as Page, label: "الموظفين", icon: ShieldCheck, color: "text-red-600" },
          { id: "archives" as Page, label: "أرشيف الورديات", icon: Archive, color: "text-pink-600" },
          { id: "settings" as Page, label: "الإعدادات", icon: SettingsIcon, color: "text-gray-600" },
        ] : [])
      ]
    },
  ], [isAdmin]);

  const pageTitle = useMemo<Record<Page, string>>(() => ({
    dashboard: "لوحة التحكم", daily_report: "التقرير اليومي", customers: "العملاء والموردين",
    sales: "المبيعات", purchases: "المشتريات", return_sale: "مرتجع المبيعات",
    return_purchase: "مرتجع المشتريات", maintenance: "الصيانة", installments: "الأقساط",
    pending: "الفواتير المعلقة", registry: "السجل الشامل", products: "المنتجات",
    bundles: "الباكدج", barcode: "الباركود", treasury: "الخزنة",
    archives: "أرشيف الورديات", settings: "الإعدادات", users: "الموظفين",
    invoice_archive: "أرشيف الفواتير", accessory_sales: "فواتير الاكسسوار",
    stock_movements: "حركات المخزون",
  }), []);

  const badges = useMemo<Partial<Record<Page, number>>>(() => ({
    pending: pendingInvoices.length || undefined,
    maintenance: maintenanceReadyCount || undefined,
    archives: safeArchives.length || undefined,
    accessory_sales: safeInvoices.filter(i => i.type === "accessory_sale").length || undefined,
  }), [pendingInvoices.length, maintenanceReadyCount, safeArchives.length, safeInvoices]);

  if (!currentUser) {
    return (
      <ErrorBoundary>
        <Login
          onLogin={user => { setCurrentUser(user); showToast(`مرحباً ${user.name}`, "success"); }}
          allUsers={Array.isArray((state as any)?.users) ? (state as any).users : []}
        />
      </ErrorBoundary>
    );
  }
    return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 flex" dir="rtl">
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* SIDEBAR */}
        <aside className={`fixed top-0 right-0 h-full w-64 bg-white border-l border-gray-100 z-40 flex flex-col transition-transform duration-300 shadow-xl lg:translate-x-0 lg:static lg:shadow-none ${sidebarOpen ? "translate-x-0" : "translate-x-full"}`}>
          <div className="p-4 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl">📱</div>
                <div className="min-w-0">
                  <div className="font-black text-white text-sm truncate">{state.settings?.shopName || "مدير المبيعات"}</div>
                  <div className="text-blue-200 text-xs truncate mt-0.5">{state.settings?.shopPhone || "نظام إدارة متكامل"}</div>
                </div>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10">
                <X size={18} />
              </button>
            </div>
            {SUPABASE_ENABLED && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {isOnline
                      ? <Wifi size={11} className="text-emerald-400" />
                      : <WifiOff size={11} className="text-red-400" />}
                    <span className="text-[10px] text-blue-200">{isOnline ? "متصل" : "غير متصل"}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {connectedDevices.filter(d => d.isOnline).length > 0 && (
                      <span className="text-[10px] text-blue-200">
                        {connectedDevices.filter(d => d.isOnline).length} جهاز
                      </span>
                    )}
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      syncStatus === "syncing" ? "bg-amber-400 animate-pulse" :
                      syncStatus === "saved" ? "bg-emerald-400" :
                      syncStatus === "offline" ? "bg-gray-400" :
                      syncStatus === "error" ? "bg-red-400" : "bg-blue-400"
                    }`} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex-shrink-0 border-b border-gray-100">
            {hasActiveShift ? (
              <div className="p-3 bg-gradient-to-b from-emerald-50 to-white space-y-2">
                <div className="flex items-center gap-2 pb-1.5 border-b border-emerald-100">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-xs font-black text-emerald-700">وردية نشطة</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <BalanceCard label="مبيعات" value={cs.totalSales ?? 0} currency={currency} color="bg-blue-50 text-blue-800" icon={TrendingUp} count={cs.salesCount} />
                  <BalanceCard label="مشتريات" value={cs.totalPurchases ?? 0} currency={currency} color="bg-green-50 text-green-800" icon={TrendingDown} count={cs.purchasesCount} />
                  <BalanceCard label="صيانة" value={cs.totalMaintenance ?? 0} currency={currency} color="bg-violet-50 text-violet-800" icon={Wrench} count={cs.maintenanceCount} />
                  <BalanceCard label="أقساط" value={cs.totalInstallments ?? 0} currency={currency} color="bg-indigo-50 text-indigo-800" icon={DollarSign} />
                  <BalanceCard label="اكسسوار" value={cs.totalAccessorySales ?? 0} currency={currency} color="bg-amber-50 text-amber-800" icon={ShoppingBag} count={cs.accessorySalesCount} />
                </div>
                <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-emerald-100">
                  <div className={`rounded-xl px-3 py-2 text-center ${netSales >= 0 ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-900"}`}>
                    <div className="text-xs opacity-70 font-medium">صافي</div>
                    <div className="text-sm font-black">{netSales.toLocaleString()}</div>
                  </div>
                  <div className={`rounded-xl px-3 py-2 text-center border ${totalOverall >= 0 ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-red-50 border-red-200 text-red-900"}`}>
                    <div className="text-xs opacity-70 font-medium">إجمالي</div>
                    <div className="text-sm font-black">{totalOverall.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-gray-50 text-center">
                <p className="text-xs text-gray-500 mb-2">لا توجد وردية نشطة</p>
                <button onClick={handleOpenShift} className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all">
                  فتح وردية جديدة
                </button>
              </div>
            )}
          </div>

          <div className="flex-shrink-0 p-3 border-b border-gray-100 bg-gray-50/50">
            <button onClick={() => { setShowPosMode(true); setSidebarOpen(false); }} className="w-full flex items-center justify-center gap-2 py-3 mb-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-black hover:opacity-90 active:scale-95 shadow-md shadow-amber-200 transition-all">
              <Zap size={16} /> نقطة البيع السريع (F9)
            </button>
            <div className="grid grid-cols-2 gap-1.5 mb-1.5">
              <button onClick={() => { openForm("sale"); setSidebarOpen(false); }} className="flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 active:scale-95 transition-all">
                <ShoppingCart size={13} /> بيع (F1)
              </button>
              <button onClick={() => { openForm("purchase"); setSidebarOpen(false); }} className="flex items-center justify-center gap-1.5 py-2.5 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700 active:scale-95 transition-all">
                <Package size={13} /> شراء (F2)
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1 mb-1.5">
              {[
                { label: "صيانة", icon: Wrench, cls: "bg-violet-50 text-violet-700 hover:bg-violet-100", action: () => { openMaintenanceForm(); setSidebarOpen(false); } },
                { label: "مرتجع", icon: RotateCcw, cls: "bg-orange-50 text-orange-700 hover:bg-orange-100", action: () => { openForm("return_sale"); setSidebarOpen(false); } },
                { label: "قسط", icon: DollarSign, cls: "bg-indigo-50 text-indigo-700 hover:bg-indigo-100", action: () => { setShowInstallmentModal(true); setSidebarOpen(false); } },
                { label: "اكسسوار", icon: ShoppingBag, cls: "bg-amber-50 text-amber-700 hover:bg-amber-100", action: () => { openForm("accessory_sale"); setSidebarOpen(false); } },
              ].map(({ label, icon: Icon, cls, action }) => (
                <button key={label} onClick={action} className={`flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] font-bold ${cls} transition-colors active:scale-95`}>
                  <Icon size={12} /><span>{label}</span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-1 mb-1.5">
              <button onClick={() => { setStockMovementType("in"); setShowStockMovement(true); setSidebarOpen(false); }} className="flex items-center justify-center gap-1.5 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-[10px] font-bold transition-colors">
                <TrendingUp size={12} /> توريد
              </button>
              <button onClick={() => { setStockMovementType("out"); setShowStockMovement(true); setSidebarOpen(false); }} className="flex items-center justify-center gap-1.5 py-2 bg-orange-50 text-orange-700 hover:bg-orange-100 rounded-lg text-[10px] font-bold transition-colors">
                <TrendingDown size={12} /> صرف
              </button>
            </div>
            <button onClick={() => { setShowExportCenter(true); setSidebarOpen(false); }} className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl text-xs font-black hover:opacity-90 active:scale-95 shadow-md transition-all">
              <Download size={13} /> مركز التصدير الشامل
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto p-3 space-y-4">
            {navGroups.map(group => (
              <div key={group.title}>
                <div className="text-[10px] font-black text-gray-300 uppercase tracking-widest px-2 mb-1.5">{group.title}</div>
                <div className="space-y-0.5">
                  {group.items.map(item => (
                    <button key={item.id} onClick={() => nav(item.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${page === item.id ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"}`}>
                      <item.icon size={16} className={page === item.id ? "text-white" : item.color} />
                      <span className="flex-1 text-right">{item.label}</span>
                      {badges[item.id] !== undefined && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${page === item.id ? "bg-white/25 text-white" : "bg-red-500 text-white"}`}>
                          {badges[item.id]}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="flex-shrink-0 p-3 border-t border-gray-100 bg-gray-50">
            <div className="flex items-center gap-3 p-2.5 bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm text-white ${isAdmin ? "bg-purple-600" : "bg-blue-600"}`}>
                {currentUser.name?.[0]?.toUpperCase() || "U"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-black text-gray-800 truncate">{currentUser.name}</div>
                <div className={`text-xs font-bold ${isAdmin ? "text-purple-500" : "text-blue-500"}`}>
                  {isAdmin ? "🔑 مدير النظام" : "👤 موظف"}
                </div>
              </div>
              <button
                onClick={() => { showConfirm("تسجيل الخروج", "هل تريد تسجيل الخروج؟", () => setCurrentUser(null), "warning"); }}
                className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                title="خروج"
              >
                <LogOut size={15} />
              </button>
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <div className="flex-1 flex flex-col min-w-0 min-h-screen">
          <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-20 shadow-sm flex-shrink-0 gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
              <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl hover:bg-gray-100 lg:hidden transition-colors"><Menu size={20} /></button>
              <h1 className="font-black text-gray-900 text-base truncate hidden sm:block">{pageTitle[page]}</h1>
            </div>
            <div className="flex-1 flex justify-center max-w-lg mx-3">
              <GlobalSearchBar invoices={safeInvoices} products={safeProducts} installments={safeInstallments.payments} currency={currency} onNavigate={nav} onEditInvoice={handleEditArchiveInvoice} archives={safeArchives} />
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <SyncIndicator syncStatus={syncStatus} lastSyncTime={lastSyncTime} isOnline={isOnline} onManualSync={manualSync} pendingSync={pendingSync} connectedDevices={connectedDevices} deviceId={deviceId} />
              <div className="hidden sm:block w-px h-5 bg-gray-200" />
              <button onClick={() => setShowPosMode(true)} className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-white rounded-xl text-xs font-black hover:bg-amber-600 active:scale-95 shadow-md shadow-amber-200 transition-all"><Zap size={14} /><span className="hidden sm:inline">POS</span></button>
              <div className="hidden sm:block w-px h-5 bg-gray-200" />
              <button onClick={() => openForm("sale")} className="flex items-center gap-1 px-2.5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 active:scale-95 transition-all"><ShoppingCart size={13} /><span className="hidden md:inline">بيع</span></button>
              <button onClick={() => openForm("purchase")} className="flex items-center gap-1 px-2.5 py-2 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700 active:scale-95 transition-all"><Package size={13} /><span className="hidden md:inline">شراء</span></button>
              <button onClick={() => openForm("accessory_sale")} className="flex items-center gap-1 px-2.5 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 active:scale-95 transition-all"><ShoppingBag size={13} /><span className="hidden md:inline">اكسسوار</span></button>
              <button onClick={() => { setStockMovementType("in"); setShowStockMovement(true); }} className="flex items-center gap-1 px-2.5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 active:scale-95 transition-all"><TrendingUp size={13} /><span className="hidden md:inline">توريد</span></button>
              <button onClick={() => { setStockMovementType("out"); setShowStockMovement(true); }} className="flex items-center gap-1 px-2.5 py-2 bg-orange-500 text-white rounded-xl text-xs font-bold hover:bg-orange-600 active:scale-95 transition-all"><TrendingDown size={13} /><span className="hidden md:inline">صرف</span></button>
              <button onClick={() => setShowInstallmentModal(true)} className="flex items-center gap-1 px-2.5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 active:scale-95 transition-all"><DollarSign size={13} /></button>
              <button onClick={openMaintenanceForm} className="flex items-center gap-1 px-2.5 py-2 bg-violet-600 text-white rounded-xl text-xs font-bold hover:bg-violet-700 active:scale-95 transition-all"><Wrench size={13} /></button>
              <button onClick={() => setShowExportCenter(true)} className="flex items-center gap-1 px-2.5 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700 active:scale-95 transition-all"><Download size={13} /><span className="hidden md:inline">تصدير</span></button>
              <div className="hidden sm:block w-px h-5 bg-gray-200" />
              <button onClick={handleOpenShift} disabled={hasActiveShift} className={`px-2.5 py-2 rounded-xl text-xs font-bold transition-all ${hasActiveShift ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95"}`}><RefreshCw size={13} /></button>
              <button onClick={() => { if (hasActiveShift) setShowCloseShiftModal(true); }} disabled={!hasActiveShift} className={`flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-bold transition-all ${hasActiveShift ? "bg-red-600 text-white hover:bg-red-700 active:scale-95" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}><X size={13} /><span className="hidden sm:inline">تقفيل</span></button>
            </div>
          </header>

          {editingArchiveId && (showInvoiceForm || showMaintenanceForm) && (
            <div className="bg-amber-50 border-b-2 border-amber-300 px-4 py-2.5 flex items-center gap-3 flex-shrink-0">
              <AlertTriangle size={18} className="text-amber-600 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-black text-amber-800">⚠️ تعديل فاتورة مؤرشفة</div>
                <div className="text-xs text-amber-600 mt-0.5">التعديل يُحفظ في الأرشيف فقط</div>
              </div>
              <button onClick={() => { setShowInvoiceForm(false); setShowMaintenanceForm(false); setEditingInvoice(null); setEditingArchiveId(null); }} className="px-3 py-1.5 bg-amber-200 text-amber-800 rounded-lg text-xs font-bold hover:bg-amber-300 transition-colors">إلغاء</button>
            </div>
          )}

          {hasActiveShift && !editingArchiveId && (
            <div className="bg-white border-b border-gray-100 px-4 py-2 flex-shrink-0 overflow-x-auto">
              <div className="flex items-center gap-2 min-w-max">
                <span className="text-xs text-gray-400 font-bold flex-shrink-0">المدفوع:</span>
                <ShiftBalanceItem icon={TrendingUp} label="مبيعات" count={cs.salesCount} value={cs.totalSales ?? 0} currency={currency} bg="bg-blue-50" border="border-blue-100" iconColor="text-blue-500" labelColor="text-blue-400" valueColor="text-blue-700" />
                <ShiftBalanceItem icon={TrendingDown} label="مشتريات" count={cs.purchasesCount} value={cs.totalPurchases ?? 0} currency={currency} bg="bg-green-50" border="border-green-100" iconColor="text-green-500" labelColor="text-green-400" valueColor="text-green-700" />
                <ShiftBalanceItem icon={Wrench} label="صيانة" count={cs.maintenanceCount} value={cs.totalMaintenance ?? 0} currency={currency} bg="bg-violet-50" border="border-violet-100" iconColor="text-violet-500" labelColor="text-violet-400" valueColor="text-violet-700" />
                <ShiftBalanceItem icon={DollarSign} label="أقساط" count={safeInstallments.payments.length} value={cs.totalInstallments ?? 0} currency={currency} bg="bg-indigo-50" border="border-indigo-100" iconColor="text-indigo-500" labelColor="text-indigo-400" valueColor="text-indigo-700" />
                <ShiftBalanceItem icon={ShoppingBag} label="اكسسوار" count={cs.accessorySalesCount} value={cs.totalAccessorySales ?? 0} currency={currency} bg="bg-amber-50" border="border-amber-100" iconColor="text-amber-500" labelColor="text-amber-400" valueColor="text-amber-700" />
                <div className="w-px h-10 bg-gray-200 flex-shrink-0 mx-1" />
                <div className={`rounded-xl px-3 py-2 flex-shrink-0 ${netSales >= 0 ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}>
                  <div className="text-xs opacity-75 font-medium">صافي</div>
                  <div className="text-sm font-black">{netSales.toLocaleString()} {currency}</div>
                </div>
                <div className={`rounded-xl px-3 py-2 flex-shrink-0 border ${totalOverall >= 0 ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-red-50 border-red-300 text-red-800"}`}>
                  <div className="text-xs opacity-70 font-medium">إجمالي</div>
                  <div className="text-sm font-black">{totalOverall.toLocaleString()} {currency}</div>
                </div>
              </div>
            </div>
          )}

          <main className="flex-1 p-4 lg:p-6 overflow-auto bg-slate-50">
            <ErrorBoundary key={page}>
              {page === "dashboard" && <Dashboard invoices={safeInvoices} products={safeProducts} currency={currency} onNewSale={() => openForm("sale")} onNewPurchase={() => openForm("purchase")} installments={safeInstallments.payments} treasuryBalance={state.treasury?.balance ?? 0} />}
              {page === "daily_report" && <DailyReport state={state} currency={currency} />}
              {page === "customers" && <CustomersLedger state={state} currency={currency} onEditInvoice={handleEditArchiveInvoice} />}
              {(page === "sales" || page === "purchases" || page === "return_sale" || page === "return_purchase" || page === "pending" || page === "registry" || page === "accessory_sales") && (
                <InvoiceRegistry invoices={safeInvoices} products={safeProducts} customers={safeCustomers} suppliers={safeSuppliers} settings={state.settings} onUpdate={handleUpdateInvoice} onDelete={handleDeleteInvoice} filterType={page === "sales" ? "sale" : page === "purchases" ? "purchase" : page === "return_sale" ? "return_sale" : page === "return_purchase" ? "return_purchase" : page === "pending" ? "pending" : page === "accessory_sales" ? "accessory_sale" : "all"} />
              )}
              {page === "invoice_archive" && <InvoiceArchive invoices={safeInvoices} archives={safeArchives} currency={currency} onViewInvoice={handleEditArchiveInvoice} onEditInvoice={handleEditArchiveInvoice} />}
              {page === "maintenance" && <MaintenanceRegistry invoices={safeInvoices} currency={currency} onView={inv => { setEditingInvoice(inv); setShowMaintenanceForm(true); }} onDelete={handleDeleteInvoice} onWithdraw={handleWithdrawMaintenance} onReset={handleResetMaintenance} />}
              {page === "installments" && <InstallmentsPage ledger={safeInstallments} currency={currency} shiftId={activeShift?.id} onAdd={handleAddInstallment} onWithdraw={handleWithdrawInstallments} onReset={handleResetInstallments} />}
              {page === "products" && <Products products={safeProducts} currency={currency} onUpdate={handleUpdateProducts} invoices={safeInvoices} />}
              {page === "bundles" && <BundleManager bundles={safeBundles} products={safeProducts} currency={currency} onUpdate={handleUpdateBundles} />}
              {page === "barcode" && <BarcodeManager products={safeProducts} onUpdate={handleUpdateProducts} />}
              {page === "stock_movements" && <StockMovementsLog movements={safeStockMovements} currency={currency} onNew={type => { setStockMovementType(type); setShowStockMovement(true); }} />}
              {page === "treasury" && isAdmin && <TreasuryPage treasury={{ balance: state.treasury?.balance ?? 0, entries: Array.isArray(state.treasury?.entries) ? state.treasury.entries : [] }} currency={currency} onUpdate={(t: any) => setState(prev => ({ ...prev, treasury: t }))} />}
              {page === "archives" && isAdmin && <ShiftArchives archives={safeArchives} currency={currency} onEditInvoice={handleEditArchiveInvoice} onExportArchive={handleExportArchiveSection} />}
              {page === "settings" && isAdmin && <Settings state={state} onUpdate={updateState} />}
              {page === "users" && isAdmin && <UserManager state={state} onUpdate={(ns: any) => { setState(ns); saveState(ns); }} />}
              {(page === "treasury" || page === "archives" || page === "settings" || page === "users") && !isAdmin && (
                <div className="flex items-center justify-center h-full min-h-[400px]">
                  <div className="text-center">
                    <div className="text-6xl mb-4">🔒</div>
                    <h2 className="text-xl font-black text-gray-700 mb-2">غير مصرح بالوصول</h2>
                    <p className="text-gray-500">هذه الصفحة للمدير فقط</p>
                    <button onClick={() => setPage("dashboard")} className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700">الرئيسية</button>
                  </div>
                </div>
              )}
            </ErrorBoundary>
          </main>
        </div>

        {/* MODALS */}
        {showCloseShiftModal && <CloseShiftModal summary={cs} pendingInvoices={pendingInvoices} remainingInvoices={safeInvoices.filter(i => (i.remaining ?? 0) > 0)} currency={currency} openingBalance={state.treasury?.balance ?? 0} autoStartShift={state.settings?.autoStartShift ?? true} defaultResetSettings={(state as any).settings?.shiftResetSettings} onConfirm={confirmCloseShift as any} onCancel={() => setShowCloseShiftModal(false)} />}
        {showInvoiceForm && <InvoiceForm type={newInvoiceType} existingInvoice={editingInvoice} invoices={safeInvoices} products={safeProducts} customers={safeCustomers} suppliers={safeSuppliers} settings={state.settings} bundles={safeBundles} onSave={handleSaveInvoice} onClose={() => { setShowInvoiceForm(false); setEditingInvoice(null); setEditingArchiveId(null); }} onAddProduct={handleAddProduct} />}
        {showMaintenanceForm && <MaintenanceForm existingInvoice={editingInvoice} invoices={safeInvoices} settings={state.settings} onSave={handleSaveMaintenance} onClose={() => { setShowMaintenanceForm(false); setEditingInvoice(null); setEditingArchiveId(null); }} />}
        {showStockMovement && <StockMovement products={safeProducts} currency={currency} movements={safeStockMovements} onSave={handleSaveStockMovement} onClose={() => setShowStockMovement(false)} defaultType={stockMovementType} />}
        {showExportCenter && <ExportCenter state={state} currency={currency} onClose={() => setShowExportCenter(false)} />}

        {showInstallmentModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" dir="rtl">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-5 py-4 text-white flex items-center justify-between">
                <h3 className="font-black flex items-center gap-2 text-base"><DollarSign size={18} /> استلام قسط</h3>
                <button onClick={() => { setShowInstallmentModal(false); setQuickInstallment({ customerName: "", customerPhone: "", amount: 0, invoiceRef: "", notes: "" }); }} className="text-white/70 hover:text-white"><X size={18} /></button>
              </div>
              <div className="p-5 space-y-3">
                <input type="text" value={quickInstallment.customerName} onChange={e => setQuickInstallment(p => ({ ...p, customerName: e.target.value }))} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 font-semibold transition-colors" placeholder="اسم العميل *" autoFocus />
                <input type="tel" value={quickInstallment.customerPhone} onChange={e => setQuickInstallment(p => ({ ...p, customerPhone: e.target.value }))} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 transition-colors" placeholder="رقم الهاتف" />
                <input type="number" min="1" value={quickInstallment.amount || ""} onChange={e => setQuickInstallment(p => ({ ...p, amount: Number(e.target.value) }))} className="w-full border-2 border-indigo-300 rounded-xl px-4 py-4 text-2xl font-black text-center outline-none focus:border-indigo-500 transition-colors" placeholder="المبلغ *" />
                <div className="flex gap-2">
                  <input type="text" value={quickInstallment.invoiceRef} onChange={e => setQuickInstallment(p => ({ ...p, invoiceRef: e.target.value }))} className="w-1/2 border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-300 transition-colors" placeholder="رقم الفاتورة" />
                  <input type="text" value={quickInstallment.notes} onChange={e => setQuickInstallment(p => ({ ...p, notes: e.target.value }))} className="w-1/2 border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-300 transition-colors" placeholder="ملاحظة" />
                </div>
              </div>
              <div className="flex gap-3 px-5 pb-5">
                <button
                  onClick={() => {
                    if (!quickInstallment.customerName.trim() || !quickInstallment.amount) return;
                    handleAddInstallment({ customerName: quickInstallment.customerName, customerPhone: quickInstallment.customerPhone, amount: quickInstallment.amount, invoiceRef: quickInstallment.invoiceRef, notes: quickInstallment.notes, shiftId: activeShift?.id });
                    setQuickInstallment({ customerName: "", customerPhone: "", amount: 0, invoiceRef: "", notes: "" });
                    setShowInstallmentModal(false);
                  }}
                  disabled={!quickInstallment.customerName.trim() || !quickInstallment.amount}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black text-base hover:bg-indigo-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-all"
                >
                  تأكيد الاستلام
                </button>
                <button onClick={() => { setShowInstallmentModal(false); setQuickInstallment({ customerName: "", customerPhone: "", amount: 0, invoiceRef: "", notes: "" }); }} className="px-5 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors">إلغاء</button>
              </div>
            </div>
          </div>
        )}

        {showPosMode && <PosMode products={safeProducts} currency={currency} settings={state.settings} onCompleteSale={handleSaveInvoice} onClose={() => setShowPosMode(false)} />}
        {showPrintAfterSave && lastSavedInvoice && <PrintAfterSaveModal invoice={lastSavedInvoice} currency={currency} onPrint={handlePrintAfterSave} onSkip={handleSkipPrint} />}
        {printInvoice && <PrintInvoice invoice={printInvoice} shopSettings={state.settings} onClose={() => setPrintInvoice(null)} />}
        <ConfirmDialog state={confirmDialog} onCancel={hideConfirm} />
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </div>
    </ErrorBoundary>
  );
}