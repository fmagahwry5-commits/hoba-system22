/**
 * نظام هوبا للإدارة والمبيعات — الخادم (بدون أي مكتبات خارجية)
 * التشغيل:  node server.js
 *
 * وضعان للتشغيل:
 *  • محلي  : البيانات في data/db.json — الأجهزة الأخرى تتصل عبر نفس الواي فاي
 *  • سحابي : اضبط SUPABASE_URL و SUPABASE_SERVICE_KEY — يعمل من أي مكان في العالم
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const store = require('./store');
const auth = require('./auth');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');

/* ---------------- أدوات ---------------- */

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) reject(new Error('الطلب كبير جداً'));
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch { reject(new Error('صيغة JSON غير صحيحة')); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}
const ok = (res, data) => sendJson(res, 200, { ok: true, data });
const fail = (res, status, message) => sendJson(res, status, { ok: false, error: message });

const bearer = (req) => {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
};

const clientIP = (req) =>
  (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';

/* ---------------- ملفات CSV (تفتح في Excel) ---------------- */

function toCSV(headers, rows) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [headers.map(esc).join(';')];
  for (const r of rows) lines.push(r.map(esc).join(';'));
  return '﻿' + lines.join('\r\n'); // BOM حتى يقرأ Excel العربية صحيحاً
}

async function exportCSV(res, kind, query) {
  const state = await store.getState();
  const from = query.get('from') ? new Date(query.get('from')) : null;
  const to = query.get('to') ? new Date(query.get('to') + 'T23:59:59') : null;
  const inRange = (iso) => {
    const d = new Date(iso);
    return (!from || d >= from) && (!to || d <= to);
  };

  let filename = kind, csv = '';
  if (kind === 'sales') {
    const rows = state.invoices.filter((v) => inRange(v.createdAt)).map((v) => [
      v.number,
      new Date(v.createdAt).toLocaleString('ar-EG'),
      v.customerName || 'بدون اسم',
      v.items.reduce((s, i) => s + i.qty, 0),
      v.total,
      v.cost || 0,
      v.total - (v.cost || 0),
      v.createdByName || '',
      v.note || '',
    ]);
    csv = toCSV(['رقم', 'التاريخ', 'العميل', 'الأصناف', 'الإجمالي', 'التكلفة', 'الربح', 'البائع', 'ملاحظة'], rows);
    filename = `sales-${Date.now()}.csv`;
  } else if (kind === 'products') {
    const rows = state.products.map((p) => [p.name, p.barcode || '', p.buyPrice, p.sellPrice, p.stock, p.buyPrice * p.stock]);
    csv = toCSV(['المنتج', 'الباركود', 'سعر الشراء', 'سعر البيع', 'المخزون', 'قيمة المخزون'], rows);
    filename = `products-${Date.now()}.csv`;
  } else if (kind === 'expenses') {
    const rows = state.expenses.filter((e) => inRange(e.createdAt)).map((e) => [
      e.title, e.amount, new Date(e.createdAt).toLocaleString('ar-EG'),
    ]);
    csv = toCSV(['الوصف', 'المبلغ', 'التاريخ'], rows);
    filename = `expenses-${Date.now()}.csv`;
  } else {
    return fail(res, 404, 'نوع التصدير غير موجود');
  }

  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
  });
  res.end(csv);
}

/* ---------------- واجهة الـ API ---------------- */

