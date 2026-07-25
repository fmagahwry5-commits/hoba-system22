-- ═══════════════════════════════════════════════════════════════════
-- Supabase schema for Phone Shop POS (system22)
-- شغّل هذا الملف كامل في: Supabase Dashboard → SQL Editor → New query
--
-- ملاحظة: هذا الـ schema مُطبّق بالفعل على مشروع Supabase الحالي
-- (hoba-system) المربوط بهذا التطبيق. هذا الملف موجود للتوثيق
-- وحتى تقدر تعيد إنشاء نفس الجداول على مشروع Supabase جديد لو احتجت.
-- ═══════════════════════════════════════════════════════════════════

-- 1) جدول حالة التطبيق (نفس فكرة مستند Firestore الواحد app_state/main)
create table if not exists public.app_state (
  id text primary key,
  data jsonb not null,
  updated_by text,
  updated_at timestamptz not null default now(),
  version bigint
);

-- 2) جدول الأجهزة المتصلة (لعرض من هو متصل الآن على نفس الحساب)
create table if not exists public.connected_devices (
  device_id text primary key,
  device_name text,
  device_type text,
  user_name text,
  is_online boolean not null default true,
  last_seen timestamptz not null default now()
);

-- ── تفعيل الـ Realtime على الجدولين (ضروري لظهور التحديثات فورًا على كل الأجهزة) ──
alter publication supabase_realtime add table public.app_state;
alter publication supabase_realtime add table public.connected_devices;

-- ── تفعيل Row Level Security ──
alter table public.app_state enable row level security;
alter table public.connected_devices enable row level security;

-- ملاحظة أمان: التطبيق يستخدم مفتاح anon العام (لا يوجد Supabase Auth)،
-- ونظام الصلاحيات (مدير/كاشير/محاسب) مطبّق داخل التطبيق نفسه فقط.
-- السياسات التالية تسمح بالقراءة والكتابة لأي طلب يحمل مفتاح anon،
-- تمامًا كما كانت قواعد Firestore السابقة مفتوحة لكل مستخدمي التطبيق.
-- إذا أردت لاحقًا تقييد الوصول (مثلاً عبر Supabase Auth أو IP)، عدّل هذه السياسات.

drop policy if exists "app_state_select" on public.app_state;
create policy "app_state_select" on public.app_state
  for select using (true);

drop policy if exists "app_state_insert" on public.app_state;
create policy "app_state_insert" on public.app_state
  for insert with check (true);

drop policy if exists "app_state_update" on public.app_state;
create policy "app_state_update" on public.app_state
  for update using (true) with check (true);

drop policy if exists "connected_devices_select" on public.connected_devices;
create policy "connected_devices_select" on public.connected_devices
  for select using (true);

drop policy if exists "connected_devices_insert" on public.connected_devices;
create policy "connected_devices_insert" on public.connected_devices
  for insert with check (true);

drop policy if exists "connected_devices_update" on public.connected_devices;
create policy "connected_devices_update" on public.connected_devices
  for update using (true) with check (true);

-- ═══════════════════════════════════════════════════════════════════
-- تم. بعد تشغيل هذا الملف، انسخ من Project Settings → API:
--   Project URL      → VITE_SUPABASE_URL
--   anon public key  → VITE_SUPABASE_ANON_KEY
-- وضعهما في ملف .env (راجع .env.example)
-- ═══════════════════════════════════════════════════════════════════
