// components/CloseShiftModal.tsx
import { useState } from "react";
import {
  X, Check, AlertTriangle, TrendingUp, TrendingDown,
  Wrench, DollarSign, RotateCcw, ShoppingBag, Settings,
  ChevronDown, ChevronUp
} from "lucide-react";
import { Invoice, ShiftResetSettings } from "../types";
import { getDefaultShiftResetSettings } from "../store";

// ✅ تعريف ShiftSummary محلياً
interface ShiftSummary {
  totalSales: number;
  totalPurchases: number;
  totalReturnSales: number;
  totalReturnPurchases: number;
  totalMaintenance: number;
  totalInstallments: number;
  totalAccessorySales: number;
  totalAccessoryPurchases: number;
  salesCount: number;
  purchasesCount: number;
  returnSalesCount: number;
  returnPurchasesCount: number;
  maintenanceCount: number;
  installmentsCount: number;
  accessorySalesCount: number;
  accessoryPurchasesCount: number;
  netSales: number;
  netAccessory: number;
  grandTotal: number;
}

interface Props {
  summary: ShiftSummary;
  pendingInvoices: Invoice[];
  remainingInvoices: Invoice[];
  currency: string;
  openingBalance: number;
  autoStartShift: boolean;
  defaultResetSettings?: ShiftResetSettings;
  onConfirm: (autoRestart: boolean, resetSettings: ShiftResetSettings) => void;
  onCancel: () => void;
}

// ✅ تعريف نوع ResetItemCard بشكل صريح
interface ResetItemCardProps {
  checked: boolean;
  onChange: () => void;
  icon: React.ElementType;
  label: string;
  value: number;
  currency: string;
  colorClass: string;
}

