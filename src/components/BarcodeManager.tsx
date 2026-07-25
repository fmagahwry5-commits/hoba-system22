// BarcodeManager.tsx - النسخة النهائية الكاملة مع QR + تنسيق الباركود
import { useState, useMemo, useEffect, useCallback } from "react";
import { Product } from "../types";
import {
  Smartphone, Search, LayoutTemplate, SlidersHorizontal,
  Eye, Printer, Edit3, X, Check, RefreshCw,
  Plus, Minus, Save, Move, ZoomIn, ZoomOut, Monitor,
  QrCode, Link as LinkIcon,
} from "lucide-react";
import QRCode from "qrcode";

// ═══════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════
interface Props {
  products: Product[];
  onUpdate: (products: Product[]) => void;
}

interface LabelField {
  id:
    | "shopName" | "shopPhone" | "productName"
    | "storage" | "battery" | "ram" | "condition"
    | "price" | "barcode" | "extra1" | "extra2";
  label: string;
  value: string;
  enabled: boolean;
  fontSize: number;
  fontWeight: number;
}

interface BarcodeOffset {
  x: number;
  y: number;
  scale: number;
}

interface PrintSettings {
  templateId: string;
  labelWidth: number;
  labelHeight: number;
  barcodeWidth: number;
  barcodeHeight: number;
  columns: number;
  rows: number;
  paddingTop: number;
  paddingBottom: number;
  paddingLeft: number;
  paddingRight: number;
  borderRadius: number;
  borderWidth: number;
  defaultShopName: string;
  defaultShopPhone: string;
  barcodeStyle: "bars" | "slim" | "dots";
  barcodeOffset: BarcodeOffset;
  printerName: string;
  dpi: number;
  copies: number;
  orientation: "portrait" | "landscape";
  pageOffsetX: number;
  pageOffsetY: number;
  printScale: number;
  gapX: number;
  gapY: number;
  // QR
  qrEnabled: boolean;
  qrBaseUrl: string;
  qrSize: number;
  qrIncludeBarcode: boolean;
  qrPosition: "top-left" | "top-right" | "top-center"
            | "middle-left" | "middle-right"
            | "bottom-left" | "bottom-right" | "bottom-center"
            | "inline-barcode";
  qrOffsetX: number;
  qrOffsetY: number;
  qrMargin: number;
  qrShowLabel: boolean;
  qrLabelText: string;
  qrLabelFontSize: number;
  // Barcode style
  barcodeColor: string;
  barcodeBgColor: string;
  barcodeBarWidth: number;
  barcodeBarGap: number;
  barcodeShowBorder: boolean;
  barcodeBorderColor: string;
  barcodeBorderWidth: number;
  barcodePadding: number;
  barcodeRotation: 0 | 90 | 180 | 270;
}

interface ProductMeta {
  fields: Partial<Record<LabelField["id"], Partial<LabelField>>>;
  barcodeValue: string;
  barcodeOffset?: BarcodeOffset;
  qrCustomUrl?: string;
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
const STORAGE_KEYS = {
  settings: "bcm_settings_v5",
  meta: "bcm_meta_v5",
};

const DEFAULT_OFFSET: BarcodeOffset = { x: 0, y: 0, scale: 100 };

const DEFAULT_SETTINGS: PrintSettings = {
  templateId: "xprinter-4030",
  labelWidth: 40,
  labelHeight: 30,
  barcodeWidth: 34,
  barcodeHeight: 11,
  columns: 1,
  rows: 1,
  paddingTop: 1,
  paddingBottom: 1,
  paddingLeft: 1.5,
  paddingRight: 1.5,
  borderRadius: 0,
  borderWidth: 0,
  defaultShopName: "",
  defaultShopPhone: "",
  barcodeStyle: "bars",
  barcodeOffset: DEFAULT_OFFSET,
  printerName: "",
  dpi: 203,
  copies: 1,
  orientation: "portrait",
  pageOffsetX: 0,
  pageOffsetY: 0,
  printScale: 100,
  gapX: 0,
  gapY: 0,
  qrEnabled: false,
  qrBaseUrl: "https://yourshop.com/p/",
  qrSize: 8,
  qrIncludeBarcode: true,
  qrPosition: "top-left",
  qrOffsetX: 0,
  qrOffsetY: 0,
  qrMargin: 1,
  qrShowLabel: false,
  qrLabelText: "Scan",
  qrLabelFontSize: 4,
  barcodeColor: "#000000",
  barcodeBgColor: "#FFFFFF",
  barcodeBarWidth: 1,
  barcodeBarGap: 0.7,
  barcodeShowBorder: false,
  barcodeBorderColor: "#000000",
  barcodeBorderWidth: 0.5,
  barcodePadding: 0,
  barcodeRotation: 0,
};

const TEMPLATES = [
  { id: "xprinter-4030", name: "Xprinter 40×30", emoji: "🖨️", desc: "الأنسب لـ Xprinter 370BM", w: 40, h: 30, bw: 34, bh: 11, pt: 1, pb: 1, pl: 1.5, pr: 1.5 },
  { id: "xprinter-5030", name: "Xprinter 50×30", emoji: "🏷️", desc: "ملصق أوسع", w: 50, h: 30, bw: 42, bh: 11, pt: 1, pb: 1, pl: 2, pr: 2 },
  { id: "xprinter-6040", name: "Xprinter 60×40", emoji: "📦", desc: "ملصق كبير - مناسب للهواتف", w: 60, h: 40, bw: 52, bh: 14, pt: 2, pb: 2, pl: 2, pr: 2 },
  { id: "xprinter-8050", name: "Xprinter 80×50", emoji: "📱", desc: "ملصق هاتف كامل المواصفات", w: 80, h: 50, bw: 70, bh: 16, pt: 2, pb: 2, pl: 2.5, pr: 2.5 },
  { id: "a4-3col", name: "A4 - 3 أعمدة", emoji: "📄", desc: "ورق A4 - 3 × 7", w: 63, h: 38, bw: 50, bh: 12, pt: 2, pb: 2, pl: 3, pr: 3 },
  { id: "a4-4col", name: "A4 - 4 أعمدة", emoji: "📋", desc: "ورق A4 - 4 × 9", w: 48, h: 30, bw: 38, bh: 9, pt: 1.5, pb: 1.5, pl: 2, pr: 2 },
];

const CONDITION_OPTIONS = [
  "جديد", "مستعمل - ممتاز", "مستعمل - جيد جداً",
  "مستعمل - جيد", "مستعمل - مقبول", "مجدد",
];

// ═══════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════
function safeLoad<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) } as T;
  } catch {
    return fallback;
  }
}

