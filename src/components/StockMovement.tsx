import { useState, useCallback, useMemo } from "react";
import { Product } from "../types";
import { generateId } from "../store";
import {
  Plus, Minus, Package, Search, X, Save,
  TrendingUp, TrendingDown, Clock, CheckCircle,
  AlertCircle, FileText, Hash,
} from "lucide-react";

interface StockMovementItem {
  id: string;
  productId: string;
  productName: string;
  barcode: string;
  quantity: number;
  currentStock: number;
  unitCost: number;
  notes: string;
}

interface StockMovementRecord {
  id: string;
  type: "in" | "out";
  number: string;
  date: string;
  time: string;
  reason: string;
  notes: string;
  items: StockMovementItem[];
  createdAt: string;
}

interface StockMovementProps {
  products: Product[];
  currency: string;
  movements?: StockMovementRecord[];
  onSave: (movement: StockMovementRecord, updatedProducts: Product[]) => void;
  onClose: () => void;
  defaultType?: "in" | "out";
}

const REASONS_IN = [
  "توريد من مورد",
  "إرجاع من عميل",
  "تسوية جرد",
  "نقل من فرع",
  "هدية أو عينة",
  "أخرى",
];

const REASONS_OUT = [
  "صرف للإنتاج",
  "تالف أو مفقود",
  "هدية أو عينة",
  "نقل لفرع",
  "تسوية جرد",
  "أخرى",
];

function generateMovementNumber(type: "in" | "out", movements: StockMovementRecord[]): string {
  const prefix = type === "in" ? "STK-IN" : "STK-OUT";
  const count = (movements ?? []).filter((m) => m.type === type).length + 1;
  return `${prefix}-${String(count).padStart(4, "0")}`;
}

