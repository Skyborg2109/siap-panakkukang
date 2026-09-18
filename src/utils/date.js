export function todayKey(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatDateID(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function formatTime(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':')
}

export function formatClock(d = new Date()) {
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':')
}

export function formatDateFull(d = new Date()) {
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export function makeQueueNumber(prefix, seq) {
  return `${prefix}-${Number(seq)}`
}

// "HH:MM" → menit sejak tengah malam (null bila format tak valid)
export function timeToMinutes(t) {
  const m = String(t || '').match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

// Jadwal istirahat yang berlaku pada tanggal d: hari Jumat (getDay()===5)
// memakai override `rest.friday` bila ada; Jumat yang dinonaktifkan atau
// hari lain memakai jadwal harian. Config lama tanpa `friday` aman
// (fallback harian). Kembalikan { enabled, start, end, image }.
export function activeRestSchedule(rest, d = new Date()) {
  const daily = {
    enabled: rest?.enabled !== false,
    start: rest?.start,
    end: rest?.end,
    image: rest?.image,
  }
  const f = rest?.friday
  if (d.getDay() === 5 && f && typeof f === 'object' && f.enabled !== false) {
    const sched = {
      enabled: true,
      start: f.start ?? daily.start,
      end: f.end ?? daily.end,
      image: f.image ?? daily.image,
    }
    // Override Jumat tanpa gambar = ikut Harian (jangan menekan jadwal
    // harian secara diam-diam).
    if (sched.image) return sched
  }
  return daily
}

// true bila saat ini masuk jam istirahat (sadar-hari: Jumat bisa punya
// jadwal + gambar sendiri via rest.friday).
// Mendukung rentang lewat tengah malam (mis. 22:00–06:00).
export function isRestNow(rest, d = new Date()) {
  const s = activeRestSchedule(rest, d)
  if (!s || s.enabled === false) return false
  if (!s.image) return false
  const start = timeToMinutes(s.start)
  const e = timeToMinutes(s.end)
  if (start == null || e == null || start === e) return false
  const cur = d.getHours() * 60 + d.getMinutes()
  return start < e ? (cur >= start && cur < e) : (cur >= start || cur < e)
}

export function timeDiffLabel(from, to = new Date()) {
  const a = new Date(from).getTime()
  const b = new Date(to).getTime()
  if (Number.isNaN(a)) return '-'
  const mins = Math.max(0, Math.round((b - a) / 60000))
  if (mins < 1) return '< 1 mnt'
  if (mins < 60) return `${mins} mnt`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h} jam ${m} mnt`
}
