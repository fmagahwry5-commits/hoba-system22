// components/GlobalSearch.tsx
import { useState, useMemo, useEffect, useRef } from "react";
import {
  Search, X, ShoppingCart, Package, Wrench, DollarSign,
  RotateCcw, ShoppingBag, Users, FileText, Gift, ArrowLeft,
} from "lucide-react";
import { Invoice, Product, InstallmentPayment, Bundle } from "../types";

// ✅ إصلاح 1: تعريف الأنواع محلياً لضمان التوافق مع types.ts
interface Customer {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  balance?: number;
}

interface Supplier {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  balance?: number;
}

interface ShiftArchiveLocal {
  id: string;
  closedAt: string;
  invoices?: Invoice[];
}

// ✅ إصلاح 2: نوع SearchResult كامل ومحكم
interface SearchResult {
  type:
    | "invoice"
    | "product"
    | "customer"
    | "supplier"
    | "installment"
    | "maintenance"
    | "bundle"
    | "archived_invoice";
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  tags: string[];
  icon: any;
  iconColor: string;
  bgColor: string;
  score: number;
  data: any;
  action: string;
}

interface Props {
  invoices: Invoice[];
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  installments: InstallmentPayment[];
  bundles: Bundle[];
  archives: ShiftArchiveLocal[];
  currency: string;
  onNavigateToInvoice: (invoice: Invoice) => void;
  onNavigateToProduct: (product: Product) => void;
  onNavigateToCustomer: (customer: Customer) => void;
  onNavigateToSupplier: (supplier: Supplier) => void;
  onNavigateTo: (page: string) => void;
}

// ✅ إصلاح 3: دالة calculateScore محكمة
function calculateScore(
  query: string,
  ...fields: (string | undefined | null)[]
): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  let maxScore = 0;
  for (const field of fields) {
    if (!field) continue;
    const f = field.toLowerCase();
    if (f === q) maxScore = Math.max(maxScore, 100);
    else if (f.startsWith(q)) maxScore = Math.max(maxScore, 80);
    else if (f.includes(q)) maxScore = Math.max(maxScore, 60);
  }
  return maxScore;
}

