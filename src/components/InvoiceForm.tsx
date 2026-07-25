import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  Invoice,
  InvoiceType,
  InvoiceItem,
  Product,
  Customer,
  Supplier,
  AppSettings,
  Bundle,
} from "../types";
import { generateId } from "../store";
import {
  X,
  Trash2,
  Search,
  Package,
  Save,
  User,
  Phone,
  Check,
  Clock,
  Plus,
  Barcode,
  AlertTriangle,
} from "lucide-react";

interface Props {
  type: InvoiceType;
  existingInvoice?: Invoice | null;
  invoices: Invoice[];
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  settings: AppSettings;
  bundles?: Bundle[];
  onSave: (invoice: Invoice) => void;
  onClose: () => void;
  onAddProduct?: (product: Product) => void;
}

// ── توليد رقم فاتورة ──
function generateInvoiceNumber(type: InvoiceType, invoices: Invoice[]): string {
  const prefixes: Record<InvoiceType, string> = {
    sale: "S",
    purchase: "P",
    return_sale: "RS",
    return_purchase: "RP",
    maintenance: "M",
    accessory_sale: "AS",
    accessory_purchase: "AP",
  };

  const prefix = prefixes[type] ?? "INV";
  const today = new Date();
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(
    today.getDate()
  ).padStart(2, "0")}`;
  const count = (invoices ?? []).filter((i) => i?.type === type).length + 1;

  return `${prefix}-${dateStr}-${String(count).padStart(4, "0")}`;
}

// ── حساب إجمالي البند ──
function calcItemTotal(item: Partial<InvoiceItem>): number {
  const qty = Number(item.quantity) || 0;
  const price = Number(item.unitPrice) || 0;
  const discount = Number(item.discount) || 0;
  const subtotal = qty * price;

  if (item.discountType === "percent") {
    return Math.max(0, subtotal - (subtotal * discount) / 100);
  }

  return Math.max(0, subtotal - discount);
}

// ── أدوات مساعدة للأرقام ──
const toNumber = (val: any): number => Number(val ?? 0) || 0;
const fmt = (val: any): string => toNumber(val).toLocaleString();

// ✅ هل هو نوع بيع (يحتاج فحص مخزون)
const isSaleType = (type: InvoiceType): boolean =>
  ["sale", "accessory_sale"].includes(type);

// ══════════════════════════════════════════════════════════════
// نافذة إضافة منتج جديد من داخل الفاتورة
// ══════════════════════════════════════════════════════════════
function AddProductModal({
  currency,
  isSupplierType,
  onAdd,
  onClose,
}: {
  currency: string;
  isSupplierType: boolean;
  onAdd: (product: Product) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [category, setCategory] = useState("");
  const [costPrice, setCostPrice] = useState(0);
  const [sellingPrice, setSellingPrice] = useState(0);
  const [stock, setStock] = useState(0);
  const [unit, setUnit] = useState("قطعة");
  const [minStock, setMinStock] = useState(0);
  const [error, setError] = useState("");

  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const handleSave = () => {
    if (!name.trim()) {
      setError("يجب إدخال اسم المنتج");
      nameRef.current?.focus();
      return;
    }

    if (sellingPrice <= 0 && !isSupplierType) {
      setError("يجب تحديد سعر البيع");
      return;
    }

    const newProduct: Product = {
      id: generateId(),
      name: name.trim(),
      barcode: barcode.trim() || undefined,
      category: category.trim() || undefined,
      costPrice: toNumber(costPrice),
      sellingPrice: toNumber(sellingPrice),
      stock: toNumber(stock),
      unit: unit || "قطعة",
      minStock: toNumber(minStock),
    } as Product;

    onAdd(newProduct);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && name.trim()) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
      dir="rtl"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-5 py-4 text-white flex items-center justify-between">
          <h3 className="font-black flex items-center gap-2 text-base">
            <Plus size={18} /> إضافة منتج جديد
          </h3>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2">
              <X size={14} />
              {error}
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-gray-600 mb-1.5 block">
              اسم المنتج <span className="text-red-500">*</span>
            </label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-400 font-semibold transition-colors"
              placeholder="أدخل اسم المنتج"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-600 mb-1.5 block">
                <Barcode size={12} className="inline ml-1" />
                الباركود
              </label>
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400 font-mono transition-colors"
                placeholder="اختياري"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 mb-1.5 block">الفئة</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400 transition-colors"
                placeholder="مثل: موبايل، اكسسوار"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-600 mb-1.5 block">
                سعر التكلفة ({currency})
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={costPrice || ""}
                onChange={(e) => setCostPrice(toNumber(e.target.value))}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400 font-bold text-center transition-colors"
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 mb-1.5 block">
                سعر البيع ({currency}) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={sellingPrice || ""}
                onChange={(e) => {
                  setSellingPrice(toNumber(e.target.value));
                  setError("");
                }}
                className="w-full border-2 border-emerald-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-500 font-bold text-center transition-colors"
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-600 mb-1.5 block">المخزون</label>
              <input
                type="number"
                min="0"
                value={stock || ""}
                onChange={(e) => setStock(toNumber(e.target.value))}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400 font-bold text-center transition-colors"
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 mb-1.5 block">الحد الأدنى</label>
              <input
                type="number"
                min="0"
                value={minStock || ""}
                onChange={(e) => setMinStock(toNumber(e.target.value))}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400 font-bold text-center transition-colors"
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 mb-1.5 block">الوحدة</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400 transition-colors bg-white"
              >
                <option value="قطعة">قطعة</option>
                <option value="جهاز">جهاز</option>
                <option value="علبة">علبة</option>
                <option value="كرتونة">كرتونة</option>
                <option value="متر">متر</option>
                <option value="كيلو">كيلو</option>
                <option value="لتر">لتر</option>
              </select>
            </div>
          </div>

          {sellingPrice > 0 && costPrice > 0 && (
            <div
              className={`rounded-xl px-4 py-3 text-center ${
                sellingPrice > costPrice
                  ? "bg-emerald-50 border border-emerald-200"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              <span className="text-xs text-gray-500">الربح المتوقع: </span>
              <span
                className={`text-sm font-black ${
                  sellingPrice > costPrice ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {fmt(sellingPrice - costPrice)} {currency}
              </span>
              <span className="text-xs text-gray-400 mr-2">
                ({costPrice > 0 ? Math.round(((sellingPrice - costPrice) / costPrice) * 100) : 0}%)
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-black text-base hover:bg-emerald-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-emerald-200 transition-all flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            إضافة المنتج
          </button>
          <button
            onClick={onClose}
            className="px-5 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ✅ تحذير نفاد المخزون
// ══════════════════════════════════════════════════════════════
function StockWarningBanner({ items, products, type }: {
  items: InvoiceItem[];
  products: Product[];
  type: InvoiceType;
}) {
  if (!isSaleType(type) || items.length === 0) return null;

  const productMap = new Map(products.map(p => [p.id, p]));
  const warnings: { name: string; requested: number; available: number; isZero: boolean }[] = [];

  // تجميع الكميات لنفس المنتج
  const qtyMap = new Map<string, number>();
  for (const item of items) {
    if (!item.productId) continue;
    qtyMap.set(item.productId, (qtyMap.get(item.productId) ?? 0) + (item.quantity ?? 0));
  }

  for (const [productId, totalQty] of qtyMap) {
    const product = productMap.get(productId);
    if (!product) continue;
    const stock = product.stock ?? 0;
    if (stock <= 0) {
      warnings.push({ name: product.name, requested: totalQty, available: 0, isZero: true });
    } else if (totalQty > stock) {
      warnings.push({ name: product.name, requested: totalQty, available: stock, isZero: false });
    }
  }

  if (warnings.length === 0) return null;

  return (
    <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 space-y-2">
      <div className="flex items-center gap-2 text-red-700 font-black text-sm">
        <AlertTriangle size={16} />
        ⚠️ تحذير المخزون — لن يتم حفظ الفاتورة كمغلقة
      </div>
      {warnings.map((w, i) => (
        <div key={i} className={`text-xs font-bold px-3 py-2 rounded-lg ${
          w.isZero ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
        }`}>
          {w.isZero
            ? `❌ "${w.name}" — نفد من المخزون تماماً`
            : `⚠️ "${w.name}" — مطلوب ${w.requested} لكن المتاح ${w.available} فقط`
          }
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// نموذج الفاتورة الرئيسي
// ══════════════════════════════════════════════════════════════
export default function InvoiceForm({
  type,
  existingInvoice,
  invoices,
  products,
  customers,
  suppliers,
  settings,
  bundles,
  onSave,
  onClose,
  onAddProduct,
}: Props) {
  const currency = settings?.currency ?? "EGP";
  const isSupplierTypeFlag = ["purchase", "return_purchase", "accessory_purchase"].includes(type);

  // ── البيانات الأساسية ──
  const [customerName, setCustomerName] = useState(
    existingInvoice?.customerName ?? existingInvoice?.supplierName ?? ""
  );
  const [customerPhone, setCustomerPhone] = useState(
    existingInvoice?.customerPhone ?? existingInvoice?.supplierPhone ?? ""
  );
  const [customerAddress, setCustomerAddress] = useState(
    existingInvoice?.customerAddress ?? existingInvoice?.supplierAddress ?? ""
  );
  const [date, setDate] = useState(
    existingInvoice?.date ?? new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState(existingInvoice?.notes ?? "");
  const [paid, setPaid] = useState(toNumber(existingInvoice?.paid));
  const [discount, setDiscount] = useState(toNumber(existingInvoice?.discount));
  const [discountType, setDiscountType] = useState<"amount" | "percent">(
    existingInvoice?.discountType ?? "amount"
  );

  // ── البنود ──
  const [items, setItems] = useState<InvoiceItem[]>(() => {
    if (existingInvoice?.items?.length) return existingInvoice.items;
    return [];
  });

  // ── البحث ──
  const [productSearch, setProductSearch] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // ── نافذة إضافة منتج جديد ──
  const [showAddProduct, setShowAddProduct] = useState(false);

  // ── رسالة خطأ المخزون ──
  const [stockError, setStockError] = useState("");

  // ── قائمة المنتجات المحلية ──
  const [localProducts, setLocalProducts] = useState<Product[]>(products ?? []);

  useEffect(() => {
    setLocalProducts(products ?? []);
  }, [products]);

  // ── refs ──
  const productSearchRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // ── قائمة العملاء/الموردين ──
  const contactList = useMemo(() => {
    const list = isSupplierTypeFlag
      ? (suppliers ?? []).map((s) => ({
          name: s?.name ?? "",
          phone: s?.phone ?? "",
          address: s?.address ?? "",
        }))
      : (customers ?? []).map((c) => ({
          name: c?.name ?? "",
          phone: c?.phone ?? "",
          address: c?.address ?? "",
        }));

    if (!customerSearch.trim()) return list.slice(0, 8);

    const q = customerSearch.toLowerCase();
    return list
      .filter((c) => (c.name ?? "").toLowerCase().includes(q) || (c.phone ?? "").includes(q))
      .slice(0, 8);
  }, [customers, suppliers, isSupplierTypeFlag, customerSearch]);

  // ── فلترة المنتجات ──
  const filteredProducts = useMemo(() => {
    const allProducts = (localProducts ?? []).filter(Boolean);

    if (!productSearch.trim()) return allProducts.slice(0, 20);

    const q = productSearch.toLowerCase().trim();
    return allProducts
      .filter(
        (p) =>
          p &&
          ((p.name ?? "").toLowerCase().includes(q) ||
            (p.barcode ?? "").toLowerCase().includes(q) ||
            (p.category ?? "").toLowerCase().includes(q))
      )
      .slice(0, 20);
  }, [localProducts, productSearch]);

  // ── الحسابات ──
  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + toNumber(item?.total), 0),
    [items]
  );

  const totalDiscount = useMemo(() => {
    if (!discount) return 0;
    if (discountType === "percent") return (subtotal * discount) / 100;
    return discount;
  }, [subtotal, discount, discountType]);

  const total = useMemo(() => Math.max(0, subtotal - totalDiscount), [subtotal, totalDiscount]);

  const remaining = useMemo(() => Math.max(0, total - toNumber(paid)), [total, paid]);

  // ✅ فحص المخزون - هل يوجد منتج بدون مخزون كافي
  const hasStockIssue = useMemo(() => {
    if (!isSaleType(type)) return false;

    const productMap = new Map(localProducts.map(p => [p.id, p]));
    const qtyMap = new Map<string, number>();

    for (const item of items) {
      if (!item.productId) continue;
      qtyMap.set(item.productId, (qtyMap.get(item.productId) ?? 0) + (item.quantity ?? 0));
    }

    for (const [productId, totalQty] of qtyMap) {
      const product = productMap.get(productId);
      if (!product) continue;
      const stock = product.stock ?? 0;
      if (stock <= 0 || totalQty > stock) return true;
    }

    return false;
  }, [items, localProducts, type]);

  // ── إضافة منتج للفاتورة مع فحص المخزون ──
  const addProduct = useCallback(
    (product: Product) => {
      if (!product) return;

      // ✅ فحص المخزون عند الإضافة لفواتير البيع
      if (isSaleType(type)) {
        const currentStock = product.stock ?? 0;

        if (currentStock <= 0) {
          setStockError(`❌ لا يمكن إضافة "${product.name}" — المخزون نفد (المتاح: 0)`);
          setTimeout(() => setStockError(""), 4000);
          return;
        }

        // فحص الكمية الموجودة بالفعل في الفاتورة
        const existingQty = items
          .filter(item => item.productId === product.id)
          .reduce((sum, item) => sum + (item.quantity ?? 0), 0);

        if (existingQty + 1 > currentStock) {
          setStockError(`⚠️ "${product.name}" — الكمية المطلوبة (${existingQty + 1}) تتجاوز المخزون المتاح (${currentStock})`);
          setTimeout(() => setStockError(""), 4000);
          return;
        }
      }

      setStockError("");

      setItems((prev) => {
        const existingIndex = prev.findIndex((item) => item.productId === product.id);

        if (existingIndex >= 0) {
          const updated = [...prev];
          const existing = updated[existingIndex];
          const newQty = toNumber(existing.quantity) + 1;

          // ✅ فحص مرة أخرى قبل زيادة الكمية
          if (isSaleType(type)) {
            const currentStock = product.stock ?? 0;
            if (newQty > currentStock) {
              setStockError(`⚠️ "${product.name}" — لا يمكن زيادة الكمية. المتاح: ${currentStock}`);
              setTimeout(() => setStockError(""), 4000);
              return prev;
            }
          }

          updated[existingIndex] = {
            ...existing,
            quantity: newQty,
            total: calcItemTotal({ ...existing, quantity: newQty }),
          };

          return updated;
        }

        const price = isSupplierTypeFlag ? toNumber(product.costPrice) : toNumber(product.sellingPrice);

        const newItem: InvoiceItem = {
          id: generateId(),
          productId: product.id,
          productName: product.name,
          barcode: product.barcode ?? "",
          quantity: 1,
          unitPrice: price,
          costPrice: toNumber(product.costPrice),
          discount: 0,
          discountType: "amount",
          total: price,
          notes: "",
        };

        return [...prev, newItem];
      });

      setProductSearch("");
      setShowProductDropdown(false);
    },
    [isSupplierTypeFlag, type, items]
  );

  // ── إضافة منتج جديد (من النافذة) ──
  const handleAddNewProduct = useCallback(
    (product: Product) => {
      setLocalProducts((prev) => [...prev, product]);

      if (onAddProduct) {
        onAddProduct(product);
      }

      addProduct(product);
    },
    [addProduct, onAddProduct]
  );

  // ── إضافة منتج بالباركود ──
  const addProductByBarcode = useCallback(
    (barcode: string) => {
      const product = (localProducts ?? []).find(
        (p) => (p?.barcode ?? "").toLowerCase() === barcode.toLowerCase()
      );

      if (product) {
        addProduct(product);
        return true;
      }

      return false;
    },
    [localProducts, addProduct]
  );

  // ── تحديث بند مع فحص المخزون ──
  const updateItem = useCallback((index: number, field: keyof InvoiceItem, value: any) => {
    setItems((prev) => {
      if (!prev[index]) return prev;

      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      // ✅ فحص الكمية عند التعديل
      if (field === "quantity" && isSaleType(type)) {
        const product = localProducts.find(p => p.id === item.productId);
        if (product) {
          const currentStock = product.stock ?? 0;
          const newQty = toNumber(value);
          if (newQty > currentStock) {
            setStockError(`⚠️ "${product.name}" — الكمية المطلوبة (${newQty}) تتجاوز المتاح (${currentStock})`);
            setTimeout(() => setStockError(""), 4000);
            // ✅ تعيين الكمية للحد الأقصى المتاح
            item.quantity = currentStock;
          } else {
            setStockError("");
          }
        }
      }

      if (["quantity", "unitPrice", "discount", "discountType"].includes(field as string)) {
        item.total = calcItemTotal(item);
      }

      updated[index] = item as InvoiceItem;
      return updated;
    });
  }, [type, localProducts]);

  // ── حذف بند ──
  const removeItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    setStockError("");
  }, []);

  // ── إضافة باقة ──
  const addBundle = useCallback(
    (bundle: Bundle) => {
      if (!bundle?.items?.length) return;

      const bundleItems: InvoiceItem[] = bundle.items
        .map((bundleItem) => {
          const product = (localProducts ?? []).find((p) => p.id === bundleItem.productId);
          if (!product) return null;

          // ✅ فحص المخزون عند إضافة باقة
          if (isSaleType(type)) {
            const stock = product.stock ?? 0;
            const qty = toNumber(bundleItem.quantity) || 1;
            if (stock <= 0) {
              setStockError(`❌ "${product.name}" — نفد من المخزون (ضمن الباقة)`);
              setTimeout(() => setStockError(""), 4000);
              return null;
            }
            if (qty > stock) {
              setStockError(`⚠️ "${product.name}" — الكمية في الباقة (${qty}) تتجاوز المخزون (${stock})`);
              setTimeout(() => setStockError(""), 4000);
              return null;
            }
          }

          const unitPrice = isSupplierTypeFlag
            ? toNumber(product.costPrice)
            : toNumber(bundleItem.price ?? product.sellingPrice);

          const quantity = toNumber(bundleItem.quantity) || 1;

          return {
            id: generateId(),
            productId: product.id,
            productName: product.name,
            barcode: product.barcode ?? "",
            quantity,
            unitPrice,
            costPrice: toNumber(product.costPrice),
            discount: 0,
            discountType: "amount",
            total: unitPrice * quantity,
            notes: "",
          } as InvoiceItem;
        })
        .filter(Boolean) as InvoiceItem[];

      if (bundleItems.length > 0) {
        setItems((prev) => [...prev, ...bundleItems]);
      }
    },
    [localProducts, isSupplierTypeFlag, type]
  );

  // ── حفظ الفاتورة ──
  const handleSave = useCallback(
    (invoiceStatus: "closed" | "pending") => {
      if (items.length === 0) {
        alert("يجب إضافة منتج واحد على الأقل");
        return;
      }

      // ✅ منع الحفظ كمغلق إذا المخزون غير كافي
      if (invoiceStatus === "closed" && isSaleType(type) && hasStockIssue) {
        alert(
          "❌ لا يمكن حفظ الفاتورة كمغلقة!\n\n" +
          "يوجد منتج واحد أو أكثر بكمية تتجاوز المخزون المتاح.\n" +
          "يرجى تعديل الكميات أو حذف المنتجات غير المتوفرة.\n\n" +
          "💡 يمكنك حفظها كمعلقة بدلاً من ذلك."
        );
        return;
      }

      const invoice: Invoice = {
        id: existingInvoice?.id ?? generateId(),
        number: existingInvoice?.number ?? generateInvoiceNumber(type, invoices),
        type,
        status: invoiceStatus,
        date,
        time: new Date().toLocaleTimeString("ar-EG"),
        createdAt: existingInvoice?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items,
        subtotal,
        discount,
        discountType,
        total,
        paid: invoiceStatus === "pending" ? 0 : toNumber(paid),
        remaining: invoiceStatus === "pending" ? total : remaining,
        notes,
        shiftId: (existingInvoice as any)?.shiftId,
      };

      if (isSupplierTypeFlag) {
        invoice.supplierName = customerName || undefined;
        invoice.supplierPhone = customerPhone || undefined;
        invoice.supplierAddress = customerAddress || undefined;
      } else {
        invoice.customerName = customerName || undefined;
        invoice.customerPhone = customerPhone || undefined;
        invoice.customerAddress = customerAddress || undefined;
      }

      onSave(invoice);
    },
    [
      items,
      existingInvoice,
      type,
      invoices,
      date,
      subtotal,
      discount,
      discountType,
      total,
      paid,
      remaining,
      notes,
      isSupplierTypeFlag,
      customerName,
      customerPhone,
      customerAddress,
      onSave,
      hasStockIssue,
    ]
  );

  // ── مستمع لوحة المفاتيح ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showAddProduct) return;

      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "F12") {
        e.preventDefault();
        handleSave("closed");
        return;
      }
      if (e.key === "F11") {
        e.preventDefault();
        handleSave("pending");
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        setShowAddProduct(true);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, onClose, showAddProduct]);

  // ── عنوان النموذج ──
  const formTitles: Record<InvoiceType, string> = {
    sale: "فاتورة بيع جديدة",
    purchase: "فاتورة شراء جديدة",
    return_sale: "مرتجع مبيعات",
    return_purchase: "مرتجع مشتريات",
    maintenance: "فاتورة صيانة",
    accessory_sale: "بيع اكسسوار",
    accessory_purchase: "شراء اكسسوار",
  };

  const formColors: Record<InvoiceType, string> = {
    sale: "from-blue-600 to-blue-700",
    purchase: "from-green-600 to-green-700",
    return_sale: "from-orange-500 to-orange-600",
    return_purchase: "from-purple-600 to-purple-700",
    maintenance: "from-violet-600 to-violet-700",
    accessory_sale: "from-amber-500 to-amber-600",
    accessory_purchase: "from-teal-600 to-teal-700",
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-2 lg:p-4"
        dir="rtl"
      >
        <div
          ref={formRef}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div
            className={`bg-gradient-to-r ${formColors[type]} px-5 py-4 text-white flex items-center justify-between flex-shrink-0`}
          >
            <div>
              <h2 className="font-black text-lg">
                {existingInvoice ? "تعديل فاتورة" : formTitles[type]}
              </h2>
              <p className="text-white/70 text-xs mt-0.5">
                {existingInvoice?.number ?? "فاتورة جديدة"} · F12 للحفظ · F11 للتعليق · Ctrl+N
                منتج جديد
              </p>
            </div>

            <button
              onClick={onClose}
              className="text-white/70 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">

            {/* ✅ تحذير المخزون في الأعلى */}
            {stockError && (
              <div className="bg-red-50 border-2 border-red-300 rounded-xl px-4 py-3 flex items-center gap-3 animate-pulse">
                <AlertTriangle size={18} className="text-red-600 flex-shrink-0" />
                <span className="text-sm font-black text-red-700 flex-1">{stockError}</span>
                <button onClick={() => setStockError("")} className="text-red-400 hover:text-red-600">
                  <X size={14} />
                </button>
              </div>
            )}

            {/* ✅ بانر تحذير شامل لكل البنود */}
            <StockWarningBanner items={items} products={localProducts} type={type} />

            {/* بيانات العميل/المورد */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2">
                <User size={15} />
                {isSupplierTypeFlag ? "بيانات المورد" : "بيانات العميل"}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="relative">
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value);
                      setCustomerSearch(e.target.value);
                      setShowCustomerDropdown(true);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                    placeholder={isSupplierTypeFlag ? "اسم المورد" : "اسم العميل"}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 transition-colors"
                  />

                  {showCustomerDropdown && contactList.length > 0 && (
                    <div className="absolute top-full right-0 left-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 z-50 max-h-48 overflow-y-auto">
                      {contactList.map((c, i) => (
                        <button
                          key={i}
                          type="button"
                          onMouseDown={() => {
                            setCustomerName(c.name);
                            setCustomerPhone(c.phone);
                            setCustomerAddress(c.address);
                            setShowCustomerDropdown(false);
                          }}
                          className="w-full text-right px-4 py-2.5 hover:bg-blue-50 text-sm border-b border-gray-50 last:border-0 transition-colors"
                        >
                          <div className="font-bold text-gray-800">{c.name}</div>
                          {c.phone && <div className="text-xs text-gray-500">{c.phone}</div>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <Phone size={14} className="absolute right-3 top-3 text-gray-400" />
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="رقم الهاتف"
                    className="w-full border-2 border-gray-200 rounded-xl pr-8 pl-4 py-2.5 text-sm outline-none focus:border-blue-400 transition-colors"
                  />
                </div>

                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 transition-colors"
                />
              </div>
            </div>

            {/* إضافة المنتجات */}
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2">
                  <Package size={15} />
                  إضافة منتجات ({items.length} بند)
                </h3>

                <button
                  onClick={() => setShowAddProduct(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 active:scale-95 shadow-sm transition-all"
                >
                  <Plus size={14} />
                  منتج جديد
                </button>
              </div>

              {/* بحث المنتجات */}
              <div className="relative mb-3">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Search size={16} className="absolute right-3 top-3 text-gray-400" />
                    <input
                      ref={productSearchRef}
                      type="text"
                      value={productSearch}
                      onChange={(e) => {
                        setProductSearch(e.target.value);
                        setShowProductDropdown(true);
                      }}
                      onFocus={() => setShowProductDropdown(true)}
                      onBlur={() => setTimeout(() => setShowProductDropdown(false), 250)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const found = addProductByBarcode(productSearch);

                          if (!found && filteredProducts.length === 1) {
                            addProduct(filteredProducts[0]);
                          } else if (!found && filteredProducts.length > 0) {
                            setShowProductDropdown(true);
                          }
                        }
                      }}
                      placeholder="ابحث باسم المنتج أو الباركود..."
                      className="w-full border-2 border-blue-200 rounded-xl pr-9 pl-4 py-2.5 text-sm outline-none focus:border-blue-500 bg-white transition-colors"
                      autoComplete="off"
                    />
                  </div>
                </div>

                {/* قائمة المنتجات مع مؤشرات المخزون */}
                {showProductDropdown && (
                  <div className="absolute top-full right-0 left-0 mt-1 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 max-h-64 overflow-y-auto">
                    {filteredProducts.length === 0 ? (
                      <div className="p-4 text-center text-gray-400 text-sm">
                        <Package size={24} className="mx-auto mb-2 opacity-30" />
                        <div>لا توجد منتجات مطابقة</div>

                        <button
                          onMouseDown={() => {
                            setShowProductDropdown(false);
                            setShowAddProduct(true);
                          }}
                          className="mt-3 flex items-center gap-2 mx-auto px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors"
                        >
                          <Plus size={14} />
                          إضافة منتج جديد
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-500 font-bold flex items-center justify-between">
                          <span>{filteredProducts.length} منتج · انقر للإضافة</span>
                          <button
                            onMouseDown={() => {
                              setShowProductDropdown(false);
                              setShowAddProduct(true);
                            }}
                            className="flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-200 transition-colors"
                          >
                            <Plus size={12} />
                            جديد
                          </button>
                        </div>

                        {filteredProducts.map((product) => {
                          const stock = product.stock ?? 0;
                          const isOutOfStock = isSaleType(type) && stock <= 0;
                          const isLowStock = isSaleType(type) && stock > 0 && stock <= 5;

                          return (
                            <button
                              key={product.id}
                              type="button"
                              onMouseDown={() => {
                                if (!isOutOfStock) addProduct(product);
                              }}
                              disabled={isOutOfStock}
                              className={`w-full text-right px-4 py-3 border-b border-gray-50 last:border-0 transition-colors flex items-center justify-between gap-3 ${
                                isOutOfStock
                                  ? "opacity-50 cursor-not-allowed bg-red-50"
                                  : isLowStock
                                  ? "hover:bg-amber-50"
                                  : "hover:bg-blue-50"
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-gray-800 text-sm truncate flex items-center gap-2">
                                  {product.name}
                                  {isOutOfStock && (
                                    <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-black">
                                      نفد
                                    </span>
                                  )}
                                </div>

                                <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                                  {product.barcode && (
                                    <span className="font-mono">{product.barcode}</span>
                                  )}
                                  {product.category && (
                                    <span className="text-gray-400">· {product.category}</span>
                                  )}
                                </div>
                              </div>

                              <div className="text-left flex-shrink-0">
                                <div className="font-black text-blue-600 text-sm">
                                  {fmt(
                                    isSupplierTypeFlag ? product.costPrice : product.sellingPrice
                                  )}
                                  <span className="text-xs font-normal text-gray-400 mr-1">
                                    {currency}
                                  </span>
                                </div>

                                {/* ✅ مؤشر المخزون الملون */}
                                <div className={`text-xs font-black flex items-center gap-1 justify-end ${
                                  isOutOfStock
                                    ? "text-red-600"
                                    : isLowStock
                                    ? "text-amber-600"
                                    : "text-emerald-600"
                                }`}>
                                  {isOutOfStock ? "❌" : isLowStock ? "⚠️" : "✅"}
                                  مخزون: {fmt(product.stock)}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* الباقات */}
              {bundles && bundles.length > 0 && (
                <div className="flex gap-2 flex-wrap mb-3">
                  <span className="text-xs text-gray-500 font-bold self-center">باقات:</span>
                  {bundles
                    .filter((b: any) => b?.isActive !== false)
                    .map((bundle) => (
                      <button
                        key={bundle.id}
                        onClick={() => addBundle(bundle)}
                        className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-bold hover:bg-amber-100 transition-colors"
                      >
                        🎁 {bundle.name}
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* جدول البنود */}
            {items.length > 0 ? (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-3 py-2.5 text-right font-bold text-gray-600 text-xs">#</th>
                        <th className="px-3 py-2.5 text-right font-bold text-gray-600 text-xs">المنتج</th>
                        <th className="px-3 py-2.5 text-center font-bold text-gray-600 text-xs w-20">الكمية</th>
                        <th className="px-3 py-2.5 text-center font-bold text-gray-600 text-xs w-28">السعر</th>
                        <th className="px-3 py-2.5 text-center font-bold text-gray-600 text-xs w-24">خصم</th>
                        <th className="px-3 py-2.5 text-center font-bold text-gray-600 text-xs w-28">الإجمالي</th>
                        <th className="px-3 py-2.5 w-10"></th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-100">
                      {items.map((item, index) => {
                        // ✅ فحص المخزون لكل بند
                        const product = localProducts.find(p => p.id === item.productId);
                        const stock = product?.stock ?? 0;
                        const itemHasStockIssue = isSaleType(type) && (stock <= 0 || (item.quantity ?? 0) > stock);

                        return (
                          <tr key={item.id} className={`transition-colors ${
                            itemHasStockIssue ? "bg-red-50 hover:bg-red-100" : "hover:bg-gray-50"
                          }`}>
                            <td className="px-3 py-2 text-gray-400 text-xs font-bold">{index + 1}</td>

                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <div className="font-bold text-gray-800 text-sm">{item.productName}</div>
                                {/* ✅ شارة تحذير على البند */}
                                {itemHasStockIssue && (
                                  <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-black flex items-center gap-0.5">
                                    <AlertTriangle size={10} />
                                    {stock <= 0 ? "نفد" : `متاح: ${stock}`}
                                  </span>
                                )}
                              </div>
                              {item.barcode && (
                                <div className="text-xs text-gray-400 font-mono">{item.barcode}</div>
                              )}
                            </td>

                            <td className="px-2 py-2">
                              <input
                                type="number"
                                min="1"
                                max={isSaleType(type) ? stock || undefined : undefined}
                                value={item.quantity ?? 1}
                                onChange={(e) =>
                                  updateItem(
                                    index,
                                    "quantity",
                                    Math.max(1, toNumber(e.target.value))
                                  )
                                }
                                className={`w-full text-center border-2 rounded-lg px-2 py-1.5 text-sm outline-none font-bold transition-colors ${
                                  itemHasStockIssue
                                    ? "border-red-300 focus:border-red-500 bg-red-50"
                                    : "border-gray-200 focus:border-blue-400"
                                }`}
                              />
                            </td>

                            <td className="px-2 py-2">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.unitPrice ?? 0}
                                onChange={(e) =>
                                  updateItem(
                                    index,
                                    "unitPrice",
                                    Math.max(0, toNumber(e.target.value))
                                  )
                                }
                                className="w-full text-center border-2 border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-400 font-bold transition-colors"
                              />
                            </td>

                            <td className="px-2 py-2">
                              <div className="flex gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  value={item.discount ?? 0}
                                  onChange={(e) =>
                                    updateItem(
                                      index,
                                      "discount",
                                      Math.max(0, toNumber(e.target.value))
                                    )
                                  }
                                  className="w-16 text-center border-2 border-gray-200 rounded-lg px-1 py-1.5 text-xs outline-none focus:border-blue-400 transition-colors"
                                />
                                <button
                                  onClick={() =>
                                    updateItem(
                                      index,
                                      "discountType",
                                      item.discountType === "percent" ? "amount" : "percent"
                                    )
                                  }
                                  className="px-1.5 py-1 bg-gray-100 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-200 transition-colors"
                                >
                                  {item.discountType === "percent" ? "%" : currency}
                                </button>
                              </div>
                            </td>

                            <td className="px-3 py-2 text-center">
                              <span className="font-black text-gray-800">{fmt(item.total)}</span>
                            </td>

                            <td className="px-2 py-2">
                              <button
                                onClick={() => removeItem(index)}
                                className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
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
            ) : (
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center text-gray-400">
                <Package size={32} className="mx-auto mb-2 opacity-30" />
                <div className="font-bold text-sm">لم يتم إضافة أي منتجات</div>
                <div className="text-xs mt-1">ابحث عن منتج أو امسح الباركود للإضافة</div>
                <button
                  onClick={() => setShowAddProduct(true)}
                  className="mt-3 flex items-center gap-2 mx-auto px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 active:scale-95 shadow-sm transition-all"
                >
                  <Plus size={14} />
                  إضافة منتج جديد
                </button>
              </div>
            )}

            {/* الإجمالي والدفع */}
            {items.length > 0 && (
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* الخصم والملاحظات */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-gray-600 mb-1 block">
                        خصم إجمالي
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="0"
                          value={discount || ""}
                          onChange={(e) => setDiscount(Math.max(0, toNumber(e.target.value)))}
                          className="flex-1 border-2 border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400 transition-colors"
                          placeholder="0"
                        />
                        <button
                          onClick={() =>
                            setDiscountType(discountType === "percent" ? "amount" : "percent")
                          }
                          className="px-4 py-2 bg-blue-100 text-blue-700 rounded-xl text-sm font-black hover:bg-blue-200 transition-colors min-w-[60px]"
                        >
                          {discountType === "percent" ? "%" : currency}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-gray-600 mb-1 block">ملاحظات</label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none transition-colors"
                        placeholder="ملاحظات اختيارية..."
                      />
                    </div>
                  </div>

                  {/* الحسابات */}
                  <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">المجموع الفرعي</span>
                      <span className="font-bold">{fmt(subtotal)} {currency}</span>
                    </div>

                    {totalDiscount > 0 && (
                      <div className="flex justify-between text-sm text-red-600">
                        <span>الخصم</span>
                        <span className="font-bold">- {fmt(totalDiscount)} {currency}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-base font-black border-t border-gray-100 pt-2">
                      <span>الإجمالي</span>
                      <span className="text-blue-600">{fmt(total)} {currency}</span>
                    </div>

                    <div className="pt-2 space-y-2">
                      <div>
                        <label className="text-xs font-bold text-gray-600 mb-1 block">
                          المبلغ المدفوع
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={total}
                          value={paid || ""}
                          onChange={(e) =>
                            setPaid(Math.min(total, Math.max(0, toNumber(e.target.value))))
                          }
                          className="w-full border-2 border-emerald-300 rounded-xl px-4 py-3 text-xl font-black text-center outline-none focus:border-emerald-500 text-emerald-700 transition-colors"
                          placeholder="0"
                        />
                      </div>

                      {remaining > 0 && (
                        <div className="flex justify-between text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                          <span className="font-bold">المتبقي</span>
                          <span className="font-black">{fmt(remaining)} {currency}</span>
                        </div>
                      )}

                      {remaining === 0 && total > 0 && (
                        <div className="flex items-center justify-center gap-2 text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">
                          <Check size={14} />
                          <span className="text-sm font-bold">مدفوع بالكامل</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 border-t border-gray-100 p-4 bg-gray-50">
            <div className="flex gap-3 justify-between">
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 bg-gray-200 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-300 transition-colors"
                >
                  إغلاق
                </button>

                <button
                  onClick={() => setShowAddProduct(true)}
                  className="px-4 py-2.5 bg-emerald-100 text-emerald-700 rounded-xl font-bold text-sm hover:bg-emerald-200 transition-colors flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  منتج جديد
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleSave("pending")}
                  disabled={items.length === 0}
                  className="px-5 py-2.5 bg-amber-500 text-white rounded-xl font-bold text-sm hover:bg-amber-600 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  <Clock size={15} />
                  تعليق (F11)
                </button>

                <button
                  onClick={() => handleSave("closed")}
                  disabled={items.length === 0 || (isSaleType(type) && hasStockIssue)}
                  className={`px-6 py-2.5 rounded-xl font-black text-sm active:scale-95 shadow-md transition-all flex items-center gap-2 ${
                    isSaleType(type) && hasStockIssue
                      ? "bg-red-400 text-white cursor-not-allowed opacity-60"
                      : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200 disabled:opacity-50"
                  }`}
                  title={isSaleType(type) && hasStockIssue ? "لا يمكن الحفظ — مشكلة في المخزون" : ""}
                >
                  {isSaleType(type) && hasStockIssue ? (
                    <><AlertTriangle size={15} /> مشكلة مخزون</>
                  ) : (
                    <><Save size={15} /> حفظ وإغلاق (F12)</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showAddProduct && (
        <AddProductModal
          currency={currency}
          isSupplierType={isSupplierTypeFlag}
          onAdd={handleAddNewProduct}
          onClose={() => setShowAddProduct(false)}
        />
      )}
    </>
  );
}