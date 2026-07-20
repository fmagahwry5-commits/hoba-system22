/**
 * اختبار يحاكي استدعاء Vercel الفعلي للدالة api/index.js:
 * - الطلبات تصل بالبيانات مُحلّلة مسبقاً في req.body (بدون تدفق)
 * - الاستجابة عبر writeHead/end
 * التشغيل: node tests/vercel-handler.test.js
 */
'use strict';

process.env.SESSION_SECRET = 'vercel-test-secret';
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_KEY;

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// قاعدة بيانات نظيفة للاختبار (الوضع المحلي JSON)
const DATA_DIR = path.join(__dirname, '..', 'data');
fs.rmSync(DATA_DIR, { recursive: true, force: true });

const invoke = require('../api/index.js');

/* محاكاة كائنَي req/res كما يمررهما Vercel */
function fakeReq({ method = 'GET', url = '/api/auth/status', body, token } = {}) {
  const req = {
    method,
    url,
    headers: { host: 'hoba.vercel.app', 'x-forwarded-for': '1.2.3.4' },
    socket: { remoteAddress: '1.2.3.4' },
    on(event, cb) { if (event === 'end') cb(); return req; }, // تدفق فارغ احتياطي
  };
  if (body !== undefined) req.body = body; // Vercel يحلله مسبقاً
  if (token) req.headers.authorization = `Bearer ${token}`;
  return req;
}

function fakeRes() {
  const res = {
    statusCode: 200,
    headers: {},
    bodyText: '',
    writeHead(code, headers) { res.statusCode = code; Object.assign(res.headers, headers || {}); return res; },
    end(data) { res.bodyText = data || ''; },
    json() { return JSON.parse(res.bodyText); },
  };
  return res;
}

const call = async (opts) => {
  const res = fakeRes();
  await invoke(fakeReq(opts), res);
  return res;
};

(async () => {
  /* 1) الحالة الأولية: يحتاج إعداداً */
  let r = await call({ url: '/api/auth/status' });
  assert.strictEqual(r.json().data.needsSetup, true);
  console.log('✅ [serverless] auth/status');

  /* 2) بدون توكن → 401 */
  r = await call({ url: '/api/state' });
  assert.strictEqual(r.statusCode, 401);
  console.log('✅ [serverless] رفض بدون توكن');

  /* 3) الإعداد الأول بجسم مُحلّل مسبقاً (كما يفعل Vercel) */
  r = await call({ method: 'POST', url: '/api/auth/setup', body: { name: 'المدير', username: 'admin', password: '1234' } });
  const admin = r.json().data;
  assert(admin.token.includes('.'));
  assert.strictEqual(admin.user.role, 'admin');
  console.log('✅ [serverless] إنشاء المدير عبر req.body المحلّل مسبقاً');

  /* 4) إعداد ثانٍ → مرفوض */
  r = await call({ method: 'POST', url: '/api/auth/setup', body: { username: 'x', password: 'yyyy' } });
  assert.strictEqual(r.statusCode, 403);
  console.log('✅ [serverless] رفض الإعداد الثاني');

  /* 5) إضافة منتج */
  r = await call({ method: 'POST', url: '/api/products', token: admin.token, body: { name: 'شاي', buyPrice: 40, sellPrice: 55, stock: 10, barcode: '123' } });
  const product = r.json().data;
  assert.strictEqual(product.barcode, '123');
  console.log('✅ [serverless] إضافة منتج');

  /* 6) كاشير: صلاحيات مقيدة */
  await call({ method: 'POST', url: '/api/users', token: admin.token, body: { name: 'كاشير', username: 'c1', password: '5678', role: 'cashier' } });
  r = await call({ method: 'POST', url: '/api/auth/login', body: { username: 'c1', password: '5678' } });
  const cashier = r.json().data;
  r = await call({ method: 'POST', url: '/api/products', token: cashier.token, body: { name: 'ممنوع' } });
  assert.strictEqual(r.statusCode, 403);
  console.log('✅ [serverless] الكاشير ممنوع من إضافة منتجات');

  /* 7) الكاشير يبيع فاتورة → يُخصم المخزون */
  r = await call({ method: 'POST', url: '/api/invoices', token: cashier.token, body: { items: [{ productId: product.id, qty: 2 }], note: '' } });
  const inv = r.json().data;
  assert.strictEqual(inv.total, 110);
  assert.strictEqual(inv.createdByName, 'كاشير');
  r = await call({ url: '/api/state', token: cashier.token });
  assert.strictEqual(r.json().data.products[0].stock, 8);
  console.log('✅ [serverless] فاتورة + خصم مخزون + اسم البائع');

  /* 8) توكن معدَّل يُرفض */
  r = await call({ url: '/api/state', token: cashier.token.slice(0, -2) + 'xx' });
  assert.strictEqual(r.statusCode, 401);
  console.log('✅ [serverless] رفض التوكن المعدَّل');

  /* 9) تصدير CSV بالعربية (للمدير) */
  r = await call({ url: '/api/export/sales.csv', token: admin.token });
  assert(r.bodyText.includes('رقم;التاريخ'), 'رؤوس CSV بالعربية');
  assert(r.bodyText.includes('كاشير'), 'عمود البائع');
  console.log('✅ [serverless] تصدير CSV');

  /* 10) نسخة احتياطية للمدير فقط */
  r = await call({ url: '/api/backup', token: cashier.token });
  assert.strictEqual(r.statusCode, 403);
  r = await call({ url: '/api/backup', token: admin.token });
  assert.strictEqual(JSON.parse(r.bodyText).users.length, 2);
  console.log('✅ [serverless] النسخ الاحتياطي محمي');

  /* 11) مسار غير موجود */
  r = await call({ url: '/api/whatever' });
  assert(r.statusCode === 404 || r.statusCode === 401);
  console.log('✅ [serverless] مسار غير معروف');

  // تنظيف
  fs.rmSync(DATA_DIR, { recursive: true, force: true });

  console.log('\n🎉 كل اختبارات محاكاة Vercel نجحت');
})().catch((err) => {
  console.error('❌ فشل الاختبار:', err);
  process.exit(1);
});
