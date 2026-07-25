// src/components/ExcelImporter.tsx
import { useState, useCallback, useRef, useMemo } from "react";
import { Product } from "../types";
import { generateId } from "../store";
import {
  Upload, X, FileSpreadsheet, CheckCircle, AlertTriangle,
  ChevronDown, ChevronRight, Eye, Download, RefreshCw,
  Package, ArrowLeft, ArrowRight, Trash2, Edit3, Plus,
  Search, Filter, Check, Info, HelpCircle
} from "lucide-react";
import * as XLSX from "xlsx";

// ═══════════════════════════════════════════════════════════════
// الأنواع
// ═══════════════════════════════════════════════════════════════
interface ImportedRow {
  id: string;
  raw: Record<string, any>;
  mapped: Partial<Product>;
  errors: string[];
  warnings: string[];
  selected: boolean;
  status: "valid" | "warning" | "error" | "duplicate";
}

interface ColumnMapping {
  excelColumn: string;
  productField: keyof Product | "";
}

type ProductField = {
  key: keyof Product;
  label: string;
  labelAr: string;
  required: boolean;
  type: "text" | "number" | "category";
};

// ═══════════════════════════════════════════════════════════════
// حقول المنتج
// ═══════════════════════════════════════════════════════════════
const PRODUCT_FIELDS: ProductField[] = [
  { key: "name", label: "Product Name", labelAr: "اسم المنتج", required: true, type: "text" },
  { key: "barcode", label: "Barcode", labelAr: "الباركود", required: false, type: "text" },
  { key: "category", label: "Category", labelAr: "الفئة / التصنيف", required: false, type: "category" },
  { key: "description", label: "Description", labelAr: "الوصف", required: false, type: "text" },
  { key: "purchasePrice", label: "Purchase Price", labelAr: "سعر الشراء", required: false, type: "number" },
  { key: "sellingPrice", label: "Selling Price", labelAr: "سعر البيع", required: true, type: "number" },
  { key: "stock", label: "Stock / Quantity", labelAr: "الكمية / المخزون", required: false, type: "number" },
  { key: "minStock", label: "Min Stock Alert", labelAr: "حد أدنى للتنبيه", required: false, type: "number" },
];

// ═══════════════════════════════════════════════════════════════
// خريطة الأعمدة العربية → حقول المنتج (للاكتشاف التلقائي)
// ═══════════════════════════════════════════════════════════════
const ARABIC_COLUMN_MAP: Record<string, keyof Product> = {
  // اسم المنتج
  "اسم المنتج": "name",
  "المنتج": "name",
  "الاسم": "name",
  "اسم الصنف": "name",
  "الصنف": "name",
  "اسم البضاعة": "name",
  "البضاعة": "name",
  "الوصف": "name",
  "اسم السلعة": "name",
  "السلعة": "name",
  "المادة": "name",
  "اسم المادة": "name",
  "name": "name",
  "product name": "name",
  "product": "name",
  "item": "name",
  "item name": "name",
  "description": "name",

  // الباركود
  "الباركود": "barcode",
  "باركود": "barcode",
  "الكود": "barcode",
  "كود": "barcode",
  "رقم الباركود": "barcode",
  "رمز المنتج": "barcode",
  "الرمز": "barcode",
  "رقم الصنف": "barcode",
  "كود الصنف": "barcode",
  "SKU": "barcode",
  "barcode": "barcode",
  "code": "barcode",
  "sku": "barcode",
  "upc": "barcode",
  "ean": "barcode",
  "serial": "barcode",

  // الفئة
  "الفئة": "category",
  "التصنيف": "category",
  "القسم": "category",
  "المجموعة": "category",
  "النوع": "category",
  "فئة المنتج": "category",
  "تصنيف المنتج": "category",
  "category": "category",
  "group": "category",
  "type": "category",

  // الوصف
  "وصف المنتج": "description",
  "الملاحظات": "description",
  "ملاحظات": "description",
  "تفاصيل": "description",
  "التفاصيل": "description",
  "notes": "description",
  "details": "description",

  // سعر الشراء
  "سعر الشراء": "purchasePrice",
  "تكلفة الشراء": "purchasePrice",
  "سعر التكلفة": "purchasePrice",
  "التكلفة": "purchasePrice",
  "الشراء": "purchasePrice",
  "سعر الجملة": "purchasePrice",
  "سعر التوريد": "purchasePrice",
  "purchase price": "purchasePrice",
  "cost": "purchasePrice",
  "cost price": "purchasePrice",
  "buy price": "purchasePrice",
  "buying price": "purchasePrice",

  // سعر البيع
  "سعر البيع": "sellingPrice",
  "سعر المبيع": "sellingPrice",
  "البيع": "sellingPrice",
  "السعر": "sellingPrice",
  "سعر التجزئة": "sellingPrice",
  "سعر القطاعي": "sellingPrice",
  "selling price": "sellingPrice",
  "price": "sellingPrice",
  "sell price": "sellingPrice",
  "retail price": "sellingPrice",
  "unit price": "sellingPrice",

  // المخزون
  "الكمية": "stock",
  "المخزون": "stock",
  "الرصيد": "stock",
  "العدد": "stock",
  "كمية": "stock",
  "مخزون": "stock",
  "الكمية المتاحة": "stock",
  "رصيد المخزون": "stock",
  "quantity": "stock",
  "stock": "stock",
  "qty": "stock",
  "available": "stock",
  "on hand": "stock",
  "balance": "stock",

  // الحد الأدنى
  "الحد الأدنى": "minStock",
  "حد أدنى": "minStock",
  "أقل كمية": "minStock",
  "حد التنبيه": "minStock",
  "min stock": "minStock",
  "minimum": "minStock",
  "reorder level": "minStock",
  "min qty": "minStock",
};

