// src/components/InvoiceArchive.tsx
import { useState, useMemo } from "react";
import {
  FolderOpen, Search, X, Filter, Calendar, Eye, Edit3,
  ShoppingCart, Package, Wrench, RotateCcw,
  ShoppingBag, ChevronDown, ChevronUp,
  FileText, Clock, CheckCircle, XCircle,
} from "lucide-react";
import { Invoice } from "../types";

interface ShiftArchiveLocal {
  id: string;
  closedAt: string;
  openedAt?: string;
  invoices?: Invoice[];
  installments?: any[];
}

interface Props {
  invoices: Invoice[];
  archives: ShiftArchiveLocal[];
  currency: string;
  onViewInvoice: (invoice: Invoice) => void;
  onEditInvoice: (invoice: Invoice) => void;
}

type FilterType =
  | "all" | "sale" | "purchase" | "return_sale" | "return_purchase"
  | "maintenance" | "accessory_sale" | "accessory_purchase";

type FilterStatus = "all" | "closed" | "pending" | "open" | "cancelled";
type FilterSource = "all" | "current" | "archived";

interface EnrichedInvoice extends Invoice {
  _source: "current" | "archived";
  _shiftLabel: string;
  _shiftId: string;
  _rowKey: string;
  archivedShiftId?: string;
}

// ============================
// Config
// ============================
const typeConfig: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  sale:               { label: "مبيعات",        icon: ShoppingCart, color: "text-blue-700",   bg: "bg-blue-100" },
  purchase:           { label: "مشتريات",        icon: Package,      color: "text-green-700",  bg: "bg-green-100" },
  return_sale:        { label: "مرتجع بيع",      icon: RotateCcw,    color: "text-orange-700", bg: "bg-orange-100" },
  return_purchase:    { label: "مرتجع شراء",     icon: RotateCcw,    color: "text-purple-700", bg: "bg-purple-100" },
  maintenance:        { label: "صيانة",           icon: Wrench,       color: "text-violet-700", bg: "bg-violet-100" },
  accessory_sale:     { label: "بيع اكسسوار",    icon: ShoppingBag,  color: "text-amber-700",  bg: "bg-amber-100" },
  accessory_purchase: { label: "شراء اكسسوار",   icon: ShoppingBag,  color: "text-teal-700",   bg: "bg-teal-100" },
};

const defaultTypeConfig = { label: "فاتورة", icon: FileText, color: "text-gray-700", bg: "bg-gray-100" };

const statusConfig: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  closed:    { label: "مغلقة",   icon: CheckCircle, color: "text-green-700",  bg: "bg-green-100" },
  pending:   { label: "معلقة",   icon: Clock,       color: "text-yellow-700", bg: "bg-yellow-100" },
  open:      { label: "مفتوحة",  icon: FileText,    color: "text-blue-700",   bg: "bg-blue-100" },
  cancelled: { label: "ملغية",   icon: XCircle,     color: "text-red-700",    bg: "bg-red-100" },
};

const defaultStatusConfig = { label: "مفتوحة", icon: FileText, color: "text-gray-700", bg: "bg-gray-100" };

function parseArabicDate(dateStr: string): string | null {
  try {
    if (!dateStr || typeof dateStr !== "string") return null;
    const trimmed = dateStr.trim();
    if (!trimmed) return null;
    const parts = trimmed.split(/[/\-\.\s]/);
    if (parts.length >= 3) {
      const p0 = parts[0].padStart(2, "0");
      const p1 = parts[1].padStart(2, "0");
      const p2 = parts[2].length === 4 ? parts[2] : `20${parts[2]}`;
      return `${p2}-${p1}-${p0}`;
    }
    return trimmed;
  } catch {
    return null;
  }
}

