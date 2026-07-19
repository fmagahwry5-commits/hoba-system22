/* نظام هوبا — منطق الواجهة */
'use strict';

/* ---------------- الحالة العامة ---------------- */
let state = {
  settings: { shopName: 'نظام هوبا', currency: 'جنيه' },
  products: [],
  customers: [],
  invoices: [],
  expenses: [],
};

/* ---------------- أدوات ---------------- */
const $ = (sel, root = document) => root.querySelector(sel);

const money = (n) =>
  `${Number(n || 0).toLocaleString('ar-EG', { maximumFractionDigits: 2 })} <small>${state.settings.currency}</small>`;

const fmtDate = (iso) =>
  new Date(iso).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });

const isToday = (iso) => new Date(iso).toDateString() === new Date().toDateString();
const isThisMonth = (iso) => {
  const d = new Date(iso), n = new Date();
  return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
};

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------- الاتصال بالسيرفر ---------------- */
async function api(path, method = 'GET', body) {
  const res = await fetch('/api/' + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(json.error || 'حدث خطأ في الاتصال');
  return json.data;
}

async function loadState() {
  state = await api('state');
  $('#shopName').textContent = state.settings.shopName;
  document.title = state.settings.shopName;
}

/* ---------------- التنبيهات والنوافذ ---------------- */
let toastTimer;
function toast(msg, type = 'ok') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2600);
}

function openModal(title, html) {
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = html;
  $('#modal').classList.remove('hidden');
}
function closeModal() { $('#modal').classList.add('hidden'); }
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });

// قيمة حقل داخل النافذة
const val = (id) => $(`#f_${id}`)?.value.trim();

/* ---------------- الموجّه (Router) ---------------- */
const routes = {
  '': renderDashboard,
  dashboard: renderDashboard,
  'invoice/new': renderNewInvoice,
  invoices: renderInvoices,
  products: renderProducts,
  customers: renderCustomers,
  expenses: renderExpenses,
  settings: renderSettings,
};

