import { useState } from "react";
import {
  AppState, Invoice, InstallmentPayment,
} from "../types";
import {
  Printer, Calendar, TrendingUp, TrendingDown,
  Wrench, DollarSign, ChevronDown, ChevronUp,
  Eye, X, FileText,
} from "lucide-react";

interface Props {
  state: AppState;
  currency: string;
}

function getDateStr(isoDate: string) {
  return new Date(isoDate).toLocaleDateString("ar-EG");
}

// نافذة تفاصيل الفاتورة
function InvoiceDetailModal({
  invoice,
  currency,
  onClose,
}: {
  invoice: Invoice;
  currency: string;
  onClose: () => void;
}) {
  const typeLabel: Record<string, string> = {
    sale: "مبيعات",
    purchase: "مشتريات",
    return_sale: "مرتجع مبيعات",
    return_purchase: "مرتجع مشتريات",
    maintenance: "صيانة",
  };

  const typeColor: Record<string, string> = {
    sale: "from-blue-600 to-blue-700",
    purchase: "from-green-600 to-green-700",
    return_sale: "from-orange-500 to-orange-600",
    return_purchase: "from-purple-600 to-purple-700",
    maintenance: "from-violet-600 to-violet-700",
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4"
      dir="rtl"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className={`bg-gradient-to-r ${typeColor[invoice.type] ?? "from-blue-600 to-blue-700"} px-6 py-4 text-white flex items-center justify-between sticky top-0`}>
          <div>
            <h3 className="font-bold text-lg">
              {typeLabel[invoice.type] ?? invoice.type} — {invoice.number}
            </h3>
            <p className="text-white/70 text-sm">{invoice.date} · {invoice.time}</p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* بيانات العميل/المورد */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-50 rounded-xl p-3">
              <span className="text-gray-400 text-xs">العميل / المورد</span>
              <div className="font-semibold text-gray-800 mt-0.5">
                {invoice.customerName || invoice.supplierName || "-"}
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <span className="text-gray-400 text-xs">الهاتف</span>
              <div className="font-semibold text-gray-800 mt-0.5">
                {invoice.customerPhone || invoice.supplierPhone || "-"}
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <span className="text-gray-400 text-xs">الحالة</span>
              <div className={`font-semibold mt-0.5 ${invoice.status === "closed" ? "text-emerald-600" : invoice.status === "pending" ? "text-orange-600" : "text-gray-600"}`}>
                {invoice.status === "closed" ? "مغلقة" : invoice.status === "pending" ? "معلقة" : "مفتوحة"}
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <span className="text-gray-400 text-xs">ملاحظات</span>
              <div className="font-semibold text-gray-800 mt-0.5">{invoice.notes || "-"}</div>
            </div>
          </div>

          {/* تفاصيل الصيانة */}
          {invoice.maintenanceInfo && (
            <div className="bg-violet-50 rounded-2xl p-4">
              <h4 className="font-semibold text-violet-700 text-sm mb-3">تفاصيل الصيانة</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">الجهاز: </span>
                  <span className="font-semibold">
                    {invoice.maintenanceInfo.deviceBrand} {invoice.maintenanceInfo.deviceModel}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">النوع: </span>
                  <span className="font-semibold">{invoice.maintenanceInfo.deviceType}</span>
                </div>
                <div>
                  <span className="text-gray-500">اللون: </span>
                  <span className="font-semibold">{invoice.maintenanceInfo.color || "-"}</span>
                </div>
                <div>
                  <span className="text-gray-500">IMEI: </span>
                  <span className="font-mono">{invoice.maintenanceInfo.imei || "-"}</span>
                </div>
                <div>
                  <span className="text-gray-500">الفني: </span>
                  <span className="font-semibold">{invoice.maintenanceInfo.technician || "-"}</span>
                </div>
                <div>
                  <span className="text-gray-500">ضمان: </span>
                  <span className="font-semibold">{invoice.maintenanceInfo.warrantyDays} يوم</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">الشكوى: </span>
                  <span>{invoice.maintenanceInfo.customerComplaint || "-"}</span>
                </div>
                {invoice.maintenanceInfo.diagnosis && (
                  <div className="col-span-2">
                    <span className="text-gray-500">التشخيص: </span>
                    <span>{invoice.maintenanceInfo.diagnosis}</span>
                  </div>
                )}
                {invoice.maintenanceInfo.accessories && (
                  <div className="col-span-2">
                    <span className="text-gray-500">الإكسسوارات: </span>
                    <span>{invoice.maintenanceInfo.accessories}</span>
                  </div>
                )}
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
                      <th className="px-3 py-2 text-right">#</th>
                      <th className="px-3 py-2 text-right">الصنف</th>
                      <th className="px-3 py-2 text-right">الكمية</th>
                      <th className="px-3 py-2 text-right">السعر</th>
                      <th className="px-3 py-2 text-right">خصم</th>
                      <th className="px-3 py-2 text-right">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {invoice.items.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-400 text-xs">{idx + 1}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-gray-800">{item.productName}</div>
                          <div className="text-xs text-gray-400 font-mono">{item.barcode}</div>
                        </td>
                        <td className="px-3 py-2 text-gray-700 font-medium">{item.quantity}</td>
                        <td className="px-3 py-2 text-gray-700">{(item.unitPrice ?? 0).toLocaleString()}</td>
                        <td className="px-3 py-2 text-orange-600">
                          {item.discount > 0 ? item.discount.toLocaleString() : "-"}
                        </td>
                        <td className="px-3 py-2 font-bold text-gray-800">
                          {(item.total ?? 0).toLocaleString()} {currency}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={5} className="px-3 py-2 text-gray-500 text-sm font-semibold">الإجمالي الفرعي</td>
                      <td className="px-3 py-2 font-bold text-gray-800">
                        {(invoice.subtotal ?? 0).toLocaleString()} {currency}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ملخص المبالغ */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">المجموع الفرعي</span>
              <span className="font-semibold">{(invoice.subtotal ?? 0).toLocaleString()} {currency}</span>
            </div>
            {(invoice.discount ?? 0) > 0 && (
              <div className="flex justify-between text-orange-600">
                <span>الخصم الإجمالي</span>
                <span>- {invoice.discount.toLocaleString()} {currency}</span>
              </div>
            )}
            {(invoice.tax ?? 0) > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>الضريبة</span>
                <span>{invoice.tax.toLocaleString()} {currency}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-2">
              <span>الإجمالي الكلي</span>
              <span className="text-blue-700">{(invoice.total ?? 0).toLocaleString()} {currency}</span>
            </div>
            <div className="flex justify-between text-emerald-600 font-semibold">
              <span>المدفوع</span>
              <span>{(invoice.paid ?? 0).toLocaleString()} {currency}</span>
            </div>
            {(invoice.remaining ?? 0) > 0 && (
              <div className="flex justify-between text-red-600 font-bold">
                <span>المتبقي</span>
                <span>{invoice.remaining.toLocaleString()} {currency}</span>
              </div>
            )}
          </div>

          {/* زر إغلاق */}
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DailyReport({ state, currency }: Props) {
  const today = new Date().toLocaleDateString("ar-EG");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [expandedSection, setExpandedSection] = useState<string | null>("invoices");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const selectedDateAr = new Date(selectedDate).toLocaleDateString("ar-EG");

  // جمع فواتير الوردية الحالية
  const currentInvoices = (state.invoices ?? []).filter(
    (i) => i.date === selectedDate || i.date === selectedDateAr
  );
  const currentInstallments = (state.installmentsLedger?.payments ?? []).filter(
    (p) => p.date === selectedDateAr
  );

  // جمع فواتير من الأرشيف
  const archiveInvoices: Invoice[] = [];
  const archiveInstallments: InstallmentPayment[] = [];

  (state.shiftArchives ?? []).forEach((archive) => {
    const dayInvoices = (archive.invoices ?? []).filter(
      (i) => i.date === selectedDate || i.date === selectedDateAr
    );
    const dayInstallments = (archive.installments ?? []).filter(
      (p) => p.date === selectedDateAr
    );
    archiveInvoices.push(...dayInvoices);
    archiveInstallments.push(...dayInstallments);
  });

  const allInvoices = [...currentInvoices, ...archiveInvoices];
  const allInstallments = [...currentInstallments, ...archiveInstallments];

  // حسابات
  const sales = allInvoices.filter((i) => i.type === "sale" && i.status === "closed");
  const purchases = allInvoices.filter((i) => i.type === "purchase" && i.status === "closed");
  const returnSales = allInvoices.filter((i) => i.type === "return_sale" && i.status === "closed");
  const returnPurchases = allInvoices.filter((i) => i.type === "return_purchase" && i.status === "closed");
  const maintenance = allInvoices.filter((i) => i.type === "maintenance" && i.status === "closed");
  const pending = allInvoices.filter((i) => i.status === "pending");

  const totalSales = sales.reduce((s, i) => s + i.total, 0);
  const totalPurchases = purchases.reduce((s, i) => s + i.total, 0);
  const totalReturnSales = returnSales.reduce((s, i) => s + i.total, 0);
  const totalReturnPurchases = returnPurchases.reduce((s, i) => s + i.total, 0);
  const totalMaintenance = maintenance.reduce((s, i) => s + i.total, 0);
  const totalInstallments = allInstallments.reduce((s, p) => s + p.amount, 0);
  const totalPending = pending.reduce((s, i) => s + i.total, 0);
  const netProfit = totalSales - totalPurchases - totalReturnSales + totalReturnPurchases;

  const typeLabel: Record<string, string> = {
    sale: "مبيعات",
    purchase: "مشتريات",
    return_sale: "مرتجع مبيعات",
    return_purchase: "مرتجع مشتريات",
    maintenance: "صيانة",
  };

  const typeColor: Record<string, string> = {
    sale: "bg-blue-100 text-blue-700",
    purchase: "bg-green-100 text-green-700",
    return_sale: "bg-orange-100 text-orange-700",
    return_purchase: "bg-purple-100 text-purple-700",
    maintenance: "bg-violet-100 text-violet-700",
  };

  const handlePrint = () => {
    const printContent = `
      <html dir="rtl">
      <head>
        <meta charset="UTF-8"/>
        <title>تقرير يوم ${selectedDateAr}</title>
        <style>
          body{font-family:Arial,sans-serif;padding:15px;direction:rtl;font-size:12px}
          h1{text-align:center;color:#1e40af;margin-bottom:5px}
          h2{color:#374151;border-bottom:2px solid #e5e7eb;padding-bottom:5px;margin-top:15px}
          .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:10px 0}
          .card{background:#f3f4f6;border-radius:8px;padding:10px;text-align:center}
          .card-title{font-size:11px;color:#6b7280}
          .card-value{font-size:16px;font-weight:bold;color:#1e40af}
          .net{color:#059669}
          .loss{color:#dc2626}
          table{width:100%;border-collapse:collapse;margin-bottom:15px;font-size:11px}
          th{background:#1e40af;color:white;padding:6px;text-align:right}
          td{padding:6px;border-bottom:1px solid #e5e7eb}
          .items-table th{background:#6d28d9}
          tr:nth-child(even){background:#f9fafb}
          .badge{padding:2px 6px;border-radius:10px;font-size:10px;font-weight:bold}
          @media print{body{padding:5px}}
        </style>
      </head>
      <body>
        <h1>${state.settings?.shopName || "مدير المبيعات"}</h1>
        <h1 style="font-size:16px">تقرير يوم ${selectedDateAr}</h1>

        <div class="summary">
          <div class="card"><div class="card-title">المبيعات</div><div class="card-value">${totalSales.toLocaleString()} ${currency}</div></div>
          <div class="card"><div class="card-title">المشتريات</div><div class="card-value" style="color:#059669">${totalPurchases.toLocaleString()} ${currency}</div></div>
          <div class="card"><div class="card-title">الصيانة</div><div class="card-value" style="color:#7c3aed">${totalMaintenance.toLocaleString()} ${currency}</div></div>
          ${totalReturnSales > 0 ? `<div class="card"><div class="card-title">مرتجع مبيعات</div><div class="card-value" style="color:#ea580c">${totalReturnSales.toLocaleString()} ${currency}</div></div>` : ""}
          ${totalReturnPurchases > 0 ? `<div class="card"><div class="card-title">مرتجع مشتريات</div><div class="card-value" style="color:#9333ea">${totalReturnPurchases.toLocaleString()} ${currency}</div></div>` : ""}
          <div class="card"><div class="card-title">الأقساط</div><div class="card-value" style="color:#4f46e5">${totalInstallments.toLocaleString()} ${currency}</div></div>
          <div class="card"><div class="card-title">صافي الربح</div><div class="card-value ${netProfit >= 0 ? "net" : "loss"}">${netProfit.toLocaleString()} ${currency}</div></div>
        </div>

        ${allInvoices.length > 0 ? `
        <h2>الفواتير (${allInvoices.length})</h2>
        <table>
          <tr><th>رقم الفاتورة</th><th>النوع</th><th>العميل/المورد</th><th>الحالة</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th></tr>
          ${allInvoices.map((i) => `
            <tr>
              <td style="font-family:monospace">${i.number}</td>
              <td>${typeLabel[i.type] ?? i.type}</td>
              <td>${i.type === "sale" || i.type === "return_sale" || i.type === "maintenance" ? (i.customerName || "-") : (i.supplierName || "-")}</td>
              <td>${i.status === "closed" ? "مغلقة" : i.status === "pending" ? "معلقة" : "مفتوحة"}</td>
              <td><b>${i.total.toLocaleString()} ${currency}</b></td>
              <td style="color:#059669">${i.paid.toLocaleString()} ${currency}</td>
              <td style="color:${i.remaining > 0 ? "#dc2626" : "#059669"}">${i.remaining.toLocaleString()} ${currency}</td>
            </tr>
            ${i.items && i.items.length > 0 ? `
            <tr><td colspan="7" style="padding:0">
              <table class="items-table" style="margin:0;border-top:none">
                <tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>خصم</th><th>الإجمالي</th></tr>
                ${i.items.map((item) => `
                  <tr style="background:#f5f3ff">
                    <td>${item.productName}</td>
                    <td>${item.quantity}</td>
                    <td>${item.unitPrice.toLocaleString()}</td>
                    <td>${item.discount > 0 ? item.discount.toLocaleString() : "-"}</td>
                    <td><b>${item.total.toLocaleString()} ${currency}</b></td>
                  </tr>
                `).join("")}
              </table>
            </td></tr>
            ` : ""}
          `).join("")}
        </table>
        ` : ""}

        ${allInstallments.length > 0 ? `
        <h2>أقساط مستلمة (${allInstallments.length}) — إجمالي: ${totalInstallments.toLocaleString()} ${currency}</h2>
        <table>
          <tr><th>الوقت</th><th>العميل</th><th>الهاتف</th><th>المبلغ</th><th>الفاتورة</th><th>ملاحظات</th></tr>
          ${allInstallments.map((p) => `
            <tr>
              <td>${p.time}</td>
              <td>${p.customerName}</td>
              <td>${p.customerPhone || "-"}</td>
              <td style="color:#4f46e5;font-weight:bold">${p.amount.toLocaleString()} ${currency}</td>
              <td style="font-family:monospace">${p.invoiceRef || "-"}</td>
              <td>${p.notes || "-"}</td>
            </tr>
          `).join("")}
        </table>
        ` : ""}
      </body>
      </html>
    `;
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(printContent);
      win.document.close();
      setTimeout(() => win.print(), 500);
    }
  };

  const SectionHeader = ({
    id, title, count, total, color,
  }: {
    id: string; title: string; count: number; total?: number; color: string;
  }) => (
    <button
      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-semibold text-sm transition-colors ${expandedSection === id ? `${color} shadow-sm` : "bg-gray-50 text-gray-700 hover:bg-gray-100"}`}
      onClick={() => setExpandedSection(expandedSection === id ? null : id)}
    >
      <div className="flex items-center gap-2">
        <FileText size={16} />
        <span>{title}</span>
        <span className="bg-white/60 px-2 py-0.5 rounded-full text-xs font-bold">{count}</span>
      </div>
      <div className="flex items-center gap-3">
        {total !== undefined && (
          <span className="font-bold">{total.toLocaleString()} {currency}</span>
        )}
        {expandedSection === id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>
    </button>
  );

  const InvoiceRow = ({ inv }: { inv: Invoice }) => (
    <>
      <tr className="hover:bg-gray-50 transition-colors">
        <td className="px-3 py-2 font-mono text-xs text-gray-600">{inv.number}</td>
        <td className="px-3 py-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColor[inv.type] ?? "bg-gray-100 text-gray-600"}`}>
            {typeLabel[inv.type] ?? inv.type}
          </span>
        </td>
        <td className="px-3 py-2 text-gray-700 text-sm">
          {inv.type === "sale" || inv.type === "return_sale" || inv.type === "maintenance"
            ? inv.customerName || "-"
            : inv.supplierName || "-"}
        </td>
        <td className="px-3 py-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${inv.status === "closed" ? "bg-emerald-100 text-emerald-700" : inv.status === "pending" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-600"}`}>
            {inv.status === "closed" ? "مغلقة" : inv.status === "pending" ? "معلقة" : "مفتوحة"}
          </span>
        </td>
        <td className="px-3 py-2 font-bold text-gray-800">{inv.total.toLocaleString()} {currency}</td>
        <td className="px-3 py-2 text-emerald-600 font-semibold">{inv.paid.toLocaleString()} {currency}</td>
        <td className={`px-3 py-2 font-semibold ${inv.remaining > 0 ? "text-red-600" : "text-emerald-600"}`}>
          {inv.remaining.toLocaleString()} {currency}
        </td>
        <td className="px-3 py-2">
          <button
            onClick={() => setSelectedInvoice(inv)}
            className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
            title="عرض التفاصيل"
          >
            <Eye size={14} />
          </button>
        </td>
      </tr>
      {/* تفاصيل الأصناف مدمجة */}
      {inv.items && inv.items.length > 0 && (
        <tr>
          <td colSpan={8} className="px-6 pb-2 bg-gray-50/50">
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-100">
                  <tr className="text-gray-500">
                    <th className="px-3 py-1.5 text-right">الصنف</th>
                    <th className="px-3 py-1.5 text-right">الكمية</th>
                    <th className="px-3 py-1.5 text-right">السعر</th>
                    <th className="px-3 py-1.5 text-right">خصم</th>
                    <th className="px-3 py-1.5 text-right">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.items.map((item) => (
                    <tr key={item.id} className="border-t border-gray-100 hover:bg-white">
                      <td className="px-3 py-1.5">
                        <div className="font-medium text-gray-800">{item.productName}</div>
                        {item.barcode && <div className="text-gray-400 font-mono">{item.barcode}</div>}
                      </td>
                      <td className="px-3 py-1.5 text-gray-700 font-medium">{item.quantity}</td>
                      <td className="px-3 py-1.5 text-gray-700">{(item.unitPrice ?? 0).toLocaleString()}</td>
                      <td className="px-3 py-1.5 text-orange-600">{item.discount > 0 ? item.discount.toLocaleString() : "-"}</td>
                      <td className="px-3 py-1.5 font-bold text-gray-800">
                        {(item.total ?? 0).toLocaleString()} {currency}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );

  const InvoiceTable = ({ invoices }: { invoices: Invoice[] }) => (
    invoices.length === 0 ? (
      <div className="p-6 text-center text-gray-400 text-sm">لا توجد فواتير</div>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs border-b border-gray-100">
              <th className="px-3 py-2 text-right">رقم الفاتورة</th>
              <th className="px-3 py-2 text-right">النوع</th>
              <th className="px-3 py-2 text-right">العميل/المورد</th>
              <th className="px-3 py-2 text-right">الحالة</th>
              <th className="px-3 py-2 text-right">الإجمالي</th>
              <th className="px-3 py-2 text-right">المدفوع</th>
              <th className="px-3 py-2 text-right">المتبقي</th>
              <th className="px-3 py-2 text-right">تفاصيل</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {invoices.map((inv) => (
              <InvoiceRow key={inv.id} inv={inv} />
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 font-bold text-sm border-t-2 border-gray-200">
              <td colSpan={4} className="px-3 py-2 text-gray-700">الإجمالي</td>
              <td className="px-3 py-2 text-gray-800">
                {invoices.reduce((s, i) => s + i.total, 0).toLocaleString()} {currency}
              </td>
              <td className="px-3 py-2 text-emerald-700">
                {invoices.reduce((s, i) => s + i.paid, 0).toLocaleString()} {currency}
              </td>
              <td className={`px-3 py-2 ${invoices.reduce((s, i) => s + i.remaining, 0) > 0 ? "text-red-700" : "text-emerald-700"}`}>
                {invoices.reduce((s, i) => s + i.remaining, 0).toLocaleString()} {currency}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    )
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">التقرير اليومي</h2>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700"
        >
          <Printer size={16} />طباعة
        </button>
      </div>

      {/* اختيار التاريخ */}
      <div className="flex items-center gap-3 flex-wrap">
        <Calendar size={18} className="text-gray-400" />
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <span className="text-gray-500 text-sm font-medium">{selectedDateAr}</span>
        {selectedDateAr === today && (
          <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-1 rounded-lg font-semibold">اليوم</span>
        )}
        <span className="text-gray-400 text-xs">({allInvoices.length} فاتورة · {allInstallments.length} قسط)</span>
      </div>

      {/* ملخص اليوم */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} className="text-blue-500" />
            <span className="text-xs text-blue-500">المبيعات</span>
          </div>
          <div className="text-xl font-bold text-blue-700">{totalSales.toLocaleString()}</div>
          <div className="text-xs text-blue-400">{sales.length} فاتورة · {currency}</div>
        </div>

        <div className="bg-green-50 border border-green-100 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown size={14} className="text-green-500" />
            <span className="text-xs text-green-500">المشتريات</span>
          </div>
          <div className="text-xl font-bold text-green-700">{totalPurchases.toLocaleString()}</div>
          <div className="text-xs text-green-400">{purchases.length} فاتورة · {currency}</div>
        </div>

        <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Wrench size={14} className="text-violet-500" />
            <span className="text-xs text-violet-500">الصيانة</span>
          </div>
          <div className="text-xl font-bold text-violet-700">{totalMaintenance.toLocaleString()}</div>
          <div className="text-xs text-violet-400">{maintenance.length} أمر · {currency}</div>
        </div>

        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={14} className="text-indigo-500" />
            <span className="text-xs text-indigo-500">الأقساط</span>
          </div>
          <div className="text-xl font-bold text-indigo-700">{totalInstallments.toLocaleString()}</div>
          <div className="text-xs text-indigo-400">{allInstallments.length} دفعة · {currency}</div>
        </div>

        {totalReturnSales > 0 && (
          <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4">
            <div className="text-xs text-orange-500 mb-1">مرتجع مبيعات</div>
            <div className="text-xl font-bold text-orange-700">{totalReturnSales.toLocaleString()}</div>
            <div className="text-xs text-orange-400">{returnSales.length} فاتورة · {currency}</div>
          </div>
        )}

        {totalReturnPurchases > 0 && (
          <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4">
            <div className="text-xs text-purple-500 mb-1">مرتجع مشتريات</div>
            <div className="text-xl font-bold text-purple-700">{totalReturnPurchases.toLocaleString()}</div>
            <div className="text-xs text-purple-400">{returnPurchases.length} فاتورة · {currency}</div>
          </div>
        )}

        {totalPending > 0 && (
          <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4">
            <div className="text-xs text-orange-500 mb-1">فواتير معلقة</div>
            <div className="text-xl font-bold text-orange-600">{totalPending.toLocaleString()}</div>
            <div className="text-xs text-orange-400">{pending.length} فاتورة · {currency}</div>
          </div>
        )}

        <div className={`border rounded-2xl p-4 lg:col-span-${totalReturnSales > 0 || totalReturnPurchases > 0 || totalPending > 0 ? "1" : "4"} ${netProfit >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
          <div className={`text-xs mb-1 ${netProfit >= 0 ? "text-emerald-500" : "text-red-500"}`}>
            صافي الربح (بيع - شراء)
          </div>
          <div className={`text-2xl font-bold ${netProfit >= 0 ? "text-emerald-700" : "text-red-700"}`}>
            {netProfit.toLocaleString()}
          </div>
          <div className={`text-xs ${netProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>{currency}</div>
        </div>
      </div>

      {/* لا توجد بيانات */}
      {allInvoices.length === 0 && allInstallments.length === 0 && (
        <div className="p-12 text-center text-gray-400">
          <Calendar size={48} className="mx-auto mb-3 opacity-30" />
          <div className="text-lg font-medium">لا توجد بيانات لهذا اليوم</div>
          <div className="text-sm mt-1">اختر تاريخاً آخر أو تأكد من إدخال فواتير</div>
        </div>
      )}

      {/* أقسام الفواتير قابلة للطي */}
      {allInvoices.length > 0 && (
        <div className="space-y-3">

          {/* كل الفواتير */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <SectionHeader
              id="invoices"
              title="جميع الفواتير"
              count={allInvoices.length}
              total={allInvoices.reduce((s, i) => s + i.total, 0)}
              color="bg-blue-50 text-blue-700"
            />
            {expandedSection === "invoices" && <InvoiceTable invoices={allInvoices} />}
          </div>

          {/* مبيعات */}
          {sales.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <SectionHeader
                id="sales"
                title="فواتير المبيعات"
                count={sales.length}
                total={totalSales}
                color="bg-blue-50 text-blue-700"
              />
              {expandedSection === "sales" && <InvoiceTable invoices={sales} />}
            </div>
          )}

          {/* مشتريات */}
          {purchases.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <SectionHeader
                id="purchases"
                title="فواتير المشتريات"
                count={purchases.length}
                total={totalPurchases}
                color="bg-green-50 text-green-700"
              />
              {expandedSection === "purchases" && <InvoiceTable invoices={purchases} />}
            </div>
          )}

          {/* صيانة */}
          {maintenance.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <SectionHeader
                id="maintenance"
                title="أوامر الصيانة"
                count={maintenance.length}
                total={totalMaintenance}
                color="bg-violet-50 text-violet-700"
              />
              {expandedSection === "maintenance" && <InvoiceTable invoices={maintenance} />}
            </div>
          )}

          {/* مرتجعات */}
          {(returnSales.length > 0 || returnPurchases.length > 0) && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <SectionHeader
                id="returns"
                title="المرتجعات"
                count={returnSales.length + returnPurchases.length}
                total={totalReturnSales + totalReturnPurchases}
                color="bg-orange-50 text-orange-700"
              />
              {expandedSection === "returns" && (
                <InvoiceTable invoices={[...returnSales, ...returnPurchases]} />
              )}
            </div>
          )}

          {/* معلقة */}
          {pending.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <SectionHeader
                id="pending"
                title="الفواتير المعلقة"
                count={pending.length}
                total={totalPending}
                color="bg-orange-50 text-orange-600"
              />
              {expandedSection === "pending" && <InvoiceTable invoices={pending} />}
            </div>
          )}
        </div>
      )}

      {/* الأقساط */}
      {allInstallments.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <button
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-semibold text-sm transition-colors ${expandedSection === "installments" ? "bg-indigo-50 text-indigo-700" : "bg-gray-50 text-gray-700 hover:bg-gray-100"}`}
            onClick={() => setExpandedSection(expandedSection === "installments" ? null : "installments")}
          >
            <div className="flex items-center gap-2">
              <DollarSign size={16} />
              <span>أقساط مستلمة</span>
              <span className="bg-white/60 px-2 py-0.5 rounded-full text-xs font-bold">{allInstallments.length}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-bold">{totalInstallments.toLocaleString()} {currency}</span>
              {expandedSection === "installments" ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </button>
          {expandedSection === "installments" && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs border-b border-gray-100">
                    <th className="px-3 py-2 text-right">الوقت</th>
                    <th className="px-3 py-2 text-right">العميل</th>
                    <th className="px-3 py-2 text-right">الهاتف</th>
                    <th className="px-3 py-2 text-right">المبلغ</th>
                    <th className="px-3 py-2 text-right">رقم الفاتورة</th>
                    <th className="px-3 py-2 text-right">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {allInstallments.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-xs text-gray-400">{p.time}</td>
                      <td className="px-3 py-2 font-semibold text-gray-800">{p.customerName}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs">{p.customerPhone || "-"}</td>
                      <td className="px-3 py-2 font-bold text-indigo-700">{p.amount.toLocaleString()} {currency}</td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-500">{p.invoiceRef || "-"}</td>
                      <td className="px-3 py-2 text-xs text-gray-400">{p.notes || "-"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-indigo-50 font-bold">
                    <td colSpan={3} className="px-3 py-2 text-indigo-700">الإجمالي</td>
                    <td className="px-3 py-2 text-indigo-700">{totalInstallments.toLocaleString()} {currency}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* نافذة تفاصيل الفاتورة */}
      {selectedInvoice && (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          currency={currency}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </div>
  );
}