-- ============================================================
-- SIAP PANAKKUKANG — Supabase Schema v3.0
-- Jalankan di: Supabase Dashboard > SQL Editor > New Query
-- ============================================================

-- 1. PROFILES (role ADMIN / PETUGAS, terhubung ke auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text not null,
  role text not null check (role in ('ADMIN','PETUGAS')),
  counter_id uuid,
  created_at timestamptz default now()
);

-- 2. SERVICES
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  prefix text not null,
  description text,
  is_active boolean default true,
  sort_order int default 0,
  daily_quota int,
  created_at timestamptz default now()
);
-- Kolom kuota untuk database yang dibuat sebelum kolom ini ada:
alter table public.services add column if not exists daily_quota int;
create unique index if not exists services_prefix_unique on public.services(prefix);

-- 3. SERVICE REQUIREMENTS
create table if not exists public.service_requirements (
  id uuid primary key default gen_random_uuid(),
  service_id uuid references public.services(id) on delete cascade,
  requirement text not null,
  sort_order int default 0
);

-- 4. COUNTERS (loket)
create table if not exists public.counters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  service_ids uuid[] default '{}',
  is_active boolean default true,
  created_at timestamptz default now()
);
alter table public.profiles
  drop constraint if exists fk_profiles_counter;
alter table public.profiles
  add constraint fk_profiles_counter foreign key (counter_id) references public.counters(id) on delete set null;

-- 5. QUEUES
create table if not exists public.queues (
  id uuid primary key default gen_random_uuid(),
  queue_date date not null default current_date,
  service_id uuid references public.services(id) on delete restrict,
  service_name text,
  prefix text,
  sequence int not null,
  number text not null,
  name text not null,
  nik text,
  status text not null default 'WAITING' check (status in ('WAITING','CALLED','SERVING','COMPLETED','SKIPPED')),
  counter_id uuid references public.counters(id) on delete set null,
  counter_name text,
  called_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (queue_date, service_id, sequence),
  unique (queue_date, number)
);
create index if not exists queues_date_status_idx on public.queues(queue_date, status);
create index if not exists queues_service_idx on public.queues(service_id);

-- 6. INFORMATION
create table if not exists public.information (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text default 'umum',
  content text not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 7. ANNOUNCEMENTS (ticker display)
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 8. DISPLAY CONTENTS (IKD & konten statis)
create table if not exists public.display_contents (
  key text primary key,
  title text,
  content text,
  updated_at timestamptz default now()
);

-- 9. DISPLAY IMAGES (metadata; file di Storage bucket display-images)
create table if not exists public.display_images (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('staff-dukcapil','staff-kecamatan','alur')),
  file_path text not null,
  name text,
  title text,
  description text,
  sort_order int default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 10. KK ANNOUNCEMENTS (panggil kasus KK tanpa nomor, BR-09)
create table if not exists public.kk_announcements (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  note text,
  counter_name text,
  created_at timestamptz default now()
);

-- 11. BROADCASTS (pengumuman spontan petugas ke Display TV + audio, one-off)
create table if not exists public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  created_at timestamptz default now()
);

-- ============================================================
-- RPC: take_queue_number — anti-duplikat (transaksi DB)
-- ============================================================
create or replace function public.take_queue_number(p_service_id uuid, p_name text, p_nik text default null)
returns public.queues
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service public.services%rowtype;
  v_seq int;
  v_quota int;
  v_count int;
  v_row public.queues%rowtype;
begin
  select * into v_service from public.services where id = p_service_id and is_active = true;
  if not found then
    raise exception 'Layanan tidak aktif / tidak ditemukan';
  end if;

  -- Batas kupon fisik per hari (bisa diubah per layanan via daily_quota)
  v_quota := coalesce(
    v_service.daily_quota,
    case v_service.prefix when 'IKD' then 100 when 'REKAM' then 50 else 50 end
  );
  select count(*) into v_count
  from public.queues
  where queue_date = current_date and service_id = p_service_id;
  if v_count >= v_quota then
    raise exception 'Kuota % hari ini sudah penuh (%)', v_service.name, v_quota;
  end if;

  -- Kunci transaksi per layanan per hari agar dua petugas tak dapat nomor sama.
  -- (FOR UPDATE tidak bisa dipakai bersama fungsi agregat seperti max(), jadi pakai advisory lock.)
  perform pg_advisory_xact_lock(hashtext(p_service_id::text || current_date::text));

  select coalesce(max(sequence), 0) + 1 into v_seq
  from public.queues
  where queue_date = current_date and service_id = p_service_id;

  insert into public.queues (service_id, service_name, prefix, sequence, number, name, nik, status)
  values (
    p_service_id, v_service.name, v_service.prefix, v_seq,
    v_service.prefix || '-' || v_seq::text,
    p_name, nullif(p_nik, ''), 'WAITING'
  )
  returning * into v_row;
  return v_row;