// ═══════════════════════════════════════════════════════════════
// دوال مساعدة
// ═══════════════════════════════════════════════════════════════

/** تنظيف النص العربي */
function cleanArabicText(text: any): string {
  if (text === null || text === undefined) return "";
  let str = String(text).trim();
  // إزالة أحرف التحكم غير المرئية
  str = str.replace(/[\u200B-\u200F\u202A-\u202E\uFEFF\u00A0]/g, "");
  // إزالة المسافات المتعددة
  str = str.replace(/\s+/g, " ");
  return str.trim();
}

/** تحويل القيمة لرقم */
function parseNumber(value: any): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return isNaN(value) ? 0 : value;
  let str = String(value).trim();
  // إزالة رموز العملة والمسافات
  str = str.replace(/[^\d.,\-]/g, "");
  // تحويل الفاصلة العربية
  str = str.replace(/،/g, ".");
  str = str.replace(/,/g, "");
  const num = parseFloat(str);
  return isNaN(num) ? 0 : Math.abs(num);
}

/** تحويل الأرقام العربية/الهندية إلى إنجليزية */
function normalizeArabicNumbers(str: string): string {
  if (!str) return str;
  const arabicNums = "٠١٢٣٤٥٦٧٨٩";
  const hindiNums = "۰۱۲۳۴۵۶۷۸۹";
  let result = str;
  for (let i = 0; i < 10; i++) {
    result = result.replace(new RegExp(arabicNums[i], "g"), String(i));
    result = result.replace(new RegExp(hindiNums[i], "g"), String(i));
  }
  return result;
}

/** اكتشاف تلقائي لعمود Excel → حقل المنتج */
function autoDetectField(columnName: string): keyof Product | "" {
  if (!columnName) return "";
  const cleaned = cleanArabicText(columnName).toLowerCase().trim();

  // بحث مباشر
  for (const [key, field] of Object.entries(ARABIC_COLUMN_MAP)) {
    if (cleaned === key.toLowerCase()) return field;
  }

  // بحث جزئي
  for (const [key, field] of Object.entries(ARABIC_COLUMN_MAP)) {
    if (cleaned.includes(key.toLowerCase()) || key.toLowerCase().includes(cleaned)) {
      return field;
    }
  }

  return "";
}

/** قراءة ملف Excel مع دعم العربية */
function readExcelFile(file: File): Promise<{
  sheets: string[];
  data: Record<string, any>[][];
  headers: Record<string, string[]>;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);

        // ✅ خيارات خاصة لدعم العربية
        const workbook = XLSX.read(data, {
          type: "array",
          codepage: 65001,    // UTF-8
          cellText: true,
          cellDates: true,
          raw: false,
          dense: false,
        });

        const sheets = workbook.SheetNames;
        const allData: Record<string, any>[][] = [];
        const allHeaders: Record<string, string[]> = {};

        for (const sheetName of sheets) {
          const sheet = workbook.Sheets[sheetName];
          if (!sheet) continue;

          // ✅ تحويل مع دعم الترميز العربي
          const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
            defval: "",
            raw: false,
            blankrows: false,
          });

          // تنظيف البيانات العربية
          const cleanedData = jsonData.map(row => {
            const cleanRow: Record<string, any> = {};
            for (const [key, value] of Object.entries(row)) {
              const cleanKey = cleanArabicText(key);
              const cleanValue = typeof value === "string"
                ? cleanArabicText(normalizeArabicNumbers(value))
                : value;
              cleanRow[cleanKey] = cleanValue;
            }
            return cleanRow;
          });

          allData.push(cleanedData);

          // استخراج الأعمدة
          if (cleanedData.length > 0) {
            allHeaders[sheetName] = Object.keys(cleanedData[0]);
          } else {
            allHeaders[sheetName] = [];
          }
        }

        resolve({ sheets, data: allData, headers: allHeaders });
      } catch (err) {
        reject(new Error(`فشل قراءة الملف: ${(err as Error).message}`));
      }
    };

    reader.onerror = () => reject(new Error("فشل قراءة الملف"));
    reader.readAsArrayBuffer(file);
  });
}

