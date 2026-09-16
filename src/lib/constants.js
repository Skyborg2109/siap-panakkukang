export const QUEUE_STATUS = {
  WAITING: 'WAITING',
  CALLED: 'CALLED',
  SERVING: 'SERVING',
  COMPLETED: 'COMPLETED',
  SKIPPED: 'SKIPPED',
}

export const STATUS_LABEL = {
  WAITING: 'Menunggu',
  CALLED: 'Dipanggil',
  SERVING: 'Dilayani',
  COMPLETED: 'Selesai',
  SKIPPED: 'Dilewati',
}

export const STATUS_COLOR = {
  WAITING: 'bg-amber-100 text-amber-800',
  CALLED: 'bg-blue-100 text-blue-800',
  SERVING: 'bg-violet-100 text-violet-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  SKIPPED: 'bg-slate-200 text-slate-600',
}

export const ROLES = {
  ADMIN: 'ADMIN',
  PETUGAS: 'PETUGAS',
}

// Akun demo saat Supabase belum dikonfigurasi
export const DEMO_USERS = [
  {
    id: 'demo-admin-1',
    email: 'admin@panakkukang.go.id',
    password: 'admin123',
    name: 'Administrator',
    role: 'ADMIN',
    counter_id: null,
  },
  {
    id: 'demo-petugas-1',
    email: 'petugas1@panakkukang.go.id',
    password: 'petugas123',
    name: 'Petugas Pelayanan',
    role: 'PETUGAS',
    counter_id: null,
  },
]

// Lima jenis antrean: Antrian KTP, Perekaman KTP, IKD, KK Online (Lontara+), KK Biasa
export const SEED_SERVICES = [
  { id: 'svc-ktp', name: 'Antrian KTP', prefix: 'KTP', description: 'KTP-el baru, perpanjangan, rusak / hilang', is_active: true, sort_order: 1, daily_quota: 50 },
  { id: 'svc-rekam', name: 'Perekaman KTP', prefix: 'REKAM', description: 'Perekaman foto, iris & tanda tangan digital', is_active: true, sort_order: 2, daily_quota: 50 },
  { id: 'svc-ikd', name: 'Aktivasi IKD', prefix: 'IKD', description: 'Aktivasi Identitas Kependudukan Digital', is_active: true, sort_order: 3, daily_quota: 100 },
  { id: 'svc-kk-online', name: 'KK Online (Lontara+)', prefix: 'KKO', description: 'Perubahan data KK via pengajuan online aplikasi Lontara+', is_active: true, sort_order: 4, daily_quota: 50 },
  { id: 'svc-kk-biasa', name: 'KK Biasa', prefix: 'KKB', description: 'Urus / cetak ulang KK & perubahan data langsung oleh tim Dukcapil', is_active: true, sort_order: 5, daily_quota: 50 },
]

// Kuota harian default per prefix (dipakai bila layanan belum punya daily_quota sendiri)
export const DEFAULT_QUOTA_BY_PREFIX = { KTP: 50, REKAM: 50, IKD: 100, KKO: 50, KKB: 50 }
export const DEFAULT_QUOTA_FALLBACK = 50

export function quotaFor(service = {}) {
  const q = Number(service.daily_quota)
  if (Number.isFinite(q) && q > 0) return Math.floor(q)
  const d = Number(DEFAULT_QUOTA_BY_PREFIX[(service.prefix || '').toUpperCase()])
  return Number.isFinite(d) && d > 0 ? d : DEFAULT_QUOTA_FALLBACK
}

export const SEED_REQUIREMENTS = [
  { service_id: 'svc-ktp', items: ['Fotokopi KK', 'KTP lama / Surat kehilangan (jika hilang/rusak)', 'Berusia 17 tahun / sudah kawin'] },
  { service_id: 'svc-rekam', items: ['Fotokopi KK', 'Hadir langsung untuk foto & iris mata', 'Membawa surat pengantar RT/RW (jika diminta)'] },
  { service_id: 'svc-ikd', items: ['Memiliki KTP-el aktif', 'Smartphone Android / iOS', 'Email & nomor HP aktif', 'Koneksi internet'] },
  { service_id: 'svc-kk-online', items: ['Bukti pengajuan online via aplikasi Lontara+', 'Fotokopi KK lama', 'Dokumen pendukung perubahan data (cth: akta, ijazah)'] },
  { service_id: 'svc-kk-biasa', items: ['Fotokopi KK lama', 'KTP-el', 'Dokumen pendukung (cth: akta lahir, buku nikah, SKPWNI bila pindah)'] },
]

// Tujuan pemanggilan: hanya KK Online & KK Biasa yang dilayani di loket
// (maju ke depan loket); KTP-el, REKAM & IKD masuk ke ruang pelayanan.
// Deteksi pola (bukan daftar prefix kaku) agar tetap benar walau admin
// membuat prefix varian sendiri, mis. KKONLINE / KKBISA / KK.
export const LOKET_PREFIXES = ['KKO', 'KKB']