end;
$$;

-- ============================================================
-- RPC: call_direct_number — panggil nomor kupon langsung (bebas urutan)
-- Insert status CALLED langsung ditolak policy "public insert queue"
-- (hanya boleh WAITING), jadi perlu RPC SECURITY DEFINER seperti
-- take_queue_number agar lolos RLS. Kalau nomor sudah ada hari ini
-- → panggil ulang (update CALLED). Dipakai queueService.callDirect.
-- ============================================================
create or replace function public.call_direct_number(p_service_id uuid, p_sequence int, p_name text default 'Tanpa Nama', p_called_at timestamptz default now())
returns public.queues
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service public.services%rowtype;
  v_full text;
  v_quota int;
  v_count int;
  v_row public.queues%rowtype;
  v_holder text;
begin
  if p_sequence is null or p_sequence < 1 or p_sequence > 999 then
    raise exception 'Nomor tidak valid';
  end if;

  select * into v_service from public.services where id = p_service_id and is_active = true;
  if not found then
    raise exception 'Layanan tidak aktif / tidak ditemukan';
  end if;

  v_full := v_service.prefix || '-' || p_sequence::text;
  v_holder := nullif(trim(coalesce(p_name, '')), '');
  if v_holder is null then v_holder := 'Tanpa Nama'; end if;

  -- Nomor sudah terdaftar hari ini → panggil ulang
  select * into v_row from public.queues
  where queue_date = current_date and service_id = p_service_id and number = v_full;
  if found then
    update public.queues
    set status = 'CALLED', called_at = coalesce(p_called_at, now()), updated_at = now()
    where id = v_row.id returning * into v_row;
    return v_row;
  end if;

  -- Kuota per layanan per hari
  v_quota := coalesce(
    v_service.daily_quota,
    case v_service.prefix when 'IKD' then 100 when 'REKAM' then 50 else 50 end
  );
  select count(*) into v_count
  from public.queues
  where queue_date = current_date and service_id = p_service_id;
  if v_count >= v_quota then
    raise exception 'Kuota % hari ini sudah penuh (%)', v_service.name, v_quota;
  end if;

  -- Kunci per layanan per hari agar dua petugas tak membuat nomor sama
  perform pg_advisory_xact_lock(hashtext(p_service_id::text || current_date::text));

  -- Cek ulang setelah lock (hindari balapan)
  select * into v_row from public.queues
  where queue_date = current_date and service_id = p_service_id and number = v_full;
  if found then
    update public.queues
    set status = 'CALLED', called_at = coalesce(p_called_at, now()), updated_at = now()
    where id = v_row.id returning * into v_row;
    return v_row;
  end if;

  insert into public.queues (queue_date, service_id, service_name, prefix, sequence, number, name, status, called_at)
  values (current_date, p_service_id, v_service.name, v_service.prefix, p_sequence, v_full, v_holder, 'CALLED', coalesce(p_called_at, now()))
  returning * into v_row;
  return v_row;
exception when unique_violation then
  -- Balapan dengan petugas lain: nomor keburu dibuat → panggil yang sudah ada
  select * into v_row from public.queues
  where queue_date = current_date and service_id = p_service_id and number = v_full;
  if found then
    update public.queues
    set status = 'CALLED', called_at = coalesce(p_called_at, now()), updated_at = now()
    where id = v_row.id returning * into v_row;
    return v_row;
  end if;
  raise;
end;
$$;

-- RPC boleh dipanggil peran anon (ambil antrean publik) & authenticated (petugas)
revoke all on function public.take_queue_number(uuid, text, text) from public;
grant execute on function public.take_queue_number(uuid, text, text) to anon, authenticated;
revoke all on function public.call_direct_number(uuid, int, text, timestamptz) from public;
grant execute on function public.call_direct_number(uuid, int, text, timestamptz) to authenticated;
grant execute on function public.current_role() to anon, authenticated;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.service_requirements enable row level security;
alter table public.counters enable row level security;
alter table public.queues enable row level security;
alter table public.information enable row level security;
alter table public.announcements enable row level security;
alter table public.display_contents enable row level security;
alter table public.display_images enable row level security;
alter table public.kk_announcements enable row level security;
alter table public.broadcasts enable row level security;

