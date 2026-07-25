// src/components/Dashboard.tsx
import { Invoice, Product, InstallmentPayment } from '../types';
import {
  TrendingUp, TrendingDown, Clock, Package, AlertTriangle,
  ShoppingCart, Wrench, RotateCcw, DollarSign, Wallet,
  ArrowUpRight, ArrowDownLeft, BarChart3, Layers,
  AlertCircle, CheckCircle, XCircle, Activity, Calendar,
  ShoppingBag,
} from 'lucide-react';

interface Props {
  invoices: Invoice[];
  products: Product[];
  currency: string;
  onNewSale: () => void;
  onNewPurchase: () => void;
  installments?: InstallmentPayment[];
  treasuryBalance?: number;
}

// ── مكوّن صف الملخص داخل الكارت ──────────────────────
function SummaryRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex justify-between items-center bg-white/10 rounded-xl px-3 py-2">
      <span className="text-sm flex items-center gap-2 opacity-90">
        <Icon size={14} />{label}
      </span>
      <span className="text-sm font-bold">{value}</span>
    </div>
  );
}

// ── مكوّن كارت فاتورة صغير داخل الكارت الكبير ──────────
function MiniInvoiceRow({
  name, number, date, amount, currency, color = "bg-white/20",
}: { name: string; number?: string; date?: string; amount: number; currency: string; color?: string }) {
  return (
    <div className="flex items-center justify-between bg-white/10 rounded-xl px-3 py-2">
      <div className="flex items-center gap-2.5">
        <div className={`w-7 h-7 ${color} rounded-full flex items-center justify-center text-sm font-black`}>
          {name.charAt(0) || "?"}
        </div>
        <div>
          <div className="text-sm font-semibold leading-tight">{name || "بدون اسم"}</div>
          {(number || date) && (
            <div className="text-[11px] opacity-60">{[number, date].filter(Boolean).join(" · ")}</div>
          )}
        </div>
      </div>
      <div className="text-sm font-bold">{amount.toLocaleString()} <span className="text-[11px] opacity-60">{currency}</span></div>
    </div>
  );
}

