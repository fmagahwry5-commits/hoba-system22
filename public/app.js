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
let me = null; // المستخدم الحالي {id, username, name, role}

const isAdmin = () => me && me.role === 'admin';

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

const val = (idEl) => $(`#${idEl}`)?.value.trim();

/* ---------------- التوكن والاتصال بالسيرفر ---------------- */
const getToken = () => localStorage.getItem('hoba_token') || '';
const setToken = (t) => (t ? localStorage.setItem('hoba_token', t) : localStorage.removeItem('hoba_token'));

async function api(path, method = 'GET', body) {
  const res = await fetch('/api/' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== 'auth/login') {
    setToken(null);
    showAuth('انتهت الجلسة — سجّل دخولك من جديد');
    throw new Error('انتهت الجلسة');
  }
  if (!res.ok || !json.ok) throw new Error(json.error || 'حدث خطأ في الاتصال');
  return json.data;
}

// تنزيل ملف (CSV/Backup) مع ترويسة المصادقة
async function downloadFile(path, filename) {
  try {
    const res = await fetch('/api/' + path, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || 'فشل التنزيل');
    }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch (e) { toast(e.message, 'err'); }
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

/* ==================================================
   المصادقة — الإعداد الأولي وتسجيل الدخول
================================================== */
async function showAuth(errorMsg) {
  $('#appRoot').classList.add('hidden');
  $('#authRoot').classList.remove('hidden');
  const errEl = $('#authError');
  if (errorMsg) { errEl.textContent = errorMsg; errEl.classList.remove('hidden'); }
  else errEl.classList.add('hidden');

  try {
    const status = await api('auth/status');
    $('#setupForm').classList.toggle('hidden', !status.needsSetup);
    $('#loginForm').classList.toggle('hidden', status.needsSetup);
    (status.needsSetup ? $('#setup_name') : $('#login_username')).focus();
  } catch {
    errEl.textContent = 'تعذر الاتصال بالخادم — تأكد من تشغيله';
    errEl.classList.remove('hidden');
  }
}

function showApp() {
  $('#authRoot').classList.add('hidden');
  $('#appRoot').classList.remove('hidden');
  $('#userBadge').textContent = `👤 ${me.name}${isAdmin() ? ' (مدير)' : ''}`;
  // إخفاء أدوات المدير عن الكاشير
  document.querySelectorAll('[data-admin]').forEach((el) => {
    el.style.display = isAdmin() ? '' : 'none';
  });
}

$('#setupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    if (val('setup_password') !== val('setup_confirm')) throw new Error('كلمتا المرور غير متطابقتين');
    const data = await api('auth/setup', 'POST', {
      name: val('setup_name'), username: val('setup_username'), password: val('setup_password'),
    });
    setToken(data.token);
    me = data.user;
    await loadState();
    showApp();
    route();
    toast(`أهلاً بك ${me.name} 🎉`);
  } catch (err) {
    $('#authError').textContent = err.message;
    $('#authError').classList.remove('hidden');
  }
});

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const data = await api('auth/login', 'POST', {
      username: val('login_username'), password: val('login_password'),
    });
    data.user.passHash = undefined;
    setToken(data.token);
    me = data.user;
    await loadState();
    showApp();
    route();
    toast(`أهلاً بعودتك ${me.name} 👋`);
  } catch (err) {
    $('#authError').textContent = err.message;
    $('#authError').classList.remove('hidden');
  }
});

$('#logoutBtn').addEventListener('click', async () => {
  try { await api('logout', 'POST'); } catch { /* تجاهل */ }
  setToken(null);
  me = null;
  location.hash = '';
  await showAuth();
});

/* ==================================================
   الموجّه (Router)
================================================== */
const routes = {
  '': renderDashboard,
  dashboard: renderDashboard,
  'invoice/new': renderNewInvoice,
  invoices: renderInvoices,
  products: renderProducts,
  customers: renderCustomers,
  expenses: renderExpenses,
  reports: renderReports,
  settings: renderSettings,
};

