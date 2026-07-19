/**
 * نظام هوبا — التخزين السحابي (Supabase / PostgreSQL عبر REST API)
 * يعمل بواجهة fetch المدمجة في Node.js — بدون أي مكتبات خارجية.
 * تُفعَّل هذه الطبقة تلقائياً عند ضبط متغيري البيئة:
 *   SUPABASE_URL           مثال: https://abcd.supabase.co
 *   SUPABASE_SERVICE_KEY   مفتاح service_role (يبقى سراً على السيرفر فقط)
 */
'use strict';

const { hashPassword } = require('./auth');

const num = (v, dflt = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
};
const str = (v, dflt = '') => (typeof v === 'string' ? v.trim() : dflt);

function createSupabaseStore(baseUrl, serviceKey) {
  const REST = `${baseUrl.replace(/\/+$/, '')}/rest/v1`;

  const headers = (extra = {}) => ({
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    ...extra,
  });

  async function request(path, { method = 'GET', body, prefer } = {}) {
    const res = await fetch(REST + path, {
      method,
      headers: headers(prefer ? { Prefer: prefer } : {}),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* ignore */ }
    if (!res.ok) {
      let msg = (json && json.message) || `خطأ في قاعدة البيانات (${res.status})`;
      if (json && json.code === '23505') msg = 'موجود مسبقاً — البيانات مكررة';
      throw new Error(msg);
    }
    return json;
  }

  /* ---------------- تحويل الصفوف (snake ⇄ camel) ---------------- */
  const toProduct = (r) => ({
    id: r.id, name: r.name,
    buyPrice: num(r.buy_price), sellPrice: num(r.sell_price), stock: num(r.stock),
    barcode: r.barcode || '', createdAt: r.created_at,
  });
  const toCustomer = (r) => ({ id: r.id, name: r.name, phone: r.phone || '', notes: r.notes || '', createdAt: r.created_at });
  const toInvoice = (r) => ({
    id: r.id, number: num(r.number),
    customerId: r.customer_id, customerName: r.customer_name || '',
    items: Array.isArray(r.items) ? r.items : [],
    total: num(r.total), cost: num(r.cost),
    note: r.note || '',
    createdBy: r.created_by, createdByName: r.created_by_name || '',
    createdAt: r.created_at,
  });
  const toExpense = (r) => ({ id: r.id, title: r.title, amount: num(r.amount), createdAt: r.created_at });
  const toUser = (r) => ({ id: r.id, username: r.username, name: r.name, role: r.role, createdAt: r.created_at });

  const one = (arrOrObj, notFoundMsg) => {
    const row = Array.isArray(arrOrObj) ? arrOrObj[0] : arrOrObj;
    if (!row) throw new Error(notFoundMsg);
    return row;
  };

  return {
    mode: 'supabase',

    async getState() {
      const [settings, products, customers, invoices, expenses] = await Promise.all([
        request('/settings?select=shop_name,currency&id=eq.1'),
        request('/products?select=id,name,buy_price,sell_price,stock,barcode,created_at&order=created_at.asc'),
        request('/customers?select=id,name,phone,notes,created_at&order=created_at.asc'),
        request('/invoices?select=id,number,customer_id,customer_name,items,total,cost,note,created_by,created_by_name,created_at&order=created_at.asc'),
        request('/expenses?select=id,title,amount,created_at&order=created_at.asc'),
      ]);
      const s = settings[0] || { shop_name: 'محل هوبا', currency: 'جنيه' };
      return {
        settings: { shopName: s.shop_name, currency: s.currency },
        products: products.map(toProduct),
        customers: customers.map(toCustomer),
        invoices: invoices.map(toInvoice),
        expenses: expenses.map(toExpense),
      };
    },

    async getBackup() {
      const state = await this.getState();
      const users = await this.listUsers();
      return { ...state, users };
    },

    /* الإعدادات */
    async updateSettings(patch) {
      const body = {};
      if (patch.shopName && str(patch.shopName)) body.shop_name = str(patch.shopName);
      if (patch.currency && str(patch.currency)) body.currency = str(patch.currency);
      const rows = await request('/settings?id=eq.1', { method: 'PATCH', body, prefer: 'return=representation' });
      const s = one(rows, 'الإعدادات غير موجودة');
      return { shopName: s.shop_name, currency: s.currency };
    },

    /* المنتجات */
    async createProduct(bodyP) {
      if (!str(bodyP.name)) throw new Error('اسم المنتج مطلوب');
      const rows = await request('/products', {
        method: 'POST',
        body: {
          name: str(bodyP.name),
          buy_price: Math.max(0, num(bodyP.buyPrice)),
          sell_price: Math.max(0, num(bodyP.sellPrice)),
          stock: Math.max(0, num(bodyP.stock)),
          barcode: str(bodyP.barcode),
        },
        prefer: 'return=representation',
      });
      return toProduct(one(rows, 'فشل إنشاء المنتج'));
    },
    async updateProduct(pid, bodyP) {
      const body = {};
      if (bodyP.name !== undefined && str(bodyP.name)) body.name = str(bodyP.name);
      if (bodyP.buyPrice !== undefined) body.buy_price = Math.max(0, num(bodyP.buyPrice));
      if (bodyP.sellPrice !== undefined) body.sell_price = Math.max(0, num(bodyP.sellPrice));
      if (bodyP.stock !== undefined) body.stock = Math.max(0, num(bodyP.stock));
      if (bodyP.barcode !== undefined) body.barcode = str(bodyP.barcode);
      const rows = await request(`/products?id=eq.${encodeURIComponent(pid)}`, { method: 'PATCH', body, prefer: 'return=representation' });
      return toProduct(one(rows, 'المنتج غير موجود'));
    },
    async deleteProduct(pid) {
      const rows = await request(`/products?id=eq.${encodeURIComponent(pid)}`, { method: 'DELETE', prefer: 'return=representation' });
      return toProduct(one(rows, 'المنتج غير موجود'));
    },

    /* العملاء */
    async createCustomer(bodyC) {
      if (!str(bodyC.name)) throw new Error('اسم العميل مطلوب');
      const rows = await request('/customers', {
        method: 'POST',
        body: { name: str(bodyC.name), phone: str(bodyC.phone), notes: str(bodyC.notes) },
        prefer: 'return=representation',
      });
      return toCustomer(one(rows, 'فشل إنشاء العميل'));
    },
    async updateCustomer(cid, bodyC) {
      const body = {};
      if (bodyC.name !== undefined && str(bodyC.name)) body.name = str(bodyC.name);
      if (bodyC.phone !== undefined) body.phone = str(bodyC.phone);
      if (bodyC.notes !== undefined) body.notes = str(bodyC.notes);
      const rows = await request(`/customers?id=eq.${encodeURIComponent(cid)}`, { method: 'PATCH', body, prefer: 'return=representation' });
      return toCustomer(one(rows, 'العميل غير موجود'));
    },
    async deleteCustomer(cid) {
      const rows = await request(`/customers?id=eq.${encodeURIComponent(cid)}`, { method: 'DELETE', prefer: 'return=representation' });
      return toCustomer(one(rows, 'العميل غير موجود'));
    },

    /* الفواتير — عبر وظائف SQL ذرّية (تخصم/ترجع المخزون داخل قاعدة البيانات) */
    async createInvoice({ customerId, items, note, userId }) {
      const row = await request('/rpc/create_invoice', {
        method: 'POST',
        body: {
          p_customer: customerId || null,
          p_items: items.map((i) => ({ productId: i.productId, qty: Math.max(1, num(i.qty, 1)) })),
          p_note: str(note),
          p_created_by: userId || null,
        },
      });
      return toInvoice(one(row, 'فشل إنشاء الفاتورة'));
    },
    async deleteInvoice(vid) {
      await request('/rpc/delete_invoice', { method: 'POST', body: { p_id: vid } });
      return { id: vid };
    },

    /* المصروفات */
    async createExpense(bodyE) {
      const amount = num(bodyE.amount);
      if (!str(bodyE.title) || amount <= 0) throw new Error('اكتب وصف المصروف ومبلغاً صحيحاً');
      const row = {
        title: str(bodyE.title),
        amount,
      };
      if (bodyE.date) row.created_at = new Date(bodyE.date).toISOString();
      const rows = await request('/expenses', { method: 'POST', body: row, prefer: 'return=representation' });
      return toExpense(one(rows, 'فشل إضافة المصروف'));
    },
    async deleteExpense(eid) {
      const rows = await request(`/expenses?id=eq.${encodeURIComponent(eid)}`, { method: 'DELETE', prefer: 'return=representation' });
      return toExpense(one(rows, 'المصروف غير موجود'));
    },

    /* المستخدمون */
    async countUsers() {
      const rows = await request('/app_users?select=id');
      return rows.length;
    },
    async listUsers() {
      const rows = await request('/app_users?select=id,username,name,role,created_at&order=created_at.asc');
      return rows.map(toUser);
    },
    async findUserByUsername(username) {
      const rows = await request(`/app_users?username=eq.${encodeURIComponent(String(username).trim())}&select=id,username,pass_hash,name,role,created_at`);
      const r = rows[0];
      return r ? { id: r.id, username: r.username, name: r.name, role: r.role, passHash: r.pass_hash } : null;
    },
    async createUser({ username, name, password, role }) {
      username = str(username);
      name = str(name);
      if (!username || !password) throw new Error('اسم المستخدم وكلمة المرور مطلوبان');
      if (String(password).length < 4) throw new Error('كلمة المرور قصيرة — 4 أحرف على الأقل');
      if (await this.findUserByUsername(username)) throw new Error('اسم المستخدم مستخدم من قبل');
      const rows = await request('/app_users', {
        method: 'POST',
        body: { username, name: name || username, pass_hash: hashPassword(password), role: role === 'admin' ? 'admin' : 'cashier' },
        prefer: 'return=representation',
      });
      return toUser(one(rows, 'فشل إنشاء المستخدم'));
    },
    async setUserPassword(uid, password) {
      if (String(password).length < 4) throw new Error('كلمة المرور قصيرة — 4 أحرف على الأقل');
      const rows = await request(`/app_users?id=eq.${encodeURIComponent(uid)}`, {
        method: 'PATCH',
        body: { pass_hash: hashPassword(password) },
        prefer: 'return=representation',
      });
      one(rows, 'المستخدم غير موجود');
    },
    async deleteUser(uid) {
      const rows = await request(`/app_users?id=eq.${encodeURIComponent(uid)}`, { method: 'DELETE', prefer: 'return=representation' });
      one(rows, 'المستخدم غير موجود');
    },
  };
}

module.exports = { createSupabaseStore };
