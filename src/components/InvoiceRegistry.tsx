import { useState, useMemo, useEffect, Fragment } from "react";
import { Invoice, InvoiceType, InvoiceStatus, Product, Customer, Supplier } from "../types";
import { exportInvoicesToExcel, exportSingleInvoiceToExcel } from "../utils/export";
import { QuickPrintButton } from "./PrintInvoice";
import { Printer } from "lucide-react";

import {
  Edit2,
  Download,
  FileText,
  Trash2,
  Search,
  Filter,
  ChevronDown,
  Eye,
  X,
  AlertTriangle,
  CheckCircle,
  DollarSign,
} from "lucide-react";
import InvoiceForm from "./InvoiceForm";

interface Props {
  invoices: Invoice[];
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  settings: {
    shopName: string;
    shopPhone?: string;
    shopAddress?: string;
    currency: string;
    taxRate: number;
    invoicePrefix?: string;
  };
  onUpdate: (invoice: Invoice) => void;
  onDelete: (id: string) => void;
  filterType?: InvoiceType | "all" | "pending";
}

const TYPE_CONFIG: Record<
  string,
  {
    label: string;
    icon: string;
    gradient: string;
    cardBg: string;
    cardBorder: string;
    cardText: string;
    badgeBg: string;
  }
> = {
  sale: {
    label: "فواتير المبيعات",
    icon: "🛒",
    gradient: "from-blue-600 to-blue-700",
    cardBg: "bg-blue-50",
    cardBorder: "border-blue-100",
    cardText: "text-blue-700",
    badgeBg: "bg-blue-100 text-blue-700",
  },
  purchase: {
    label: "فواتير المشتريات",
    icon: "📦",
    gradient: "from-green-600 to-green-700",
    cardBg: "bg-green-50",
    cardBorder: "border-green-100",
    cardText: "text-green-700",
    badgeBg: "bg-green-100 text-green-700",
  },
  return_sale: {
    label: "مرتجع المبيعات",
    icon: "↩️",
    gradient: "from-orange-500 to-orange-600",
    cardBg: "bg-orange-50",
    cardBorder: "border-orange-100",
    cardText: "text-orange-700",
    badgeBg: "bg-orange-100 text-orange-700",
  },
  return_purchase: {
    label: "مرتجع المشتريات",
    icon: "↪️",
    gradient: "from-purple-600 to-purple-700",
    cardBg: "bg-purple-50",
    cardBorder: "border-purple-100",
    cardText: "text-purple-700",
    badgeBg: "bg-purple-100 text-purple-700",
  },
  maintenance: {
    label: "فواتير الصيانة",
    icon: "🔧",
    gradient: "from-violet-600 to-violet-700",
    cardBg: "bg-violet-50",
    cardBorder: "border-violet-100",
    cardText: "text-violet-700",
    badgeBg: "bg-violet-100 text-violet-700",
  },
  accessory_sale: {
    label: "بيع الاكسسوارات",
    icon: "🛍️",
    gradient: "from-amber-500 to-amber-600",
    cardBg: "bg-amber-50",
    cardBorder: "border-amber-100",
    cardText: "text-amber-700",
    badgeBg: "bg-amber-100 text-amber-700",
  },
  accessory_purchase: {
    label: "شراء الاكسسوارات",
    icon: "🛍️",
    gradient: "from-teal-600 to-teal-700",
    cardBg: "bg-teal-50",
    cardBorder: "border-teal-100",
    cardText: "text-teal-700",
    badgeBg: "bg-teal-100 text-teal-700",
  },
  pending: {
    label: "الفواتير المعلقة",
    icon: "⏳",
    gradient: "from-amber-500 to-amber-600",
    cardBg: "bg-amber-50",
    cardBorder: "border-amber-100",
    cardText: "text-amber-700",
    badgeBg: "bg-amber-100 text-amber-700",
  },
  all: {
    label: "سجل الفواتير",
    icon: "📋",
    gradient: "from-gray-600 to-gray-700",
    cardBg: "bg-gray-50",
    cardBorder: "border-gray-100",
    cardText: "text-gray-700",
    badgeBg: "bg-gray-100 text-gray-700",
  },
};