function route() {
  if (!me) return;
  const hash = location.hash.replace(/^#\//, '');
  const page = hash.split('/')[0] || 'dashboard';
  (routes[hash] || routes[page] || renderDashboard)();

  document.querySelectorAll('[data-route]').forEach((a) => {
    const key = hash === 'invoice/new' ? 'invoice-new' : page;
    a.classList.toggle('active', a.dataset.route === key);
  });
  $('#sidebar').classList.remove('open');
  $('#overlay').classList.remove('show');
}
window.addEventListener('hashchange', route);

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
            <thead><tr><th>رقم</th><th>العميل</th><th>الإجمالي</th><th>البائع</th><th>التاريخ</th></tr></thead>
            <tbody>${state.invoices.slice(-8).reverse().map((v) => `
              <tr><td>#${v.number}</td><td>${esc(v.customerName || 'بدون اسم')}</td><td>${money(v.total)}</td><td>${esc(v.createdByName || '')}</td><td>${fmtDate(v.createdAt)}</td></tr>`).join('')}
            </tbody></table></div>`}
    </div>

    <div class="cards">
      <div class="stat"><div class="label">عدد المنتجات</div><div class="value">${state.products.length}</div></div>
      <div class="stat"><div class="label">عدد العملاء</div><div class="value">${state.customers.length}</div></div>
      <div class="stat"><div class="label">عدد الفواتير</div><div class="value">${state.invoices.length}</div></div>
    </div>`;
}

/* ==================================================
   الباركود — الكاميرا
================================================== */
let camStream = null;
let scanTimer = null;

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880; g.gain.value = 0.08;
    o.start(); setTimeout(() => { o.stop(); ctx.close(); }, 120);
  } catch { /* تجاهل */ }
}

/**
 * بدء مسح الباركود بالكاميرا.
 * onCode(code): تُستدعى عند قراءة كود؛ أعدّ true لإيقاف المسح، false للاستمرار.
 */
window.startScanner = async (onCode) => {
  if (!('BarcodeDetector' in window)) {
    toast('هذا المتصفح لا يدعم المسح بالكاميرا — اكتب الباركود يدوياً أو استخدم قارئ USB', 'err');
    return;
  }
  try {
    camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  } catch {
    toast('تعذر فتح الكاميرا — تأكد من السماح بالوصول وأن الصفحة عبر HTTPS', 'err');
    return;
  }
  const video = $('#camVideo');
  video.srcObject = camStream;
  await video.play();
  $('#camModal').classList.remove('hidden');

  const detector = new BarcodeDetector({
    formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
  });
  let lastCode = '', lastAt = 0;
  scanTimer = setInterval(async () => {
    try {
      const codes = await detector.detect(video);
      if (!codes.length) return;
      const code = codes[0].rawValue;
      const nowT = Date.now();
      if (code === lastCode && nowT - lastAt < 1500) return; // تجاهل التكرار السريع
      lastCode = code; lastAt = nowT;
      beep();
      if (onCode(code)) window.stopScanner();
    } catch { /* إعادة المحاولة */ }
  }, 350);
};

window.stopScanner = () => {
  clearInterval(scanTimer);
  if (camStream) camStream.getTracks().forEach((t) => t.stop());
  camStream = null;
  $('#camVideo').srcObject = null;
  $('#camModal').classList.add('hidden');
};

