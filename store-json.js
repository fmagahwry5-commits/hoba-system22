/**
 * نظام هوبا — التخزين المحلي (ملف JSON على الجهاز)
 * يُستخدم تلقائياً عند عدم وجود إعدادات سحابية.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { hashPassword } = require('./auth');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const num = (v, dflt = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
};
const str = (v, dflt = '') => (typeof v === 'string' ? v.trim() : dflt);

const emptyDB = () => ({
  settings: { shopName: 'محل هوبا', currency: 'جنيه' },
  products: [],
  customers: [],
  invoices: [],
  expenses: [],
  users: [],
  counters: { invoice: 1 },
});

let db = emptyDB();

/* ---------------- التحميل والحفظ ---------------- */
(function load() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      db = Object.assign(emptyDB(), raw);
      db.counters = Object.assign({ invoice: 1 }, raw.counters);
    }
  } catch (err) {
    console.error('⚠️ خطأ في قراءة قاعدة البيانات، سيتم إنشاء نسخة جديدة:', err.message);
  }
})();

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const tmp = DB_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
      fs.renameSync(tmp, DB_FILE); // كتابة ذرّية
    } catch (err) {
      console.error('⚠️ فشل حفظ قاعدة البيانات:', err.message);
    }
  }, 150);
}

/* ---------------- الواجهة ---------------- */
module.exports = {
  mode: 'json',

  async getState() {
    return {
      settings: db.settings,
      products: db.products,
      customers: db.customers,
      invoices: db.invoices,
      expenses: db.expenses,
    };
  },

  async getBackup() {
    return {
      ...db,
      users: db.users.map((u) => ({ username: u.username, name: u.name, role: u.role })),
    };
  },

  /* الإعدادات */
  async updateSettings(patch) {
    if (patch.shopName && str(patch.shopName)) db.settings.shopName = str(patch.shopName);
    if (patch.currency && str(patch.currency)) db.settings.currency = str(patch.currency);
    save();
    return db.settings;
  },

  /* المنتجات */
  async createProduct(body) {
    const name = str(body.name);
    if (!name) throw new Error('اسم المنتج مطلوب');
    const p = {
      id: id(),
      name,
      buyPrice: Math.max(0, num(body.buyPrice)),
      sellPrice: Math.max(0, num(body.sellPrice)),
      stock: Math.max(0, num(body.stock)),
      barcode: str(body.barcode),
      createdAt: now(),
    };
    db.products.push(p);
    save();
    return p;
  },
  async updateProduct(pid, body) {
    const p = db.products.find((x) => x.id === pid);
    if (!p) throw new Error('المنتج غير موجود');
    if (body.name !== undefined && str(body.name)) p.name = str(body.name);
    if (body.buyPrice !== undefined) p.buyPrice = Math.max(0, num(body.buyPrice));
    if (body.sellPrice !== undefined) p.sellPrice = Math.max(0, num(body.sellPrice));
    if (body.stock !== undefined) p.stock = Math.max(0, num(body.stock));
    if (body.barcode !== undefined) p.barcode = str(body.barcode);
    save();
    return p;
  },
  async deleteProduct(pid) {
    const idx = db.products.findIndex((x) => x.id === pid);
    if (idx === -1) throw new Error('المنتج غير موجود');
    const [removed] = db.products.splice(idx, 1);
    save();
    return removed;
  },

  /* العملاء */
  async createCustomer(body) {
    const name = str(body.name);
    if (!name) throw new Error('اسم العميل مطلوب');
    const c = { id: id(), name, phone: str(body.phone), notes: str(body.notes), createdAt: now() };
    db.customers.push(c);
    save();
    return c;
  },
  async updateCustomer(cid, body) {
    const c = db.customers.find((x) => x.id === cid);
    if (!c) throw new Error('العميل غير موجود');
    if (body.name !== undefined && str(body.name)) c.name = str(body.name);
    if (body.phone !== undefined) c.phone = str(body.phone);
    if (body.notes !== undefined) c.notes = str(body.notes);
    save();
    return c;
  },
  async deleteCustomer(cid) {
    const idx = db.customers.findIndex((x) => x.id === cid);
    if (idx === -1) throw new Error('العميل غير موجود');
    const [removed] = db.customers.splice(idx, 1);
    save();
    return removed;
  },

  /* الفواتير */
  async createInvoice({ customerId, items, note, userId, userName }) {
    if (!Array.isArray(items) || items.length === 0) throw new Error('أضف صنفاً واحداً على الأقل');

    const invoiceItems = [];
    for (const it of items) {
      const p = db.products.find((x) => x.id === it.productId);
      if (!p) throw new Error('منتج غير موجود في الفاتورة');
      const qty = Math.max(1, num(it.qty, 1));
      if (p.stock < qty) throw new Error(`الكمية غير كافية من «${p.name}» — المتاح ${p.stock}`);
      invoiceItems.push({ productId: p.id, name: p.name, price: p.sellPrice, cost: p.buyPrice, qty });
    }
    for (const it of invoiceItems) {
      db.products.find((x) => x.id === it.productId).stock -= it.qty;
    }

    const customer = db.customers.find((c) => c.id === customerId);
    const invoice = {
      id: id(),
      number: db.counters.invoice++,
      customerId: customer ? customer.id : null,
      customerName: customer ? customer.name : '',
      items: invoiceItems,
      total: invoiceItems.reduce((s, i) => s + i.price * i.qty, 0),
      cost: invoiceItems.reduce((s, i) => s + i.cost * i.qty, 0),
      note: str(note),
      createdBy: userId || null,
      createdByName: userName || '',
      createdAt: now(),
    };
    db.invoices.push(invoice);
    save();
    return invoice;
  },
  async deleteInvoice(vid) {
    const idx = db.invoices.findIndex((x) => x.id === vid);
    if (idx === -1) throw new Error('الفاتورة غير موجودة');
    const [removed] = db.invoices.splice(idx, 1);
    for (const it of removed.items) {
      const p = db.products.find((x) => x.id === it.productId);
      if (p) p.stock += it.qty;
    }
    save();
    return removed;
  },

  /* المصروفات */
  async createExpense(body) {
    const title = str(body.title);
    const amount = num(body.amount);
    if (!title || amount <= 0) throw new Error('اكتب وصف المصروف ومبلغاً صحيحاً');
    const e = { id: id(), title, amount, createdAt: body.date ? new Date(body.date).toISOString() : now() };
    db.expenses.push(e);
    save();
    return e;
  },
  async deleteExpense(eid) {
    const idx = db.expenses.findIndex((x) => x.id === eid);
    if (idx === -1) throw new Error('المصروف غير موجود');
    const [removed] = db.expenses.splice(idx, 1);
    save();
    return removed;
  },

  /* المستخدمون */
  async countUsers() {
    return db.users.length;
  },
  async listUsers() {
    return db.users.map((u) => ({ id: u.id, username: u.username, name: u.name, role: u.role, createdAt: u.createdAt }));
  },
  async findUserByUsername(username) {
    return db.users.find((u) => u.username === String(username).trim()) || null;
  },
  async createUser({ username, name, password, role }) {
    username = str(username);
    name = str(name);
    if (!username || !password) throw new Error('اسم المستخدم وكلمة المرور مطلوبان');
    if (String(password).length < 4) throw new Error('كلمة المرور قصيرة — 4 أحرف على الأقل');
    if (await this.findUserByUsername(username)) throw new Error('اسم المستخدم مستخدم من قبل');
    const u = {
      id: id(),
      username,
      name: name || username,
      passHash: hashPassword(password),
      role: role === 'admin' ? 'admin' : 'cashier',
      createdAt: now(),
    };
    db.users.push(u);
    save();
    return { id: u.id, username: u.username, name: u.name, role: u.role };
  },
  async setUserPassword(uid, password) {
    const u = db.users.find((x) => x.id === uid);
    if (!u) throw new Error('المستخدم غير موجود');
    if (String(password).length < 4) throw new Error('كلمة المرور قصيرة — 4 أحرف على الأقل');
    u.passHash = hashPassword(password);
    save();
  },
  async deleteUser(uid) {
    const idx = db.users.findIndex((x) => x.id === uid);
    if (idx === -1) throw new Error('المستخدم غير موجود');
    db.users.splice(idx, 1);
    save();
  },
};
