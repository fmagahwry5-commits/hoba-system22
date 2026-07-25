// components/CustomersLedger.tsx
import { useState, useMemo, useCallback } from "react";
import { AppState, Invoice, InstallmentPayment } from "../types";
import {
  Search, User, Phone, Eye, X, ChevronDown, ChevronUp,
  Wrench, DollarSign, TrendingUp, TrendingDown, RotateCcw,
  Filter, Package, Download,
} from "lucide-react";
import * as XLSX from "xlsx";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface Props {
  state: AppState;
  currency: string;
  onEditInvoice?: (invoice: Invoice) => void;
}

interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  invoices: Invoice[];
  installments: InstallmentPayment[];
  totalSales: number;
  totalPurchases: number;
  totalMaintenance: number;
  totalReturnSales: number;
  totalReturnPurchases: number;
  totalInstallments: number;
  totalRemaining: number;
  lastActivity: string;
}

// ✅ أنواع صريحة بدلاً من string عام
type FilterType = "all" | "sale" | "purchase" | "maintenance" | "return_sale" | "return_purchase";
type FilterStatus = "all" | "closed" | "pending" | "open";
type SortBy = "activity" | "name" | "sales" | "remaining";
type ActiveTab = "invoices" | "installments";

// ─────────────────────────────────────────────
// Constants - خارج الكومبوننت لمنع إعادة الإنشاء
// ─────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  sale: "مبيعات",
  purchase: "مشتريات",
  return_sale: "مرتجع مبيعات",
  return_purchase: "مرتجع مشتريات",
  maintenance: "صيانة",
};

const TYPE_COLOR: Record<string, string> = {
  sale: "bg-blue-100 text-blue-700",
  purchase: "bg-green-100 text-green-700",
  return_sale: "bg-orange-100 text-orange-700",
  return_purchase: "bg-purple-100 text-purple-700",
  maintenance: "bg-violet-100 text-violet-700",
};

const TYPE_GRADIENT: Record<string, string> = {
  sale: "from-blue-600 to-blue-700",
  purchase: "from-green-600 to-green-700",
  return_sale: "from-orange-500 to-orange-600",
  return_purchase: "from-purple-600 to-purple-700",
  maintenance: "from-violet-600 to-violet-700",
};

// ✅ Icon كمكون بدلاً من JSX.Element في Record
const TypeIcon: React.FC<{ type: string }> = ({ type }) => {
  switch (type) {
    case "sale":    return <TrendingUp size={12} />;
    case "purchase": return <TrendingDown size={12} />;
    case "return_sale":
    case "return_purchase": return <RotateCcw size={12} />;
    case "maintenance": return <Wrench size={12} />;
    default: return null;
  }
};

// ─────────────────────────────────────────────
// buildCustomerRecords
// ─────────────────────────────────────────────

