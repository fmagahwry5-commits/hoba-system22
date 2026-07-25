// components/MultiWindowManager.tsx
import { X, Minimize2, Maximize2, Layers } from "lucide-react";
import { Invoice, InvoiceType } from "../types";

// ============================
// ✅ إصلاح 1: position اختيارية
// ============================
export interface WindowInstance {
  id: string;
  type: "invoice" | "maintenance" | "installment";
  invoiceType?: InvoiceType;
  title: string;
  invoice?: Invoice | null;
  isMinimized: boolean;
  isActive: boolean;
  zIndex: number;
  position?: { x: number; y: number }; // ✅ اختيارية لأنها غير مستخدمة
}

// ============================
// Props للـ MultiWindowManager
// ============================
interface Props {
  windows: WindowInstance[];
  activeWindowId: string | null;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onMinimize: (id: string) => void;
  onRestore: (id: string) => void;
}

// ============================
// MultiWindowManager
// ============================
export default function MultiWindowManager({
  windows,
  activeWindowId,
  onActivate,
  onClose,
  onMinimize,
  onRestore,
}: Props) {
  if (windows.length === 0) return null;

  const minimizedWindows = windows.filter((w) => w.isMinimized);
  if (minimizedWindows.length === 0) return null;

  return (
    <>
      {/* شريط النوافذ المصغرة */}
      <div className="fixed bottom-4 right-4 z-[90] flex items-center gap-2">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-2 flex items-center gap-2 flex-wrap max-w-[90vw]">

          {/* عنوان الشريط */}
          <div className="flex items-center gap-1.5 px-2 flex-shrink-0">
            <Layers size={14} className="text-gray-400" />
            <span className="text-xs font-bold text-gray-500">
              {minimizedWindows.length} نافذة مصغرة
            </span>
          </div>

          <div className="w-px h-6 bg-gray-200 flex-shrink-0" />

          {/* ✅ إصلاح 2: استبدال button داخل button بـ div + زر منفصل */}
          {minimizedWindows.map((win) => (
            <div
              key={win.id}
              className="flex items-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-all group"
            >
              {/* زر الاستعادة */}
              <button
                type="button"
                onClick={() => onRestore(win.id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl"
                title={`استعادة: ${win.title}`}
              >
                <Maximize2 size={12} />
                <span className="max-w-[96px] truncate">{win.title}</span>
              </button>

              {/* ✅ زر الإغلاق منفصل (ليس داخل button) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(win.id);
                }}
                className="text-blue-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity pr-2 pl-1 py-2"
                title="إغلاق"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ============================
// ✅ WindowTabs - شريط التبويبات
// ============================
export function WindowTabs({
  windows,
  activeWindowId,
  onActivate,
  onClose,
  onMinimize,
}: {
  windows: WindowInstance[];
  activeWindowId: string | null;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onMinimize: (id: string) => void;
}) {
  // ✅ إصلاح 3: إظهار التبويبات عند وجود نافذة واحدة على الأقل غير مصغرة
  const visibleWindows = windows.filter((w) => !w.isMinimized);
  if (visibleWindows.length === 0) return null;

  const typeColors: Record<string, string> = {
    sale:               "bg-blue-500",
    purchase:           "bg-green-500",
    return_sale:        "bg-orange-500",
    return_purchase:    "bg-purple-500",
    maintenance:        "bg-violet-500",
    accessory_sale:     "bg-amber-500",
    accessory_purchase: "bg-teal-500",
    installment:        "bg-indigo-500",
  };

  return (
    <div className="bg-gray-100 border-b border-gray-200 px-4 py-1 flex items-center gap-1 overflow-x-auto flex-shrink-0 min-h-[38px]">
      <Layers size={14} className="text-gray-400 flex-shrink-0 ml-2" />

      {visibleWindows.map((win) => (
        <div
          key={win.id}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-xs font-semibold cursor-pointer transition-all flex-shrink-0 ${
            win.id === activeWindowId
              ? "bg-white text-gray-800 shadow-sm border-t-2 border-blue-500"
              : "bg-gray-200/60 text-gray-500 hover:bg-gray-200"
          }`}
          onClick={() => onActivate(win.id)}
        >
          {/* مؤشر لون النوع */}
          <div
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              typeColors[win.invoiceType ?? win.type] ?? "bg-gray-400"
            }`}
          />

          {/* عنوان التبويب */}
          <span className="max-w-[128px] truncate">{win.title}</span>

          {/* أزرار التحكم */}
          <div className="flex items-center gap-0.5 mr-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMinimize(win.id);
              }}
              className="text-gray-400 hover:text-yellow-600 p-0.5 rounded transition-colors"
              title="تصغير"
            >
              <Minimize2 size={10} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose(win.id);
              }}
              className="text-gray-400 hover:text-red-600 p-0.5 rounded transition-colors"
              title="إغلاق"
            >
              <X size={10} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}