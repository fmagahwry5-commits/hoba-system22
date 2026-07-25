// ExportCenter.tsx - مركز تصدير البيانات الشامل
import { useState, useCallback } from "react";
import {
  Download, FileSpreadsheet, FileText, FileDown,
  X, Wallet, Package, ShoppingCart, DollarSign,
  Wrench, TrendingUp, TrendingDown, Users, Archive,
  Calendar, CheckCircle2, ChevronDown, Filter
} from "lucide-react";
import { AppState, Invoice, Product } from "./types";

interface Props {
  state: AppState;
  currency: string;
  onClose: () => void;
}

type ExportSection = "all" | "treasury" | "products" | "invoices" | "installments" | "customers" | "stock_movements" | "shifts";

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob(["\ufeff" + content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function ExportCenter({ state, currency, onClose }: Props) {
  const [selectedSections, setSelectedSections] = useState<Set<ExportSection>>(new Set(["all"]));
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exportFormat, setExportFormat] = useState<"csv" | "json" | "excel">("csv");
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);

  const sections: { id: ExportSection; label: string; icon: any; color: string; count: number; desc: string }[] = [
    { id: "all", label: "تصدير شامل", icon: Archive, color: "text-purple-600", count: 0, desc: "كل البيانات في ملف واحد" },
    { id: "treasury", label: "حركات الخزنة", icon: Wallet, color: "text-emerald-600", count: state?.treasury?.entries?.length ?? 0, desc: "جميع حركات الإيداع والسحب" },
    { id: "products", label: "المنتجات والمخزون", icon: Package, color: "text-blue-600", count: state?.products?.length ?? 0, desc: "بيانات المنتجات والأسعار والمخزون" },
    { id: "invoices", label: "الفواتير", icon: ShoppingCart, color: "text-indigo-600", count: state?.invoices?.length ?? 0, desc: "جميع الفواتير بكل أنواعها" },
    { id: "installments", label: "الأقساط", icon: DollarSign, color: "text-violet-600", count: state?.installmentsLedger?.payments?.length ?? 0, desc: "سجل دفعات الأقساط" },
    { id: "customers", label: "العملاء والموردين", icon: Users, color: "text-sky-600", count: (state?.customers?.length ?? 0) + (state?.suppliers?.length ?? 0), desc: "بيانات العملاء والموردين" },
    { id: "stock_movements", label: "حركات المخزون", icon: TrendingUp, color: "text-amber-600", count: (state as any)?.stockMovements?.length ?? 0, desc: "التوريد والصرف" },
    { id: "shifts", label: "أرشيف الورديات", icon: Calendar, color: "text-pink-600", count: state?.shiftArchives?.length ?? 0, desc: "ورديات مغلقة سابقة" },
  ];

  const toggleSection = (id: ExportSection) => {
    setSelectedSections(prev => {
      const n = new Set(prev);
      if (id === "all") { n.clear(); n.add("all"); return n; }
      n.delete("all");
      if (n.has(id)) n.delete(id); else n.add(id);
      if (n.size === 0) n.add("all");
      return n;
    });
  };

  const filterByDate = <T extends { date?: string }>(items: T[]): T[] => {
    if (!dateFrom && !dateTo) return items;
    return items.filter(item => {
      const d = item.date ?? "";
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });
  };

  const exportData = useCallback(() => {
    setExporting(true);
    const isAll = selectedSections.has("all");
    const date = new Date().toISOString().slice(0, 10);

    try {
      if (exportFormat === "json") {
        const data: any = { exportDate: new Date().toISOString(), currency, shopName: state?.settings?.shopName };

        if (isAll || selectedSections.has("treasury")) data.treasury = { balance: state?.treasury?.balance ?? 0, entries: filterByDate(state?.treasury?.entries ?? []) };
        if (isAll || selectedSections.has("products")) data.products = state?.products ?? [];
        if (isAll || selectedSections.has("invoices")) data.invoices = filterByDate(state?.invoices ?? []);
        if (isAll || selectedSections.has("installments")) data.installments = filterByDate(state?.installmentsLedger?.payments ?? []);
        if (isAll || selectedSections.has("customers")) { data.customers = state?.customers ?? []; data.suppliers = state?.suppliers ?? []; }
        if (isAll || selectedSections.has("stock_movements")) data.stockMovements = filterByDate((state as any)?.stockMovements ?? []);
        if (isAll || selectedSections.has("shifts")) data.shiftArchives = state?.shiftArchives ?? [];

        downloadFile(JSON.stringify(data, null, 2), `export_${date}.json`, "application/json");
      } else {
        // CSV exports - ملف لكل قسم
        if (isAll || selectedSections.has("treasury")) {
          const entries = filterByDate(state?.treasury?.entries ?? []);
          const csv = ["التاريخ,الوقت,النوع,الاتجاه,المبلغ,الوصف,رقم الفاتورة,الرصيد بعد",
            ...entries.map(e => `"${e.date ?? ""}","${e.time ?? ""}","${e.type ?? ""}","${e.direction === "in" ? "إيداع" : "سحب"}",${e.amount ?? 0},"${e.description ?? ""}","${e.invoiceNumber ?? ""}",${e.balanceAfter ?? 0}`)
          ].join("\n");
          downloadFile(csv, `treasury_${date}.csv`, "text/csv;charset=utf-8;");
        }

        if (isAll || selectedSections.has("products")) {
          const csv = ["الاسم,الباركود,الفئة,المخزون,سعر الشراء,سعر البيع,الحد الأدنى,الحد الأقصى,الوحدة",
            ...(state?.products ?? []).map(p => `"${p.name}","${p.barcode ?? ""}","${p.category ?? ""}",${p.stock ?? 0},${p.purchasePrice ?? 0},${p.sellingPrice ?? 0},${(p as any).minStock ?? 5},${(p as any).maxStock ?? 100},"${(p as any).unit ?? "قطعة"}"`)
          ].join("\n");
          downloadFile(csv, `products_${date}.csv`, "text/csv;charset=utf-8;");
        }

        if (isAll || selectedSections.has("invoices")) {
          const invs = filterByDate(state?.invoices ?? []);
          const typeLabels: Record<string, string> = { sale: "بيع", purchase: "شراء", return_sale: "مرتجع بيع", return_purchase: "مرتجع شراء", maintenance: "صيانة", accessory_sale: "اكسسوار بيع", accessory_purchase: "اكسسوار شراء" };
          const csv = ["الرقم,النوع,التاريخ,العميل/المورد,الهاتف,الإجمالي,المدفوع,المتبقي,الحالة,ملاحظات",
            ...invs.map(i => `"${i.number}","${typeLabels[i.type] ?? i.type}","${i.date}","${i.customerName || i.supplierName || ""}","${i.customerPhone || i.supplierPhone || ""}",${i.total ?? 0},${i.paid ?? 0},${i.remaining ?? 0},"${i.status}","${i.notes ?? ""}"`)
          ].join("\n");
          downloadFile(csv, `invoices_${date}.csv`, "text/csv;charset=utf-8;");
        }

        if (isAll || selectedSections.has("installments")) {
          const payments = filterByDate(state?.installmentsLedger?.payments ?? []);
          const csv = ["التاريخ,الوقت,اسم العميل,الهاتف,المبلغ,رقم الفاتورة,ملاحظات",
            ...payments.map(p => `"${p.date ?? ""}","${p.time ?? ""}","${p.customerName}","${p.customerPhone ?? ""}",${p.amount},"${p.invoiceRef ?? ""}","${p.notes ?? ""}"`)
          ].join("\n");
          downloadFile(csv, `installments_${date}.csv`, "text/csv;charset=utf-8;");
        }

        if (isAll || selectedSections.has("customers")) {
          const csv1 = ["الاسم,الهاتف,العنوان,الرصيد",
            ...(state?.customers ?? []).map(c => `"${c.name}","${c.phone ?? ""}","${c.address ?? ""}",${c.balance ?? 0}`)
          ].join("\n");
          downloadFile(csv1, `customers_${date}.csv`, "text/csv;charset=utf-8;");

          const csv2 = ["الاسم,الهاتف,العنوان,الرصيد",
            ...(state?.suppliers ?? []).map(s => `"${s.name}","${s.phone ?? ""}","${s.address ?? ""}",${s.balance ?? 0}`)
          ].join("\n");
          downloadFile(csv2, `suppliers_${date}.csv`, "text/csv;charset=utf-8;");
        }

        if (isAll || selectedSections.has("stock_movements")) {
          const mvs = filterByDate((state as any)?.stockMovements ?? []);
          const csv = ["التاريخ,النوع,المنتج,الكمية,السبب,ملاحظات",
            ...mvs.map((m: any) => `"${m.date ?? ""}","${m.type === "in" ? "توريد" : "صرف"}","${m.productName ?? ""}",${m.quantity ?? 0},"${m.reason ?? ""}","${m.notes ?? ""}"`)
          ].join("\n");
          downloadFile(csv, `stock_movements_${date}.csv`, "text/csv;charset=utf-8;");
        }
      }

      setExportDone(true);
      setTimeout(() => setExportDone(false), 3000);
    } catch (err) {
      alert("خطأ في التصدير: " + (err as Error).message);
    } finally {
      setExporting(false);
    }
  }, [state, selectedSections, dateFrom, dateTo, exportFormat, currency]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" dir="rtl" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 px-5 py-4 text-white flex items-center justify-between flex-shrink-0">
          <h3 className="font-black flex items-center gap-2 text-lg"><Download size={20} /> مركز التصدير الشامل</h3>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* صيغة التصدير */}
          <div>
            <label className="text-sm font-bold text-gray-700 mb-2 block">صيغة التصدير:</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "csv" as const, label: "CSV", desc: "جدول بيانات", icon: FileSpreadsheet, color: "emerald" },
                { id: "json" as const, label: "JSON", desc: "بيانات كاملة", icon: FileText, color: "blue" },
                { id: "excel" as const, label: "Excel", desc: "ملف XLS", icon: FileDown, color: "purple" },
              ].map(f => (
                <button key={f.id} onClick={() => setExportFormat(f.id)}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${exportFormat === f.id ? `border-${f.color}-400 bg-${f.color}-50 shadow-md` : "border-gray-200 hover:border-gray-300"}`}>
                  <f.icon size={20} className={`mx-auto mb-1 text-${f.color}-600`} />
                  <div className="text-sm font-bold">{f.label}</div>
                  <div className="text-[10px] text-gray-400">{f.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* فلتر التاريخ */}
          <div className="p-3 bg-gray-50 rounded-xl border">
            <div className="flex items-center gap-2 mb-2">
              <Filter size={14} className="text-gray-500" />
              <span className="text-sm font-bold text-gray-700">فلترة بالتاريخ (اختياري):</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-gray-500 mb-1 block">من</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm outline-none" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">إلى</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm outline-none" /></div>
            </div>
          </div>

          {/* اختيار الأقسام */}
          <div>
            <label className="text-sm font-bold text-gray-700 mb-2 block">اختر البيانات المراد تصديرها:</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {sections.map(sec => (
                <button key={sec.id} onClick={() => toggleSection(sec.id)}
                  className={`flex items-start gap-3 p-3 rounded-xl border-2 text-right transition-all ${selectedSections.has(sec.id) ? "border-purple-400 bg-purple-50 shadow-sm" : "border-gray-200 hover:border-gray-300"}`}>
                  <div className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${selectedSections.has(sec.id) ? "border-purple-500 bg-purple-500" : "border-gray-300"}`}>
                    {selectedSections.has(sec.id) && <CheckCircle2 size={14} className="text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <sec.icon size={14} className={sec.color} />
                      <span className="font-bold text-gray-800 text-sm">{sec.label}</span>
                      {sec.count > 0 && <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded-full text-gray-600 font-bold">{sec.count}</span>}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{sec.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t bg-gray-50 flex gap-3 flex-shrink-0">
          <button onClick={exportData} disabled={exporting}
            className={`flex-1 py-3 rounded-xl font-black text-base active:scale-95 shadow-md transition-all ${exportDone ? "bg-emerald-600 text-white" : "bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:opacity-90"} disabled:opacity-50`}>
            {exportDone ? "✅ تم التصدير بنجاح!" : exporting ? "⏳ جاري التصدير..." : `📥 تصدير ${exportFormat.toUpperCase()}`}
          </button>
          <button onClick={onClose} className="px-5 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200">إغلاق</button>
        </div>
      </div>
    </div>
  );
}