export function isLoketService(serviceOrPrefix) {
  const obj = typeof serviceOrPrefix === 'string' ? {} : serviceOrPrefix || {}
  const p = String(typeof serviceOrPrefix === 'string' ? serviceOrPrefix : obj.prefix || '').toUpperCase()
  if (LOKET_PREFIXES.includes(p) || (p.startsWith('KK') && p.length > 0)) return true
  // Fallback via nama layanan (bila prefix tak dikenal / kosong):
  // hanya yang berbau KK yang ke loket — sisanya (termasuk KTP) ke ruang pelayanan.
  const nm = String(obj.service_name || obj.name || '').toLowerCase()
  return nm.includes('kk')
}

// Frasa tujuan lengkap untuk TTS + Display (tanpa koma depan)
export function callDestination(serviceOrPrefix) {
  return isLoketService(serviceOrPrefix) ? 'silakan maju ke depan loket pelayanan' : 'silakan masuk ke ruang pelayanan'
}

// Layanan yang dipanggil berbasis NAMA, bukan nomor antrean (Perekaman KTP:
// nama yang sedang dilayani tampil besar di monitor + diumumkan via audio).
// Deteksi pola seperti isLoketService agar varian prefix admin tetap ter-cover.
export const NAME_CALL_PREFIXES = ['REKAM']

export function isNameCallService(serviceOrPrefix) {
  const obj = typeof serviceOrPrefix === 'string' ? {} : serviceOrPrefix || {}
  const p = String(typeof serviceOrPrefix === 'string' ? serviceOrPrefix : obj.prefix || '').toUpperCase()
  if (NAME_CALL_PREFIXES.includes(p)) return true
  // Fallback via nama layanan (bila prefix tak dikenal / kosong)
  const nm = String(obj.service_name || obj.name || '').toLowerCase()
  return nm.includes('rekam')
}

// Layanan satu-nomor: KTP & Perekaman KTP — satu panggilan = satu nomor,
// dan nomor baru tidak boleh dipanggil selama masih ada nomor aktif.
// (Mencegah penumpukan belasan nomor aktif bersamaan seperti KTP-13..KTP-22.)
// IKD/KKO/KKB tetap boleh batch serentak dari kondisi idle ("5,6,7").
export const SINGLE_CALL_PREFIXES = ['KTP', 'REKAM']

export function isSingleCallService(serviceOrPrefix) {
  // Perekaman KTP (name-call) selalu satu-nomor
  if (isNameCallService(serviceOrPrefix)) return true
  const obj = typeof serviceOrPrefix === 'string' ? {} : serviceOrPrefix || {}
  const p = String(typeof serviceOrPrefix === 'string' ? serviceOrPrefix : obj.prefix || '').toUpperCase()
  if (SINGLE_CALL_PREFIXES.includes(p) || p.startsWith('KTP')) return true
  // Fallback via nama layanan (bila prefix tak dikenal / kosong)
  const nm = String(obj.service_name || obj.name || '').toLowerCase()
  return nm.includes('ktp')
}

export const SEED_INFORMATION = [
  { id: 'info-1', title: 'Jam Pelayanan', category: 'umum', content: 'Senin–Kamis: 08.00–14.00 WITA\nJumat: 08.00–11.30 WITA\nSabtu–Minggu & libur nasional: TUTUP', is_active: true },
  { id: 'info-2', title: 'Alur Pelayanan', category: 'alur', content: '1. Datang ke ruang pelayanan dan lapor ke petugas\n2. Tunggu hingga nomor antrean Anda dipanggil\n3. Serahkan berkas & verifikasi\n4. Terima dokumen / surat keterangan', is_active: true },
  { id: 'info-3', title: 'Semua Layanan GRATIS', category: 'umum', content: 'Seluruh pelayanan administrasi kependudukan di Kecamatan Panakkukang TIDAK DIPUNGUT BIAYA. Laporkan pungli ke kanal pengaduan resmi.', is_active: true },
]

export const SEED_IKD = {
  title: 'Identitas Kependudukan Digital (IKD)',
  content: 'IKD adalah KTP digital resmi dari Dukcapil Kemendagri.\n\nCara aktivasi:\n1. Datang ke ruang pelayanan dengan KTP-el\n2. Download aplikasi IKD di Play Store / App Store\n3. Scan QR Code oleh petugas\n4. Verifikasi wajah & PIN\n5. KTP digital aktif dan dapat digunakan.',
}

export const SEED_ANNOUNCEMENTS = [
  { id: 'ann-1', message: 'Selamat datang di Kantor Kecamatan Panakkukang. Tunggu hingga nomor antrean Anda dipanggil.', is_active: true },
  { id: 'ann-2', message: 'Seluruh layanan administrasi kependudukan GRATIS, tidak dipungut biaya apapun.', is_active: true },
  { id: 'ann-3', message: 'Aktifkan Identitas Kependudukan Digital (IKD) Anda di ruang pelayanan. Bawa KTP-el dan smartphone.', is_active: true },
]