export default function StockMovement({
  products,
  currency,
  movements = [],
  onSave,
  onClose,
  defaultType = "in",
}: StockMovementProps) {
  const [type, setType] = useState<"in" | "out">(defaultType);
  const [number, setNumber] = useState(generateMovementNumber(defaultType, movements));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(new Date().toTimeString().slice(0, 5));
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<StockMovementItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  const reasons = type === "in" ? REASONS_IN : REASONS_OUT;

  const filteredProducts = useMemo(() =>
    products.filter((p) => {
      const q = productSearch.toLowerCase();
      return (
        p.name?.toLowerCase().includes(q) ||
        p.barcode?.includes(q) ||
        p.category?.toLowerCase().includes(q)
      );
    }),
    [products, productSearch]
  );

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalCost = items.reduce((s, i) => s + i.quantity * i.unitCost, 0);

  const handleTypeChange = useCallback((t: "in" | "out") => {
    setType(t);
    setNumber(generateMovementNumber(t, movements));
    setReason("");
  }, [movements]);

  const addProduct = useCallback((product: Product) => {
    setItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.productId === product.id);
      if (existingIdx >= 0) {
        return prev.map((item, idx) =>
          idx === existingIdx
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          id: generateId(),
          productId: product.id,
          productName: product.name,
          barcode: product.barcode ?? "",
          quantity: 1,
          currentStock: product.stock ?? 0,
          unitCost: (product as any).costPrice ?? product.sellingPrice ?? 0,
          notes: "",
        },
      ];
    });
    setProductSearch("");
    setShowSearch(false);
  }, []);

  const updateItem = useCallback((id: string, field: string, value: any) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const handleSave = useCallback(() => {
    if (items.length === 0) {
      alert("يجب إضافة صنف واحد على الأقل");
      return;
    }
    if (!reason) {
      alert("يجب تحديد سبب الحركة");
      return;
    }

    // التحقق من الكميات عند الصرف
    if (type === "out") {
      const insufficient = items.filter(
        (item) => item.quantity > item.currentStock
      );
      if (insufficient.length > 0) {
        const names = insufficient.map((i) => i.productName).join("، ");
        const ok = confirm(
          `تحذير: الكمية المطلوبة أكبر من المخزون المتاح للأصناف التالية:\n${names}\nهل تريد المتابعة؟`
        );
        if (!ok) return;
      }
    }

    const movement: StockMovementRecord = {
      id: generateId(),
      type,
      number,
      date,
      time,
      reason,
      notes,
      items,
      createdAt: new Date().toISOString(),
    };

    // تحديث المخزون
    const updatedProducts = products.map((product) => {
      const item = items.find((i) => i.productId === product.id);
      if (!item) return product;
      const newStock =
        type === "in"
          ? (product.stock ?? 0) + item.quantity
          : Math.max(0, (product.stock ?? 0) - item.quantity);
      return { ...product, stock: newStock };
    });

    onSave(movement, updatedProducts);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  }, [items, reason, type, number, date, time, notes, products, onSave]);

  const isIn = type === "in";
  const gradient = isIn
    ? "from-emerald-600 to-emerald-700"
    : "from-orange-500 to-orange-600";

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-2 sm:p-4"
      dir="rtl"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className={`bg-gradient-to-r ${gradient} px-5 py-4 flex items-center justify-between flex-shrink-0`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              {isIn ? <TrendingUp size={18} className="text-white" /> : <TrendingDown size={18} className="text-white" />}
            </div>
            <div>
              <h2 className="font-black text-white text-base">
                {isIn ? "توريد أصناف للمخزن" : "صرف أصناف من المخزن"}
              </h2>
              <div className="text-white/70 text-xs">حركة مخزون جديدة</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {savedMsg && (
              <span className="text-white bg-white/20 px-3 py-1 rounded-lg text-xs font-bold animate-pulse">
                ✅ تم الحفظ
              </span>
            )}
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">

            {/* نوع الحركة */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleTypeChange("in")}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm border-2 transition-all ${
                  type === "in"
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-200"
                    : "bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                }`}
              >
                <TrendingUp size={16} />
                توريد للمخزن
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange("out")}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm border-2 transition-all ${
                  type === "out"
                    ? "bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-200"
                    : "bg-white text-orange-700 border-orange-200 hover:bg-orange-50"
                }`}
              >
                <TrendingDown size={16} />
                صرف من المخزن
              </button>
            </div>

            {/* معلومات الحركة */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block flex items-center gap-1">
                  <Hash size={11} /> رقم الحركة
                </label>
                <input
                  type="text"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono font-bold outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">التاريخ</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">الوقت</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">السبب *</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className={`w-full border-2 rounded-xl px-3 py-2.5 text-sm outline-none ${
                    !reason ? "border-red-200 focus:border-red-400" : "border-gray-200 focus:border-blue-400"
                  }`}
                >
                  <option value="">-- اختر السبب --</option>
                  {reasons.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* ملاحظات */}
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">ملاحظات</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                placeholder="أي ملاحظات إضافية..."
              />
            </div>

            {/* إضافة الأصناف */}
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <Package size={15} className="text-gray-500" />
                <span className="font-bold text-gray-700 text-sm">إضافة أصناف</span>
              </div>

              <div className="relative">
                <div className="flex items-center gap-2 border-2 border-gray-200 rounded-xl px-3 py-2.5 focus-within:border-blue-400 bg-white">
                  <Search size={15} className="text-gray-400 flex-shrink-0" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => { setProductSearch(e.target.value); setShowSearch(true); }}
                    onFocus={() => setShowSearch(true)}
                    onBlur={() => setTimeout(() => setShowSearch(false), 150)}
                    className="flex-1 text-sm outline-none bg-transparent"
                    placeholder="ابحث عن صنف بالاسم أو الباركود..."
                    autoFocus
                  />
                  {productSearch && (
                    <button
                      type="button"
                      onClick={() => { setProductSearch(""); setShowSearch(false); }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {showSearch && productSearch && (
                  <div className="absolute top-full right-0 left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto">
                    {filteredProducts.length === 0 ? (
                      <div className="p-4 text-center text-gray-400 text-sm">لا توجد أصناف</div>
                    ) : (
                      filteredProducts.slice(0, 10).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onMouseDown={() => addProduct(p)}
                          className="w-full text-right px-4 py-3 hover:bg-blue-50 border-b border-gray-50 last:border-0 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-gray-800 text-sm truncate">{p.name}</div>
                            <div className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                              {p.category && <span>{p.category}</span>}
                              <span className={`font-bold ${(p.stock ?? 0) === 0 ? "text-red-500" : "text-emerald-600"}`}>
                                مخزون: {p.stock ?? 0}
                              </span>
                              {p.barcode && <span className="font-mono">{p.barcode}</span>}
                            </div>
                          </div>
                          <div className="text-xs text-gray-400 flex-shrink-0">
                            {((p as any).costPrice ?? p.sellingPrice ?? 0).toLocaleString()} {currency}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* جدول الأصناف */}
            {items.length > 0 ? (
              <div className="border border-gray-200 rounded-2xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-2.5 flex items-center justify-between border-b border-gray-200">
                  <span className="text-sm font-black text-gray-700">
                    الأصناف ({items.length})
                  </span>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-500">
                      إجمالي الكميات: <span className="font-black text-gray-700">{totalItems}</span>
                    </span>
                    <span className="text-xs text-gray-500">
                      إجمالي التكلفة: <span className="font-black text-gray-700">{totalCost.toLocaleString()} {currency}</span>
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-right px-3 py-2.5 font-bold text-gray-500 text-xs w-8">#</th>
                        <th className="text-right px-3 py-2.5 font-bold text-gray-500 text-xs">الصنف</th>
                        <th className="text-right px-3 py-2.5 font-bold text-gray-500 text-xs w-24">المخزون الحالي</th>
                        <th className="text-right px-3 py-2.5 font-bold text-gray-500 text-xs w-24">الكمية</th>
                        <th className="text-right px-3 py-2.5 font-bold text-gray-500 text-xs w-24">المخزون بعد</th>
                        <th className="text-right px-3 py-2.5 font-bold text-gray-500 text-xs w-28">سعر التكلفة</th>
                        <th className="text-right px-3 py-2.5 font-bold text-gray-500 text-xs w-28">ملاحظة</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {items.map((item, idx) => {
                        const afterStock =
                          type === "in"
                            ? item.currentStock + item.quantity
                            : Math.max(0, item.currentStock - item.quantity);
                        const isInsufficient =
                          type === "out" && item.quantity > item.currentStock;

                        return (
                          <tr
                            key={item.id}
                            className={`hover:bg-gray-50/50 transition-colors ${isInsufficient ? "bg-red-50/30" : ""}`}
                          >
                            <td className="px-3 py-2 text-gray-400 text-xs font-bold">{idx + 1}</td>
                            <td className="px-3 py-2">
                              <div className="font-bold text-gray-800 text-sm">{item.productName}</div>
                              {item.barcode && (
                                <div className="text-xs text-gray-400 font-mono">{item.barcode}</div>
                              )}
                              {isInsufficient && (
                                <div className="text-xs text-red-500 font-bold flex items-center gap-1 mt-0.5">
                                  <AlertCircle size={10} /> الكمية أكبر من المخزون
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <span className={`font-bold text-sm ${item.currentStock === 0 ? "text-red-500" : "text-gray-600"}`}>
                                {item.currentStock}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => updateItem(item.id, "quantity", Math.max(1, Number(e.target.value)))}
                                className={`w-20 border rounded-lg px-2 py-1.5 text-sm text-center font-bold outline-none ${
                                  isInsufficient
                                    ? "border-red-300 focus:border-red-500 text-red-600"
                                    : "border-gray-200 focus:border-blue-400"
                                }`}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <span className={`font-black text-sm ${
                                type === "in"
                                  ? "text-emerald-600"
                                  : isInsufficient
                                  ? "text-red-500"
                                  : "text-orange-600"
                              }`}>
                                {afterStock}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="0"
                                value={item.unitCost}
                                onChange={(e) => updateItem(item.id, "unitCost", Number(e.target.value))}
                                className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-bold outline-none focus:border-blue-400"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={item.notes}
                                onChange={(e) => updateItem(item.id, "notes", e.target.value)}
                                className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-blue-400"
                                placeholder="ملاحظة..."
                              />
                            </td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() => removeItem(item.id)}
                                className="text-red-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors"
                              >
                                <X size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* ملخص */}
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5">
                      <Package size={13} className="text-gray-400" />
                      <span className="text-gray-500">عدد الأصناف:</span>
                      <span className="font-black text-gray-800">{items.length}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isIn
                        ? <TrendingUp size={13} className="text-emerald-500" />
                        : <TrendingDown size={13} className="text-orange-500" />
                      }
                      <span className="text-gray-500">إجمالي الكميات:</span>
                      <span className={`font-black ${isIn ? "text-emerald-700" : "text-orange-700"}`}>
                        {isIn ? "+" : "-"}{totalItems}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-500">إجمالي التكلفة: </span>
                    <span className="font-black text-gray-800">
                      {totalCost.toLocaleString()} {currency}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center">
                <Package size={32} className="mx-auto mb-2 text-gray-300" />
                <div className="text-gray-400 text-sm font-medium">ابحث عن صنف لإضافته</div>
                <div className="text-gray-300 text-xs mt-1">يمكنك إضافة عدة أصناف في نفس الوقت</div>
              </div>
            )}

          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-100 px-5 py-3 bg-gray-50 flex gap-2 flex-wrap items-center">
          <button
            type="button"
            onClick={handleSave}
            disabled={items.length === 0 || !reason}
            className={`flex items-center gap-2 px-5 py-2.5 text-white rounded-xl font-black text-sm active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md ${
              isIn
                ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200"
                : "bg-orange-500 hover:bg-orange-600 shadow-orange-200"
            }`}
          >
            <Save size={15} />
            {isIn ? "تأكيد التوريد" : "تأكيد الصرف"}
          </button>

          <div className="flex items-center gap-2 text-xs text-gray-400 mr-2">
            <Clock size={12} />
            <span>{date} — {time}</span>
          </div>

          {reason && (
            <div className="flex items-center gap-1.5 text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg font-bold">
              <FileText size={11} />
              {reason}
            </div>
          )}

          <div className="flex-1" />

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-100 active:scale-95 transition-all"
          >
            إلغاء
          </button>
        </div>

      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// مكون سجل حركات المخزون
// ═══════════════════════════════════════════════════════════
export function StockMovementsLog({
  movements,
  currency,
  onNew,
}: {
  movements: StockMovementRecord[];
  currency: string;
  onNew: (type: "in" | "out") => void;
}) {
  const [filter, setFilter] = useState<"all" | "in" | "out">("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return (movements ?? []).filter((m) => {
      if (filter !== "all" && m.type !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          m.number?.toLowerCase().includes(q) ||
          m.reason?.toLowerCase().includes(q) ||
          m.notes?.toLowerCase().includes(q) ||
          m.items?.some((i) => i.productName?.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [movements, filter, search]);

  const totalIn = (movements ?? [])
    .filter((m) => m.type === "in")
    .reduce((s, m) => s + m.items.reduce((ss, i) => ss + i.quantity, 0), 0);

  const totalOut = (movements ?? [])
    .filter((m) => m.type === "out")
    .reduce((s, m) => s + m.items.reduce((ss, i) => ss + i.quantity, 0), 0);

  return (
    <div className="space-y-4">

      {/* إجماليات */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <FileText size={18} className="text-blue-600" />
            </div>
            <div>
              <div className="text-xs text-gray-500 font-medium">إجمالي الحركات</div>
              <div className="text-2xl font-black text-gray-800">{(movements ?? []).length}</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-emerald-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <TrendingUp size={18} className="text-emerald-600" />
            </div>
            <div>
              <div className="text-xs text-gray-500 font-medium">إجمالي التوريد</div>
              <div className="text-2xl font-black text-emerald-700">+{totalIn.toLocaleString()}</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-orange-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
              <TrendingDown size={18} className="text-orange-600" />
            </div>
            <div>
              <div className="text-xs text-gray-500 font-medium">إجمالي الصرف</div>
              <div className="text-2xl font-black text-orange-700">-{totalOut.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

      {/* أزرار + فلاتر */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => onNew("in")}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 active:scale-95 transition-all shadow-sm"
          >
            <Plus size={15} />
            توريد للمخزن
          </button>
          <button
            onClick={() => onNew("out")}
            className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-bold hover:bg-orange-600 active:scale-95 transition-all shadow-sm"
          >
            <Minus size={15} />
            صرف من المخزن
          </button>

          <div className="flex gap-1.5 mr-2">
            {(["all", "in", "out"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filter === f
                    ? f === "in"
                      ? "bg-emerald-600 text-white"
                      : f === "out"
                      ? "bg-orange-500 text-white"
                      : "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {f === "all" ? "الكل" : f === "in" ? "توريد" : "صرف"}
              </button>
            ))}
          </div>

          <div className="flex-1 min-w-48">
            <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 bg-gray-50">
              <Search size={14} className="text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 text-sm outline-none bg-transparent"
                placeholder="بحث..."
              />
              {search && (
                <button onClick={() => setSearch("")} className="text-gray-400 hover:text-gray-600">
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* السجل */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <Package size={40} className="mx-auto mb-3 text-gray-200" />
          <div className="text-gray-400 font-medium">لا توجد حركات مخزون</div>
          <div className="text-gray-300 text-sm mt-1">ابدأ بإضافة توريد أو صرف</div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((movement) => {
            const isIn = movement.type === "in";
            const totalQty = movement.items.reduce((s, i) => s + i.quantity, 0);
            const totalCost = movement.items.reduce((s, i) => s + i.quantity * i.unitCost, 0);

            return (
              <div
                key={movement.id}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
                  isIn ? "border-emerald-100" : "border-orange-100"
                }`}
              >
                <div className={`px-4 py-3 flex items-center justify-between ${
                  isIn ? "bg-emerald-50" : "bg-orange-50"
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                      isIn ? "bg-emerald-100" : "bg-orange-100"
                    }`}>
                      {isIn
                        ? <TrendingUp size={15} className="text-emerald-600" />
                        : <TrendingDown size={15} className="text-orange-600" />
                      }
                    </div>
                    <div>
                      <div className={`font-black text-sm ${isIn ? "text-emerald-800" : "text-orange-800"}`}>
                        {isIn ? "توريد" : "صرف"} — {movement.number}
                      </div>
                      <div className="text-xs text-gray-500">
                        {movement.date} · {movement.time} · {movement.reason}
                      </div>
                    </div>
                  </div>
                  <div className="text-left">
                    <div className={`font-black text-base ${isIn ? "text-emerald-700" : "text-orange-700"}`}>
                      {isIn ? "+" : "-"}{totalQty} وحدة
                    </div>
                    <div className="text-xs text-gray-400">
                      {totalCost.toLocaleString()} {currency}
                    </div>
                  </div>
                </div>

                <div className="px-4 py-2">
                  <div className="flex flex-wrap gap-2">
                    {movement.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5 text-xs"
                      >
                        <Package size={11} className="text-gray-400" />
                        <span className="font-bold text-gray-700">{item.productName}</span>
                        <span className={`font-black ${isIn ? "text-emerald-600" : "text-orange-600"}`}>
                          {isIn ? "+" : "-"}{item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                  {movement.notes && (
                    <div className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                      <FileText size={10} />
                      {movement.notes}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export type { StockMovementRecord };