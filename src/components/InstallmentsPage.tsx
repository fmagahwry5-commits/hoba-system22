import { useState, useMemo } from "react";
import { InstallmentPayment, InstallmentsLedger } from "../types";
import {
  Plus, Search, DollarSign, Calendar, User,
  Printer, Minus, RefreshCw, AlertTriangle, Download,
  TrendingUp, X,
} from "lucide-react";
import * as XLSX from "xlsx";

interface Props {
  ledger: InstallmentsLedger;
  currency: string;
  shiftId?: string;
  onAdd: (payment: Omit<InstallmentPayment, "id" | "date" | "time">) => void;
  onWithdraw?: (amount: number, desc: string) => void;
  onReset?: () => void;
}

function exportInstallmentsToExcel(
  payments: InstallmentPayment[],
  currency: string,
  label: string = "سجل_الأقساط"
) {
  const rows = payments.map((p, idx) => ({
    "#": idx + 1,
    "التاريخ": p.date,
    "الوقت": p.time,
    "اسم العميل": p.customerName,
    "رقم الهاتف": p.customerPhone || "-",
    [`المبلغ (${currency})`]: p.amount,
    "رقم الفاتورة": p.invoiceRef || "-",
    "ملاحظات": p.notes || "-",
  }));

  rows.push({
    "#": "",
    "التاريخ": "الإجمالي",
    "الوقت": "",
    "اسم العميل": `${payments.length} دفعة`,
    "رقم الهاتف": "",
    [`المبلغ (${currency})`]: payments.reduce((s, p) => s + p.amount, 0),
    "رقم الفاتورة": "",
    "ملاحظات": "",
  } as any);

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 5 }, { wch: 12 }, { wch: 8 }, { wch: 20 },
    { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "الأقساط");
  XLSX.writeFile(wb, `${label}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export default function InstallmentsPage({
  ledger, currency, shiftId, onAdd, onWithdraw, onReset,
}: Props) {
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<"all" | "today">("all");
  const [showModal, setShowModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState(0);
  const [withdrawDesc, setWithdrawDesc] = useState("");
  const [form, setForm] = useState({
    customerName: "", customerPhone: "", amount: 0, invoiceRef: "", notes: "",
  });

  const safePayments = Array.isArray(ledger?.payments) ? ledger.payments : [];
  const today = new Date().toLocaleDateString("ar-EG");
  const todayPayments = safePayments.filter((p) => p.date === today);
  const todayTotal = todayPayments.reduce((s, p) => s + p.amount, 0);
  const totalReceived = ledger?.totalReceived ?? 0;

  const filtered = useMemo(() => {
    return safePayments
      .filter((p) => {
        const q = search.toLowerCase();
        const matchSearch =
          !search.trim() ||
          (p.customerName ?? "").toLowerCase().includes(q) ||
          (p.customerPhone ?? "").includes(search) ||
          (p.invoiceRef ?? "").toLowerCase().includes(q) ||
          (p.date ?? "").includes(search);
        const matchDate =
          dateFilter === "today" ? p.date === today : true;
        return matchSearch && matchDate;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
  }, [safePayments, search, dateFilter, today]);

  const stats = useMemo(() => {
    const uniqueCustomers = new Set(safePayments.map(p => p.customerName)).size;
    const avgPayment = safePayments.length > 0 ? totalReceived / safePayments.length : 0;
    return { uniqueCustomers, avgPayment };
  }, [safePayments, totalReceived]);

  const handleAdd = () => {
    if (!form.customerName.trim() || !form.amount || form.amount <= 0) return;
    onAdd({
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      amount: form.amount,
      invoiceRef: form.invoiceRef,
      notes: form.notes,
      shiftId,
    });
    setForm({ customerName: "", customerPhone: "", amount: 0, invoiceRef: "", notes: "" });
    setShowModal(false);
  };

  const handleWithdraw = () => {
    if (!withdrawAmount || withdrawAmount <= 0) return;
    onWithdraw?.(withdrawAmount, withdrawDesc || "سحب من رصيد الأقساط");
    setWithdrawAmount(0);
    setWithdrawDesc("");
    setShowWithdrawModal(false);
  };

  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html dir="rtl"><head><meta charset="UTF-8"/><title>سجل الأقساط</title>
      <style>
        body{font-family:Arial;padding:20px;direction:rtl}
        h1{text-align:center;color:#4f46e5;margin-bottom:5px}
        .subtitle{text-align:center;color:#6b7280;font-size:12px;margin-bottom:20px}
        .stats{display:flex;gap:15px;margin:15px 0;flex-wrap:wrap}
        .stat-box{background:#f3f4f6;border-radius:8px;padding:12px;text-align:center;flex:1;min-width:100px}
        .stat-value{font-weight:bold;color:#4f46e5;font-size:18px}
        table{width:100%;border-collapse:collapse;margin-top:15px}
        th{background:#4f46e5;color:white;padding:8px;font-size:12px}
        td{padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px}
        tr:nth-child(even){background:#f9fafb}
        .total-row{font-weight:bold;background:#eef2ff!important;color:#4338ca}
        .amount{color:#059669;font-weight:bold}
      </style></head>
      <body>
        <h1>💰 سجل أقساط العملاء</h1>
        <div class="subtitle">تاريخ الطباعة: ${new Date().toLocaleDateString("ar-EG")} - ${new Date().toLocaleTimeString("ar-EG")}</div>
        <div class="stats">
          <div class="stat-box"><div>إجمالي اليوم</div><div class="stat-value">${todayTotal.toLocaleString()} ${currency}</div></div>
          <div class="stat-box"><div>إجمالي المستلم</div><div class="stat-value">${totalReceived.toLocaleString()} ${currency}</div></div>
          <div class="stat-box"><div>عدد الدفعات</div><div class="stat-value">${safePayments.length}</div></div>
          <div class="stat-box"><div>عدد العملاء</div><div class="stat-value">${stats.uniqueCustomers}</div></div>
        </div>
        <table>
          <tr><th>#</th><th>التاريخ</th><th>الوقت</th><th>العميل</th><th>الهاتف</th><th>المبلغ</th><th>الفاتورة</th><th>ملاحظات</th></tr>
          ${filtered.map((p, i) => `<tr>
            <td>${i + 1}</td>
            <td>${p.date}</td><td>${p.time}</td>
            <td>${p.customerName}</td>
            <td>${p.customerPhone || "-"}</td>
            <td class="amount">${p.amount.toLocaleString()} ${currency}</td>
            <td>${p.invoiceRef || "-"}</td><td>${p.notes || "-"}</td>
          </tr>`).join("")}
          <tr class="total-row">
            <td colspan="5">الإجمالي (${filtered.length} دفعة)</td>
            <td>${filtered.reduce((s, p) => s + p.amount, 0).toLocaleString()} ${currency}</td>
            <td colspan="2"></td>
          </tr>
        </table>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <div className="space-y-5" dir="rtl">

      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-500 to-indigo-700 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <DollarSign size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold">أقساط العملاء</h2>
              <p className="text-indigo-200 text-sm">{safePayments.length} دفعة إجمالاً</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => exportInstallmentsToExcel(filtered, currency)}
              className="flex items-center gap-2 px-3 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-semibold transition-colors"
            >
              <Download size={15} /> Excel
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-semibold transition-colors"
            >
              <Printer size={15} /> طباعة
            </button>
            {onWithdraw && (
              <button
                onClick={() => setShowWithdrawModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-semibold transition-colors"
              >
                <Minus size={15} /> سحب
              </button>
            )}
            {onReset && (
              <button
                onClick={onReset}
                className="flex items-center gap-2 px-3 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-semibold transition-colors"
              >
                <RefreshCw size={15} /> تصفير
              </button>
            )}
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-700 rounded-xl text-sm font-bold hover:bg-indigo-50 transition-colors shadow-md"
            >
              <Plus size={15} /> استلام قسط
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "إجمالي اليوم", value: todayTotal.toLocaleString(), unit: currency },
            { label: "إجمالي مستلم", value: totalReceived.toLocaleString(), unit: currency },
            { label: "عدد الدفعات", value: safePayments.length, unit: "دفعة" },
            { label: "عدد العملاء", value: stats.uniqueCustomers, unit: "عميل" },
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
          {
            label: "إجمالي اليوم", value: todayTotal.toLocaleString(), unit: currency,
            sub: `${todayPayments.length} دفعة`,
            icon: Calendar, bg: "bg-indigo-50", border: "border-indigo-100", text: "text-indigo-700",
          },
          {
            label: "إجمالي مستلم", value: totalReceived.toLocaleString(), unit: currency,
            sub: `${safePayments.length} دفعة`,
            icon: TrendingUp, bg: "bg-emerald-50", border: "border-emerald-100", text: "text-emerald-700",
          },
          {
            label: "متوسط الدفعة", value: Math.round(stats.avgPayment).toLocaleString(), unit: currency,
            sub: "متوسط",
            icon: DollarSign, bg: "bg-blue-50", border: "border-blue-100", text: "text-blue-700",
          },
          {
            label: "عدد العملاء", value: stats.uniqueCustomers, unit: "عميل",
            sub: "مختلف",
            icon: User, bg: "bg-violet-50", border: "border-violet-100", text: "text-violet-700",
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
              <div className="text-xs text-gray-400 mt-0.5">{card.unit} · {card.sub}</div>
            </div>
          );
        })}
      </div>

      {/* مدفوعات اليوم */}
      {todayPayments.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
          <div className="font-semibold text-indigo-700 mb-3 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Calendar size={16} />
              مدفوعات اليوم ({today})
            </div>
            <button
              onClick={() => exportInstallmentsToExcel(todayPayments, currency, "اقساط_اليوم")}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg text-xs font-semibold transition-colors"
            >
              <Download size={12} /> تصدير اليوم
            </button>
          </div>
          <div className="space-y-2">
            {todayPayments.map((p) => (
              <div key={p.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-2.5 border border-indigo-100">
                <div>
                  <span className="font-semibold text-gray-800 text-sm">{p.customerName}</span>
                  {p.customerPhone && <span className="text-gray-400 text-xs mr-2">· {p.customerPhone}</span>}
                  {p.invoiceRef && <span className="text-indigo-500 text-xs mr-2">· {p.invoiceRef}</span>}
                  {p.notes && <span className="text-gray-400 text-xs mr-2">· {p.notes}</span>}
                </div>
                <div className="text-right">
                  <div className="font-bold text-indigo-700">{p.amount.toLocaleString()} {currency}</div>
                  <div className="text-xs text-gray-400">{p.time}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between font-bold text-indigo-700 mt-3 pt-3 border-t border-indigo-200">
            <span>إجمالي اليوم ({todayPayments.length} دفعة)</span>
            <span>{todayTotal.toLocaleString()} {currency}</span>
          </div>
        </div>
      )}

      {/* شريط البحث والفلاتر */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
        <div className="relative">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالاسم أو الهاتف أو رقم الفاتورة أو التاريخ..."
            className="w-full pr-9 pl-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex gap-2 flex-wrap items-center justify-between">
          <div className="flex gap-2">
            {[
              { val: "all", label: `الكل (${safePayments.length})` },
              { val: "today", label: `اليوم (${todayPayments.length})` },
            ].map((f) => (
              <button
                key={f.val}
                onClick={() => setDateFilter(f.val as any)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${dateFilter === f.val ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => exportInstallmentsToExcel(filtered, currency)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-semibold hover:bg-emerald-100 transition-colors"
          >
            <Download size={13} /> تصدير Excel ({filtered.length})
          </button>
        </div>
      </div>

      {/* جدول الأقساط */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b font-semibold text-gray-700 text-sm flex items-center justify-between">
          <span>السجل الكامل ({filtered.length} دفعة)</span>
          <span className="text-indigo-600 font-bold">
            {filtered.reduce((s, p) => s + p.amount, 0).toLocaleString()} {currency}
          </span>
        </div>
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <DollarSign size={48} className="mx-auto mb-3 opacity-20" />
            <div className="font-medium">لا توجد مدفوعات</div>
            {search && <div className="text-sm mt-1">جرّب البحث بكلمة مختلفة</div>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs">
                  <th className="px-3 py-2.5 text-right">#</th>
                  <th className="px-3 py-2.5 text-right">التاريخ</th>
                  <th className="px-3 py-2.5 text-right">الوقت</th>
                  <th className="px-3 py-2.5 text-right">العميل</th>
                  <th className="px-3 py-2.5 text-right">الهاتف</th>
                  <th className="px-3 py-2.5 text-right">المبلغ</th>
                  <th className="px-3 py-2.5 text-right">رقم الفاتورة</th>
                  <th className="px-3 py-2.5 text-right">ملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((p, idx) => (
                  <tr
                    key={p.id}
                    className={`hover:bg-indigo-50/30 transition-colors ${p.date === today ? "bg-indigo-50/20" : ""}`}
                  >
                    <td className="px-3 py-2.5 text-xs text-gray-400">{idx + 1}</td>
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                      {p.date === today
                        ? <span className="text-indigo-600 font-semibold">اليوم</span>
                        : <span className="text-gray-500">{p.date}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-400">{p.time}</td>
                    <td className="px-3 py-2.5 font-semibold text-gray-800">{p.customerName}</td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs">{p.customerPhone || "-"}</td>
                    <td className="px-3 py-2.5 font-bold text-indigo-700 whitespace-nowrap">
                      {p.amount.toLocaleString()} {currency}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-gray-500">{p.invoiceRef || "-"}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-400">{p.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-indigo-50 font-bold border-t-2 border-indigo-100">
                  <td colSpan={5} className="px-3 py-2.5 text-indigo-700">
                    الإجمالي ({filtered.length} دفعة)
                  </td>
                  <td className="px-3 py-2.5 text-indigo-700">
                    {filtered.reduce((s, p) => s + p.amount, 0).toLocaleString()} {currency}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* نافذة استلام قسط */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 text-lg">استلام قسط من عميل</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-600 mb-1 block font-medium">اسم العميل *</label>
                <input
                  type="text" value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="اسم العميل" autoFocus
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block font-medium">رقم الهاتف</label>
                <input
                  type="tel" value={form.customerPhone}
                  onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="01xxxxxxxxx"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block font-medium">المبلغ *</label>
                <input
                  type="number" min="1" value={form.amount || ""}
                  onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                  className="w-full border-2 border-indigo-200 rounded-xl px-3 py-3 text-xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="0.00"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm text-gray-600 mb-1 block font-medium">رقم الفاتورة</label>
                  <input
                    type="text" value={form.invoiceRef}
                    onChange={(e) => setForm({ ...form, invoiceRef: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    placeholder="اختياري"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600 mb-1 block font-medium">ملاحظات</label>
                  <input
                    type="text" value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    placeholder="اختياري"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={handleAdd}
                disabled={!form.customerName.trim() || !form.amount || form.amount <= 0}
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 active:scale-95 transition-all"
              >
                تأكيد الاستلام
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
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
                <h3 className="font-bold text-gray-800">سحب من رصيد الأقساط</h3>
                <p className="text-xs text-gray-400">الرصيد المتاح: {totalReceived.toLocaleString()} {currency}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-600 mb-1 block font-medium">المبلغ *</label>
                <input
                  type="number" min="1" value={withdrawAmount || ""}
                  onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                  className="w-full border-2 border-orange-200 rounded-xl px-3 py-3 text-xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-orange-300"
                  placeholder="0.00" autoFocus
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block font-medium">السبب</label>
                <input
                  type="text" value={withdrawDesc} onChange={(e) => setWithdrawDesc(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                  placeholder="سبب السحب"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={handleWithdraw}
                disabled={!withdrawAmount || withdrawAmount <= 0}
                className="flex-1 py-2.5 bg-orange-600 text-white rounded-xl font-semibold hover:bg-orange-700 disabled:opacity-50 active:scale-95 transition-all"
              >
                تأكيد السحب
              </button>
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all"
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