const TYPE_LABEL: Record<string, string> = {
  sale: "مبيعات",
  purchase: "مشتريات",
  return_sale: "مرتجع مبيعات",
  return_purchase: "مرتجع مشتريات",
  maintenance: "صيانة",
  accessory_sale: "بيع اكسسوار",
  accessory_purchase: "شراء اكسسوار",
};

const TYPE_BADGE: Record<string, string> = {
  sale: "bg-blue-100 text-blue-700",
  purchase: "bg-green-100 text-green-700",
  return_sale: "bg-orange-100 text-orange-700",
  return_purchase: "bg-purple-100 text-purple-700",
  maintenance: "bg-violet-100 text-violet-700",
  accessory_sale: "bg-amber-100 text-amber-700",
  accessory_purchase: "bg-teal-100 text-teal-700",
};

const toNumber = (val: any): number => Number(val ?? 0) || 0;
const fmt = (val: any): string => toNumber(val).toLocaleString();

const statusLabel = (s: string) =>
  s === "open"
    ? "مفتوحة"
    : s === "closed"
    ? "مغلقة"
    : s === "pending"
    ? "معلقة"
    : s === "cancelled"
    ? "ملغية"
    : s;

const statusColor = (s: string) =>
  s === "open"
    ? "bg-yellow-100 text-yellow-700"
    : s === "closed"
    ? "bg-emerald-100 text-emerald-700"
    : s === "pending"
    ? "bg-orange-100 text-orange-700"
    : s === "cancelled"
    ? "bg-red-100 text-red-700"
    : "bg-gray-100 text-gray-600";

