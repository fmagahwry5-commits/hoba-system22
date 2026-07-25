// src/components/Treasury.tsx
import { useState, useMemo } from "react";
import { addTreasuryEntry, loadState, saveState } from "../store";
import {
  Wallet, Plus, TrendingUp, TrendingDown, Wrench,
  DollarSign, RotateCcw, RefreshCw, X, Search,
  ShoppingBag, Filter, ChevronDown, AlertCircle,
} from "lucide-react";

interface TreasuryEntry {
  id: string;
  type: string;
  direction: "in" | "out";
  description: string;
  amount: number;
  date: string;
  time: string;
  invoiceId?: string;
  invoiceNumber?: string;
}

interface Treasury {
  balance: number;
  entries: TreasuryEntry[];
}

interface Props {
  treasury: Treasury;
  currency: string;
  onUpdate: (treasury: Treasury) => void;
}

const TYPE_LABELS: Record<string, string> = {
  sale: "مبيعات",
  purchase: "مشتريات",
  return_sale: "مرتجع مبيعات",
  return_purchase: "مرتجع مشتريات",
  maintenance: "صيانة",
  accessory_sale: "بيع اكسسوار",
  accessory_purchase: "شراء اكسسوار",
  installment: "قسط",
  deposit: "إيداع",
  withdraw: "سحب",
  maintenance_withdraw: "سحب صيانة",
  accessory_withdraw: "سحب اكسسوار",
  installment_withdraw: "سحب أقساط",
};

const TYPE_COLORS: Record<string, string> = {
  sale: "bg-blue-100 text-blue-700",
  purchase: "bg-green-100 text-green-700",
  return_sale: "bg-orange-100 text-orange-700",
  return_purchase: "bg-purple-100 text-purple-700",
  maintenance: "bg-violet-100 text-violet-700",
  maintenance_withdraw: "bg-violet-100 text-violet-700",
  accessory_sale: "bg-amber-100 text-amber-700",
  accessory_purchase: "bg-teal-100 text-teal-700",
  accessory_withdraw: "bg-amber-100 text-amber-700",
  installment: "bg-indigo-100 text-indigo-700",
  installment_withdraw: "bg-indigo-100 text-indigo-700",
  deposit: "bg-emerald-100 text-emerald-700",
  withdraw: "bg-red-100 text-red-700",
};

