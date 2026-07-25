// src/components/ShiftArchives.tsx
import { useState, useMemo, useCallback, useRef, useTransition, memo } from "react";
import { Invoice } from "../types";
import {
  Archive, Search, ChevronDown, ChevronUp, Calendar,
  TrendingUp, TrendingDown, Wrench, DollarSign, ShoppingBag,
  Eye, Edit2, Trash2, X, Filter, Download, ChevronRight,
  ChevronLeft, RotateCcw, Package, FileText, Printer,
  ArrowUpDown, Clock, Hash, User, Phone, CreditCard,
  AlertTriangle, CheckCircle, Info, RefreshCw, Layers,
} from "lucide-react";

interface ShiftArchive {
  id: string;
  date?: string;
  closedAt?: string;
  openedAt?: string;
  invoices: Invoice[];
  installments?: any[];
  summary?: any;
  lastModified?: string;
  isModified?: boolean;
  resetSettings?: any;
}

interface Props {
  archives: ShiftArchive[];
  currency: string;
  onEditInvoice: (invoice: Invoice) => void;
  onExportArchive?: (archive: ShiftArchive, section?: string) => void;
}

// ✅ ثوابت
const PAGE_SIZE = 10;
const INVOICES_PAGE_SIZE = 20;

const TYPE_LABELS: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  sale: { label: "مبيعات", icon: TrendingUp, color: "text-blue-700", bg: "bg-blue-50" },
  purchase: { label: "مشتريات", icon: TrendingDown, color: "text-green-700", bg: "bg-green-50" },
  return_sale: { label: "مرتجع بيع", icon: RotateCcw, color: "text-orange-700", bg: "bg-orange-50" },
  return_purchase: { label: "مرتجع شراء", icon: RotateCcw, color: "text-purple-700", bg: "bg-purple-50" },
  maintenance: { label: "صيانة", icon: Wrench, color: "text-violet-700", bg: "bg-violet-50" },
  accessory_sale: { label: "اكسسوار بيع", icon: ShoppingBag, color: "text-amber-700", bg: "bg-amber-50" },
  accessory_purchase: { label: "اكسسوار شراء", icon: Package, color: "text-teal-700", bg: "bg-teal-50" },
};

// ═══════════════════════════════════════════════════════════════
// ✅ مكون فاتورة واحدة (محسّن بـ memo)
// ═══════════════════════════════════════════════════════════════
const InvoiceRow = memo(function InvoiceRow({
  invoice, currency, onEdit, archiveId,
}: {
  invoice: Invoice; currency: string;
  onEdit: (inv: Invoice) => void; archiveId: string;
}) {
  const typeInfo = TYPE_LABELS[invoice.type] || {
    label: invoice.type, icon: FileText, color: "text-gray-700", bg: "bg-gray-50"
  };
  const IconComp = typeInfo.icon;

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
      <td className="px-3 py-2.5">
        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold ${typeInfo.bg} ${typeInfo.color}`}>
          <IconComp size={12} />
          {typeInfo.label}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <span className="font-mono text-xs font-bold text-gray-700">
          {invoice.number || "-"}
        </span>
      </td>
      <td className="px-3 py-2.5 text-xs text-gray-500">
        {invoice.date || "-"}
      </td>
      <td className="px-3 py-2.5">
        <div className="text-sm font-semibold text-gray-800 truncate max-w-[150px]">
          {invoice.customerName || invoice.supplierName || "-"}
        </div>
        {(invoice.customerPhone || invoice.supplierPhone) && (
          <div className="text-xs text-gray-400 truncate">
            {invoice.customerPhone || invoice.supplierPhone}
          </div>
        )}
      </td>
      <td className="px-3 py-2.5 text-center">
        <span className="font-bold text-gray-800 text-sm">
          {(invoice.total ?? 0).toLocaleString()}
        </span>
      </td>
      <td className="px-3 py-2.5 text-center">
        <span className="text-emerald-600 font-bold text-sm">
          {(invoice.paid ?? 0).toLocaleString()}
        </span>
      </td>
      <td className="px-3 py-2.5 text-center">
        {(invoice.remaining ?? 0) > 0 ? (
          <span className="text-red-600 font-bold text-sm">
            {(invoice.remaining ?? 0).toLocaleString()}
          </span>
        ) : (
          <span className="text-gray-300 text-xs">—</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-center">
        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
          invoice.status === "closed" ? "bg-emerald-100 text-emerald-700" :
          invoice.status === "pending" ? "bg-amber-100 text-amber-700" :
          invoice.status === "cancelled" ? "bg-red-100 text-red-700" :
          "bg-gray-100 text-gray-600"
        }`}>
          {invoice.status === "closed" ? "مغلقة" :
           invoice.status === "pending" ? "معلقة" :
           invoice.status === "cancelled" ? "ملغاة" : invoice.status || "-"}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => onEdit({ ...invoice, archivedShiftId: archiveId } as any)}
            className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
            title="عرض / تعديل"
          >
            <Eye size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
});

