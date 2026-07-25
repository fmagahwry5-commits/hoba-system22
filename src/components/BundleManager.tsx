import { useState, useMemo } from "react";
import { Bundle, BundleItem, Product } from "../types";
import { generateId } from "../store";
import {
  Plus, Trash2, Search, X, Save, Package, Tag,
  Edit2, Gift, ToggleLeft, ToggleRight,
} from "lucide-react";

interface Props {
  bundles: Bundle[];
  products: Product[];
  currency: string;
  onUpdate: (bundles: Bundle[]) => void;
}

// ═══ دوال مساعدة ═══
function safeNum(v: any): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function safeLocale(v: any): string {
  return (safeNum(v)).toLocaleString();
}

function recalcBundle(items: BundleItem[], bundlePrice: number) {
  const originalTotal = items.reduce(
    (s, item) => s + safeNum(item.originalPrice) * safeNum(item.quantity), 0
  );
  const discount = originalTotal - bundlePrice;
  const discountPercent = originalTotal > 0
    ? (discount / originalTotal) * 100
    : 0;
  return { originalTotal, discount, discountPercent };
}

function emptyBundle(): Bundle {
  return {
    id: generateId(),
    name: "",
    description: "",
    items: [],
    originalTotal: 0,
    bundlePrice: 0,
    discount: 0,
    discountPercent: 0,
    isActive: true,
    createdAt: new Date().toISOString(),
    barcode: "",
  };
}