/* ==================================================
   المنتجات
================================================== */
let productSearch = '';
function renderProducts() {
  const list = state.products.filter((p) =>
    p.name.includes(productSearch) || (p.barcode && p.barcode.includes(productSearch)));
  $('#view').innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h2>📦 المنتجات (${state.products.length})</h2>
        ${isAdmin() ? `<button class="btn" onclick="productForm()">＋ إضافة منتج</button>` : ''}
      </div>
      <input class="search" placeholder="🔍 ابحث بالاسم أو الباركود…" value="${esc(productSearch)}"
             oninput="productSearch=this.value; renderProducts()" />
      <br><br>
      ${list.length === 0
        ? `<div class="empty"><span class="big">📦</span>${state.products.length ? 'لا توجد نتائج للبحث' : 'أضف أول منتج لبدء البيع'}</div>`
        : `<div class="table-wrap"><table>
            <thead><tr><th>الاسم</th><th>الباركود</th><th>سعر الشراء</th><th>سعر البيع</th><th>المخزون</th>${isAdmin() ? '<th></th>' : ''}</tr></thead>
            <tbody>${list.map((p) => `
              <tr class="${p.stock <= 5 ? 'low-stock' : ''}">
                <td>${esc(p.name)}</td>
                <td>${esc(p.barcode || '—')}</td>
                <td>${money(p.buyPrice)}</td>
                <td>${money(p.sellPrice)}</td>
                <td>${p.stock}</td>
                ${isAdmin() ? `<td>
                  <button class="btn small secondary" onclick="productForm('${p.id}')">تعديل</button>
                  <button class="btn small danger" onclick="deleteProduct('${p.id}')">حذف</button>
                </td>` : ''}
              </tr>`).join('')}
            </tbody></table></div>`}
    </div>`;
}

window.productForm = (editId) => {
  const p = state.products.find((x) => x.id === editId) || {};
  openModal(editId ? 'تعديل منتج' : 'إضافة منتج', `
    <div class="field"><label>اسم المنتج *</label><input id="f_name" value="${esc(p.name || '')}" /></div>
    <div class="field">
      <label>الباركود (اختياري)</label>
      <div style="display:flex;gap:8px">
        <input id="f_barcode" inputmode="numeric" value="${esc(p.barcode || '')}" style="flex:1" />
        <button class="icon-btn" style="background:#ccfbf1;color:var(--primary-dark)" title="مسح بالكاميرا"
                onclick="startScanner((code)=>{ document.querySelector('#f_barcode').value = code; return true; })">📷</button>
      </div>
    </div>
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
    if (!val('f_name')) throw new Error('اكتب اسم المنتج');
    const body = { name: val('f_name'), buyPrice: val('f_buy'), sellPrice: val('f_sell'), stock: val('f_stock'), barcode: val('f_barcode') };
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
                  ${isAdmin() ? `<button class="btn small danger" onclick="deleteCustomer('${c.id}')">حذف</button>` : ''}
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
    if (!val('f_name')) throw new Error('اكتب اسم العميل');
    const body = { name: val('f_name'), phone: val('f_phone'), notes: val('f_notes') };
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
   فاتورة جديدة (+ الباركود)
================================================== */
let draft = []; // أصناف الفاتورة الحالية

function renderNewInvoice() {
  if (state.products.length === 0) {
    $('#view').innerHTML = `
      <div class="panel"><div class="empty">
        <span class="big">📦</span>
        أضف منتجات أولاً قبل إنشاء فاتورة<br><br>
        ${isAdmin() ? `<a class="btn" href="#/products">الانتقال للمنتجات</a>` : 'اطلب من المدير إضافة المنتجات'}
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
        <label>⚡ إضافة سريعة بالباركود أو الاسم</label>
        <div style="display:flex;gap:8px">
          <input id="quickAdd" style="flex:1" placeholder="امسح الباركود أو اكتب اسم المنتج ثم Enter"
                 onkeydown="if(event.key==='Enter'){event.preventDefault();quickAddProduct();}" />
          <button class="icon-btn" style="background:#ccfbf1;color:var(--primary-dark);font-size:1.3rem" title="مسح بالكاميرا"
                  onclick="startScanner(scanToInvoice)">📷</button>
        </div>
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
          <label>أو اختر من القائمة</label>
          <select id="invProduct">
            ${state.products.map((p) => `
              <option value="${p.id}" ${p.stock === 0 ? 'disabled' : ''}>
                ${esc(p.name)} — ${money(p.sellPrice)} (متاح ${p.stock})
              </option>`).join('')}
          </select>
        </div>
        <div class="field"><label>&nbsp;</label>
          <button class="btn secondary" style="width:100%" onclick="addDraftItem($('#invProduct').value)">＋ إضافة للفاتورة</button>
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
  const qa = $('#quickAdd');
  if (qa) qa.focus();
}

// بحث موحّد بالباركود ثم الاسم
function findProduct(query) {
  const q = String(query).trim();
  if (!q) return null;
  return state.products.find((p) => p.barcode && p.barcode === q)
      || state.products.find((p) => p.name.includes(q))
      || null;
}

window.quickAddProduct = () => {
  const input = $('#quickAdd');
  const p = findProduct(input.value);
  if (!p) { toast('لم يتم العثور على المنتج — تأكد من الباركود أو الاسم', 'err'); return; }
  addDraftItem(p.id);
  input.value = '';
  input.focus();
};

window.scanToInvoice = (code) => {
  const p = findProduct(code);
  if (!p) { toast(`باركود غير مسجل: ${code}`, 'err'); return false; }
  addDraftItem(p.id);
  toast(`✅ ${p.name}`);
  return false; // استمرار المسح لإضافة أصناف متتالية
};

window.addDraftItem = (pid) => {
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
      note: $('#invNote').value.trim(),
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
            <thead><tr><th>رقم</th><th>العميل</th><th>الأصناف</th><th>الإجمالي</th><th>البائع</th><th>التاريخ</th><th></th></tr></thead>
            <tbody>${list.map((v) => `
              <tr>
                <td>#${v.number}</td>
                <td>${esc(v.customerName || 'بدون اسم')}</td>
                <td>${v.items.reduce((s, i) => s + i.qty, 0)}</td>
                <td>${money(v.total)}</td>
                <td>${esc(v.createdByName || '')}</td>
                <td>${fmtDate(v.createdAt)}</td>
                <td>
                  <button class="btn small secondary" onclick="viewInvoice('${v.id}')">عرض</button>
                  ${isAdmin() ? `<button class="btn small danger" onclick="deleteInvoice('${v.id}')">حذف</button>` : ''}
                </td>
              </tr>`).join('')}
            </tbody></table></div>`}
    </div>`;
}

window.viewInvoice = (vid) => {
  const v = state.invoices.find((x) => x.id === vid);
  if (!v) return;
  openModal(`فاتورة رقم #${v.number}`, `
    <p style="color:var(--muted);font-size:.85rem;margin-bottom:10px">
      ${fmtDate(v.createdAt)} — ${esc(v.customerName || 'بدون اسم')}${v.createdByName ? ` — البائع: ${esc(v.createdByName)}` : ''}
    </p>
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
   المصروفات (المدير)
================================================== */
function renderExpenses() {
  const list = [...state.expenses].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const monthTotal = list.filter((e) => isThisMonth(e.createdAt)).reduce((s, e) => s + e.amount, 0);
  $('#view').innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h2>💸 المصروفات — هذا الشهر: ${money(monthTotal)}</h2>
        ${isAdmin() ? `<button class="btn" onclick="expenseForm()">＋ إضافة مصروف</button>` : ''}
      </div>
      ${list.length === 0
        ? `<div class="empty"><span class="big">💸</span>سجّل مصروفاتك (إيجار، كهرباء، بضاعة…)</div>`
        : `<div class="table-wrap"><table>
            <thead><tr><th>الوصف</th><th>المبلغ</th><th>التاريخ</th>${isAdmin() ? '<th></th>' : ''}</tr></thead>
            <tbody>${list.map((e) => `
              <tr>
                <td>${esc(e.title)}</td><td>${money(e.amount)}</td><td>${fmtDate(e.createdAt)}</td>
                ${isAdmin() ? `<td><button class="btn small danger" onclick="deleteExpense('${e.id}')">حذف</button></td>` : ''}
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
    await api('expenses', 'POST', { title: val('f_title'), amount: val('f_amount'), date: val('f_date') || null });
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
   التقارير (المدير)
================================================== */
let reportMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

function monthRange(ym) {
  const [y, m] = ym.split('-').map(Number);
  return { from: new Date(y, m - 1, 1), to: new Date(y, m, 0, 23, 59, 59) };
}

function renderReports() {
  if (!isAdmin()) {
    $('#view').innerHTML = `<div class="panel"><div class="empty"><span class="big">🔒</span>التقارير متاحة للمدير فقط</div></div>`;
    return;
  }
  const { from, to } = monthRange(reportMonth);
  const inRange = (iso) => { const d = new Date(iso); return d >= from && d <= to; };

  const invoices = state.invoices.filter((v) => inRange(v.createdAt));
  const expenses = state.expenses.filter((e) => inRange(e.createdAt));

  const sales = invoices.reduce((s, v) => s + v.total, 0);
  const cost = invoices.reduce((s, v) => s + (v.cost || 0), 0);
  const gross = sales - cost;
  const expTotal = expenses.reduce((s, e) => s + e.amount, 0);

  // أفضل المنتجات مبيعاً
  const qtyByProduct = {};
  for (const v of invoices) for (const it of v.items) {
    qtyByProduct[it.name] = qtyByProduct[it.name] || { qty: 0, revenue: 0 };
    qtyByProduct[it.name].qty += it.qty;
    qtyByProduct[it.name].revenue += it.qty * it.price;
  }
  const top = Object.entries(qtyByProduct).sort((a, b) => b[1].qty - a[1].qty).slice(0, 5);

  // مبيعات كل بائع
  const bySeller = {};
  for (const v of invoices) {
    const k = v.createdByName || 'غير مسجل';
    bySeller[k] = (bySeller[k] || 0) + v.total;
  }

  const fromStr = reportMonth + '-01';
  const toStr = reportMonth + '-' + String(to.getDate()).padStart(2, '0');

  $('#view').innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h2>📈 تقرير شهر</h2>
        <input type="month" class="search" style="max-width:170px" value="${reportMonth}"
               onchange="reportMonth=this.value; renderReports()" />
      </div>

      <div class="cards">
        <div class="stat"><div class="label">المبيعات</div><div class="value">${money(sales)}</div></div>
        <div class="stat"><div class="label">إجمالي الربح</div><div class="value" style="color:var(--primary)">${money(gross)}</div></div>
        <div class="stat"><div class="label">المصروفات</div><div class="value">${money(expTotal)}</div></div>
        <div class="stat"><div class="label">صافي الربح</div><div class="value" style="color:${gross - expTotal >= 0 ? 'var(--primary)' : 'var(--danger)'}">${money(gross - expTotal)}</div></div>
      </div>
      <div class="cards">
        <div class="stat"><div class="label">عدد الفواتير</div><div class="value">${invoices.length}</div></div>
        <div class="stat"><div class="label">متوسط الفاتورة</div><div class="value">${money(invoices.length ? sales / invoices.length : 0)}</div></div>
      </div>

      ${top.length ? `
      <h2 style="margin:16px 0 10px">🏆 أفضل المنتجات مبيعاً</h2>
      <div class="table-wrap"><table>
        <thead><tr><th>المنتج</th><th>الكمية المباعة</th><th>الإيراد</th></tr></thead>
        <tbody>${top.map(([name, d]) => `<tr><td>${esc(name)}</td><td>${d.qty}</td><td>${money(d.revenue)}</td></tr>`).join('')}</tbody>
      </table></div>` : ''}

      ${Object.keys(bySeller).length ? `
      <h2 style="margin:16px 0 10px">👥 مبيعات البائعين</h2>
      <div class="table-wrap"><table>
        <thead><tr><th>البائع</th><th>إجمالي المبيعات</th></tr></thead>
        <tbody>${Object.entries(bySeller).map(([name, t]) => `<tr><td>${esc(name)}</td><td>${money(t)}</td></tr>`).join('')}</tbody>
      </table></div>` : ''}
    </div>

    <div class="panel">
      <h2>⬇️ تصدير ملفات Excel (CSV)</h2>
      <p style="color:var(--muted);font-size:.9rem;margin-bottom:12px">تُفتح مباشرة في برنامج Excel — لشهر ${esc(reportMonth)}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn secondary" onclick="downloadFile('export/sales.csv?from=${fromStr}&to=${toStr}','sales-${reportMonth}.csv')">🧾 المبيعات</button>
        <button class="btn secondary" onclick="downloadFile('export/products.csv','products.csv')">📦 المنتجات والمخزون</button>
        <button class="btn secondary" onclick="downloadFile('export/expenses.csv?from=${fromStr}&to=${toStr}','expenses-${reportMonth}.csv')">💸 المصروفات</button>
      </div>
    </div>`;
}

/* ==================================================
   الإعدادات
================================================== */
async function renderSettings() {
  let usersHTML = '';
  if (isAdmin()) {
    try {
      const users = await api('users');
      usersHTML = `
      <div class="panel">
        <div class="panel-head">
          <h2>👥 المستخدمون (${users.length})</h2>
          <button class="btn small" onclick="userForm()">＋ إضافة مستخدم</button>
        </div>
        <div class="table-wrap"><table>
          <thead><tr><th>الاسم</th><th>اسم المستخدم</th><th>الدور</th><th></th></tr></thead>
          <tbody>${users.map((u) => `
            <tr>
              <td>${esc(u.name)}</td>
              <td>${esc(u.username)}</td>
              <td>${u.role === 'admin' ? '👑 مدير' : '🧾 كاشير'}</td>
              <td>
                ${u.id !== me.id ? `<button class="btn small danger" onclick="deleteUser('${u.id}')">حذف</button>` : '<small style="color:var(--muted)">حسابك الحالي</small>'}
              </td>
            </tr>`).join('')}
          </tbody></table></div>
      </div>`;
    } catch (e) { toast(e.message, 'err'); }
  }

  $('#view').innerHTML = `
    <div class="panel">
      <h2>🔑 تغيير كلمة المرور</h2>
      <div class="field-row">
        <div class="field"><label>كلمة المرور الحالية</label><input id="p_cur" type="password" /></div>
        <div class="field"><label>الجديدة</label><input id="p_next" type="password" /></div>
      </div>
      <button class="btn secondary" onclick="changePassword()">تغيير</button>
    </div>

    ${isAdmin() ? `
    <div class="panel">
      <h2>⚙️ إعدادات المحل</h2>
      <div class="field"><label>اسم المحل (يظهر في الفاتورة)</label>
        <input id="s_shop" value="${esc(state.settings.shopName)}" /></div>
      <div class="field"><label>العملة</label>
        <input id="s_cur" value="${esc(state.settings.currency)}" /></div>
      <button class="btn" onclick="saveSettings()">💾 حفظ الإعدادات</button>
    </div>` : ''}

    ${usersHTML}

    ${isAdmin() ? `
    <div class="panel">
      <h2>💾 النسخ الاحتياطي</h2>
      <p style="color:var(--muted);font-size:.9rem;margin-bottom:12px">نزّل نسخة من كل بياناتك دورياً واحتفظ بها في مكان آمن.</p>
      <button class="btn secondary" onclick="downloadFile('backup','hoba-backup.json')">⬇️ تنزيل نسخة احتياطية</button>
    </div>` : ''}
  `;
}

window.changePassword = async () => {
  try {
    if (!val('p_cur') || !val('p_next')) throw new Error('املأ الحقلين');
    await api('password', 'POST', { current: val('p_cur'), next: val('p_next') });
    toast('تم تغيير كلمة المرور ✅');
    renderSettings();
  } catch (e) { toast(e.message, 'err'); }
};

window.saveSettings = async () => {
  try {
    await api('settings', 'PUT', { shopName: val('s_shop'), currency: val('s_cur') });
    await loadState();
    toast('تم حفظ الإعدادات ✅');
  } catch (e) { toast(e.message, 'err'); }
};

window.userForm = () => {
  openModal('إضافة مستخدم', `
    <div class="field"><label>الاسم *</label><input id="f_name" placeholder="مثال: أحمد (كاشير)" /></div>
    <div class="field"><label>اسم المستخدم *</label><input id="f_username" /></div>
    <div class="field"><label>كلمة المرور *</label><input id="f_password" type="password" /></div>
    <div class="field"><label>الدور</label>
      <select id="f_role">
        <option value="cashier">كاشير — بيع وعرض فقط</option>
        <option value="admin">مدير — كل الصلاحيات</option>
      </select>
    </div>
    <button class="btn" style="width:100%" onclick="saveUser()">💾 إضافة</button>`);
  $('#f_name').focus();
};

window.saveUser = async () => {
  try {
    if (!val('f_name') || !val('f_username') || !val('f_password')) throw new Error('املأ كل الحقول');
    await api('users', 'POST', { name: val('f_name'), username: val('f_username'), password: val('f_password'), role: $('#f_role').value });
    closeModal();
    toast('تمت إضافة المستخدم ✅');
    renderSettings();
  } catch (e) { toast(e.message, 'err'); }
};

window.deleteUser = async (uid) => {
  if (!confirm('حذف هذا المستخدم؟ لن يستطيع الدخول بعدها.')) return;
  try {
    await api(`users/${uid}`, 'DELETE');
    toast('تم الحذف');
    renderSettings();
  } catch (e) { toast(e.message, 'err'); }
};

/* ---------------- التشغيل الأول ---------------- */
(async function init() {
  const token = getToken();
  if (token) {
    try {
      me = await api('me');
      await loadState();
      showApp();
      route();
      return;
    } catch { /* التوكن غير صالح */ }
  }
  await showAuth();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
})();