export default function GlobalSearch({
  invoices,
  products,
  customers,
  suppliers,
  installments,
  bundles,
  archives,
  currency,
  onNavigateToInvoice,
  onNavigateToProduct,
  onNavigateToCustomer,
  onNavigateToSupplier,
  onNavigateTo,
}: Props) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // ✅ البحث الشامل المحسّن مع تأمين جميع الخصائص
  const results = useMemo((): SearchResult[] => {
    if (!query.trim() || query.trim().length < 2) return [];
    const q = query.toLowerCase().trim();
    const allResults: SearchResult[] = [];

    // ── البحث في الفواتير الحالية ──────────────────────────
    invoices.forEach((inv) => {
      if (!inv) return;
      const score = calculateScore(
        q,
        inv.number,
        inv.customerName,
        inv.customerPhone,
        inv.supplierName,
        inv.supplierPhone,
        inv.notes,
        ...(inv.items?.map((i) => i.productName) ?? []),
        ...(inv.items?.map((i) => i.barcode ?? "") ?? []),
        inv.maintenanceInfo?.imei,
        inv.maintenanceInfo?.deviceBrand,
        inv.maintenanceInfo?.deviceModel,
        inv.maintenanceInfo?.technician
      );
      if (score === 0) return;

      const typeLabels: Record<
        string,
        { label: string; icon: any; color: string; bg: string }
      > = {
        sale: {
          label: "فاتورة بيع",
          icon: ShoppingCart,
          color: "text-blue-600",
          bg: "bg-blue-50",
        },
        purchase: {
          label: "فاتورة شراء",
          icon: Package,
          color: "text-green-600",
          bg: "bg-green-50",
        },
        return_sale: {
          label: "مرتجع بيع",
          icon: RotateCcw,
          color: "text-orange-600",
          bg: "bg-orange-50",
        },
        return_purchase: {
          label: "مرتجع شراء",
          icon: RotateCcw,
          color: "text-purple-600",
          bg: "bg-purple-50",
        },
        maintenance: {
          label: "فاتورة صيانة",
          icon: Wrench,
          color: "text-violet-600",
          bg: "bg-violet-50",
        },
        accessory_sale: {
          label: "بيع اكسسوار",
          icon: ShoppingBag,
          color: "text-amber-600",
          bg: "bg-amber-50",
        },
        accessory_purchase: {
          label: "شراء اكسسوار",
          icon: ShoppingBag,
          color: "text-teal-600",
          bg: "bg-teal-50",
        },
      };

      const t = typeLabels[inv.type] ?? typeLabels.sale;
      const contactName = inv.customerName || inv.supplierName || "";
      const tags: string[] = [t.label];
      if (inv.status === "pending") tags.push("معلقة");
      if ((inv.remaining ?? 0) > 0) tags.push("عليها متبقي");

      // ✅ تأمين inv.total بـ ?? 0
      const subtitleParts = [
        inv.customerPhone || inv.supplierPhone,
        inv.items?.slice(0, 2).map((i) => i.productName).join("، "),
        inv.maintenanceInfo
          ? `${inv.maintenanceInfo.deviceBrand ?? ""} ${inv.maintenanceInfo.deviceModel ?? ""}`.trim()
          : "",
      ].filter(Boolean);

      allResults.push({
        type: inv.type === "maintenance" ? "maintenance" : "invoice",
        id: inv.id,
        title: `${inv.number} — ${contactName || "بدون اسم"}`,
        subtitle: subtitleParts.join(" · "),
        meta: `${inv.date ?? ""} · ${(inv.total ?? 0).toLocaleString()} ${currency}`,
        tags,
        icon: t.icon,
        iconColor: t.color,
        bgColor: t.bg,
        score,
        data: inv,
        action: "فتح الفاتورة",
      });
    });

    // ── البحث في فواتير الورديات المؤرشفة ─────────────────
    archives.forEach((archive) => {
      if (!archive) return;
      (archive.invoices ?? []).forEach((inv) => {
        if (!inv) return;
        const score = calculateScore(
          q,
          inv.number,
          inv.customerName,
          inv.customerPhone,
          inv.supplierName,
          inv.supplierPhone,
          inv.notes,
          ...(inv.items?.map((i) => i.productName) ?? []),
          ...(inv.items?.map((i) => i.barcode ?? "") ?? []),
          inv.maintenanceInfo?.imei,
          inv.maintenanceInfo?.deviceBrand,
          inv.maintenanceInfo?.deviceModel
        );
        if (score === 0) return;

        const contactName = inv.customerName || inv.supplierName || "";
        allResults.push({
          type: "archived_invoice",
          id: `${archive.id}__${inv.id}`,
          title: `📁 ${inv.number} — ${contactName || "بدون اسم"}`,
          subtitle: `وردية #${archive.id.slice(-6)} · ${archive.closedAt ?? ""}`,
          meta: `${inv.date ?? ""} · ${(inv.total ?? 0).toLocaleString()} ${currency}`,
          tags: ["مؤرشفة", inv.type === "maintenance" ? "صيانة" : "فاتورة"],
          icon: FileText,
          iconColor: "text-pink-600",
          bgColor: "bg-pink-50",
          score: score - 5,
          data: { ...inv, archivedShiftId: archive.id },
          action: "فتح الفاتورة المؤرشفة",
        });
      });
    });

    // ── البحث في المنتجات ──────────────────────────────────
    products.forEach((p) => {
      if (!p) return;
      // ✅ تأمين p.description و p.category بـ ?? ""
      const score = calculateScore(
        q,
        p.name,
        p.barcode,
        p.category ?? "",
        (p as any).description ?? ""
      );
      if (score === 0) return;

      // ✅ تأمين p.isAccessory و p.minStock و p.stock
      const isAccessory = (p as any).isAccessory === true;
      const minStock = (p as any).minStock ?? 0;
      const tags: string[] = [isAccessory ? "اكسسوار" : "منتج"];
      if (p.category) tags.push(p.category);
      if ((p.stock ?? 0) <= minStock) tags.push("⚠️ مخزون منخفض");

      allResults.push({
        type: "product",
        id: p.id,
        title: `${p.name}${isAccessory ? " 🛍️" : ""}`,
        subtitle: `باركود: ${p.barcode || "-"} · فئة: ${p.category || "-"}`,
        meta: `مخزون: ${p.stock ?? 0} · شراء: ${(p.costPrice ?? 0).toLocaleString()} · بيع: ${(p.sellingPrice ?? 0).toLocaleString()} ${currency}`,
        tags,
        icon: Package,
        iconColor: "text-indigo-600",
        bgColor: "bg-indigo-50",
        score,
        data: p,
        action: "عرض المنتج",
      });
    });

    // ── البحث في العملاء ───────────────────────────────────
    customers.forEach((c) => {
      if (!c) return;
      const score = calculateScore(q, c.name, c.phone ?? "", c.address ?? "");
      if (score === 0) return;

      const customerInvoices = invoices.filter(
        (inv) =>
          inv.customerName?.toLowerCase() === c.name?.toLowerCase() ||
          (c.phone && inv.customerPhone === c.phone)
      );
      const tags = ["عميل"];
      if ((c.balance ?? 0) > 0)
        tags.push(`عليه ${(c.balance ?? 0).toLocaleString()} ${currency}`);

      allResults.push({
        type: "customer",
        id: c.id,
        title: `👤 ${c.name}`,
        subtitle: [c.phone, c.address].filter(Boolean).join(" · "),
        meta: `${customerInvoices.length} فاتورة · رصيد: ${(c.balance ?? 0).toLocaleString()} ${currency}`,
        tags,
        icon: Users,
        iconColor: "text-blue-600",
        bgColor: "bg-blue-50",
        score,
        data: c,
        action: "عرض بيانات العميل",
      });
    });

    // ── البحث في الموردين ──────────────────────────────────
    suppliers.forEach((s) => {
      if (!s) return;
      const score = calculateScore(q, s.name, s.phone ?? "", s.address ?? "");
      if (score === 0) return;

      const supplierInvoices = invoices.filter(
        (inv) =>
          inv.supplierName?.toLowerCase() === s.name?.toLowerCase() ||
          (s.phone && inv.supplierPhone === s.phone)
      );
      const tags = ["مورد"];
      if ((s.balance ?? 0) > 0)
        tags.push(`له ${(s.balance ?? 0).toLocaleString()} ${currency}`);

      allResults.push({
        type: "supplier",
        id: s.id,
        title: `🏭 ${s.name}`,
        subtitle: [s.phone, s.address].filter(Boolean).join(" · "),
        meta: `${supplierInvoices.length} فاتورة · رصيد: ${(s.balance ?? 0).toLocaleString()} ${currency}`,
        tags,
        icon: Users,
        iconColor: "text-green-600",
        bgColor: "bg-green-50",
        score,
        data: s,
        action: "عرض بيانات المورد",
      });
    });

    // ── البحث في الأقساط ───────────────────────────────────
    installments.forEach((p) => {
      if (!p) return;
      const score = calculateScore(
        q,
        p.customerName,
        p.customerPhone ?? "",
        p.invoiceRef ?? ""
      );
      if (score === 0) return;

      allResults.push({
        type: "installment",
        id: p.id,
        title: `💰 قسط — ${p.customerName}`,
        subtitle: [
          p.customerPhone,
          p.invoiceRef ? `فاتورة: ${p.invoiceRef}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
        meta: `${p.date ?? ""} · ${(p.amount ?? 0).toLocaleString()} ${currency}`,
        tags: ["قسط"],
        icon: DollarSign,
        iconColor: "text-indigo-600",
        bgColor: "bg-indigo-50",
        score,
        data: p,
        action: "عرض القسط",
      });
    });

    // ── البحث في الباكدج ───────────────────────────────────
    bundles.forEach((b) => {
      if (!b) return;
      // ✅ تأمين b.description و b.barcode
      const score = calculateScore(
        q,
        b.name,
        (b as any).description ?? "",
        (b as any).barcode ?? "",
        ...(b.items?.map((i) => i.productName) ?? [])
      );
      if (score === 0) return;

      allResults.push({
        type: "bundle",
        id: b.id,
        title: `🎁 ${b.name}`,
        subtitle: (b as any).description || `${b.items?.length ?? 0} منتج`,
        meta: `${(b.bundlePrice ?? 0).toLocaleString()} ${currency} · خصم ${(b.discountPercent ?? 0).toFixed(0)}%`,
        tags: [b.isActive ? "نشط" : "غير نشط", "باكدج"],
        icon: Gift,
        iconColor: "text-amber-600",
        bgColor: "bg-amber-50",
        score,
        data: b,
        action: "عرض العرض",
      });
    });

    // ترتيب حسب الأولوية
    allResults.sort((a, b) => b.score - a.score);
    return allResults.slice(0, 30);
  }, [
    query,
    invoices,
    products,
    customers,
    suppliers,
    installments,
    bundles,
    archives,
    currency,
  ]);

  // ── تصنيف النتائج ──────────────────────────────────────
  const categories = useMemo(() => {
    const cats: Record<string, { count: number; label: string }> = {};
    results.forEach((r) => {
      if (!cats[r.type]) {
        const labels: Record<string, string> = {
          invoice: "فواتير",
          archived_invoice: "فواتير مؤرشفة",
          product: "منتجات",
          customer: "عملاء",
          supplier: "موردين",
          installment: "أقساط",
          maintenance: "صيانة",
          bundle: "باكدج",
        };
        cats[r.type] = { count: 0, label: labels[r.type] ?? r.type };
      }
      cats[r.type].count++;
    });
    return cats;
  }, [results]);

  const filteredResults =
    selectedCategory === "all"
      ? results
      : results.filter((r) => r.type === selectedCategory);

  // ── handleSelect ───────────────────────────────────────
  const handleSelect = (result: SearchResult) => {
    switch (result.type) {
      case "invoice":
      case "maintenance":
      case "archived_invoice":
        onNavigateToInvoice(result.data);
        break;
      case "product":
        onNavigateToProduct(result.data);
        break;
      case "customer":
        onNavigateToCustomer(result.data);
        break;
      case "supplier":
        onNavigateToSupplier(result.data);
        break;
      case "installment":
        onNavigateTo("installments");
        break;
      case "bundle":
        onNavigateTo("bundles");
        break;
      default:
        break;
    }
    setQuery("");
    setFocused(false);
  };

  // ✅ إصلاح 4: إضافة {} للـ case الذي يحتوي على const
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, filteredResults.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filteredResults[selectedIdx]) handleSelect(filteredResults[selectedIdx]);
        break;
      case "Escape":
        setQuery("");
        setFocused(false);
        inputRef.current?.blur();
        break;
      case "Tab": {
        // ✅ block scope للـ const
        e.preventDefault();
        const catKeys = ["all", ...Object.keys(categories)];
        const currentIdx = catKeys.indexOf(selectedCategory);
        const nextIdx = (currentIdx + 1) % catKeys.length;
        setSelectedCategory(catKeys[nextIdx]);
        setSelectedIdx(0);
        break;
      }
      default:
        break;
    }
  };

  // ── Effects ────────────────────────────────────────────
  useEffect(() => {
    setSelectedIdx(0);
  }, [filteredResults.length, selectedCategory]);

  useEffect(() => {
    if (!resultsRef.current) return;
    const selected = resultsRef.current.querySelector(
      `[data-idx="${selectedIdx}"]`
    );
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIdx]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setFocused(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── JSX ────────────────────────────────────────────────
  return (
    <div className="relative">
      {/* حقل البحث */}
      <div
        className={`flex items-center gap-2 border rounded-xl px-3 py-2 transition-all duration-200 ${
          focused
            ? "border-blue-400 bg-white shadow-xl w-80 lg:w-[500px] ring-4 ring-blue-100"
            : "border-gray-200 bg-gray-50 w-44 lg:w-72"
        }`}
      >
        <Search
          size={16}
          className={focused ? "text-blue-500" : "text-gray-400"}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 250)}
          onKeyDown={handleKeyDown}
          placeholder={
            focused
              ? "ابحث عن فاتورة، عميل، منتج، مورد..."
              : "بحث شامل (Ctrl+K)"
          }
          className="flex-1 text-sm bg-transparent outline-none text-gray-700 placeholder-gray-400 min-w-0"
          data-global-search
        />
        {!focused && (
          <kbd className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded font-mono hidden sm:inline">
            Ctrl+K
          </kbd>
        )}
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setSelectedCategory("all");
            }}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* نتائج البحث */}
      {focused && query.trim().length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[200] overflow-hidden max-h-[75vh] flex flex-col min-w-[400px]">
          {results.length === 0 ? (
            <div className="p-8 text-center">
              <Search size={40} className="mx-auto text-gray-200 mb-3" />
              <div className="text-sm font-semibold text-gray-400">
                لا توجد نتائج لـ "{query}"
              </div>
              <div className="text-xs text-gray-300 mt-2 space-y-1">
                <p>💡 جرب البحث بـ:</p>
                <p>رقم فاتورة، اسم عميل، رقم هاتف، باركود، IMEI</p>
              </div>
            </div>
          ) : (
            <>
              {/* شريط التصنيفات */}
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-1.5 overflow-x-auto flex-shrink-0">
                <button
                  onClick={() => {
                    setSelectedCategory("all");
                    setSelectedIdx(0);
                  }}
                  className={`text-xs px-3 py-1.5 rounded-full font-bold flex-shrink-0 transition-all ${
                    selectedCategory === "all"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  الكل ({results.length})
                </button>
                {Object.entries(categories).map(([key, cat]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setSelectedCategory(key);
                      setSelectedIdx(0);
                    }}
                    className={`text-xs px-3 py-1.5 rounded-full font-bold flex-shrink-0 transition-all ${
                      selectedCategory === key
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {cat.label} ({cat.count})
                  </button>
                ))}
              </div>

              {/* قائمة النتائج */}
              <div
                ref={resultsRef}
                className="flex-1 overflow-y-auto divide-y divide-gray-50"
              >
                {filteredResults.map((result, idx) => (
                  <button
                    key={result.id}
                    type="button"
                    data-idx={idx}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(result);
                    }}
                    onMouseEnter={() => setSelectedIdx(idx)}
                    className={`w-full text-right px-4 py-3 transition-all flex items-start gap-3 ${
                      idx === selectedIdx
                        ? "bg-blue-50 border-r-2 border-blue-500"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    {/* أيقونة */}
                    <div
                      className={`w-9 h-9 rounded-xl ${result.bgColor} flex items-center justify-center flex-shrink-0 mt-0.5`}
                    >
                      <result.icon size={16} className={result.iconColor} />
                    </div>

                    {/* محتوى */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="font-bold text-gray-800 text-sm">
                          {result.title}
                        </span>
                        {result.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-semibold"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                      {result.subtitle && (
                        <div className="text-xs text-gray-500 truncate">
                          {result.subtitle}
                        </div>
                      )}
                      <div className="text-xs text-gray-400 truncate mt-0.5">
                        {result.meta}
                      </div>
                    </div>

                    {/* إجراء */}
                    <div className="flex items-center gap-1.5 text-xs text-gray-300 self-center flex-shrink-0">
                      <span className="hidden sm:inline">{result.action}</span>
                      <ArrowLeft size={12} />
                    </div>
                  </button>
                ))}
              </div>

              {/* تعليمات */}
              <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400 flex-shrink-0">
                <div className="flex gap-4">
                  <span>↑↓ تنقل</span>
                  <span>Enter اختيار</span>
                  <span>Tab تصنيف</span>
                  <span>Esc إغلاق</span>
                </div>
                <span>{filteredResults.length} نتيجة</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}