// ── مكوّن الكارت الرئيسي ────────────────────────────────
function MainCard({
  gradient, icon: Icon, title, subtitle, total, currency,
  stats, children,
}: {
  gradient: string; icon: any; title: string; subtitle: string;
  total: number; currency: string;
  stats: { label: string; value: string | number; unit?: string }[];
  children?: React.ReactNode;
}) {
  return (
    <div className={`${gradient} rounded-2xl p-6 text-white shadow-xl`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
            <Icon size={24} />
          </div>
          <div>
            <div className="text-xl font-black">{title}</div>
            <div className="text-sm opacity-70 mt-0.5">{subtitle}</div>
          </div>
        </div>
        <div className="text-left">
          <div className="text-4xl font-black">{total.toLocaleString()}</div>
          <div className="text-sm opacity-60 mt-0.5">{currency}</div>
        </div>
      </div>

      {/* Stats */}
      <div className={`grid grid-cols-${Math.min(stats.length, 3)} gap-3 pt-4 border-t border-white/20`}>
        {stats.map((s) => (
          <div key={s.label} className="bg-white/10 rounded-xl p-3 text-center">
            <div className="text-xs opacity-70 mb-1">{s.label}</div>
            <div className="text-xl font-black">{typeof s.value === "number" ? s.value.toLocaleString() : s.value}</div>
            {s.unit && <div className="text-xs opacity-60 mt-0.5">{s.unit}</div>}
          </div>
        ))}
      </div>

      {/* Children (recent items) */}
      {children && (
        <div className="mt-4 pt-4 border-t border-white/20 space-y-2">
          {children}
        </div>
      )}
    </div>
  );
}

export default function Dashboard({
  invoices, products, currency, installments = [], treasuryBalance = 0,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const todayAr = new Date().toLocaleDateString("ar-EG");

  // ── فلترة الفواتير ──────────────────────────────────────
  const sales           = invoices.filter(i => i.type === "sale"             && i.status === "closed");
  const purchases       = invoices.filter(i => i.type === "purchase"         && i.status === "closed");
  const maintenance     = invoices.filter(i => i.type === "maintenance"      && i.status === "closed");
  const returnSales     = invoices.filter(i => i.type === "return_sale"      && i.status === "closed");
  const returnPurchases = invoices.filter(i => i.type === "return_purchase"  && i.status === "closed");
  const accessorySales  = invoices.filter(i => i.type === "accessory_sale"   && i.status === "closed");
  const accessoryPurch  = invoices.filter(i => i.type === "accessory_purchase"&& i.status === "closed");
  const pending         = invoices.filter(i => i.status === "pending");
  const todaySales      = sales.filter(i => i.date === today);
  const todayAll        = invoices.filter(i => i.date === today);
  const lowStock        = products.filter(p => (p.stock ?? 0) <= 5);
  const outOfStock      = products.filter(p => (p.stock ?? 0) === 0);

  // ── الإجماليات ────────────────────────────────────────────
  const totalSales         = sales.reduce((s, i)          => s + (i.paid ?? 0), 0);
  const totalPurchases     = purchases.reduce((s, i)      => s + (i.paid ?? 0), 0);
  const totalMaintenance   = maintenance.reduce((s, i)    => s + (i.paid ?? 0), 0);
  const totalReturnSales   = returnSales.reduce((s, i)    => s + (i.paid ?? 0), 0);
  const totalReturnPurchases = returnPurchases.reduce((s,i)=>s+(i.paid??0),0);
  const totalAccessSales   = accessorySales.reduce((s, i) => s + (i.paid ?? 0), 0);
  const totalAccessPurch   = accessoryPurch.reduce((s, i) => s + (i.paid ?? 0), 0);
  const totalPending       = pending.reduce((s, i)        => s + (i.remaining ?? 0), 0);
  const todayRevenue       = todaySales.reduce((s, i)     => s + (i.paid ?? 0), 0);
  const totalInstallments  = installments.reduce((s, p)   => s + (p.amount ?? 0), 0);
  const todayInstallments  = installments.filter(p => p.date === todayAr);

  const netSalesPurchases = totalSales - totalPurchases - totalReturnSales + totalReturnPurchases;
  const netAccessory      = totalAccessSales - totalAccessPurch;
  const totalOverall      = netSalesPurchases + totalMaintenance + totalInstallments + netAccessory;

  // ── فرز أحدث الفواتير ─────────────────────────────────────
  const sortByDate = (arr: Invoice[]) =>
    [...arr].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());

  const recentSales      = sortByDate(sales).slice(0, 3);
  const recentPurchases  = sortByDate(purchases).slice(0, 3);
  const recentMaint      = sortByDate(maintenance).slice(0, 3);
  const recentPending    = sortByDate(pending).slice(0, 3);
  const recentAccessory  = sortByDate(accessorySales).slice(0, 3);
  const recentInvoices   = sortByDate(invoices).slice(0, 10);

  const typeLabel: Record<string, string> = {
    sale: "مبيعات", purchase: "مشتريات",
    return_sale: "مرتجع بيع", return_purchase: "مرتجع شراء",
    maintenance: "صيانة", accessory_sale: "اكسسوار بيع",
    accessory_purchase: "اكسسوار شراء",
  };

  return (
    <div className="space-y-6" dir="rtl">

      {/* ══════════════════════════════════════════════════════
          بطاقة المبيعات
      ══════════════════════════════════════════════════════ */}
      <MainCard
        gradient="bg-gradient-to-br from-blue-500 via-blue-600 to-blue-800"
        icon={TrendingUp} title="المبيعات" subtitle={`${sales.length} فاتورة مغلقة`}
        total={totalSales} currency={currency}
        stats={[
          { label: "اليوم", value: todayRevenue, unit: `${currency} · ${todaySales.length} فاتورة` },
          { label: "متوسط الفاتورة", value: sales.length > 0 ? Math.round(totalSales / sales.length) : 0, unit: currency },
          { label: "عدد العملاء", value: new Set(sales.map(s => s.customerName).filter(Boolean)).size, unit: "عميل" },
        ]}
      >
        {recentSales.length > 0 && (
          <>
            <div className="text-sm font-bold opacity-80 mb-1">📋 آخر الفواتير:</div>
            {recentSales.map(inv => (
              <MiniInvoiceRow key={inv.id} name={inv.customerName || "بدون اسم"} number={inv.number} date={inv.date} amount={inv.paid ?? 0} currency={currency} color="bg-blue-400/40" />
            ))}
          </>
        )}
      </MainCard>

      {/* ══════════════════════════════════════════════════════
          بطاقة المشتريات
      ══════════════════════════════════════════════════════ */}
      <MainCard
        gradient="bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-800"
        icon={TrendingDown} title="المشتريات" subtitle={`${purchases.length} فاتورة مغلقة`}
        total={totalPurchases} currency={currency}
        stats={[
          { label: "اليوم", value: purchases.filter(i => i.date === today).reduce((s, i) => s + (i.paid ?? 0), 0), unit: currency },
          { label: "متوسط الفاتورة", value: purchases.length > 0 ? Math.round(totalPurchases / purchases.length) : 0, unit: currency },
          { label: "عدد الموردين", value: new Set(purchases.map(p => p.supplierName).filter(Boolean)).size, unit: "مورد" },
        ]}
      >
        {recentPurchases.length > 0 && (
          <>
            <div className="text-sm font-bold opacity-80 mb-1">📋 آخر الفواتير:</div>
            {recentPurchases.map(inv => (
              <MiniInvoiceRow key={inv.id} name={inv.supplierName || "بدون اسم"} number={inv.number} date={inv.date} amount={inv.paid ?? 0} currency={currency} color="bg-emerald-400/40" />
            ))}
          </>
        )}
      </MainCard>

      {/* ══════════════════════════════════════════════════════
          بطاقة الصيانة
      ══════════════════════════════════════════════════════ */}
      <MainCard
        gradient="bg-gradient-to-br from-violet-500 via-violet-600 to-violet-800"
        icon={Wrench} title="الصيانة" subtitle={`${maintenance.length} أمر صيانة`}
        total={totalMaintenance} currency={currency}
        stats={[
          { label: "اليوم", value: maintenance.filter(i => i.date === today).reduce((s, i) => s + (i.paid ?? 0), 0), unit: currency },
          { label: "متوسط الأمر", value: maintenance.length > 0 ? Math.round(totalMaintenance / maintenance.length) : 0, unit: currency },
          { label: "عدد العملاء", value: new Set(maintenance.map(m => m.customerName).filter(Boolean)).size, unit: "عميل" },
        ]}
      >
        {recentMaint.length > 0 && (
          <>
            <div className="text-sm font-bold opacity-80 mb-1">📋 آخر أوامر الصيانة:</div>
            {recentMaint.map(inv => (
              <MiniInvoiceRow key={inv.id} name={inv.customerName || "بدون اسم"} number={inv.number} date={inv.date} amount={inv.paid ?? 0} currency={currency} color="bg-violet-400/40" />
            ))}
          </>
        )}
      </MainCard>

      {/* ══════════════════════════════════════════════════════
          بطاقة الاكسسوار
      ══════════════════════════════════════════════════════ */}
      <MainCard
        gradient="bg-gradient-to-br from-amber-500 via-amber-600 to-orange-700"
        icon={ShoppingBag} title="بيع الاكسسوارات" subtitle={`${accessorySales.length} فاتورة · شراء: ${accessoryPurch.length}`}
        total={totalAccessSales} currency={currency}
        stats={[
          { label: "بيع اكسسوار", value: totalAccessSales, unit: currency },
          { label: "شراء اكسسوار", value: totalAccessPurch, unit: currency },
          { label: "صافي الاكسسوار", value: netAccessory >= 0 ? `+${netAccessory.toLocaleString()}` : netAccessory.toLocaleString(), unit: currency },
        ]}
      >
        {recentAccessory.length > 0 && (
          <>
            <div className="text-sm font-bold opacity-80 mb-1">📋 آخر فواتير الاكسسوار:</div>
            {recentAccessory.map(inv => (
              <MiniInvoiceRow key={inv.id} name={inv.customerName || "بدون اسم"} number={inv.number} date={inv.date} amount={inv.paid ?? 0} currency={currency} color="bg-amber-400/40" />
            ))}
          </>
        )}
      </MainCard>

      {/* ══════════════════════════════════════════════════════
          بطاقة الأقساط
      ══════════════════════════════════════════════════════ */}
      <MainCard
        gradient="bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-800"
        icon={DollarSign} title="الأقساط" subtitle={`${installments.length} دفعة إجمالاً`}
        total={totalInstallments} currency={currency}
        stats={[
          { label: "اليوم", value: todayInstallments.reduce((s, p) => s + p.amount, 0), unit: `${currency} · ${todayInstallments.length} دفعة` },
          { label: "متوسط الدفعة", value: installments.length > 0 ? Math.round(totalInstallments / installments.length) : 0, unit: currency },
          { label: "عدد العملاء", value: new Set(installments.map(p => p.customerName)).size, unit: "عميل" },
        ]}
      >
        {installments.length > 0 && (
          <>
            <div className="text-sm font-bold opacity-80 mb-1">📋 آخر الدفعات:</div>
            {[...installments].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3).map(p => (
              <MiniInvoiceRow key={p.id} name={p.customerName} date={`${p.date} ${p.time ?? ""}`} amount={p.amount} currency={currency} color="bg-indigo-400/40" />
            ))}
          </>
        )}
      </MainCard>

      {/* ══════════════════════════════════════════════════════
          بطاقة الفواتير المعلقة
      ══════════════════════════════════════════════════════ */}
      <MainCard
        gradient="bg-gradient-to-br from-amber-500 via-orange-500 to-orange-700"
        icon={Clock} title="الفواتير المعلقة" subtitle={`${pending.length} فاتورة`}
        total={totalPending} currency={currency}
        stats={[
          { label: "إجمالي الفواتير", value: pending.reduce((s, i) => s + i.total, 0), unit: currency },
          { label: "المدفوع منها", value: pending.reduce((s, i) => s + (i.total - (i.remaining ?? 0)), 0), unit: currency },
          { label: "متوسط المتبقي", value: pending.length > 0 ? Math.round(totalPending / pending.length) : 0, unit: currency },
        ]}
      >
        {recentPending.length > 0 && (
          <>
            <div className="text-sm font-bold opacity-80 mb-1">📋 آخر المعلقات:</div>
            {recentPending.map(inv => (
              <div key={inv.id} className="flex items-center justify-between bg-white/10 rounded-xl px-3 py-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center text-sm font-black">
                    {(inv.customerName || inv.supplierName || "?").charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{inv.customerName || inv.supplierName || "بدون"}</div>
                    <div className="text-[11px] opacity-60">{inv.date} · {typeLabel[inv.type] ?? inv.type}</div>
                  </div>
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold">{(inv.remaining ?? 0).toLocaleString()} <span className="text-[11px] opacity-60">{currency}</span></div>
                  <div className="text-[11px] opacity-60">من {inv.total.toLocaleString()}</div>
                </div>
              </div>
            ))}
          </>
        )}
      </MainCard>

      {/* ══════════════════════════════════════════════════════
          بطاقة المرتجعات
      ══════════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-br from-rose-500 via-pink-600 to-pink-800 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center"><RotateCcw size={24} /></div>
            <div>
              <div className="text-xl font-black">المرتجعات</div>
              <div className="text-sm opacity-70 mt-0.5">{returnSales.length + returnPurchases.length} عملية إجمالاً</div>
            </div>
          </div>
          <div className="text-left">
            <div className="text-4xl font-black">{(totalReturnSales + totalReturnPurchases).toLocaleString()}</div>
            <div className="text-sm opacity-60 mt-0.5">{currency}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
          <div className="bg-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <ArrowDownLeft size={16} className="opacity-80" />
              <span className="text-sm font-bold">مرتجع مبيعات</span>
              <span className="mr-auto text-xs bg-white/20 px-2 py-0.5 rounded-full">{returnSales.length}</span>
            </div>
            <div className="text-3xl font-black">{totalReturnSales.toLocaleString()}</div>
            <div className="text-xs opacity-60 mt-1">{currency} · يُخصم من المبيعات</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <ArrowUpRight size={16} className="opacity-80" />
              <span className="text-sm font-bold">مرتجع مشتريات</span>
              <span className="mr-auto text-xs bg-white/20 px-2 py-0.5 rounded-full">{returnPurchases.length}</span>
            </div>
            <div className="text-3xl font-black">{totalReturnPurchases.toLocaleString()}</div>
            <div className="text-xs opacity-60 mt-1">{currency} · يُضاف للمبيعات</div>
          </div>
        </div>

        {(returnSales.length > 0 || returnPurchases.length > 0) && (
          <div className="mt-4 pt-4 border-t border-white/20 space-y-2">
            <div className="text-sm font-bold opacity-80 mb-1">📋 آخر المرتجعات:</div>
            {[...returnSales, ...returnPurchases]
              .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
              .slice(0, 3)
              .map(inv => (
                <MiniInvoiceRow key={inv.id}
                  name={inv.type === "return_sale" ? (inv.customerName || "عميل") : (inv.supplierName || "مورد")}
                  number={inv.type === "return_sale" ? "↩️ مرتجع بيع" : "↪️ مرتجع شراء"}
                  date={inv.date} amount={inv.paid ?? 0} currency={currency}
                  color={inv.type === "return_sale" ? "bg-orange-400/40" : "bg-purple-400/40"}
                />
              ))}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          بطاقات الصافي والإجمالي (3 بطاقات)
      ══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* صافي البيع/الشراء */}
        <div className={`rounded-2xl p-6 text-white shadow-xl ${netSalesPurchases >= 0 ? "bg-gradient-to-br from-teal-500 to-teal-700" : "bg-gradient-to-br from-red-600 to-red-800"}`}>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center"><BarChart3 size={24} /></div>
            <div>
              <div className="text-xl font-black">صافي البيع والشراء</div>
              <div className="text-sm opacity-70">بدون صيانة وأقساط</div>
            </div>
          </div>
          <div className="text-4xl font-black mb-5">{netSalesPurchases.toLocaleString()} <span className="text-base opacity-60">{currency}</span></div>
          <div className="space-y-2 pt-4 border-t border-white/20">
            <SummaryRow icon={TrendingUp} label="مبيعات" value={`+${totalSales.toLocaleString()}`} />
            <SummaryRow icon={TrendingDown} label="مشتريات" value={`-${totalPurchases.toLocaleString()}`} />
            {totalReturnSales > 0 && <SummaryRow icon={ArrowDownLeft} label="مرتجع بيع" value={`-${totalReturnSales.toLocaleString()}`} />}
            {totalReturnPurchases > 0 && <SummaryRow icon={ArrowUpRight} label="مرتجع شراء" value={`+${totalReturnPurchases.toLocaleString()}`} />}
          </div>
        </div>

        {/* صافي الاكسسوار + صيانة */}
        <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center"><Activity size={24} /></div>
            <div>
              <div className="text-xl font-black">صيانة واكسسوار</div>
              <div className="text-sm opacity-70">منفصلة</div>
            </div>
          </div>
          <div className="text-4xl font-black mb-5">{(totalMaintenance + netAccessory).toLocaleString()} <span className="text-base opacity-60">{currency}</span></div>
          <div className="space-y-2 pt-4 border-t border-white/20">
            <SummaryRow icon={Wrench} label="صيانة" value={`+${totalMaintenance.toLocaleString()}`} />
            <SummaryRow icon={ShoppingBag} label="بيع اكسسوار" value={`+${totalAccessSales.toLocaleString()}`} />
            <SummaryRow icon={ShoppingBag} label="شراء اكسسوار" value={`-${totalAccessPurch.toLocaleString()}`} />
            <SummaryRow icon={DollarSign} label="أقساط مستلمة" value={`+${totalInstallments.toLocaleString()}`} />
          </div>
        </div>

        {/* الإجمالي الكلي */}
        <div className={`rounded-2xl p-6 text-white shadow-xl ${totalOverall >= 0 ? "bg-gradient-to-br from-blue-700 to-indigo-900" : "bg-gradient-to-br from-red-700 to-red-900"}`}>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center"><Wallet size={24} /></div>
            <div>
              <div className="text-xl font-black">الإجمالي الكلي</div>
              <div className="text-sm opacity-70">كل البنود</div>
            </div>
          </div>
          <div className="text-4xl font-black mb-5">{totalOverall.toLocaleString()} <span className="text-base opacity-60">{currency}</span></div>
          <div className="space-y-2 pt-4 border-t border-white/20">
            <SummaryRow icon={BarChart3} label="صافي بيع/شراء" value={`${netSalesPurchases >= 0 ? "+" : ""}${netSalesPurchases.toLocaleString()}`} />
            <SummaryRow icon={ShoppingBag} label="صافي اكسسوار" value={`${netAccessory >= 0 ? "+" : ""}${netAccessory.toLocaleString()}`} />
            <SummaryRow icon={Wrench} label="صيانة" value={`+${totalMaintenance.toLocaleString()}`} />
            <SummaryRow icon={DollarSign} label="أقساط" value={`+${totalInstallments.toLocaleString()}`} />
            <div className="flex justify-between items-center bg-white/20 rounded-xl px-3 py-2 mt-1">
              <span className="text-sm font-bold flex items-center gap-2"><Wallet size={14} /> رصيد الخزنة</span>
              <span className={`text-sm font-black ${treasuryBalance >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                {treasuryBalance.toLocaleString()} {currency}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          مبيعات اليوم + رصيد الخزنة
      ══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* مبيعات اليوم */}
        <div className="bg-gradient-to-br from-sky-500 via-cyan-500 to-cyan-700 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center"><Calendar size={24} /></div>
              <div>
                <div className="text-xl font-black">مبيعات اليوم</div>
                <div className="text-sm opacity-70">{new Date().toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div>
              </div>
            </div>
            <div className="text-left">
              <div className="text-4xl font-black">{todayRevenue.toLocaleString()}</div>
              <div className="text-sm opacity-60">{currency}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/20">
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <div className="text-sm opacity-70 mb-1">فواتير بيع</div>
              <div className="text-2xl font-black">{todaySales.length}</div>
              <div className="text-xs opacity-60">فاتورة</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <div className="text-sm opacity-70 mb-1">إجمالي حركة</div>
              <div className="text-2xl font-black">{todayAll.length}</div>
              <div className="text-xs opacity-60">فاتورة</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <div className="text-sm opacity-70 mb-1">متوسط</div>
              <div className="text-2xl font-black">{todaySales.length > 0 ? Math.round(todayRevenue / todaySales.length).toLocaleString() : 0}</div>
              <div className="text-xs opacity-60">{currency}</div>
            </div>
          </div>

          {todaySales.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/20 space-y-2">
              <div className="text-sm font-bold opacity-80 mb-1">📋 فواتير اليوم:</div>
              {todaySales.slice(0, 3).map(inv => (
                <MiniInvoiceRow key={inv.id} name={inv.customerName || "بدون اسم"} number={inv.number} amount={inv.paid ?? 0} currency={currency} color="bg-sky-400/40" />
              ))}
            </div>
          )}
        </div>

        {/* رصيد الخزنة */}
        <div className={`rounded-2xl p-6 text-white shadow-xl ${treasuryBalance >= 0 ? "bg-gradient-to-br from-emerald-600 to-green-800" : "bg-gradient-to-br from-red-600 to-red-800"}`}>
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center"><Wallet size={24} /></div>
              <div>
                <div className="text-xl font-black">رصيد الخزنة</div>
                <div className="text-sm opacity-70">الرصيد الفعلي الحالي</div>
              </div>
            </div>
            <div className="text-left">
              <div className="text-4xl font-black">{treasuryBalance.toLocaleString()}</div>
              <div className="text-sm opacity-60">{currency}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/20">
            <div className="bg-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2 opacity-80"><ArrowDownLeft size={15} /><span className="text-sm font-bold">إجمالي الوارد</span></div>
              <div className="text-2xl font-black">{(totalSales + totalMaintenance + totalInstallments + totalReturnPurchases + totalAccessSales).toLocaleString()}</div>
              <div className="text-xs opacity-60 mt-1">{currency}</div>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2 opacity-80"><ArrowUpRight size={15} /><span className="text-sm font-bold">إجمالي الصادر</span></div>
              <div className="text-2xl font-black">{(totalPurchases + totalReturnSales + totalAccessPurch).toLocaleString()}</div>
              <div className="text-xs opacity-60 mt-1">{currency}</div>
            </div>
          </div>

          <div className="space-y-2 mt-4 pt-4 border-t border-white/20">
            <SummaryRow icon={TrendingUp} label="مبيعات" value={`+${totalSales.toLocaleString()}`} />
            <SummaryRow icon={TrendingDown} label="مشتريات" value={`-${totalPurchases.toLocaleString()}`} />
            <SummaryRow icon={Wrench} label="صيانة" value={`+${totalMaintenance.toLocaleString()}`} />
            <SummaryRow icon={ShoppingBag} label="اكسسوار" value={`${netAccessory >= 0 ? "+" : ""}${netAccessory.toLocaleString()}`} />
            <SummaryRow icon={DollarSign} label="أقساط" value={`+${totalInstallments.toLocaleString()}`} />
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          تنبيهات المخزون
      ══════════════════════════════════════════════════════ */}
      <div className={`rounded-2xl p-6 text-white shadow-xl ${lowStock.length > 0 ? "bg-gradient-to-br from-red-500 to-rose-700" : "bg-gradient-to-br from-emerald-500 to-green-700"}`}>
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              {lowStock.length > 0 ? <AlertTriangle size={24} /> : <CheckCircle size={24} />}
            </div>
            <div>
              <div className="text-xl font-black">تنبيهات المخزون</div>
              <div className="text-sm opacity-70">{products.length} منتج إجمالاً</div>
            </div>
          </div>
          {lowStock.length > 0 && (
            <span className="text-base bg-white/20 px-4 py-1.5 rounded-full font-bold">⚠️ {lowStock.length} منتج</span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/20">
          <div className="bg-white/10 rounded-xl p-4 text-center">
            <div className="text-sm opacity-70 mb-1">نفذ تماماً</div>
            <div className="text-3xl font-black">{outOfStock.length}</div>
            <div className="text-sm opacity-60">منتج</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4 text-center">
            <div className="text-sm opacity-70 mb-1">مخزون منخفض</div>
            <div className="text-3xl font-black">{lowStock.length - outOfStock.length}</div>
            <div className="text-sm opacity-60">منتج (≤5)</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4 text-center">
            <div className="text-sm opacity-70 mb-1">مخزون جيد</div>
            <div className="text-3xl font-black">{products.length - lowStock.length}</div>
            <div className="text-sm opacity-60">منتج</div>
          </div>
        </div>

        {lowStock.length === 0 ? (
          <div className="mt-5 pt-4 border-t border-white/20 text-center py-4">
            <Package size={36} className="mx-auto mb-2 opacity-50" />
            <p className="text-base font-semibold opacity-80">المخزون جيد ✓ لا توجد تنبيهات</p>
          </div>
        ) : (
          <div className="mt-5 pt-4 border-t border-white/20">
            <div className="text-sm font-bold opacity-80 mb-3">المنتجات التي تحتاج إعادة تخزين:</div>
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {lowStock.map(p => (
                <div key={p.id} className="flex items-center justify-between bg-white/10 rounded-xl px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${p.stock === 0 ? "bg-red-400/40" : "bg-yellow-400/40"}`}>
                      {p.stock === 0 ? <XCircle size={16} /> : <AlertCircle size={16} />}
                    </div>
                    <div>
                      <div className="text-sm font-bold">{p.name}</div>
                      <div className="text-xs opacity-60">{p.unit}</div>
                    </div>
                  </div>
                  <span className={`text-sm font-black px-3 py-1 rounded-full ${p.stock === 0 ? "bg-red-400/30" : "bg-yellow-400/30"}`}>
                    {p.stock === 0 ? "🚫 نفذ" : `${p.stock} متبقي`}
                  </span>
                </div>
              ))}
            </div>
            {outOfStock.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/20 text-sm font-bold opacity-80">
                ⚠️ {outOfStock.length} منتج نفذ بالكامل
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          آخر الفواتير
      ══════════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-950 rounded-2xl text-white shadow-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center"><Layers size={24} /></div>
            <div>
              <div className="text-xl font-black">آخر الفواتير</div>
              <div className="text-sm text-gray-400">آخر 10 فواتير</div>
            </div>
          </div>
          <span className="text-sm text-gray-400 bg-white/10 px-4 py-1.5 rounded-full font-bold">{invoices.length} فاتورة إجمالاً</span>
        </div>

        {recentInvoices.length === 0 ? (
          <div className="text-center py-14">
            <ShoppingCart size={48} className="mx-auto mb-3 opacity-20" />
            <p className="text-base opacity-50">لا توجد فواتير بعد</p>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {recentInvoices.map(inv => {
              const iconMap: Record<string, any> = { sale: TrendingUp, purchase: TrendingDown, maintenance: Wrench, return_sale: RotateCcw, return_purchase: RotateCcw, accessory_sale: ShoppingBag, accessory_purchase: ShoppingBag };
              const colorMap: Record<string, string> = { sale: "bg-blue-500/25 text-blue-300", purchase: "bg-emerald-500/25 text-emerald-300", maintenance: "bg-violet-500/25 text-violet-300", return_sale: "bg-orange-500/25 text-orange-300", return_purchase: "bg-purple-500/25 text-purple-300", accessory_sale: "bg-amber-500/25 text-amber-300", accessory_purchase: "bg-teal-500/25 text-teal-300" };
              const Icon = iconMap[inv.type] ?? ShoppingCart;
              const color = colorMap[inv.type] ?? "bg-gray-500/25 text-gray-300";
              return (
                <div key={inv.id} className="flex items-center justify-between bg-white/5 hover:bg-white/10 transition-colors rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}><Icon size={16} /></div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-bold">{inv.number}</span>
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${color}`}>{typeLabel[inv.type] ?? inv.type}</span>
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${inv.status === "closed" ? "bg-emerald-500/20 text-emerald-300" : inv.status === "pending" ? "bg-amber-500/20 text-amber-300" : "bg-yellow-500/20 text-yellow-300"}`}>
                          {inv.status === "closed" ? "مغلقة" : inv.status === "pending" ? "معلقة" : "مفتوحة"}
                        </span>
                      </div>
                      <div className="text-sm text-gray-400 mt-0.5">
                        {inv.customerName || inv.supplierName || "-"} · {inv.date}
                      </div>
                    </div>
                  </div>
                  <div className="text-left">
                    <div className="text-base font-black">{inv.total.toLocaleString()} <span className="text-xs opacity-50">{currency}</span></div>
                    {(inv.remaining ?? 0) > 0
                      ? <div className="text-xs text-red-400 font-semibold">متبقي: {inv.remaining.toLocaleString()}</div>
                      : <div className="text-xs text-emerald-400">✓ مسدد</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}