// ============================
// Main Component
// ============================
export default function InvoiceArchive({
  invoices,
  archives,
  currency,
  onViewInvoice,
  onEditInvoice,
}: Props) {
  // ✅ تأمين فوري لجميع البيانات الواردة
  const safeInvoices  = Array.isArray(invoices) ? invoices : [];
  const safeArchives  = Array.isArray(archives) ? archives : [];

  const [searchQuery, setSearchQuery]   = useState("");
  const [filterType, setFilterType]     = useState<FilterType>("all");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterSource, setFilterSource] = useState<FilterSource>("all");
  const [dateFrom, setDateFrom]         = useState("");
  const [dateTo, setDateTo]             = useState("");
  const [showFilters, setShowFilters]   = useState(false);
  const [sortBy, setSortBy]             = useState<"date" | "total" | "number">("date");
  const [sortDir, setSortDir]           = useState<"asc" | "desc">("desc");
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [expandedKey, setExpandedKey]   = useState<string | null>(null);

  // ✅ بناء قائمة الفواتير الشاملة
  const allInvoices = useMemo((): EnrichedInvoice[] => {
    const currentInvoices: EnrichedInvoice[] = safeInvoices.map((inv) => ({
      ...inv,
      _source:    "current" as const,
      _shiftLabel: "الوردية الحالية",
      _shiftId:   "",
      _rowKey:    `current--${inv.id ?? Math.random()}`,
    }));

    const archivedInvoices: EnrichedInvoice[] = safeArchives.flatMap((archive) => {
      if (!archive || !archive.id) return [];
      const archiveInvoices = Array.isArray(archive.invoices) ? archive.invoices : [];
      return archiveInvoices.map((inv) => ({
        ...inv,
        _source:        "archived" as const,
        _shiftLabel:    `وردية #${archive.id.slice(-6)} (${archive.closedAt ?? ""})`,
        _shiftId:       archive.id,
        _rowKey:        `archived-${archive.id}-${inv.id ?? Math.random()}`,
        archivedShiftId: archive.id,
      }));
    });

    return [...currentInvoices, ...archivedInvoices];
  }, [safeInvoices, safeArchives]);

  // ✅ فلترة وبحث
  const filteredInvoices = useMemo((): EnrichedInvoice[] => {
    let result = [...allInvoices];

    if (filterSource === "current") {
      result = result.filter((i) => i._source === "current");
    } else if (filterSource === "archived") {
      result = result.filter((i) => i._source === "archived");
    }

    if (filterType !== "all") {
      result = result.filter((i) => i.type === filterType);
    }

    if (filterStatus !== "all") {
      result = result.filter((i) => i.status === filterStatus);
    }

    if (dateFrom) {
      result = result.filter((i) => {
        const d = parseArabicDate(i.date ?? "");
        return d !== null && d >= dateFrom;
      });
    }

    if (dateTo) {
      result = result.filter((i) => {
        const d = parseArabicDate(i.date ?? "");
        return d !== null && d <= dateTo;
      });
    }

    if (searchQuery.trim().length >= 2) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (inv) =>
          inv.number?.toLowerCase().includes(q) ||
          inv.customerName?.toLowerCase().includes(q) ||
          inv.customerPhone?.includes(q) ||
          inv.supplierName?.toLowerCase().includes(q) ||
          inv.supplierPhone?.includes(q) ||
          inv.date?.includes(q) ||
          inv.notes?.toLowerCase().includes(q) ||
          inv.items?.some(
            (item) =>
              item.productName?.toLowerCase().includes(q) ||
              item.barcode?.includes(q)
          ) ||
          inv.maintenanceInfo?.imei?.includes(q) ||
          inv.maintenanceInfo?.deviceBrand?.toLowerCase().includes(q) ||
          inv.maintenanceInfo?.deviceModel?.toLowerCase().includes(q) ||
          inv.maintenanceInfo?.technician?.toLowerCase().includes(q) ||
          inv._shiftLabel?.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "date":
          cmp = (a.date ?? "").localeCompare(b.date ?? "");
          break;
        case "total":
          cmp = (a.total ?? 0) - (b.total ?? 0);
          break;
        case "number":
          cmp = (a.number ?? "").localeCompare(b.number ?? "");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [
    allInvoices, searchQuery, filterType, filterStatus,
    filterSource, dateFrom, dateTo, sortBy, sortDir,
  ]);

  // ✅ إحصائيات
  const stats = useMemo(() => {
    const total = filteredInvoices.reduce((s, i) => s + (i.total ?? 0), 0);
    const byType: Record<string, { count: number; total: number }> = {};
    filteredInvoices.forEach((inv) => {
      if (!inv.type) return;
      if (!byType[inv.type]) byType[inv.type] = { count: 0, total: 0 };
      byType[inv.type].count++;
      byType[inv.type].total += inv.total ?? 0;
    });
    return { total, byType, count: filteredInvoices.length };
  }, [filteredInvoices]);

  function toggleSelect(rowKey: string) {
    setSelectedInvoices((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  }

  function selectAll() {
    if (selectedInvoices.size === filteredInvoices.length) {
      setSelectedInvoices(new Set());
    } else {
      setSelectedInvoices(new Set(filteredInvoices.map((i) => i._rowKey)));
    }
  }

  const clearFilters = () => {
    setSearchQuery("");
    setFilterType("all");
    setFilterStatus("all");
    setFilterSource("all");
    setDateFrom("");
    setDateTo("");
  };

  const hasActiveFilters =
    filterType !== "all" ||
    filterStatus !== "all" ||
    filterSource !== "all" ||
    dateFrom.length > 0 ||
    dateTo.length > 0 ||
    searchQuery.trim().length >= 2;

  // ============================
  // JSX
  // ============================
  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <FolderOpen size={22} className="text-teal-600" />
              أرشيف الفواتير الشامل
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              جميع الفواتير من الوردية الحالية و {safeArchives.length} وردية
              مؤرشفة — إجمالي {allInvoices.length} فاتورة
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                showFilters || hasActiveFilters
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <Filter size={14} />
              فلاتر متقدمة
              {hasActiveFilters && (
                <span className="bg-white/30 text-xs px-1.5 py-0.5 rounded-full">!</span>
              )}
            </button>
          </div>
        </div>

        {/* البحث */}
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 border-2 border-gray-200 rounded-xl px-4 py-3 focus-within:border-blue-400 transition-colors bg-gray-50">
            <Search size={18} className="text-gray-400 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث شامل: رقم الفاتورة، اسم العميل، المورد، المنتج، الباركود، IMEI، الوردية..."
              className="flex-1 bg-transparent outline-none text-sm text-gray-700 placeholder-gray-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* الفلاتر المتقدمة */}
        {showFilters && (
          <div className="mt-4 bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

              {/* المصدر */}
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">المصدر</label>
                <select
                  value={filterSource}
                  onChange={(e) => setFilterSource(e.target.value as FilterSource)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white outline-none"
                >
                  <option value="all">الكل</option>
                  <option value="current">الوردية الحالية</option>
                  <option value="archived">الورديات المؤرشفة</option>
                </select>
              </div>

              {/* النوع */}
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">النوع</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as FilterType)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white outline-none"
                >
                  <option value="all">جميع الأنواع</option>
                  <option value="sale">مبيعات</option>
                  <option value="purchase">مشتريات</option>
                  <option value="return_sale">مرتجع بيع</option>
                  <option value="return_purchase">مرتجع شراء</option>
                  <option value="maintenance">صيانة</option>
                  <option value="accessory_sale">بيع اكسسوار</option>
                  <option value="accessory_purchase">شراء اكسسوار</option>
                </select>
              </div>

              {/* الحالة */}
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">الحالة</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white outline-none"
                >
                  <option value="all">جميع الحالات</option>
                  <option value="closed">مغلقة</option>
                  <option value="pending">معلقة</option>
                  <option value="open">مفتوحة</option>
                  <option value="cancelled">ملغية</option>
                </select>
              </div>

              {/* الترتيب */}
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">ترتيب حسب</label>
                <div className="flex gap-1">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as "date" | "total" | "number")}
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white outline-none"
                  >
                    <option value="date">التاريخ</option>
                    <option value="total">المبلغ</option>
                    <option value="number">الرقم</option>
                  </select>
                  <button
                    onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                    className="px-3 py-2.5 border border-gray-200 rounded-xl bg-white text-gray-600 hover:bg-gray-50"
                  >
                    {sortDir === "asc" ? "↑" : "↓"}
                  </button>
                </div>
              </div>
            </div>

            {/* تاريخ من/إلى */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">
                  <Calendar size={12} className="inline ml-1" />
                  من تاريخ
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">
                  <Calendar size={12} className="inline ml-1" />
                  إلى تاريخ
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white outline-none"
                />
              </div>
            </div>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-red-600 font-bold hover:underline flex items-center gap-1"
              >
                <X size={12} /> مسح جميع الفلاتر
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── إحصائيات سريعة ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {Object.entries(stats.byType).map(([type, data]) => {
          const cfg = typeConfig[type];
          if (!cfg) return null;
          return (
            <button
              key={type}
              onClick={() =>
                setFilterType(filterType === type ? "all" : (type as FilterType))
              }
              className={`rounded-xl p-2.5 text-center transition-all ${
                filterType === type
                  ? `${cfg.bg} ring-2 ring-offset-1 ring-blue-400`
                  : "bg-white border border-gray-100 hover:shadow-sm"
              }`}
            >
              <cfg.icon size={14} className={`mx-auto ${cfg.color} mb-1`} />
              <div className="text-[10px] font-semibold text-gray-500">{cfg.label}</div>
              <div className="text-sm font-black text-gray-800">{data.count}</div>
              <div className="text-[10px] text-gray-400">{data.total.toLocaleString()}</div>
            </button>
          );
        })}

        {/* إجمالي */}
        <div className="rounded-xl p-2.5 text-center bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200">
          <FileText size={14} className="mx-auto text-blue-600 mb-1" />
          <div className="text-[10px] font-semibold text-blue-500">الإجمالي</div>
          <div className="text-sm font-black text-blue-800">{stats.count}</div>
          <div className="text-[10px] text-blue-400">
            {stats.total.toLocaleString()} {currency}
          </div>
        </div>
      </div>

      {/* ── قائمة الفواتير ── */}
      {filteredInvoices.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center">
          <Search size={48} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-400 font-semibold text-lg">لا توجد فواتير مطابقة</p>
          <p className="text-gray-300 text-sm mt-1">جرب تغيير كلمة البحث أو الفلاتر</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

          {/* Table Header */}
          <div className="bg-gray-50 px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={
                    selectedInvoices.size === filteredInvoices.length &&
                    filteredInvoices.length > 0
                  }
                  onChange={selectAll}
                  className="w-4 h-4 rounded accent-blue-600"
                />
                <span className="text-xs font-bold text-gray-500">
                  تحديد الكل ({filteredInvoices.length})
                </span>
              </label>
              {selectedInvoices.size > 0 && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-lg font-bold">
                  {selectedInvoices.size} محدد
                </span>
              )}
            </div>
            <div className="text-xs text-gray-400">
              إجمالي:{" "}
              <span className="font-bold text-gray-700">
                {stats.total.toLocaleString()} {currency}
              </span>
            </div>
          </div>

          {/* Invoices List */}
          <div className="divide-y divide-gray-50 max-h-[70vh] overflow-y-auto">
            {filteredInvoices.map((inv) => {
              const cfg    = typeConfig[inv.type]    ?? defaultTypeConfig;
              const stCfg  = statusConfig[inv.status] ?? defaultStatusConfig;
              const isExpanded = expandedKey === inv._rowKey;
              const isArchived = inv._source === "archived";

              return (
                <div
                  key={inv._rowKey}
                  className={`transition-colors ${isArchived ? "bg-gray-50/50" : ""}`}
                >
                  {/* صف الفاتورة */}
                  <div className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={selectedInvoices.has(inv._rowKey)}
                      onChange={() => toggleSelect(inv._rowKey)}
                      className="w-4 h-4 rounded accent-blue-600 flex-shrink-0"
                    />

                    {/* معلومات */}
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() =>
                        setExpandedKey(isExpanded ? null : inv._rowKey)
                      }
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${cfg.bg} ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${stCfg.bg} ${stCfg.color}`}>
                          {stCfg.label}
                        </span>
                        <span className="font-bold text-sm text-gray-800">
                          {inv.number}
                        </span>
                        {isArchived && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 font-semibold">
                            📁 مؤرشفة
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                        <span>{inv.customerName || inv.supplierName || "-"}</span>
                        {(inv.customerPhone || inv.supplierPhone) && (
                          <span>📞 {inv.customerPhone || inv.supplierPhone}</span>
                        )}
                        <span>📅 {inv.date ?? "-"}</span>
                        {inv.time && <span>🕐 {inv.time}</span>}
                        {isArchived && (
                          <span className="text-pink-400">{inv._shiftLabel}</span>
                        )}
                      </div>
                    </div>

                    {/* القيم والأزرار */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="text-left">
                        <div className="text-sm font-bold text-gray-800">
                          {(inv.total ?? 0).toLocaleString()} {currency}
                        </div>
                        {(inv.remaining ?? 0) > 0 && (
                          <div className="text-xs text-red-500 font-semibold">
                            متبقي: {(inv.remaining ?? 0).toLocaleString()}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => onEditInvoice(inv)}
                        className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                        title="تعديل"
                      >
                        <Edit3 size={14} />
                      </button>

                      <button
                        onClick={() => onViewInvoice(inv)}
                        className="p-2 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors"
                        title="عرض"
                      >
                        <Eye size={14} />
                      </button>

                      <button
                        onClick={() =>
                          setExpandedKey(isExpanded ? null : inv._rowKey)
                        }
                        className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* تفاصيل موسعة */}
                  {isExpanded && (
                    <div className="px-5 pb-4 bg-gray-50/80">
                      <div className="bg-white rounded-xl p-4 border border-gray-100 space-y-3">

                        {/* أرقام الفاتورة */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                          <div>
                            <span className="text-xs text-gray-400 block">الإجمالي الفرعي</span>
                            <span className="font-bold">
                              {(inv.subtotal ?? 0).toLocaleString()} {currency}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs text-gray-400 block">الخصم</span>
                            <span className="font-bold text-orange-600">
                              {(inv.discount ?? 0).toLocaleString()} {currency}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs text-gray-400 block">المدفوع</span>
                            <span className="font-bold text-green-600">
                              {(inv.paid ?? 0).toLocaleString()} {currency}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs text-gray-400 block">المتبقي</span>
                            <span className={`font-bold ${(inv.remaining ?? 0) > 0 ? "text-red-600" : "text-green-600"}`}>
                              {(inv.remaining ?? 0).toLocaleString()} {currency}
                            </span>
                          </div>
                        </div>

                        {/* منتجات الفاتورة */}
                        {Array.isArray(inv.items) && inv.items.length > 0 && (
                          <div>
                            <h4 className="text-xs font-bold text-gray-500 mb-2">📦 المنتجات:</h4>
                            <div className="space-y-1">
                              {inv.items.map((item, idx) => (
                                <div
                                  key={`${inv._rowKey}-item-${idx}`}
                                  className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm"
                                >
                                  <div>
                                    <span className="font-semibold">{item.productName}</span>
                                    {item.barcode && (
                                      <span className="text-xs text-gray-400 mr-2">
                                        ({item.barcode})
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-gray-500">
                                    <span>
                                      {item.quantity ?? 0} × {(item.unitPrice ?? 0).toLocaleString()}
                                    </span>
                                    <span className="font-bold text-gray-700">
                                      {(item.total ?? 0).toLocaleString()} {currency}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* معلومات الصيانة */}
                        {inv.maintenanceInfo && (
                          <div>
                            <h4 className="text-xs font-bold text-gray-500 mb-2">🔧 معلومات الصيانة:</h4>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div className="bg-gray-50 rounded-lg px-3 py-2">
                                <span className="text-xs text-gray-400">الجهاز: </span>
                                <span className="font-semibold">
                                  {inv.maintenanceInfo.deviceBrand ?? ""}{" "}
                                  {inv.maintenanceInfo.deviceModel ?? ""}
                                </span>
                              </div>
                              {inv.maintenanceInfo.imei && (
                                <div className="bg-gray-50 rounded-lg px-3 py-2">
                                  <span className="text-xs text-gray-400">IMEI: </span>
                                  <span className="font-mono text-xs">{inv.maintenanceInfo.imei}</span>
                                </div>
                              )}
                              <div className="bg-gray-50 rounded-lg px-3 py-2">
                                <span className="text-xs text-gray-400">العطل: </span>
                                <span>{inv.maintenanceInfo.issueDescription ?? "-"}</span>
                              </div>
                              {inv.maintenanceInfo.technician && (
                                <div className="bg-gray-50 rounded-lg px-3 py-2">
                                  <span className="text-xs text-gray-400">الفني: </span>
                                  <span>{inv.maintenanceInfo.technician}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* ملاحظات */}
                        {inv.notes && (
                          <div className="bg-yellow-50 rounded-lg p-3 text-sm text-yellow-800">
                            <span className="text-xs font-bold">📝 ملاحظات: </span>
                            {inv.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}