function buildCustomerRecords(state: AppState): CustomerRecord[] {
  const map = new Map<string, CustomerRecord>();

  // ✅ إرجاع null بدلاً من "" لمنع دمج عملاء بدون بيانات
  const getKey = (name: string, phone: string): string | null => {
    const cleanPhone = (phone ?? "").trim();
    const cleanName  = (name  ?? "").trim().toLowerCase();
    return cleanPhone || cleanName || null;
  };

  const allInvoices: Invoice[] = [
    ...(state.invoices ?? []),
    ...(state.shiftArchives ?? []).flatMap((a) => a.invoices ?? []),
  ];

  const seenInvoiceIds = new Set<string>();

  allInvoices.forEach((inv) => {
    // ✅ تجنب الفواتير المكررة من الأرشيف
    if (seenInvoiceIds.has(inv.id)) return;
    seenInvoiceIds.add(inv.id);

    const isSaleType =
      inv.type === "sale" ||
      inv.type === "return_sale" ||
      inv.type === "maintenance";

    const name  = isSaleType ? (inv.customerName  ?? "") : (inv.supplierName  ?? "");
    const phone = isSaleType ? (inv.customerPhone ?? "") : (inv.supplierPhone ?? "");
    const key   = getKey(name, phone);
    if (!key) return;

    if (!map.has(key)) {
      map.set(key, {
        id: key,
        name: name || phone,
        phone,
        invoices: [],
        installments: [],
        totalSales: 0,
        totalPurchases: 0,
        totalMaintenance: 0,
        totalReturnSales: 0,
        totalReturnPurchases: 0,
        totalInstallments: 0,
        totalRemaining: 0,
        lastActivity: inv.date ?? "",
      });
    }

    const rec = map.get(key)!;
    rec.invoices.push(inv);

    if (inv.status === "closed") {
      if      (inv.type === "sale")            rec.totalSales           += inv.total ?? 0;
      else if (inv.type === "purchase")        rec.totalPurchases       += inv.total ?? 0;
      else if (inv.type === "maintenance")     rec.totalMaintenance     += inv.total ?? 0;
      else if (inv.type === "return_sale")     rec.totalReturnSales     += inv.total ?? 0;
      else if (inv.type === "return_purchase") rec.totalReturnPurchases += inv.total ?? 0;
    }

    rec.totalRemaining += inv.remaining ?? 0;
    if ((inv.date ?? "") > rec.lastActivity) rec.lastActivity = inv.date ?? "";
  });

  // ✅ معالجة الأقساط مع تجنب التكرار
  const allInstallments: InstallmentPayment[] = [
    ...(state.installmentsLedger?.payments ?? []),
    ...(state.shiftArchives ?? []).flatMap((a) => a.installments ?? []),
  ];

  const seenInstallmentIds = new Set<string>();

  allInstallments.forEach((p) => {
    if (seenInstallmentIds.has(p.id)) return;
    seenInstallmentIds.add(p.id);

    const key = getKey(p.customerName ?? "", p.customerPhone ?? "");
    if (!key) return;

    if (!map.has(key)) {
      map.set(key, {
        id: key,
        name: p.customerName || p.customerPhone || key,
        phone: p.customerPhone ?? "",
        invoices: [],
        installments: [],
        totalSales: 0,
        totalPurchases: 0,
        totalMaintenance: 0,
        totalReturnSales: 0,
        totalReturnPurchases: 0,
        totalInstallments: 0,
        totalRemaining: 0,
        lastActivity: p.date ?? "",
      });
    }

    const rec = map.get(key)!;
    rec.installments.push(p);
    rec.totalInstallments += p.amount ?? 0;
    if ((p.date ?? "") > rec.lastActivity) rec.lastActivity = p.date ?? "";
  });

  return Array.from(map.values()).sort((a, b) =>
    b.lastActivity.localeCompare(a.lastActivity)
  );
}

// ─────────────────────────────────────────────
// Export Helpers
// ─────────────────────────────────────────────

