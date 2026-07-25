import { useState, useEffect, useCallback } from "react";
import {
  Invoice, MaintenanceInfo, MaintenanceStatus, InvoiceItem,
} from "../types";
import { generateId, generateInvoiceNumber } from "../store";
import {
  X, Wrench, Smartphone, User, Phone,
  Clock, CheckCircle, Lock, Download,
} from "lucide-react";
import { exportSingleInvoiceToExcel } from "../utils/export";

interface Props {
  existingInvoice?: Invoice | null;
  invoices: Invoice[];
  settings: {
    shopName: string;
    shopPhone: string;
    shopAddress: string;
    currency: string;
    taxRate: number;
  };
  onSave: (invoice: Invoice) => void;
  onClose: () => void;
}

const maintenanceStatusOptions: { value: MaintenanceStatus; label: string; color: string }[] = [
  { value: "received", label: "تم الاستلام", color: "bg-gray-100 text-gray-700" },
  { value: "diagnosing", label: "جاري الفحص", color: "bg-yellow-100 text-yellow-700" },
  { value: "waiting_parts", label: "انتظار قطع غيار", color: "bg-orange-100 text-orange-700" },
  { value: "repairing", label: "جاري الإصلاح", color: "bg-blue-100 text-blue-700" },
  { value: "ready", label: "جاهز للتسليم", color: "bg-emerald-100 text-emerald-700" },
  { value: "delivered", label: "تم التسليم", color: "bg-purple-100 text-purple-700" },
];

const now = () => {
  const d = new Date();
  return {
    date: d.toISOString().slice(0, 10),
    time: d.toTimeString().slice(0, 5),
  };
};

const defaultMaintenance: MaintenanceInfo = {
  deviceType: "موبايل",
  deviceBrand: "",
  deviceModel: "",
  imei: "",
  color: "",
  customerComplaint: "",
  diagnosis: "",
  repairCost: 0,
  advancePayment: 0,
  maintenanceStatus: "received",
  receivedAt: new Date().toISOString(),
  deliveredAt: undefined,
  technician: "",
  accessories: "",
  warrantyDays: 0,
};

