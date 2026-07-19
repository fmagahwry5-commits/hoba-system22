/**
 * نظام هوبا — المصادقة وإدارة الجلسات
 * كلمات المرور مُشفّرة بـ scrypt (مدمج في Node.js) — لا تُحفظ أبداً كنصّ صريح.
 */
'use strict';

const crypto = require('crypto');

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

/* ---------------- الجلسات (توكن في الذاكرة) ---------------- */

const sessions = new Map(); // token -> { user, exp }
const SESSION_DAYS = 30;

function newSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  sessions.set(token, { user: { id: user.id, username: user.username, name: user.name, role: user.role }, exp });
  return token;
}

function getSession(token) {
  if (!token) return null;
  const s = sessions.get(token);
  if (!s) return null;
  if (Date.now() > s.exp) {
    sessions.delete(token);
    return null;
  }
  return s.user;
}

function destroySession(token) {
  sessions.delete(token);
}

/* ---------------- حماية تسجيل الدخول من التخمين ---------------- */

const attempts = new Map(); // ip -> { fails, until }
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
