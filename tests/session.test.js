/**
 * اختبار توكنات الجلسة الموقّعة (HMAC)
 * التشغيل: node tests/session.test.js
 */
'use strict';

process.env.SESSION_SECRET = 'test-secret-for-unit-tests';

const assert = require('assert');
const auth = require('../auth');

const user = { id: 'u1', username: 'admin', name: 'المدير', role: 'admin' };

/* 1) إصدار واسترجاع صحيح */
const token = auth.newSession(user);
const back = auth.getSession(token);
assert(back, 'التوكن الصحيح يجب أن يُقبل');
assert.strictEqual(back.username, 'admin');
assert.strictEqual(back.role, 'admin');
console.log('✅ إصدار واسترجاع التوكن');

/* 2) التلاعب بالدور (admin ← cashier) يُرفض */
const [payload] = token.split('.');
const forged = Buffer.from(JSON.stringify({ id: 'u1', username: 'ahmed', name: 'أحمد', role: 'admin', exp: Date.now() + 9999999 }), 'utf8').toString('base64url');
assert.strictEqual(auth.getSession(`${forged}.wrongsignature`), null);
// توقيع مسروق من توكن آخر لا يصلح لهذا المحتوى
assert.strictEqual(auth.getSession(`${forged}.${token.split('.')[1]}`), null);
console.log('✅ رفض التوكن المعدَّل (الدور المزوَّر)');

/* 3) انتهاء الصلاحية */
const crypto = require('crypto');
const expiredPayload = Buffer.from(JSON.stringify({ ...user, exp: Date.now() - 1000 }), 'utf8').toString('base64url');
const expiredSig = crypto.createHmac('sha256', 'test-secret-for-unit-tests').update(expiredPayload).digest('base64url');
assert.strictEqual(auth.getSession(`${expiredPayload}.${expiredSig}`), null, 'التوكن المنتهي يجب رفضه');
console.log('✅ رفض التوكن منتهي الصلاحية');

/* 4) تواقيع مختلفة بمفاتيح مختلفة */
assert.strictEqual(auth.getSession(`${payload}.`), null);
assert.strictEqual(auth.getSession('garbage'), null);
assert.strictEqual(auth.getSession(null), null);
assert.strictEqual(auth.getSession(''), null);
console.log('✅ رفض الصيغ غير الصالحة');

/* 5) كلمات المرور: نفس المدخل يتحقق، والخاطئ يفشل */
const h = auth.hashPassword('كلمة-سر-قوية');
assert(auth.verifyPassword('كلمة-سر-قوية', h));
assert(!auth.verifyPassword('غلط', h));
assert(!auth.verifyPassword('كلمة-سر-قوية', 'not-a-hash'));
console.log('✅ تشفير كلمات المرور (scrypt)');

console.log('\n🎉 كل اختبارات الجلسات نجحت');
