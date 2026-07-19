/**
 * اختبار طبقة Supabase بمحاكاة REST API (بدون خادم حقيقي)
 * التشغيل: node tests/store-supabase.test.js
 */
'use strict';

const assert = require('assert');

// سجلّ الطلبات + ردود محاكاة — نتحقق من الشكل المطلوب من PostgREST
const calls = [];
let nextResponse = { status: 200, body: [] };

global.fetch = async (url, opts = {}) => {
  calls.push({ url, method: opts.method || 'GET', headers: opts.headers, body: opts.body ? JSON.parse(opts.body) : undefined });
  return {
    ok: nextResponse.status >= 200 && nextResponse.status < 300,
    status: nextResponse.status,
    text: async () => JSON.stringify(nextResponse.body),
  };
};

const { createSupabaseStore } = require('../store-supabase');
const store = createSupabaseStore('https://example.supabase.co/', 'SECRET-KEY');

(async () => {
  /* 1) getState يجلب كل الجداول ويحوّل snake_case إلى camelCase */
  nextResponse = { status: 200, body: [] };
  let seq = 0;
  global.fetch = async (url, opts = {}) => {
    calls.push({ url, method: 'GET' });
    const bodies = [
      [{ shop_name: 'محلي', currency: 'جنيه' }],
      [{ id: 'p1', name: 'شاي', buy_price: '40', sell_price: '55', stock: '20', barcode: '123', created_at: '2026-01-01' }],
      [{ id: 'c1', name: 'أحمد', phone: '0100', notes: '', created_at: '2026-01-01' }],
      [{ id: 'v1', number: 7, customer_id: 'c1', customer_name: 'أحمد', items: [{ productId: 'p1', name: 'شاي', price: 55, cost: 40, qty: 2 }], total: 110, cost: 80, note: '', created_by: 'u1', created_by_name: 'مدير', created_at: '2026-01-02' }],
      [{ id: 'e1', title: 'كهرباء', amount: '300', created_at: '2026-01-01' }],
    ];
    return { ok: true, status: 200, text: async () => JSON.stringify(bodies[seq++]) };
  };

  const state = await store.getState();
  assert.strictEqual(state.settings.shopName, 'محلي');
  assert.strictEqual(state.products[0].buyPrice, 40);
  assert.strictEqual(state.products[0].barcode, '123');
  assert.strictEqual(state.invoices[0].createdByName, 'مدير');
  assert.strictEqual(state.invoices[0].items[0].cost, 40);
  assert(calls.some((c) => c.url.includes('/rest/v1/products?select=')), 'يجب طلب جدول المنتجات');
  console.log('✅ getState + التحويلات');

  /* 2) createProduct يرسل POST بالترويسات والحقول الصحيحة */
  calls.length = 0;
  global.fetch = async (url, opts = {}) => {
    calls.push({ url, method: opts.method, headers: opts.headers, body: JSON.parse(opts.body) });
    return { ok: true, status: 201, text: async () => JSON.stringify([{ id: 'p9', name: 'سكر', buy_price: 25, sell_price: 32, stock: 10, barcode: '555', created_at: '2026-01-01' }]) };
  };
  const p = await store.createProduct({ name: 'سكر', buyPrice: 25, sellPrice: 32, stock: 10, barcode: '555' });
  assert.strictEqual(p.sellPrice, 32);
  const post = calls[0];
  assert.strictEqual(post.method, 'POST');
  assert.strictEqual(post.headers.apikey, 'SECRET-KEY');
  assert.strictEqual(post.headers.Authorization, 'Bearer SECRET-KEY');
  assert.strictEqual(post.headers.Prefer, 'return=representation');
  assert.strictEqual(post.body.sell_price, 32);
  console.log('✅ createProduct');

  /* 3) createInvoice ينادي RPC بالمعاملات الصحيحة + أخطاء المخزون تصل بالعربية */
  calls.length = 0;
  global.fetch = async (url, opts = {}) => {
    calls.push({ url, method: opts.method, body: JSON.parse(opts.body) });
    return { ok: true, status: 200, text: async () => JSON.stringify({ id: 'v9', number: 8, customer_id: null, customer_name: '', items: [], total: 66, cost: 50, note: 'كاش', created_by: 'u1', created_by_name: '', created_at: '2026-01-03' }) };
  };
  const inv = await store.createInvoice({ customerId: null, items: [{ productId: 'p9', qty: 2 }], note: 'كاش', userId: 'u1' });
  assert.strictEqual(inv.number, 8);
  assert.strictEqual(calls[0].url, 'https://example.supabase.co/rest/v1/rpc/create_invoice');
  assert.deepStrictEqual(calls[0].body.p_items, [{ productId: 'p9', qty: 2 }]);
  console.log('✅ createInvoice → RPC');

  global.fetch = async () => ({
    ok: false, status: 400,
    text: async () => JSON.stringify({ code: 'P0001', message: 'الكمية غير كافية من «سكر» — المتاح 3' }),
  });
  await assert.rejects(() => store.createInvoice({ items: [{ productId: 'p9', qty: 99 }] }), /الكمية غير كافية/);
  console.log('✅ خطأ المخزون من SQL يصل بالعربية');

  /* 4) حذف فاتورة → RPC delete_invoice */
  calls.length = 0;
  global.fetch = async (url, opts = {}) => {
    calls.push({ url, method: opts.method, body: JSON.parse(opts.body) });
    return { ok: true, status: 200, text: async () => 'null' };
  };
  await store.deleteInvoice('v9');
  assert.strictEqual(calls[0].url, 'https://example.supabase.co/rest/v1/rpc/delete_invoice');
  assert.strictEqual(calls[0].body.p_id, 'v9');
  console.log('✅ deleteInvoice → RPC');

  /* 5) المستخدمون: تكرار اسم المستخدم → رسالة عربية */
  global.fetch = async (url) => {
    if (url.includes('/app_users?username=eq.')) {
      return { ok: true, status: 200, text: async () => JSON.stringify([{ id: 'u1', username: 'ahmed', pass_hash: 'x', name: 'أحمد', role: 'cashier', created_at: '' }]) };
    }
    return { ok: true, status: 200, text: async () => '[]' };
  };
  await assert.rejects(() => store.createUser({ username: 'ahmed', password: '1234' }), /مستخدم من قبل/);
  console.log('✅ منع تكرار اسم المستخدم');

  /* 6) findUserByUsername يعيد passHash للتحقق من الدخول */
  const found = await store.findUserByUsername('ahmed');
  assert.strictEqual(found.passHash, 'x');
  console.log('✅ findUserByUsername');

  /* 7) خطأ في PostgREST (مفتاح خاطئ) يظهر برسالة مفهومة */
  global.fetch = async () => ({
    ok: false, status: 401,
    text: async () => JSON.stringify({ message: 'Invalid API key' }),
  });
  await assert.rejects(() => store.getState(), /Invalid API key|400|401/);
  console.log('✅ التعامل مع أخطاء الاتصال');

  console.log('\n🎉 كل اختبارات طبقة Supabase نجحت');
})().catch((err) => {
  console.error('❌ فشل الاختبار:', err);
  process.exit(1);
});
