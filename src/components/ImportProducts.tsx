import { useState, useRef, useCallback } from "react";
import { Product } from "../types";
import {
  importProductsFromExcel,
  generateImportTemplate,
  ImportResult,
} from "../utils/importExcel";
import {
  Upload,
  X,
  Download,
  CheckCircle,
  AlertCircle,
  FileSpreadsheet,
  Loader2,
  Package,
  AlertTriangle,
} from "lucide-react";

interface ImportProductsProps {
  existingProducts: Product[];
  onImport: (newProducts: Product[]) => void;
  onClose: () => void;
}

export default function ImportProducts({
  existingProducts,
  onImport,
  onClose,
}: ImportProductsProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (
        !file.name.endsWith(".xlsx") &&
        !file.name.endsWith(".xls") &&
        !file.name.endsWith(".csv")
      ) {
        setStatus("error");
        setErrorMsg("يرجى اختيار ملف Excel (.xlsx أو .xls) أو CSV");
        return;
      }

      setStatus("loading");
      setErrorMsg("");
      setResult(null);

      try {
        const res = await importProductsFromExcel(file, existingProducts);
        setResult(res);
        setStatus("done");
      } catch (err: any) {
        setStatus("error");
        setErrorMsg(err.message || "خطأ غير متوقع");
      }
    },
    [existingProducts]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleConfirmImport = useCallback(() => {
    if (result && result.products.length > 0) {
      onImport(result.products);
    }
  }, [result, onImport]);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-2 sm:p-4"
      dir="rtl"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              <Upload size={18} className="text-white" />
            </div>
            <div>
              <h2 className="font-black text-white text-base">
                استيراد منتجات من Excel
              </h2>
              <div className="text-white/70 text-xs">
                رفع ملف Excel لإضافة المنتجات دفعة واحدة
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* زر تحميل القالب */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <FileSpreadsheet size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-bold text-blue-800 text-sm">
                  قالب Excel جاهز
                </div>
                <div className="text-blue-600 text-xs mt-1">
                  حمّل القالب واملأه بالمنتجات ثم ارفعه هنا. الأعمدة المطلوبة:
                  اسم المنتج (إجباري)، الباركود، سعر البيع، سعر الشراء،
                  المخزون، الحد الأدنى، الفئة، الموقع، ملاحظات.
                </div>
                <button
                  onClick={generateImportTemplate}
                  className="mt-2 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 active:scale-95 transition-all"
                >
                  <Download size={13} />
                  تحميل قالب Excel
                </button>
              </div>
            </div>
          </div>

          {/* منطقة الرفع */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
              dragOver
                ? "border-indigo-400 bg-indigo-50"
                : status === "loading"
                ? "border-gray-200 bg-gray-50 cursor-wait"
                : "border-gray-200 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50/50"
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileInput}
              className="hidden"
            />

            {status === "loading" ? (
              <>
                <Loader2
                  size={40}
                  className="mx-auto mb-3 text-indigo-500 animate-spin"
                />
                <div className="font-bold text-indigo-700">
                  جاري معالجة الملف...
                </div>
                <div className="text-indigo-400 text-sm mt-1">
                  يرجى الانتظار
                </div>
              </>
            ) : (
              <>
                <Upload
                  size={40}
                  className={`mx-auto mb-3 ${dragOver ? "text-indigo-500" : "text-gray-300"}`}
                />
                <div className="font-bold text-gray-600">
                  اسحب ملف Excel هنا أو اضغط للاختيار
                </div>
                <div className="text-gray-400 text-sm mt-1">
                  يدعم .xlsx و .xls و .csv
                </div>
              </>
            )}
          </div>

          {/* خطأ */}
          {status === "error" && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-red-700 text-sm">
                  خطأ في الاستيراد
                </div>
                <div className="text-red-600 text-xs mt-1">{errorMsg}</div>
              </div>
            </div>
          )}

          {/* النتيجة */}
          {status === "done" && result && (
            <>
              {/* إحصائيات */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                  <CheckCircle size={18} className="mx-auto text-emerald-500 mb-1" />
                  <div className="text-2xl font-black text-emerald-700">
                    {result.success}
                  </div>
                  <div className="text-xs text-emerald-600 font-bold">
                    جاهز للإضافة
                  </div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                  <AlertTriangle size={18} className="mx-auto text-amber-500 mb-1" />
                  <div className="text-2xl font-black text-amber-700">
                    {result.duplicates}
                  </div>
                  <div className="text-xs text-amber-600 font-bold">مكرر</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                  <AlertCircle size={18} className="mx-auto text-red-500 mb-1" />
                  <div className="text-2xl font-black text-red-700">
                    {result.failed}
                  </div>
                  <div className="text-xs text-red-600 font-bold">فشل</div>
                </div>
              </div>

              {/* تفاصيل الأخطاء */}
              {result.errors.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 max-h-40 overflow-y-auto">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={14} className="text-amber-600" />
                    <span className="text-xs font-bold text-amber-800">
                      تفاصيل ({result.errors.length})
                    </span>
                  </div>
                  <div className="space-y-1">
                    {result.errors.map((err, idx) => (
                      <div key={idx} className="text-xs text-amber-700 flex items-start gap-1.5">
                        <span className="text-amber-400 flex-shrink-0">•</span>
                        <span>{err}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* معاينة المنتجات */}
              {result.products.length > 0 && (
                <div className="border border-gray-200 rounded-2xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                    <span className="text-sm font-black text-gray-700">
                      معاينة المنتجات ({result.products.length})
                    </span>
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 sticky top-0">
                          <th className="text-right px-3 py-2 font-bold text-gray-500 text-xs">
                            الاسم
                          </th>
                          <th className="text-right px-3 py-2 font-bold text-gray-500 text-xs">
                            الباركود
                          </th>
                          <th className="text-right px-3 py-2 font-bold text-gray-500 text-xs">
                            سعر البيع
                          </th>
                          <th className="text-right px-3 py-2 font-bold text-gray-500 text-xs">
                            المخزون
                          </th>
                          <th className="text-right px-3 py-2 font-bold text-gray-500 text-xs">
                            الفئة
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {result.products.slice(0, 50).map((p) => (
                          <tr key={p.id} className="hover:bg-gray-50/50">
                            <td className="px-3 py-2 font-bold text-gray-800">
                              {p.name}
                            </td>
                            <td className="px-3 py-2 text-gray-500 font-mono text-xs">
                              {p.barcode || "-"}
                            </td>
                            <td className="px-3 py-2 text-gray-700">
                              {(p.sellingPrice ?? 0).toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-gray-700">
                              {p.stock ?? 0}
                            </td>
                            <td className="px-3 py-2 text-gray-500">
                              {p.category || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {result.products.length > 50 && (
                      <div className="px-4 py-2 text-center text-xs text-gray-400 bg-gray-50">
                        يعرض أول 50 منتج من {result.products.length}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-100 px-5 py-3 bg-gray-50 flex gap-2 items-center">
          {status === "done" && result && result.products.length > 0 && (
            <button
              onClick={handleConfirmImport}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-black text-sm hover:bg-emerald-700 active:scale-95 transition-all shadow-md shadow-emerald-200"
            >
              <Package size={15} />
              إضافة {result.products.length} منتج للمخزن
            </button>
          )}

          {status === "done" && (
            <button
              onClick={() => {
                setStatus("idle");
                setResult(null);
                setErrorMsg("");
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 active:scale-95 transition-all"
            >
              <Upload size={13} />
              رفع ملف آخر
            </button>
          )}

          <div className="flex-1" />

          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-100 active:scale-95 transition-all"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}