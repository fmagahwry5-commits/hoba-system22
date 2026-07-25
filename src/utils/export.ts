import * as XLSX from 'xlsx';
import { Invoice, AppState } from '../types';

function formatDate(dateStr: string): string {
  return dateStr || '';
}

export function exportInvoicesToExcel(invoices: Invoice[], filename: string): void {
  const rows = invoices.flatMap(inv =>
    inv.items.map(item => ({
      'رقم الفاتورة': inv.number,
      'النوع': inv.type === 'sale' ? 'مبيعات' : 'مشتريات',
      'الحالة': inv.status === 'open' ? 'مفتوحة' : inv.status === 'saved' ? 'محفوظة' : inv.status === 'closed' ? 'مغلقة' : 'معلقة',
      'التاريخ': formatDate(inv.date),
      'الوقت': inv.time,
      'العميل/المورد': inv.customerName || inv.supplierName || '',
      'الهاتف': inv.customerPhone || inv.supplierPhone || '',
      'المنتج': item.productName,
      'الباركود': item.barcode,
      'الكمية': item.quantity,
      'سعر الوحدة': item.unitPrice,
      'الخصم': item.discount,
      'الإجمالي': item.total,
      'الإجمالي الكلي': inv.total,
      'المدفوع': inv.paid,
      'المتبقي': inv.remaining,
      'ملاحظات': inv.notes,
    }))
  );

  if (rows.length === 0) {
    rows.push({
      'رقم الفاتورة': '',
      'النوع': '',
      'الحالة': '',
      'التاريخ': '',
      'الوقت': '',
      'العميل/المورد': '',
      'الهاتف': '',
      'المنتج': '',
      'الباركود': '',
      'الكمية': 0,
      'سعر الوحدة': 0,
      'الخصم': 0,
      'الإجمالي': 0,
      'الإجمالي الكلي': 0,
      'المدفوع': 0,
      'المتبقي': 0,
      'ملاحظات': 'لا توجد فواتير',
    });
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'الفواتير');
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportSingleInvoiceToExcel(inv: Invoice, shopName: string, _currency: string): void {
  const header = [
    [shopName],
    [`فاتورة رقم: ${inv.number}`],
    [`التاريخ: ${inv.date}  الوقت: ${inv.time}`],
    [`العميل: ${inv.customerName || inv.supplierName || ''}`],
    [`الهاتف: ${inv.customerPhone || inv.supplierPhone || ''}`],
    [],
    ['المنتج', 'الباركود', 'الكمية', 'سعر الوحدة', 'الخصم', 'الإجمالي'],
  ];

  const itemRows = inv.items.map(item => [
    item.productName,
    item.barcode,
    item.quantity,
    item.unitPrice,
    item.discount,
    item.total,
  ]);

  const footer = [
    [],
    ['', '', '', '', 'المجموع:', inv.subtotal],
    ['', '', '', '', 'الخصم:', inv.discount],
    ['', '', '', '', 'الضريبة:', inv.tax],
    ['', '', '', '', 'الإجمالي:', inv.total],
    ['', '', '', '', 'المدفوع:', inv.paid],
    ['', '', '', '', 'المتبقي:', inv.remaining],
    [],
    [`ملاحظات: ${inv.notes}`],
  ];

  const allRows = [...header, ...itemRows, ...footer];
  const ws = XLSX.utils.aoa_to_sheet(allRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'الفاتورة');
  XLSX.writeFile(wb, `فاتورة_${inv.number}.xlsx`);
}

export function exportFullBackupToExcel(state: AppState): void {
  const wb = XLSX.utils.book_new();

  // Products sheet
  const productRows = state.products.map(p => ({
    'الكود': p.id,
    'الاسم': p.name,
    'الباركود': p.barcode,
    'الفئة': p.category,
    'سعر الشراء': p.purchasePrice,
    'سعر البيع': p.sellingPrice,
    'المخزون': p.stock,
    'الوحدة': p.unit,
  }));
  if (productRows.length > 0) {
    const wsP = XLSX.utils.json_to_sheet(productRows);
    XLSX.utils.book_append_sheet(wb, wsP, 'المنتجات');
  }

  // Sales sheet
  const salesRows = state.invoices.filter(i => i.type === 'sale').flatMap(inv =>
    inv.items.map(item => ({
      'رقم الفاتورة': inv.number,
      'الحالة': inv.status,
      'التاريخ': inv.date,
      'العميل': inv.customerName,
      'المنتج': item.productName,
      'الكمية': item.quantity,
      'السعر': item.unitPrice,
      'الإجمالي': item.total,
      'المدفوع': inv.paid,
      'المتبقي': inv.remaining,
    }))
  );
  const wsSales = XLSX.utils.json_to_sheet(salesRows.length > 0 ? salesRows : [{ 'ملاحظة': 'لا توجد فواتير مبيعات' }]);
  XLSX.utils.book_append_sheet(wb, wsSales, 'فواتير المبيعات');

  // Purchases sheet
  const purchaseRows = state.invoices.filter(i => i.type === 'purchase').flatMap(inv =>
    inv.items.map(item => ({
      'رقم الفاتورة': inv.number,
      'الحالة': inv.status,
      'التاريخ': inv.date,
      'المورد': inv.supplierName,
      'المنتج': item.productName,
      'الكمية': item.quantity,
      'السعر': item.unitPrice,
      'الإجمالي': item.total,
      'المدفوع': inv.paid,
      'المتبقي': inv.remaining,
    }))
  );
  const wsPurch = XLSX.utils.json_to_sheet(purchaseRows.length > 0 ? purchaseRows : [{ 'ملاحظة': 'لا توجد فواتير مشتريات' }]);
  XLSX.utils.book_append_sheet(wb, wsPurch, 'فواتير المشتريات');

  // Pending sheet
  const pendingRows = state.invoices.filter(i => i.status === 'pending').flatMap(inv =>
    inv.items.map(item => ({
      'رقم الفاتورة': inv.number,
      'النوع': inv.type === 'sale' ? 'مبيعات' : 'مشتريات',
      'التاريخ': inv.date,
      'العميل/المورد': inv.customerName || inv.supplierName,
      'المنتج': item.productName,
      'الكمية': item.quantity,
      'السعر': item.unitPrice,
      'الإجمالي': item.total,
      'المتبقي': inv.remaining,
    }))
  );
  const wsPend = XLSX.utils.json_to_sheet(pendingRows.length > 0 ? pendingRows : [{ 'ملاحظة': 'لا توجد فواتير معلقة' }]);
  XLSX.utils.book_append_sheet(wb, wsPend, 'الفواتير المعلقة');

  // Customers sheet
  const custRows = state.customers.map(c => ({
    'الاسم': c.name,
    'الهاتف': c.phone,
    'العنوان': c.address,
    'الرصيد': c.balance,
  }));
  if (custRows.length > 0) {
    const wsC = XLSX.utils.json_to_sheet(custRows);
    XLSX.utils.book_append_sheet(wb, wsC, 'العملاء');
  }

  XLSX.writeFile(wb, `نسخة_احتياطية_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