// ═══════════════════════════════════════════════════════════════
// ✅ ملخص وردية (محسّن بـ memo)
// ═══════════════════════════════════════════════════════════════
const ArchiveSummaryCards = memo(function ArchiveSummaryCards({
  archive, currency,
}: { archive: ShiftArchive; currency: string }) {
  const invoices = archive.invoices || [];

  const summary = useMemo(() => {
    const calc = (types: string[]) => {
      const filtered = invoices.filter(i => types.includes(i.type) && i.status === "closed");
      return {
        count: filtered.length,
        total: filtered.reduce((s, i) => s + (i.paid ?? 0), 0),
      };
    };

    const sales = calc(["sale"]);
    const purchases = calc(["purchase"]);
    const returnSales = calc(["return_sale"]);
    const returnPurchases = calc(["return_purchase"]);
    const maintenance = calc(["maintenance"]);
    const accessory = calc(["accessory_sale", "accessory_purchase"]);
    const installments = Array.isArray(archive.installments) ? archive.installments : [];
    const instTotal = installments.reduce((s: number, p: any) => s + (p?.amount ?? 0), 0);

    const netSales = sales.total - purchases.total - returnSales.total + returnPurchases.total;
    const grandTotal = netSales + maintenance.total + instTotal + accessory.total;

    return { sales, purchases, returnSales, returnPurchases, maintenance, accessory, instTotal, installments, netSales, grandTotal };
  }, [invoices, archive.installments]);

  const cards = [
    { label: "مبيعات", count: summary.sales.count, value: summary.sales.total, icon: TrendingUp, bg: "bg-blue-50", color: "text-blue-700", border: "border-blue-100" },
    { label: "مشتريات", count: summary.purchases.count, value: summary.purchases.total, icon: TrendingDown, bg: "bg-green-50", color: "text-green-700", border: "border-green-100" },
    { label: "مرتجع بيع", count: summary.returnSales.count, value: summary.returnSales.total, icon: RotateCcw, bg: "bg-orange-50", color: "text-orange-700", border: "border-orange-100" },
    { label: "صيانة", count: summary.maintenance.count, value: summary.maintenance.total, icon: Wrench, bg: "bg-violet-50", color: "text-violet-700", border: "border-violet-100" },
    { label: "اكسسوار", count: summary.accessory.count, value: summary.accessory.total, icon: ShoppingBag, bg: "bg-amber-50", color: "text-amber-700", border: "border-amber-100" },
    { label: "أقساط", count: summary.installments.length, value: summary.instTotal, icon: DollarSign, bg: "bg-indigo-50", color: "text-indigo-700", border: "border-indigo-100" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {cards.map(c => (
          <div key={c.label} className={`${c.bg} ${c.border} border rounded-xl px-3 py-2.5 text-center`}>
            <div className="flex items-center justify-center gap-1 mb-1">
              <c.icon size={12} className={c.color} />
              <span className={`text-xs font-bold ${c.color} opacity-80`}>{c.label}</span>
            </div>
            <div className={`text-base font-black ${c.color}`}>
              {c.value.toLocaleString()}
            </div>
            <div className="text-xs text-gray-400">({c.count})</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <div className={`flex-1 rounded-xl px-4 py-2.5 text-center border ${
          summary.netSales >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
        }`}>
          <div className="text-xs text-gray-500 font-medium">صافي</div>
          <div className={`text-lg font-black ${
            summary.netSales >= 0 ? "text-emerald-700" : "text-red-700"
          }`}>
            {summary.netSales.toLocaleString()} {currency}
          </div>
        </div>
        <div className={`flex-1 rounded-xl px-4 py-2.5 text-center border ${
          summary.grandTotal >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
        }`}>
          <div className="text-xs text-gray-500 font-medium">إجمالي</div>
          <div className={`text-lg font-black ${
            summary.grandTotal >= 0 ? "text-emerald-700" : "text-red-700"
          }`}>
            {summary.grandTotal.toLocaleString()} {currency}
          </div>
        </div>
      </div>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════
// ✅ المكون الرئيسي
// ═══════════════════════════════════════════════════════════════
export default function ShiftArchives({ archives, currency, onEditInvoice, onExportArchive }: Props) {
  const [expandedArchive, setExpandedArchive] = useState<string | null>(null);
  const [archivePage, setArchivePage] = useState(1);
  const [invoicePage, setInvoicePage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [isPending, startTransition] = useTransition();

  // ── ترتيب الأرشيفات ──
  const sortedArchives = useMemo(() => {
    const sorted = [...(archives || [])].sort((a, b) => {
      const dateA = a.closedAt || a.date || a.id;
      const dateB = b.closedAt || b.date || b.id;
      return sortOrder === "newest"
        ? dateB.localeCompare(dateA)
        : dateA.localeCompare(dateB);
    });
    return sorted;
  }, [archives, sortOrder]);

  // ── فلترة الأرشيفات بالبحث ──
  const filteredArchives = useMemo(() => {
    if (!searchQuery.trim()) return sortedArchives;
    const q = searchQuery.toLowerCase().trim();
    return sortedArchives.filter(arch => {
      if (arch.date?.toLowerCase().includes(q)) return true;
      if (arch.id?.toLowerCase().includes(q)) return true;
      // بحث في الفواتير
      return (arch.invoices || []).some(inv =>
        inv.number?.toLowerCase().includes(q) ||
        inv.customerName?.toLowerCase().includes(q) ||
        inv.supplierName?.toLowerCase().includes(q) ||
        inv.customerPhone?.includes(q) ||
        inv.supplierPhone?.includes(q)
      );
    });
  }, [sortedArchives, searchQuery]);

  // ── تقسيم الصفحات للأرشيفات ──
  const totalArchivePages = Math.max(1, Math.ceil(filteredArchives.length / PAGE_SIZE));
  const pagedArchives = useMemo(() => {
    const start = (archivePage - 1) * PAGE_SIZE;
    return filteredArchives.slice(start, start + PAGE_SIZE);
  }, [filteredArchives, archivePage]);

  // ── فواتير الأرشيف المفتوح ──
  const expandedInvoices = useMemo(() => {
    if (!expandedArchive) return [];
    const arch = archives.find(a => a.id === expandedArchive);
    if (!arch) return [];
    let invs = arch.invoices || [];

    // فلترة بالبحث
    if (invoiceSearch.trim()) {
      const q = invoiceSearch.toLowerCase().trim();
      invs = invs.filter(inv =>
        inv.number?.toLowerCase().includes(q) ||
        inv.customerName?.toLowerCase().includes(q) ||
        inv.supplierName?.toLowerCase().includes(q) ||
        inv.customerPhone?.includes(q) ||
        inv.supplierPhone?.includes(q) ||
        inv.items?.some(it => it.productName?.toLowerCase().includes(q))
      );
    }

    // فلترة بالنوع
    if (typeFilter !== "all") {
      invs = invs.filter(inv => inv.type === typeFilter);
    }

    // فلترة بالحالة
    if (statusFilter !== "all") {
      invs = invs.filter(inv => inv.status === statusFilter);
    }

    return invs;
  }, [expandedArchive, archives, invoiceSearch, typeFilter, statusFilter]);

  // ── تقسيم صفحات الفواتير ──
  const totalInvoicePages = Math.max(1, Math.ceil(expandedInvoices.length / INVOICES_PAGE_SIZE));
  const pagedInvoices = useMemo(() => {
    const start = (invoicePage - 1) * INVOICES_PAGE_SIZE;
    return expandedInvoices.slice(start, start + INVOICES_PAGE_SIZE);
  }, [expandedInvoices, invoicePage]);

  // ── فتح/إغلاق أرشيف ──
  const toggleArchive = useCallback((id: string) => {
    startTransition(() => {
      setExpandedArchive(prev => {
        if (prev === id) return null;
        setInvoicePage(1);
        setInvoiceSearch("");
        setTypeFilter("all");
        setStatusFilter("all");
        return id;
      });
    });
  }, []);

  // ── تغيير البحث ──
  const handleSearchChange = useCallback((value: string) => {
    startTransition(() => {
      setSearchQuery(value);
      setArchivePage(1);
    });
  }, []);

  const handleInvoiceSearchChange = useCallback((value: string) => {
    startTransition(() => {
      setInvoiceSearch(value);
      setInvoicePage(1);
    });
  }, []);

  return (
    <div className="space-y-5" dir="rtl">

      {/* ══════════════ الهيدر ══════════════ */}
      <div className="bg-gradient-to-r from-pink-600 to-rose-700 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <Archive size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black">أرشيف الورديات</h2>
              <p className="text-pink-200 text-sm">
                {archives.length} وردية مؤرشفة
                {" · "}
                {archives.reduce((s, a) => s + (a.invoices?.length ?? 0), 0)} فاتورة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSortOrder(s => s === "newest" ? "oldest" : "newest")}
              className="flex items-center gap-2 px-3 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-bold transition-colors"
            >
              <ArrowUpDown size={13} />
              {sortOrder === "newest" ? "الأحدث أولاً" : "الأقدم أولاً"}
            </button>
          </div>
        </div>

        {/* بحث */}
        <div className="mt-4 relative">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="بحث في الأرشيف (تاريخ، رقم فاتورة، اسم عميل...)"
            className="w-full bg-white/15 border border-white/20 rounded-xl pr-10 pl-4 py-3 text-sm text-white placeholder-white/40 outline-none focus:bg-white/25 focus:border-white/40 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => handleSearchChange("")}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* إحصائية سريعة */}
        <div className="mt-3 flex items-center gap-4 text-xs text-pink-200">
          <span>عرض: {filteredArchives.length} من {archives.length}</span>
          <span>الصفحة: {archivePage} / {totalArchivePages}</span>
          {isPending && (
            <span className="flex items-center gap-1 text-white">
              <RefreshCw size={10} className="animate-spin" /> جاري التحميل...
            </span>
          )}
        </div>
      </div>

      {/* ══════════════ قائمة الأرشيفات ══════════════ */}
      {filteredArchives.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <Archive size={48} className="mx-auto mb-4 text-gray-200" />
          <h3 className="text-lg font-black text-gray-400 mb-2">
            {searchQuery ? "لا توجد نتائج" : "لا توجد ورديات مؤرشفة"}
          </h3>
          <p className="text-sm text-gray-400">
            {searchQuery ? "جرب كلمة بحث مختلفة" : "سيظهر الأرشيف بعد تقفيل أول وردية"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pagedArchives.map(archive => {
            const isExpanded = expandedArchive === archive.id;
            const totalInvoices = archive.invoices?.length ?? 0;
            const totalPaid = (archive.invoices || [])
              .filter(i => i.status === "closed")
              .reduce((s, i) => s + (i.paid ?? 0), 0);

            return (
              <div
                key={archive.id}
                className={`bg-white rounded-2xl border overflow-hidden transition-all duration-300 ${
                  isExpanded ? "border-pink-200 shadow-lg" : "border-gray-100 shadow-sm hover:shadow-md"
                }`}
              >
                {/* ── رأس الأرشيف ── */}
                <button
                  onClick={() => toggleArchive(archive.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-right hover:bg-gray-50/50 transition-colors"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                    isExpanded ? "bg-pink-100 text-pink-600" : "bg-gray-100 text-gray-400"
                  }`}>
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-black text-gray-800">
                        وردية {archive.date || archive.id.slice(-6)}
                      </h3>
                      {archive.isModified && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">
                          ✏️ معدّل
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar size={10} />
                        {archive.closedAt ? new Date(archive.closedAt).toLocaleString("ar-EG") : archive.date || "-"}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText size={10} />
                        {totalInvoices} فاتورة
                      </span>
                      <span className="flex items-center gap-1">
                        <CreditCard size={10} />
                        {totalPaid.toLocaleString()} {currency}
                      </span>
                    </div>
                  </div>

                  {/* أزرار التصدير */}
                  {onExportArchive && (
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => onExportArchive(archive)}
                        className="p-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors"
                        title="تصدير الكل"
                      >
                        <Download size={14} />
                      </button>
                    </div>
                  )}
                </button>

                {/* ── محتوى الأرشيف المفتوح ── */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {/* ملخص */}
                    <div className="px-5 py-4 bg-gray-50/50">
                      <ArchiveSummaryCards archive={archive} currency={currency} />
                    </div>

                    {/* أزرار تصدير البنود */}
                    {onExportArchive && (
                      <div className="px-5 py-3 border-t border-gray-100 bg-white">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-gray-500">تصدير:</span>
                          {[
                            { key: "sales", label: "المبيعات", color: "bg-blue-50 text-blue-600 hover:bg-blue-100" },
                            { key: "purchases", label: "المشتريات", color: "bg-green-50 text-green-600 hover:bg-green-100" },
                            { key: "maintenance", label: "الصيانة", color: "bg-violet-50 text-violet-600 hover:bg-violet-100" },
                            { key: "accessory", label: "اكسسوار", color: "bg-amber-50 text-amber-600 hover:bg-amber-100" },
                            { key: "installments", label: "الأقساط", color: "bg-indigo-50 text-indigo-600 hover:bg-indigo-100" },
                          ].map(btn => (
                            <button
                              key={btn.key}
                              onClick={() => onExportArchive(archive, btn.key)}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${btn.color}`}
                            >
                              <Download size={10} className="inline ml-1" />
                              {btn.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* فلاتر الفواتير */}
                    <div className="px-5 py-3 border-t border-gray-100 bg-white">
                      <div className="flex flex-wrap gap-2 items-center">
                        <div className="relative flex-1 min-w-[200px]">
                          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            type="text"
                            value={invoiceSearch}
                            onChange={e => handleInvoiceSearchChange(e.target.value)}
                            placeholder="بحث في الفواتير..."
                            className="w-full border border-gray-200 rounded-xl pr-9 pl-4 py-2 text-sm outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-300"
                          />
                        </div>

                        <select
                          value={typeFilter}
                          onChange={e => { setTypeFilter(e.target.value); setInvoicePage(1); }}
                          className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-pink-200 bg-white"
                        >
                          <option value="all">كل الأنواع</option>
                          {Object.entries(TYPE_LABELS).map(([key, val]) => (
                            <option key={key} value={key}>{val.label}</option>
                          ))}
                        </select>

                        <select
                          value={statusFilter}
                          onChange={e => { setStatusFilter(e.target.value); setInvoicePage(1); }}
                          className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-pink-200 bg-white"
                        >
                          <option value="all">كل الحالات</option>
                          <option value="closed">مغلقة</option>
                          <option value="pending">معلقة</option>
                          <option value="cancelled">ملغاة</option>
                        </select>

                        <span className="text-xs text-gray-400 font-medium">
                          {expandedInvoices.length} فاتورة
                        </span>
                      </div>
                    </div>

                    {/* جدول الفواتير */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-y border-gray-100">
                          <tr>
                            <th className="px-3 py-2.5 text-right text-xs font-bold text-gray-500">النوع</th>
                            <th className="px-3 py-2.5 text-right text-xs font-bold text-gray-500">الرقم</th>
                            <th className="px-3 py-2.5 text-right text-xs font-bold text-gray-500">التاريخ</th>
                            <th className="px-3 py-2.5 text-right text-xs font-bold text-gray-500">العميل/المورد</th>
                            <th className="px-3 py-2.5 text-center text-xs font-bold text-gray-500">الإجمالي</th>
                            <th className="px-3 py-2.5 text-center text-xs font-bold text-gray-500">المدفوع</th>
                            <th className="px-3 py-2.5 text-center text-xs font-bold text-gray-500">المتبقي</th>
                            <th className="px-3 py-2.5 text-center text-xs font-bold text-gray-500">الحالة</th>
                            <th className="px-3 py-2.5 w-16"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagedInvoices.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="text-center py-8 text-gray-400">
                                <FileText size={24} className="mx-auto mb-2 opacity-30" />
                                <div className="text-sm font-medium">لا توجد فواتير</div>
                              </td>
                            </tr>
                          ) : (
                            pagedInvoices.map(inv => (
                              <InvoiceRow
                                key={inv.id}
                                invoice={inv}
                                currency={currency}
                                onEdit={onEditInvoice}
                                archiveId={archive.id}
                              />
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* تقسيم صفحات الفواتير */}
                    {totalInvoicePages > 1 && (
                      <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
                        <span className="text-xs text-gray-400">
                          صفحة {invoicePage} / {totalInvoicePages} ({expandedInvoices.length} فاتورة)
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setInvoicePage(p => Math.max(1, p - 1))}
                            disabled={invoicePage <= 1}
                            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ChevronRight size={14} />
                          </button>

                          {Array.from({ length: Math.min(5, totalInvoicePages) }, (_, i) => {
                            let page: number;
                            if (totalInvoicePages <= 5) page = i + 1;
                            else if (invoicePage <= 3) page = i + 1;
                            else if (invoicePage >= totalInvoicePages - 2) page = totalInvoicePages - 4 + i;
                            else page = invoicePage - 2 + i;
                            return (
                              <button
                                key={page}
                                onClick={() => setInvoicePage(page)}
                                className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                                  invoicePage === page
                                    ? "bg-pink-600 text-white"
                                    : "text-gray-500 hover:bg-gray-100"
                                }`}
                              >
                                {page}
                              </button>
                            );
                          })}

                          <button
                            onClick={() => setInvoicePage(p => Math.min(totalInvoicePages, p + 1))}
                            disabled={invoicePage >= totalInvoicePages}
                            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ChevronLeft size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════ تقسيم صفحات الأرشيفات ══════════════ */}
      {totalArchivePages > 1 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between">
          <span className="text-sm text-gray-500 font-medium">
            صفحة {archivePage} / {totalArchivePages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setArchivePage(1)}
              disabled={archivePage <= 1}
              className="px-3 py-2 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100 disabled:opacity-30"
            >
              الأولى
            </button>
            <button
              onClick={() => setArchivePage(p => Math.max(1, p - 1))}
              disabled={archivePage <= 1}
              className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
            >
              <ChevronRight size={14} />
            </button>

            {Array.from({ length: Math.min(7, totalArchivePages) }, (_, i) => {
              let page: number;
              if (totalArchivePages <= 7) page = i + 1;
              else if (archivePage <= 4) page = i + 1;
              else if (archivePage >= totalArchivePages - 3) page = totalArchivePages - 6 + i;
              else page = archivePage - 3 + i;
              return (
                <button
                  key={page}
                  onClick={() => setArchivePage(page)}
                  className={`w-9 h-9 rounded-xl text-sm font-bold transition-colors ${
                    archivePage === page
                      ? "bg-pink-600 text-white shadow-md"
                      : "text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  {page}
                </button>
              );
            })}

            <button
              onClick={() => setArchivePage(p => Math.min(totalArchivePages, p + 1))}
              disabled={archivePage >= totalArchivePages}
              className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setArchivePage(totalArchivePages)}
              disabled={archivePage >= totalArchivePages}
              className="px-3 py-2 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100 disabled:opacity-30"
            >
              الأخيرة
            </button>
          </div>
        </div>
      )}
    </div>
  );
}