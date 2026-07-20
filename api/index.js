/**
 * نظام هوبا — نقطة دخول Vercel (Serverless Function)
 * Vercel يستدعي هذا الملف لكل طلبات /api/* (انظر vercel.json)
 */
'use strict';

const { handleAPIRequest } = require('../handler');

module.exports = async (req, res) => {
  try {
    await handleAPIRequest(req, res);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: err.message || 'خطأ في الخادم' }));
  }
};
