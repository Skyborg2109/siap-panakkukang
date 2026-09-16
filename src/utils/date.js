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

// true bila saat ini masuk jam istirahat { enabled, start, end, image }.
// Mendukung rentang lewat tengah malam (mis. 22:00–06:00).
export function isRestNow(rest, d = new Date()) {
  if (!rest || rest.enabled === false) return false
  if (!rest.image) return false
  const s = timeToMinutes(rest.start)
  const e = timeToMinutes(rest.end)
  if (s == null || e == null || s === e) return false
  const cur = d.getHours() * 60 + d.getMinutes()
  return s < e ? (cur >= s && cur < e) : (cur >= s || cur < e)
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
