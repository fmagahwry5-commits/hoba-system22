/**
 * نظام هوبا — السيرفر المحلي (npm start / node server.js)
 * يخدم الملفات الثابتة من public/ ويوجّه /api/* لنفس معالج Vercel (handler.js)
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const store = require('./store'); // لطباعة وضع التشغيل عند البدء
const { handleAPIRequest } = require('./handler');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');

/* ---------------- الملفات الثابتة (محلياً فقط — على Vercel تُخدم تلقائياً) ---------------- */

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

function serveStatic(req, res, filePath) {
  const full = path.normalize(path.join(PUBLIC_DIR, filePath));
  if (!full.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('ممنوع');
  }
  fs.readFile(full, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('غير موجود');
    }
    const ext = path.extname(full).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
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
      return await handleAPIRequest(req, res);
    }
    const filePath = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
    serveStatic(req, res, filePath);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: err.message || 'خطأ في الخادم' }));
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
  if (store.mode === 'supabase') console.log('☁️  البيانات على القاعدة السحابية (Supabase)');
  else console.log('💾 البيانات محلياً في: data/db.json');
  console.log('⏹️  للإيقاف اضغط Ctrl+C');
  console.log('');
});
