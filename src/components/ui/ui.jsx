import { STATUS_COLOR, STATUS_LABEL } from '../../lib/constants.js'

export function Badge({ status, children, className = '' }) {
  const color = status ? STATUS_COLOR[status] : 'bg-slate-100 text-slate-700'
  return <span className={`badge ${color} ${className}`}>{children || (status ? STATUS_LABEL[status] : '')}</span>
}

export function StatCard({ title, value, icon, color = 'text-slate-900' }) {
  return (
    <div className="card p-5">
      <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">{title}</div>
      <div className="flex items-center gap-2 mt-1">
        {icon && <span className="text-slate-300">{icon}</span>}
        <div className={`text-3xl font-extrabold tabular-nums ${color}`}>{value}</div>
      </div>
    </div>
  )
}

export function Empty({ title = 'Belum ada data', desc }) {
  return (
    <div className="text-center py-10 text-slate-400">
      <div className="text-lg font-semibold text-slate-500">{title}</div>
      {desc && <div className="text-sm mt-1">{desc}</div>}
    </div>
  )
}

export function Field({ label, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  )
}

export function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative card w-full max-w-lg p-6 animate-slide-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="btn-secondary btn !px-3 !py-1.5">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}
