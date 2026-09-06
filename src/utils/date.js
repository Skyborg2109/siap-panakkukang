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
