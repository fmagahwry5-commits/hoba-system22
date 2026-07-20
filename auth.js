/**
 * نظام هوبا — المصادقة
 * - كلمات المرور مُشفّرة بـ scrypt (مدمج في Node.js)
 * - الجلسات: توكنات موقّعة HMAC (بدون حالة على السيرفر) —
 *   لتعمل بشكل صحيح في بيئات Serverless مثل Vercel حيث لا ذاكرة مشتركة.
 */
'use strict';

const crypto = require('crypto');

/* المفتاح السري للتوقيع:
   - على الاستضافة: اضبط SESSION_SECRET (متغير بيئة) حتى تبقى الجلسات صالحة بين نسخ التشغيل
   - محلياً بدونه: يُولَّد عشوائي كل تشغيل (تسجيل دخول جديد بعد إعادة التشغيل فقط) */
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.SESSION_SECRET) {
  console.log('ℹ️  SESSION_SECRET غير مضبوط — الجلسات تنتهي بعد إعادة تشغيل السيرفر (آمن محلياً)');
}

/* ---------------- تشفير كلمات المرور ---------------- */

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  try {
    const [salt, hash] = String(stored).split(':');
    const candidate = crypto.scryptSync(String(password), salt, 64);
    const expected = Buffer.from(hash, 'hex');
    return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

/* ---------------- توكنات الجلسة الموقّعة (HMAC — بدون حالة) ---------------- */

const SESSION_DAYS = 30;

const b64u = (obj) => Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
const sign = (data) => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');

function newSession(user) {
  const payload = b64u({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  });
  return `${payload}.${sign(payload)}`;
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function getSession(token) {
  if (!token || typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot === -1) return null;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!safeEqual(signature, sign(payload))) return null; // توكن معدَّل/مزوَّر
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.exp || Date.now() > data.exp) return null; // منتهي الصلاحية
    return { id: data.id, username: data.username, name: data.name, role: data.role };
  } catch {
    return null;
  }
}

// التوكنات بلا حالة على السيرفر — تسجيل الخروج يحذف التوكن من جهاز المستخدم
function destroySession() {}

/* ---------------- حماية تسجيل الدخول من التخمين ---------------- */
/* (في الذاكرة: كامل محلياً، وأفضل جهد في Serverless) */

const attempts = new Map();
const MAX_FAILS = 5;
const LOCK_MIN = 5;

function loginAllowed(ip) {
  const a = attempts.get(ip);
  if (!a) return { ok: true };
  if (a.until && Date.now() < a.until) {
    return { ok: false, waitSec: Math.ceil((a.until - Date.now()) / 1000) };
  }
  return { ok: true };
}

function loginFailed(ip) {
  const a = attempts.get(ip) || { fails: 0, until: 0 };
  a.fails += 1;
  if (a.fails >= MAX_FAILS) {
    a.until = Date.now() + LOCK_MIN * 60 * 1000;
    a.fails = 0;
  }
  attempts.set(ip, a);
}

function loginSucceeded(ip) {
  attempts.delete(ip);
}

module.exports = {
  hashPassword,
  verifyPassword,
  newSession,
  getSession,
  destroySession,
  loginAllowed,
  loginFailed,
  loginSucceeded,
};
