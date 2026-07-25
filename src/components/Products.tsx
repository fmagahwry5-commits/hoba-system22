// src/components/Products.tsx
import { useState, useMemo, useRef, useCallback } from "react";
import { Product, Invoice } from "../types";
import {
  Plus, Search, Edit2, Trash2, X, Save, Package,
  ArrowUpDown, Filter, ChevronDown, ChevronUp,
  Upload, Download, AlertTriangle, CheckCircle2, AlertCircle,
  Check, Copy, Printer, RefreshCw, Tag, FileSpreadsheet,
} from "lucide-react";
import { generateId } from "../store";
import ExcelImporter from "./ExcelImporter";

interface Props {
  products: Product[];
  currency: string;
  onUpdate: (products: Product[]) => void;
  invoices?: Invoice[];
}

const CATEGORIES = ["هواتف", "اكسسوارات", "قطع غيار", "أجهزة لوحية", "لابتوب", "أخرى"];

const DEFAULT_PRODUCT: Omit<Product, "id"> = {
  name: "",
  barcode: "",
  category: "",
  costPrice: 0,
  sellingPrice: 0,
  stock: 0,
  minStock: 0,
  unit: "قطعة",
};

interface ProductPrintSettings {
  labelWidth: number;
  labelHeight: number;
  barcodeWidth: number;
  barcodeHeight: number;
  paddingTop: number;
  paddingBottom: number;
  paddingLeft: number;
  paddingRight: number;
  pageOffsetX: number;
  pageOffsetY: number;
  printScale: number;
}