-- Helper: cek role pemanggil.
-- SECURITY DEFINER agar lolos RLS tabel profiles (tanpa ini, policy yang
-- memanggil helper mengalami rekursi → current_role() NULL → error
-- 'new row violates row-level security policy for table "queues"'
-- saat insert langsung status CALLED via callDirect).
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- Publik (masyarakat, tanpa login): baca master aktif + buat antrean
drop policy if exists "public read services" on public.services;
create policy "public read services" on public.services for select using (is_active = true);
drop policy if exists "public read requirements" on public.service_requirements;
create policy "public read requirements" on public.service_requirements for select using (true);
drop policy if exists "public read counters" on public.counters;
create policy "public read counters" on public.counters for select using (true);
drop policy if exists "public read information" on public.information;
create policy "public read information" on public.information for select using (is_active = true);
drop policy if exists "public read announcements" on public.announcements;
create policy "public read announcements" on public.announcements for select using (is_active = true);
drop policy if exists "public read display" on public.display_images;
create policy "public read display" on public.display_images for select using (is_active = true);
drop policy if exists "public read contents" on public.display_contents;
create policy "public read contents" on public.display_contents for select using (true);
drop policy if exists "public read today queues" on public.queues;
create policy "public read today queues" on public.queues for select using (queue_date = current_date);
drop policy if exists "public insert queue" on public.queues;
create policy "public insert queue" on public.queues for insert with check (queue_date = current_date and status = 'WAITING');

-- Petugas & Admin (login): kelola antrean
drop policy if exists "staff manage queues" on public.queues;
create policy "staff manage queues" on public.queues
  for all using (public.current_role() in ('PETUGAS','ADMIN')) with check (public.current_role() in ('PETUGAS','ADMIN'));
drop policy if exists "staff insert kk" on public.kk_announcements;
create policy "staff insert kk" on public.kk_announcements
  for all using (public.current_role() in ('PETUGAS','ADMIN')) with check (public.current_role() in ('PETUGAS','ADMIN'));
drop policy if exists "public read kk" on public.kk_announcements;
create policy "public read kk" on public.kk_announcements for select using (true);
drop policy if exists "staff insert broadcast" on public.broadcasts;
create policy "staff insert broadcast" on public.broadcasts
  for all using (public.current_role() in ('PETUGAS','ADMIN')) with check (public.current_role() in ('PETUGAS','ADMIN'));
drop policy if exists "public read broadcast" on public.broadcasts;
create policy "public read broadcast" on public.broadcasts for select using (true);

-- Admin: full CRUD master data
drop policy if exists "admin all services" on public.services;
create policy "admin all services" on public.services
  for all using (public.current_role() = 'ADMIN') with check (public.current_role() = 'ADMIN');
drop policy if exists "admin all requirements" on public.service_requirements;
create policy "admin all requirements" on public.service_requirements
  for all using (public.current_role() = 'ADMIN') with check (public.current_role() = 'ADMIN');
drop policy if exists "admin all counters" on public.counters;
create policy "admin all counters" on public.counters
  for all using (public.current_role() = 'ADMIN') with check (public.current_role() = 'ADMIN');
drop policy if exists "admin all information" on public.information;
create policy "admin all information" on public.information
  for all using (public.current_role() = 'ADMIN') with check (public.current_role() = 'ADMIN');
drop policy if exists "admin all announcements" on public.announcements;
create policy "admin all announcements" on public.announcements
  for all using (public.current_role() = 'ADMIN') with check (public.current_role() = 'ADMIN');
drop policy if exists "admin all display" on public.display_images;
create policy "admin all display" on public.display_images
  for all using (public.current_role() = 'ADMIN') with check (public.current_role() = 'ADMIN');
drop policy if exists "admin all contents" on public.display_contents;
create policy "admin all contents" on public.display_contents
  for all using (public.current_role() = 'ADMIN') with check (public.current_role() = 'ADMIN');
drop policy if exists "admin read profiles" on public.profiles;
-- Petugas/Admin: baca profil sendiri (tanpa panggil current_role → tanpa rekursi).
-- Dipakai saat login (authService membaca profiles by id).
drop policy if exists "staff read own profile" on public.profiles;
create policy "staff read own profile" on public.profiles
  for select using (id = auth.uid());
-- Admin: full CRUD semua profil (butuh current_role yang kini SECURITY DEFINER).
drop policy if exists "admin all profiles" on public.profiles;
create policy "admin all profiles" on public.profiles
  for all using (public.current_role() = 'ADMIN') with check (public.current_role() = 'ADMIN');