function safeSave(key: string, value: any) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function generateEAN13(): string {
  const base =
    "200" +
    Date.now().toString().slice(-6) +
    Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  const twelve = base.slice(0, 12);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(twelve[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return twelve + ((10 - (sum % 10)) % 10);
}

function inferSpecs(product: Product) {
  const text = `${product.name ?? ""} ${(product as any)?.description ?? ""}`.toLowerCase();
  const storage = text.match(/\b(32|64|128|256|512|1)\s?(gb|جيجا)/i);
  const ram = text.match(/\b(2|3|4|6|8|12|16)\s?(gb|رام)/i);
  const battery = text.match(/\b(\d{4,5})\s?(mah|ملي)/i);
  return {
    storage: storage ? `${storage[1]}GB` : "",
    ram: ram ? `${ram[1]}GB RAM` : "",
    battery: battery ? `${battery[1]}mAh` : "",
  };
}

function buildBarcodeSVG(
  value: string,
  w: number,
  h: number,
  offset: BarcodeOffset = DEFAULT_OFFSET,
  style?: {
    color?: string;
    bgColor?: string;
    barWidth?: number;
    barGap?: number;
    showBorder?: boolean;
    borderColor?: string;
    borderWidth?: number;
    padding?: number;
    rotation?: 0 | 90 | 180 | 270;
  }
): string {
  if (!value) return "";
  const color = style?.color ?? "#000000";
  const bgColor = style?.bgColor ?? "#FFFFFF";
  const barWidthMul = style?.barWidth ?? 1;
  const barGapMul = style?.barGap ?? 0.7;
  const showBorder = style?.showBorder ?? false;
  const borderColor = style?.borderColor ?? "#000000";
  const borderWidth = style?.borderWidth ?? 0.5;
  const padding = style?.padding ?? 0;
  const rotation = style?.rotation ?? 0;

  const chars = value.split("");
  let bars = "";
  let x = 2;
  chars.forEach((ch) => {
    const code = ch.charCodeAt(0);
    const bw = (1.0 + (code % 3) * 0.35) * barWidthMul;
    const gap = (0.7 + (code % 2) * 0.2) * barGapMul;
    bars += `<rect x="${x.toFixed(2)}" y="0" width="${bw.toFixed(2)}" height="${h}" fill="${color}"/>`;
    x += bw + gap;
  });
  x += 2;

  const scaleFactor = (offset.scale ?? 100) / 100;
  const svgW = w * scaleFactor;
  const svgH = h * scaleFactor;
  const innerScale = (svgW - 4) / Math.max(x, 1);
  const tx = offset.x ?? 0;
  const ty = offset.y ?? 0;

  const wrapperStyle = `display:inline-block;background:${bgColor};padding:${padding}mm;${
    showBorder ? `border:${borderWidth}mm solid ${borderColor};box-sizing:border-box;` : ""
  }${rotation !== 0 ? `transform:rotate(${rotation}deg);` : ""}`;

  return `<div style="${wrapperStyle}">
    <svg viewBox="0 0 ${svgW} ${svgH}" width="${svgW}mm" height="${svgH}mm" xmlns="http://www.w3.org/2000/svg" style="display:block;margin-left:${tx}mm;margin-top:${ty}mm;overflow:visible;background:${bgColor};">
      <g transform="translate(2,0) scale(${innerScale.toFixed(4)},1)">${bars}</g>
    </svg>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════
// QR CODE UTILITIES
// ═══════════════════════════════════════════════════════════════
const qrCache = new Map<string, string>();

function buildQrUrl(product: Product, settings: PrintSettings, customUrl?: string): string {
  if (customUrl?.trim()) return customUrl.trim();
  const base = (settings.qrBaseUrl || "").trim();
  if (!base) return "";
  if (settings.qrIncludeBarcode) {
    const barcode = product.barcode || product.id || "";
    return base.endsWith("/") ? `${base}${barcode}` : `${base}/${barcode}`;
  }
  return base;
}

async function generateQrDataUrl(text: string, sizeMM: number): Promise<string> {
  if (!text) return "";
  const key = `${text}_${sizeMM}`;
  if (qrCache.has(key)) return qrCache.get(key)!;
  try {
    const px = Math.max(120, Math.round(sizeMM * 12));
    const url = await QRCode.toDataURL(text, {
      width: px,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#FFFFFF" },
    });
    qrCache.set(key, url);
    return url;
  } catch {
    return "";
  }
}

function getDefaultFields(product: Product, settings: PrintSettings): LabelField[] {
  const specs = inferSpecs(product);
  return [
    { id: "shopName", label: "اسم المحل", value: settings.defaultShopName, enabled: !!settings.defaultShopName, fontSize: 7.5, fontWeight: 900 },
    { id: "shopPhone", label: "هاتف المحل", value: settings.defaultShopPhone, enabled: !!settings.defaultShopPhone, fontSize: 6, fontWeight: 600 },
    { id: "productName", label: "اسم المنتج", value: product.name ?? "", enabled: true, fontSize: 8.5, fontWeight: 900 },
    { id: "storage", label: "المساحة", value: specs.storage, enabled: !!specs.storage, fontSize: 7, fontWeight: 700 },
    { id: "battery", label: "البطارية", value: specs.battery, enabled: !!specs.battery, fontSize: 7, fontWeight: 700 },
    { id: "ram", label: "الرام", value: specs.ram, enabled: !!specs.ram, fontSize: 7, fontWeight: 700 },
    { id: "condition", label: "الحالة", value: "", enabled: false, fontSize: 6.5, fontWeight: 700 },
    { id: "price", label: "السعر", value: String(product.sellingPrice ?? 0), enabled: true, fontSize: 11, fontWeight: 900 },
    { id: "barcode", label: "رقم الباركود", value: product.barcode ?? "", enabled: true, fontSize: 5.5, fontWeight: 400 },
    { id: "extra1", label: "سطر إضافي 1", value: "", enabled: false, fontSize: 6.5, fontWeight: 600 },
    { id: "extra2", label: "سطر إضافي 2", value: "", enabled: false, fontSize: 6, fontWeight: 500 },
  ];
}

// ═══════════════════════════════════════════════════════════════
// BARCODE OFFSET CONTROL
// ═══════════════════════════════════════════════════════════════
function BarcodeOffsetControl({
  offset,
  onChange,
  title = "ضبط موضع الباركود",
}: {
  offset: BarcodeOffset;
  onChange: (offset: BarcodeOffset) => void;
  title?: string;
}) {
  const upd = (key: keyof BarcodeOffset, val: number) =>
    onChange({ ...offset, [key]: val });

  return (
    <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Move size={16} className="text-blue-600" />
        <span className="font-black text-blue-800 text-sm">{title}</span>
        <button
          onClick={() => onChange(DEFAULT_OFFSET)}
          className="mr-auto text-xs text-blue-500 hover:text-blue-700 underline font-bold"
        >
          إعادة تعيين
        </button>
      </div>

      {(["x", "y"] as const).map((key) => (
        <div key={key}>
          <div className="flex justify-between text-xs font-bold text-gray-600 mb-1">
            <span>{key === "x" ? "إزاحة أفقية" : "إزاحة رأسية"}</span>
            <span className="text-blue-700 font-mono">
              {(offset[key] ?? 0) > 0 ? "+" : ""}{offset[key] ?? 0} مم
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => upd(key, Math.max(-20, (offset[key] ?? 0) - 0.5))}
              className="w-8 h-8 bg-white border-2 border-gray-200 rounded-lg flex items-center justify-center font-bold hover:bg-gray-100 text-sm flex-shrink-0"
            >−</button>
            <input
              type="range" min="-20" max="20" step="0.5"
              value={offset[key] ?? 0}
              onChange={(e) => upd(key, Number(e.target.value))}
              className="flex-1 accent-blue-600"
            />
            <button
              onClick={() => upd(key, Math.min(20, (offset[key] ?? 0) + 0.5))}
              className="w-8 h-8 bg-white border-2 border-gray-200 rounded-lg flex items-center justify-center font-bold hover:bg-gray-100 text-sm flex-shrink-0"
            >+</button>
            <input
              type="number" step="0.5" value={offset[key] ?? 0}
              onChange={(e) => upd(key, Math.max(-20, Math.min(20, Number(e.target.value))))}
              className="w-16 text-center border-2 border-gray-200 rounded-lg py-1.5 text-xs outline-none focus:border-blue-400 font-mono flex-shrink-0"
            />
          </div>
        </div>
      ))}

      <div>
        <div className="flex justify-between text-xs font-bold text-gray-600 mb-1">
          <span>حجم الباركود</span>
          <span className="text-blue-700 font-mono">{offset.scale ?? 100}%</span>
        </div>
        <div className="flex items-center gap-2">
          <ZoomOut size={14} className="text-gray-400 flex-shrink-0" />
          <input
            type="range" min="50" max="150" step="5"
            value={offset.scale ?? 100}
            onChange={(e) => upd("scale", Number(e.target.value))}
            className="flex-1 accent-blue-600"
          />
          <ZoomIn size={14} className="text-gray-400 flex-shrink-0" />
          <input
            type="number" step="5" value={offset.scale ?? 100}
            onChange={(e) => upd("scale", Math.max(50, Math.min(150, Number(e.target.value))))}
            className="w-16 text-center border-2 border-gray-200 rounded-lg py-1.5 text-xs outline-none focus:border-blue-400 font-mono flex-shrink-0"
          />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PAGE OFFSET CONTROL
// ═══════════════════════════════════════════════════════════════
function PageOffsetControl({
  settings,
  onChange,
}: {
  settings: PrintSettings;
  onChange: (k: keyof PrintSettings, v: any) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Move size={16} className="text-amber-600" />
          <span className="font-black text-amber-800 text-sm">ضبط موضع الطباعة على الملصق</span>
          <button
            onClick={() => {
              onChange("pageOffsetX", 0);
              onChange("pageOffsetY", 0);
              onChange("printScale", 100);
              onChange("gapX", 0);
              onChange("gapY", 0);
            }}
            className="mr-auto text-xs text-amber-600 hover:text-amber-800 underline font-bold"
          >
            إعادة ضبط الكل
          </button>
        </div>

        {(["pageOffsetX", "pageOffsetY"] as const).map((key) => (
          <div key={key} className="mb-4">
            <div className="flex justify-between text-xs font-bold text-gray-700 mb-1">
              <span>{key === "pageOffsetX" ? "إزاحة الطباعة أفقياً (X)" : "إزاحة الطباعة رأسياً (Y)"}</span>
              <span className="text-amber-700 font-mono">
                {(settings[key] ?? 0) > 0 ? "+" : ""}{settings[key] ?? 0} مم
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range" min="-30" max="30" step="0.5"
                value={settings[key] ?? 0}
                onChange={(e) => onChange(key, Number(e.target.value))}
                className="flex-1 accent-amber-600"
              />
              <input
                type="number" step="0.5"
                value={settings[key] ?? 0}
                onChange={(e) => onChange(key, Math.max(-30, Math.min(30, Number(e.target.value))))}
                className="w-20 text-center border-2 border-amber-200 rounded-xl py-2 text-sm outline-none focus:border-amber-400 font-mono font-bold flex-shrink-0"
              />
            </div>
          </div>
        ))}

        <div>
          <div className="flex justify-between text-xs font-bold text-gray-700 mb-1">
            <span>مقياس المحتوى داخل الملصق</span>
            <span className="text-amber-700 font-mono">{settings.printScale ?? 100}%</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range" min="60" max="120" step="1"
              value={settings.printScale ?? 100}
              onChange={(e) => onChange("printScale", Number(e.target.value))}
              className="flex-1 accent-amber-600"
            />
            <input
              type="number" min="60" max="120" step="1"
              value={settings.printScale ?? 100}
              onChange={(e) => onChange("printScale", Math.max(60, Math.min(120, Number(e.target.value))))}
              className="w-20 text-center border-2 border-amber-200 rounded-xl py-2 text-sm outline-none focus:border-amber-400 font-mono font-bold flex-shrink-0"
            />
          </div>
        </div>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <div className="text-sm font-bold text-gray-700 mb-3">المسافة بين الملصقات</div>
        <div className="grid grid-cols-2 gap-3">
          {(["gapX", "gapY"] as const).map((key) => (
            <div key={key}>
              <label className="text-xs font-bold text-gray-500 mb-1 block">
                {key === "gapX" ? "مسافة أفقية (مم)" : "مسافة رأسية (مم)"}
              </label>
              <input
                type="number" min="0" max="20" step="0.5"
                value={settings[key] ?? 0}
                onChange={(e) => onChange(key, Math.max(0, Number(e.target.value)))}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center outline-none focus:border-amber-400 font-mono"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// LABEL EDITOR MODAL
// ═══════════════════════════════════════════════════════════════
function LabelEditorModal({
  product,
  settings,
  meta,
  onSave,
  onClose,
}: {
  product: Product;
  settings: PrintSettings;
  meta: ProductMeta;
  onSave: (meta: ProductMeta) => void;
  onClose: () => void;
}) {
  const [fields, setFields] = useState<LabelField[]>(() =>
    getDefaultFields(product, settings).map((f) => ({
      ...f,
      ...(meta.fields[f.id] ?? {}),
    }))
  );
  const [barcodeValue, setBarcodeValue] = useState(meta.barcodeValue || product.barcode || "");
  const [barcodeOffset, setBarcodeOffset] = useState<BarcodeOffset>(
    meta.barcodeOffset ?? settings.barcodeOffset ?? DEFAULT_OFFSET
  );
  const [qrCustomUrl, setQrCustomUrl] = useState(meta.qrCustomUrl ?? "");
  const [activeTab, setActiveTab] = useState<"fields" | "barcode" | "qr">("fields");

  const updateField = (id: LabelField["id"], patch: Partial<LabelField>) =>
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const handleSave = () => {
    const fieldsMap: Partial<Record<LabelField["id"], Partial<LabelField>>> = {};
    fields.forEach((f) => { fieldsMap[f.id] = f; });
    onSave({
      fields: fieldsMap,
      barcodeValue,
      barcodeOffset,
      qrCustomUrl: qrCustomUrl.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center p-2 lg:p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[97vh] flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-5 py-4 text-white flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="font-black text-lg">✏️ تحرير ملصق الباركود</h3>
            <p className="text-indigo-200 text-xs mt-0.5">{product.name}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-2 rounded-xl hover:bg-white/10">
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <button
            onClick={() => setActiveTab("fields")}
            className={`flex-1 py-3 text-sm font-bold ${activeTab === "fields" ? "bg-white text-indigo-700 border-b-2 border-indigo-600" : "text-gray-500"}`}
          >📝 الحقول</button>
          <button
            onClick={() => setActiveTab("barcode")}
            className={`flex-1 py-3 text-sm font-bold ${activeTab === "barcode" ? "bg-white text-blue-700 border-b-2 border-blue-600" : "text-gray-500"}`}
          >📐 الباركود</button>
          <button
            onClick={() => setActiveTab("qr")}
            className={`flex-1 py-3 text-sm font-bold ${activeTab === "qr" ? "bg-white text-purple-700 border-b-2 border-purple-600" : "text-gray-500"}`}
          >📱 QR</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === "fields" && (
            <div className="space-y-2">
              <div className="bg-white border border-gray-200 rounded-xl p-3 mb-3">
                <div className="text-xs font-black text-gray-600 mb-2">🔢 رقم الباركود</div>
                <div className="flex gap-2">
                  <input
                    type="text" value={barcodeValue}
                    onChange={(e) => { setBarcodeValue(e.target.value); updateField("barcode", { value: e.target.value }); }}
                    className="flex-1 border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-indigo-400"
                    placeholder="أدخل الباركود..."
                  />
                  <button
                    onClick={() => { const nb = generateEAN13(); setBarcodeValue(nb); updateField("barcode", { value: nb }); }}
                    className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-bold"
                  >🎲 توليد</button>
                </div>
              </div>

              {fields.map((field) => (
                <div
                  key={field.id}
                  className={`border-2 rounded-xl p-3 transition-all ${field.enabled ? "border-indigo-200 bg-indigo-50/30" : "border-gray-100 bg-gray-50 opacity-60"}`}
                >
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateField(field.id, { enabled: !field.enabled })}
                      className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 ${field.enabled ? "bg-indigo-600 border-indigo-600 text-white" : "border-gray-300 bg-white"}`}
                    >
                      {field.enabled && <Check size={11} />}
                    </button>
                    <span className="text-xs font-black text-gray-600 w-20 flex-shrink-0">{field.label}</span>
                    {field.id === "condition" ? (
                      <select
                        value={field.value}
                        onChange={(e) => updateField(field.id, { value: e.target.value })}
                        disabled={!field.enabled}
                        className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-indigo-400 disabled:bg-gray-100 bg-white"
                      >
                        <option value="">اختر الحالة</option>
                        {CONDITION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        type={field.id === "price" ? "number" : "text"}
                        value={field.value}
                        onChange={(e) => updateField(field.id, { value: e.target.value })}
                        disabled={!field.enabled}
                        className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-indigo-400 disabled:bg-gray-100 disabled:text-gray-400 min-w-0"
                        placeholder={field.label}
                      />
                    )}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => updateField(field.id, { fontSize: Math.max(4, field.fontSize - 0.5) })}
                        disabled={!field.enabled}
                        className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center hover:bg-gray-200 text-xs disabled:opacity-40"
                      >−</button>
                      <span className="text-xs font-bold w-10 text-center text-gray-600">{field.fontSize}pt</span>
                      <button
                        onClick={() => updateField(field.id, { fontSize: Math.min(20, field.fontSize + 0.5) })}
                        disabled={!field.enabled}
                        className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center hover:bg-gray-200 text-xs disabled:opacity-40"
                      >+</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "barcode" && (
            <div className="space-y-4">
              <BarcodeOffsetControl
                offset={barcodeOffset}
                onChange={setBarcodeOffset}
                title="إزاحة الباركود داخل الملصق"
              />
            </div>
          )}

          {activeTab === "qr" && (
            <div className="space-y-4">
              <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <QrCode size={16} className="text-purple-600" />
                  <span className="font-black text-purple-800 text-sm">رابط QR خاص بهذا المنتج</span>
                </div>
                <div className="text-xs text-purple-700 mb-3">
                  اتركه فارغاً لاستخدام الرابط الافتراضي من الإعدادات.
                </div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">رابط مخصص (اختياري)</label>
                <input
                  type="url" dir="ltr"
                  value={qrCustomUrl}
                  onChange={(e) => setQrCustomUrl(e.target.value)}
                  placeholder="https://yourshop.com/warranty/iphone-15"
                  className="w-full border-2 border-purple-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-400 font-mono"
                />
                {qrCustomUrl && (
                  <button
                    onClick={() => setQrCustomUrl("")}
                    className="mt-2 text-xs text-red-500 hover:text-red-700 font-bold underline"
                  >🗑️ مسح الرابط المخصص</button>
                )}
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
                💡 لتفعيل QR على كل الملصقات: الإعدادات ← QR ← تفعيل
              </div>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 border-t border-gray-100 p-4 bg-gray-50 flex gap-3 justify-between">
          <button onClick={onClose} className="px-5 py-2.5 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300">إلغاء</button>
          <button onClick={handleSave} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-black hover:bg-indigo-700 active:scale-95 flex items-center gap-2 shadow-md">
            <Save size={16} /> حفظ التغييرات
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SETTINGS MODAL
// ═══════════════════════════════════════════════════════════════
function SettingsModal({
  settings,
  onSave,
  onClose,
  printers,
}: {
  settings: PrintSettings;
  onSave: (s: PrintSettings) => void;
  onClose: () => void;
  printers: { name: string; displayName?: string; isDefault?: boolean }[];
}) {
  const [local, setLocal] = useState<PrintSettings>({ ...settings });
  const upd = (k: keyof PrintSettings, v: any) => setLocal((p) => ({ ...p, [k]: v }));
  const [tab, setTab] = useState<"label" | "barcode" | "qr" | "offset" | "printer">("label");

  return (
    <div className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[95vh] flex flex-col overflow-hidden">
        <div className="bg-gray-800 px-5 py-4 text-white flex items-center justify-between flex-shrink-0">
          <h3 className="font-black text-lg flex items-center gap-2">
            <SlidersHorizontal size={20} /> إعدادات الطباعة
          </h3>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1 rounded-lg"><X size={20} /></button>
        </div>

        <div className="flex border-b border-gray-200 flex-shrink-0 bg-gray-50">
          {[
            { id: "label", label: "📐 الملصق" },
            { id: "barcode", label: "📊 الباركود" },
            { id: "qr", label: "📱 QR" },
            { id: "offset", label: "🎯 الطباعة" },
            { id: "printer", label: "🖨️ الطابعة" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`flex-1 py-2.5 text-xs font-bold transition-colors ${tab === t.id ? "bg-white text-indigo-700 border-b-2 border-indigo-600" : "text-gray-500 hover:text-gray-700"}`}
            >{t.label}</button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {tab === "label" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black text-gray-600 mb-1 block">اسم المحل</label>
                  <input type="text" value={local.defaultShopName}
                    onChange={(e) => upd("defaultShopName", e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400" />
                </div>
                <div>
                  <label className="text-xs font-black text-gray-600 mb-1 block">هاتف المحل</label>
                  <input type="text" value={local.defaultShopPhone}
                    onChange={(e) => upd("defaultShopPhone", e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">عرض الملصق (مم)</label>
                  <input type="number" value={local.labelWidth}
                    onChange={(e) => upd("labelWidth", Number(e.target.value))}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 text-center font-bold" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">ارتفاع الملصق (مم)</label>
                  <input type="number" value={local.labelHeight}
                    onChange={(e) => upd("labelHeight", Number(e.target.value))}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 text-center font-bold" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">هامش علوي/سفلي (مم)</label>
                  <input type="number" step="0.5" value={local.paddingTop}
                    onChange={(e) => { upd("paddingTop", Number(e.target.value)); upd("paddingBottom", Number(e.target.value)); }}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 text-center" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">هامش جانبي (مم)</label>
                  <input type="number" step="0.5" value={local.paddingLeft}
                    onChange={(e) => { upd("paddingLeft", Number(e.target.value)); upd("paddingRight", Number(e.target.value)); }}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 text-center" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">تدوير الزوايا</label>
                  <input type="number" min="0" max="20" value={local.borderRadius}
                    onChange={(e) => upd("borderRadius", Number(e.target.value))}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 text-center" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">سمك الإطار</label>
                  <input type="number" min="0" max="5" value={local.borderWidth}
                    onChange={(e) => upd("borderWidth", Number(e.target.value))}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 text-center" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">عدد الأعمدة</label>
                  <input type="number" min="1" max="6" value={local.columns}
                    onChange={(e) => upd("columns", Number(e.target.value))}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 text-center font-bold" />
                </div>
              </div>
            </div>
          )}

          {tab === "barcode" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">عرض الباركود (مم)</label>
                  <input type="number" value={local.barcodeWidth}
                    onChange={(e) => upd("barcodeWidth", Number(e.target.value))}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 text-center font-bold" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">ارتفاع الباركود (مم)</label>
                  <input type="number" value={local.barcodeHeight}
                    onChange={(e) => upd("barcodeHeight", Number(e.target.value))}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 text-center font-bold" />
                </div>
              </div>

              <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 space-y-3">
                <div className="font-black text-emerald-800 text-sm flex items-center gap-2">
                  🎨 تنسيق الباركود
                  <button
                    onClick={() => {
                      upd("barcodeColor", "#000000");
                      upd("barcodeBgColor", "#FFFFFF");
                      upd("barcodeBarWidth", 1);
                      upd("barcodeBarGap", 0.7);
                      upd("barcodeShowBorder", false);
                      upd("barcodePadding", 0);
                      upd("barcodeRotation", 0);
                    }}
                    className="mr-auto text-xs text-emerald-600 hover:text-emerald-800 underline font-bold"
                  >إعادة تعيين</button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">لون الخطوط</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={local.barcodeColor}
                        onChange={(e) => upd("barcodeColor", e.target.value)}
                        className="w-10 h-10 border-2 border-gray-200 rounded-lg cursor-pointer" />
                      <input type="text" value={local.barcodeColor}
                        onChange={(e) => upd("barcodeColor", e.target.value)}
                        className="flex-1 border-2 border-gray-200 rounded-lg px-2 py-2 text-xs font-mono outline-none focus:border-emerald-400" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">لون الخلفية</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={local.barcodeBgColor}
                        onChange={(e) => upd("barcodeBgColor", e.target.value)}
                        className="w-10 h-10 border-2 border-gray-200 rounded-lg cursor-pointer" />
                      <input type="text" value={local.barcodeBgColor}
                        onChange={(e) => upd("barcodeBgColor", e.target.value)}
                        className="flex-1 border-2 border-gray-200 rounded-lg px-2 py-2 text-xs font-mono outline-none focus:border-emerald-400" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 flex justify-between">
                    <span>سمك الخطوط</span>
                    <span className="text-emerald-700 font-mono">{local.barcodeBarWidth}×</span>
                  </label>
                  <input type="range" min="0.5" max="3" step="0.1"
                    value={local.barcodeBarWidth}
                    onChange={(e) => upd("barcodeBarWidth", Number(e.target.value))}
                    className="w-full accent-emerald-600" />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 flex justify-between">
                    <span>المسافة بين الخطوط</span>
                    <span className="text-emerald-700 font-mono">{local.barcodeBarGap}×</span>
                  </label>
                  <input type="range" min="0.3" max="2" step="0.1"
                    value={local.barcodeBarGap}
                    onChange={(e) => upd("barcodeBarGap", Number(e.target.value))}
                    className="w-full accent-emerald-600" />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">تدوير الباركود</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[0, 90, 180, 270].map((deg) => (
                      <button
                        key={deg}
                        onClick={() => upd("barcodeRotation", deg)}
                        className={`py-2 rounded-lg text-xs font-bold border-2 ${
                          local.barcodeRotation === deg
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                            : "border-gray-200 text-gray-600 hover:border-emerald-300"
                        }`}
                      >{deg}°</button>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-emerald-100 rounded-xl p-3">
                  <label className="flex items-center gap-2 cursor-pointer mb-2">
                    <input type="checkbox"
                      checked={local.barcodeShowBorder}
                      onChange={(e) => upd("barcodeShowBorder", e.target.checked)}
                      className="w-4 h-4 accent-emerald-600" />
                    <span className="text-sm font-bold text-gray-700">إظهار إطار حول الباركود</span>
                  </label>
                  {local.barcodeShowBorder && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <label className="text-[11px] font-bold text-gray-600 mb-1 block">لون الإطار</label>
                        <input type="color" value={local.barcodeBorderColor}
                          onChange={(e) => upd("barcodeBorderColor", e.target.value)}
                          className="w-full h-9 border-2 border-gray-200 rounded-lg cursor-pointer" />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-gray-600 mb-1 block">سمك الإطار (مم)</label>
                        <input type="number" min="0.1" max="2" step="0.1"
                          value={local.barcodeBorderWidth}
                          onChange={(e) => upd("barcodeBorderWidth", Number(e.target.value))}
                          className="w-full border-2 border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center font-mono outline-none focus:border-emerald-400" />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 flex justify-between">
                    <span>هوامش داخلية (مم)</span>
                    <span className="text-emerald-700 font-mono">{local.barcodePadding}mm</span>
                  </label>
                  <input type="range" min="0" max="3" step="0.1"
                    value={local.barcodePadding}
                    onChange={(e) => upd("barcodePadding", Number(e.target.value))}
                    className="w-full accent-emerald-600" />
                </div>
              </div>

              <BarcodeOffsetControl
                offset={local.barcodeOffset ?? DEFAULT_OFFSET}
                onChange={(o) => upd("barcodeOffset", o)}
                title="إزاحة الباركود العامة"
              />
            </div>
          )}

          {tab === "qr" && (
            <div className="space-y-4">
              <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox"
                    checked={local.qrEnabled}
                    onChange={(e) => upd("qrEnabled", e.target.checked)}
                    className="w-5 h-5 accent-purple-600" />
                  <div className="flex-1">
                    <div className="font-black text-sm text-purple-800 flex items-center gap-2">
                      <QrCode size={16} /> تفعيل QR Code على الملصقات
                    </div>
                    <div className="text-xs text-purple-600 mt-0.5">
                      يضاف QR على الملصق يفتح رابطاً عند المسح
                    </div>
                  </div>
                </label>
              </div>

              {local.qrEnabled && (
                <>
                  <div>
                    <label className="text-xs font-black text-gray-600 mb-1 flex items-center gap-1">
                      <LinkIcon size={12} /> الرابط الأساسي (يحدده المطور)
                    </label>
                    <input type="url" dir="ltr"
                      value={local.qrBaseUrl}
                      onChange={(e) => upd("qrBaseUrl", e.target.value)}
                      className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-400 font-mono"
                      placeholder="https://yourshop.com/p/" />
                  </div>

                  <div className="bg-white border-2 border-gray-100 rounded-xl p-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox"
                        checked={local.qrIncludeBarcode}
                        onChange={(e) => upd("qrIncludeBarcode", e.target.checked)}
                        className="w-4 h-4 accent-purple-600" />
                      <div className="flex-1">
                        <div className="text-sm font-bold text-gray-700">إلحاق الباركود بنهاية الرابط</div>
                        <div className="text-xs text-gray-500 mt-0.5" dir="ltr">
                          {local.qrBaseUrl}{local.qrIncludeBarcode ? "1234567890" : ""}
                        </div>
                      </div>
                    </label>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 flex justify-between">
                      <span>حجم QR</span>
                      <span className="text-purple-700 font-mono">{local.qrSize}mm</span>
                    </label>
                    <input type="range" min="4" max="20" step="0.5"
                      value={local.qrSize}
                      onChange={(e) => upd("qrSize", Number(e.target.value))}
                      className="w-full accent-purple-600" />
                  </div>

                  <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-3">
                    <div className="text-xs font-black text-purple-800 mb-2">📍 موضع QR على الملصق</div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { val: "top-left", label: "↖", name: "أعلى يسار" },
                        { val: "top-center", label: "↑", name: "أعلى وسط" },
                        { val: "top-right", label: "↗", name: "أعلى يمين" },
                        { val: "middle-left", label: "←", name: "وسط يسار" },
                        { val: "inline-barcode", label: "═", name: "بجانب الباركود" },
                        { val: "middle-right", label: "→", name: "وسط يمين" },
                        { val: "bottom-left", label: "↙", name: "أسفل يسار" },
                        { val: "bottom-center", label: "↓", name: "أسفل وسط" },
                        { val: "bottom-right", label: "↘", name: "أسفل يمين" },
                      ].map((p) => (
                        <button
                          key={p.val}
                          onClick={() => upd("qrPosition", p.val)}
                          title={p.name}
                          className={`aspect-square rounded-lg border-2 flex flex-col items-center justify-center transition-all ${
                            local.qrPosition === p.val
                              ? "border-purple-500 bg-purple-100 text-purple-700 shadow-md"
                              : "border-gray-200 bg-white text-gray-400 hover:border-purple-300"
                          }`}
                        >
                          <div className="text-2xl leading-none">{p.label}</div>
                          <div className="text-[8px] mt-0.5 font-bold leading-none">{p.name}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white border-2 border-gray-100 rounded-xl p-3 space-y-3">
                    <div className="text-xs font-black text-gray-700">🎯 ضبط دقيق لموضع QR</div>

                    <div>
                      <label className="text-xs font-bold text-gray-600 mb-1 flex justify-between">
                        <span>هامش من الحافة</span>
                        <span className="text-purple-700 font-mono">{local.qrMargin}mm</span>
                      </label>
                      <input type="range" min="0" max="5" step="0.1"
                        value={local.qrMargin}
                        onChange={(e) => upd("qrMargin", Number(e.target.value))}
                        className="w-full accent-purple-600" />
                    </div>

                    {(["qrOffsetX", "qrOffsetY"] as const).map((key) => (
                      <div key={key}>
                        <label className="text-xs font-bold text-gray-600 mb-1 flex justify-between">
                          <span>{key === "qrOffsetX" ? "إزاحة أفقية" : "إزاحة رأسية"}</span>
                          <span className="text-purple-700 font-mono">
                            {(local[key] ?? 0) > 0 ? "+" : ""}{local[key] ?? 0}mm
                          </span>
                        </label>
                        <div className="flex items-center gap-2">
                          <input type="range" min="-10" max="10" step="0.1"
                            value={local[key] ?? 0}
                            onChange={(e) => upd(key, Number(e.target.value))}
                            className="flex-1 accent-purple-600" />
                          <input type="number" step="0.1" min="-10" max="10"
                            value={local[key] ?? 0}
                            onChange={(e) => upd(key, Number(e.target.value))}
                            className="w-16 text-center border-2 border-gray-200 rounded-lg py-1 text-xs outline-none focus:border-purple-400 font-mono" />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-white border-2 border-gray-100 rounded-xl p-3">
                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                      <input type="checkbox"
                        checked={local.qrShowLabel}
                        onChange={(e) => upd("qrShowLabel", e.target.checked)}
                        className="w-4 h-4 accent-purple-600" />
                      <span className="text-sm font-bold text-gray-700">إضافة نص أسفل QR</span>
                    </label>
                    {local.qrShowLabel && (
                      <div className="space-y-2 mt-2">
                        <input type="text"
                          value={local.qrLabelText}
                          onChange={(e) => upd("qrLabelText", e.target.value)}
                          placeholder="مثل: Scan for warranty"
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-purple-400" />
                        <div>
                          <label className="text-[11px] font-bold text-gray-600 mb-1 flex justify-between">
                            <span>حجم الخط</span>
                            <span className="text-purple-700 font-mono">{local.qrLabelFontSize}pt</span>
                          </label>
                          <input type="range" min="2" max="8" step="0.5"
                            value={local.qrLabelFontSize}
                            onChange={(e) => upd("qrLabelFontSize", Number(e.target.value))}
                            className="w-full accent-purple-600" />
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {tab === "offset" && (
            <PageOffsetControl settings={local} onChange={upd} />
          )}

          {tab === "printer" && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
                💡 اختر الطابعة من القائمة للطباعة المباشرة. يتطلب تشغيل التطبيق كـ Desktop.
              </div>

              <div>
                <label className="text-xs font-black text-gray-600 mb-1 block">اسم الطابعة</label>
                {printers.length > 0 ? (
                  <select
                    value={local.printerName}
                    onChange={(e) => upd("printerName", e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 bg-white"
                  >
                    <option value="">اختر الطابعة</option>
                    {printers.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.displayName || p.name} {p.isDefault ? "⭐" : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text" value={local.printerName}
                    onChange={(e) => upd("printerName", e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400"
                    placeholder="مثال: Xprinter XP-370BM"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">دقة الطباعة (DPI)</label>
                  <select value={local.dpi} onChange={(e) => upd("dpi", Number(e.target.value))}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 bg-white">
                    <option value={203}>203 DPI</option>
                    <option value={300}>300 DPI</option>
                    <option value={600}>600 DPI</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">عدد النسخ</label>
                  <input type="number" min="1" max="100" value={local.copies}
                    onChange={(e) => upd("copies", Math.max(1, Number(e.target.value)))}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 text-center font-bold" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">اتجاه الطباعة</label>
                <div className="flex gap-3">
                  {[{ val: "portrait", label: "عمودي 📄" }, { val: "landscape", label: "أفقي 📄" }].map((o) => (
                    <button key={o.val} onClick={() => upd("orientation", o.val)}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold border-2 ${local.orientation === o.val ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-600"}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 border-t p-4 flex gap-3">
          <button onClick={onClose} className="px-5 py-2.5 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300">إلغاء</button>
          <button onClick={() => { onSave(local); onClose(); }}
            className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-black hover:bg-indigo-700 flex items-center justify-center gap-2">
            <Save size={16} /> حفظ الإعدادات
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function BarcodeManager({ products, onUpdate }: Props) {
  const [search, setSearch] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<Map<string, number>>(new Map());
  const [settings, setSettings] = useState<PrintSettings>(() =>
    safeLoad(STORAGE_KEYS.settings, DEFAULT_SETTINGS)
  );
  const [metaMap, setMetaMap] = useState<Record<string, ProductMeta>>(() =>
    safeLoad(STORAGE_KEYS.meta, {})
  );
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [printers, setPrinters] = useState<{ name: string; displayName?: string; isDefault?: boolean }[]>([]);

  useEffect(() => {
    if ((window as any).electronAPI?.listPrinters) {
      (window as any).electronAPI.listPrinters()
        .then((list: any) => setPrinters(list || []))
        .catch(() => setPrinters([]));
    }
  }, [showSettings]);

  useEffect(() => {
    try {
      const st = localStorage.getItem("appState");
      if (st) {
        const p = JSON.parse(st);
        if (p?.settings?.shopName && !settings.defaultShopName) {
          setSettings((prev) => ({
            ...prev,
            defaultShopName: p.settings.shopName ?? "",
            defaultShopPhone: p.settings.shopPhone ?? "",
          }));
        }
      }
    } catch {}
    // eslint-disable-next-line
  }, []);

  useEffect(() => { safeSave(STORAGE_KEYS.settings, settings); }, [settings]);
  useEffect(() => { safeSave(STORAGE_KEYS.meta, metaMap); }, [metaMap]);

  // ✅ توليد QR Codes مسبقاً
  useEffect(() => {
    if (!settings.qrEnabled) return;
    let cancelled = false;
    (async () => {
      let updated = false;
      for (const product of products) {
        if (cancelled) break;
        const customUrl = metaMap[product.id]?.qrCustomUrl;
        const url = buildQrUrl(product, settings, customUrl);
        if (!url) continue;
        const key = `${url}_${settings.qrSize}`;
        if (qrCache.has(key)) continue;
        await generateQrDataUrl(url, settings.qrSize);
        updated = true;
      }
      if (!cancelled && updated) {
        setMetaMap((prev) => ({ ...prev }));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line
  }, [products, settings.qrEnabled, settings.qrBaseUrl, settings.qrSize, settings.qrIncludeBarcode]);

  const getBarcodeValue = useCallback(
    (product: Product) => metaMap[product.id]?.barcodeValue || product.barcode || "",
    [metaMap]
  );

  const getFields = useCallback(
    (product: Product): LabelField[] => {
      const defaults = getDefaultFields(product, settings);
      const saved = metaMap[product.id]?.fields ?? {};
      return defaults.map((f) => ({ ...f, ...(saved[f.id] ?? {}) }));
    },
    [settings, metaMap]
  );

  const getProductOffset = useCallback(
    (product: Product): BarcodeOffset =>
      metaMap[product.id]?.barcodeOffset ?? settings.barcodeOffset ?? DEFAULT_OFFSET,
    [metaMap, settings]
  );

  const handleSaveMeta = useCallback(
    (productId: string, newMeta: ProductMeta) => {
      setMetaMap((prev) => ({ ...prev, [productId]: newMeta }));
      if (newMeta.barcodeValue) {
        onUpdate(products.map((p) =>
          p.id === productId ? { ...p, barcode: newMeta.barcodeValue } : p
        ));
      }
      setEditingProduct(null);
    },
    [products, onUpdate]
  );

  const handleGenerateBarcode = useCallback(
    (product: Product, e: React.MouseEvent) => {
      e.stopPropagation();
      const nb = generateEAN13();
      setMetaMap((prev) => ({
        ...prev,
        [product.id]: { ...(prev[product.id] ?? { fields: {} }), barcodeValue: nb },
      }));
      onUpdate(products.map((p) => (p.id === product.id ? { ...p, barcode: nb } : p)));
    },
    [products, onUpdate]
  );

  const buildLabelHTML = useCallback(
    (product: Product): string => {
      if (!product?.id) return "";
      const fields = getFields(product);
      const f = (id: LabelField["id"]) => fields.find((x) => x.id === id)!;
      const bv = getBarcodeValue(product) || "0000000000000";
      const offset = getProductOffset(product);

      const barSVG = buildBarcodeSVG(
        bv,
        settings.barcodeWidth,
        settings.barcodeHeight,
        offset,
        {
          color: settings.barcodeColor,
          bgColor: settings.barcodeBgColor,
          barWidth: settings.barcodeBarWidth,
          barGap: settings.barcodeBarGap,
          showBorder: settings.barcodeShowBorder,
          borderColor: settings.barcodeBorderColor,
          borderWidth: settings.barcodeBorderWidth,
          padding: settings.barcodePadding,
          rotation: settings.barcodeRotation,
        }
      );

      let qrHTML = "";
      let qrInlineHTML = "";
      if (settings.qrEnabled) {
        const customUrl = metaMap[product.id]?.qrCustomUrl;
        const qrUrl = buildQrUrl(product, settings, customUrl);
        const cacheKey = `${qrUrl}_${settings.qrSize}`;
        const qrDataUrl = qrCache.get(cacheKey);

        if (qrDataUrl) {
          const qrImg = `<img src="${qrDataUrl}" style="width:${settings.qrSize}mm;height:${settings.qrSize}mm;display:block;image-rendering:pixelated;"/>`;
          const qrLabel = settings.qrShowLabel && settings.qrLabelText
            ? `<div style="font-size:${settings.qrLabelFontSize}pt;text-align:center;margin-top:0.2mm;font-weight:600;line-height:1;">${settings.qrLabelText}</div>`
            : "";
          const qrBlock = `<div style="display:inline-flex;flex-direction:column;align-items:center;">${qrImg}${qrLabel}</div>`;

          const margin = settings.qrMargin;
          const offX = settings.qrOffsetX;
          const offY = settings.qrOffsetY;

          if (settings.qrPosition === "inline-barcode") {
            qrInlineHTML = qrBlock;
          } else {
            let positionStyle = "";
            switch (settings.qrPosition) {
              case "top-left":
                positionStyle = `top:${margin + offY}mm;left:${margin + offX}mm;`;
                break;
              case "top-right":
                positionStyle = `top:${margin + offY}mm;right:${margin - offX}mm;`;
                break;
              case "top-center":
                positionStyle = `top:${margin + offY}mm;left:50%;transform:translateX(calc(-50% + ${offX}mm));`;
                break;
              case "middle-left":
                positionStyle = `top:50%;left:${margin + offX}mm;transform:translateY(calc(-50% + ${offY}mm));`;
                break;
              case "middle-right":
                positionStyle = `top:50%;right:${margin - offX}mm;transform:translateY(calc(-50% + ${offY}mm));`;
                break;
              case "bottom-left":
                positionStyle = `bottom:${margin - offY}mm;left:${margin + offX}mm;`;
                break;
              case "bottom-right":
                positionStyle = `bottom:${margin - offY}mm;right:${margin - offX}mm;`;
                break;
              case "bottom-center":
                positionStyle = `bottom:${margin - offY}mm;left:50%;transform:translateX(calc(-50% + ${offX}mm));`;
                break;
            }
            qrHTML = `<div style="position:absolute;${positionStyle}z-index:10;">${qrBlock}</div>`;
          }
        }
      }

      const chips = ["storage", "ram", "battery", "condition"].map((id) => {
        const field = f(id as LabelField["id"]);
        if (!field?.enabled || !field.value?.trim()) return "";
        return `<span style="border:0.5pt solid #333;border-radius:20pt;padding:0.3mm 1.2mm;font-size:${field.fontSize}pt;font-weight:${field.fontWeight};">${field.value}</span>`;
      }).join("");

      const showDivider =
        (f("shopName").enabled && f("shopName").value) ||
        (f("shopPhone").enabled && f("shopPhone").value);

      const barcodeSection = qrInlineHTML
        ? `<div style="display:flex;align-items:center;justify-content:center;gap:1mm;width:100%;">
            ${qrInlineHTML}
            <div style="flex:1;text-align:center;">
              ${barSVG}
              ${f("barcode").enabled ? `<div style="font-size:${f("barcode").fontSize}pt;font-family:monospace;text-align:center;margin-top:0.2mm;">${bv}</div>` : ""}
            </div>
          </div>`
        : `${barSVG}${f("barcode").enabled ? `<div style="font-size:${f("barcode").fontSize}pt;font-family:monospace;text-align:center;margin-top:0.2mm;">${bv}</div>` : ""}`;

      return `<div class="label" style="width:${settings.labelWidth}mm;height:${settings.labelHeight}mm;min-width:${settings.labelWidth}mm;min-height:${settings.labelHeight}mm;max-width:${settings.labelWidth}mm;max-height:${settings.labelHeight}mm;background:#fff;border:${settings.borderWidth > 0 ? `${settings.borderWidth}px solid #333` : "none"};border-radius:${settings.borderRadius}px;padding:${settings.paddingTop}mm ${settings.paddingRight}mm ${settings.paddingBottom}mm ${settings.paddingLeft}mm;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;font-family:Arial,Tahoma,sans-serif;color:#111;box-sizing:border-box;overflow:hidden;direction:rtl;unicode-bidi:plaintext;position:relative;">
        ${qrHTML}
        ${f("shopName").enabled && f("shopName").value ? `<div style="font-size:${f("shopName").fontSize}pt;font-weight:900;text-align:center;width:100%;white-space:nowrap;overflow:hidden;">${f("shopName").value}</div>` : ""}
        ${f("shopPhone").enabled && f("shopPhone").value ? `<div style="font-size:${f("shopPhone").fontSize}pt;text-align:center;width:100%;">${f("shopPhone").value}</div>` : ""}
        ${showDivider ? `<div style="border-bottom:0.3pt solid #ddd;width:90%;margin:0.3mm auto;"></div>` : ""}
        ${f("productName").enabled ? `<div style="font-size:${f("productName").fontSize}pt;font-weight:900;text-align:center;margin:0.4mm 0;width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${f("productName").value || product.name}</div>` : ""}
        ${chips ? `<div style="display:flex;flex-wrap:wrap;gap:0.8mm;justify-content:center;margin:0.3mm 0;">${chips}</div>` : ""}
        ${f("extra1").enabled && f("extra1").value ? `<div style="font-size:${f("extra1").fontSize}pt;text-align:center;width:100%;">${f("extra1").value}</div>` : ""}
        <div style="margin-top:auto;text-align:center;width:100%;margin-bottom:0.2mm;">${barcodeSection}</div>
        ${f("price").enabled ? `<div style="font-size:${f("price").fontSize}pt;font-weight:900;text-align:center;margin-top:0.4mm;color:#cc0000;">${(Number(f("price").value) || 0).toLocaleString()} ج.م</div>` : ""}
        ${f("extra2").enabled && f("extra2").value ? `<div style="font-size:${f("extra2").fontSize}pt;text-align:center;width:100%;margin-top:0.2mm;">${f("extra2").value}</div>` : ""}
      </div>`;
    },
    [getFields, getBarcodeValue, getProductOffset, settings, metaMap]
  );

  const buildPrintDocument = useCallback(
    (labelsHTML: string): string => {
      const isMultiCol = (settings.columns ?? 1) > 1;
      const printScale = (settings.printScale ?? 100) / 100;
      const pageOffX = settings.pageOffsetX ?? 0;
      const pageOffY = settings.pageOffsetY ?? 0;
      const gapX = settings.gapX ?? 0;
      const gapY = settings.gapY ?? 0;
      const pageSize = isMultiCol ? "A4" : `${settings.labelWidth}mm ${settings.labelHeight}mm`;

      return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>طباعة</title><style>
        @page { size: ${pageSize}; margin: 0; }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #fff; direction: ltr !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; overflow: hidden; }
        .print-wrapper { direction: ltr !important; margin-left: ${pageOffX}mm; margin-top: ${pageOffY}mm; width: fit-content; }
        ${isMultiCol ? `
          .print-grid { display: grid; grid-template-columns: repeat(${settings.columns}, ${settings.labelWidth}mm); column-gap: ${gapX}mm; row-gap: ${gapY}mm; align-content: start; justify-content: start; }
          .print-cell { width: ${settings.labelWidth}mm; height: ${settings.labelHeight}mm; position: relative; overflow: hidden; page-break-inside: avoid; break-inside: avoid; }
        ` : `
          .print-grid { display: block; }
          .print-cell { width: ${settings.labelWidth}mm; height: ${settings.labelHeight}mm; position: relative; overflow: hidden; page-break-after: always; break-after: page; }
          .print-cell:last-child { page-break-after: avoid; break-after: avoid; }
        `}
        .print-cell > .label { position: absolute !important; top: 0 !important; left: 0 !important; margin: 0 !important; transform-origin: top left !important; transform: scale(${printScale}) !important; }
        svg { max-width: 100% !important; display: block !important; }
      </style></head><body>
        <div class="print-wrapper"><div class="print-grid">${labelsHTML}</div></div>
      </body></html>`;
    },
    [settings]
  );

  const handlePrint = useCallback(async () => {
    if (selectedProducts.size === 0) return;

    let labelsHTML = "";
    selectedProducts.forEach((qty, id) => {
      const product = products.find((p) => p.id === id);
      if (product) {
        for (let i = 0; i < Math.max(1, qty); i++) {
          labelsHTML += `<div class="print-cell">${buildLabelHTML(product)}</div>`;
        }
      }
    });

    const fullHTML = buildPrintDocument(labelsHTML);

    if ((window as any).electronAPI?.printHTML) {
      const result = await (window as any).electronAPI.printHTML({
        html: fullHTML,
        printerName: settings.printerName,
        widthMM: settings.labelWidth,
        heightMM: settings.labelHeight,
        columns: settings.columns,
        landscape: settings.orientation === "landscape",
        copies: settings.copies,
      });
      if (!result?.success) {
        alert(`فشل الطباعة: ${result?.failureReason || "خطأ غير معروف"}`);
      }
      return;
    }

    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { alert("يرجى السماح بالنوافذ المنبثقة"); return; }
    win.document.write(
      fullHTML.replace(
        "</body>",
        `<script>window.onload=function(){setTimeout(function(){window.print();window.onafterprint=function(){window.close();};setTimeout(function(){window.close();},5000);},700);};</script></body>`
      )
    );
    win.document.close();
  }, [selectedProducts, products, buildLabelHTML, buildPrintDocument, settings]);

  const filteredProducts = useMemo(
    () =>
      (products ?? []).filter((p) => {
        if (!p) return false;
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          p.name?.toLowerCase().includes(q) ||
          (p.barcode ?? "").includes(q) ||
          (p.category ?? "").toLowerCase().includes(q)
        );
      }),
    [products, search]
  );

  const totalLabels = useMemo(
    () => Array.from(selectedProducts.values()).reduce((a, b) => a + b, 0),
    [selectedProducts]
  );

  const sampleProduct = useMemo(
    () => products.find((p) => selectedProducts.has(p.id)) ?? products[0] ?? null,
    [products, selectedProducts]
  );

  const currentTemplate = TEMPLATES.find((t) => t.id === settings.templateId) ?? TEMPLATES[0];

  return (
    <div className="space-y-4 p-4" dir="rtl">
      <div className="bg-white rounded-2xl border shadow-sm p-4">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Smartphone className="text-indigo-600" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-800">مدير الباركود</h2>
              <div className="text-xs text-gray-500">
                {currentTemplate.emoji} {currentTemplate.name} · {settings.labelWidth}×{settings.labelHeight}mm
                {settings.qrEnabled && <span className="text-purple-600 mr-1">· 📱 QR مفعّل</span>}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowTemplates(true)}
              className="flex items-center gap-2 px-3 py-2 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-700 text-sm">
              <LayoutTemplate size={15} /> القوالب
            </button>
            <button onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 px-3 py-2 border-2 border-indigo-200 text-indigo-700 rounded-xl font-bold hover:bg-indigo-50 text-sm">
              <SlidersHorizontal size={15} /> الإعدادات
            </button>
            <button onClick={() => setShowPreview(true)} disabled={!sampleProduct}
              className="flex items-center gap-2 px-3 py-2 border-2 border-blue-200 text-blue-700 rounded-xl font-bold hover:bg-blue-50 disabled:opacity-40 text-sm">
              <Eye size={15} /> معاينة
            </button>
            <button onClick={handlePrint} disabled={selectedProducts.size === 0}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-md disabled:opacity-40 text-sm active:scale-95">
              <Printer size={15} /> طباعة ({totalLabels})
            </button>
          </div>
        </div>

        <div className="relative">
          <Search size={16} className="absolute right-4 top-3 text-gray-400" />
          <input
            type="text" value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو الباركود أو الفئة..."
            className="w-full border-2 border-gray-200 rounded-xl py-2.5 pr-11 pl-4 focus:border-indigo-400 outline-none text-sm"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute left-3 top-3 text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {sampleProduct && (
        <div className="bg-white rounded-2xl border shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold text-gray-600">🔍 معاينة الملصق</div>
            <div className="text-xs text-gray-400">{sampleProduct.name}</div>
          </div>
          <div
            className="flex justify-center bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-6 overflow-hidden"
            style={{ minHeight: `${settings.labelHeight * 3 + 48}px` }}
          >
            <div
              style={{
                transform: "scale(3)",
                transformOrigin: "top center",
                marginBottom: `${settings.labelHeight * 2}px`,
              }}
              dangerouslySetInnerHTML={{ __html: buildLabelHTML(sampleProduct) }}
            />
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border shadow-sm">
        <div className="p-4 border-b flex items-center justify-between">
          <span className="font-black text-gray-700">المنتجات ({filteredProducts.length})</span>
          {selectedProducts.size > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-indigo-600 font-bold">
                {selectedProducts.size} محدد · {totalLabels} ملصق
              </span>
              <button
                onClick={() => setSelectedProducts(new Map())}
                className="text-xs text-red-500 hover:text-red-700 font-bold"
              >إلغاء الكل</button>
            </div>
          )}
        </div>

        {filteredProducts.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Smartphone size={40} className="mx-auto mb-2 opacity-20" />
            <div className="font-bold">لا توجد منتجات</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {filteredProducts.map((product) => {
              const isSelected = selectedProducts.has(product.id);
              const qty = selectedProducts.get(product.id) ?? 0;
              const barcodeVal = getBarcodeValue(product);

              return (
                <div
                  key={product.id}
                  className={`border-2 rounded-2xl overflow-hidden transition-all ${
                    isSelected ? "border-indigo-500 bg-indigo-50/30 shadow-md" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div
                    className="bg-gray-50 border-b border-gray-100 flex justify-center items-center py-3 overflow-hidden"
                    style={{ height: `${Math.max(80, settings.labelHeight * 1.8 + 16)}px` }}
                  >
                    <div
                      style={{
                        transform: `scale(${settings.labelHeight < 35 ? 1.6 : 1.3})`,
                        transformOrigin: "center",
                      }}
                      dangerouslySetInnerHTML={{ __html: buildLabelHTML(product) }}
                    />
                  </div>

                  <div className="p-3 space-y-2">
                    <div className="font-bold text-gray-800 leading-tight truncate text-sm">{product.name}</div>
                    {product.category && <div className="text-xs text-gray-400">{product.category}</div>}
                    <div className={`text-xs font-mono ${barcodeVal ? "text-gray-500" : "text-red-400"}`}>
                      {barcodeVal || "⚠️ لا يوجد باركود"}
                    </div>
                    <div className="text-base font-black text-indigo-600">
                      {(product.sellingPrice ?? 0).toLocaleString()} ج.م
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => setEditingProduct(product)}
                        className="flex-1 py-2 text-sm font-bold bg-white border-2 border-gray-200 rounded-xl hover:bg-indigo-50 hover:border-indigo-300 flex items-center justify-center gap-1.5"
                      >
                        <Edit3 size={13} className="text-indigo-600" /> تحرير
                      </button>
                      <button
                        onClick={(e) => handleGenerateBarcode(product, e)}
                        className="px-3 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700"
                      >
                        <RefreshCw size={15} />
                      </button>
                      <button
                        onClick={() => setSelectedProducts((prev) => {
                          const next = new Map(prev);
                          if (next.has(product.id)) next.delete(product.id);
                          else next.set(product.id, 1);
                          return next;
                        })}
                        className={`px-3 py-2 rounded-xl border-2 font-bold text-xs transition-colors ${
                          isSelected
                            ? "bg-indigo-600 border-indigo-600 text-white"
                            : "bg-white border-gray-200 text-gray-600 hover:border-indigo-400"
                        }`}
                      >
                        {isSelected ? <Check size={14} /> : <Plus size={14} />}
                      </button>
                    </div>

                    {isSelected && (
                      <div className="flex items-center justify-between bg-white border-2 border-indigo-100 rounded-xl p-2">
                        <span className="text-xs font-bold text-gray-600">عدد النسخ:</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setSelectedProducts((p) => {
                              const n = new Map(p);
                              n.set(product.id, Math.max(1, (n.get(product.id) ?? 1) - 1));
                              return n;
                            })}
                            className="w-7 h-7 flex items-center justify-center bg-gray-100 rounded-lg hover:bg-gray-200 font-bold"
                          ><Minus size={12} /></button>
                          <input
                            type="number" min="1" value={qty}
                            onChange={(e) => setSelectedProducts((p) => {
                              const n = new Map(p);
                              n.set(product.id, Math.max(1, parseInt(e.target.value) || 1));
                              return n;
                            })}
                            className="w-12 text-center font-black text-sm border-2 border-gray-200 rounded-lg py-1 outline-none focus:border-indigo-400"
                          />
                          <button
                            onClick={() => setSelectedProducts((p) => {
                              const n = new Map(p);
                              n.set(product.id, (n.get(product.id) ?? 1) + 1);
                              return n;
                            })}
                            className="w-7 h-7 flex items-center justify-center bg-gray-100 rounded-lg hover:bg-gray-200 font-bold"
                          ><Plus size={12} /></button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editingProduct && (
        <LabelEditorModal
          product={editingProduct}
          settings={settings}
          meta={metaMap[editingProduct.id] ?? { fields: {}, barcodeValue: editingProduct.barcode ?? "" }}
          onSave={(newMeta) => handleSaveMeta(editingProduct.id, newMeta)}
          onClose={() => setEditingProduct(null)}
        />
      )}

      {showSettings && (
        <SettingsModal
          settings={settings}
          printers={printers}
          onSave={(newSettings) => setSettings(newSettings)}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showTemplates && (
        <div className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-black">🖨️ اختر قالب الطباعة</h3>
              <button onClick={() => setShowTemplates(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => {
                    setSettings((prev) => ({
                      ...prev,
                      templateId: tpl.id,
                      labelWidth: tpl.w,
                      labelHeight: tpl.h,
                      barcodeWidth: tpl.bw,
                      barcodeHeight: tpl.bh,
                      paddingTop: tpl.pt,
                      paddingBottom: tpl.pb,
                      paddingLeft: tpl.pl,
                      paddingRight: tpl.pr,
                    }));
                    setShowTemplates(false);
                  }}
                  className={`w-full p-4 border-2 rounded-xl text-right hover:shadow-md transition-all ${
                    settings.templateId === tpl.id ? "border-violet-500 bg-violet-50" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{tpl.emoji}</span>
                    <div className="flex-1">
                      <div className="font-bold text-gray-800">{tpl.name}</div>
                      <div className="text-xs text-gray-500">{tpl.desc}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {tpl.w}×{tpl.h}mm · باركود {tpl.bw}×{tpl.bh}mm
                      </div>
                    </div>
                    {settings.templateId === tpl.id && <Check size={20} className="text-violet-600 flex-shrink-0" />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showPreview && sampleProduct && (
        <div className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">🔍 معاينة الملصق</h3>
              <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="text-xs text-gray-500 mb-3 text-center">{sampleProduct.name}</div>
            <div
              className="flex justify-center bg-gray-50 rounded-xl p-6 overflow-hidden border-2 border-dashed border-gray-300"
              style={{ minHeight: `${settings.labelHeight * 3.5 + 48}px` }}
            >
              <div
                style={{
                  transform: "scale(3.5)",
                  transformOrigin: "top center",
                  marginBottom: `${settings.labelHeight * 2.5}px`,
                }}
                dangerouslySetInnerHTML={{ __html: buildLabelHTML(sampleProduct) }}
              />
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowPreview(false)}
                className="flex-1 py-2.5 border border-gray-300 rounded-xl text-gray-600 font-bold text-sm hover:bg-gray-50"
              >إغلاق</button>
              <button
                onClick={() => { handlePrint(); setShowPreview(false); }}
                disabled={selectedProducts.size === 0}
                className="flex-1 py-2.5 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 disabled:opacity-50 text-sm active:scale-95"
              >طباعة الآن</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}