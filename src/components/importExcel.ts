import * as XLSX from "xlsx";
import { Product } from "../types";
import { generateId } from "../store";

export interface ImportResult {
  success: number;
  failed: number;
  duplicates: number;
  errors: string[];
  products: Product[];
}

export function importProductsFromExcel(
  file: File,
  existingProducts: Product[]
): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        if (rows.length === 0) {
          resolve({
            success: 0,
            failed: 0,
            duplicates: 0,
            errors: ["الملف فارغ أو لا يحتوي على بيانات"],
            products: [],
          });
          return;
        }

        const result: ImportResult = {
          success: 0,
          failed: 0,
          duplicates: 0,
          errors: [],
          products: [],
        };

        const existingBarcodes = new Set(
          existingProducts
            .filter((p) => p.barcode)
            .map((p) => p.barcode!.trim())
        );
        const existingNames = new Set(
          existingProducts.map((p) => p.name.trim().toLowerCase())
        );
        const newBarcodes = new Set<string>();

        rows.forEach((row, index) => {
          const rowNum = index + 2;

          const name =
            String(
              row["اسم المنتج"] ??
                row["الاسم"] ??
                row["name"] ??
                row["Name"] ??
                row["Product Name"] ??
                row["product_name"] ??
                ""
            ).trim();

          if (!name) {
            result.failed++;
            result.errors.push(`سطر ${rowNum}: اسم المنتج فارغ`);
            return;
          }

          const barcode = String(
            row["الباركود"] ??
              row["باركود"] ??
              row["barcode"] ??
              row["Barcode"] ??
              row["code"] ??
              ""
          ).trim();

          if (barcode && existingBarcodes.has(barcode)) {
            result.duplicates++;
            result.errors.push(
              `سطر ${rowNum}: الباركود "${barcode}" موجود مسبقاً (${name})`
            );
            return;
          }

          if (barcode && newBarcodes.has(barcode)) {
            result.duplicates++;
            result.errors.push(
              `سطر ${rowNum}: الباركود "${barcode}" مكرر في الملف (${name})`
            );
            return;
          }

          if (existingNames.has(name.toLowerCase())) {
            result.duplicates++;
            result.errors.push(
              `سطر ${rowNum}: المنتج "${name}" موجود مسبقاً`
            );
            return;
          }

          const sellingPrice = Number(
            row["سعر البيع"] ??
              row["سعر_البيع"] ??
              row["selling_price"] ??
              row["Selling Price"] ??
              row["price"] ??
              row["السعر"] ??
              0
          );

          const costPrice = Number(
            row["سعر الشراء"] ??
              row["سعر_الشراء"] ??
              row["cost_price"] ??
              row["Cost Price"] ??
              row["التكلفة"] ??
              0
          );

          const stock = Number(
            row["المخزون"] ??
              row["الكمية"] ??
              row["stock"] ??
              row["Stock"] ??
              row["quantity"] ??
              row["qty"] ??
              0
          );

          const minStock = Number(
            row["الحد الأدنى"] ??
              row["حد_ادنى"] ??
              row["min_stock"] ??
              row["Min Stock"] ??
              0
          );

          const category = String(
            row["الفئة"] ??
              row["التصنيف"] ??
              row["category"] ??
              row["Category"] ??
              ""
          ).trim();

          const location = String(
            row["الموقع"] ??
              row["المكان"] ??
              row["location"] ??
              row["Location"] ??
              ""
          ).trim();

          const notes = String(
            row["ملاحظات"] ??
              row["notes"] ??
              row["Notes"] ??
              ""
          ).trim();

          const product: Product = {
            id: generateId(),
            name,
            barcode: barcode || undefined,
            sellingPrice: isNaN(sellingPrice) ? 0 : sellingPrice,
            costPrice: isNaN(costPrice) ? 0 : costPrice,
            stock: isNaN(stock) ? 0 : Math.max(0, Math.floor(stock)),
            minStock: isNaN(minStock) ? 0 : Math.max(0, Math.floor(minStock)),
            category: category || undefined,
            location: location || undefined,
            notes: notes || undefined,
          } as any;

          result.products.push(product);
          result.success++;

          if (barcode) newBarcodes.add(barcode);
          existingNames.add(name.toLowerCase());
        });

        resolve(result);
      } catch (err: any) {
        reject(new Error(`خطأ في قراءة الملف: ${err.message}`));
      }
    };

    reader.onerror = () => reject(new Error("فشل في قراءة الملف"));
    reader.readAsArrayBuffer(file);
  });
}

export function generateImportTemplate(): void {
  const wb = XLSX.utils.book_new();

  const headers = [
    "اسم المنتج",
    "الباركود",
    "سعر البيع",
    "سعر الشراء",
    "المخزون",
    "الحد الأدنى",
    "الفئة",
    "الموقع",
    "ملاحظات",
  ];

  const sampleData = [
    headers,
    ["هاتف سامسونج A54", "123456789", 8500, 7000, 10, 3, "هواتف", "رف A1", ""],
    ["شاحن سريع", "987654321", 150, 80, 50, 10, "اكسسوارات", "رف B2", "USB-C"],
    ["كفر سيليكون", "", 50, 20, 100, 20, "اكسسوارات", "رف C3", "متعدد الألوان"],
  ];

  const ws = XLSX.utils.aoa_to_sheet(sampleData);

  ws["!cols"] = [
    { wch: 25 },
    { wch: 16 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 12 },
    { wch: 15 },
    { wch: 14 },
    { wch: 20 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "المنتجات");
  XLSX.writeFile(wb, "قالب_استيراد_المنتجات.xlsx");
}