// ============================
// InvoiceDetailModal
// ============================
function InvoiceDetailModal({
  invoice,
  currency,
  onClose,
  onEdit,
}: {
  invoice: Invoice;
  currency: string;
  onClose: () => void;
  onEdit?: () => void;
}) {
  const cfg = TYPE_CONFIG[invoice.type] ?? TYPE_CONFIG.all;

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4"
      dir="rtl"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        <div
          className={`bg-gradient-to-r ${cfg.gradient} px-6 py-4 text-white flex items-center justify-between sticky top-0`}
        >
          <div>
            <h3 className="font-bold text-lg">
              {cfg.icon} {TYPE_LABEL[invoice.type] ?? invoice.type} — {invoice.number}
            </h3>
            <p className="text-white/70 text-sm">
              {invoice.date} · {invoice.time}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={onEdit}
                className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-semibold"
              >
                تعديل
              </button>
            )}

            <button onClick={onClose} className="text-white/80 hover:text-white p-1">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: "العميل/المورد", value: invoice.customerName || invoice.supplierName || "-" },
              { label: "الهاتف", value: invoice.customerPhone || invoice.supplierPhone || "-" },
              { label: "الحالة", value: statusLabel(invoice.status) },
              { label: "ملاحظات", value: invoice.notes || "-" },
            ].map((f) => (
              <div key={f.label} className="bg-gray-50 rounded-xl p-3">
                <span className="text-gray-400 text-xs block mb-1">{f.label}</span>
                <span className="font-semibold text-gray-800">{f.value}</span>
              </div>
            ))}
          </div>

          {Array.isArray(invoice.items) && invoice.items.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-700 text-sm mb-2">
                الأصناف ({invoice.items.length})
              </h4>

              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-gray-500 text-xs">
                      <th className="px-3 py-2 text-right">الصنف</th>
                      <th className="px-3 py-2 text-right">الكمية</th>
                      <th className="px-3 py-2 text-right">السعر</th>
                      <th className="px-3 py-2 text-right">الإجمالي</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-50">
                    {invoice.items.map((item, idx) => (
                      <tr key={item.id ?? `item-${idx}`} className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <div className="font-medium text-gray-800">{item.productName}</div>
                          {item.barcode && (
                            <div className="text-xs text-gray-400 font-mono">{item.barcode}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-700">{toNumber(item.quantity)}</td>
                        <td className="px-3 py-2 text-gray-700">{fmt(item.unitPrice)}</td>
                        <td className="px-3 py-2 font-bold text-gray-800">
                          {fmt(item.total)} {currency}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">المجموع الفرعي</span>
              <span className="font-semibold">
                {fmt(invoice.subtotal)} {currency}
              </span>
            </div>

            {toNumber(invoice.discount) > 0 && (
              <div className="flex justify-between text-orange-600">
                <span>الخصم</span>
                <span>
                  -{fmt(invoice.discount)} {currency}
                </span>
              </div>
            )}

            {toNumber((invoice as any).tax) > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>الضريبة</span>
                <span>
                  {fmt((invoice as any).tax)} {currency}
                </span>
              </div>
            )}

            <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-2">
              <span>الإجمالي</span>
              <span className="text-blue-700">
                {fmt(invoice.total)} {currency}
              </span>
            </div>

            <div className="flex justify-between text-emerald-600">
              <span>المدفوع</span>
              <span className="font-semibold">
                {fmt(invoice.paid)} {currency}
              </span>
            </div>

            {toNumber(invoice.remaining) > 0 && (
              <div className="flex justify-between text-red-600 font-bold">
                <span>المتبقي</span>
                <span>
                  {fmt(invoice.remaining)} {currency}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================
// InvoiceRegistry Main
// ============================
export default function InvoiceRegistry({
  invoices,
  products,
  customers,
  suppliers,
  settings,
  onUpdate,
  onDelete,
  filterType = "all",
}: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "all">("all");
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const PER_PAGE = 15;
  const config = TYPE_CONFIG[filterType] ?? TYPE_CONFIG.all;
  const safeInvoices = Array.isArray(invoices) ? invoices.filter(Boolean) : [];

  const filtered = useMemo(() => {
    return safeInvoices
      .filter((inv) => {
        if (!inv) return false;

        const matchType =
          filterType === "all"
            ? true
            : filterType === "pending"
            ? inv.status === "pending"
            : inv.type === filterType;

        const matchStatus = statusFilter === "all" ? true : inv.status === statusFilter;

        const q = search.toLowerCase().trim();
        const matchSearch = !q
          ? true
          : (inv.number ?? "").toLowerCase().includes(q) ||
            (inv.customerName ?? "").toLowerCase().includes(q) ||
            (inv.supplierName ?? "").toLowerCase().includes(q) ||
            (inv.date ?? "").includes(search) ||
            (inv.customerPhone ?? "").includes(search) ||
            (inv.supplierPhone ?? "").includes(search) ||
            (Array.isArray(inv.items) &&
              inv.items.some((item) => (item.productName ?? "").toLowerCase().includes(q)));

        return matchType && matchStatus && matchSearch;
      })
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
  }, [safeInvoices, filterType, statusFilter, search]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  useEffect(() => {
    if (totalPages > 0 && page > totalPages) {
      setPage(totalPages);
    }
    if (filtered.length === 0 && page !== 1) {
      setPage(1);
    }
  }, [totalPages, page, filtered.length]);

  const stats = useMemo(() => {
    const closed = filtered.filter((i) => i.status === "closed");
    const pending = filtered.filter((i) => i.status === "pending");
    const openCount = filtered.filter((i) => i.status === "open").length;

    const totalAmount = filtered.reduce((s, i) => s + toNumber(i.total), 0);
    const totalPaid = filtered.reduce((s, i) => s + toNumber(i.paid), 0);
    const totalRemaining = filtered.reduce((s, i) => s + toNumber(i.remaining), 0);
    const closedAmount = closed.reduce((s, i) => s + toNumber(i.total), 0);
    const pendingAmount = pending.reduce((s, i) => s + toNumber(i.remaining), 0);

    return {
      totalAmount,
      totalPaid,
      totalRemaining,
      closedAmount,
      pendingAmount,
      closedCount: closed.length,
      pendingCount: pending.length,
      openCount,
    };
  }, [filtered]);

  const handleExport = () => {
    const label =
      filterType === "sale"
        ? "فواتير_المبيعات"
        : filterType === "purchase"
        ? "فواتير_المشتريات"
        : filterType === "return_sale"
        ? "مرتجع_المبيعات"
        : filterType === "return_purchase"
        ? "مرتجع_المشتريات"
        : filterType === "pending"
        ? "الفواتير_المعلقة"
        : "جميع_الفواتير";

    exportInvoicesToExcel(filtered, label);
  };

  return (
    <div className="space-y-5" dir="rtl">
      {/* ── Header ── */}
      <div className={`bg-gradient-to-r ${config.gradient} rounded-2xl p-5 text-white shadow-lg`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-2xl">
              {config.icon}
            </div>
            <div>
              <h2 className="text-xl font-bold">{config.label}</h2>
              <p className="text-white/70 text-sm">{filtered.length} فاتورة</p>
            </div>
          </div>

          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-semibold transition-colors"
          >
            <Download size={16} /> تصدير Excel
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "إجمالي المبالغ", value: fmt(stats.totalAmount), unit: settings.currency },
            { label: "إجمالي المدفوع", value: fmt(stats.totalPaid), unit: settings.currency },
            { label: "المتبقي", value: fmt(stats.totalRemaining), unit: settings.currency },
            {
              label: "مغلقة / معلقة",
              value: `${stats.closedCount} / ${stats.pendingCount}`,
              unit: "فاتورة",
            },
          ].map((s) => (
            <div key={s.label} className="bg-white/15 rounded-xl p-3 text-center">
              <div className="text-xs opacity-75 mb-1">{s.label}</div>
              <div className="text-lg font-bold">{s.value}</div>
              <div className="text-xs opacity-60">{s.unit}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── بطاقات الإحصائيات ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: "إجمالي الفواتير",
            value: filtered.length,
            unit: "فاتورة",
            icon: FileText,
            bg: config.cardBg,
            border: config.cardBorder,
            text: config.cardText,
          },
          {
            label: "إجمالي المبالغ",
            value: fmt(stats.totalAmount),
            unit: settings.currency,
            icon: DollarSign,
            bg: "bg-blue-50",
            border: "border-blue-100",
            text: "text-blue-700",
          },
          {
            label: "إجمالي المدفوع",
            value: fmt(stats.totalPaid),
            unit: settings.currency,
            icon: CheckCircle,
            bg: "bg-emerald-50",
            border: "border-emerald-100",
            text: "text-emerald-700",
          },
          {
            label: "المتبقي",
            value: fmt(stats.totalRemaining),
            unit: settings.currency,
            icon: AlertTriangle,
            bg: stats.totalRemaining > 0 ? "bg-red-50" : "bg-gray-50",
            border: stats.totalRemaining > 0 ? "border-red-100" : "border-gray-100",
            text: stats.totalRemaining > 0 ? "text-red-700" : "text-gray-700",
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className={`${card.bg} border ${card.border} rounded-2xl p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <Icon size={16} className={card.text} />
                <span className="text-xs font-semibold text-gray-500">{card.label}</span>
              </div>
              <div className={`text-xl font-bold ${card.text}`}>{card.value}</div>
              <div className="text-xs text-gray-400 mt-0.5">{card.unit}</div>
            </div>
          );
        })}
      </div>

      {/* ── شريط البحث والفلاتر ── */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full border border-gray-200 rounded-xl pr-9 pl-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="ابحث برقم الفاتورة أو الاسم أو الهاتف أو الصنف..."
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="relative">
            <Filter
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as InvoiceStatus | "all");
                setPage(1);
              }}
              className="border border-gray-200 rounded-xl pr-9 pl-8 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 appearance-none bg-white"
            >
              <option value="all">جميع الحالات</option>
              <option value="open">مفتوحة</option>
              <option value="closed">مغلقة</option>
              <option value="pending">معلقة</option>
              <option value="cancelled">ملغية</option>
            </select>
            <ChevronDown
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
          </div>
        </div>

        {/* فلاتر الحالة السريعة */}
        <div className="flex gap-2 flex-wrap">
          {[
            { val: "all", label: `الكل (${filtered.length})` },
            { val: "closed", label: `مغلقة (${stats.closedCount})` },
            { val: "pending", label: `معلقة (${stats.pendingCount})` },
            { val: "open", label: `مفتوحة (${stats.openCount})` },
          ].map((f) => (
            <button
              key={f.val}
              onClick={() => {
                setStatusFilter(f.val as any);
                setPage(1);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === f.val
                  ? `bg-gradient-to-r ${config.gradient} text-white`
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── الجدول الرئيسي ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={`${config.cardBg} border-b ${config.cardBorder}`}>
              <tr>
                {[
                  "رقم الفاتورة",
                  "النوع",
                  "الحالة",
                  "التاريخ",
                  "العميل/المورد",
                  "الأصناف",
                  "الإجمالي",
                  "المدفوع",
                  "المتبقي",
                  "إجراءات",
                ].map((h) => (
                  <th
                    key={h}
                    className={`px-3 py-3 text-right font-semibold text-xs ${config.cardText}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-16 text-gray-400">
                    <div className="flex flex-col items-center gap-3">
                      <span className="text-5xl">{config.icon}</span>
                      <span className="font-medium">لا توجد فواتير</span>
                      {search && <span className="text-xs">جرّب البحث بكلمة مختلفة</span>}
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((inv, idx) => {
                  const isExpanded = expandedId === inv.id;

                  return (
                    <Fragment key={inv.id ?? `row-${idx}`}>
                      {/* ── صف الفاتورة الرئيسي ── */}
                      <tr
                        className={`border-t border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer ${
                          idx % 2 === 0 ? "" : "bg-gray-50/30"
                        }`}
                        onClick={() => setExpandedId(isExpanded ? null : inv.id)}
                      >
                        <td className="px-3 py-3 font-mono text-xs font-bold text-gray-700">
                          {inv.number ?? "-"}
                        </td>

                        <td className="px-3 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              TYPE_BADGE[inv.type] ?? "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {TYPE_LABEL[inv.type] ?? inv.type}
                          </span>
                        </td>

                        <td className="px-3 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusColor(
                              inv.status
                            )}`}
                          >
                            {statusLabel(inv.status)}
                          </span>
                        </td>

                        <td className="px-3 py-3 text-gray-500 text-xs whitespace-nowrap">
                          {inv.date ?? "-"}
                        </td>

                        <td className="px-3 py-3">
                          <div className="font-medium text-gray-800 text-sm">
                            {inv.customerName || inv.supplierName || "-"}
                          </div>
                          {(inv.customerPhone || inv.supplierPhone) && (
                            <div className="text-gray-400 text-xs">
                              {inv.customerPhone || inv.supplierPhone}
                            </div>
                          )}
                        </td>

                        <td className="px-3 py-3">
                          {Array.isArray(inv.items) && inv.items.length > 0 ? (
                            <div className="text-xs text-gray-500">
                              {inv.items.slice(0, 2).map((item, itemIdx) => (
                                <div key={item.id ?? `item-${itemIdx}`} className="truncate max-w-28">
                                  {item.productName} ×{toNumber(item.quantity)}
                                </div>
                              ))}
                              {inv.items.length > 2 && (
                                <div className={`font-semibold ${config.cardText}`}>
                                  +{inv.items.length - 2} أخرى
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-300 text-xs">-</span>
                          )}
                        </td>

                        <td className="px-3 py-3 font-bold text-gray-800 whitespace-nowrap">
                          {fmt(inv.total)}
                          <span className="text-xs font-normal text-gray-400 mr-1">
                            {settings.currency}
                          </span>
                        </td>

                        <td className="px-3 py-3 text-emerald-600 font-semibold whitespace-nowrap">
                          {fmt(inv.paid)} {settings.currency}
                        </td>

                        <td
                          className={`px-3 py-3 font-semibold whitespace-nowrap ${
                            toNumber(inv.remaining) > 0 ? "text-red-600" : "text-emerald-600"
                          }`}
                        >
                          {toNumber(inv.remaining) > 0
                            ? `${fmt(inv.remaining)} ${settings.currency}`
                            : "✓ مسدد"}
                        </td>

                        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setViewingInvoice(inv)}
                              className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                              title="عرض التفاصيل"
                            >
                              <Eye size={13} />
                            </button>

                            <button
                              onClick={() => setEditingInvoice(inv)}
                              className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                              title="تعديل"
                            >
                              <Edit2 size={13} />
                            </button>

                            <button
                              onClick={() =>
                                exportSingleInvoiceToExcel(inv, settings.shopName, settings.currency)
                              }
                              className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                              title="تصدير"
                            >
                              <Download size={13} />
                            </button>

                            <button
                              onClick={() => setConfirmDelete(inv.id)}
                              className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                              title="حذف"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* ── صف الأصناف الموسّع ── */}
                      {isExpanded && Array.isArray(inv.items) && inv.items.length > 0 && (
                        <tr className="bg-blue-50/30">
                          <td colSpan={10} className="px-6 py-3">
                            <div className="text-xs font-bold text-gray-500 mb-2">
                              تفاصيل الأصناف ({inv.items.length} صنف):
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {inv.items.map((item, itemIdx) => (
                                <div
                                  key={item.id ?? `expanded-item-${itemIdx}`}
                                  className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-gray-100"
                                >
                                  <div className="min-w-0">
                                    <div className="font-semibold text-gray-800 text-xs truncate">
                                      {item.productName}
                                    </div>
                                    {item.barcode && (
                                      <div className="text-gray-400 text-[10px] font-mono">
                                        {item.barcode}
                                      </div>
                                    )}
                                  </div>

                                  <div className="text-right flex-shrink-0 mr-2">
                                    <div className="text-xs font-bold text-gray-700">
                                      ×{toNumber(item.quantity)}
                                    </div>
                                    <div className={`text-xs font-bold ${config.cardText}`}>
                                      {fmt(item.total)} {settings.currency}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {inv.notes && (
                              <div className="mt-2 text-xs text-gray-500 bg-white rounded-xl px-3 py-2 border border-gray-100">
                                <span className="font-semibold">ملاحظات: </span>
                                {inv.notes}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>

            {filtered.length > 0 && (
              <tfoot>
                <tr
                  className={`${config.cardBg} border-t-2 ${config.cardBorder} font-bold text-sm`}
                >
                  <td colSpan={6} className={`px-3 py-2.5 ${config.cardText}`}>
                    الإجمالي ({filtered.length} فاتورة)
                  </td>
                  <td className="px-3 py-2.5 text-gray-800">
                    {fmt(stats.totalAmount)} {settings.currency}
                  </td>
                  <td className="px-3 py-2.5 text-emerald-700">
                    {fmt(stats.totalPaid)} {settings.currency}
                  </td>
                  <td
                    className={`px-3 py-2.5 ${
                      stats.totalRemaining > 0 ? "text-red-700" : "text-emerald-700"
                    }`}
                  >
                    {fmt(stats.totalRemaining)} {settings.currency}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-2 p-4 border-t border-gray-100">
            <span className="text-xs text-gray-400">
              عرض {(page - 1) * PER_PAGE + 1} - {Math.min(page * PER_PAGE, filtered.length)} من{" "}
              {filtered.length}
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="px-2 py-1 rounded-lg border border-gray-200 text-xs disabled:opacity-40 hover:bg-gray-50"
              >
                «
              </button>

              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded-lg border border-gray-200 text-sm disabled:opacity-40 hover:bg-gray-50"
              >
                السابق
              </button>

              <span className="text-sm text-gray-600 font-medium">
                {page} / {totalPages}
              </span>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 rounded-lg border border-gray-200 text-sm disabled:opacity-40 hover:bg-gray-50"
              >
                التالي
              </button>

              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="px-2 py-1 rounded-lg border border-gray-200 text-xs disabled:opacity-40 hover:bg-gray-50"
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── مودال عرض التفاصيل ── */}
      {viewingInvoice && (
        <InvoiceDetailModal
          invoice={viewingInvoice}
          currency={settings.currency}
          onClose={() => setViewingInvoice(null)}
          onEdit={() => {
            setEditingInvoice(viewingInvoice);
            setViewingInvoice(null);
          }}
        />
      )}

      {/* ── مودال التعديل ── */}
      {editingInvoice && (
        <InvoiceForm
          type={editingInvoice.type}
          existingInvoice={editingInvoice}
          invoices={safeInvoices}
          products={products}
          customers={customers}
          suppliers={suppliers}
          settings={settings}
          onSave={(inv) => {
            onUpdate(inv);
            setEditingInvoice(null);
          }}
          onClose={() => setEditingInvoice(null)}
        />
      )}

      {/* ── تأكيد الحذف ── */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full">
            <div className="text-center mb-4">
              <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Trash2 size={24} className="text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-1">تأكيد الحذف</h3>
              <p className="text-gray-500 text-sm">
                هل أنت متأكد من حذف هذه الفاتورة؟ لا يمكن التراجع.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  onDelete(confirmDelete);
                  setConfirmDelete(null);
                }}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 active:scale-95 transition-all"
              >
                حذف
              </button>

              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}