function exportCustomerToExcel(rec: CustomerRecord, currency: string): void {
  const wb = XLSX.utils.book_new();

  if (rec.invoices.length > 0) {
    const invoiceRows = rec.invoices.map((inv, idx) => ({
      "#": idx + 1,
      "رقم الفاتورة": inv.number ?? "-",
      "النوع": TYPE_LABEL[inv.type] ?? inv.type,
      "الحالة":
        inv.status === "closed"  ? "مغلقة"  :
        inv.status === "pending" ? "معلقة"  : "مفتوحة",
      "التاريخ": inv.date ?? "-",
      [`الإجمالي (${currency})`]: inv.total   ?? 0,
      [`المدفوع (${currency})`]:  inv.paid    ?? 0,
      [`المتبقي (${currency})`]:  inv.remaining ?? 0,
      "ملاحظات": inv.notes || "-",
    }));
    const ws1 = XLSX.utils.json_to_sheet(invoiceRows);
    ws1["!cols"] = [
      { wch: 5 }, { wch: 15 }, { wch: 18 }, { wch: 10 },
      { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(wb, ws1, "الفواتير");
  }

  if (rec.installments.length > 0) {
    const installRows = rec.installments.map((p, idx) => ({
      "#": idx + 1,
      "التاريخ": p.date ?? "-",
      "الوقت":   p.time ?? "-",
      [`المبلغ (${currency})`]: p.amount ?? 0,
      "رقم الفاتورة": p.invoiceRef || "-",
      "ملاحظات":   p.notes || "-",
    }));
    const ws2 = XLSX.utils.json_to_sheet(installRows);
    ws2["!cols"] = [
      { wch: 5 }, { wch: 12 }, { wch: 10 },
      { wch: 15 }, { wch: 15 }, { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(wb, ws2, "الأقساط");
  }

  const summaryRows = [
    { "البند": "إجمالي المبيعات",      [`القيمة (${currency})`]: rec.totalSales },
    { "البند": "إجمالي المشتريات",     [`القيمة (${currency})`]: rec.totalPurchases },
    { "البند": "إجمالي الصيانة",       [`القيمة (${currency})`]: rec.totalMaintenance },
    { "البند": "مرتجع مبيعات",        [`القيمة (${currency})`]: rec.totalReturnSales },
    { "البند": "مرتجع مشتريات",       [`القيمة (${currency})`]: rec.totalReturnPurchases },
    { "البند": "إجمالي الأقساط",      [`القيمة (${currency})`]: rec.totalInstallments },
    { "البند": "إجمالي المتبقي",      [`القيمة (${currency})`]: rec.totalRemaining },
  ];
  const ws3 = XLSX.utils.json_to_sheet(summaryRows);
  ws3["!cols"] = [{ wch: 22 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws3, "الملخص");

  XLSX.writeFile(
    wb,
    `عميل_${rec.name}_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}

function exportAllCustomersToExcel(
  records: CustomerRecord[],
  currency: string
): void {
  const rows = records.map((rec, idx) => ({
    "#": idx + 1,
    "الاسم":         rec.name,
    "الهاتف":        rec.phone || "-",
    "عدد الفواتير":  rec.invoices.length,
    "عدد الأقساط":   rec.installments.length,
    [`مبيعات (${currency})`]:          rec.totalSales,
    [`مشتريات (${currency})`]:         rec.totalPurchases,
    [`صيانة (${currency})`]:           rec.totalMaintenance,
    [`مرتجع مبيعات (${currency})`]:    rec.totalReturnSales,
    [`مرتجع مشتريات (${currency})`]:   rec.totalReturnPurchases,
    [`أقساط (${currency})`]:           rec.totalInstallments,
    [`متبقي (${currency})`]:           rec.totalRemaining,
    "آخر نشاط":      rec.lastActivity,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 5 }, { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 12 },
    { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 18 },
    { wch: 15 }, { wch: 15 }, { wch: 12 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "العملاء والموردين");
  XLSX.writeFile(
    wb,
    `قاعدة_العملاء_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}

// ─────────────────────────────────────────────
// InvoiceDetailModal
// ─────────────────────────────────────────────

interface InvoiceDetailModalProps {
  invoice: Invoice;
  currency: string;
  onClose: () => void;
  onEdit?: (inv: Invoice) => void;
}

function InvoiceDetailModal({
  invoice,
  currency,
  onClose,
  onEdit,
}: InvoiceDetailModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4"
      dir="rtl"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">

        {/* Header */}
        <div
          className={`bg-gradient-to-r ${
            TYPE_GRADIENT[invoice.type] ?? "from-gray-600 to-gray-700"
          } px-6 py-4 text-white flex items-center justify-between sticky top-0 z-10`}
        >
          <div>
            <h3 className="font-bold text-lg">
              {TYPE_LABEL[invoice.type]} — {invoice.number}
            </h3>
            <p className="text-white/70 text-sm">
              {invoice.date} · {invoice.time}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={() => { onEdit(invoice); onClose(); }}
                className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-semibold transition-colors"
              >
                تعديل
              </button>
            )}
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white p-1 transition-colors"
              aria-label="إغلاق"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* معلومات أساسية */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              {
                label: "العميل/المورد",
                value: invoice.customerName || invoice.supplierName || "-",
              },
              {
                label: "الهاتف",
                value: invoice.customerPhone || invoice.supplierPhone || "-",
              },
              {
                label: "الحالة",
                value:
                  invoice.status === "closed"  ? "مغلقة ✓"  :
                  invoice.status === "pending" ? "معلقة ⏳" : "مفتوحة",
              },
              { label: "ملاحظات", value: invoice.notes || "-" },
            ].map((f) => (
              <div key={f.label} className="bg-gray-50 rounded-xl p-3">
                <span className="text-gray-400 text-xs block mb-1">{f.label}</span>
                <span className="font-semibold text-gray-800">{f.value}</span>
              </div>
            ))}
          </div>

          {/* تفاصيل الصيانة */}
          {invoice.maintenanceInfo && (
            <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4 space-y-2">
              <h4 className="font-bold text-violet-700 text-sm">🔧 تفاصيل الصيانة</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">الجهاز: </span>
                  <span className="font-semibold">
                    {invoice.maintenanceInfo.deviceBrand}{" "}
                    {invoice.maintenanceInfo.deviceModel}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">الفني: </span>
                  <span className="font-semibold">
                    {invoice.maintenanceInfo.technician || "-"}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">الشكوى: </span>
                  {invoice.maintenanceInfo.customerComplaint}
                </div>
              </div>
            </div>
          )}

          {/* الأصناف */}
          {invoice.items && invoice.items.length > 0 && (
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
                    {invoice.items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-800">
                          {item.productName}
                        </td>
                        <td className="px-3 py-2 text-gray-700">{item.quantity}</td>
                        <td className="px-3 py-2 text-gray-700">
                          {(item.unitPrice ?? 0).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 font-bold text-gray-800">
                          {(item.total ?? 0).toLocaleString()} {currency}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* المالية */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between font-bold text-base border-b border-gray-200 pb-2">
              <span>الإجمالي</span>
              <span className="text-blue-700">
                {(invoice.total ?? 0).toLocaleString()} {currency}
              </span>
            </div>
            <div className="flex justify-between text-emerald-600">
              <span>المدفوع</span>
              <span className="font-semibold">
                {(invoice.paid ?? 0).toLocaleString()} {currency}
              </span>
            </div>
            {(invoice.remaining ?? 0) > 0 && (
              <div className="flex justify-between text-red-600 font-bold">
                <span>المتبقي</span>
                <span>{(invoice.remaining ?? 0).toLocaleString()} {currency}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// CustomerCard - مكون منفصل لكل عميل
// ─────────────────────────────────────────────

interface CustomerCardProps {
  rec: CustomerRecord;
  currency: string;
  isExpanded: boolean;
  activeTab: ActiveTab;
  filterType: FilterType;
  filterStatus: FilterStatus;
  onToggle: () => void;
  onTabChange: (tab: ActiveTab) => void;
  onFilterTypeChange: (t: FilterType) => void;
  onSelectInvoice: (inv: Invoice) => void;
  onEditInvoice?: (inv: Invoice) => void;
}

function CustomerCard({
  rec, currency, isExpanded, activeTab,
  filterType, onToggle, onTabChange,
  onFilterTypeChange, onSelectInvoice, onEditInvoice,
}: CustomerCardProps) {
  const hasRemaining = rec.totalRemaining > 0;

  const filteredInvoices = useMemo(
    () =>
      rec.invoices.filter((inv) => {
        if (filterType !== "all" && inv.type !== filterType) return false;
        return true;
      }),
    [rec.invoices, filterType]
  );

  // ✅ تصدير أقساط العميل بشكل منفصل
  const handleExportInstallments = useCallback(() => {
    const wb = XLSX.utils.book_new();
    const rows = rec.installments.map((p, idx) => ({
      "#": idx + 1,
      "التاريخ":    p.date ?? "-",
      "الوقت":      p.time ?? "-",
      [`المبلغ (${currency})`]: p.amount ?? 0,
      "رقم الفاتورة": p.invoiceRef || "-",
      "ملاحظات":    p.notes || "-",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "الأقساط");
    XLSX.writeFile(
      wb,
      `اقساط_${rec.name}_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  }, [rec, currency]);

  return (
    <div
      className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-all ${
        hasRemaining ? "border-red-100" : "border-gray-100"
      }`}
    >
      {/* ─── رأس البطاقة ─── */}
      <button className="w-full text-right" onClick={onToggle}>
        <div className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
          {/* الجانب الأيسر: avatar + معلومات */}
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-base flex-shrink-0 ${
                hasRemaining
                  ? "bg-gradient-to-br from-red-500 to-orange-500"
                  : "bg-gradient-to-br from-blue-500 to-indigo-600"
              }`}
            >
              {(rec.name ?? "?").charAt(0)}
            </div>
            <div className="text-right">
              <div className="font-bold text-gray-800">{rec.name}</div>
              <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                {rec.phone && (
                  <span className="flex items-center gap-1">
                    <Phone size={10} /> {rec.phone}
                  </span>
                )}
                <span>·</span>
                <span>{rec.invoices.length} فاتورة</span>
                {rec.installments.length > 0 && (
                  <>
                    <span>·</span>
                    <span>{rec.installments.length} قسط</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* الجانب الأيمن: badges + أزرار */}
          <div className="flex items-center gap-2">
            {/* زر تصدير عميل - يوقف propagation */}
            <button
              onClick={(e) => { e.stopPropagation(); exportCustomerToExcel(rec, currency); }}
              className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors flex-shrink-0"
              title="تصدير بيانات العميل Excel"
            >
              <Download size={14} />
            </button>

            {/* badges - تظهر على شاشة md+ فقط */}
            <div className="hidden md:flex flex-wrap items-center gap-1.5 text-xs">
              {rec.totalSales > 0 && (
                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg font-semibold flex items-center gap-1">
                  <TrendingUp size={10} /> {rec.totalSales.toLocaleString()}
                </span>
              )}
              {rec.totalPurchases > 0 && (
                <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-lg font-semibold flex items-center gap-1">
                  <TrendingDown size={10} /> {rec.totalPurchases.toLocaleString()}
                </span>
              )}
              {rec.totalMaintenance > 0 && (
                <span className="bg-violet-50 text-violet-700 px-2 py-0.5 rounded-lg font-semibold flex items-center gap-1">
                  <Wrench size={10} /> {rec.totalMaintenance.toLocaleString()}
                </span>
              )}
              {rec.totalInstallments > 0 && (
                <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-lg font-semibold flex items-center gap-1">
                  <DollarSign size={10} /> {rec.totalInstallments.toLocaleString()}
                </span>
              )}
              {hasRemaining && (
                <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-lg font-bold border border-red-200">
                  متبقي: {rec.totalRemaining.toLocaleString()}
                </span>
              )}
            </div>

            {isExpanded
              ? <ChevronUp size={16} className="text-gray-400" />
              : <ChevronDown size={16} className="text-gray-400" />
            }
          </div>
        </div>
      </button>

      {/* badges للجوال */}
      <div className="md:hidden flex flex-wrap gap-1.5 px-4 pb-2 text-xs">
        {rec.totalSales > 0 && (
          <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg">
            بيع: {rec.totalSales.toLocaleString()}
          </span>
        )}
        {rec.totalPurchases > 0 && (
          <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-lg">
            شراء: {rec.totalPurchases.toLocaleString()}
          </span>
        )}
        {rec.totalMaintenance > 0 && (
          <span className="bg-violet-50 text-violet-700 px-2 py-0.5 rounded-lg">
            صيانة: {rec.totalMaintenance.toLocaleString()}
          </span>
        )}
        {rec.totalInstallments > 0 && (
          <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-lg">
            أقساط: {rec.totalInstallments.toLocaleString()}
          </span>
        )}
        {hasRemaining && (
          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-lg font-bold">
            متبقي: {rec.totalRemaining.toLocaleString()}
          </span>
        )}
      </div>

      {/* ─── التفاصيل الموسعة ─── */}
      {isExpanded && (
        <div className="border-t border-gray-100">

          {/* تبويبات */}
          <div className="flex border-b border-gray-100 bg-gray-50">
            <button
              onClick={() => onTabChange("invoices")}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === "invoices"
                  ? "bg-white text-blue-700 border-b-2 border-blue-500"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Package size={13} /> الفواتير ({rec.invoices.length})
            </button>
            <button
              onClick={() => onTabChange("installments")}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === "installments"
                  ? "bg-white text-indigo-700 border-b-2 border-indigo-500"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <DollarSign size={13} /> الأقساط ({rec.installments.length})
            </button>
          </div>

          {/* ─── تبويب الفواتير ─── */}
          {activeTab === "invoices" && (
            <>
              {/* شريط فلاتر الفواتير */}
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex flex-wrap gap-2 items-center justify-between">
                <div className="flex flex-wrap gap-1.5 items-center">
                  <span className="text-xs text-gray-400 self-center ml-1">النوع:</span>
                  {(
                    [
                      { val: "all",         label: "الكل"     },
                      { val: "sale",        label: "مبيعات"   },
                      { val: "purchase",    label: "مشتريات"  },
                      { val: "maintenance", label: "صيانة"    },
                      { val: "return_sale", label: "مرتجع"    },
                    ] as { val: FilterType; label: string }[]
                  ).map((f) => (
                    <button
                      key={f.val}
                      onClick={() => onFilterTypeChange(f.val)}
                      className={`px-2 py-0.5 rounded-lg text-xs font-medium transition-colors ${
                        filterType === f.val
                          ? "bg-blue-600 text-white"
                          : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => exportCustomerToExcel(rec, currency)}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition-colors"
                >
                  <Download size={12} /> تصدير Excel
                </button>
              </div>

              {/* جدول الفواتير */}
              <div className="overflow-x-auto">
                {filteredInvoices.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-sm">
                    لا توجد فواتير مطابقة
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs">
                        <th className="px-3 py-2 text-right">رقم الفاتورة</th>
                        <th className="px-3 py-2 text-right">النوع</th>
                        <th className="px-3 py-2 text-right">التاريخ</th>
                        <th className="px-3 py-2 text-right">الحالة</th>
                        <th className="px-3 py-2 text-right">الأصناف</th>
                        <th className="px-3 py-2 text-right">الإجمالي</th>
                        <th className="px-3 py-2 text-right">المدفوع</th>
                        <th className="px-3 py-2 text-right">المتبقي</th>
                        <th className="px-3 py-2 text-center">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredInvoices.map((inv) => (
                        <tr
                          key={inv.id}
                          className="hover:bg-blue-50/30 transition-colors"
                        >
                          <td className="px-3 py-2 font-mono text-xs text-gray-600 font-semibold">
                            {inv.number}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${
                                TYPE_COLOR[inv.type] ?? "bg-gray-100 text-gray-600"
                              }`}
                            >
                              <TypeIcon type={inv.type} />
                              {TYPE_LABEL[inv.type] ?? inv.type}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">
                            {inv.date}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                inv.status === "closed"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : inv.status === "pending"
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {inv.status === "closed"
                                ? "مغلقة"
                                : inv.status === "pending"
                                ? "معلقة"
                                : "مفتوحة"}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {inv.items && inv.items.length > 0 ? (
                              <div className="text-xs text-gray-500">
                                {inv.items.slice(0, 2).map((item) => (
                                  <div key={item.id} className="truncate max-w-[8rem]">
                                    {item.productName} ×{item.quantity}
                                  </div>
                                ))}
                                {inv.items.length > 2 && (
                                  <div className="text-blue-500">
                                    +{inv.items.length - 2} أخرى
                                  </div>
                                )}
                              </div>
                            ) : inv.maintenanceInfo ? (
                              <span className="text-xs text-violet-600">
                                {inv.maintenanceInfo.deviceBrand}{" "}
                                {inv.maintenanceInfo.deviceModel}
                              </span>
                            ) : (
                              <span className="text-gray-300 text-xs">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 font-semibold text-gray-800 whitespace-nowrap">
                            {(inv.total ?? 0).toLocaleString()} {currency}
                          </td>
                          <td className="px-3 py-2 text-emerald-600 whitespace-nowrap">
                            {(inv.paid ?? 0).toLocaleString()} {currency}
                          </td>
                          <td
                            className={`px-3 py-2 font-semibold whitespace-nowrap ${
                              (inv.remaining ?? 0) > 0
                                ? "text-red-600"
                                : "text-emerald-600"
                            }`}
                          >
                            {(inv.remaining ?? 0).toLocaleString()} {currency}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1 justify-center">
                              <button
                                onClick={() => onSelectInvoice(inv)}
                                className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                                title="عرض"
                              >
                                <Eye size={13} />
                              </button>
                              {onEditInvoice && (
                                <button
                                  onClick={() => onEditInvoice(inv)}
                                  className="px-2 py-1 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 text-xs transition-colors"
                                >
                                  تعديل
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 font-bold text-sm border-t-2 border-gray-200">
                        <td colSpan={5} className="px-3 py-2 text-gray-600">
                          الإجمالي ({filteredInvoices.length} فاتورة)
                        </td>
                        <td className="px-3 py-2 text-gray-800">
                          {filteredInvoices
                            .reduce((s, i) => s + (i.total ?? 0), 0)
                            .toLocaleString()}{" "}
                          {currency}
                        </td>
                        <td className="px-3 py-2 text-emerald-700">
                          {filteredInvoices
                            .reduce((s, i) => s + (i.paid ?? 0), 0)
                            .toLocaleString()}{" "}
                          {currency}
                        </td>
                        <td
                          className={`px-3 py-2 ${
                            rec.totalRemaining > 0
                              ? "text-red-700"
                              : "text-emerald-700"
                          }`}
                        >
                          {filteredInvoices
                            .reduce((s, i) => s + (i.remaining ?? 0), 0)
                            .toLocaleString()}{" "}
                          {currency}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </>
          )}

          {/* ─── تبويب الأقساط ─── */}
          {activeTab === "installments" && (
            <div>
              {rec.installments.length > 0 && (
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex justify-end">
                  <button
                    onClick={handleExportInstallments}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition-colors"
                  >
                    <Download size={12} /> تصدير الأقساط Excel
                  </button>
                </div>
              )}
              <div className="overflow-x-auto">
                {rec.installments.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-sm">
                    لا توجد أقساط لهذا العميل
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs">
                        <th className="px-3 py-2 text-right">التاريخ</th>
                        <th className="px-3 py-2 text-right">الوقت</th>
                        <th className="px-3 py-2 text-right">المبلغ</th>
                        <th className="px-3 py-2 text-right">رقم الفاتورة</th>
                        <th className="px-3 py-2 text-right">ملاحظات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {[...rec.installments]
                        .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
                        .map((p) => (
                          <tr
                            key={p.id}
                            className="hover:bg-indigo-50/30 transition-colors"
                          >
                            <td className="px-3 py-2 text-xs text-gray-500">{p.date}</td>
                            <td className="px-3 py-2 text-xs text-gray-400">{p.time}</td>
                            <td className="px-3 py-2 font-bold text-indigo-700">
                              {(p.amount ?? 0).toLocaleString()} {currency}
                            </td>
                            <td className="px-3 py-2 font-mono text-xs text-gray-500">
                              {p.invoiceRef || "-"}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-400">
                              {p.notes || "-"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-indigo-50 font-bold border-t-2 border-indigo-100">
                        <td colSpan={2} className="px-3 py-2 text-indigo-700">
                          الإجمالي ({rec.installments.length} دفعة)
                        </td>
                        <td className="px-3 py-2 text-indigo-700">
                          {rec.totalInstallments.toLocaleString()} {currency}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

export default function CustomersLedger({
  state,
  currency,
  onEditInvoice,
}: Props) {
  const [search,       setSearch]       = useState<string>("");
  const [expandedId,   setExpandedId]   = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [activeTab,    setActiveTab]    = useState<ActiveTab>("invoices");
  const [filterType,   setFilterType]   = useState<FilterType>("all");
  const [sortBy,       setSortBy]       = useState<SortBy>("activity");

  // ✅ بناء السجلات مرة واحدة عند تغير state
  const records = useMemo(() => buildCustomerRecords(state), [state]);

  // ✅ الفلترة والترتيب
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return records
      .filter((rec) => {
        if (!q) return true;
        return (
          rec.name.toLowerCase().includes(q) ||
          rec.phone.includes(search.trim()) ||
          rec.invoices.some(
            (inv) =>
              (inv.number ?? "").toLowerCase().includes(q) ||
              inv.items?.some((item) =>
                (item.productName ?? "").toLowerCase().includes(q)
              )
          )
        );
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "name":      return a.name.localeCompare(b.name, "ar");
          case "sales":     return b.totalSales - a.totalSales;
          case "remaining": return b.totalRemaining - a.totalRemaining;
          default:          return b.lastActivity.localeCompare(a.lastActivity);
        }
      });
  }, [records, search, sortBy]);

  // ✅ إحصائيات الهيدر
  const totalCustomers      = filtered.length;
  const totalSalesAll       = useMemo(() => filtered.reduce((s, r) => s + r.totalSales, 0),       [filtered]);
  const totalInstallsAll    = useMemo(() => filtered.reduce((s, r) => s + r.totalInstallments, 0), [filtered]);
  const totalRemainingAll   = useMemo(() => filtered.reduce((s, r) => s + r.totalRemaining, 0),   [filtered]);

  // ✅ toggle آمن
  const handleToggle = useCallback(
    (id: string) => {
      setExpandedId((prev) => (prev === id ? null : id));
      setActiveTab("invoices");
      setFilterType("all");
    },
    []
  );

  return (
    <div className="space-y-5" dir="rtl">

      {/* ─── Header ─── */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <User size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold">سجل العملاء والموردين</h2>
              <p className="text-blue-200 text-sm">{totalCustomers} سجل</p>
            </div>
          </div>
          <button
            onClick={() => exportAllCustomersToExcel(filtered, currency)}
            className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-semibold transition-colors"
          >
            <Download size={16} /> تصدير الكل Excel
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "إجمالي العملاء",   value: totalCustomers,                  unit: "سجل"    },
            { label: "إجمالي المبيعات",  value: totalSalesAll.toLocaleString(),   unit: currency },
            { label: "إجمالي الأقساط",   value: totalInstallsAll.toLocaleString(), unit: currency },
            { label: "إجمالي المتبقي",   value: totalRemainingAll.toLocaleString(), unit: currency },
          ].map((s) => (
            <div key={s.label} className="bg-white/15 rounded-xl p-3 text-center">
              <div className="text-xs opacity-75 mb-1">{s.label}</div>
              <div className="text-lg font-bold">{s.value}</div>
              <div className="text-xs opacity-60">{s.unit}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── شريط البحث والفلاتر ─── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
        <div className="relative">
          <Search
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالاسم أو الهاتف أو رقم الفاتورة أو اسم الصنف..."
            className="w-full pr-9 pl-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
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

        <div className="flex flex-wrap gap-2 items-center">
          <Filter size={14} className="text-gray-400" />
          <span className="text-xs text-gray-500 font-semibold">ترتيب:</span>
          {(
            [
              { val: "activity",  label: "آخر نشاط" },
              { val: "name",      label: "الاسم"    },
              { val: "sales",     label: "المبيعات" },
              { val: "remaining", label: "المتبقي"  },
            ] as { val: SortBy; label: string }[]
          ).map((s) => (
            <button
              key={s.val}
              onClick={() => setSortBy(s.val)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                sortBy === s.val
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── قائمة العملاء ─── */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center text-gray-400 bg-white rounded-2xl border border-gray-100">
          <User size={48} className="mx-auto mb-3 opacity-20" />
          <div className="font-medium">لا توجد نتائج</div>
          <div className="text-sm mt-1">جرّب البحث بكلمة مختلفة</div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((rec) => (
            <CustomerCard
              key={rec.id}
              rec={rec}
              currency={currency}
              isExpanded={expandedId === rec.id}
              activeTab={activeTab}
              filterType={filterType}
              filterStatus="all"
              onToggle={() => handleToggle(rec.id)}
              onTabChange={setActiveTab}
              onFilterTypeChange={setFilterType}
              onSelectInvoice={setSelectedInvoice}
              onEditInvoice={onEditInvoice}
            />
          ))}
        </div>
      )}

      {/* ─── مودال تفاصيل الفاتورة ─── */}
      {selectedInvoice && (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          currency={currency}
          onClose={() => setSelectedInvoice(null)}
          onEdit={onEditInvoice}
        />
      )}
    </div>
  );
}