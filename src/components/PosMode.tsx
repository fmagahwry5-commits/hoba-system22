import { useState, useRef, useEffect, useCallback } from "react";
import {
  ShoppingCart, Trash2, Plus, Minus, Search, X,
  Barcode, CreditCard, Banknote, CheckCircle2,
  Package, User, Phone, Receipt, ArrowLeft,
  Zap, Hash, Tag, AlertCircle, Printer, RotateCcw
} from "lucide-react";

interface PosProduct {
  id: string;
  name: string;
  barcode: string;
  sellingPrice: number;
  purchasePrice?: number;
  stock: number;
  unit: string;
}

interface PosItem {
  product: PosProduct;
  quantity: number;
  price: number;
  total: number;
  discount: number;
}

interface PosProps {
  products: PosProduct[];
  currency: string;
  onCompleteSale: (invoice: any) => void;
  onClose: () => void;
  settings?: any;
}

export default function PosMode({ products, currency, onCompleteSale, onClose, settings }: PosProps) {
  const [items, setItems] = useState<PosItem[]>([]);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [searchMode, setSearchMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "mixed">("cash");
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastInvoiceNumber, setLastInvoiceNumber] = useState("");
  const [lastTotal, setLastTotal] = useState(0);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [notFound, setNotFound] = useState(false);

  const barcodeRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const paidRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showPayment && !searchMode && !showSuccess) {
      const t = setTimeout(() => barcodeRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [showPayment, searchMode, showSuccess, items]);

  useEffect(() => {
    if (showPayment) {
      const t = setTimeout(() => paidRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [showPayment]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showSuccess) { setShowSuccess(false); return; }
        if (showPayment) { setShowPayment(false); return; }
        if (searchMode) { setSearchMode(false); setSearchTerm(""); return; }
        onClose();
        return;
      }
      if (e.key === "F9" && !showPayment && !searchMode && !showSuccess) {
        e.preventDefault();
        if (items.length > 0) setShowPayment(true);
        return;
      }
      if (e.key === "F10" && !showPayment && !showSuccess) {
        e.preventDefault();
        setSearchMode(true);
        setTimeout(() => searchRef.current?.focus(), 100);
        return;
      }
      if (e.ctrlKey && e.key === "Delete") {
        e.preventDefault();
        setItems([]);
        return;
      }
      if (e.key === "Enter" && showPayment) {
        e.preventDefault();
        if (paidAmount > 0 || paymentMethod !== "cash") completeSale();
        return;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [items, showPayment, searchMode, showSuccess, paidAmount, paymentMethod]);

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const totalAfterDiscount = Math.max(0, subtotal - discount);
  const change = paidAmount - totalAfterDiscount;
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  const addByBarcode = useCallback((barcode: string) => {
    if (!barcode.trim()) return;
    const product = products.find(
      (p) => p.barcode === barcode.trim() || p.id === barcode.trim()
    );
    if (!product) {
      setNotFound(true);
      setTimeout(() => setNotFound(false), 2000);
      setBarcodeInput("");
      return;
    }
    addProduct(product);
    setBarcodeInput("");
  }, [products]);

  const addProduct = useCallback((product: PosProduct) => {
    if (product.stock <= 0) {
      alert(`المنتج "${product.name}" غير متوفر في المخزون`);
      return;
    }
    setItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.product.id === product.id);
      if (existingIndex >= 0) {
        const existing = prev[existingIndex];
        if (existing.quantity >= product.stock) {
          alert(`الكمية المتاحة من "${product.name}" هي ${product.stock} فقط`);
          return prev;
        }
        const updated = [...prev];
        updated[existingIndex] = {
          ...existing,
          quantity: existing.quantity + 1,
          total: (existing.quantity + 1) * existing.price,
        };
        return updated;
      }
      return [
        ...prev,
        { product, quantity: 1, price: product.sellingPrice, total: product.sellingPrice, discount: 0 },
      ];
    });
    setSearchMode(false);
    setSearchTerm("");
    setTimeout(() => barcodeRef.current?.focus(), 100);
  }, []);

  const updateQuantity = useCallback((productId: string, newQty: number) => {
    if (newQty <= 0) { removeItem(productId); return; }
    setItems((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          if (newQty > item.product.stock) { alert(`الكمية المتاحة: ${item.product.stock} فقط`); return item; }
          return { ...item, quantity: newQty, total: newQty * item.price };
        }
        return item;
      })
    );
  }, []);

  const updatePrice = useCallback((productId: string, newPrice: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.product.id === productId
          ? { ...item, price: newPrice, total: item.quantity * newPrice }
          : item
      )
    );
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((item) => item.product.id !== productId));
  }, []);

  const completeSale = useCallback(() => {
    if (items.length === 0) return;
    const invoiceNumber = `POS-${Date.now().toString().slice(-8)}`;
    const now = new Date();
    const invoice = {
      id: `pos-${Date.now()}`,
      number: invoiceNumber,
      type: "sale" as const,
      status: "closed" as const,
      date: now.toLocaleDateString("ar-EG"),
      time: now.toLocaleTimeString("ar-EG"),
      customerName: customerName.trim() || "عميل نقدي",
      customerPhone: customerPhone.trim() || "",
      items: items.map((item) => ({
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
        price: item.price,
        total: item.total,
        unit: item.product.unit,
      })),
      subtotal,
      discount,
      total: totalAfterDiscount,
      paid: paidAmount || totalAfterDiscount,
      remaining: Math.max(0, totalAfterDiscount - (paidAmount || totalAfterDiscount)),
      paymentMethod,
      change: Math.max(0, change),
    };
    onCompleteSale(invoice);
    setRecentSales((prev) => [
      { number: invoiceNumber, total: totalAfterDiscount, items: totalItems, time: now.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }) },
      ...prev.slice(0, 4),
    ]);
    setLastInvoiceNumber(invoiceNumber);
    setLastTotal(totalAfterDiscount);
    setShowSuccess(true);
    setShowPayment(false);
    setTimeout(() => {
      setItems([]);
      setCustomerName("");
      setCustomerPhone("");
      setPaidAmount(0);
      setDiscount(0);
      setShowSuccess(false);
      barcodeRef.current?.focus();
    }, 2500);
  }, [items, subtotal, discount, totalAfterDiscount, paidAmount, change, customerName, customerPhone, paymentMethod, totalItems, onCompleteSale]);

  const filteredProducts = searchTerm.trim()
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (p.barcode ?? "").includes(searchTerm)
      ).slice(0, 10)
    : products.slice(0, 10);

  const quickAmounts = [50, 100, 200, 500, 1000];

  return (
    <div className="fixed inset-0 bg-gray-950 z-[200] flex flex-col select-none" dir="rtl">

      {/* Header */}
      <div className="bg-gray-900 px-6 py-3 flex items-center justify-between border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="text-gray-500 hover:text-white p-2 rounded-xl hover:bg-gray-800 transition-all" title="خروج (Esc)">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Zap size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-black text-base leading-tight">نقطة البيع السريع</h1>
              <p className="text-gray-500 text-[10px] uppercase tracking-widest">{settings?.shopName || "POS MODE"}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {[
            { key: "F9", label: "إتمام البيع", color: "bg-emerald-900/50 text-emerald-400 border-emerald-800" },
            { key: "F10", label: "بحث", color: "bg-blue-900/50 text-blue-400 border-blue-800" },
            { key: "Esc", label: "خروج", color: "bg-gray-800 text-gray-400 border-gray-700" },
            { key: "Ctrl+Del", label: "مسح", color: "bg-red-900/50 text-red-400 border-red-800" },
          ].map((s) => (
            <div key={s.key} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold ${s.color}`}>
              <span className="opacity-60 font-mono">{s.key}</span>
              <span className="opacity-80">{s.label}</span>
            </div>
          ))}
          <div className="text-gray-400 text-sm font-bold bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700">
            {new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">

        {/* القائمة - الجزء الأيسر */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* حقل الباركود */}
          <div className="p-4 bg-gray-900/50 border-b border-gray-800 flex-shrink-0">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Barcode size={20} className={`absolute right-4 top-3.5 transition-colors ${notFound ? "text-red-400 animate-bounce" : "text-blue-400"}`} />
                <input
                  ref={barcodeRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && barcodeInput.trim()) addByBarcode(barcodeInput); }}
                  placeholder={notFound ? "⚠️ لم يتم العثور على المنتج..." : "امسح الباركود أو اكتب كود المنتج + Enter..."}
                  className={`w-full bg-gray-800 border-2 rounded-2xl p-3.5 pr-12 text-white text-base font-bold outline-none transition-all placeholder-gray-600 ${notFound ? "border-red-500 focus:border-red-400" : "border-gray-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"}`}
                />
              </div>
              <button
                onClick={() => { setSearchMode(true); setTimeout(() => searchRef.current?.focus(), 100); }}
                className="bg-blue-600 text-white px-6 rounded-2xl hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2 font-black shadow-lg shadow-blue-600/30"
              >
                <Search size={18} /> F10
              </button>
            </div>
          </div>

          {/* جدول الأصناف */}
          <div className="flex-1 overflow-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-700">
                <ShoppingCart size={100} className="opacity-10 mb-6" />
                <p className="text-2xl font-black opacity-20">الفاتورة فارغة</p>
                <p className="text-sm opacity-10 mt-2">امسح الباركود أو اضغط F10 للبحث</p>
              </div>
            ) : (
              <div className="p-4 space-y-2">
                <div className="grid grid-cols-12 gap-2 text-[10px] font-black text-gray-600 uppercase tracking-widest px-3 py-2 border-b border-gray-800">
                  <div className="col-span-1">#</div>
                  <div className="col-span-4">المنتج</div>
                  <div className="col-span-2 text-center">سعر البيع</div>
                  <div className="col-span-3 text-center">الكمية</div>
                  <div className="col-span-1 text-center">الإجمالي</div>
                  <div className="col-span-1"></div>
                </div>
                {items.map((item, index) => (
                  <div key={item.product.id} className="grid grid-cols-12 gap-2 items-center bg-gray-800/60 hover:bg-gray-800 rounded-2xl p-3 border border-gray-700/50 hover:border-blue-500/30 transition-all group">
                    <div className="col-span-1 w-7 h-7 bg-gray-700 rounded-lg flex items-center justify-center text-gray-400 font-black text-sm">{index + 1}</div>
                    <div className="col-span-4">
                      <div className="text-white font-bold text-sm truncate">{item.product.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-gray-600 text-[10px] font-mono flex items-center gap-0.5"><Hash size={9} />{item.product.barcode || item.product.id}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${item.product.stock > 5 ? "bg-emerald-900/50 text-emerald-400" : item.product.stock > 0 ? "bg-orange-900/50 text-orange-400" : "bg-red-900/50 text-red-400"}`}>
                          {item.product.stock} {item.product.unit}
                        </span>
                      </div>
                    </div>
                    <div className="col-span-2 text-center">
                      <input
                        type="number"
                        value={item.price}
                        onChange={(e) => updatePrice(item.product.id, Number(e.target.value))}
                        className="w-full bg-gray-700 border border-gray-600 rounded-xl px-2 py-2 text-amber-400 text-center text-sm font-black outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                        min="0"
                      />
                    </div>
                    <div className="col-span-3 flex items-center justify-center gap-2">
                      <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)} className="w-9 h-9 bg-red-600/20 text-red-400 rounded-xl flex items-center justify-center hover:bg-red-600/40 active:scale-90 transition-all">
                        <Minus size={16} />
                      </button>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.product.id, Number(e.target.value))}
                        className="w-14 bg-gray-700 border border-gray-600 rounded-xl px-1 py-2 text-white text-center text-base font-black outline-none focus:border-blue-500"
                        min="1"
                      />
                      <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)} className="w-9 h-9 bg-emerald-600/20 text-emerald-400 rounded-xl flex items-center justify-center hover:bg-emerald-600/40 active:scale-90 transition-all">
                        <Plus size={16} />
                      </button>
                    </div>
                    <div className="col-span-1 text-center">
                      <div className="text-emerald-400 font-black text-base">{item.total.toLocaleString()}</div>
                      <div className="text-gray-600 text-[9px]">{currency}</div>
                    </div>
                    <div className="col-span-1 text-center">
                      <button onClick={() => removeItem(item.product.id)} className="text-red-500 hover:text-red-300 hover:bg-red-600/20 p-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-all">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* الجانب الأيمن - الملخص */}
        <div className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col flex-shrink-0">

          {/* بيانات العميل */}
          <div className="p-4 border-b border-gray-800 space-y-2.5 flex-shrink-0">
            <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2">بيانات العميل (اختياري)</div>
            <div className="relative">
              <User size={15} className="absolute right-3.5 top-3 text-gray-600" />
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="اسم العميل"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl p-2.5 pr-10 text-white text-sm outline-none focus:border-blue-500 placeholder-gray-700"
              />
            </div>
            <div className="relative">
              <Phone size={15} className="absolute right-3.5 top-3 text-gray-600" />
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="رقم الهاتف"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl p-2.5 pr-10 text-white text-sm outline-none focus:border-blue-500 placeholder-gray-700"
              />
            </div>
          </div>

          {/* تفاصيل الفاتورة */}
          <div className="flex-1 overflow-auto p-4 space-y-3">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">عدد الأصناف</span>
                <span className="text-white font-bold">{items.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">إجمالي القطع</span>
                <span className="text-white font-bold">{totalItems}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-gray-800">
                <span className="text-gray-500">المجموع الفرعي</span>
                <span className="text-white font-bold">{subtotal.toLocaleString()} {currency}</span>
              </div>
            </div>

            {/* الخصم */}
            <div className="flex items-center gap-2 bg-gray-800/50 rounded-xl p-2.5 border border-gray-700">
              <Tag size={15} className="text-orange-400 flex-shrink-0" />
              <span className="text-gray-400 text-sm flex-shrink-0">خصم</span>
              <input
                type="number"
                value={discount || ""}
                onChange={(e) => setDiscount(Number(e.target.value))}
                className="flex-1 bg-transparent text-orange-400 text-sm font-black text-center outline-none"
                placeholder="0"
                min="0"
              />
              <span className="text-gray-600 text-xs flex-shrink-0">{currency}</span>
            </div>

            {/* آخر الفواتير */}
            {recentSales.length > 0 && (
              <div className="pt-2 border-t border-gray-800">
                <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2">آخر الفواتير</div>
                {recentSales.map((sale, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-gray-800/50">
                    <span className="text-gray-600 font-mono">{sale.number}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">{sale.time}</span>
                      <span className="text-emerald-400 font-black">{sale.total.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* الإجمالي وأزرار الإجراء */}
          <div className="p-4 bg-gray-950 border-t border-gray-800 flex-shrink-0 space-y-3">
            <div className="bg-gradient-to-br from-blue-600/20 to-blue-900/20 rounded-2xl p-4 text-center border border-blue-500/20">
              <div className="text-blue-400 text-[10px] font-black uppercase tracking-widest mb-1">الإجمالي المطلوب</div>
              <div className="text-white font-black text-4xl leading-tight">{totalAfterDiscount.toLocaleString()}</div>
              <div className="text-blue-400 text-sm font-bold mt-1">{currency}</div>
            </div>

            <button
              onClick={() => { if (items.length > 0) setShowPayment(true); }}
              disabled={items.length === 0}
              className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black text-lg shadow-2xl shadow-emerald-600/40 hover:bg-emerald-500 active:scale-95 transition-all disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              <CreditCard size={22} /> إتمام البيع
              <span className="text-emerald-200 text-xs font-bold bg-emerald-700/50 px-2 py-0.5 rounded-lg">F9</span>
            </button>

            <button
              onClick={() => setItems([])}
              disabled={items.length === 0}
              className="w-full bg-gray-800 text-gray-500 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-700 hover:text-gray-300 active:scale-95 transition-all disabled:opacity-20 flex items-center justify-center gap-2"
            >
              <RotateCcw size={15} /> إلغاء وبدء من جديد
            </button>
          </div>
        </div>
      </div>

      {/* مودال البحث */}
      {searchMode && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[210] flex items-start justify-center pt-16 p-4">
          <div className="bg-gray-900 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-gray-700">
            <div className="p-5 border-b border-gray-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-black text-lg flex items-center gap-2"><Search size={20} className="text-blue-400" /> بحث عن منتج</h3>
                <button onClick={() => { setSearchMode(false); setSearchTerm(""); }} className="text-gray-600 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-all"><X size={20} /></button>
              </div>
              <input
                ref={searchRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="اكتب اسم المنتج أو الباركود..."
                className="w-full bg-gray-800 border-2 border-blue-500/50 rounded-2xl p-4 text-white text-lg font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 placeholder-gray-600"
              />
            </div>
            <div className="max-h-[500px] overflow-auto divide-y divide-gray-800">
              {filteredProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addProduct(p)}
                  disabled={p.stock <= 0}
                  className="w-full p-4 hover:bg-gray-800/60 flex items-center justify-between text-right transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-blue-900/40 rounded-xl flex items-center justify-center text-blue-400 flex-shrink-0">
                      <Package size={20} />
                    </div>
                    <div>
                      <div className="text-white font-bold text-sm">{p.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-gray-600 text-[10px] font-mono">{p.barcode || p.id}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${p.stock > 0 ? "bg-emerald-900/50 text-emerald-400" : "bg-red-900/50 text-red-400"}`}>
                          {p.stock > 0 ? `${p.stock} ${p.unit}` : "نفذ"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-emerald-400 font-black text-xl">{p.sellingPrice.toLocaleString()}</span>
                    <span className="text-gray-600 text-[10px]">{currency}</span>
                  </div>
                </button>
              ))}
              {searchTerm && filteredProducts.length === 0 && (
                <div className="p-16 text-center text-gray-700">
                  <AlertCircle size={48} className="mx-auto mb-3 opacity-30" />
                  <p className="font-bold opacity-50">لا توجد نتائج لـ "{searchTerm}"</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* مودال الدفع */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[210] flex items-center justify-center p-4">
          <div className="bg-gray-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-gray-700">
            <div className="bg-gradient-to-br from-emerald-700 to-emerald-900 p-8 text-center">
              <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CreditCard size={32} className="text-white" />
              </div>
              <div className="text-5xl font-black text-white">{totalAfterDiscount.toLocaleString()}</div>
              <div className="text-emerald-300 text-lg font-bold mt-2">{currency} · المبلغ المطلوب</div>
              {discount > 0 && <div className="text-emerald-400/70 text-sm mt-1">بعد خصم {discount.toLocaleString()} {currency}</div>}
            </div>

            <div className="p-6 space-y-5">
              {/* طريقة الدفع */}
              <div>
                <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2">طريقة الدفع</div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "cash" as const, label: "نقدي", icon: Banknote, color: "emerald" },
                    { id: "card" as const, label: "بطاقة", icon: CreditCard, color: "blue" },
                    { id: "mixed" as const, label: "مختلط", icon: Receipt, color: "purple" },
                  ].map((method) => (
                    <button
                      key={method.id}
                      onClick={() => setPaymentMethod(method.id)}
                      className={`p-3 rounded-2xl border-2 flex flex-col items-center gap-1.5 transition-all font-bold text-xs ${
                        paymentMethod === method.id
                          ? "border-emerald-500 bg-emerald-900/30 text-emerald-400"
                          : "border-gray-700 text-gray-500 hover:border-gray-600 bg-gray-800/50"
                      }`}
                    >
                      <method.icon size={22} />
                      {method.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* المبلغ المدفوع */}
              <div>
                <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2">المبلغ المدفوع</div>
                <input
                  ref={paidRef}
                  type="number"
                  value={paidAmount || ""}
                  onChange={(e) => setPaidAmount(Number(e.target.value))}
                  className="w-full bg-gray-800 border-2 border-gray-700 rounded-2xl p-4 text-white text-3xl font-black text-center outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                  placeholder={totalAfterDiscount.toString()}
                />
              </div>

              {/* الأرقام السريعة */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setPaidAmount(totalAfterDiscount)}
                  className="flex-1 bg-emerald-900/40 text-emerald-400 px-3 py-2 rounded-xl text-xs font-black hover:bg-emerald-900/60 transition-all border border-emerald-800"
                >
                  بالضبط
                </button>
                {quickAmounts.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setPaidAmount(amount)}
                    className="bg-gray-800 text-gray-300 px-4 py-2 rounded-xl text-sm font-black hover:bg-gray-700 transition-all border border-gray-700"
                  >
                    {amount}
                  </button>
                ))}
              </div>

              {/* الباقي */}
              {paidAmount > 0 && (
                <div className={`rounded-2xl p-4 text-center border-2 transition-all ${
                  change >= 0
                    ? "bg-emerald-900/20 border-emerald-700/50 text-emerald-400"
                    : "bg-red-900/20 border-red-700/50 text-red-400"
                }`}>
                  <div className="text-xs font-black opacity-70 uppercase tracking-widest mb-1">
                    {change >= 0 ? "الباقي للعميل" : "مبلغ متبقي على العميل"}
                  </div>
                  <div className="text-4xl font-black">{Math.abs(change).toLocaleString()} <span className="text-base font-bold opacity-70">{currency}</span></div>
                </div>
              )}

              {/* أزرار الإتمام */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={completeSale}
                  className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-emerald-600/30 hover:bg-emerald-500 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={24} /> تأكيد البيع
                </button>
                <button
                  onClick={() => setShowPayment(false)}
                  className="bg-gray-800 text-gray-400 px-6 py-4 rounded-2xl font-bold hover:bg-gray-700 transition-all border border-gray-700"
                >
                  رجوع
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* رسالة النجاح */}
      {showSuccess && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[220] flex items-center justify-center">
          <div className="bg-gray-900 rounded-3xl p-10 text-center max-w-sm border border-emerald-700/30 shadow-2xl">
            <div className="w-24 h-24 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-emerald-600/40">
              <CheckCircle2 size={48} className="text-white" />
            </div>
            <h3 className="text-3xl font-black text-white mb-3">تم البيع!</h3>
            <p className="text-gray-400 text-sm mb-1">رقم الفاتورة</p>
            <p className="text-emerald-400 font-black text-xl mb-4">{lastInvoiceNumber}</p>
            <div className="bg-emerald-900/20 rounded-2xl p-4 border border-emerald-800/30 mb-6">
              <div className="text-gray-500 text-xs mb-1">الإجمالي</div>
              <div className="text-emerald-400 font-black text-3xl">{lastTotal.toLocaleString()} {currency}</div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowSuccess(false)} className="flex-1 bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
                <Zap size={18} /> فاتورة جديدة
              </button>
              <button onClick={() => window.print()} className="bg-gray-800 text-gray-300 px-5 py-3 rounded-2xl font-bold hover:bg-gray-700 transition-all border border-gray-700 flex items-center gap-1.5">
                <Printer size={16} /> طباعة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}