// ═══ مودال إضافة / تعديل ═══
function BundleFormModal({
  bundle, products, currency, onSave, onClose,
}: {
  bundle: Bundle | null;
  products: Product[];
  currency: string;
  onSave: (bundle: Bundle) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Bundle>(() =>
    bundle ? { ...bundle } : emptyBundle()
  );
  const [productSearch, setProductSearch] = useState("");
  const [showProductList, setShowProductList] = useState(false);

  // فلترة المنتجات
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 10);
    const q = productSearch.toLowerCase();
    return products.filter(
      (p) =>
        (p.name ?? "").toLowerCase().includes(q) ||
        (p.barcode ?? "").includes(q)
    );
  }, [products, productSearch]);

  // إضافة منتج
  const addProduct = (product: Product) => {
    if (!product) return;
    const existing = form.items.find((i) => i.productId === product.id);
    let newItems: BundleItem[];

    if (existing) {
      newItems = form.items.map((i) =>
        i.productId === product.id
          ? { ...i, quantity: i.quantity + 1 }
          : i
      );
    } else {
      const price = safeNum(product.sellingPrice);
      newItems = [
        ...form.items,
        {
          productId: product.id,
          productName: product.name ?? "",
          quantity: 1,
          originalPrice: price,
          bundlePrice: price,
        },
      ];
    }

    const newBundlePrice = newItems.reduce(
      (s, i) => s + safeNum(i.bundlePrice) * safeNum(i.quantity), 0
    );
    const calc = recalcBundle(newItems, newBundlePrice);
    setForm({ ...form, items: newItems, bundlePrice: newBundlePrice, ...calc });
    setProductSearch("");
    setShowProductList(false);
  };

  // تحديث الكمية
  const updateQty = (productId: string, quantity: number) => {
    if (quantity < 1) return;
    const newItems = form.items.map((i) =>
      i.productId === productId ? { ...i, quantity } : i
    );
    const newBundlePrice = newItems.reduce(
      (s, i) => s + safeNum(i.bundlePrice) * safeNum(i.quantity), 0
    );
    setForm({ ...form, items: newItems, bundlePrice: newBundlePrice, ...recalcBundle(newItems, newBundlePrice) });
  };

  // تحديث سعر المنتج في العرض
  const updateItemPrice = (productId: string, bundlePrice: number) => {
    const price = Math.max(0, safeNum(bundlePrice));
    const newItems = form.items.map((i) =>
      i.productId === productId ? { ...i, bundlePrice: price } : i
    );
    const newBundlePrice = newItems.reduce(
      (s, i) => s + safeNum(i.bundlePrice) * safeNum(i.quantity), 0
    );
    setForm({ ...form, items: newItems, bundlePrice: newBundlePrice, ...recalcBundle(newItems, newBundlePrice) });
  };

  // حذف منتج
  const removeItem = (productId: string) => {
    const newItems = form.items.filter((i) => i.productId !== productId);
    const newBundlePrice = newItems.reduce(
      (s, i) => s + safeNum(i.bundlePrice) * safeNum(i.quantity), 0
    );
    setForm({ ...form, items: newItems, bundlePrice: newBundlePrice, ...recalcBundle(newItems, newBundlePrice) });
  };

  // تغيير سعر العرض الإجمالي
  const handleBundlePriceChange = (price: number) => {
    const p = Math.max(0, safeNum(price));
    const calc = recalcBundle(form.items, p);
    const ratio = calc.originalTotal > 0 ? p / calc.originalTotal : 1;
    const newItems = form.items.map((i) => ({
      ...i,
      bundlePrice: Math.round(safeNum(i.originalPrice) * ratio * 100) / 100,
    }));
    setForm({ ...form, items: newItems, bundlePrice: p, ...calc });
  };

  const isValid =
    form.name.trim().length > 0 &&
    form.items.length >= 2 &&
    form.bundlePrice > 0;

  const handleSave = () => {
    if (!isValid) return;
    onSave({
      ...form,
      totalPrice: form.bundlePrice, // للتوافق
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      dir="rtl"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-4 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Gift size={20} />
            </div>
            <div>
              <h3 className="font-bold text-lg">
                {bundle ? "تعديل العرض" : "إنشاء عرض باكدج جديد"}
              </h3>
              <p className="text-amber-100 text-xs">اختر المنتجات وحدد سعر العرض</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* اسم ووصف وباركود */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                اسم العرض *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-amber-400 transition-colors"
                placeholder="مثال: باكدج الطالب"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                باركود العرض
              </label>
              <input
                type="text"
                value={form.barcode ?? ""}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-amber-400 transition-colors"
                placeholder="اختياري"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              وصف العرض
            </label>
            <input
              type="text"
              value={form.description ?? ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-amber-400 transition-colors"
              placeholder="وصف مختصر للعرض"
            />
          </div>

          {/* إضافة منتجات */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              منتجات العرض ({form.items.length} صنف)
              {form.items.length < 2 && (
                <span className="text-xs text-amber-600 font-normal mr-2">
                  · يجب إضافة منتجين على الأقل
                </span>
              )}
            </label>
            <div className="relative">
              <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                value={productSearch}
                onChange={(e) => {
                  setProductSearch(e.target.value);
                  setShowProductList(true);
                }}
                onFocus={() => setShowProductList(true)}
                onBlur={() => setTimeout(() => setShowProductList(false), 200)}
                className="w-full border-2 border-gray-200 rounded-xl pr-9 pl-4 py-2.5 text-sm outline-none focus:border-amber-400 transition-colors"
                placeholder="ابحث عن منتج لإضافته..."
              />

              {showProductList && (
                <div className="absolute z-20 w-full bg-white border border-gray-200 rounded-xl mt-1 shadow-2xl overflow-hidden">
                  <div className="max-h-48 overflow-y-auto">
                    {filteredProducts.length === 0 ? (
                      <div className="px-4 py-3 text-gray-400 text-sm text-center">
                        لا توجد نتائج
                      </div>
                    ) : (
                      filteredProducts.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onMouseDown={() => addProduct(p)}
                          className="w-full text-right px-4 py-2.5 hover:bg-amber-50 flex justify-between items-center border-b border-gray-50 last:border-0 transition-colors"
                        >
                          <div>
                            <div className="font-semibold text-gray-800 text-sm">{p.name}</div>
                            <div className="text-xs text-gray-400">
                              مخزون: {p.stock ?? 0}
                              {(p.stock ?? 0) === 0 && (
                                <span className="text-red-500 mr-1">· نفذ</span>
                              )}
                            </div>
                          </div>
                          <div className="text-sm font-bold text-amber-600 flex-shrink-0">
                            {safeLocale(p.sellingPrice)} {currency}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* جدول المنتجات */}
          {form.items.length > 0 && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-amber-50">
                    <tr>
                      {["المنتج", "الكمية", "السعر الأصلي", "سعر في العرض", "الوفر", ""].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-right text-xs font-semibold text-amber-700">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {form.items.map((item) => {
                      const saving =
                        (safeNum(item.originalPrice) - safeNum(item.bundlePrice)) *
                        safeNum(item.quantity);
                      const savingPct =
                        safeNum(item.originalPrice) > 0
                          ? (
                              ((safeNum(item.originalPrice) - safeNum(item.bundlePrice)) /
                                safeNum(item.originalPrice)) *
                              100
                            ).toFixed(0)
                          : "0";

                      return (
                        <tr key={item.productId} className="hover:bg-gray-50 transition-colors">
                          <td className="px-3 py-2.5 font-medium text-gray-800 max-w-[120px] truncate">
                            {item.productName}
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateQty(item.productId, Math.max(1, safeNum(e.target.value)))}
                              className="w-14 border border-gray-200 rounded-lg px-2 py-1.5 text-center text-sm outline-none focus:border-amber-400"
                            />
                          </td>
                          <td className="px-3 py-2.5 text-gray-400 text-xs">
                            <div className="line-through">
                              {safeLocale(safeNum(item.originalPrice) * safeNum(item.quantity))}
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.bundlePrice}
                              onChange={(e) => updateItemPrice(item.productId, safeNum(e.target.value))}
                              className="w-24 border-2 border-amber-200 rounded-lg px-2 py-1.5 text-center text-sm font-bold text-amber-700 outline-none focus:border-amber-400"
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            {saving > 0 ? (
                              <div>
                                <div className="text-emerald-600 font-bold text-xs">
                                  -{safeLocale(saving)} {currency}
                                </div>
                                <div className="text-emerald-400 text-[10px]">{savingPct}% خصم</div>
                              </div>
                            ) : saving < 0 ? (
                              <div className="text-red-500 text-xs font-bold">
                                +{safeLocale(Math.abs(saving))}
                              </div>
                            ) : (
                              <div className="text-gray-300 text-xs">لا خصم</div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <button
                              onClick={() => removeItem(item.productId)}
                              className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* التسعير الإجمالي */}
          {form.items.length >= 2 && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-5 space-y-4">
              <h4 className="font-bold text-amber-800 text-sm flex items-center gap-2">
                <Tag size={16} /> تسعير العرض الإجمالي
              </h4>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl p-3 text-center border border-gray-200">
                  <div className="text-xs text-gray-500 mb-1">السعر الأصلي</div>
                  <div className="text-xl font-bold text-gray-400 line-through">
                    {safeLocale(form.originalTotal)}
                  </div>
                  <div className="text-xs text-gray-400">{currency}</div>
                </div>

                <div className="bg-white rounded-xl p-3 text-center border-2 border-amber-400">
                  <div className="text-xs text-amber-600 font-bold mb-1">سعر العرض *</div>
                  <input
                    type="number"
                    min="0"
                    value={form.bundlePrice || ""}
                    onChange={(e) => handleBundlePriceChange(safeNum(e.target.value))}
                    className="w-full text-xl font-bold text-amber-700 text-center border-none outline-none bg-transparent"
                    placeholder="0"
                  />
                  <div className="text-xs text-amber-500">{currency}</div>
                </div>

                <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-200">
                  <div className="text-xs text-emerald-600 mb-1">قيمة الخصم</div>
                  <div className="text-xl font-bold text-emerald-700">
                    {safeLocale(Math.max(0, form.discount))}
                  </div>
                  <div className="text-xs text-emerald-500">{currency}</div>
                </div>

                <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-200">
                  <div className="text-xs text-emerald-600 mb-1">نسبة التوفير</div>
                  <div className="text-xl font-bold text-emerald-700">
                    {Math.max(0, safeNum(form.discountPercent)).toFixed(1)}%
                  </div>
                  <div className="text-xs text-emerald-500">للعميل</div>
                </div>
              </div>

              {form.bundlePrice > 0 && form.originalTotal > 0 && (
                <div
                  className={`rounded-xl px-4 py-3 text-sm font-semibold text-center ${
                    form.bundlePrice < form.originalTotal
                      ? "bg-emerald-100 text-emerald-700"
                      : form.bundlePrice > form.originalTotal
                      ? "bg-red-100 text-red-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {form.bundlePrice < form.originalTotal
                    ? `✅ العميل يوفر ${safeLocale(form.discount)} ${currency} (${safeNum(form.discountPercent).toFixed(1)}% خصم)`
                    : form.bundlePrice > form.originalTotal
                    ? "⚠️ سعر العرض أعلى من السعر الأصلي!"
                    : "سعر العرض مساوٍ للسعر الأصلي"}
                </div>
              )}
            </div>
          )}

          {form.items.length === 1 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-xs text-yellow-700 font-semibold">
              ⚠️ يجب إضافة منتجين على الأقل لإنشاء عرض باكدج
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3 justify-between items-center flex-shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-100 text-sm font-semibold transition-colors"
          >
            إلغاء
          </button>

          <div className="flex items-center gap-3">
            {/* toggle نشط */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">نشط</span>
              <button
                onClick={() => setForm({ ...form, isActive: !form.isActive })}
                className={`w-10 h-5 rounded-full transition-colors relative ${
                  form.isActive ? "bg-emerald-500" : "bg-gray-300"
                }`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    form.isActive ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            <button
              onClick={handleSave}
              disabled={!isValid}
              className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 text-white rounded-xl font-bold text-sm hover:bg-amber-700 disabled:opacity-50 active:scale-95 transition-all shadow-md"
            >
              <Save size={16} />
              {bundle ? "حفظ التعديلات" : "إنشاء العرض"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══ مودال التفاصيل ═══
function BundleDetailModal({
  bundle, currency, onClose, onEdit,
}: {
  bundle: Bundle;
  currency: string;
  onClose: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-4 text-white flex items-center justify-between sticky top-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Gift size={18} />
            </div>
            <div>
              <h3 className="font-bold text-lg">{bundle.name}</h3>
              <p className="text-amber-100 text-xs">{bundle.description || "عرض باكدج"}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onEdit}
              className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-semibold transition-colors"
            >
              تعديل
            </button>
            <button onClick={onClose} className="text-white/80 hover:text-white p-1">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-2">
            {bundle.items.map((item) => (
              <div
                key={item.productId}
                className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-100"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Package size={14} className="text-amber-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-800 text-sm">{item.productName}</div>
                    <div className="text-xs text-gray-400">الكمية: {item.quantity}</div>
                  </div>
                </div>
                <div className="text-left">
                  <div className="text-xs text-gray-400 line-through">
                    {safeLocale(safeNum(item.originalPrice) * safeNum(item.quantity))} {currency}
                  </div>
                  <div className="text-sm font-bold text-amber-700">
                    {safeLocale(safeNum(item.bundlePrice) * safeNum(item.quantity))} {currency}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-gray-500 text-sm">السعر الأصلي</span>
              <span className="text-gray-400 line-through">
                {safeLocale(bundle.originalTotal)} {currency}
              </span>
            </div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-emerald-600 text-sm font-semibold">
                الخصم ({safeNum(bundle.discountPercent).toFixed(1)}%)
              </span>
              <span className="text-emerald-700 font-bold">
                -{safeLocale(bundle.discount)} {currency}
              </span>
            </div>
            <div className="flex justify-between items-center border-t border-amber-200 pt-3">
              <span className="text-amber-700 font-bold text-lg">سعر العرض</span>
              <span className="text-2xl font-black text-amber-700">
                {safeLocale(bundle.bundlePrice)} {currency}
              </span>
            </div>
          </div>

          {bundle.barcode && (
            <div className="bg-gray-50 rounded-xl px-4 py-3 text-center">
              <div className="text-xs text-gray-400 mb-1">باركود العرض</div>
              <div className="font-mono font-bold text-gray-700">{bundle.barcode}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══ المكوّن الرئيسي ═══
export default function BundleManager({ bundles, products, currency, onUpdate }: Props) {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingBundle, setEditingBundle] = useState<Bundle | null>(null);
  const [viewingBundle, setViewingBundle] = useState<Bundle | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");

  const safeBundles = useMemo(
    () => Array.isArray(bundles) ? bundles.filter(Boolean) : [],
    [bundles]
  );

  const stats = useMemo(() => {
    const active = safeBundles.filter((b) => b.isActive).length;
    const totalDiscount = safeBundles.reduce(
      (s, b) => s + Math.max(0, safeNum(b.discount)), 0
    );
    return {
      total: safeBundles.length,
      active,
      inactive: safeBundles.length - active,
      totalDiscount,
    };
  }, [safeBundles]);

  const filtered = useMemo(() => {
    return safeBundles.filter((b) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        b.name.toLowerCase().includes(q) ||
        (b.description ?? "").toLowerCase().includes(q) ||
        b.items.some((i) => i.productName.toLowerCase().includes(q));
      const matchActive =
        filterActive === "all" ||
        (filterActive === "active" && b.isActive) ||
        (filterActive === "inactive" && !b.isActive);
      return matchSearch && matchActive;
    });
  }, [safeBundles, search, filterActive]);

  const handleSave = (bundle: Bundle) => {
    const exists = safeBundles.some((b) => b.id === bundle.id);
    if (exists) {
      onUpdate(safeBundles.map((b) => (b.id === bundle.id ? bundle : b)));
    } else {
      onUpdate([...safeBundles, bundle]);
    }
    setShowForm(false);
    setEditingBundle(null);
  };

  const handleDelete = (id: string) => {
    onUpdate(safeBundles.filter((b) => b.id !== id));
    setConfirmDelete(null);
  };

  const toggleActive = (id: string) => {
    onUpdate(safeBundles.map((b) => b.id === id ? { ...b, isActive: !b.isActive } : b));
  };

  return (
    <div className="space-y-5" dir="rtl">

      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <Gift size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold">عروض الباكدج</h2>
              <p className="text-amber-100 text-sm">
                {stats.total} عرض · {stats.active} نشط
              </p>
            </div>
          </div>
          <button
            onClick={() => { setEditingBundle(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-white text-amber-700 rounded-xl text-sm font-bold hover:bg-amber-50 transition-colors shadow-md"
          >
            <Plus size={16} /> عرض جديد
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "إجمالي العروض", value: stats.total, unit: "عرض" },
            { label: "عروض نشطة", value: stats.active, unit: "عرض" },
            { label: "عروض متوقفة", value: stats.inactive, unit: "عرض" },
            { label: "إجمالي الخصومات", value: safeLocale(stats.totalDiscount), unit: currency },
          ].map((s) => (
            <div key={s.label} className="bg-white/15 rounded-xl p-3 text-center">
              <div className="text-xs opacity-75 mb-1">{s.label}</div>
              <div className="text-lg font-bold">{s.value}</div>
              <div className="text-xs opacity-60">{s.unit}</div>
            </div>
          ))}
        </div>
      </div>

      {/* بحث وفلاتر */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
        <div className="relative">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-gray-200 rounded-xl pr-9 pl-10 py-2.5 text-sm outline-none focus:border-amber-400 transition-colors"
            placeholder="ابحث عن عرض بالاسم أو المنتج..."
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

        <div className="flex gap-2 flex-wrap">
          {[
            { val: "all", label: `الكل (${stats.total})` },
            { val: "active", label: `نشطة (${stats.active})` },
            { val: "inactive", label: `متوقفة (${stats.inactive})` },
          ].map((f) => (
            <button
              key={f.val}
              onClick={() => setFilterActive(f.val as any)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filterActive === f.val
                  ? "bg-amber-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* قائمة العروض */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center text-gray-400 bg-white rounded-2xl border border-gray-100">
          <Gift size={48} className="mx-auto mb-3 opacity-20" />
          <div className="font-medium">لا توجد عروض</div>
          <div className="text-sm mt-1">اضغط "عرض جديد" لإنشاء باكدج</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((bundle) => (
            <div
              key={bundle.id}
              className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all hover:shadow-md ${
                bundle.isActive ? "border-amber-200" : "border-gray-200 opacity-70"
              }`}
            >
              {/* شريط العنوان */}
              <div className={`px-4 py-2.5 flex items-center justify-between ${bundle.isActive ? "bg-gradient-to-r from-amber-50 to-orange-50" : "bg-gray-50"}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <Gift size={14} className={bundle.isActive ? "text-amber-600" : "text-gray-400"} />
                  <span className={`text-xs font-bold ${bundle.isActive ? "text-amber-700" : "text-gray-500"}`}>
                    {bundle.isActive ? "✅ نشط" : "⏸️ متوقف"}
                  </span>
                  {bundle.barcode && (
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-mono">
                      {bundle.barcode}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleActive(bundle.id)}
                    className={`p-1.5 rounded-lg transition-colors ${bundle.isActive ? "text-emerald-600 hover:bg-emerald-50" : "text-gray-400 hover:bg-gray-100"}`}
                    title={bundle.isActive ? "إيقاف" : "تفعيل"}
                  >
                    {bundle.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                  </button>
                  <button
                    onClick={() => setViewingBundle(bundle)}
                    className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                    title="تفاصيل"
                  >
                    <Tag size={14} />
                  </button>
                  <button
                    onClick={() => { setEditingBundle(bundle); setShowForm(true); }}
                    className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                    title="تعديل"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(bundle.id)}
                    className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                    title="حذف"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* المحتوى */}
              <div className="p-4">
                <div className="flex items-start justify-between mb-3 gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-800 text-lg leading-tight truncate">
                      {bundle.name}
                    </h3>
                    {bundle.description && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{bundle.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {bundle.items.length} منتج في العرض
                    </p>
                  </div>
                  <div className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold flex-shrink-0">
                    خصم {Math.max(0, safeNum(bundle.discountPercent)).toFixed(0)}%
                  </div>
                </div>

                {/* المنتجات */}
                <div className="space-y-1.5 mb-4">
                  {bundle.items.map((item) => (
                    <div
                      key={item.productId}
                      className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2 border border-gray-100"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Package size={11} className="text-gray-400 flex-shrink-0" />
                        <span className="text-sm text-gray-700 font-medium truncate">
                          {item.productName}
                        </span>
                        {item.quantity > 1 && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full flex-shrink-0">
                            ×{item.quantity}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-gray-400 line-through">
                          {safeLocale(safeNum(item.originalPrice) * safeNum(item.quantity))}
                        </span>
                        <span className="text-xs font-bold text-amber-700">
                          {safeLocale(safeNum(item.bundlePrice) * safeNum(item.quantity))} {currency}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* التسعير */}
                <div className="flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl px-4 py-3 gap-2">
                  <div>
                    <div className="text-xs text-gray-400">الأصلي</div>
                    <div className="text-sm text-gray-400 line-through">
                      {safeLocale(bundle.originalTotal)} {currency}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-emerald-600 font-semibold">توفير</div>
                    <div className="text-sm font-bold text-emerald-700">
                      -{safeLocale(Math.max(0, bundle.discount))} {currency}
                    </div>
                  </div>
                  <div className="text-left">
                    <div className="text-xs text-amber-600 font-semibold">سعر العرض</div>
                    <div className="text-2xl font-black text-amber-700">
                      {safeLocale(bundle.bundlePrice)}{" "}
                      <span className="text-sm font-normal">{currency}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showForm && (
        <BundleFormModal
          bundle={editingBundle}
          products={products}
          currency={currency}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingBundle(null); }}
        />
      )}

      {viewingBundle && (
        <BundleDetailModal
          bundle={viewingBundle}
          currency={currency}
          onClose={() => setViewingBundle(null)}
          onEdit={() => {
            setEditingBundle(viewingBundle);
            setViewingBundle(null);
            setShowForm(true);
          }}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full">
            <div className="text-center mb-4">
              <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Trash2 size={24} className="text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-1">حذف العرض</h3>
              <p className="text-gray-500 text-sm">هل أنت متأكد من حذف هذا العرض؟</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 active:scale-95 transition-all"
              >
                حذف
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
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