export default function Products({ products, currency, onUpdate, invoices = [] }: Props) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Product>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<Omit<Product, "id">>(DEFAULT_PRODUCT);
  const [sortBy, setSortBy] = useState<"name" | "stock" | "price" | "category">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showLowStock, setShowLowStock] = useState(false);

  // ✅ تحديد متعدد
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkEditField, setBulkEditField] = useState<string>("");
  const [bulkEditValue, setBulkEditValue] = useState<string>("");

  // ✅ نسخ إعدادات الطباعة
  const [showCopyPrintSettings, setShowCopyPrintSettings] = useState(false);
  const [copyFromProductId, setCopyFromProductId] = useState<string>("");
  const [copyToProductIds, setCopyToProductIds] = useState<Set<string>>(new Set());
  const [printSettingsMap, setPrintSettingsMap] = useState<Record<string, ProductPrintSettings>>(() => {
    try {
      const s = localStorage.getItem("productPrintSettings");
      return s ? JSON.parse(s) : {};
    } catch { return {}; }
  });

  // ✅ استيراد Excel
  const [showExcelImporter, setShowExcelImporter] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    (products ?? []).forEach(p => { if (p?.category) cats.add(p.category); });
    CATEGORIES.forEach(c => cats.add(c));
    return Array.from(cats).sort();
  }, [products]);

  const filtered = useMemo(() => {
    let list = (products ?? []).filter(p => {
      if (!p) return false;
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
      if (showLowStock && (p.stock ?? 0) > (p.minStock ?? 0)) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        p.name?.toLowerCase().includes(q) ||
        p.barcode?.includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.id?.includes(q)
      );
    });

    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "name": cmp = (a.name ?? "").localeCompare(b.name ?? "", "ar"); break;
        case "stock": cmp = (a.stock ?? 0) - (b.stock ?? 0); break;
        case "price": cmp = (a.sellingPrice ?? 0) - (b.sellingPrice ?? 0); break;
        case "category": cmp = (a.category ?? "").localeCompare(b.category ?? "", "ar"); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [products, search, categoryFilter, showLowStock, sortBy, sortDir]);

  const stats = useMemo(() => {
    const total = (products ?? []).length;
    const lowStock = (products ?? []).filter(p =>
      (p.stock ?? 0) <= (p.minStock ?? 0) && (p.minStock ?? 0) > 0
    ).length;
    const outOfStock = (products ?? []).filter(p => (p.stock ?? 0) === 0).length;
    const totalValue = (products ?? []).reduce(
      (s, p) => s + (p.costPrice ?? 0) * (p.stock ?? 0), 0
    );
    const totalReserved = (products ?? []).reduce(
      (s, p) => s + Math.max(0, (p as any).reserved ?? 0), 0
    );
    const totalAvailable = (products ?? []).reduce(
      (s, p) => s + Math.max(0, (p.stock ?? 0) - Math.max(0, (p as any).reserved ?? 0)), 0
    );
    return { total, lowStock, outOfStock, totalValue, totalReserved, totalAvailable };
  }, [products]);

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(field); setSortDir("asc"); }
  };

  const handleDelete = useCallback((id: string) => {
    const product = (products ?? []).find(p => p.id === id);
    if (!product) return;
    if (!window.confirm(`هل أنت متأكد من حذف "${product.name}"؟`)) return;
    onUpdate((products ?? []).filter(p => p.id !== id));
  }, [products, onUpdate]);

  const handleEdit = (product: Product) => {
    setEditingId(product.id);
    setEditForm({ ...product });
  };

  const handleSaveEdit = () => {
    if (!editForm.name?.trim()) return;
    onUpdate(
      (products ?? []).map(p =>
        p.id === editingId ? { ...p, ...editForm } as Product : p
      )
    );
    setEditingId(null);
    setEditForm({});
  };

  const handleAdd = () => {
    if (!addForm.name?.trim()) return;
    const newProduct: Product = { id: generateId(), ...addForm };
    onUpdate([...(products ?? []), newProduct]);
    setAddForm(DEFAULT_PRODUCT);
    setShowAddModal(false);
  };

  // ✅ تحديد متعدد
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(p => p.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  // ✅ تعديل جماعي
  const handleBulkEdit = () => {
    if (!bulkEditField || selectedIds.size === 0) return;
    const val = Number(bulkEditValue);
    onUpdate((products ?? []).map(p => {
      if (!selectedIds.has(p.id)) return p;
      switch (bulkEditField) {
        case "stock": return { ...p, stock: Math.max(0, val) };
        case "sellingPrice": return { ...p, sellingPrice: Math.max(0, val) };
        case "costPrice": return { ...p, costPrice: Math.max(0, val) };
        case "minStock": return { ...p, minStock: Math.max(0, val) };
        case "category": return { ...p, category: bulkEditValue };
        default: return p;
      }
    }));
    setBulkEditField("");
    setBulkEditValue("");
    setShowBulkActions(false);
  };

  // ✅ حذف جماعي
  const handleBulkDelete = () => {
    if (!confirm(`هل أنت متأكد من حذف ${selectedIds.size} منتج؟`)) return;
    onUpdate((products ?? []).filter(p => !selectedIds.has(p.id)));
    setSelectedIds(new Set());
  };

  // ✅ نسخ إعدادات الطباعة
  const savePrintSettings = (id: string, s: ProductPrintSettings) => {
    const newMap = { ...printSettingsMap, [id]: s };
    setPrintSettingsMap(newMap);
    try { localStorage.setItem("productPrintSettings", JSON.stringify(newMap)); } catch {}
  };

  const handleCopyPrintSettings = () => {
    if (!copyFromProductId || copyToProductIds.size === 0) return;
    const source = printSettingsMap[copyFromProductId];
    if (!source) {
      alert("المنتج المصدر ليس لديه إعدادات طباعة مخصصة");
      return;
    }
    const newMap = { ...printSettingsMap };
    copyToProductIds.forEach(id => { newMap[id] = { ...source }; });
    setPrintSettingsMap(newMap);
    try { localStorage.setItem("productPrintSettings", JSON.stringify(newMap)); } catch {}
    setShowCopyPrintSettings(false);
    setCopyFromProductId("");
    setCopyToProductIds(new Set());
    alert(`تم نسخ إعدادات الطباعة لـ ${copyToProductIds.size} منتج`);
  };

  // ✅ استيراد Excel - الدالة الرئيسية
  const handleExcelImport = useCallback((importedProducts: Product[]) => {
    onUpdate(importedProducts);
    setShowExcelImporter(false);
  }, [onUpdate]);

  // تصدير CSV
  const handleExport = () => {
    const headers = [
      "الاسم", "الباركود", "الفئة", "سعر التكلفة",
      "سعر البيع", "المخزون", "الحد الأدنى", "الوحدة",
    ];
    const rows = (products ?? []).map(p => [
      p.name, p.barcode ?? "", p.category ?? "",
      p.costPrice ?? 0, p.sellingPrice ?? 0,
      p.stock ?? 0, p.minStock ?? 0, p.unit ?? "قطعة",
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "products.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // استيراد CSV القديم (للتوافق)
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const text = ev.target?.result as string;
        const lines = text.split("\n").slice(1).filter(Boolean);
        const imported: Product[] = lines.map(line => {
          const cols = line.split(",").map(c => c.replace(/^"|"$/g, "").trim());
          return {
            id: generateId(),
            name: cols[0] || "",
            barcode: cols[1] || "",
            category: cols[2] || "",
            costPrice: Number(cols[3]) || 0,
            sellingPrice: Number(cols[4]) || 0,
            stock: Number(cols[5]) || 0,
            minStock: Number(cols[6]) || 0,
            unit: cols[7] || "قطعة",
          };
        }).filter(p => p.name);
        onUpdate([...(products ?? []), ...imported]);
        alert(`تم استيراد ${imported.length} منتج`);
      } catch { alert("خطأ في قراءة الملف"); }
    };
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  };

  const SortIcon = ({ field }: { field: typeof sortBy }) => (
    sortBy === field
      ? sortDir === "asc"
        ? <ChevronUp size={13} className="text-blue-500" />
        : <ChevronDown size={13} className="text-blue-500" />
      : <ArrowUpDown size={12} className="text-gray-300" />
  );

  return (
    <div className="space-y-5" dir="rtl">

      {/* ══════════════════ Header ══════════════════ */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <Package size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black">إدارة المنتجات</h2>
              <p className="text-indigo-200 text-sm">{stats.total} منتج</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* ✅ زر استيراد Excel الجديد */}
            <button
              onClick={() => setShowExcelImporter(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 rounded-xl text-xs font-black transition-all active:scale-95 shadow-md shadow-emerald-900/30"
            >
              <FileSpreadsheet size={14} />
              استيراد Excel
            </button>

            <button
              onClick={() => setShowCopyPrintSettings(true)}
              className="flex items-center gap-2 px-3 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-bold transition-colors"
            >
              <Printer size={13} /> نسخ إعدادات الطباعة
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-bold transition-colors"
            >
              <Upload size={13} /> استيراد CSV
            </button>

            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-bold transition-colors"
            >
              <Download size={13} /> تصدير CSV
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-700 rounded-xl font-black hover:bg-indigo-50 active:scale-95 shadow-md transition-all"
            >
              <Plus size={16} /> إضافة منتج
            </button>
          </div>
        </div>

        {/* إحصائيات */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "إجمالي المنتجات", value: stats.total, unit: "منتج" },
            { label: "مخزون منخفض", value: stats.lowStock, unit: "منتج" },
            { label: "نفد المخزون", value: stats.outOfStock, unit: "منتج" },
            { label: "محجوز للمعلقات", value: stats.totalReserved, unit: "قطعة" },
            { label: "المتاح الفعلي", value: stats.totalAvailable, unit: "قطعة" },
            { label: "قيمة المخزون", value: stats.totalValue.toLocaleString(), unit: currency },
          ].map(s => (
            <div key={s.label} className="bg-white/15 rounded-xl p-3 text-center">
              <div className="text-xs opacity-75 mb-0.5">{s.label}</div>
              <div className="text-lg font-black">{s.value}</div>
              <div className="text-xs opacity-60">{s.unit}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════ شريط التحديد المتعدد ══════════════════ */}
      {selectedIds.size > 0 && (
        <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-sm">
              {selectedIds.size}
            </div>
            <span className="font-bold text-indigo-700">منتج محدد</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowBulkActions(!showBulkActions)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 active:scale-95"
            >
              <Edit2 size={14} /> تعديل جماعي
            </button>
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 active:scale-95"
            >
              <Trash2 size={14} /> حذف المحدد
            </button>
            <button
              onClick={clearSelection}
              className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-200"
            >
              <X size={14} className="inline ml-1" />مسح
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════ التعديل الجماعي ══════════════════ */}
      {showBulkActions && selectedIds.size > 0 && (
        <div className="bg-white border-2 border-blue-200 rounded-2xl p-4 space-y-3">
          <h4 className="font-black text-gray-700 flex items-center gap-2">
            <Edit2 size={16} className="text-blue-600" />
            تعديل جماعي لـ {selectedIds.size} منتج
          </h4>
          <div className="flex gap-3 flex-wrap">
            <select
              value={bulkEditField}
              onChange={e => setBulkEditField(e.target.value)}
              className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400 bg-white flex-1 min-w-36"
            >
              <option value="">اختر الحقل للتعديل</option>
              <option value="stock">المخزون</option>
              <option value="sellingPrice">سعر البيع</option>
              <option value="costPrice">سعر التكلفة</option>
              <option value="minStock">الحد الأدنى</option>
              <option value="category">الفئة</option>
            </select>

            {bulkEditField === "category" ? (
              <select
                value={bulkEditValue}
                onChange={e => setBulkEditValue(e.target.value)}
                className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400 bg-white flex-1 min-w-36"
              >
                <option value="">اختر الفئة</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            ) : (
              <input
                type="number"
                value={bulkEditValue}
                onChange={e => setBulkEditValue(e.target.value)}
                className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400 flex-1 min-w-24"
                placeholder="القيمة الجديدة"
              />
            )}

            <button
              onClick={handleBulkEdit}
              disabled={!bulkEditField}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-50 active:scale-95"
            >
              <Save size={14} className="inline ml-1" />تطبيق
            </button>
            <button
              onClick={() => { setShowBulkActions(false); setBulkEditField(""); setBulkEditValue(""); }}
              className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════ فلاتر ══════════════════ */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full border border-gray-200 rounded-xl pr-9 pl-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="ابحث باسم المنتج أو الباركود..."
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

          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
          >
            <option value="all">جميع الفئات</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <button
            onClick={() => setShowLowStock(!showLowStock)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors ${
              showLowStock ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <AlertCircle size={13} /> مخزون منخفض
          </button>

          <button
            onClick={selectAll}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors ${
              selectedIds.size === filtered.length && filtered.length > 0
                ? "bg-indigo-100 text-indigo-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <Check size={13} />
            {selectedIds.size === filtered.length && filtered.length > 0 ? "إلغاء الكل" : "تحديد الكل"}
          </button>
        </div>
      </div>

      {/* ══════════════════ الجدول ══════════════════ */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-indigo-50 border-b border-indigo-100">
              <tr>
                <th className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onChange={selectAll}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600"
                  />
                </th>
                <th className="px-3 py-3 text-right text-xs font-bold text-indigo-700">
                  <button onClick={() => handleSort("name")} className="flex items-center gap-1">
                    الاسم <SortIcon field="name" />
                  </button>
                </th>
                <th className="px-3 py-3 text-right text-xs font-bold text-indigo-700">الباركود</th>
                <th className="px-3 py-3 text-right text-xs font-bold text-indigo-700">
                  <button onClick={() => handleSort("category")} className="flex items-center gap-1">
                    الفئة <SortIcon field="category" />
                  </button>
                </th>
                <th className="px-3 py-3 text-center text-xs font-bold text-indigo-700">
                  <button onClick={() => handleSort("price")} className="flex items-center gap-1 mx-auto">
                    سعر البيع <SortIcon field="price" />
                  </button>
                </th>
                <th className="px-3 py-3 text-center text-xs font-bold text-indigo-700">سعر التكلفة</th>
                <th className="px-3 py-3 text-center text-xs font-bold text-indigo-700">
                  <button onClick={() => handleSort("stock")} className="flex items-center gap-1 mx-auto">
                    المخزون <SortIcon field="stock" />
                  </button>
                </th>
                <th className="px-3 py-3 text-center text-xs font-bold text-indigo-700">محجوز</th>
                <th className="px-3 py-3 text-center text-xs font-bold text-indigo-700">المتاح</th>
                <th className="px-3 py-3 text-center text-xs font-bold text-indigo-700">الحد الأدنى</th>
                <th className="px-3 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-16 text-gray-400">
                    <Package size={40} className="mx-auto mb-3 opacity-20" />
                    <div className="font-bold">لا توجد منتجات</div>
                    <button
                      onClick={() => setShowExcelImporter(true)}
                      className="mt-4 flex items-center gap-2 mx-auto px-4 py-2 bg-emerald-100 text-emerald-700 rounded-xl text-sm font-bold hover:bg-emerald-200 transition-colors"
                    >
                      <FileSpreadsheet size={14} />
                      استيراد من Excel
                    </button>
                  </td>
                </tr>
              ) : filtered.map((product, idx) => {
                const isLow = (product.stock ?? 0) <= (product.minStock ?? 0) && (product.minStock ?? 0) > 0;
                const isOut = (product.stock ?? 0) === 0;
                const isEditing = editingId === product.id;
                const isSelected = selectedIds.has(product.id);
                const hasPrintSettings = !!printSettingsMap[product.id];
                const reserved = Math.max(0, (product as any).reserved ?? 0);
                const available = Math.max(0, (product.stock ?? 0) - reserved);
                const isAvailLow = available <= (product.minStock ?? 0) && (product.minStock ?? 0) > 0;
                const isAvailOut = available === 0;

                return (
                  <tr
                    key={product.id}
                    className={`border-t border-gray-50 transition-colors ${
                      isEditing ? "bg-blue-50"
                      : isSelected ? "bg-indigo-50"
                      : idx % 2 === 0 ? "" : "bg-gray-50/30"
                    } hover:bg-gray-50`}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(product.id)}
                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 cursor-pointer"
                      />
                    </td>

                    {/* الاسم */}
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.name ?? ""}
                          onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                          className="w-full border-2 border-blue-300 rounded-lg px-2 py-1 text-sm outline-none focus:border-blue-500"
                          autoFocus
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-bold text-gray-800 text-sm">{product.name}</div>
                            {product.unit && <div className="text-[10px] text-gray-400">{product.unit}</div>}
                          </div>
                          {hasPrintSettings && (
                            <Printer size={10} className="text-indigo-400" title="إعدادات طباعة مخصصة" />
                          )}
                        </div>
                      )}
                    </td>

                    {/* الباركود */}
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.barcode ?? ""}
                          onChange={e => setEditForm(f => ({ ...f, barcode: e.target.value }))}
                          className="w-full border-2 border-blue-300 rounded-lg px-2 py-1 text-xs font-mono outline-none"
                        />
                      ) : (
                        <span className="font-mono text-xs text-gray-500">{product.barcode || "-"}</span>
                      )}
                    </td>

                    {/* الفئة */}
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <select
                          value={editForm.category ?? ""}
                          onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                          className="w-full border-2 border-blue-300 rounded-lg px-2 py-1 text-xs outline-none bg-white"
                        >
                          <option value="">بدون فئة</option>
                          {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      ) : (
                        <span className="text-xs text-gray-600">{product.category || "-"}</span>
                      )}
                    </td>

                    {/* سعر البيع */}
                    <td className="px-3 py-2 text-center">
                      {isEditing ? (
                        <input
                          type="number" min="0"
                          value={editForm.sellingPrice ?? 0}
                          onChange={e => setEditForm(f => ({ ...f, sellingPrice: Number(e.target.value) }))}
                          className="w-24 text-center border-2 border-blue-300 rounded-lg px-2 py-1 text-sm outline-none font-bold"
                        />
                      ) : (
                        <span className="font-bold text-indigo-700">
                          {(product.sellingPrice ?? 0).toLocaleString()}
                        </span>
                      )}
                    </td>

                    {/* سعر التكلفة */}
                    <td className="px-3 py-2 text-center">
                      {isEditing ? (
                        <input
                          type="number" min="0"
                          value={editForm.costPrice ?? 0}
                          onChange={e => setEditForm(f => ({ ...f, costPrice: Number(e.target.value) }))}
                          className="w-24 text-center border-2 border-blue-300 rounded-lg px-2 py-1 text-sm outline-none"
                        />
                      ) : (
                        <span className="text-gray-500 text-xs">
                          {(product.costPrice ?? 0).toLocaleString()}
                        </span>
                      )}
                    </td>

                    {/* المخزون */}
                    <td className="px-3 py-2 text-center">
                      {isEditing ? (
                        <input
                          type="number" min="0"
                          value={editForm.stock ?? 0}
                          onChange={e => setEditForm(f => ({ ...f, stock: Number(e.target.value) }))}
                          className="w-20 text-center border-2 border-blue-300 rounded-lg px-2 py-1 text-sm outline-none font-bold"
                        />
                      ) : (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                          isOut ? "bg-red-100 text-red-700"
                          : isLow ? "bg-amber-100 text-amber-700"
                          : "bg-emerald-100 text-emerald-700"
                        }`}>
                          {isOut ? <AlertCircle size={10} />
                            : isLow ? <AlertTriangle size={10} />
                            : <CheckCircle2 size={10} />}
                          {product.stock ?? 0}
                        </span>
                      )}
                    </td>

                    {/* محجوز */}
                    <td className="px-3 py-2 text-center">
                      {reserved > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                          🔒 {reserved}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>

                    {/* المتاح */}
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                        isAvailOut ? "bg-red-100 text-red-700"
                        : isAvailLow ? "bg-orange-100 text-orange-700"
                        : "bg-blue-100 text-blue-700"
                      }`}>
                        {available}
                      </span>
                    </td>

                    {/* الحد الأدنى */}
                    <td className="px-3 py-2 text-center">
                      {isEditing ? (
                        <input
                          type="number" min="0"
                          value={editForm.minStock ?? 0}
                          onChange={e => setEditForm(f => ({ ...f, minStock: Number(e.target.value) }))}
                          className="w-20 text-center border-2 border-blue-300 rounded-lg px-2 py-1 text-sm outline-none"
                        />
                      ) : (
                        <span className="text-gray-400 text-xs">{product.minStock ?? 0}</span>
                      )}
                    </td>

                    {/* أزرار الإجراءات */}
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        {isEditing ? (
                          <>
                            <button
                              onClick={handleSaveEdit}
                              className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200"
                            >
                              <Save size={13} />
                            </button>
                            <button
                              onClick={() => { setEditingId(null); setEditForm({}); }}
                              className="p-1.5 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200"
                            >
                              <X size={13} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleEdit(product)}
                              className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                              title="تعديل"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleDelete(product.id)}
                              className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100"
                              title="حذف"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {filtered.length > 0 && (
              <tfoot>
                <tr className="bg-indigo-50 border-t-2 border-indigo-100 font-bold text-sm">
                  <td colSpan={4} className="px-3 py-2.5 text-indigo-700">
                    المجموع ({filtered.length} منتج)
                  </td>
                  <td className="px-3 py-2.5 text-center text-indigo-700">-</td>
                  <td className="px-3 py-2.5 text-center text-gray-600">
                    {filtered.reduce((s, p) => s + (p.costPrice ?? 0), 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-center text-indigo-700">
                    {filtered.reduce((s, p) => s + (p.stock ?? 0), 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-center text-amber-700">
                    {filtered.reduce((s, p) => s + Math.max(0, (p as any).reserved ?? 0), 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-center text-blue-700">
                    {filtered.reduce(
                      (s, p) => s + Math.max(0, (p.stock ?? 0) - Math.max(0, (p as any).reserved ?? 0)),
                      0
                    ).toLocaleString()}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ══════════════════ نافذة نسخ إعدادات الطباعة ══════════════════ */}
      {showCopyPrintSettings && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-5 py-4 text-white flex items-center justify-between">
              <h3 className="font-black flex items-center gap-2 text-base">
                <Printer size={18} /> نسخ إعدادات الطباعة
              </h3>
              <button
                onClick={() => { setShowCopyPrintSettings(false); setCopyFromProductId(""); setCopyToProductIds(new Set()); }}
                className="text-white/70 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
                💡 اختر المنتج المصدر (الذي تريد نسخ إعداداته) ثم المنتجات الهدف
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 mb-1.5 block">المنتج المصدر (نسخ منه)</label>
                <select
                  value={copyFromProductId}
                  onChange={e => setCopyFromProductId(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 bg-white"
                >
                  <option value="">اختر المنتج المصدر</option>
                  {(products ?? []).filter(p => printSettingsMap[p.id]).map(p => (
                    <option key={p.id} value={p.id}>{p.name} ✓</option>
                  ))}
                  {(products ?? []).filter(p => !printSettingsMap[p.id]).map(p => (
                    <option key={p.id} value={p.id}>{p.name} (افتراضي)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 mb-1.5 block">
                  المنتجات الهدف (نسخ إليها) - {copyToProductIds.size} محدد
                </label>
                <div className="border-2 border-gray-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                  <div className="p-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (copyToProductIds.size === products.length)
                          setCopyToProductIds(new Set());
                        else
                          setCopyToProductIds(new Set(products.map(p => p.id)));
                      }}
                      className="text-xs text-indigo-600 font-bold hover:underline"
                    >
                      {copyToProductIds.size === products.length ? "إلغاء الكل" : "تحديد الكل"}
                    </button>
                  </div>
                  {(products ?? []).map(p => (
                    <label
                      key={p.id}
                      className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-50 border-b border-gray-50 last:border-0 ${
                        p.id === copyFromProductId ? "opacity-50" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={copyToProductIds.has(p.id)}
                        disabled={p.id === copyFromProductId}
                        onChange={() => {
                          if (p.id === copyFromProductId) return;
                          setCopyToProductIds(prev => {
                            const next = new Set(prev);
                            if (next.has(p.id)) next.delete(p.id);
                            else next.add(p.id);
                            return next;
                          });
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-indigo-600"
                      />
                      <span className="text-sm text-gray-700">{p.name}</span>
                      {printSettingsMap[p.id] && (
                        <Printer size={10} className="text-indigo-400 mr-auto" />
                      )}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button
                onClick={handleCopyPrintSettings}
                disabled={!copyFromProductId || copyToProductIds.size === 0}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black hover:bg-indigo-700 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Copy size={15} /> نسخ الإعدادات
              </button>
              <button
                onClick={() => { setShowCopyPrintSettings(false); setCopyFromProductId(""); setCopyToProductIds(new Set()); }}
                className="px-5 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ نافذة إضافة منتج ══════════════════ */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-5 py-4 text-white flex items-center justify-between">
              <h3 className="font-black flex items-center gap-2 text-base">
                <Plus size={18} /> إضافة منتج جديد
              </h3>
              <button
                onClick={() => { setShowAddModal(false); setAddForm(DEFAULT_PRODUCT); }}
                className="text-white/70 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
              {[
                { key: "name", label: "اسم المنتج *", type: "text" },
                { key: "barcode", label: "الباركود", type: "text" },
                { key: "sellingPrice", label: "سعر البيع *", type: "number" },
                { key: "costPrice", label: "سعر التكلفة", type: "number" },
                { key: "stock", label: "المخزون الحالي", type: "number" },
                { key: "minStock", label: "الحد الأدنى للتنبيه", type: "number" },
              ].map(({ key, label, type }) => (
                <div key={key}>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">{label}</label>
                  <input
                    type={type}
                    value={(addForm as any)[key] ?? ""}
                    onChange={e => setAddForm(f => ({
                      ...f,
                      [key]: type === "number" ? Number(e.target.value) : e.target.value,
                    }))}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400"
                    placeholder={label}
                  />
                </div>
              ))}

              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">الفئة</label>
                <select
                  value={addForm.category ?? ""}
                  onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400 bg-white"
                >
                  <option value="">بدون فئة</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">الوحدة</label>
                <select
                  value={addForm.unit ?? "قطعة"}
                  onChange={e => setAddForm(f => ({ ...f, unit: e.target.value }))}
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400 bg-white"
                >
                  {["قطعة", "جهاز", "علبة", "كرتونة", "متر", "كيلو", "لتر"].map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 px-5 pb-5">
              <button
                onClick={handleAdd}
                disabled={!addForm.name?.trim()}
                className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-black hover:bg-emerald-700 active:scale-95 disabled:opacity-50 shadow-md shadow-emerald-200"
              >
                <Plus size={15} className="inline ml-1" />إضافة المنتج
              </button>
              <button
                onClick={() => { setShowAddModal(false); setAddForm(DEFAULT_PRODUCT); }}
                className="px-5 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ ══════════════════ مودال استيراد Excel ══════════════════ */}
      {showExcelImporter && (
        <ExcelImporter
          existingProducts={products}
          currency={currency}
          onImport={handleExcelImport}
          onClose={() => setShowExcelImporter(false)}
        />
      )}

      {/* ✅ input مخفي لاستيراد CSV القديم */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleImportCSV}
        className="hidden"
      />
    </div>
  );
}