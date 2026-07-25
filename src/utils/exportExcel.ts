import * as XLSX from "xlsx";
import { Invoice, Product } from "../types";

interface ExportOptions {
  invoices: Invoice[];
  products: Product[];
  currency: string;
  sheetTitle?: string;
  filterType?: string;
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    sale: "مبيعات",
    purchase: "مشتريات",
    return_sale: "مرتجع بيع",
    return_purchase: "مرتجع شراء",
    maintenance: "صيانة",
    accessory_sale: "بيع اكسسوار",
    accessory_purchase: "شراء اكسسوار",
  };
  return labels[type] ?? type;
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    closed: "مغلقة",
    pending: "معلقة",
    open: "مفتوحة",
    cancelled: "ملغية",
  };
  return labels[status] ?? status;
}

export function exportInvoicesToExcel(options: ExportOptions): void {
  const { invoices, currency, sheetTitle = "الفواتير" } = options;
  const wb = XLSX.utils.book_new();

  // ═══════════════════════════════════════════
  // SHEET 1: ملخص الفواتير
  // ═══════════════════════════════════════════
  const summaryHeaders = [
    "رقم الفاتورة",
    "النوع",
    "الحالة",
    "التاريخ",
    "الوقت",
    "اسم العميل / المورد",
    "الهاتف",
    `إجمالي الفاتورة (${currency})`,
    `المدفوع (${currency})`,
    `المتبقي (${currency})`,
    "طريقة الدفع",
    `الخصم (${currency})`,
    `الضريبة (${currency})`,
    "عدد البنود",
    "ملاحظات",
  ];

  const summaryRows = invoices.map((inv) => [
    inv.number ?? "",
    getTypeLabel(inv.type),
    getStatusLabel(inv.status),
    inv.date ?? "",
    inv.time ?? "",
    inv.customerName || inv.supplierName || "-",
    inv.customerPhone || inv.supplierPhone || "",
    inv.total ?? 0,
    inv.paid ?? 0,
    inv.remaining ?? 0,
    inv.paymentMethod ?? "",
    inv.discount ?? 0,
    inv.tax ?? 0,
    inv.items?.length ?? 0,
    inv.notes ?? "",
  ]);

  const summaryData = [summaryHeaders, ...summaryRows];
  const ws1 = XLSX.utils.aoa_to_sheet(summaryData);

  ws1["!cols"] = [
    { wch: 16 },
    { wch: 16 },
    { wch: 10 },
    { wch: 12 },
    { wch: 8 },
    { wch: 24 },
    { wch: 14 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 28 },
  ];

  // تنسيق الهيدر
  const summaryRange = XLSX.utils.decode_range(ws1["!ref"] ?? "A1");
  for (let C = summaryRange.s.c; C <= summaryRange.e.c; C++) {
    const cellAddr = XLSX.utils.encode_cell({ r: 0, c: C });
    if (!ws1[cellAddr]) continue;
    ws1[cellAddr].s = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "1E40AF" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: {
        top: { style: "thin", color: { rgb: "CCCCCC" } },
        bottom: { style: "thin", color: { rgb: "CCCCCC" } },
        left: { style: "thin", color: { rgb: "CCCCCC" } },
        right: { style: "thin", color: { rgb: "CCCCCC" } },
      },
    };
  }

  XLSX.utils.book_append_sheet(wb, ws1, "ملخص الفواتير");

  // ═══════════════════════════════════════════
  // SHEET 2: تفاصيل البنود
  // ═══════════════════════════════════════════
  const detailHeaders = [
    "رقم الفاتورة",
    "النوع",
    "الحالة",
    "التاريخ",
    "الوقت",
    "العميل / المورد",
    "الهاتف",
    "م",
    "اسم المنتج / الخدمة",
    "الباركود",
    "IMEI",
    "الكمية",
    `سعر الوحدة (${currency})`,
    `التكلفة (${currency})`,
    `خصم البند (${currency})`,
    `إجمالي البند (${currency})`,
    `إجمالي الفاتورة (${currency})`,
    `المدفوع (${currency})`,
    `المتبقي (${currency})`,
    "طريقة الدفع",
    `خصم الفاتورة (${currency})`,
    `ضريبة (${currency})`,
    "ملاحظات الفاتورة",
  ];

  const detailRows: any[][] = [];

  invoices.forEach((inv) => {
    const items = inv.items ?? [];

    if (items.length === 0) {
      const row: any[] = [
        inv.number ?? "",
        getTypeLabel(inv.type),
        getStatusLabel(inv.status),
        inv.date ?? "",
        inv.time ?? "",
        inv.customerName || inv.supplierName || "-",
        inv.customerPhone || inv.supplierPhone || "",
        1,
        inv.maintenanceInfo
          ? `صيانة ${inv.maintenanceInfo.deviceBrand ?? ""} ${inv.maintenanceInfo.deviceModel ?? ""}`.trim()
          : "—",
        "",
        inv.maintenanceInfo?.imei ?? "",
        1,
        inv.total ?? 0,
        0,
        0,
        inv.total ?? 0,
        inv.total ?? 0,
        inv.paid ?? 0,
        inv.remaining ?? 0,
        inv.paymentMethod ?? "",
        inv.discount ?? 0,
        inv.tax ?? 0,
        inv.notes ?? "",
      ];
      detailRows.push(row);
    } else {
      items.forEach((item, idx) => {
        const isFirst = idx === 0;
        const row: any[] = [
          inv.number ?? "",
          getTypeLabel(inv.type),
          getStatusLabel(inv.status),
          inv.date ?? "",
          inv.time ?? "",
          inv.customerName || inv.supplierName || "-",
          inv.customerPhone || inv.supplierPhone || "",
          idx + 1,
          item.productName ?? "",
          item.barcode ?? "",
          (item as any).imei ?? "",
          item.quantity ?? 0,
          item.unitPrice ?? (item as any).price ?? 0,
          (item as any).costPrice ?? 0,
          item.discount ?? 0,
          item.total ??
            (item.quantity ?? 0) * (item.unitPrice ?? (item as any).price ?? 0),
          isFirst ? (inv.total ?? 0) : "",
          isFirst ? (inv.paid ?? 0) : "",
          isFirst ? (inv.remaining ?? 0) : "",
          isFirst ? (inv.paymentMethod ?? "") : "",
          isFirst ? (inv.discount ?? 0) : "",
          isFirst ? (inv.tax ?? 0) : "",
          isFirst ? (inv.notes ?? "") : "",
        ];
        detailRows.push(row);
      });
    }
  });

  const detailData = [detailHeaders, ...detailRows];
  const ws2 = XLSX.utils.aoa_to_sheet(detailData);

  ws2["!cols"] = [
    { wch: 16 },
    { wch: 14 },
    { wch: 10 },
    { wch: 12 },
    { wch: 8 },
    { wch: 22 },
    { wch: 14 },
    { wch: 5 },
    { wch: 28 },
    { wch: 16 },
    { wch: 18 },
    { wch: 8 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 28 },
  ];

  XLSX.utils.book_append_sheet(wb, ws2, "تفاصيل البنود");

  // ═══════════════════════════════════════════
  // SHEET 3: إحصائيات
  // ═══════════════════════════════════════════
  const closed = invoices.filter((i) => i.status === "closed");
  const totalSales = closed
    .filter((i) => i.type === "sale")
    .reduce((s, i) => s + (i.paid ?? 0), 0);
  const totalPurchases = closed
    .filter((i) => i.type === "purchase")
    .reduce((s, i) => s + (i.paid ?? 0), 0);
  const totalMaint = closed
    .filter((i) => i.type === "maintenance")
    .reduce((s, i) => s + (i.paid ?? 0), 0);
  const totalAccSales = closed
    .filter((i) => i.type === "accessory_sale")
    .reduce((s, i) => s + (i.paid ?? 0), 0);
  const totalAccPurch = closed
    .filter((i) => i.type === "accessory_purchase")
    .reduce((s, i) => s + (i.paid ?? 0), 0);
  const totalRetSale = closed
    .filter((i) => i.type === "return_sale")
    .reduce((s, i) => s + (i.paid ?? 0), 0);
  const totalRetPurch = closed
    .filter((i) => i.type === "return_purchase")
    .reduce((s, i) => s + (i.paid ?? 0), 0);

  const netSales =
    totalSales - totalPurchases - totalRetSale + totalRetPurch;
  const totalRevenue =
    totalSales + totalMaint + totalAccSales - totalRetSale;

  const statsData: any[][] = [
    [`📊 إحصائيات الفواتير - ${sheetTitle}`, ""],
    [`تاريخ التصدير: ${new Date().toLocaleDateString("ar-EG")}`, ""],
    ["", ""],
    ["النوع", `المبلغ (${currency})`],
    ["إجمالي المبيعات (مدفوع)", totalSales],
    ["إجمالي المشتريات (مدفوع)", totalPurchases],
    ["مرتجع المبيعات", totalRetSale],
    ["مرتجع المشتريات", totalRetPurch],
    ["إجمالي الصيانة", totalMaint],
    ["بيع الاكسسوار", totalAccSales],
    ["شراء الاكسسوار", totalAccPurch],
    ["", ""],
    ["📌 صافي المبيعات", netSales],
    ["📌 إجمالي الإيرادات", totalRevenue],
    ["", ""],
    ["عدد الفواتير الكلي", invoices.length],
    [
      "عدد المغلقة",
      invoices.filter((i) => i.status === "closed").length,
    ],
    [
      "عدد المعلقة",
      invoices.filter((i) => i.status === "pending").length,
    ],
    [
      "عدد الملغية",
      invoices.filter((i) => i.status === "cancelled").length,
    ],
  ];

  const ws3 = XLSX.utils.aoa_to_sheet(statsData);
  ws3["!cols"] = [{ wch: 28 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws3, "الإحصائيات");

  // ═══════════════════════════════════════════
  // تصدير الملف
  // ═══════════════════════════════════════════
  const fileName = `فواتير_${sheetTitle}_${new Date()
    .toISOString()
    .slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

// ═══════════════════════════════════════════
// تصدير المنتجات
// ═══════════════════════════════════════════
export function exportProductsToExcel(
  products: Product[],
  currency: string
): void {
  const wb = XLSX.utils.book_new();

  const headers = [
    "اسم المنتج",
    "الفئة",
    "الباركود",
    `سعر البيع (${currency})`,
    `سعر الشراء (${currency})`,
    "المخزون",
    "الحد الأدنى",
    "الموقع",
    "ملاحظات",
  ];

  const rows = products.map((p) => [
    p.name ?? "",
    p.category ?? "",
    p.barcode ?? "",
    p.sellingPrice ?? 0,
    (p as any).costPrice ?? 0,
    p.stock ?? 0,
    (p as any).minStock ?? 0,
    (p as any).location ?? "",
    (p as any).notes ?? "",
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = [
    { wch: 28 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 10 },
    { wch: 10 },
    { wch: 16 },
    { wch: 24 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "المنتجات");
  XLSX.writeFile(
    wb,
    `منتجات_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}