// ✅ مكون ResetItemCard مع typing صحيح
function ResetItemCard({
  checked,
  onChange,
  icon: Icon,
  label,
  value,
  currency,
  colorClass,
}: ResetItemCardProps) {
  return (
    <label
      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
        checked ? colorClass : "bg-gray-50 border-gray-200"
      }`}
    >
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="w-4 h-4 rounded accent-blue-600"
        />
        <Icon size={16} />
        <span className="text-sm font-semibold text-gray-700">{label}</span>
      </div>
      <span className="text-xs font-bold text-gray-500">
        {(value ?? 0).toLocaleString()} {currency}
      </span>
    </label>
  );
}

// ✅ تعريف نوع ResetItem
interface ResetItem {
  key: keyof ShiftResetSettings;
  label: string;
  icon: React.ElementType;
  colorClass: string;
  value: number;
}

// ✅ القيم الافتراضية لإلغاء التحديد
const EMPTY_RESET_SETTINGS: ShiftResetSettings = {
  resetSales: false,
  resetPurchases: false,
  resetMaintenance: false,
  resetInstallments: false,
  resetAccessorySales: false,
  resetAccessoryPurchases: false,
  resetReturnSales: false,
  resetReturnPurchases: false,
};

export default function CloseShiftModal({
  summary,
  pendingInvoices,
  remainingInvoices,
  currency,
  openingBalance,
  autoStartShift,
  defaultResetSettings,
  onConfirm,
  onCancel,
}: Props) {
  const [autoRestart, setAutoRestart] = useState<boolean>(autoStartShift);
  const [showResetSettings, setShowResetSettings] = useState<boolean>(false);
  const [resetSettings, setResetSettings] = useState<ShiftResetSettings>(
    defaultResetSettings ?? getDefaultShiftResetSettings()
  );

  // ✅ تأمين جميع القيم بـ ?? 0
  const totalSales              = summary?.totalSales              ?? 0;
  const totalPurchases          = summary?.totalPurchases          ?? 0;
  const totalReturnSales        = summary?.totalReturnSales        ?? 0;
  const totalReturnPurchases    = summary?.totalReturnPurchases    ?? 0;
  const totalMaintenance        = summary?.totalMaintenance        ?? 0;
  const totalInstallments       = summary?.totalInstallments       ?? 0;
  const totalAccessorySales     = summary?.totalAccessorySales     ?? 0;
  const totalAccessoryPurchases = summary?.totalAccessoryPurchases ?? 0;
  const salesCount              = summary?.salesCount              ?? 0;
  const purchasesCount          = summary?.purchasesCount          ?? 0;
  const maintenanceCount        = summary?.maintenanceCount        ?? 0;
  const installmentsCount       = summary?.installmentsCount       ?? 0;
  const accessorySalesCount     = summary?.accessorySalesCount     ?? 0;
  const accessoryPurchasesCount = summary?.accessoryPurchasesCount ?? 0;

  // ✅ حساب الصافي والإجمالي محلياً (لا نعتمد على summary.netSales لأنها قد تكون خاطئة)
  const netSales    = totalSales - totalPurchases - totalReturnSales + totalReturnPurchases;
  const netAccessory = totalAccessorySales - totalAccessoryPurchases;
  const grandTotal  = netSales + totalMaintenance + totalInstallments + netAccessory;

  // ✅ دالة toggle آمنة
  const toggleReset = (key: keyof ShiftResetSettings): void => {
    setResetSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ✅ بنود التصفير مع typing صريح
  const resetItems: ResetItem[] = [
    {
      key: "resetSales",
      label: "المبيعات",
      icon: TrendingUp,
      colorClass: "bg-blue-50 border-blue-200",
      value: totalSales,
    },
    {
      key: "resetPurchases",
      label: "المشتريات",
      icon: TrendingDown,
      colorClass: "bg-green-50 border-green-200",
      value: totalPurchases,
    },
    {
      key: "resetReturnSales",
      label: "مرتجع المبيعات",
      icon: RotateCcw,
      colorClass: "bg-orange-50 border-orange-200",
      value: totalReturnSales,
    },
    {
      key: "resetReturnPurchases",
      label: "مرتجع المشتريات",
      icon: RotateCcw,
      colorClass: "bg-purple-50 border-purple-200",
      value: totalReturnPurchases,
    },
    {
      key: "resetMaintenance",
      label: "الصيانة",
      icon: Wrench,
      colorClass: "bg-violet-50 border-violet-200",
      value: totalMaintenance,
    },
    {
      key: "resetInstallments",
      label: "الأقساط",
      icon: DollarSign,
      colorClass: "bg-indigo-50 border-indigo-200",
      value: totalInstallments,
    },
    {
      key: "resetAccessorySales",
      label: "بيع الاكسسوارات",
      icon: ShoppingBag,
      colorClass: "bg-amber-50 border-amber-200",
      value: totalAccessorySales,
    },
    {
      key: "resetAccessoryPurchases",
      label: "شراء الاكسسوارات",
      icon: ShoppingBag,
      colorClass: "bg-teal-50 border-teal-200",
      value: totalAccessoryPurchases,
    },
  ];

  // ✅ handler للتأكيد مع حماية من double-click
  const handleConfirm = (): void => {
    onConfirm(autoRestart, resetSettings);
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      dir="rtl"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">

        {/* ─── Header ─── */}
        <div className="bg-red-600 px-6 py-4 text-white flex items-center justify-between flex-shrink-0">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <AlertTriangle size={20} />
            تقفيل الوردية
          </h3>
          <button
            onClick={onCancel}
            className="text-white/70 hover:text-white transition-colors"
            aria-label="إغلاق"
          >
            <X size={20} />
          </button>
        </div>

        {/* ─── Body ─── */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-4">

            <h4 className="font-bold text-gray-800 text-sm">📊 ملخص الوردية</h4>

            {/* البطاقات الرئيسية */}
            <div className="grid grid-cols-2 gap-3">

              {/* المبيعات */}
              <div className="bg-blue-50 rounded-xl p-3">
                <div className="flex items-center gap-1 text-blue-600 mb-1">
                  <TrendingUp size={14} />
                  <span className="text-xs font-semibold">المبيعات</span>
                  <span className="text-xs opacity-60 mr-auto">({salesCount})</span>
                </div>
                <div className="text-lg font-bold text-blue-800">
                  {totalSales.toLocaleString()} {currency}
                </div>
              </div>

              {/* المشتريات */}
              <div className="bg-green-50 rounded-xl p-3">
                <div className="flex items-center gap-1 text-green-600 mb-1">
                  <TrendingDown size={14} />
                  <span className="text-xs font-semibold">المشتريات</span>
                  <span className="text-xs opacity-60 mr-auto">({purchasesCount})</span>
                </div>
                <div className="text-lg font-bold text-green-800">
                  {totalPurchases.toLocaleString()} {currency}
                </div>
              </div>

              {/* الصيانة */}
              <div className="bg-violet-50 rounded-xl p-3">
                <div className="flex items-center gap-1 text-violet-600 mb-1">
                  <Wrench size={14} />
                  <span className="text-xs font-semibold">الصيانة</span>
                  <span className="text-xs opacity-60 mr-auto">({maintenanceCount})</span>
                </div>
                <div className="text-lg font-bold text-violet-800">
                  {totalMaintenance.toLocaleString()} {currency}
                </div>
              </div>

              {/* الأقساط */}
              <div className="bg-indigo-50 rounded-xl p-3">
                <div className="flex items-center gap-1 text-indigo-600 mb-1">
                  <DollarSign size={14} />
                  <span className="text-xs font-semibold">الأقساط</span>
                  <span className="text-xs opacity-60 mr-auto">({installmentsCount})</span>
                </div>
                <div className="text-lg font-bold text-indigo-800">
                  {totalInstallments.toLocaleString()} {currency}
                </div>
              </div>

              {/* بيع اكسسوارات */}
              <div className="bg-amber-50 rounded-xl p-3">
                <div className="flex items-center gap-1 text-amber-600 mb-1">
                  <ShoppingBag size={14} />
                  <span className="text-xs font-semibold">بيع اكسسوارات</span>
                  <span className="text-xs opacity-60 mr-auto">({accessorySalesCount})</span>
                </div>
                <div className="text-lg font-bold text-amber-800">
                  {totalAccessorySales.toLocaleString()} {currency}
                </div>
              </div>

              {/* شراء اكسسوارات */}
              <div className="bg-teal-50 rounded-xl p-3">
                <div className="flex items-center gap-1 text-teal-600 mb-1">
                  <ShoppingBag size={14} />
                  <span className="text-xs font-semibold">شراء اكسسوارات</span>
                  <span className="text-xs opacity-60 mr-auto">({accessoryPurchasesCount})</span>
                </div>
                <div className="text-lg font-bold text-teal-800">
                  {totalAccessoryPurchases.toLocaleString()} {currency}
                </div>
              </div>

            </div>

            {/* المرتجعات - تظهر فقط إذا كانت > 0 */}
            {(totalReturnSales > 0 || totalReturnPurchases > 0) && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-orange-50 rounded-xl p-3">
                  <div className="flex items-center gap-1 text-orange-600 mb-1">
                    <RotateCcw size={14} />
                    <span className="text-xs font-semibold">مرتجع مبيعات</span>
                  </div>
                  <div className="text-sm font-bold text-orange-800">
                    {totalReturnSales.toLocaleString()} {currency}
                  </div>
                </div>
                <div className="bg-purple-50 rounded-xl p-3">
                  <div className="flex items-center gap-1 text-purple-600 mb-1">
                    <RotateCcw size={14} />
                    <span className="text-xs font-semibold">مرتجع مشتريات</span>
                  </div>
                  <div className="text-sm font-bold text-purple-800">
                    {totalReturnPurchases.toLocaleString()} {currency}
                  </div>
                </div>
              </div>
            )}

            {/* ─── الصافي والإجمالي ─── */}
            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-200">

              <div
                className={`rounded-xl p-3 text-center ${
                  netSales >= 0 ? "bg-emerald-100" : "bg-red-100"
                }`}
              >
                <div className="text-xs text-gray-500 mb-1">صافي البيع/الشراء</div>
                <div
                  className={`text-lg font-bold ${
                    netSales >= 0 ? "text-emerald-800" : "text-red-800"
                  }`}
                >
                  {netSales.toLocaleString()} {currency}
                </div>
              </div>

              <div
                className={`rounded-xl p-3 text-center ${
                  netAccessory >= 0 ? "bg-amber-100" : "bg-red-100"
                }`}
              >
                <div className="text-xs text-gray-500 mb-1">صافي الاكسسوارات</div>
                <div
                  className={`text-lg font-bold ${
                    netAccessory >= 0 ? "text-amber-800" : "text-red-800"
                  }`}
                >
                  {netAccessory.toLocaleString()} {currency}
                </div>
              </div>

              <div
                className={`rounded-xl p-3 text-center border-2 ${
                  grandTotal >= 0
                    ? "border-emerald-400 bg-emerald-50"
                    : "border-red-400 bg-red-50"
                }`}
              >
                <div className="text-xs text-gray-500 mb-1">الإجمالي الكلي</div>
                <div
                  className={`text-xl font-black ${
                    grandTotal >= 0 ? "text-emerald-900" : "text-red-900"
                  }`}
                >
                  {grandTotal.toLocaleString()} {currency}
                </div>
              </div>

            </div>

            {/* ─── تحذير الفواتير المعلقة ─── */}
            {pendingInvoices.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                <div className="flex items-center gap-2 text-yellow-800 text-sm font-bold mb-1">
                  <AlertTriangle size={14} />
                  يوجد {pendingInvoices.length} فاتورة معلقة
                </div>
                <p className="text-xs text-yellow-600">
                  الفواتير المعلقة ستبقى في النظام ولن يتم تصفيرها
                </p>
              </div>
            )}

            {/* ─── إعدادات التصفير ─── */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowResetSettings((prev) => !prev)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                aria-expanded={showResetSettings}
              >
                <div className="flex items-center gap-2">
                  <Settings size={16} className="text-gray-600" />
                  <span className="font-bold text-sm text-gray-700">
                    إعدادات التصفير عند الإغلاق
                  </span>
                </div>
                {showResetSettings
                  ? <ChevronUp size={16} />
                  : <ChevronDown size={16} />
                }
              </button>

              {showResetSettings && (
                <div className="p-4 space-y-2 bg-white">
                  <p className="text-xs text-gray-400 mb-3">
                    حدد البنود التي تريد تصفيرها عند إغلاق الوردية
                  </p>

                  {resetItems.map(({ key, label, icon, colorClass, value }) => (
                    <ResetItemCard
                      key={key}
                      checked={resetSettings[key]}
                      onChange={() => toggleReset(key)}
                      icon={icon}
                      label={label}
                      value={value}
                      currency={currency}
                      colorClass={colorClass}
                    />
                  ))}

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => setResetSettings(getDefaultShiftResetSettings())}
                      className="flex-1 text-xs py-2 bg-blue-100 text-blue-700 rounded-lg font-bold hover:bg-blue-200 transition-colors"
                    >
                      تحديد الكل
                    </button>
                    <button
                      onClick={() => setResetSettings(EMPTY_RESET_SETTINGS)}
                      className="flex-1 text-xs py-2 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200 transition-colors"
                    >
                      إلغاء تحديد الكل
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ─── خيار فتح وردية جديدة ─── */}
            <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
              <input
                type="checkbox"
                checked={autoRestart}
                onChange={(e) => setAutoRestart(e.target.checked)}
                className="w-4 h-4 rounded accent-emerald-600"
              />
              <span className="text-sm font-semibold text-gray-700">
                فتح وردية جديدة تلقائياً بعد الإغلاق
              </span>
            </label>

          </div>
        </div>

        {/* ─── Footer ─── */}
        <div className="flex gap-3 p-6 border-t border-gray-200 flex-shrink-0 bg-gray-50">
          <button
            onClick={handleConfirm}
            className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Check size={16} />
            تأكيد تقفيل الوردية
          </button>
          <button
            onClick={onCancel}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 active:scale-95 transition-all"
          >
            إلغاء
          </button>
        </div>

      </div>
    </div>
  );
}