// ═══════════════════════════════════════════════════════════════
// المكون الرئيسي
// ═══════════════════════════════════════════════════════════════
interface ExcelImporterProps {
  existingProducts: Product[];
  currency: string;
  onImport: (products: Product[]) => void;
  onClose: () => void;
}

type ImportStep = "upload" | "mapping" | "preview" | "result";

export default function ExcelImporter({
  existingProducts,
  currency,
  onImport,
  onClose,
}: ExcelImporterProps) {
  // ── الحالة ──
  const [step, setStep] = useState<ImportStep>("upload");
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState(0);
  const [rawData, setRawData] = useState<Record<string, any>[][]>([]);
  const [headers, setHeaders] = useState<Record<string, string[]>>({});
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [importedRows, setImportedRows] = useState<ImportedRow[]>([]);
  const [importResult, setImportResult] = useState<{
    total: number; imported: number; skipped: number; errors: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchPreview, setSearchPreview] = useState("");
  const [defaultCategory, setDefaultCategory] = useState("");
  const [duplicateAction, setDuplicateAction] = useState<"skip" | "update" | "add">("skip");
  const [showHelp, setShowHelp] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ═══════════════════════════════════════════════════════════
  // الخطوة 1: رفع الملف
  // ═══════════════════════════════════════════════════════════
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // التحقق من نوع الملف
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
      ".xlsx", ".xls", ".csv"
    ];

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(ext || "")) {
      setError("الرجاء اختيار ملف Excel (.xlsx, .xls) أو CSV (.csv)");
      return;
    }

    setLoading(true);
    setError("");
    setFileName(file.name);

    try {
      const result = await readExcelFile(file);

      if (result.sheets.length === 0) {
        setError("الملف فارغ أو لا يحتوي على بيانات");
        setLoading(false);
        return;
      }

      setSheets(result.sheets);
      setRawData(result.data);
      setHeaders(result.headers);
      setSelectedSheet(0);

      // إعداد الأعمدة مع الاكتشاف التلقائي
      const firstSheetHeaders = result.headers[result.sheets[0]] || [];
      const autoMappings: ColumnMapping[] = firstSheetHeaders.map(col => ({
        excelColumn: col,
        productField: autoDetectField(col),
      }));
      setMappings(autoMappings);

      setStep("mapping");
    } catch (err) {
      setError(`فشل قراءة الملف: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  // ═══════════════════════════════════════════════════════════
  // الخطوة 2: تغيير خريطة الأعمدة
  // ═══════════════════════════════════════════════════════════
  const handleMappingChange = useCallback((index: number, field: keyof Product | "") => {
    setMappings(prev => {
      const next = [...prev];
      next[index] = { ...next[index], productField: field };
      return next;
    });
  }, []);

  const handleSheetChange = useCallback((sheetIndex: number) => {
    setSelectedSheet(sheetIndex);
    const sheetName = sheets[sheetIndex];
    const sheetHeaders = headers[sheetName] || [];
    const autoMappings: ColumnMapping[] = sheetHeaders.map(col => ({
      excelColumn: col,
      productField: autoDetectField(col),
    }));
    setMappings(autoMappings);
  }, [sheets, headers]);

  // أعمدة المعينة حالياً
  const assignedFields = useMemo(() =>
    new Set(mappings.filter(m => m.productField).map(m => m.productField)),
    [mappings]
  );

  // هل التعيين صالح (على الأقل الاسم والسعر)
  const isMappingValid = useMemo(() =>
    assignedFields.has("name") && assignedFields.has("sellingPrice"),
    [assignedFields]
  );

  // ═══════════════════════════════════════════════════════════
  // الخطوة 3: تحويل ومعاينة البيانات
  // ═══════════════════════════════════════════════════════════
  const processData = useCallback(() => {
    const sheetData = rawData[selectedSheet] || [];
    if (sheetData.length === 0) {
      setError("لا توجد بيانات في الورقة المحددة");
      return;
    }

    const existingBarcodes = new Set(
      existingProducts.filter(p => p.barcode).map(p => p.barcode!.toLowerCase())
    );
    const existingNames = new Set(
      existingProducts.map(p => p.name.toLowerCase().trim())
    );

    const rows: ImportedRow[] = sheetData.map((rawRow, idx) => {
      const mapped: Partial<Product> = {};
      const errors: string[] = [];
      const warnings: string[] = [];

      // تطبيق الـ mapping
      for (const mapping of mappings) {
        if (!mapping.productField || !mapping.excelColumn) continue;
        const rawValue = rawRow[mapping.excelColumn];
        const field = mapping.productField;

        switch (field) {
          case "name":
            mapped.name = cleanArabicText(rawValue);
            break;
          case "barcode":
            mapped.barcode = cleanArabicText(normalizeArabicNumbers(String(rawValue || "")));
            break;
          case "category":
            mapped.category = cleanArabicText(rawValue) || defaultCategory;
            break;
          case "description":
            mapped.description = cleanArabicText(rawValue);
            break;
          case "purchasePrice":
            mapped.purchasePrice = parseNumber(normalizeArabicNumbers(String(rawValue || "")));
            break;
          case "sellingPrice":
            mapped.sellingPrice = parseNumber(normalizeArabicNumbers(String(rawValue || "")));
            break;
          case "stock":
            mapped.stock = Math.floor(parseNumber(normalizeArabicNumbers(String(rawValue || ""))));
            break;
          case "minStock":
            mapped.minStock = Math.floor(parseNumber(normalizeArabicNumbers(String(rawValue || ""))));
            break;
        }
      }

      // تطبيق الفئة الافتراضية
      if (!mapped.category && defaultCategory) {
        mapped.category = defaultCategory;
      }

      // التحقق من الصحة
      if (!mapped.name?.trim()) {
        errors.push("اسم المنتج مطلوب");
      }
      if (!mapped.sellingPrice || mapped.sellingPrice <= 0) {
        errors.push("سعر البيع مطلوب وأكبر من صفر");
      }
      if (mapped.purchasePrice && mapped.sellingPrice && mapped.purchasePrice > mapped.sellingPrice) {
        warnings.push("سعر الشراء أكبر من سعر البيع");
      }
      if (mapped.stock !== undefined && mapped.stock < 0) {
        warnings.push("الكمية سالبة، سيتم تحويلها لصفر");
        mapped.stock = 0;
      }

      // فحص التكرار
      let status: ImportedRow["status"] = errors.length > 0 ? "error" : warnings.length > 0 ? "warning" : "valid";
      const nameKey = mapped.name?.toLowerCase().trim();
      const barcodeKey = mapped.barcode?.toLowerCase();

      if (nameKey && existingNames.has(nameKey)) {
        status = "duplicate";
        warnings.push("⚠️ منتج بنفس الاسم موجود مسبقاً");
      }
      if (barcodeKey && existingBarcodes.has(barcodeKey)) {
        status = "duplicate";
        warnings.push("⚠️ باركود مكرر موجود مسبقاً");
      }

      return {
        id: `row-${idx}`,
        raw: rawRow,
        mapped,
        errors,
        warnings,
        selected: status !== "error",
        status,
      };
    });

    setImportedRows(rows);
    setStep("preview");
  }, [rawData, selectedSheet, mappings, existingProducts, defaultCategory]);

  // ═══════════════════════════════════════════════════════════
  // الخطوة 4: الاستيراد النهائي
  // ═══════════════════════════════════════════════════════════
  const handleImport = useCallback(() => {
    const selectedRows = importedRows.filter(r => r.selected && r.errors.length === 0);
    if (selectedRows.length === 0) return;

    const existingBarcodeMap = new Map(
      existingProducts.filter(p => p.barcode).map(p => [p.barcode!.toLowerCase(), p])
    );
    const existingNameMap = new Map(
      existingProducts.map(p => [p.name.toLowerCase().trim(), p])
    );

    const newProducts: Product[] = [];
    const updatedProducts: Product[] = [...existingProducts];
    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const row of selectedRows) {
      const m = row.mapped;
      if (!m.name?.trim() || !m.sellingPrice) {
        errors++;
        continue;
      }

      const nameKey = m.name.toLowerCase().trim();
      const barcodeKey = m.barcode?.toLowerCase();

      // فحص التكرار
      const existingByName = existingNameMap.get(nameKey);
      const existingByBarcode = barcodeKey ? existingBarcodeMap.get(barcodeKey) : undefined;
      const existing = existingByBarcode || existingByName;

      if (existing) {
        switch (duplicateAction) {
          case "skip":
            skipped++;
            continue;
          case "update":
            // تحديث المنتج الموجود
            const idx = updatedProducts.findIndex(p => p.id === existing.id);
            if (idx >= 0) {
              updatedProducts[idx] = {
                ...updatedProducts[idx],
                name: m.name || updatedProducts[idx].name,
                barcode: m.barcode || updatedProducts[idx].barcode,
                category: m.category || updatedProducts[idx].category,
                description: m.description || updatedProducts[idx].description,
                purchasePrice: m.purchasePrice ?? updatedProducts[idx].purchasePrice,
                sellingPrice: m.sellingPrice ?? updatedProducts[idx].sellingPrice,
                stock: (updatedProducts[idx].stock ?? 0) + (m.stock ?? 0),
                minStock: m.minStock ?? updatedProducts[idx].minStock,
              };
              imported++;
            }
            continue;
          case "add":
            // إضافة كمنتج جديد
            break;
        }
      }

      // إضافة منتج جديد
      const newProduct: Product = {
        id: generateId(),
        name: m.name.trim(),
        barcode: m.barcode?.trim() || "",
        category: m.category?.trim() || defaultCategory || "عام",
        description: m.description?.trim() || "",
        purchasePrice: m.purchasePrice ?? 0,
        sellingPrice: m.sellingPrice ?? 0,
        stock: m.stock ?? 0,
        minStock: m.minStock ?? 0,
      };

      newProducts.push(newProduct);
      imported++;
    }

    // دمج المنتجات
    const finalProducts = duplicateAction === "update"
      ? [...updatedProducts, ...newProducts]
      : [...existingProducts, ...newProducts];

    onImport(finalProducts);

    setImportResult({
      total: selectedRows.length,
      imported,
      skipped,
      errors,
    });
    setStep("result");
  }, [importedRows, existingProducts, duplicateAction, defaultCategory, onImport]);

  // إحصائيات المعاينة
  const previewStats = useMemo(() => {
    const total = importedRows.length;
    const valid = importedRows.filter(r => r.status === "valid").length;
    const warnings = importedRows.filter(r => r.status === "warning").length;
    const duplicates = importedRows.filter(r => r.status === "duplicate").length;
    const errors = importedRows.filter(r => r.status === "error").length;
    const selected = importedRows.filter(r => r.selected && r.errors.length === 0).length;
    return { total, valid, warnings, duplicates, errors, selected };
  }, [importedRows]);

  // فلترة المعاينة
  const filteredRows = useMemo(() => {
    if (!searchPreview.trim()) return importedRows;
    const q = searchPreview.toLowerCase();
    return importedRows.filter(r =>
      r.mapped.name?.toLowerCase().includes(q) ||
      r.mapped.barcode?.toLowerCase().includes(q) ||
      r.mapped.category?.toLowerCase().includes(q)
    );
  }, [importedRows, searchPreview]);

  const toggleRowSelection = useCallback((id: string) => {
    setImportedRows(prev => prev.map(r =>
      r.id === id ? { ...r, selected: !r.selected } : r
    ));
  }, []);

  const toggleAllSelection = useCallback((selected: boolean) => {
    setImportedRows(prev => prev.map(r => ({
      ...r,
      selected: r.errors.length === 0 ? selected : false,
    })));
  }, []);

  // تحميل نموذج
  const downloadTemplate = useCallback(() => {
    const ws = XLSX.utils.json_to_sheet([
      {
        "اسم المنتج": "هاتف سامسونج A54",
        "الباركود": "1234567890",
        "الفئة": "هواتف",
        "الوصف": "هاتف ذكي 128GB",
        "سعر الشراء": 8000,
        "سعر البيع": 10000,
        "الكمية": 15,
        "الحد الأدنى": 3,
      },
      {
        "اسم المنتج": "شاحن Type-C",
        "الباركود": "9876543210",
        "الفئة": "اكسسوارات",
        "الوصف": "شاحن سريع 25 واط",
        "سعر الشراء": 50,
        "سعر البيع": 100,
        "الكمية": 50,
        "الحد الأدنى": 10,
      },
      {
        "اسم المنتج": "سماعة بلوتوث",
        "الباركود": "1111222233",
        "الفئة": "اكسسوارات",
        "الوصف": "سماعة لاسلكية",
        "سعر الشراء": 150,
        "سعر البيع": 300,
        "الكمية": 25,
        "الحد الأدنى": 5,
      },
    ]);

    // تعديل عرض الأعمدة
    ws["!cols"] = [
      { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 25 },
      { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "المنتجات");
    XLSX.writeFile(wb, "نموذج_استيراد_المنتجات.xlsx");
  }, []);

  // ═══════════════════════════════════════════════════════════
  // واجهة المستخدم
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      dir="rtl" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* ── الهيدر ── */}
        <div className="bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <FileSpreadsheet size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">استيراد المنتجات من Excel</h2>
              <p className="text-emerald-100 text-xs mt-0.5">
                {step === "upload" && "الخطوة 1: اختيار الملف"}
                {step === "mapping" && "الخطوة 2: تعيين الأعمدة"}
                {step === "preview" && "الخطوة 3: معاينة البيانات"}
                {step === "result" && "✅ تم الاستيراد"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* شريط التقدم */}
            <div className="hidden sm:flex items-center gap-1 ml-4">
              {(["upload", "mapping", "preview", "result"] as ImportStep[]).map((s, i) => (
                <div key={s} className="flex items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    step === s ? "bg-white text-emerald-700 scale-110" :
                    (["upload", "mapping", "preview", "result"].indexOf(step) > i)
                      ? "bg-white/40 text-white" : "bg-white/15 text-white/50"
                  }`}>{i + 1}</div>
                  {i < 3 && <div className={`w-6 h-0.5 mx-0.5 ${
                    (["upload", "mapping", "preview", "result"].indexOf(step) > i)
                      ? "bg-white/40" : "bg-white/15"
                  }`} />}
                </div>
              ))}
            </div>
            <button onClick={onClose}
              className="text-white/70 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ── المحتوى ── */}
        <div className="flex-1 overflow-y-auto">

          {/* ════════════════ خطوة 1: رفع الملف ════════════════ */}
          {step === "upload" && (
            <div className="p-6 space-y-6">
              {/* منطقة السحب والإفلات */}
              <div
                className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/50 ${
                  loading ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-gray-50/50"
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files[0];
                  if (file && fileInputRef.current) {
                    const dt = new DataTransfer();
                    dt.items.add(file);
                    fileInputRef.current.files = dt.files;
                    fileInputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
                  }
                }}
              >
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect} className="hidden" />

                {loading ? (
                  <div className="space-y-3">
                    <RefreshCw size={48} className="mx-auto text-blue-500 animate-spin" />
                    <p className="text-blue-600 font-bold">جاري قراءة الملف...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="w-20 h-20 bg-emerald-100 rounded-2xl mx-auto flex items-center justify-center">
                      <Upload size={36} className="text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-lg font-black text-gray-700">اسحب الملف هنا أو انقر للاختيار</p>
                      <p className="text-sm text-gray-400 mt-1">يدعم: .xlsx, .xls, .csv</p>
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
                  <AlertTriangle size={18} className="text-red-500 flex-shrink-0" />
                  <span className="text-sm text-red-700 font-semibold">{error}</span>
                </div>
              )}

              {/* نموذج للتحميل */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <Info size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-bold text-blue-800 text-sm mb-2">تحتاج نموذج؟</h4>
                    <p className="text-xs text-blue-600 leading-relaxed mb-3">
                      حمّل نموذج Excel جاهز بالأعمدة الصحيحة واملأه ببيانات منتجاتك
                    </p>
                    <button onClick={downloadTemplate}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 active:scale-95 transition-all">
                      <Download size={14} />
                      تحميل النموذج
                    </button>
                  </div>
                </div>
              </div>

              {/* مساعدة */}
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-5">
                <button onClick={() => setShowHelp(!showHelp)}
                  className="flex items-center gap-2 w-full text-right">
                  <HelpCircle size={16} className="text-amber-500" />
                  <span className="font-bold text-amber-800 text-sm flex-1">نصائح مهمة</span>
                  {showHelp ? <ChevronDown size={14} className="text-amber-400" /> : <ChevronRight size={14} className="text-amber-400" />}
                </button>
                {showHelp && (
                  <div className="mt-3 text-xs text-amber-700 space-y-2 leading-relaxed">
                    <p>📌 <strong>الصف الأول</strong> يجب أن يحتوي على أسماء الأعمدة (مثل: اسم المنتج، سعر البيع...)</p>
                    <p>📌 <strong>الأعمدة المطلوبة:</strong> اسم المنتج + سعر البيع (على الأقل)</p>
                    <p>📌 <strong>الأرقام العربية</strong> (٠١٢٣) يتم تحويلها تلقائياً</p>
                    <p>📌 يمكن استخدام أي اسم عمود بالعربي أو الإنجليزي والنظام يكتشفه تلقائياً</p>
                    <p>📌 المنتجات المكررة يمكن تخطيها أو تحديث بياناتها</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════════════════ خطوة 2: تعيين الأعمدة ════════════════ */}
          {step === "mapping" && (
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="font-black text-gray-800">تعيين الأعمدة</h3>
                  <p className="text-xs text-gray-400 mt-1">
                    ملف: <span className="font-bold text-gray-600">{fileName}</span>
                    {" · "}{rawData[selectedSheet]?.length ?? 0} صف
                  </p>
                </div>
                {sheets.length > 1 && (
                  <select value={selectedSheet} onChange={e => handleSheetChange(Number(e.target.value))}
                    className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-emerald-400">
                    {sheets.map((s, i) => (
                      <option key={i} value={i}>{s}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* جدول التعيين */}
              <div className="border-2 border-gray-100 rounded-xl overflow-hidden">
                <div className="grid grid-cols-[1fr_40px_1fr_auto] gap-0 bg-gray-50 px-4 py-3 text-xs font-bold text-gray-500 border-b">
                  <span>عمود Excel</span>
                  <span />
                  <span>حقل المنتج</span>
                  <span className="text-center">نموذج</span>
                </div>

                {mappings.map((mapping, idx) => {
                  const sampleValue = rawData[selectedSheet]?.[0]?.[mapping.excelColumn] ?? "";
                  const isAssigned = !!mapping.productField;
                  const fieldInfo = PRODUCT_FIELDS.find(f => f.key === mapping.productField);

                  return (
                    <div key={idx}
                      className={`grid grid-cols-[1fr_40px_1fr_auto] gap-0 items-center px-4 py-3 border-b border-gray-50 transition-colors ${
                        isAssigned ? "bg-emerald-50/30" : "hover:bg-gray-50"
                      }`}>
                      <div className="min-w-0">
                        <div className="font-bold text-gray-800 text-sm truncate">{mapping.excelColumn}</div>
                        <div className="text-xs text-gray-400 truncate mt-0.5"
                          title={String(sampleValue)}>
                          نموذج: {String(sampleValue).slice(0, 30) || "—"}
                        </div>
                      </div>

                      <div className="flex justify-center">
                        <ArrowLeft size={14} className={isAssigned ? "text-emerald-400" : "text-gray-200"} />
                      </div>

                      <select
                        value={mapping.productField}
                        onChange={e => handleMappingChange(idx, e.target.value as keyof Product | "")}
                        className={`w-full border-2 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none transition-colors ${
                          isAssigned
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800 focus:border-emerald-500"
                            : "border-gray-200 text-gray-400 focus:border-blue-400"
                        }`}
                      >
                        <option value="">— تخطي —</option>
                        {PRODUCT_FIELDS.map(field => (
                          <option key={field.key} value={field.key}
                            disabled={assignedFields.has(field.key) && mapping.productField !== field.key}>
                            {field.labelAr} {field.required ? "⭐" : ""}
                          </option>
                        ))}
                      </select>

                      <div className="w-16 text-center">
                        {isAssigned ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600">
                            <Check size={14} />
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* خيارات إضافية */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-bold text-gray-600 mb-1.5 block">الفئة الافتراضية</label>
                  <input type="text" value={defaultCategory}
                    onChange={e => setDefaultCategory(e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-400"
                    placeholder="مثال: هواتف، اكسسوارات..." />
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-600 mb-1.5 block">المنتجات المكررة</label>
                  <select value={duplicateAction}
                    onChange={e => setDuplicateAction(e.target.value as any)}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-400">
                    <option value="skip">تخطي المكرر</option>
                    <option value="update">تحديث المنتج الموجود</option>
                    <option value="add">إضافة كمنتج جديد</option>
                  </select>
                </div>
              </div>

              {/* التحقق */}
              {!isMappingValid && (
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <AlertTriangle size={18} className="text-amber-500 flex-shrink-0" />
                  <span className="text-sm text-amber-700 font-semibold">
                    يجب تعيين <strong>"اسم المنتج"</strong> و <strong>"سعر البيع"</strong> على الأقل
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ════════════════ خطوة 3: المعاينة ════════════════ */}
          {step === "preview" && (
            <div className="p-6 space-y-4">
              {/* إحصائيات */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { label: "إجمالي", value: previewStats.total, color: "bg-gray-100 text-gray-700" },
                  { label: "صالح", value: previewStats.valid, color: "bg-emerald-100 text-emerald-700" },
                  { label: "تحذيرات", value: previewStats.warnings, color: "bg-amber-100 text-amber-700" },
                  { label: "مكرر", value: previewStats.duplicates, color: "bg-blue-100 text-blue-700" },
                  { label: "أخطاء", value: previewStats.errors, color: "bg-red-100 text-red-700" },
                ].map(({ label, value, color }) => (
                  <div key={label} className={`${color} rounded-xl px-3 py-2.5 text-center`}>
                    <div className="text-lg font-black">{value}</div>
                    <div className="text-xs font-semibold opacity-70">{label}</div>
                  </div>
                ))}
              </div>

              {/* بحث وتحديد */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px] relative">
                  <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" value={searchPreview}
                    onChange={e => setSearchPreview(e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-xl pr-9 pl-4 py-2.5 text-sm outline-none focus:border-emerald-400"
                    placeholder="بحث في المنتجات..." />
                </div>
                <button onClick={() => toggleAllSelection(true)}
                  className="px-3 py-2.5 bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold hover:bg-emerald-200">
                  تحديد الكل
                </button>
                <button onClick={() => toggleAllSelection(false)}
                  className="px-3 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-200">
                  إلغاء الكل
                </button>
              </div>

              {/* جدول المعاينة */}
              <div className="border-2 border-gray-100 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-[45vh]">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-3 text-right font-bold text-gray-500 w-10">✓</th>
                        <th className="px-3 py-3 text-right font-bold text-gray-500">#</th>
                        <th className="px-3 py-3 text-right font-bold text-gray-500">الاسم</th>
                        <th className="px-3 py-3 text-right font-bold text-gray-500">الباركود</th>
                        <th className="px-3 py-3 text-right font-bold text-gray-500">الفئة</th>
                        <th className="px-3 py-3 text-right font-bold text-gray-500">شراء</th>
                        <th className="px-3 py-3 text-right font-bold text-gray-500">بيع</th>
                        <th className="px-3 py-3 text-right font-bold text-gray-500">كمية</th>
                        <th className="px-3 py-3 text-right font-bold text-gray-500">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((row, idx) => {
                        const statusColors = {
                          valid: "bg-white",
                          warning: "bg-amber-50",
                          error: "bg-red-50",
                          duplicate: "bg-blue-50",
                        };
                        return (
                          <tr key={row.id}
                            className={`border-b border-gray-50 ${statusColors[row.status]} hover:bg-gray-50/50 transition-colors`}>
                            <td className="px-3 py-2.5">
                              <input type="checkbox"
                                checked={row.selected}
                                disabled={row.status === "error"}
                                onChange={() => toggleRowSelection(row.id)}
                                className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                            </td>
                            <td className="px-3 py-2.5 text-gray-400 font-mono text-xs">{idx + 1}</td>
                            <td className="px-3 py-2.5 font-bold text-gray-800">{row.mapped.name || "—"}</td>
                            <td className="px-3 py-2.5 text-gray-500 font-mono text-xs">{row.mapped.barcode || "—"}</td>
                            <td className="px-3 py-2.5 text-gray-500">{row.mapped.category || "—"}</td>
                            <td className="px-3 py-2.5 text-gray-600">
                              {(row.mapped.purchasePrice ?? 0).toLocaleString()} {currency}
                            </td>
                            <td className="px-3 py-2.5 font-bold text-emerald-700">
                              {(row.mapped.sellingPrice ?? 0).toLocaleString()} {currency}
                            </td>
                            <td className="px-3 py-2.5 text-gray-600">{row.mapped.stock ?? 0}</td>
                            <td className="px-3 py-2.5">
                              {row.status === "valid" && (
                                <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold">✅ صالح</span>
                              )}
                              {row.status === "warning" && (
                                <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold"
                                  title={row.warnings.join("\n")}>⚠️ تحذير</span>
                              )}
                              {row.status === "error" && (
                                <span className="px-2 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-bold"
                                  title={row.errors.join("\n")}>❌ خطأ</span>
                              )}
                              {row.status === "duplicate" && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold"
                                  title={row.warnings.join("\n")}>🔄 مكرر</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ملخص التحديد */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package size={16} className="text-emerald-600" />
                  <span className="text-sm font-bold text-emerald-800">
                    سيتم استيراد <span className="text-lg font-black">{previewStats.selected}</span> منتج
                    من أصل {previewStats.total}
                  </span>
                </div>
                {previewStats.duplicates > 0 && (
                  <span className="text-xs text-blue-600 font-semibold">
                    {duplicateAction === "skip" ? "المكرر: تخطي" :
                     duplicateAction === "update" ? "المكرر: تحديث" : "المكرر: إضافة جديد"}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ════════════════ خطوة 4: النتيجة ════════════════ */}
          {step === "result" && importResult && (
            <div className="p-8 text-center space-y-6">
              <div className="w-24 h-24 bg-emerald-100 rounded-3xl mx-auto flex items-center justify-center">
                <CheckCircle size={48} className="text-emerald-600" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-gray-800">تم الاستيراد بنجاح! 🎉</h3>
                <p className="text-gray-500 mt-2">تم معالجة {importResult.total} منتج</p>
              </div>

              <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                <div className="bg-emerald-50 rounded-xl p-4">
                  <div className="text-2xl font-black text-emerald-700">{importResult.imported}</div>
                  <div className="text-xs font-semibold text-emerald-600">تم استيرادهم</div>
                </div>
                <div className="bg-amber-50 rounded-xl p-4">
                  <div className="text-2xl font-black text-amber-700">{importResult.skipped}</div>
                  <div className="text-xs font-semibold text-amber-600">تم تخطيهم</div>
                </div>
                <div className="bg-red-50 rounded-xl p-4">
                  <div className="text-2xl font-black text-red-700">{importResult.errors}</div>
                  <div className="text-xs font-semibold text-red-600">أخطاء</div>
                </div>
              </div>

              <button onClick={onClose}
                className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-black text-base hover:bg-emerald-700 active:scale-95 transition-all shadow-lg shadow-emerald-200">
                تم ✓
              </button>
            </div>
          )}
        </div>

        {/* ── الفوتر (أزرار التنقل) ── */}
        {step !== "result" && (
          <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-between flex-shrink-0 bg-gray-50">
            <button onClick={() => {
              if (step === "mapping") setStep("upload");
              else if (step === "preview") setStep("mapping");
            }}
              disabled={step === "upload"}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-200 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              <ArrowRight size={14} />
              رجوع
            </button>

            <div className="flex items-center gap-3">
              <button onClick={onClose}
                className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors">
                إلغاء
              </button>

              {step === "mapping" && (
                <button onClick={processData}
                  disabled={!isMappingValid}
                  className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-black hover:bg-emerald-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-all">
                  <Eye size={14} />
                  معاينة البيانات
                  <ArrowLeft size={14} />
                </button>
              )}

              {step === "preview" && (
                <button onClick={handleImport}
                  disabled={previewStats.selected === 0}
                  className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-black hover:bg-emerald-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-all">
                  <Plus size={14} />
                  استيراد {previewStats.selected} منتج
                  <CheckCircle size={14} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}