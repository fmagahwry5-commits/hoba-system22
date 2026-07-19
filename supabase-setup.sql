-- ============================================================
-- نظام هوبا — إعداد قاعدة البيانات على Supabase
-- الصق هذا الملف كاملاً في SQL Editor ثم اضغط Run (مرة واحدة فقط)
-- ============================================================

create extension if not exists "pgcrypto";

-- الإعدادات (سجل واحد فقط)
create table if not exists settings (
  id int primary key default 1,
  shop_name text not null default 'محل هوبا',
  currency text not null default 'جنيه',
  constraint singleton_settings check (id = 1)
);
insert into settings (id) values (1) on conflict (id) do nothing;

-- المنتجات
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  buy_price numeric not null default 0,
  sell_price numeric not null default 0,
  stock numeric not null default 0,
  barcode text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_products_barcode on products (barcode);

-- العملاء
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

-- ترقيم تلقائي للفواتير
create sequence if not exists invoice_number_seq;

-- الفواتير (الأصناف تُخزَّن كـ JSONB مع صورة من السعر والتكلفة وقت البيع)
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  number bigint not null unique default nextval('invoice_number_seq'),
  customer_id uuid references customers(id) on delete set null,
  customer_name text not null default '',
  items jsonb not null default '[]',
  total numeric not null default 0,
  cost numeric not null default 0,
  note text not null default '',
  created_by uuid,
  created_by_name text not null default '',
  created_at timestamptz not null default now()
);

-- المصروفات
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  amount numeric not null,
  created_at timestamptz not null default now()
);

-- المستخدمون (كلمات المرور مُشفّرة في التطبيق قبل الحفظ)
create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  pass_hash text not null,
  name text not null default '',
  role text not null default 'cashier',
  created_at timestamptz not null default now()
);

-- ============================================================
-- إنشاء فاتورة بشكل ذرّي:
-- يفحص المخزون ويخصمه ويحسب الإجمالي والتكلفة في عملية واحدة
-- (آمنة حتى لو باع الكمبيوتر والموبايل في نفس اللحظة)
-- ============================================================
create or replace function create_invoice(p_customer uuid, p_items jsonb, p_note text, p_created_by uuid)
returns invoices language plpgsql as $$
declare
  v_item jsonb;
  v_pid uuid;
  v_qty numeric;
  v_prod products%rowtype;
  v_items jsonb := '[]'::jsonb;
  v_total numeric := 0;
  v_cost numeric := 0;
  v_inv invoices%rowtype;
  v_cname text := '';
  v_creator text := '';
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'أضف صنفاً واحداً على الأقل';
  end if;

  if p_customer is not null then
    select coalesce(name, '') into v_cname from customers where id = p_customer;
  end if;
  select coalesce(name, '') into v_creator from app_users where id = p_created_by;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_pid := (v_item->>'productId')::uuid;
    v_qty := greatest(1, coalesce((v_item->>'qty')::numeric, 1));

    -- قفل صف المنتج أثناء العملية لمنع أي بيع متزامن من تجاوز المخزون
    select * into v_prod from products where id = v_pid for update;
    if not found then
      raise exception 'منتج غير موجود في الفاتورة';
    end if;
    if v_prod.stock < v_qty then
      raise exception 'الكمية غير كافية من «%» — المتاح %', v_prod.name, v_prod.stock;
    end if;

    update products set stock = stock - v_qty where id = v_pid;

    v_items := v_items || jsonb_build_object(
      'productId', v_pid::text,
      'name', v_prod.name,
      'price', v_prod.sell_price,
      'cost', v_prod.buy_price,
      'qty', v_qty
    );
    v_total := v_total + v_prod.sell_price * v_qty;
    v_cost  := v_cost  + v_prod.buy_price  * v_qty;
  end loop;

  insert into invoices (customer_id, customer_name, items, total, cost, note, created_by, created_by_name)
  values (p_customer, v_cname, v_items, v_total, v_cost, coalesce(p_note, ''), p_created_by, v_creator)
  returning * into v_inv;

  return v_inv;
end; $$;

-- ============================================================
-- حذف فاتورة مع إرجاع الكميات إلى المخزون
-- ============================================================
create or replace function delete_invoice(p_id uuid)
returns void language plpgsql as $$
declare
  v_inv invoices%rowtype;
  v_item jsonb;
begin
  select * into v_inv from invoices where id = p_id;
  if not found then
    raise exception 'الفاتورة غير موجودة';
  end if;
  for v_item in select * from jsonb_array_elements(v_inv.items) loop
    update products
       set stock = stock + coalesce((v_item->>'qty')::numeric, 0)
     where id = (v_item->>'productId')::uuid;
  end loop;
  delete from invoices where id = p_id;
end; $$;