async function handleAPI(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean); // ["api","resource",":id"]
  const resource = parts[1];
  const sub = parts[2] ? decodeURIComponent(parts[2]) : null;
  const method = req.method;
  const body = method === 'GET' ? {} : await readBody(req);

  /* ===== مسارات مفتوحة: الحالة / الإعداد الأول / تسجيل الدخول ===== */
  if (resource === 'auth') {
    // هل يوجد مستخدمون؟ (لإظهار شاشة الإعداد الأولي)
    if (sub === 'status' && method === 'GET') {
      return ok(res, { needsSetup: (await store.countUsers()) === 0 });
    }

    // إنشاء حساب المدير — مسموح مرة واحدة فقط حين لا يوجد أي مستخدم
    if (sub === 'setup' && method === 'POST') {
      if ((await store.countUsers()) > 0) return fail(res, 403, 'تم الإعداد مسبقاً — سجّل دخولك');
      const user = await store.createUser({
        username: body.username, name: body.name, password: body.password, role: 'admin',
      });
      const token = auth.newSession(user);
      return ok(res, { token, user });
    }

    // تسجيل الدخول
    if (sub === 'login' && method === 'POST') {
      const ip = clientIP(req);
      const allowed = auth.loginAllowed(ip);
      if (!allowed.ok) {
        return fail(res, 429, `محاولات كثيرة — حاول بعد ${Math.ceil(allowed.waitSec / 60)} دقيقة`);
      }
      const found = await store.findUserByUsername(body.username);
      if (!found || !auth.verifyPassword(body.password, found.passHash)) {
        auth.loginFailed(ip);
        return fail(res, 401, 'اسم المستخدم أو كلمة المرور غير صحيحة');
      }
      auth.loginSucceeded(ip);
      const user = { id: found.id, username: found.username, name: found.name, role: found.role };
      return ok(res, { token: auth.newSession(user), user });
    }
    return fail(res, 404, 'المسار غير موجود');
  }

  /* ===== كل ما يلي يتطلب تسجيل الدخول ===== */
  const user = auth.getSession(bearer(req));
  if (!user) return fail(res, 401, 'سجّل دخولك أولاً');

  const isAdmin = user.role === 'admin';
  const requireAdmin = () => {
    if (!isAdmin) { const e = new Error('هذه الصلاحية للمدير فقط'); e.status = 403; throw e; }
  };

  /* --- بيانات الجلسة --- */
  if (resource === 'me' && method === 'GET') return ok(res, user);

  if (resource === 'logout' && method === 'POST') {
    auth.destroySession(bearer(req));
    return ok(res, {});
  }

  if (resource === 'password' && method === 'POST') {
    const found = await store.findUserByUsername(user.username);
    if (!found || !auth.verifyPassword(body.current, found.passHash)) {
      return fail(res, 400, 'كلمة المرور الحالية غير صحيحة');
    }
    await store.setUserPassword(user.id, body.next);
    return ok(res, {});
  }

  /* --- إدارة المستخدمين (المدير فقط) --- */
  if (resource === 'users') {
    requireAdmin();
    if (method === 'GET') return ok(res, await store.listUsers());
    if (method === 'POST') return ok(res, await store.createUser(body));
    if (method === 'DELETE' && sub) {
      if (sub === user.id) return fail(res, 400, 'لا يمكنك حذف حسابك أثناء استخدامه');
      await store.deleteUser(sub);
      return ok(res, {});
    }
    return fail(res, 405, 'غير مسموح');
  }

  /* --- الحالة الكاملة --- */
  if (resource === 'state' && method === 'GET') return ok(res, await store.getState());

  /* --- النسخ الاحتياطي (المدير فقط) --- */
  if (resource === 'backup' && method === 'GET') {
    requireAdmin();
    const data = await store.getBackup();
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="hoba-backup-${Date.now()}.json"`,
    });
    return res.end(JSON.stringify(data, null, 2));
  }

  /* --- تصدير CSV (المدير فقط) --- */
  if (resource === 'export' && method === 'GET' && sub) {
    requireAdmin();
    return exportCSV(res, sub.replace(/\.csv$/i, ''), url.searchParams);
  }

  /* --- الإعدادات (المدير فقط) --- */
  if (resource === 'settings') {
    requireAdmin();
    if (method === 'PUT') return ok(res, await store.updateSettings(body));
    return fail(res, 405, 'غير مسموح');
  }

  /* --- المنتجات (إدارة: المدير) --- */
  if (resource === 'products') {
    requireAdmin();
    if (method === 'POST') return ok(res, await store.createProduct(body));
    if (method === 'PUT' && sub) return ok(res, await store.updateProduct(sub, body));
    if (method === 'DELETE' && sub) return ok(res, await store.deleteProduct(sub));
    return fail(res, 405, 'غير مسموح');
  }

  /* --- العملاء (إضافة/تعديل: الجميع — حذف: المدير) --- */
  if (resource === 'customers') {
    if (method === 'POST') return ok(res, await store.createCustomer(body));
    if (method === 'PUT' && sub) return ok(res, await store.updateCustomer(sub, body));
    if (method === 'DELETE' && sub) { requireAdmin(); return ok(res, await store.deleteCustomer(sub)); }
    return fail(res, 405, 'غير مسموح');
  }

  /* --- الفواتير (بيع: الجميع — حذف: المدير) --- */
  if (resource === 'invoices') {
    if (method === 'POST') {
      return ok(res, await store.createInvoice({
        customerId: body.customerId, items: body.items, note: body.note,
        userId: user.id, userName: user.name,
      }));
    }
    if (method === 'DELETE' && sub) { requireAdmin(); return ok(res, await store.deleteInvoice(sub)); }
    return fail(res, 405, 'غير مسموح');
  }

  /* --- المصروفات (المدير فقط) --- */
  if (resource === 'expenses') {
    requireAdmin();
    if (method === 'POST') return ok(res, await store.createExpense(body));
    if (method === 'DELETE' && sub) return ok(res, await store.deleteExpense(sub));
    return fail(res, 405, 'غير مسموح');
  }

  return fail(res, 404, 'المسار غير موجود');
}

/* ---------------- الملفات الثابتة ---------------- */

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
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'same-origin',
    });
    res.end(data);
  });
}

/* ---------------- التشغيل ---------------- */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('ok');
    }
    if (url.pathname.startsWith('/api/')) {
      await handleAPI(req, res, url);
    } else {
      serveStatic(req, res, url);
    }
  } catch (err) {
    const status = err.status || 400;
    fail(res, status, err.message || 'خطأ في الخادم');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('✅ نظام هوبا يعمل الآن!');
  console.log('──────────────────────────────────────────────');
  console.log(`🖥️  من هذا الكمبيوتر:   http://localhost:${PORT}`);
  if (store.mode === 'json') {
    console.log('');
    console.log('📱 من الموبايل (نفس الواي فاي) افتح:');
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal) console.log(`     👉  http://${net.address}:${PORT}`);
      }
    }
  }
  console.log('──────────────────────────────────────────────');
  if (store.mode === 'supabase') console.log('☁️  البيانات على القاعدة السحابية — يعمل من أي مكان');
  else console.log('💾 البيانات تتحفظ في: ' + path.join(__dirname, 'data', 'db.json'));
  console.log('⏹️  للإيقاف اضغط Ctrl+C');
  console.log('');
});