export default function TreasuryPage({ treasury, currency, onUpdate }: Props) {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterDir, setFilterDir] = useState<"all" | "in" | "out">("all");
  const [showAddModal, setShowAddModal] = useState(false);

  // ✅ نافذة الصرف المحددة
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawSource, setWithdrawSource] = useState<"maintenance" | "accessory" | "installment" | "general">("general");
  const [withdrawAmount, setWithdrawAmount] = useState(0);
  const [withdrawDesc, setWithdrawDesc] = useState("");

  const [addForm, setAddForm] = useState({
    type: "deposit",
    direction: "in" as "in" | "out",
    description: "",
    amount: 0,
  });

  const entries = Array.isArray(treasury?.entries) ? treasury.entries : [];

  const filtered = useMemo(() => {
    return entries.filter(e => {
      if (filterDir !== "all" && e.direction !== filterDir) return false;
      if (filterType !== "all" && e.type !== filterType) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return e.description?.toLowerCase().includes(q) || e.invoiceNumber?.toLowerCase().includes(q);
    }).sort((a, b) => new Date(b.date + " " + b.time).getTime() - new Date(a.date + " " + a.time).getTime());
  }, [entries, filterDir, filterType, search]);

  const stats = useMemo(() => {
    const totalIn = entries.filter(e => e.direction === "in").reduce((s, e) => s + (e.amount ?? 0), 0);
    const totalOut = entries.filter(e => e.direction === "out").reduce((s, e) => s + (e.amount ?? 0), 0);
    const maintenanceTotal = entries.filter(e => e.type === "maintenance" && e.direction === "in").reduce((s, e) => s + (e.amount ?? 0), 0);
    const maintenanceWithdrawn = entries.filter(e => e.type === "maintenance_withdraw").reduce((s, e) => s + (e.amount ?? 0), 0);
    const accessoryTotal = entries.filter(e => e.type === "accessory_sale" && e.direction === "in").reduce((s, e) => s + (e.amount ?? 0), 0);
    const accessoryWithdrawn = entries.filter(e => e.type === "accessory_withdraw").reduce((s, e) => s + (e.amount ?? 0), 0);
    const installmentTotal = entries.filter(e => e.type === "installment").reduce((s, e) => s + (e.amount ?? 0), 0);
    const installmentWithdrawn = entries.filter(e => e.type === "installment_withdraw").reduce((s, e) => s + (e.amount ?? 0), 0);
    return { totalIn, totalOut, maintenanceTotal, maintenanceWithdrawn, accessoryTotal, accessoryWithdrawn, installmentTotal, installmentWithdrawn };
  }, [entries]);

  const handleAdd = () => {
    if (!addForm.amount || addForm.amount <= 0 || !addForm.description.trim()) return;
    const now = new Date();
    const newEntry: TreasuryEntry = {
      id: `t-${Date.now()}`,
      type: addForm.type,
      direction: addForm.direction,
      description: addForm.description,
      amount: addForm.amount,
      date: now.toISOString().split("T")[0],
      time: now.toLocaleTimeString("ar-EG"),
    };
    const updated = {
      balance: (treasury.balance ?? 0) + (addForm.direction === "in" ? addForm.amount : -addForm.amount),
      entries: [newEntry, ...entries],
    };
    onUpdate(updated);
    setAddForm({ type: "deposit", direction: "in", description: "", amount: 0 });
    setShowAddModal(false);
  };

  // ✅ الصرف المحدد من بند معين
  const handleWithdraw = () => {
    if (!withdrawAmount || withdrawAmount <= 0) return;

    const now = new Date();
    const typeMap = {
      maintenance: "maintenance_withdraw",
      accessory: "accessory_withdraw",
      installment: "installment_withdraw",
      general: "withdraw",
    };
    const descMap = {
      maintenance: `سحب من الصيانة - ${withdrawDesc || ""}`,
      accessory: `سحب من الاكسسوار - ${withdrawDesc || ""}`,
      installment: `سحب من الأقساط - ${withdrawDesc || ""}`,
      general: withdrawDesc || "سحب عام",
    };

    const newEntry: TreasuryEntry = {
      id: `t-${Date.now()}`,
      type: typeMap[withdrawSource],
      direction: "out",
      description: descMap[withdrawSource],
      amount: withdrawAmount,
      date: now.toISOString().split("T")[0],
      time: now.toLocaleTimeString("ar-EG"),
    };
    const updated = {
      balance: Math.max(0, (treasury.balance ?? 0) - withdrawAmount),
      entries: [newEntry, ...entries],
    };
    onUpdate(updated);
    setWithdrawAmount(0);
    setWithdrawDesc("");
    setShowWithdrawModal(false);
  };

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center"><Wallet size={24} /></div>
            <div>
              <h2 className="text-xl font-black">الخزنة</h2>
              <p className="text-emerald-200 text-sm">الرصيد الحالي</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* ✅ زر الصرف المحدد */}
            <button onClick={() => setShowWithdrawModal(true)} className="flex items-center gap-2 px-4 py-2.5 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 active:scale-95 shadow-md text-sm">
              <TrendingDown size={15} /> صرف محدد
            </button>
            <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2.5 bg-white text-emerald-700 rounded-xl font-bold hover:bg-emerald-50 active:scale-95 shadow-md text-sm">
              <Plus size={15} /> إضافة حركة
            </button>
          </div>
        </div>

        <div className="text-4xl font-black mb-4">{(treasury.balance ?? 0).toLocaleString()} <span className="text-lg font-normal opacity-70">{currency}</span></div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "إجمالي الدخل", value: stats.totalIn, color: "bg-white/15" },
            { label: "إجمالي الصرف", value: stats.totalOut, color: "bg-white/15" },
            { label: "صيانة صافي", value: stats.maintenanceTotal - stats.maintenanceWithdrawn, color: "bg-violet-500/30" },
            { label: "اكسسوار صافي", value: stats.accessoryTotal - stats.accessoryWithdrawn, color: "bg-amber-500/30" },
          ].map(s => (
            <div key={s.label} className={`${s.color} rounded-xl p-3 text-center`}>
              <div className="text-xs opacity-75 mb-0.5">{s.label}</div>
              <div className="text-lg font-black">{s.value.toLocaleString()}</div>
              <div className="text-xs opacity-60">{currency}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ✅ ملخص البنود */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "الصيانة", total: stats.maintenanceTotal, withdrawn: stats.maintenanceWithdrawn, icon: Wrench, color: "violet" },
          { label: "الاكسسوار", total: stats.accessoryTotal, withdrawn: stats.accessoryWithdrawn, icon: ShoppingBag, color: "amber" },
          { label: "الأقساط", total: stats.installmentTotal, withdrawn: stats.installmentWithdrawn, icon: DollarSign, color: "indigo" },
        ].map(({ label, total, withdrawn, icon: Icon, color }) => (
          <div key={label} className={`bg-${color}-50 border border-${color}-100 rounded-2xl p-4`}>
            <div className="flex items-center gap-2 mb-2">
              <Icon size={16} className={`text-${color}-600`} />
              <span className="text-sm font-bold text-gray-700">{label}</span>
            </div>
            <div className={`text-xl font-black text-${color}-700`}>{total.toLocaleString()}</div>
            <div className="text-xs text-gray-400 mt-0.5">تم سحب: {withdrawn.toLocaleString()}</div>
            <div className={`text-sm font-bold text-${color}-600 mt-1`}>المتبقي: {(total - withdrawn).toLocaleString()}</div>
            <button
              onClick={() => { setWithdrawSource(label === "الصيانة" ? "maintenance" : label === "الاكسسوار" ? "accessory" : "installment"); setShowWithdrawModal(true); }}
              className={`w-full mt-2 py-1.5 bg-${color}-100 text-${color}-700 rounded-lg text-xs font-bold hover:bg-${color}-200 transition-colors`}
            >
              صرف من {label}
            </button>
          </div>
        ))}
      </div>

      {/* فلاتر */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} className="w-full border border-gray-200 rounded-xl pr-9 pl-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" placeholder="بحث في الحركات..." />
            {search && <button onClick={() => setSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>}
          </div>
          <div className="flex gap-2">
            {(["all", "in", "out"] as const).map(d => (
              <button key={d} onClick={() => setFilterDir(d)} className={`px-3 py-2 rounded-xl text-xs font-bold ${filterDir === d ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {d === "all" ? "الكل" : d === "in" ? "دخل" : "صرف"}
              </button>
            ))}
          </div>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white">
            <option value="all">جميع الأنواع</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      {/* جدول الحركات */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-emerald-50 border-b border-emerald-100">
              <tr>
                {["النوع", "الوصف", "التاريخ", "المبلغ", "الاتجاه"].map(h => (
                  <th key={h} className="px-3 py-3 text-right font-bold text-xs text-emerald-700">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-gray-400">
                  <Wallet size={32} className="mx-auto mb-2 opacity-20" /><div>لا توجد حركات</div>
                </td></tr>
              ) : filtered.map((entry, idx) => (
                <tr key={entry.id} className={`border-t border-gray-50 hover:bg-gray-50 ${idx % 2 === 0 ? "" : "bg-gray-50/30"}`}>
                  <td className="px-3 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${TYPE_COLORS[entry.type] ?? "bg-gray-100 text-gray-600"}`}>
                      {TYPE_LABELS[entry.type] ?? entry.type}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-gray-700 text-sm">{entry.description}</td>
                  <td className="px-3 py-3 text-gray-400 text-xs whitespace-nowrap">{entry.date} {entry.time}</td>
                  <td className="px-3 py-3 font-black text-gray-800">{(entry.amount ?? 0).toLocaleString()} {currency}</td>
                  <td className="px-3 py-3">
                    <span className={`flex items-center gap-1 text-xs font-bold ${entry.direction === "in" ? "text-emerald-600" : "text-red-600"}`}>
                      {entry.direction === "in" ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {entry.direction === "in" ? "دخل" : "صرف"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="bg-emerald-50 border-t-2 border-emerald-100 font-bold">
                  <td colSpan={3} className="px-3 py-2.5 text-emerald-700 text-sm">المجموع ({filtered.length} حركة)</td>
                  <td className="px-3 py-2.5 text-gray-800">
                    <span className="text-emerald-700">+{filtered.filter(e => e.direction === "in").reduce((s, e) => s + e.amount, 0).toLocaleString()}</span>
                    {" / "}
                    <span className="text-red-700">-{filtered.filter(e => e.direction === "out").reduce((s, e) => s + e.amount, 0).toLocaleString()}</span>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ✅ نافذة الصرف المحدد */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-gradient-to-r from-red-600 to-red-700 px-5 py-4 text-white flex items-center justify-between">
              <h3 className="font-black flex items-center gap-2 text-base"><TrendingDown size={18} /> صرف من الخزنة</h3>
              <button onClick={() => setShowWithdrawModal(false)} className="text-white/70 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1.5 block">المصدر</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "general", label: "عام", icon: Wallet },
                    { id: "maintenance", label: "الصيانة", icon: Wrench },
                    { id: "accessory", label: "الاكسسوار", icon: ShoppingBag },
                    { id: "installment", label: "الأقساط", icon: DollarSign },
                  ].map(({ id, label, icon: Icon }) => (
                    <button key={id} onClick={() => setWithdrawSource(id as any)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-sm font-bold transition-all ${withdrawSource === id ? "border-red-500 bg-red-50 text-red-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                      <Icon size={14} /> {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">المبلغ *</label>
                <input type="number" min="1" value={withdrawAmount || ""} onChange={e => setWithdrawAmount(Number(e.target.value))}
                  className="w-full border-2 border-red-300 rounded-xl px-4 py-4 text-2xl font-black text-center outline-none focus:border-red-500"
                  placeholder="0" autoFocus />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">البيان</label>
                <input type="text" value={withdrawDesc} onChange={e => setWithdrawDesc(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-red-400"
                  placeholder="سبب الصرف..." />
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={handleWithdraw} disabled={!withdrawAmount || withdrawAmount <= 0} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black hover:bg-red-700 active:scale-95 disabled:opacity-50 shadow-md shadow-red-200">
                تأكيد الصرف
              </button>
              <button onClick={() => { setShowWithdrawModal(false); setWithdrawAmount(0); setWithdrawDesc(""); }} className="px-5 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة إضافة حركة */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-5 py-4 text-white flex items-center justify-between">
              <h3 className="font-black flex items-center gap-2 text-base"><Plus size={18} /> إضافة حركة</h3>
              <button onClick={() => setShowAddModal(false)} className="text-white/70 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">الاتجاه</label>
                <div className="flex gap-2">
                  <button onClick={() => setAddForm(f => ({ ...f, direction: "in", type: "deposit" }))} className={`flex-1 py-2 rounded-xl font-bold text-sm border-2 ${addForm.direction === "in" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-gray-200 text-gray-600"}`}><TrendingUp size={14} className="inline ml-1" />دخل</button>
                  <button onClick={() => setAddForm(f => ({ ...f, direction: "out", type: "withdraw" }))} className={`flex-1 py-2 rounded-xl font-bold text-sm border-2 ${addForm.direction === "out" ? "border-red-500 bg-red-50 text-red-700" : "border-gray-200 text-gray-600"}`}><TrendingDown size={14} className="inline ml-1" />صرف</button>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">النوع</label>
                <select value={addForm.type} onChange={e => setAddForm(f => ({ ...f, type: e.target.value }))} className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400 bg-white">
                  {addForm.direction === "in"
                    ? [["deposit", "إيداع"], ["sale", "مبيعات"], ["maintenance", "صيانة"], ["accessory_sale", "بيع اكسسوار"], ["installment", "قسط"], ["return_purchase", "مرتجع مشتريات"]].map(([k, v]) => <option key={k} value={k}>{v}</option>)
                    : [["withdraw", "سحب عام"], ["maintenance_withdraw", "سحب صيانة"], ["accessory_withdraw", "سحب اكسسوار"], ["installment_withdraw", "سحب أقساط"], ["purchase", "مشتريات"], ["return_sale", "مرتجع مبيعات"]].map(([k, v]) => <option key={k} value={k}>{v}</option>)
                  }
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">الوصف *</label>
                <input type="text" value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))} className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400" placeholder="وصف الحركة..." />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">المبلغ *</label>
                <input type="number" min="1" value={addForm.amount || ""} onChange={e => setAddForm(f => ({ ...f, amount: Number(e.target.value) }))} className="w-full border-2 border-emerald-300 rounded-xl px-4 py-4 text-2xl font-black text-center outline-none focus:border-emerald-500" placeholder="0" />
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={handleAdd} disabled={!addForm.amount || !addForm.description.trim()} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-black hover:bg-emerald-700 active:scale-95 disabled:opacity-50 shadow-md shadow-emerald-200">تأكيد</button>
              <button onClick={() => setShowAddModal(false)} className="px-5 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}