function route() {
  const hash = location.hash.replace(/^#\//, '');
  const page = hash.split('/')[0] || 'dashboard';
  (routes[hash] || routes[page] || renderDashboard)();

  // تفعيل الرابط الحالي
  document.querySelectorAll('[data-route]').forEach((a) => {
    const key = hash === 'invoice/new' ? 'invoice-new' : page;
    a.classList.toggle('active', a.dataset.route === key);
  });
  $('#sidebar').classList.remove('open');
  $('#overlay').classList.remove('show');
}
window.addEventListener('hashchange', route);

// قائمة الموبايل
$('#menuBtn').addEventListener('click', () => {
  $('#sidebar').classList.add('open');
  $('#overlay').classList.add('show');
});
$('#overlay').addEventListener('click', () => {
  $('#sidebar').classList.remove('open');
  $('#overlay').classList.remove('show');
});

/* ==================================================
   لوحة التحكم
================================================== */
function renderDashboard() {
  const salesToday = state.invoices.filter((v) => isToday(v.createdAt));
  const salesMonth = state.invoices.filter((v) => isThisMonth(v.createdAt));
  const expMonth = state.expenses.filter((e) => isThisMonth(e.createdAt));

  const sum = (arr, k) => arr.reduce((s, x) => s + (k ? x[k] : x.amount), 0);
  const todayTotal = sum(salesToday, 'total');
  const monthTotal = sum(salesMonth, 'total');
  const monthExp = sum(expMonth);
  const lowStock = state.products.filter((p) => p.stock <= 5);

  $('#view').innerHTML = `
    <div class="cards">
      <div class="stat"><div class="label">مبيعات اليوم</div><div class="value">${money(todayTotal)}</div></div>
      <div class="stat"><div class="label">مبيعات الشهر</div><div class="value">${money(monthTotal)}</div></div>
      <div class="stat"><div class="label">مصروفات الشهر</div><div class="value">${money(monthExp)}</div></div>
      <div class="stat"><div class="label">صافي الشهر</div><div class="value" style="color:${monthTotal - monthExp >= 0 ? 'var(--primary)' : 'var(--danger)'}">${money(monthTotal - monthExp)}</div></div>
    </div>

    ${lowStock.length ? `
    <div class="panel">
      <h2>⚠️ منتجات قاربت على النفاد (${lowStock.length})</h2>
      <div class="table-wrap"><table>
        <thead><tr><th>المنتج</th><th>المتبقي</th></tr></thead>
        <tbody>${lowStock.map((p) => `<tr class="low-stock"><td>${esc(p.name)}</td><td>${p.stock}</td></tr>`).join('')}</tbody>
      </table></div>
    </div>` : ''}

    <div class="panel">
      <div class="panel-head">
        <h2>🕒 أحدث الفواتير</h2>
        <a class="btn small" href="#/invoice/new">＋ فاتورة جديدة</a>
      </div>
      ${state.invoices.length === 0
        ? `<div class="empty"><span class="big">🧾</span>لا توجد فواتير بعد — ابدأ أول عملية بيع!</div>`
        : `<div class="table-wrap"><table>
            <thead><tr><th>رقم</th><th>العميل</th><th>الإجمالي</th><th>التاريخ</th></tr></thead>
            <tbody>${state.invoices.slice(-8).reverse().map((v) => `
              <tr><td>#${v.number}</td><td>${esc(v.customerName || 'بدون اسم')}</td><td>${money(v.total)}</td><td>${fmtDate(v.createdAt)}</td></tr>`).join('')}
            </tbody></table></div>`}
    </div>

    <div class="cards">
      <div class="stat"><div class="label">عدد المنتجات</div><div class="value">${state.products.length}</div></div>
      <div class="stat"><div class="label">عدد العملاء</div><div class="value">${state.customers.length}</div></div>
      <div class="stat"><div class="label">عدد الفواتير</div><div class="value">${state.invoices.length}</div></div>
    </div>`;
}

/* ==================================================
   المنتجات
================================================== */
let productSearch = '';
function renderProducts() {
  const list = state.products.filter((p) => p.name.includes(productSearch));
  $('#view').innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h2>📦 المنتجات (${state.products.length})</h2>
        <button class="btn" onclick="productForm()">＋ إضافة منتج</button>
      </div>
      <input class="search" placeholder="🔍 ابحث عن منتج…" value="${esc(productSearch)}"
             oninput="productSearch=this.value; renderProducts()" />
      <br><br>
      ${list.length === 0
        ? `<div class="empty"><span class="big">📦</span>${state.products.length ? 'لا توجد نتائج للبحث' : 'أضف أول منتج لبدء البيع'}</div>`
        : `<div class="table-wrap"><table>
            <thead><tr><th>الاسم</th><th>سعر الشراء</th><th>سعر البيع</th><th>المخزون</th><th></th></tr></thead>
            <tbody>${list.map((p) => `
              <tr class="${p.stock <= 5 ? 'low-stock' : ''}">
                <td>${esc(p.name)}</td>
                <td>${money(p.buyPrice)}</td>
                <td>${money(p.sellPrice)}</td>
                <td>${p.stock}</td>
                <td>
                  <button class="btn small secondary" onclick="productForm('${p.id}')">تعديل</button>
                  <button class="btn small danger" onclick="deleteProduct('${p.id}')">حذف</button>
                </td>
              </tr>`).join('')}
            </tbody></table></div>`}
    </div>`;
}

window.productForm = (editId) => {
  const p = state.products.find((x) => x.id === editId) || {};
  openModal(editId ? 'تعديل منتج' : 'إضافة منتج', `
    <div class="field"><label>اسم المنتج *</label><input id="f_name" value="${esc(p.name || '')}" /></div>
    <div class="field-row">
      <div class="field"><label>سعر الشراء</label><input id="f_buy" type="number" min="0" step="any" inputmode="decimal" value="${p.buyPrice ?? ''}" /></div>
      <div class="field"><label>سعر البيع</label><input id="f_sell" type="number" min="0" step="any" inputmode="decimal" value="${p.sellPrice ?? ''}" /></div>
    </div>
    <div class="field"><label>الكمية بالمخزون</label><input id="f_stock" type="number" min="0" step="any" inputmode="numeric" value="${p.stock ?? ''}" /></div>
    <button class="btn" style="width:100%" onclick="saveProduct('${editId || ''}')">💾 حفظ</button>`);
  $('#f_name').focus();
};

window.saveProduct = async (editId) => {
  try {
    if (!val('name')) throw new Error('اكتب اسم المنتج');
    const body = { name: val('name'), buyPrice: val('buy'), sellPrice: val('sell'), stock: val('stock') };
    if (editId) await api(`products/${editId}`, 'PUT', body);
    else await api('products', 'POST', body);
    await loadState(); closeModal(); renderProducts();
    toast('تم الحفظ ✅');
  } catch (e) { toast(e.message, 'err'); }
};

window.deleteProduct = async (pid) => {
  if (!confirm('حذف هذا المنتج نهائياً؟')) return;
  try {
    await api(`products/${pid}`, 'DELETE');
    await loadState(); renderProducts();
    toast('تم الحذف');
  } catch (e) { toast(e.message, 'err'); }
};

/* ==================================================
   العملاء
================================================== */
function renderCustomers() {
  $('#view').innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h2>👥 العملاء (${state.customers.length})</h2>
        <button class="btn" onclick="customerForm()">＋ إضافة عميل</button>
      </div>
      ${state.customers.length === 0
        ? `<div class="empty"><span class="big">👥</span>أضف عملاءك لتسجيلهم في الفواتير</div>`
        : `<div class="table-wrap"><table>
            <thead><tr><th>الاسم</th><th>التليفون</th><th>ملاحظات</th><th></th></tr></thead>
            <tbody>${state.customers.map((c) => `
              <tr>
                <td>${esc(c.name)}</td><td>${esc(c.phone)}</td><td>${esc(c.notes)}</td>
                <td>
                  <button class="btn small secondary" onclick="customerForm('${c.id}')">تعديل</button>
                  <button class="btn small danger" onclick="deleteCustomer('${c.id}')">حذف</button>
                </td>
              </tr>`).join('')}
            </tbody></table></div>`}
    </div>`;
}

window.customerForm = (editId) => {
  const c = state.customers.find((x) => x.id === editId) || {};
  openModal(editId ? 'تعديل عميل' : 'إضافة عميل', `
    <div class="field"><label>الاسم *</label><input id="f_name" value="${esc(c.name || '')}" /></div>
    <div class="field"><label>التليفون</label><input id="f_phone" type="tel" inputmode="tel" value="${esc(c.phone || '')}" /></div>
    <div class="field"><label>ملاحظات</label><textarea id="f_notes" rows="2">${esc(c.notes || '')}</textarea></div>
    <button class="btn" style="width:100%" onclick="saveCustomer('${editId || ''}')">💾 حفظ</button>`);
  $('#f_name').focus();
};

window.saveCustomer = async (editId) => {
  try {
    if (!val('name')) throw new Error('اكتب اسم العميل');
    const body = { name: val('name'), phone: val('phone'), notes: val('notes') };
    if (editId) await api(`customers/${editId}`, 'PUT', body);
    else await api('customers', 'POST', body);
    await loadState(); closeModal(); renderCustomers();
    toast('تم الحفظ ✅');
  } catch (e) { toast(e.message, 'err'); }
};

window.deleteCustomer = async (cid) => {
  if (!confirm('حذف هذا العميل؟ (فواتيره السابقة ستبقى)')) return;
  try {
    await api(`customers/${cid}`, 'DELETE');
    await loadState(); renderCustomers();
    toast('تم الحذف');
  } catch (e) { toast(e.message, 'err'); }
};

/* ==================================================
   فاتورة جديدة
================================================== */
let draft = []; // أصناف الفاتورة الحالية

function renderNewInvoice() {
  if (state.products.length === 0) {
    $('#view').innerHTML = `
      <div class="panel"><div class="empty">
        <span class="big">📦</span>
        أضف منتجات أولاً قبل إنشاء فاتورة<br><br>
        <a class="btn" href="#/products">الانتقال للمنتجات</a>
      </div></div>`;
    return;
  }

  const total = draft.reduce((s, i) => s + i.price * i.qty, 0);
  $('#view').innerHTML = `
    <div class="panel">
      <div class="panel-head"><h2>🧾 فاتورة جديدة</h2>
        <button class="btn secondary small" onclick="draft=[];renderNewInvoice()">تفريغ</button>
      </div>

      <div class="field">
        <label>العميل (اختياري)</label>
        <select id="invCustomer">
          <option value="">— بدون اسم —</option>
          ${state.customers.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
        </select>
      </div>

      <div id="draftItems">
        ${draft.length === 0 ? `<div class="empty"><span class="big">🛒</span>أضف أصنافاً للفاتورة</div>` : ''}
        ${draft.map((it, idx) => `
          <div class="inv-item">
            <div><b>${esc(it.name)}</b><br><small style="color:var(--muted)">${money(it.price)}</small></div>
            <input type="number" min="1" inputmode="numeric" value="${it.qty}"
                   onchange="draftQty(${idx}, this.value)" title="الكمية" />
            <div><b>${money(it.price * it.qty)}</b></div>
            <button class="icon-btn" style="background:#fee2e2;color:var(--danger)" onclick="draft.splice(${idx},1);renderNewInvoice()">✕</button>
          </div>`).join('')}
      </div>

      <div class="field-row" style="margin-top:12px">
        <div class="field">
          <label>إضافة منتج</label>
          <select id="invProduct">
            ${state.products.map((p) => `
              <option value="${p.id}" ${p.stock === 0 ? 'disabled' : ''}>
                ${esc(p.name)} — ${money(p.sellPrice)} (متاح ${p.stock})
              </option>`).join('')}
          </select>
        </div>
        <div class="field"><label>&nbsp;</label>
          <button class="btn secondary" style="width:100%" onclick="addDraftItem()">＋ إضافة للفاتورة</button>
        </div>
      </div>

      <div class="field"><label>ملاحظة على الفاتورة (اختياري)</label>
        <input id="invNote" placeholder="مثال: دفع كاش / على الحساب…" /></div>

      <div class="inv-total"><span>الإجمالي:</span><span>${money(total)}</span></div>
      <br>
      <button class="btn" style="width:100%;font-size:1.05rem" onclick="saveInvoice()" ${draft.length === 0 ? 'disabled style="opacity:.5;width:100%"' : ''}>
        ✅ حفظ الفاتورة
      </button>
    </div>`;
}

window.addDraftItem = () => {
  const pid = $('#invProduct').value;
  const p = state.products.find((x) => x.id === pid);
  if (!p) return;
  const existing = draft.find((i) => i.productId === pid);
  if (existing) {
    if (existing.qty + 1 > p.stock) return toast(`الكمية المتاحة من «${p.name}» هي ${p.stock} فقط`, 'err');
    existing.qty++;
  } else {
    if (p.stock < 1) return toast(`«${p.name}» نفد من المخزون`, 'err');
    draft.push({ productId: p.id, name: p.name, price: p.sellPrice, qty: 1 });
  }
  renderNewInvoice();
};

window.draftQty = (idx, q) => {
  const p = state.products.find((x) => x.id === draft[idx].productId);
  let qty = Math.max(1, parseInt(q) || 1);
  if (p && qty > p.stock) { qty = p.stock; toast(`أقصى كمية متاحة: ${p.stock}`, 'err'); }
  draft[idx].qty = qty;
  renderNewInvoice();
};

window.saveInvoice = async () => {
  if (draft.length === 0) return;
  try {
    const inv = await api('invoices', 'POST', {
      customerId: $('#invCustomer').value || null,
      note: val ? $('#invNote').value.trim() : '',
      items: draft.map((i) => ({ productId: i.productId, qty: i.qty })),
    });
    draft = [];
    await loadState();
    toast(`تم حفظ الفاتورة رقم #${inv.number} ✅`);
    printInvoice(inv.id);
    location.hash = '#/invoices';
  } catch (e) { toast(e.message, 'err'); }
};

/* ==================================================
   عرض الفواتير
================================================== */
function renderInvoices() {
  const list = [...state.invoices].reverse();
  $('#view').innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h2>🗂️ الفواتير (${list.length})</h2>
        <a class="btn" href="#/invoice/new">＋ فاتورة جديدة</a>
      </div>
      ${list.length === 0
        ? `<div class="empty"><span class="big">🧾</span>لا توجد فواتير بعد</div>`
        : `<div class="table-wrap"><table>
            <thead><tr><th>رقم</th><th>العميل</th><th>الأصناف</th><th>الإجمالي</th><th>التاريخ</th><th></th></tr></thead>
            <tbody>${list.map((v) => `
              <tr>
                <td>#${v.number}</td>
                <td>${esc(v.customerName || 'بدون اسم')}</td>
                <td>${v.items.reduce((s, i) => s + i.qty, 0)}</td>
                <td>${money(v.total)}</td>
                <td>${fmtDate(v.createdAt)}</td>
                <td>
                  <button class="btn small secondary" onclick="viewInvoice('${v.id}')">عرض</button>
                  <button class="btn small danger" onclick="deleteInvoice('${v.id}')">حذف</button>
                </td>
              </tr>`).join('')}
            </tbody></table></div>`}
    </div>`;
}

window.viewInvoice = (vid) => {
  const v = state.invoices.find((x) => x.id === vid);
  if (!v) return;
  openModal(`فاتورة رقم #${v.number}`, `
    <p style="color:var(--muted);font-size:.85rem;margin-bottom:10px">${fmtDate(v.createdAt)} — ${esc(v.customerName || 'بدون اسم')}</p>
    <div class="table-wrap"><table>
      <thead><tr><th>الصنف</th><th>سعر</th><th>كمية</th><th>إجمالي</th></tr></thead>
      <tbody>${v.items.map((i) => `
        <tr><td>${esc(i.name)}</td><td>${money(i.price)}</td><td>${i.qty}</td><td>${money(i.price * i.qty)}</td></tr>`).join('')}
      </tbody></table></div>
    ${v.note ? `<p style="margin-top:10px">📝 ${esc(v.note)}</p>` : ''}
    <div class="inv-total"><span>الإجمالي:</span><span>${money(v.total)}</span></div>
    <br>
    <button class="btn" style="width:100%" onclick="printInvoice('${v.id}')">🖨️ طباعة</button>`);
};

function printAreaHTML(v) {
  return `
    <h1>${esc(state.settings.shopName)}</h1>
    <div class="muted">فاتورة رقم #${v.number} — ${fmtDate(v.createdAt)}${v.customerName ? ' — العميل: ' + esc(v.customerName) : ''}</div>
    <table>
      <thead><tr><th>الصنف</th><th>السعر</th><th>الكمية</th><th>الإجمالي</th></tr></thead>
      <tbody>${v.items.map((i) => `
        <tr><td>${esc(i.name)}</td><td>${i.price}</td><td>${i.qty}</td><td>${i.price * i.qty}</td></tr>`).join('')}
      </tbody>
      <tfoot><tr><td colspan="3"><b>الإجمالي الكلي</b></td><td><b>${v.total} ${esc(state.settings.currency)}</b></td></tr></tfoot>
    </table>
    ${v.note ? `<p>ملاحظة: ${esc(v.note)}</p>` : ''}
    <p class="muted" style="margin-top:14px">شكراً لتعاملكم معنا 🌹</p>`;
}

window.printInvoice = (vid) => {
  const v = state.invoices.find((x) => x.id === vid);
  if (!v) return;
  let area = $('#printArea');
  if (!area) {
    area = document.createElement('div');
    area.id = 'printArea';
    document.body.appendChild(area);
  }
  area.innerHTML = printAreaHTML(v);
  setTimeout(() => window.print(), 50);
};

window.deleteInvoice = async (vid) => {
  if (!confirm('حذف الفاتورة؟ سيتم إرجاع الكميات للمخزون.')) return;
  try {
    await api(`invoices/${vid}`, 'DELETE');
    await loadState(); renderInvoices();
    toast('تم حذف الفاتورة وإرجاع الكميات');
  } catch (e) { toast(e.message, 'err'); }
};

/* ==================================================
   المصروفات
================================================== */
function renderExpenses() {
  const list = [...state.expenses].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const monthTotal = list.filter((e) => isThisMonth(e.createdAt)).reduce((s, e) => s + e.amount, 0);
  $('#view').innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h2>💸 المصروفات — هذا الشهر: ${money(monthTotal)}</h2>
        <button class="btn" onclick="expenseForm()">＋ إضافة مصروف</button>
      </div>
      ${list.length === 0
        ? `<div class="empty"><span class="big">💸</span>سجّل مصروفاتك (إيجار، كهرباء، بضاعة…)</div>`
        : `<div class="table-wrap"><table>
            <thead><tr><th>الوصف</th><th>المبلغ</th><th>التاريخ</th><th></th></tr></thead>
            <tbody>${list.map((e) => `
              <tr>
                <td>${esc(e.title)}</td><td>${money(e.amount)}</td><td>${fmtDate(e.createdAt)}</td>
                <td><button class="btn small danger" onclick="deleteExpense('${e.id}')">حذف</button></td>
              </tr>`).join('')}
            </tbody></table></div>`}
    </div>`;
}

window.expenseForm = () => {
  openModal('إضافة مصروف', `
    <div class="field"><label>الوصف *</label><input id="f_title" placeholder="مثال: فاتورة كهرباء" /></div>
    <div class="field"><label>المبلغ *</label><input id="f_amount" type="number" min="0" step="any" inputmode="decimal" /></div>
    <div class="field"><label>التاريخ</label><input id="f_date" type="date" /></div>
    <button class="btn" style="width:100%" onclick="saveExpense()">💾 حفظ</button>`);
  $('#f_title').focus();
};

window.saveExpense = async () => {
  try {
    await api('expenses', 'POST', { title: val('title'), amount: val('amount'), date: val('date') || null });
    await loadState(); closeModal(); renderExpenses();
    toast('تم الحفظ ✅');
  } catch (e) { toast(e.message, 'err'); }
};

window.deleteExpense = async (eid) => {
  if (!confirm('حذف هذا المصروف؟')) return;
  try {
    await api(`expenses/${eid}`, 'DELETE');
    await loadState(); renderExpenses();
    toast('تم الحذف');
  } catch (e) { toast(e.message, 'err'); }
};

/* ==================================================
   الإعدادات
================================================== */
function renderSettings() {
  $('#view').innerHTML = `
    <div class="panel">
      <h2>⚙️ إعدادات المحل</h2>
      <div class="field"><label>اسم المحل (يظهر في الفاتورة)</label>
        <input id="s_shop" value="${esc(state.settings.shopName)}" /></div>
      <div class="field"><label>العملة</label>
        <input id="s_cur" value="${esc(state.settings.currency)}" /></div>
      <button class="btn" onclick="saveSettings()">💾 حفظ الإعدادات</button>
    </div>

    <div class="panel">
      <h2>💾 النسخ الاحتياطي</h2>
      <p style="color:var(--muted);font-size:.9rem;margin-bottom:12px">
        بياناتك محفوظة على الكمبيوتر في ملف <code>data/db.json</code>. نزّل نسخة احتياطية دورياً.
      </p>
      <a class="btn secondary" href="/api/backup">⬇️ تنزيل نسخة احتياطية</a>
    </div>

    <div class="panel">
      <h2>📱 ربط الموبايل</h2>
      <p style="color:var(--muted);font-size:.9rem;line-height:1.8">
        1. تأكد أن الموبايل والكمبيوتر على <b>نفس شبكة الواي فاي</b>.<br>
        2. على الكمبيوتر، شغّل النظام بالأمر <code>node server.js</code>.<br>
        3. سيظهر لك في الشاشة السوداء عنوان مثل <code>http://192.168.1.X:3000</code>.<br>
        4. افتح هذا العنوان في متصفح الموبايل، ثم اختر «إضافة إلى الشاشة الرئيسية» ليصبح كأنه تطبيق.
      </p>
    </div>`;
}

window.saveSettings = async () => {
  try {
    await api('settings', 'PUT', { shopName: $('#s_shop').value, currency: $('#s_cur').value });
    await loadState();
    toast('تم حفظ الإعدادات ✅');
  } catch (e) { toast(e.message, 'err'); }
};

/* ---------------- التشغيل ---------------- */
(async function init() {
  try {
    await loadState();
    route();
  } catch (e) {
    $('#view').innerHTML = `<div class="panel"><div class="empty">
      <span class="big">🔌</span>تعذر الاتصال بالخادم<br>
      <small>${esc(e.message)}</small><br><br>
      <button class="btn" onclick="location.reload()">إعادة المحاولة</button>
    </div></div>`;
  }

  // تسجيل Service Worker (ليعمل كتطبيق PWA)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
})();
