/**
 * نظام هوبا للإدارة والمبيعات — خادم بدون أي مكتبات خارجية
 * التشغيل:  node server.js
 * الكمبيوتر هو "السيرفر" وكل الأجهزة (موبايل/كمبيوتر) على نفس الواي فاي تتصل به.
 * البيانات تتحفظ في: data/db.json على الكمبيوتر
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

/* ------------------------------------------------------------------ */
/* قاعدة البيانات (ملف JSON على الكمبيوتر)                             */
/* ------------------------------------------------------------------ */

const emptyDB = () => ({
  settings: { shopName: 'محل هوبا', currency: 'جنيه' },
  products: [],   // {id, name, buyPrice, sellPrice, stock, createdAt}
  customers: [],  // {id, name, phone, notes, createdAt}
  invoices: [],   // {id, number, customerId, customerName, items:[{productId,name,price,qty}], total, note, createdAt}
  expenses: [],   // {id, title, amount, createdAt}
  counters: { invoice: 1 },
});

let db = emptyDB();

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      db = Object.assign(emptyDB(), raw);
      db.counters = Object.assign({ invoice: 1 }, raw.counters);
    }
  } catch (err) {
    console.error('⚠️  خطأ في قراءة قاعدة البيانات، سيتم إنشاء نسخة جديدة:', err.message);
  }
}

let saveTimer = null;
function saveDB() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const tmp = DB_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
      fs.renameSync(tmp, DB_FILE); // كتابة ذرّية حتى لا يتلف الملف لو انقطع الكهرباء
    } catch (err) {
      console.error('⚠️  فشل حفظ قاعدة البيانات:', err.message);
    }
  }, 150);
}

loadDB();

/* ------------------------------------------------------------------ */
/* أدوات مساعدة                                                        */
/* ------------------------------------------------------------------ */

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) reject(new Error('الطلب كبير جداً'));
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('صيغة JSON غير صحيحة'));
      }
    });
    req.on('error', reject);
  });
}

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

const ok = (res, data) => send(res, 200, { ok: true, data });
const fail = (res, status, message) => send(res, status, { ok: false, error: message });

const num = (v, dflt = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
};

const str = (v, dflt = '') => (typeof v === 'string' ? v.trim() : dflt);

/* ------------------------------------------------------------------ */
/* واجهة الـ API                                                       */
/* ------------------------------------------------------------------ */

