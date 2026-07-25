// src/components/PrintInvoice.tsx
import { useRef, useCallback, useMemo, useState } from "react";
import { Invoice } from "../types";
import { Printer, X, Download, Settings, Eye } from "lucide-react";

interface PrintSettings {
  showLogo: boolean;
  showShopInfo: boolean;
  showBarcode: boolean;
  showNotes: boolean;
  showFooter: boolean;
  paperSize: "thermal" | "a4" | "a5";
  fontSize: "small" | "medium" | "large";
}

interface Props {
  invoice: Invoice;
  shopSettings?: {
    shopName?: string;
    shopPhone?: string;
    shopAddress?: string;
    taxNumber?: string;
    currency?: string;
    receiptFooter?: string;
    logo?: string;
  };
  onClose: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  sale: "فاتورة بيع",
  purchase: "فاتورة شراء",
  return_sale: "مرتجع بيع",
  return_purchase: "مرتجع شراء",
  maintenance: "فاتورة صيانة",
  accessory_sale: "فاتورة اكسسوار",
  accessory_purchase: "شراء اكسسوار",
};

// ✅ زر الطباعة السريع
export function QuickPrintButton({
  invoice, shopSettings, size = "sm",
}: {
  invoice: Invoice;
  shopSettings?: Props["shopSettings"];
  size?: "sm" | "md" | "lg";
}) {
  const [showPrint, setShowPrint] = useState(false);

  const sizeClasses = {
    sm: "p-1.5 rounded-lg",
    md: "p-2 rounded-xl",
    lg: "px-3 py-2 rounded-xl",
  };

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setShowPrint(true); }}
        className={`${sizeClasses[size]} bg-gray-50 text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-colors`}
        title="طباعة الفاتورة"
      >
        <Printer size={size === "sm" ? 13 : size === "md" ? 15 : 16} />
        {size === "lg" && <span className="text-xs font-bold mr-1">طباعة</span>}
      </button>

      {showPrint && (
        <PrintInvoice
          invoice={invoice}
          shopSettings={shopSettings}
          onClose={() => setShowPrint(false)}
        />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// ✅ المكون الرئيسي
// ═══════════════════════════════════════════════════════════════
export default function PrintInvoice({ invoice, shopSettings, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState<PrintSettings>(() => {
    try {
      const saved = localStorage.getItem("printSettings");
      return saved ? JSON.parse(saved) : {
        showLogo: true,
        showShopInfo: true,
        showBarcode: true,
        showNotes: true,
        showFooter: true,
        paperSize: "thermal",
        fontSize: "medium",
      };
    } catch {
      return {
        showLogo: true, showShopInfo: true, showBarcode: true,
        showNotes: true, showFooter: true, paperSize: "thermal", fontSize: "medium",
      };
    }
  });
  const [showSettings, setShowSettings] = useState(false);

  const currency = shopSettings?.currency || "EGP";
  const typeLabel = TYPE_LABELS[invoice.type] || "فاتورة";

  // ✅ حساب المجموع
  const subtotal = useMemo(() =>
    (invoice.items || []).reduce((s, item) => s + (item.quantity ?? 0) * (item.price ?? 0), 0),
    [invoice.items]
  );

  const discount = invoice.discount ?? 0;
  const tax = invoice.tax ?? 0;

  // ✅ حجم الورقة
  const paperWidth = settings.paperSize === "thermal" ? "280px" :
                     settings.paperSize === "a5" ? "500px" : "700px";

  const fontClass = settings.fontSize === "small" ? "text-xs" :
                    settings.fontSize === "large" ? "text-base" : "text-sm";

  // ✅ الطباعة
  const handlePrint = useCallback(() => {
    try {
      localStorage.setItem("printSettings", JSON.stringify(settings));
    } catch {}

    const content = printRef.current;
    if (!content) return;

    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) {
      alert("يرجى السماح بالنوافذ المنبثقة للطباعة");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>${typeLabel} - ${invoice.number || ""}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', 'Cairo', 'Tajawal', system-ui, sans-serif;
            direction: rtl;
            padding: 10px;
            max-width: ${paperWidth};
            margin: 0 auto;
            color: #1a1a1a;
          }
          .header { text-align: center; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 2px dashed #ccc; }
          .shop-name { font-size: 18px; font-weight: 900; margin-bottom: 4px; }
          .shop-info { font-size: 11px; color: #666; line-height: 1.6; }
          .invoice-type {
            font-size: 16px; font-weight: 900; text-align: center;
            padding: 8px; margin: 10px 0; background: #f5f5f5;
            border-radius: 8px; border: 1px solid #e0e0e0;
          }
          .info-grid {
            display: grid; grid-template-columns: 1fr 1fr;
            gap: 4px 12px; margin: 10px 0; font-size: 12px;
          }
          .info-item { display: flex; gap: 4px; }
          .info-label { font-weight: 700; color: #666; min-width: 60px; }
          .info-value { font-weight: 600; color: #333; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          th {
            background: #f0f0f0; padding: 6px 8px; font-size: 11px;
            font-weight: 700; text-align: right; border-bottom: 2px solid #ddd;
          }
          td {
            padding: 5px 8px; font-size: 12px; border-bottom: 1px solid #eee;
          }
          .totals {
            margin: 10px 0; padding: 10px;
            background: #f9f9f9; border-radius: 8px; border: 1px solid #e5e5e5;
          }
          .total-row {
            display: flex; justify-content: space-between;
            padding: 3px 0; font-size: 12px;
          }
          .total-row.grand {
            font-size: 16px; font-weight: 900;
            padding-top: 8px; margin-top: 6px;
            border-top: 2px solid #333;
          }
          .payment-info {
            margin: 10px 0; padding: 8px;
            border: 2px solid #333; border-radius: 8px;
          }
          .payment-row {
            display: flex; justify-content: space-between;
            padding: 3px 0; font-size: 13px; font-weight: 700;
          }
          .remaining { color: #dc2626; }
          .paid { color: #16a34a; }
          .notes {
            margin: 10px 0; padding: 8px;
            background: #fffbeb; border: 1px solid #fde68a;
            border-radius: 6px; font-size: 11px; color: #92400e;
          }
          .footer {
            text-align: center; margin-top: 15px;
            padding-top: 10px; border-top: 2px dashed #ccc;
            font-size: 10px; color: #999;
          }
          .maintenance-info {
            margin: 10px 0; padding: 10px;
            background: #f5f3ff; border: 1px solid #ddd6fe;
            border-radius: 8px; font-size: 12px;
          }
          .maintenance-info .row { display: flex; gap: 4px; padding: 2px 0; }
          .maintenance-info .label { font-weight: 700; color: #6d28d9; min-width: 80px; }
          @media print {
            body { padding: 0; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        ${content.innerHTML}
        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); window.close(); }, 300);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  }, [invoice, settings, typeLabel, paperWidth]);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4"
      dir="rtl"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* ── الهيدر ── */}
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center">
              <Printer size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-white font-black">معاينة وطباعة</h2>
              <p className="text-gray-400 text-xs">
                {typeLabel} — {invoice.number || ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-xl transition-colors ${
                showSettings ? "bg-white/25 text-white" : "bg-white/10 text-white/60 hover:text-white hover:bg-white/20"
              }`}
              title="إعدادات الطباعة"
            >
              <Settings size={16} />
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-black hover:bg-blue-700 active:scale-95 shadow-lg transition-all"
            >
              <Printer size={15} />
              طباعة
            </button>
            <button
              onClick={onClose}
              className="text-white/50 hover:text-white p-2 rounded-xl hover:bg-white/10"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── إعدادات الطباعة ── */}
        {showSettings && (
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex-shrink-0">
            <div className="flex flex-wrap gap-4 items-center">
              <label className="flex items-center gap-2 text-xs font-bold text-gray-600 cursor-pointer">
                <input type="checkbox" checked={settings.showShopInfo}
                  onChange={e => setSettings(s => ({ ...s, showShopInfo: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                بيانات المحل
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-gray-600 cursor-pointer">
                <input type="checkbox" checked={settings.showNotes}
                  onChange={e => setSettings(s => ({ ...s, showNotes: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                الملاحظات
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-gray-600 cursor-pointer">
                <input type="checkbox" checked={settings.showFooter}
                  onChange={e => setSettings(s => ({ ...s, showFooter: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                التذييل
              </label>

              <div className="flex items-center gap-2 mr-auto">
                <span className="text-xs font-bold text-gray-500">الحجم:</span>
                {(["thermal", "a5", "a4"] as const).map(size => (
                  <button key={size}
                    onClick={() => setSettings(s => ({ ...s, paperSize: size }))}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      settings.paperSize === size
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                    }`}
                  >
                    {size === "thermal" ? "حراري" : size.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── محتوى الفاتورة ── */}
        <div className="flex-1 overflow-y-auto p-5 bg-gray-100">
          <div
            className="bg-white mx-auto shadow-lg rounded-lg overflow-hidden"
            style={{ maxWidth: paperWidth === "280px" ? "350px" : paperWidth === "500px" ? "550px" : "750px" }}
          >
            <div ref={printRef} className={`p-5 ${fontClass}`} style={{ direction: "rtl" }}>

              {/* بيانات المحل */}
              {settings.showShopInfo && shopSettings?.shopName && (
                <div className="header" style={{ textAlign: "center", marginBottom: 12, paddingBottom: 10, borderBottom: "2px dashed #ccc" }}>
                  <div className="shop-name" style={{ fontSize: 18, fontWeight: 900, marginBottom: 4 }}>
                    {shopSettings.shopName}
                  </div>
                  {shopSettings.shopAddress && (
                    <div style={{ fontSize: 11, color: "#666" }}>{shopSettings.shopAddress}</div>
                  )}
                  {shopSettings.shopPhone && (
                    <div style={{ fontSize: 11, color: "#666" }}>📞 {shopSettings.shopPhone}</div>
                  )}
                  {shopSettings.taxNumber && (
                    <div style={{ fontSize: 10, color: "#999" }}>الرقم الضريبي: {shopSettings.taxNumber}</div>
                  )}
                </div>
              )}

              {/* نوع الفاتورة */}
              <div style={{
                fontSize: 16, fontWeight: 900, textAlign: "center",
                padding: 8, margin: "10px 0", background: "#f5f5f5",
                borderRadius: 8, border: "1px solid #e0e0e0",
              }}>
                {typeLabel}
              </div>

              {/* معلومات الفاتورة */}
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr",
                gap: "4px 16px", margin: "10px 0", fontSize: 12
              }}>
                <div style={{ display: "flex", gap: 4 }}>
                  <span style={{ fontWeight: 700, color: "#666", minWidth: 70 }}>رقم الفاتورة:</span>
                  <span style={{ fontWeight: 600, color: "#333" }}>{invoice.number || "-"}</span>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <span style={{ fontWeight: 700, color: "#666", minWidth: 70 }}>التاريخ:</span>
                  <span style={{ fontWeight: 600, color: "#333" }}>{invoice.date || "-"}</span>
                </div>

                {(invoice.customerName || invoice.supplierName) && (
                  <div style={{ display: "flex", gap: 4 }}>
                    <span style={{ fontWeight: 700, color: "#666", minWidth: 70 }}>
                      {["sale", "return_sale", "maintenance", "accessory_sale"].includes(invoice.type) ? "العميل:" : "المورد:"}
                    </span>
                    <span style={{ fontWeight: 600, color: "#333" }}>
                      {invoice.customerName || invoice.supplierName || "-"}
                    </span>
                  </div>
                )}

                {(invoice.customerPhone || invoice.supplierPhone) && (
                  <div style={{ display: "flex", gap: 4 }}>
                    <span style={{ fontWeight: 700, color: "#666", minWidth: 70 }}>الهاتف:</span>
                    <span style={{ fontWeight: 600, color: "#333" }}>
                      {invoice.customerPhone || invoice.supplierPhone}
                    </span>
                  </div>
                )}

                {invoice.time && (
                  <div style={{ display: "flex", gap: 4 }}>
                    <span style={{ fontWeight: 700, color: "#666", minWidth: 70 }}>الوقت:</span>
                    <span style={{ fontWeight: 600, color: "#333" }}>{invoice.time}</span>
                  </div>
                )}
              </div>

              {/* معلومات الصيانة */}
              {invoice.type === "maintenance" && invoice.maintenanceInfo && (
                <div style={{
                  margin: "10px 0", padding: 10,
                  background: "#f5f3ff", border: "1px solid #ddd6fe",
                  borderRadius: 8, fontSize: 12,
                }}>
                  <div style={{ fontWeight: 900, color: "#6d28d9", marginBottom: 6, fontSize: 13 }}>
                    🔧 بيانات الصيانة
                  </div>
                  {[
                    { label: "الجهاز", value: `${invoice.maintenanceInfo.deviceBrand || ""} ${invoice.maintenanceInfo.deviceModel || ""}`.trim() },
                    { label: "IMEI", value: invoice.maintenanceInfo.imei },
                    { label: "العطل", value: invoice.maintenanceInfo.issue },
                    { label: "الحالة", value: invoice.maintenanceInfo.maintenanceStatus === "ready" ? "✅ جاهز" : invoice.maintenanceInfo.maintenanceStatus === "in_progress" ? "🔄 قيد العمل" : invoice.maintenanceInfo.maintenanceStatus },
                    { label: "التكلفة", value: invoice.maintenanceInfo.cost ? `${invoice.maintenanceInfo.cost.toLocaleString()} ${currency}` : undefined },
                  ].filter(r => r.value).map(r => (
                    <div key={r.label} style={{ display: "flex", gap: 4, padding: "2px 0" }}>
                      <span style={{ fontWeight: 700, color: "#6d28d9", minWidth: 60 }}>{r.label}:</span>
                      <span style={{ color: "#333" }}>{r.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* جدول الأصناف */}
              {invoice.items && invoice.items.length > 0 && (
                <table style={{ width: "100%", borderCollapse: "collapse", margin: "10px 0" }}>
                  <thead>
                    <tr>
                      <th style={{ background: "#f0f0f0", padding: "6px 8px", fontSize: 11, fontWeight: 700, textAlign: "right", borderBottom: "2px solid #ddd" }}>#</th>
                      <th style={{ background: "#f0f0f0", padding: "6px 8px", fontSize: 11, fontWeight: 700, textAlign: "right", borderBottom: "2px solid #ddd" }}>الصنف</th>
                      <th style={{ background: "#f0f0f0", padding: "6px 8px", fontSize: 11, fontWeight: 700, textAlign: "center", borderBottom: "2px solid #ddd" }}>الكمية</th>
                      <th style={{ background: "#f0f0f0", padding: "6px 8px", fontSize: 11, fontWeight: 700, textAlign: "center", borderBottom: "2px solid #ddd" }}>السعر</th>
                      <th style={{ background: "#f0f0f0", padding: "6px 8px", fontSize: 11, fontWeight: 700, textAlign: "center", borderBottom: "2px solid #ddd" }}>الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: "5px 8px", fontSize: 12, borderBottom: "1px solid #eee", color: "#999" }}>{idx + 1}</td>
                        <td style={{ padding: "5px 8px", fontSize: 12, borderBottom: "1px solid #eee", fontWeight: 600 }}>{item.productName || "-"}</td>
                        <td style={{ padding: "5px 8px", fontSize: 12, borderBottom: "1px solid #eee", textAlign: "center" }}>{item.quantity || 0}</td>
                        <td style={{ padding: "5px 8px", fontSize: 12, borderBottom: "1px solid #eee", textAlign: "center" }}>{(item.price ?? 0).toLocaleString()}</td>
                        <td style={{ padding: "5px 8px", fontSize: 12, borderBottom: "1px solid #eee", textAlign: "center", fontWeight: 700 }}>
                          {((item.quantity ?? 0) * (item.price ?? 0)).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* المجاميع */}
              <div style={{
                margin: "10px 0", padding: 10,
                background: "#f9f9f9", borderRadius: 8, border: "1px solid #e5e5e5",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 12 }}>
                  <span>المجموع الفرعي:</span>
                  <span style={{ fontWeight: 600 }}>{subtotal.toLocaleString()} {currency}</span>
                </div>

                {discount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 12, color: "#dc2626" }}>
                    <span>الخصم:</span>
                    <span style={{ fontWeight: 600 }}>-{discount.toLocaleString()} {currency}</span>
                  </div>
                )}

                {tax > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 12 }}>
                    <span>الضريبة:</span>
                    <span style={{ fontWeight: 600 }}>{tax.toLocaleString()} {currency}</span>
                  </div>
                )}

                <div style={{
                  display: "flex", justifyContent: "space-between",
                  fontSize: 16, fontWeight: 900,
                  paddingTop: 8, marginTop: 6, borderTop: "2px solid #333",
                }}>
                  <span>الإجمالي:</span>
                  <span>{(invoice.total ?? 0).toLocaleString()} {currency}</span>
                </div>
              </div>

              {/* الدفع */}
              <div style={{
                margin: "10px 0", padding: 8,
                border: "2px solid #333", borderRadius: 8,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 13, fontWeight: 700 }}>
                  <span>المدفوع:</span>
                  <span style={{ color: "#16a34a" }}>{(invoice.paid ?? 0).toLocaleString()} {currency}</span>
                </div>
                {(invoice.remaining ?? 0) > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 13, fontWeight: 700 }}>
                    <span>المتبقي:</span>
                    <span style={{ color: "#dc2626" }}>{(invoice.remaining ?? 0).toLocaleString()} {currency}</span>
                  </div>
                )}
                {invoice.paymentMethod && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 11, color: "#666" }}>
                    <span>طريقة الدفع:</span>
                    <span>{invoice.paymentMethod === "cash" ? "نقدي" : invoice.paymentMethod === "card" ? "بطاقة" : invoice.paymentMethod}</span>
                  </div>
                )}
              </div>

              {/* الملاحظات */}
              {settings.showNotes && invoice.notes && (
                <div style={{
                  margin: "10px 0", padding: 8,
                  background: "#fffbeb", border: "1px solid #fde68a",
                  borderRadius: 6, fontSize: 11, color: "#92400e",
                }}>
                  <strong>ملاحظات: </strong>{invoice.notes}
                </div>
              )}

              {/* التذييل */}
              {settings.showFooter && (
                <div style={{
                  textAlign: "center", marginTop: 15,
                  paddingTop: 10, borderTop: "2px dashed #ccc",
                  fontSize: 10, color: "#999",
                }}>
                  {shopSettings?.receiptFooter || "شكراً لتعاملكم معنا"}
                  <div style={{ marginTop: 4 }}>
                    {new Date().toLocaleString("ar-EG")}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── أزرار الفوتر ── */}
        <div className="flex items-center justify-between px-5 py-4 bg-gray-50 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-gray-200 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-300 transition-colors"
          >
            إغلاق
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-black hover:bg-blue-700 active:scale-95 shadow-lg shadow-blue-200 transition-all"
          >
            <Printer size={16} />
            طباعة الآن
          </button>
        </div>
      </div>
    </div>
  );
}