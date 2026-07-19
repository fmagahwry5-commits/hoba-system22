/**
 * نظام هوبا — اختيار طبقة التخزين تلقائياً:
 * - وُجد SUPABASE_URL + SUPABASE_SERVICE_KEY  →  قاعدة سحابية (يعمل من أي مكان)
 * - غير ذلك                                    →  ملف JSON محلي على الجهاز
 */
'use strict';

let store;

if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
  const { createSupabaseStore } = require('./store-supabase');
  store = createSupabaseStore(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  console.log('☁️  وضع التشغيل: قاعدة بيانات سحابية (Supabase)');
} else {
  store = require('./store-json');
  console.log('💾 وضع التشغيل: تخزين محلي (data/db.json)');
}

module.exports = store;