async function handleAPI(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean); // ["api","products",":id"]
  const resource = parts[1];
  const itemId = parts[2] ? decodeURIComponent(parts[2]) : null;
  const method = req.method;
  const body = method === 'GET' ? {} : await readBody(req);

  /* ---- الحالة الكاملة (للتحميل الأول) ---- */
  if (method === 'GET' && resource === 'state') {
    return ok(res, db);
  }

  /* ---- الإعدادات ---- */
  if (resource === 'settings') {
    if (method === 'PUT') {
      db.settings.shopName = str(body.shopName, db.settings.shopName) || db.settings.shopName;
      db.settings.currency = str(body.currency, db.settings.currency) || db.settings.currency;
      saveDB();
      return ok(res, db.settings);
    }
    return fail(res, 405, 'غير مسموح');
  }

  /* ---- المنتجات ---- */
  if (resource === 'products') {
    if (method === 'POST') {
      const name = str(body.name);
      if (!name) return fail(res, 400, 'اسم المنتج مطلوب');
      const p = {
        id: id(),
        name,
        buyPrice: Math.max(0, num(body.buyPrice)),
        sellPrice: Math.max(0, num(body.sellPrice)),
        stock: Math.max(0, num(body.stock)),
        createdAt: now(),
      };
      db.products.push(p);
      saveDB();
      return ok(res, p);
    }
    const idx = db.products.findIndex((p) => p.id === itemId);
    if (idx === -1) return fail(res, 404, 'المنتج غير موجود');
    if (method === 'PUT') {
      const p = db.products[idx];
      if (body.name !== undefined && str(body.name)) p.name = str(body.name);
      if (body.buyPrice !== undefined) p.buyPrice = Math.max(0, num(body.buyPrice));
      if (body.sellPrice !== undefined) p.sellPrice = Math.max(0, num(body.sellPrice));
      if (body.stock !== undefined) p.stock = Math.max(0, num(body.stock));
      saveDB();
      return ok(res, p);
    }
    if (method === 'DELETE') {
      const [removed] = db.products.splice(idx, 1);
      saveDB();
      return ok(res, removed);
    }
    return fail(res, 405, 'غير مسموح');
  }

  /* ---- العملاء ---- */
  if (resource === 'customers') {
    if (method === 'POST') {
      const name = str(body.name);
      if (!name) return fail(res, 400, 'اسم العميل مطلوب');
      const c = { id: id(), name, phone: str(body.phone), notes: str(body.notes), createdAt: now() };
      db.customers.push(c);
      saveDB();
      return ok(res, c);
    }
    const idx = db.customers.findIndex((c) => c.id === itemId);
    if (idx === -1) return fail(res, 404, 'العميل غير موجود');
    if (method === 'PUT') {
      const c = db.customers[idx];
      if (body.name !== undefined && str(body.name)) c.name = str(body.name);
      if (body.phone !== undefined) c.phone = str(body.phone);
      if (body.notes !== undefined) c.notes = str(body.notes);
      saveDB();
      return ok(res, c);
    }
    if (method === 'DELETE') {
      const [removed] = db.customers.splice(idx, 1);
      saveDB();
      return ok(res, removed);
    }
    return fail(res, 405, 'غير مسموح');
  }

  /* ---- الفواتير ---- */
  if (resource === 'invoices') {
    if (method === 'POST') {
      const items = Array.isArray(body.items) ? body.items : [];
      if (items.length === 0) return fail(res, 400, 'أضف صنفاً واحداً على الأقل');

      const invoiceItems = [];
      for (const it of items) {
        const p = db.products.find((x) => x.id === it.productId);
        if (!p) return fail(res, 400, 'منتج غير موجود في الفاتورة');
        const qty = Math.max(1, num(it.qty, 1));
        if (p.stock < qty) {
          return fail(res, 400, `الكمية غير كافية من «${p.name}» — المتاح ${p.stock}`);
        }
        invoiceItems.push({ productId: p.id, name: p.name, price: p.sellPrice, qty });
      }

      // خصم الكميات من المخزون
      for (const it of invoiceItems) {
        db.products.find((x) => x.id === it.productId).stock -= it.qty;
      }

      const customer = db.customers.find((c) => c.id === body.customerId);
      const invoice = {
        id: id(),
        number: db.counters.invoice++,
        customerId: customer ? customer.id : null,
        customerName: customer ? customer.name : '',
        items: invoiceItems,
        total: invoiceItems.reduce((s, i) => s + i.price * i.qty, 0),
        note: str(body.note),
        createdAt: now(),
      };
      db.invoices.push(invoice);
      saveDB();
      return ok(res, invoice);
    }

    const idx = db.invoices.findIndex((v) => v.id === itemId);
    if (idx === -1) return fail(res, 404, 'الفاتورة غير موجودة');
    if (method === 'DELETE') {
      const [removed] = db.invoices.splice(idx, 1);
      // إرجاع الكميات للمخزون
      for (const it of removed.items) {
        const p = db.products.find((x) => x.id === it.productId);
        if (p) p.stock += it.qty;
      }
      saveDB();
      return ok(res, removed);
    }
    return fail(res, 405, 'غير مسموح');
  }

  /* ---- المصروفات ---- */
  if (resource === 'expenses') {
    if (method === 'POST') {
      const title = str(body.title);
      const amount = num(body.amount);
      if (!title || amount <= 0) return fail(res, 400, 'اكتب وصف المصروف ومبلغاً صحيحاً');
      const e = { id: id(), title, amount, createdAt: body.date ? new Date(body.date).toISOString() : now() };
      db.expenses.push(e);
      saveDB();
      return ok(res, e);
    }
    const idx = db.expenses.findIndex((e) => e.id === itemId);
    if (idx === -1) return fail(res, 404, 'المصروف غير موجود');
    if (method === 'DELETE') {
      const [removed] = db.expenses.splice(idx, 1);
      saveDB();
      return ok(res, removed);
    }
    return fail(res, 405, 'غير مسموح');
  }

  /* ---- نسخة احتياطية ---- */
  if (resource === 'backup' && method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="hoba-backup-${Date.now()}.json"`,
    });
    return res.end(JSON.stringify(db, null, 2));
  }

  return fail(res, 404, 'المسار غير موجود');
}

/* ------------------------------------------------------------------ */
/* الملفات الثابتة (الواجهة)                                           */
/* ------------------------------------------------------------------ */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function serveStatic(req, res, url) {
  let filePath = decodeURIComponent(url.pathname);
  if (filePath === '/') filePath = '/index.html';

  const full = path.normalize(path.join(PUBLIC_DIR, filePath));
  if (!full.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('ممنوع');
  }

  fs.readFile(full, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('الصفحة غير موجودة');
    }
    const ext = path.extname(full).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
    });
    res.end(data);
  });
}

/* ------------------------------------------------------------------ */
/* تشغيل الخادم                                                        */
/* ------------------------------------------------------------------ */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      await handleAPI(req, res, url);
    } else {
      serveStatic(req, res, url);
    }
  } catch (err) {
    console.error(err);
    fail(res, 500, err.message || 'خطأ في الخادم');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('✅ نظام هوبا يعمل الآن!');
  console.log('──────────────────────────────────────────────');
  console.log(`🖥️  من هذا الكمبيوتر افتح:   http://localhost:${PORT}`);
  console.log('');
  console.log('📱 من الموبايل (على نفس الواي فاي) افتح أحد هذه العناوين:');
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`     👉  http://${net.address}:${PORT}`);
      }
    }
  }
  console.log('──────────────────────────────────────────────');
  console.log('💾 البيانات تتحفظ في: ' + DB_FILE);
  console.log('⏹️  للإيقاف اضغط Ctrl+C');
  console.log('');
});
