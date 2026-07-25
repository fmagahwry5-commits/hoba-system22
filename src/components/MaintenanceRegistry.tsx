import { useState, useMemo } from "react";
import { Invoice, MaintenanceStatus } from "../types";
import {
  Wrench, Search, Eye, Trash2, Phone, Minus, RefreshCw,
  AlertTriangle, X, ChevronDown, CheckCircle, Clock,
  DollarSign, TrendingUp, Download,
} from "lucide-react";
import * as XLSX from "xlsx";

interface Props {
  invoices: Invoice[];
  currency: string;
  onView: (invoice: Invoice) => void;
  onDelete: (id: string) => void;
  onWithdraw?: (amount: number, desc: string) => void;
  onReset?: () => void;
}

const STATUS_OPTIONS: { value: MaintenanceStatus | "all"; label: string; color: string; bg: string }[] = [
  { value: "all", label: "الكل", color: "text-gray-700", bg: "bg-gray-100" },
  { value: "received", label: "تم الاستلام", color: "text-gray-700", bg: "bg-gray-100" },
  { value: "diagnosing", label: "جاري الفحص", color: "text-yellow-700", bg: "bg-yellow-100" },
  { value: "waiting_parts", label: "انتظار قطع", color: "text-orange-700", bg: "bg-orange-100" },
  { value: "repairing", label: "جاري الإصلاح", color: "text-blue-700", bg: "bg-blue-100" },
  { value: "ready", label: "جاهز للتسليم", color: "text-emerald-700", bg: "bg-emerald-100" },
  { value: "delivered", label: "تم التسليم", color: "text-purple-700", bg: "bg-purple-100" },
];

