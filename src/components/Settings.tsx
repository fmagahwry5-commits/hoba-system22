// src/components/Settings.tsx
import { useState, useRef } from "react";
import {
  Settings as SettingsIcon, Save, Store, Phone, MapPin,
  DollarSign, Percent, RefreshCw, CheckCircle, FileText,
  Printer, Download, Upload, Trash2, AlertTriangle,
  Database, Shield, Palette,
} from "lucide-react";
import { AppState } from "../types";
import { loadState, saveState } from "../store";

interface Props {
  state: AppState;
  onUpdate: (newState: AppState) => void;
}

export default function Settings({ state, onUpdate }: Props) {
  const [form, setForm] = useState({
    shopName:       state.settings?.shopName      ?? "مدير المبيعات",
    shopPhone:      state.settings?.shopPhone     ?? "",
    shopAddress:    state.settings?.shopAddress   ?? "",
    currency:       state.settings?.currency      ?? "EGP",
    taxRate:        state.settings?.taxRate       ?? 0,
    invoicePrefix:  state.settings?.invoicePrefix ?? "",
    autoStartShift: state.settings?.autoStartShift ?? true,
    printOnSave:    state.settings?.printOnSave   ?? false,
  });

  const [saved, setSaved]           = useState(false);
  const [showResetStock, setShowResetStock] = useState(false);
  const [showResetAll, setShowResetAll]     = useState(false);
  const [importStatus, setImportStatus]     = useState<"idle"|"success"|"error">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    const newState: AppState = {
      ...state,
      settings: {
        ...state.settings,
        shopName:       form.shopName.trim() || "مدير المبيعات",
        shopPhone:      form.shopPhone.trim(),
        shopAddress:    form.shopAddress.trim(),
        currency:       form.currency || "EGP",
        taxRate:        Number(form.taxRate) || 0,
        invoicePrefix:  form.invoicePrefix.trim(),
        autoStartShift: form.autoStartShift,
        printOnSave:    form.printOnSave,
      },
    };
    onUpdate(newState);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  // ✅ تصدير نسخة احتياطية JSON
  const handleExportBackup = () => {
    try {
      const data = JSON.stringify(state, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().split("T")[0];
      a.href = url;
      a.download = `backup_${form.shopName.replace(/\s+/g, "_")}_${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
      alert("حدث خطأ أثناء التصدير");
    }
  };

  // ✅ استيراد نسخة احتياطية JSON
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!data || typeof data !== "object" || !Array.isArray(data.invoices)) {
          throw new Error("ملف غير صالح");
        }
        onUpdate(data);
        setImportStatus("success");
        setTimeout(() => setImportStatus("idle"), 3000);
      } catch (err) {
        console.error("Import error:", err);
        setImportStatus("error");
        setTimeout(() => setImportStatus("idle"), 3000);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ✅ تصدير Excel (CSV)
  const handleExportExcel = () => {
    try {
      const invoices = state.invoices ?? [];
      if (invoices.length === 0) { alert("لا توجد فواتير للتصدير"); return; }
      const headers = ["رقم الفاتورة","النوع","الحالة","التاريخ","العميل/المورد","الهاتف","الإجمالي","المدفوع","المتبقي","ملاحظات"];
      const rows = invoices.map((inv) => [
        inv.number, inv.type, inv.status, inv.date,
        inv.customerName || inv.supplierName || "",
        inv.customerPhone || inv.supplierPhone || "",
        inv.total, inv.paid, inv.remaining, inv.notes || "",
      ]);
      const csv = "\uFEFF" + [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoices_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("حدث خطأ أثناء التصدير");
    }
  };

  // ✅ تصفير المخزن
  const handleResetStock = () => {
    const newProducts = (state.products ?? []).map((p) => ({ ...p, stock: 0 }));
    onUpdate({ ...state, products: newProducts });
    setShowResetStock(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  // ✅ تصفير كامل
  const handleResetAll = () => {
    localStorage.clear();
    window.location.reload();
  };

  // ✅ نسخ احتياطي تلقائي قبل الإغلاق
  if (typeof window !== "undefined") {
    window.onbeforeunload = () => {
      try {
        const data = JSON.stringify(loadState());
        localStorage.setItem("autoBackup", data);
        localStorage.setItem("autoBackupDate", new Date().toISOString());
      } catch {}
    };
  }

  const currencies = [
    { value: "EGP", label: "🇪🇬 جنيه مصري" },
    { value: "SAR", label: "🇸🇦 ريال سعودي" },
    { value: "AED", label: "🇦🇪 درهم إماراتي" },
    { value: "USD", label: "🇺🇸 دولار أمريكي" },
    { value: "EUR", label: "🇪🇺 يورو" },
    { value: "KWD", label: "🇰🇼 دينار كويتي" },
    { value: "QAR", label: "🇶🇦 ريال قطري" },
    { value: "JOD", label: "🇯🇴 دينار أردني" },
    { value: "LYD", label: "🇱🇾 دينار ليبي" },
    { value: "MAD", label: "🇲🇦 درهم مغربي" },
  ];

  return (
    <div className="space-y-5 max-w-4xl mx-auto" dir="rtl">

      {/* ── Header ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center">
              <SettingsIcon size={20} className="text-gray-600" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900">إعدادات النظام</h2>
              <p className="text-xs text-gray-400">تخصيص المتجر والنسخ الاحتياطي</p>
            </div>
          </div>
          <button onClick={handleSave} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 shadow-sm ${saved ? "bg-emerald-600 text-white" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
            {saved ? <><CheckCircle size={15} /> تم الحفظ ✓</> : <><Save size={15} /> حفظ</>}
          </button>
        </div>
        {saved && (
          <div className="mt-3 flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-2.5">
            <CheckCircle size={15} /><span className="text-sm font-semibold">تم حفظ الإعدادات بنجاح</span>
          </div>
        )}
      </div>

      {/* ── معلومات المتجر ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-3.5 border-b border-blue-100">
          <h3 className="font-bold text-blue-800 text-sm flex items-center gap-2"><Store size={16} /> معلومات المتجر</h3>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="text-xs font-bold text-gray-600 block mb-1.5">اسم المتجر</label>
            <input type="text" value={form.shopName} onChange={(e) => setForm((p) => ({ ...p, shopName: e.target.value }))}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400" placeholder="مدير المبيعات" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1.5">رقم الهاتف</label>
            <input type="tel" value={form.shopPhone} onChange={(e) => setForm((p) => ({ ...p, shopPhone: e.target.value }))}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400" placeholder="01xxxxxxxxx" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1.5">العنوان</label>
            <input type="text" value={form.shopAddress} onChange={(e) => setForm((p) => ({ ...p, shopAddress: e.target.value }))}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400" placeholder="عنوان المتجر" />
          </div>
        </div>
      </div>

      {/* ── الإعدادات المالية ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-50 to-green-50 px-5 py-3.5 border-b border-emerald-100">
          <h3 className="font-bold text-emerald-800 text-sm flex items-center gap-2"><DollarSign size={16} /> الإعدادات المالية</h3>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1.5">العملة</label>
            <select value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 bg-white">
              {currencies.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1.5">نسبة الضريبة (%)</label>
            <input type="number" min="0" max="100" step="0.5" value={form.taxRate}
              onChange={(e) => setForm((p) => ({ ...p, taxRate: Number(e.target.value) }))}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400" placeholder="0" />
            <p className="text-[10px] text-gray-400 mt-1">0 = بدون ضريبة</p>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1.5">بادئة رقم الفاتورة</label>
            <input type="text" value={form.invoicePrefix}
              onChange={(e) => setForm((p) => ({ ...p, invoicePrefix: e.target.value.toUpperCase().replace(/\s/g, "") }))}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 font-mono" placeholder="INV" maxLength={5} />
            <p className="text-[10px] text-gray-400 mt-1">مثال: INV → INV-0001</p>
          </div>
        </div>
      </div>

      {/* ── إعدادات الورديات ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-3.5 border-b border-amber-100">
          <h3 className="font-bold text-amber-800 text-sm flex items-center gap-2"><RefreshCw size={16} /> الورديات والفواتير</h3>
        </div>
        <div className="p-5 space-y-3">
          <label className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors">
            <div className="flex items-center gap-3">
              <RefreshCw size={16} className="text-gray-500" />
              <div><div className="text-sm font-semibold text-gray-700">فتح وردية جديدة تلقائياً</div><div className="text-[10px] text-gray-400">عند إغلاق الوردية</div></div>
            </div>
            <input type="checkbox" checked={form.autoStartShift} onChange={(e) => setForm((p) => ({ ...p, autoStartShift: e.target.checked }))} className="w-5 h-5 rounded accent-blue-600" />
          </label>
          <label className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors">
            <div className="flex items-center gap-3">
              <Printer size={16} className="text-gray-500" />
              <div><div className="text-sm font-semibold text-gray-700">طباعة تلقائية عند الحفظ</div><div className="text-[10px] text-gray-400">طباعة الفاتورة عند إغلاقها</div></div>
            </div>
            <input type="checkbox" checked={form.printOnSave} onChange={(e) => setForm((p) => ({ ...p, printOnSave: e.target.checked }))} className="w-5 h-5 rounded accent-blue-600" />
          </label>
        </div>
      </div>

      {/* ── النسخ الاحتياطي ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-5 py-3.5 border-b border-indigo-100">
          <h3 className="font-bold text-indigo-800 text-sm flex items-center gap-2"><Database size={16} /> النسخ الاحتياطي والاستيراد</h3>
        </div>
        <div className="p-5 space-y-4">
          {/* تصدير JSON */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button onClick={handleExportBackup}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 active:scale-95 transition-all shadow-sm">
              <Download size={16} /> تصدير نسخة احتياطية (JSON)
            </button>
            <div>
              <input type="file" accept=".json" ref={fileInputRef} onChange={handleImportBackup} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 active:scale-95 transition-all shadow-sm">
                <Upload size={16} /> استيراد نسخة احتياطية (JSON)
              </button>
            </div>
          </div>

          {/* تصدير Excel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button onClick={handleExportExcel}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 active:scale-95 transition-all shadow-sm">
              <FileText size={16} /> تصدير الفواتير (Excel/CSV)
            </button>
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-xl border border-gray-200">
              <Shield size={16} className="text-gray-400" />
              <div>
                <div className="text-xs font-semibold text-gray-600">نسخ تلقائي</div>
                <div className="text-[10px] text-gray-400">
                  {localStorage.getItem("autoBackupDate")
                    ? `آخر نسخة: ${new Date(localStorage.getItem("autoBackupDate")!).toLocaleString("ar-EG")}`
                    : "لم يتم بعد"}
                </div>
              </div>
            </div>
          </div>

          {/* استيراد من نسخة تلقائية */}
          {localStorage.getItem("autoBackup") && (
            <button onClick={() => {
              try {
                const backup = JSON.parse(localStorage.getItem("autoBackup")!);
                if (backup && typeof backup === "object") {
                  onUpdate(backup);
                  setImportStatus("success");
                  setTimeout(() => setImportStatus("idle"), 3000);
                }
              } catch { setImportStatus("error"); setTimeout(() => setImportStatus("idle"), 3000); }
            }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-700 rounded-xl text-sm font-bold hover:bg-blue-100 border border-blue-200 transition-colors">
              <RefreshCw size={14} /> استعادة آخر نسخة تلقائية
            </button>
          )}

          {importStatus === "success" && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-2.5">
              <CheckCircle size={15} /><span className="text-sm font-semibold">تم الاستيراد بنجاح ✓</span>
            </div>
          )}
          {importStatus === "error" && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5">
              <AlertTriangle size={15} /><span className="text-sm font-semibold">فشل الاستيراد — الملف غير صالح</span>
            </div>
          )}
        </div>
      </div>

      {/* ── المنطقة الخطرة ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden">
        <div className="bg-gradient-to-r from-red-50 to-orange-50 px-5 py-3.5 border-b border-red-100">
          <h3 className="font-bold text-red-800 text-sm flex items-center gap-2"><AlertTriangle size={16} /> منطقة خطرة</h3>
        </div>
        <div className="p-5 space-y-3">
          {/* تصفير المخزن */}
          <div className="flex items-center justify-between p-3.5 bg-red-50/50 rounded-xl border border-red-100">
            <div>
              <div className="text-sm font-semibold text-gray-700">تصفير المخزن بالكامل</div>
              <div className="text-[10px] text-gray-400">تعيين جميع أرصدة المنتجات إلى صفر</div>
            </div>
            <button onClick={() => setShowResetStock(true)}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg text-xs font-bold hover:bg-orange-700 active:scale-95">
              <Trash2 size={13} className="inline ml-1" /> تصفير المخزن
            </button>
          </div>

          {/* تصفير كامل */}
          <div className="flex items-center justify-between p-3.5 bg-red-50/50 rounded-xl border border-red-100">
            <div>
              <div className="text-sm font-semibold text-red-700">حذف جميع البيانات</div>
              <div className="text-[10px] text-gray-400">حذف كل شيء وإعادة تشغيل البرنامج</div>
            </div>
            <button onClick={() => setShowResetAll(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 active:scale-95">
              <Trash2 size={13} className="inline ml-1" /> حذف الكل
            </button>
          </div>
        </div>
      </div>

      {/* ── زر الحفظ السفلي ── */}
      <div className="flex justify-end pb-4">
        <button onClick={handleSave}
          className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-base shadow-lg active:scale-95 transition-all ${saved ? "bg-emerald-600 text-white shadow-emerald-200" : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200"}`}>
          {saved ? <><CheckCircle size={18} /> تم الحفظ ✓</> : <><Save size={18} /> حفظ جميع الإعدادات</>}
        </button>
      </div>

      {/* ── مودال تصفير المخزن ── */}
      {showResetStock && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full">
            <div className="text-center mb-4">
              <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-3"><AlertTriangle size={24} className="text-orange-500" /></div>
              <h3 className="text-lg font-bold text-gray-800 mb-1">تصفير المخزن</h3>
              <p className="text-gray-500 text-sm">سيتم تعيين جميع أرصدة المنتجات ({(state.products??[]).length} منتج) إلى صفر. لا يمكن التراجع.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={handleResetStock} className="flex-1 py-2.5 bg-orange-600 text-white rounded-xl font-semibold hover:bg-orange-700 active:scale-95">تصفير</button>
              <button onClick={() => setShowResetStock(false)} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* ── مودال حذف الكل ── */}
      {showResetAll && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full">
            <div className="text-center mb-4">
              <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-3"><Trash2 size={24} className="text-red-500" /></div>
              <h3 className="text-lg font-bold text-gray-800 mb-1">حذف جميع البيانات</h3>
              <p className="text-red-600 text-sm font-semibold">⚠️ سيتم حذف كل شيء نهائياً!</p>
              <p className="text-gray-500 text-xs mt-1">يُنصح بتصدير نسخة احتياطية أولاً</p>
            </div>
            <div className="flex gap-3">
              <button onClick={handleResetAll} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 active:scale-95">حذف نهائي</button>
              <button onClick={() => setShowResetAll(false)} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}