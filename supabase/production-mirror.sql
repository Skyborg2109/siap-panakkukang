-- ============================================================
-- SIAP PANAKKUKANG — Mirror data production (akun pribadi lama)
-- ke project Supabase baru (akun resmi kantor).
-- Cara pakai: jalankan SETELAH supabase/schema.sql di SQL Editor
-- project BARU. Aman diulang (idempotent).
-- Catatan: file fisik gambar di Storage TIDAK ikut via SQL —
-- salin manual via Dashboard Storage (lihat bagian 6).
-- Production saat dump: 3 layanan (KTP-el, Perekaman KTP-el, IKD).
-- ============================================================

-- 1. LAYANAN: hapus KKO/KKB bawaan seed, samakan nama/kuota production
delete from public.services where prefix in ('KKO','KKB');

update public.services
set name = 'KTP-el',
    description = 'KTP-el baru, perpanjangan, rusak / hilang',
    sort_order = 1, daily_quota = 50, is_active = true
where prefix = 'KTP';

update public.services
set name = 'Perekaman KTP-el',
    description = 'Perekaman foto, iris & tanda tangan digital',
    sort_order = 2, daily_quota = 50, is_active = true
where prefix = 'REKAM';

update public.services
set name = 'Aktivasi IKD',
    description = 'Aktivasi Identitas Kependudukan Digital',
    sort_order = 6, daily_quota = 100, is_active = true
where prefix = 'IKD';

-- 2. INFORMASI: buang duplikat (akibat schema.sql dijalankan berulang),
-- isi 3 konten custom production
delete from public.information;

insert into public.information (title, category, content) values
  ('Jam Pelayanan','umum','Senin–Kamis: 08.00–16.00 WITA\nJumat: 08.00–16.30 WITA\nSabtu–Minggu & libur nasional: TUTUP'),
  ('Alur Pelayanan','alur','1. Ambil nomor antrean\n2. Tunggu panggilan di ruang tunggu\n3. Menuju loket sesuai panggilan\n4. Serahkan berkas & verifikasi\n5. Terima dokumen / surat keterangan'),
  ('Semua Layanan GRATIS','umum','Seluruh pelayanan administrasi kependudukan di Kecamatan Panakkukang TIDAK DIPUNGUT BIAYA.');

-- 3. TICKER PENGUMUMAN: 5 baris production (3 bawaan + 2 custom)
delete from public.announcements;

insert into public.announcements (message) values
  ('Seluruh layanan administrasi kependudukan GRATIS, tidak dipungut biaya apapun.'),
  ('Aktifkan Identitas Kependudukan Digital (IKD) Anda di ruang pelayanan.'),
  ('Bagi yang ingin mengurus IKD maupun KTP, Harap mendownload aplikasi IKD terlebih dahulu di play store atau app store, kemudian mengisi data hingga tahap scan barcode.'),
  ('Selamat datang di Kantor Kecamatan Panakkukang. Tunggu hingga nomor antrean Anda dipanggil.'),
  ('Bagi warga yang ingin membayar pajak motor, bisa masuk ke ruang operator di bagian SAMSAT');

-- 4. DISPLAY CONTENTS: konten IKD custom + config notifikasi istirahat
insert into public.display_contents (key, title, content) values
  ('ikd','Identitas Kependudukan Digital (IKD)','IKD adalah KTP digital resmi dari Dukcapil Kemendagri.\n\nCara aktivasi:\n1. Datang ke Loket 3 dengan KTP-el\n2. Download aplikasi IKD\n3. Scan QR Code oleh petugas\n4. Verifikasi wajah & PIN\n5. KTP digital aktif.')
on conflict (key) do update
  set title = excluded.title, content = excluded.content, updated_at = now();

insert into public.display_contents (key, title, content) values
  ('rest','Gambar Istirahat','{"enabled":true,"start":"00:00","end":"13:00","image":"rest/1789714726343-ChatGPT Image 16 Sep 2026, 12.32.53.png","friday":{"enabled":true,"start":"11:30","end":"13:30","image":"rest/1789714798256-WhatsApp Image 2026-09-18 at 14.59.35.jpeg"}}')
on conflict (key) do update
  set title = excluded.title, content = excluded.content, updated_at = now();

-- 5. DISPLAY IMAGES: metadata 9 baris production (path sama persis agar
-- cocok dengan file yang disalin manual di Storage — lihat bagian 6)
delete from public.display_images;

insert into public.display_images (category, file_path, name, title, description, sort_order, is_active) values
  ('alur','alur/1789575156353-KTP.png','Alur Pelayanaan KTP-el','Alur Pelayanaan KTP-el','',0,true),
  ('alur','alur/1789575181533-akta Kelahiran.png','Alur Pelayanan Akte Kelahriran','Alur Pelayanan Akte Kelahriran','',0,true),
  ('alur','alur/1789575216577-akta kematian.png','Alur Pelayanan Akte Kematian','Alur Pelayanan Akte Kematian','',0,true),
  ('alur','alur/1789575240745-IKD.png','Alur Aktivasi Akun IKD','Alur Aktivasi Akun IKD','',0,true),
  ('alur','alur/1789575262108-perekaman KTP.png','Alur Pelayanan Perekaman KTP','Alur Pelayanan Perekaman KTP','',0,true),
  ('alur','alur/1789608131969-ChatGPT Image Sep 17, 2026, 09_21_44 AM.png','Alur Pengurusan KIA','Alur Pengurusan KIA','',0,true),
  ('staff-kecamatan','staff-kecamatan/1789608246350-Pak Camat.png','Syahril, S.STP','Syahril, S.STP','Camat Panakkukang',0,true),
  ('staff-kecamatan','staff-kecamatan/1789609868826-Untitled design (2)-Photoroom.png','','','',0,true),
  ('staff-kecamatan','staff-kecamatan/1789609898179-Sekcam.png','Rendra, S.E, M.Si.','Rendra, S.E, M.Si.','Sekretaris Camat',0,true);

-- 6. STORAGE (manual via Dashboard, tidak bisa via SQL):
-- Di project LAMA: Storage > display-images > download semua file di
-- folder alur/, staff-kecamatan/, dan rest/ (2 file rest ada di key 'rest'
-- di atas). Di project BARU: Storage > display-images > upload ke path
-- yang SAMA PERSIS (nama folder + nama file sama) agar metadata di
-- bagian 4–5 langsung nyambung. File rest:
--   rest/1789714726343-ChatGPT Image 16 Sep 2026, 12.32.53.png
--   rest/1789714798256-WhatsApp Image 2026-09-18 at 14.59.35.jpeg

-- 7. SYARAT LAYANAN: production kosong (0 baris) — tidak ada yang
-- perlu dimigrasi. Tambah manual via halaman admin bila dibutuhkan.
-- COUNTERS: aplikasi tidak memakai tabel counters (kompatibilitas saja),
-- seed bawaan schema.sql (Loket 1–3) sudah cukup.