function exportMaintenanceToExcel(invoices: Invoice[], currency: string) {
  const rows = invoices.map((inv, idx) => ({
    "#": idx + 1,
    "رقم الأمر": inv.number,
    "التاريخ": inv.date,
    "اسم العميل": inv.customerName || "-",
    "رقم الهاتف": inv.customerPhone || "-",
    "الجهاز": `${inv.maintenanceInfo?.deviceBrand || ""} ${inv.maintenanceInfo?.deviceModel || ""}`.trim() || "-",
    "نوع الجهاز": inv.maintenanceInfo?.deviceType || "-",
    "IMEI": inv.maintenanceInfo?.imei || "-",
    "الفني": inv.maintenanceInfo?.technician || "-",
    "الشكوى": inv.maintenanceInfo?.customerComplaint || "-",
    "التشخيص": inv.maintenanceInfo?.diagnosis || "-",
    "حالة الصيانة": {
      received: "تم الاستلام", diagnosing: "جاري الفحص",
      waiting_parts: "انتظار قطع", repairing: "جاري الإصلاح",
      ready: "جاهز للتسليم", delivered: "تم التسليم",
    }[inv.maintenanceInfo?.maintenanceStatus ?? ""] ?? "-",
    "حالة الفاتورة": inv.status === "closed" ? "مغلقة" : inv.status === "pending" ? "معلقة" : "مفتوحة",
    [`التكلفة (${currency})`]: inv.total,
    [`المدفوع (${currency})`]: inv.paid,
    [`المتبقي (${currency})`]: inv.remaining,
    [`عربون (${currency})`]: inv.maintenanceInfo?.advancePayment || 0,
    "ملاحظات": inv.notes || "-",
  }));

  rows.push({
    "#": "",
    "رقم الأمر": `الإجمالي (${invoices.length} أمر)`,
    "التاريخ": "", "اسم العميل": "", "رقم الهاتف": "",
    "الجهاز": "", "نوع الجهاز": "", "IMEI": "", "الفني": "",
    "الشكوى": "", "التشخيص": "", "حالة الصيانة": "", "حالة الفاتورة": "",
    [`التكلفة (${currency})`]: invoices.filter(i => i.status === "closed").reduce((s, i) => s + i.total, 0),
    [`المدفوع (${currency})`]: invoices.reduce((s, i) => s + i.paid, 0),
    [`المتبقي (${currency})`]: invoices.reduce((s, i) => s + i.remaining, 0),
    [`عربون (${currency})`]: invoices.reduce((s, i) => s + (i.maintenanceInfo?.advancePayment || 0), 0),
    "ملاحظات": "",
  } as any);

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 5 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 14 },
    { wch: 20 }, { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 25 },
    { wch: 25 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 20 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "سجل الصيانة");
  XLSX.writeFile(wb, `سجل_الصيانة_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export default function MaintenanceRegistry({
  invoices, currency, onView, onDelete, onWithdraw, onReset,
}: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MaintenanceStatus | "all">("all");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<"all" | "open" | "closed" | "pending">("all");
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState(0);
  const [withdrawDesc, setWithdrawDesc] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const maintenanceInvoices = useMemo(() =>
    invoices.filter((i) => i.type === "maintenance"), [invoices]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return maintenanceInvoices.filter((inv) => {
      const matchSearch = !search.trim() ||
        (inv.customerName ?? "").toLowerCase().includes(q) ||
        (inv.customerPhone ?? "").includes(search) ||
        (inv.number ?? "").toLowerCase().includes(q) ||
        (inv.maintenanceInfo?.deviceBrand ?? "").toLowerCase().includes(q) ||
        (inv.maintenanceInfo?.deviceModel ?? "").toLowerCase().includes(q) ||
        (inv.maintenanceInfo?.imei ?? "").includes(search) ||
        (inv.maintenanceInfo?.technician ?? "").toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || inv.maintenanceInfo?.maintenanceStatus === statusFilter;
      const matchInvoiceStatus = invoiceStatusFilter === "all" || inv.status === invoiceStatusFilter;
      return matchSearch && matchStatus && matchInvoiceStatus;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [maintenanceInvoices, search, statusFilter, invoiceStatusFilter]);

  const stats = useMemo(() => {
    const closed = maintenanceInvoices.filter(i => i.status === "closed");
    const pending = maintenanceInvoices.filter(i => i.status === "pending" || i.status === "open");
    const ready = maintenanceInvoices.filter(i => i.maintenanceInfo?.maintenanceStatus === "ready");
    const totalRevenue = closed.reduce((s, i) => s + (i.total ?? 0), 0);
    const totalRemaining = maintenanceInvoices.reduce((s, i) => s + (i.remaining ?? 0), 0);
    const avgRevenue = closed.length > 0 ? totalRevenue / closed.length : 0;
    return {
      totalRevenue, totalRemaining, avgRevenue,
      closedCount: closed.length, pendingCount: pending.length, readyCount: ready.length,
    };
  }, [maintenanceInvoices]);

  const handleWithdraw = () => {
    if (!withdrawAmount || withdrawAmount <= 0) return;
    onWithdraw?.(withdrawAmount, withdrawDesc || "سحب من رصيد الصيانة");
    setWithdrawAmount(0); setWithdrawDesc(""); setShowWithdrawModal(false);
  };

  const getStatusInfo = (status?: MaintenanceStatus) =>
    STATUS_OPTIONS.find(s => s.value === status) ?? STATUS_OPTIONS[0];

  return (
    <div className="space-y-5" dir="rtl">

      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-violet-800 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <Wrench size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold">سجل الصيانة</h2>
              <p className="text-violet-200 text-sm">{maintenanceInvoices.length} أمر صيانة</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* ✅ زر تصدير Excel */}
            <button
              onClick={() => exportMaintenanceToExcel(filtered, currency)}
              className="flex items-center gap-2 px-3 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-semibold transition-colors"
            >
              <Download size={15} /> Excel
            </button>
            {onWithdraw && (
              <button onClick={() => setShowWithdrawModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-semibold transition-colors">
                <Minus size={15} /> سحب
              </button>
            )}
            {onReset && (
              <button onClick={onReset}
                className="flex items-center gap-2 px-3 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-semibold transition-colors">
                <RefreshCw size={15} /> تصفير
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "إيرادات الصيانة", value: stats.totalRevenue.toLocaleString(), unit: currency },
            { label: "المتبقي", value: stats.totalRemaining.toLocaleString(), unit: currency },
            { label: "متوسط الأمر", value: Math.round(stats.avgRevenue).toLocaleString(), unit: currency },
            { label: "مغلقة / قيد التنفيذ", value: `${stats.closedCount} / ${stats.pendingCount}`, unit: "أمر" },
          ].map((s) => (
            <div key={s.label} className="bg-white/15 rounded-xl p-3 text-center">
              <div className="text-xs opacity-75 mb-1">{s.label}</div>
              <div className="text-lg font-bold">{s.value}</div>
              <div className="text-xs opacity-60">{s.unit}</div>
            </div>
          ))}
        </div>
      </div>

      {/* بطاقات إحصائية */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "إجمالي الأوامر", value: maintenanceInvoices.length, unit: "أمر", icon: Wrench, bg: "bg-violet-50", border: "border-violet-100", text: "text-violet-700" },
          { label: "إيرادات الصيانة", value: stats.totalRevenue.toLocaleString(), unit: currency, icon: TrendingUp, bg: "bg-emerald-50", border: "border-emerald-100", text: "text-emerald-700" },
          { label: "جاهز للتسليم", value: stats.readyCount, unit: "أمر", icon: CheckCircle, bg: "bg-blue-50", border: "border-blue-100", text: "text-blue-700" },
          { label: "قيد التنفيذ", value: stats.pendingCount, unit: "أمر", icon: Clock, bg: "bg-orange-50", border: "border-orange-100", text: "text-orange-700" },
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

      {/* فلاتر */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <button key={opt.value} onClick={() => setStatusFilter(opt.value as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border-2 ${statusFilter === opt.value ? `${opt.bg} ${opt.color} border-current` : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}>
              {opt.label}
              {opt.value !== "all" && (
                <span className="mr-1 opacity-60">
                  ({maintenanceInvoices.filter(i => i.maintenanceInfo?.maintenanceStatus === opt.value).length})
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap">
          <span className="text-xs text-gray-400 self-center font-semibold">حالة الفاتورة:</span>
          {[
            { val: "all", label: "الكل" },
            { val: "closed", label: "مغلقة" },
            { val: "pending", label: "معلقة" },
            { val: "open", label: "مفتوحة" },
          ].map((f) => (
            <button key={f.val} onClick={() => setInvoiceStatusFilter(f.val as any)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${invoiceStatusFilter === f.val ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم أو الهاتف أو الجهاز أو IMEI أو الفني..."
              className="w-full pr-9 pl-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
            {search && (
              <button onClick={() => setSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
          {/* ✅ زر تصدير المفلتر */}
          <button
            onClick={() => exportMaintenanceToExcel(filtered, currency)}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-semibold hover:bg-emerald-100 transition-colors whitespace-nowrap"
          >
            <Download size={13} /> تصدير ({filtered.length})
          </button>
        </div>
      </div>

      {/* قائمة الصيانة */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center text-gray-400 bg-white rounded-2xl border border-gray-100">
          <Wrench size={48} className="mx-auto mb-3 opacity-20" />
          <div className="font-medium">لا توجد أوامر صيانة</div>
          {search && <div className="text-sm mt-1">جرّب البحث بكلمة مختلفة</div>}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((inv) => {
            const info = inv.maintenanceInfo;
            const statusInfo = getStatusInfo(info?.maintenanceStatus);
            const isExpanded = expandedId === inv.id;
            const invoiceStatusColors: Record<string, string> = {
              closed: "bg-emerald-100 text-emerald-700",
              pending: "bg-orange-100 text-orange-700",
              open: "bg-yellow-100 text-yellow-700",
            };

            return (
              <div key={inv.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-4 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : inv.id)}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${statusInfo.bg}`}>
                        <Wrench size={18} className={statusInfo.color} />
                      </div>
                      <div>
                        <div className="font-bold text-gray-800">{inv.customerName || "عميل غير محدد"}</div>
                        <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                          <Phone size={10} />{inv.customerPhone || "-"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="font-mono text-xs text-gray-400">{inv.number}</div>
                        <div className="text-xs text-gray-400">{inv.date}</div>
                      </div>
                      <ChevronDown size={16} className={`text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                    {[
                      { label: "الجهاز", value: `${info?.deviceBrand || "-"} ${info?.deviceModel || ""}` },
                      { label: "النوع", value: info?.deviceType || "-" },
                      { label: "الفني", value: info?.technician || "-" },
                      { label: "التكلفة", value: `${(inv.total ?? 0).toLocaleString()} ${currency}`, color: "text-violet-700 font-bold" },
                    ].map((f) => (
                      <div key={f.label} className="bg-gray-50 rounded-xl px-3 py-2">
                        <div className="text-xs text-gray-400">{f.label}</div>
                        <div className={`text-sm font-semibold ${f.color ?? "text-gray-700"}`}>{f.value}</div>
                      </div>
                    ))}
                  </div>

                  {info?.customerComplaint && (
                    <div className="bg-orange-50 border border-orange-100 rounded-xl px-3 py-2 mb-3 text-xs text-orange-700">
                      <span className="font-bold">الشكوى: </span>{info.customerComplaint}
                    </div>
                  )}

                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2.5 py-1 rounded-xl text-xs font-bold ${statusInfo.bg} ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                      <span className={`px-2.5 py-1 rounded-xl text-xs font-bold ${invoiceStatusColors[inv.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {inv.status === "closed" ? "مغلقة ✓" : inv.status === "pending" ? "معلقة ⏳" : "مفتوحة"}
                      </span>
                      {(inv.remaining ?? 0) > 0 && (
                        <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-xl text-xs font-bold">
                          باقي: {inv.remaining.toLocaleString()} {currency}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                      <button onClick={() => onView(inv)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 text-violet-700 rounded-xl text-xs font-semibold hover:bg-violet-100 transition-colors">
                        <Eye size={13} /> تعديل
                      </button>
                      <button onClick={() => { if (window.confirm("حذف هذا الأمر؟")) onDelete(inv.id); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-xl text-xs font-semibold hover:bg-red-100 transition-colors">
                        <Trash2 size={13} /> حذف
                      </button>
                    </div>
                  </div>
                </div>

                {/* التفاصيل الموسعة */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 bg-violet-50/30 space-y-3">
                    <h4 className="text-xs font-bold text-violet-700 mb-2">تفاصيل الصيانة الكاملة</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[
                        { label: "IMEI / السيريال", value: info?.imei || "-" },
                        { label: "اللون", value: info?.color || "-" },
                        { label: "الملحقات", value: info?.accessories || "-" },
                        { label: "تاريخ الاستلام", value: info?.receivedAt || inv.date },
                        { label: "ضمان", value: info?.warrantyDays ? `${info.warrantyDays} يوم` : "-" },
                        { label: "التشخيص", value: info?.diagnosis || "-" },
                      ].map((f) => (
                        <div key={f.label} className="bg-white rounded-xl px-3 py-2 border border-violet-100">
                          <div className="text-xs text-gray-400 mb-0.5">{f.label}</div>
                          <div className="text-sm font-semibold text-gray-700">{f.value}</div>
                        </div>
                      ))}
                    </div>

                    {inv.notes && (
                      <div className="bg-white rounded-xl px-3 py-2 border border-violet-100">
                        <div className="text-xs text-gray-400 mb-0.5">ملاحظات</div>
                        <div className="text-sm text-gray-700">{inv.notes}</div>
                      </div>
                    )}

                    <div className="bg-white rounded-xl p-3 border border-violet-100">
                      <div className="text-xs font-bold text-gray-600 mb-2">الملخص المالي</div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        {[
                          { label: "الإجمالي", value: inv.total, color: "text-violet-700" },
                          { label: "المدفوع", value: inv.paid, color: "text-emerald-700" },
                          { label: "المتبقي", value: inv.remaining, color: inv.remaining > 0 ? "text-red-700" : "text-emerald-700" },
                        ].map((f) => (
                          <div key={f.label}>
                            <div className="text-xs text-gray-400">{f.label}</div>
                            <div className={`text-sm font-bold ${f.color}`}>{f.value.toLocaleString()} {currency}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* نافذة سحب */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                <AlertTriangle size={20} className="text-orange-500" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">سحب من رصيد الصيانة</h3>
                <p className="text-xs text-gray-400">الرصيد المتاح: {stats.totalRevenue.toLocaleString()} {currency}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-600 mb-1 block font-medium">المبلغ *</label>
                <input type="number" min="1" value={withdrawAmount || ""}
                  onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                  className="w-full border-2 border-orange-200 rounded-xl px-3 py-3 text-xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-orange-300"
                  placeholder="0.00" autoFocus />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block font-medium">السبب</label>
                <input type="text" value={withdrawDesc} onChange={(e) => setWithdrawDesc(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                  placeholder="سبب السحب" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={handleWithdraw} disabled={!withdrawAmount || withdrawAmount <= 0}
                className="flex-1 py-2.5 bg-orange-600 text-white rounded-xl font-semibold hover:bg-orange-700 disabled:opacity-50 active:scale-95 transition-all">
                تأكيد السحب
              </button>
              <button onClick={() => setShowWithdrawModal(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}