export default function MaintenanceForm({
  existingInvoice,
  invoices,
  settings,
  onSave,
  onClose,
}: Props) {
  const [invoice, setInvoice] = useState<Invoice>(() => {
    if (existingInvoice) return { ...existingInvoice };
    const { date, time } = now();
    return {
      id: generateId(),
      type: "maintenance",
      status: "open",
      number: generateInvoiceNumber("MNT", invoices),
      date,
      time,
      customerName: "",
      customerPhone: "",
      items: [],
      subtotal: 0,
      discount: 0,
      tax: 0,
      total: 0,
      paid: 0,
      remaining: 0,
      notes: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      maintenanceInfo: { ...defaultMaintenance },
    };
  });

  const info = invoice.maintenanceInfo ?? { ...defaultMaintenance };

  const updateInfo = (field: keyof MaintenanceInfo, value: any) => {
    setInvoice((prev) => ({
      ...prev,
      maintenanceInfo: { ...(prev.maintenanceInfo ?? defaultMaintenance), [field]: value },
    }));
  };

  useEffect(() => {
    const repairCost = info.repairCost ?? 0;
    const discount = invoice.discount ?? 0;
    const tax = (repairCost - discount) * ((settings.taxRate ?? 0) / 100);
    const total = repairCost - discount + tax;
    const remaining = total - (info.advancePayment ?? 0);
    setInvoice((prev) => ({
      ...prev,
      subtotal: repairCost,
      tax,
      total,
      paid: info.advancePayment ?? 0,
      remaining,
    }));
  }, [info.repairCost, info.advancePayment, invoice.discount, settings.taxRate]);

  const handleSave = (status: "open" | "closed" | "pending") => {
    const updated: Invoice = {
      ...invoice,
      status,
      updatedAt: new Date().toISOString(),
      maintenanceInfo: {
        ...info,
        deliveredAt: status === "closed" ? new Date().toISOString() : info.deliveredAt,
        maintenanceStatus: status === "closed" ? "delivered" : info.maintenanceStatus,
      },
    };
    onSave(updated);
  };

  const currentStatusInfo = maintenanceStatusOptions.find(
    (s) => s.value === info.maintenanceStatus
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[96vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between bg-gradient-to-r from-violet-600 to-purple-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Wrench size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">
                أمر صيانة — {invoice.number}
              </h2>
              <p className="text-white/70 text-sm">{invoice.date} — {invoice.time}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${currentStatusInfo?.color ?? "bg-gray-100 text-gray-700"}`}>
              {currentStatusInfo?.label ?? "مفتوحة"}
            </span>
            <button onClick={onClose} className="text-white/80 hover:text-white">
              <X size={22} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* بيانات العميل */}
          <div className="bg-gray-50 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <User size={16} className="text-violet-600" />
              <h3 className="font-semibold text-gray-700 text-sm">بيانات العميل</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">اسم العميل</label>
                <input
                  value={invoice.customerName}
                  onChange={(e) => setInvoice((p) => ({ ...p, customerName: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                  placeholder="اسم العميل"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">رقم الهاتف</label>
                <input
                  value={invoice.customerPhone}
                  onChange={(e) => setInvoice((p) => ({ ...p, customerPhone: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                  placeholder="رقم الهاتف"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">تاريخ الاستلام</label>
                <input
                  type="date"
                  value={invoice.date}
                  onChange={(e) => setInvoice((p) => ({ ...p, date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </div>
            </div>
          </div>

          {/* بيانات الجهاز */}
          <div className="bg-violet-50 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Smartphone size={16} className="text-violet-600" />
              <h3 className="font-semibold text-gray-700 text-sm">بيانات الجهاز</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">نوع الجهاز</label>
                <select
                  value={info.deviceType}
                  onChange={(e) => updateInfo("deviceType", e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                >
                  <option>موبايل</option>
                  <option>تابلت</option>
                  <option>لابتوب</option>
                  <option>ساعة ذكية</option>
                  <option>أخرى</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">الماركة</label>
                <input
                  value={info.deviceBrand}
                  onChange={(e) => updateInfo("deviceBrand", e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                  placeholder="Samsung / Apple ..."
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">الموديل</label>
                <input
                  value={info.deviceModel}
                  onChange={(e) => updateInfo("deviceModel", e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                  placeholder="A54 / iPhone 14..."
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">اللون</label>
                <input
                  value={info.color}
                  onChange={(e) => updateInfo("color", e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                  placeholder="أسود / أبيض..."
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">IMEI / Serial</label>
                <input
                  value={info.imei}
                  onChange={(e) => updateInfo("imei", e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                  placeholder="رقم IMEI أو Serial Number"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">الإكسسوارات المستلمة</label>
                <input
                  value={info.accessories}
                  onChange={(e) => updateInfo("accessories", e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                  placeholder="شاحن / كفر / سماعة..."
                />
              </div>
            </div>
          </div>

          {/* العطل والإصلاح */}
          <div className="bg-orange-50 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Wrench size={16} className="text-orange-600" />
              <h3 className="font-semibold text-gray-700 text-sm">تفاصيل العطل والإصلاح</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">شكوى العميل</label>
                <textarea
                  value={info.customerComplaint}
                  onChange={(e) => updateInfo("customerComplaint", e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                  rows={3}
                  placeholder="ما المشكلة التي يعاني منها الجهاز؟"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">التشخيص</label>
                <textarea
                  value={info.diagnosis}
                  onChange={(e) => updateInfo("diagnosis", e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                  rows={3}
                  placeholder="نتيجة الفحص والتشخيص..."
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">الفني المسؤول</label>
                <input
                  value={info.technician}
                  onChange={(e) => updateInfo("technician", e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="اسم الفني"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">ضمان الإصلاح (أيام)</label>
                <input
                  type="number"
                  min="0"
                  value={info.warrantyDays}
                  onChange={(e) => updateInfo("warrantyDays", Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* حالة الصيانة */}
          <div className="bg-blue-50 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={16} className="text-blue-600" />
              <h3 className="font-semibold text-gray-700 text-sm">حالة الصيانة</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {maintenanceStatusOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => updateInfo("maintenanceStatus", opt.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border-2 transition-all ${
                    info.maintenanceStatus === opt.value
                      ? `${opt.color} border-current`
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* الحساب */}
          <div className="bg-emerald-50 rounded-2xl p-4">
            <h3 className="font-semibold text-gray-700 text-sm mb-3">الحساب والدفع</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">تكلفة الإصلاح</label>
                <input
                  type="number"
                  min="0"
                  value={info.repairCost}
                  onChange={(e) => updateInfo("repairCost", Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">خصم</label>
                <input
                  type="number"
                  min="0"
                  value={invoice.discount}
                  onChange={(e) => setInvoice((p) => ({ ...p, discount: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">عربون / مقدم</label>
                <input
                  type="number"
                  min="0"
                  value={info.advancePayment}
                  onChange={(e) => updateInfo("advancePayment", Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">الباقي</label>
                <div className={`w-full border rounded-xl px-3 py-2 text-sm font-bold text-center ${invoice.remaining > 0 ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
                  {invoice.remaining.toFixed(2)} {settings.currency}
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              <div className="flex justify-between bg-white rounded-xl px-3 py-2">
                <span className="text-gray-500">الإجمالي:</span>
                <span className="font-bold text-violet-700">{invoice.total.toFixed(2)} {settings.currency}</span>
              </div>
              <div className="flex justify-between bg-white rounded-xl px-3 py-2">
                <span className="text-gray-500">المدفوع:</span>
                <span className="font-bold text-emerald-700">{(info.advancePayment ?? 0).toFixed(2)} {settings.currency}</span>
              </div>
              <div className={`flex justify-between rounded-xl px-3 py-2 ${invoice.remaining > 0 ? "bg-red-50" : "bg-emerald-50"}`}>
                <span className="text-gray-500">الباقي:</span>
                <span className={`font-bold ${invoice.remaining > 0 ? "text-red-700" : "text-emerald-700"}`}>
                  {invoice.remaining.toFixed(2)} {settings.currency}
                </span>
              </div>
            </div>
          </div>

          {/* ملاحظات */}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1 block">ملاحظات إضافية</label>
            <textarea
              value={invoice.notes}
              onChange={(e) => setInvoice((p) => ({ ...p, notes: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
              rows={2}
              placeholder="أي ملاحظات إضافية..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-wrap gap-2 justify-between items-center">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-100 text-sm"
          >
            <X size={16} /> إلغاء
          </button>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => exportSingleInvoiceToExcel(invoice, settings.shopName, settings.currency)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-700 hover:bg-emerald-100 text-sm"
            >
              <Download size={16} /> تصدير
            </button>
            <button
              onClick={() => handleSave("pending")}
              className="flex items-center gap-2 px-4 py-2 bg-orange-50 border border-orange-300 rounded-xl text-orange-700 hover:bg-orange-100 text-sm"
            >
              <Clock size={16} /> تعليق
            </button>
            <button
              onClick={() => handleSave("open")}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-300 rounded-xl text-blue-700 hover:bg-blue-100 text-sm"
            >
              <CheckCircle size={16} /> حفظ
            </button>
            <button
              onClick={() => handleSave("closed")}
              className="flex items-center gap-2 px-5 py-2 bg-violet-600 text-white rounded-xl font-semibold hover:bg-violet-700 text-sm shadow-md"
            >
              <Lock size={16} /> تسليم وإغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}