-- ============================================================
-- SEED DATA
-- ============================================================
insert into public.services (name, prefix, description, sort_order, daily_quota) values
  ('Antrian KTP','KTP','KTP-el baru, perpanjangan, rusak / hilang',1,50),
  ('Perekaman KTP','REKAM','Perekaman foto, iris & tanda tangan digital',2,50),
  ('Aktivasi IKD','IKD','Aktivasi Identitas Kependudukan Digital',3,100)
on conflict do nothing;

-- Kuota untuk database yang sudah ter-seed sebelum kolom daily_quota ada:
update public.services set daily_quota = 100 where prefix = 'IKD' and daily_quota is null;
update public.services set daily_quota = 50 where prefix in ('KTP','REKAM') and daily_quota is null;

-- Tabel counters dipertahankan demi kompatibilitas, tapi tidak dipakai aplikasi.
-- Untuk database yang sudah ter-seed 7 layanan, pangkas ke 3 jenis antrean:
-- delete from public.queues where service_id in (select id from public.services where prefix not in ('KTP','REKAM','IKD'));
-- delete from public.service_requirements where service_id in (select id from public.services where prefix not in ('KTP','REKAM','IKD'));
-- delete from public.services where prefix not in ('KTP','REKAM','IKD');
-- update public.services set name = 'Antrian KTP' where prefix = 'KTP';
-- update public.services set name = 'Perekaman KTP' where prefix = 'REKAM';

insert into public.counters (name, description) values
  ('Loket 1','Perekaman & KIA'),
  ('Loket 2','KTP-el, KK & Akta'),
  ('Loket 3','IKD, Pindah & Umum')
on conflict do nothing;

insert into public.information (title, category, content) values
  ('Jam Pelayanan','umum','Senin–Kamis: 08.00–14.00 WITA\nJumat: 08.00–11.30 WITA\nSabtu–Minggu & libur nasional: TUTUP'),
  ('Alur Pelayanan','alur','1. Datang ke ruang pelayanan dan lapor ke petugas\n2. Tunggu hingga nomor antrean dipanggil\n3. Serahkan berkas & verifikasi\n4. Terima dokumen / surat keterangan'),
  ('Semua Layanan GRATIS','umum','Seluruh pelayanan administrasi kependudukan di Kecamatan Panakkukang TIDAK DIPUNGUT BIAYA.')
on conflict do nothing;

insert into public.announcements (message) values
  ('Selamat datang di Kantor Kecamatan Panakkukang. Tunggu hingga nomor antrean Anda dipanggil.'),
  ('Seluruh layanan administrasi kependudukan GRATIS, tidak dipungut biaya apapun.'),
  ('Aktifkan Identitas Kependudukan Digital (IKD) Anda di ruang pelayanan.')
on conflict do nothing;

insert into public.display_contents (key, title, content) values
  ('ikd','Identitas Kependudukan Digital (IKD)','IKD adalah KTP digital resmi dari Dukcapil Kemendagri.\n\nCara aktivasi:\n1. Datang ke ruang pelayanan dengan KTP-el\n2. Download aplikasi IKD\n3. Scan QR Code oleh petugas\n4. Verifikasi wajah & PIN\n5. KTP digital aktif.')
on conflict (key) do nothing;

-- ============================================================
-- REALTIME: aktifkan publication untuk tabel berikut
-- (Dashboard > Database > Replication > pilih tabel)
-- queues, announcements, display_images, kk_announcements, broadcasts
-- ============================================================

-- STORAGE: bucket + RLS policies untuk display-images.
-- WAJIB dijalankan, kalau tidak upload dari Admin → "new row violates row-level security policy".
insert into storage.buckets (id, name, public) values ('display-images','display-images', true)
on conflict (id) do update set public = true;

-- Publik (Display TV, tanpa login): baca file
drop policy if exists "public read display-images" on storage.objects;
create policy "public read display-images" on storage.objects
  for select using (bucket_id = 'display-images');

-- Admin (login): upload / ubah / hapus file
drop policy if exists "admin insert display-images" on storage.objects;
create policy "admin insert display-images" on storage.objects
  for insert with check (bucket_id = 'display-images' and public.current_role() = 'ADMIN');

drop policy if exists "admin update display-images" on storage.objects;
create policy "admin update display-images" on storage.objects
  for update using (bucket_id = 'display-images' and public.current_role() = 'ADMIN')
  with check (bucket_id = 'display-images');

drop policy if exists "admin delete display-images" on storage.objects;
create policy "admin delete display-images" on storage.objects
  for delete using (bucket_id = 'display-images' and public.current_role() = 'ADMIN');
