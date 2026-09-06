import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { MonitorPlay, Info, Fingerprint, LogIn, LogOut, ExternalLink, Menu, X } from 'lucide-react'
import { useAuthStore } from '../stores/authStore.js'
import { logout } from '../services/authService.js'
import { isSupabaseConfigured } from '../lib/supabase.js'

// export const LOGO_MAKASSAR = '/logo-kota-makassar.png'
// export const LOGO_KECAMATAN = '/logo-kecamatan-panakkukang.png'
export const LOGO_MAKASSAR = `${import.meta.env.BASE_URL}logo-kota-makassar.png`
export const LOGO_KECAMATAN = `${import.meta.env.BASE_URL}logo-kecamatan-panakkukang.png`

export function GovLogos({ className = 'h-10', divider = false }) {
  return (
    <>
      <img src={LOGO_MAKASSAR} alt="Logo Kota Makassar" className={`${className} w-auto object-contain shrink-0`} />
      {divider && <span aria-hidden="true" className="w-px self-stretch bg-slate-300/80" />}
      <img src={LOGO_KECAMATAN} alt="Logo Kecamatan Panakkukang" className={`${className} w-auto object-contain shrink-0`} />
    </>
  )
}

function GovBrand() {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <GovLogos className="h-9" />
      <div className="leading-tight min-w-0">
        <div className="font-extrabold text-white text-sm tracking-wide">SIAP</div>
        <div className="flex items-center gap-1.5">
          <div className="text-[10px] font-bold tracking-[0.18em] text-orange-400 whitespace-nowrap">PANAKKUKANG</div>
          <span className="badge bg-amber-400/90 text-amber-950 shrink-0 !text-[10px]">v3.0</span>
        </div>
      </div>
    </div>
  )
}

function MonitorPill({ to = '/display', label = 'Monitor' }) {
  return (
    <Link
      to={to}
      target={to === '/display' ? '_blank' : undefined}
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700 hover:bg-orange-100 transition whitespace-nowrap"
    >
      <span className="w-2 h-2 rounded-full bg-emerald-500" />
      {label}
      {to === '/display' && <ExternalLink size={12} className="opacity-60" />}
    </Link>
  )
}

function DashboardNavItem({ to, icon, children, external = false }) {
  const cls = ({ isActive }) =>
    `flex items-center gap-2 px-3 py-2 md:gap-2.5 md:px-3.5 md:py-2.5 rounded-xl text-[13px] md:text-sm font-semibold transition whitespace-nowrap shrink-0 ${
      isActive && !external
        ? 'bg-orange-600 text-white shadow-[0_4px_14px_rgba(234,88,12,0.4)]'
        : 'text-slate-300/90 hover:bg-white/10 hover:text-white'
    }`
  if (external) {
    return (
      <a href={to} target="_blank" rel="noreferrer" className={cls({ isActive: false })}>
        {icon}
        <span className="flex-1">{children}</span>
        <ExternalLink size={13} className="opacity-50" />
      </a>
    )
  }
  return (
    <NavLink to={to} end className={cls}>
      {icon}
      <span className="flex-1">{children}</span>
    </NavLink>
  )
}

function UserCard() {
  const { user, setUser } = useAuthStore()
  const navigate = useNavigate()
  if (!user) return null
  const initials = (user.name || user.email || 'U').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  const handleLogout = async () => {
    await logout()
    setUser(null)
    navigate('/login')
  }
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-white/5 border border-white/10 px-3 py-2.5">
      <div className="w-8 h-8 rounded-lg bg-orange-500 text-white text-xs font-extrabold flex items-center justify-center shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0 leading-tight">
        <div className="text-[13px] font-bold text-white truncate">{user.name}</div>
        <div className="text-[10px] font-bold tracking-widest text-orange-400 uppercase">{user.role}</div>
      </div>
      <button onClick={handleLogout} title="Keluar" className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10">
        <LogOut size={15} />
      </button>
    </div>
  )
}

// ---------- Publik (masyarakat + login) ----------
export default function PublicLayout({ children }) {
  const { user, setUser } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    setUser(null)
    navigate('/')
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#eef2f7]">
      <header className="bg-white no-print">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <GovLogos />
          <div className="flex-1 leading-tight">
            <div className="text-[11px] font-bold tracking-wider text-orange-600">PEMERINTAH KOTA MAKASSAR</div>
            <div className="font-extrabold text-slate-900">Kantor Kecamatan Panakkukang</div>
          </div>
          {!isSupabaseConfigured && (
            <span className="hidden sm:inline-flex badge bg-amber-100 text-amber-800 border border-amber-200">Mode Demo</span>
          )}
          <MonitorPill to="/display" label="Monitor Antrean" />
        </div>
        <div className="h-[3px] bg-orange-500" />
        <div className="max-w-6xl mx-auto px-4 py-2 hidden md:flex items-center gap-1 text-sm font-medium text-slate-600">
          <Link to="/information" className="px-3 py-1.5 rounded-lg hover:bg-slate-100">Informasi</Link>
          <Link to="/ikd" className="px-3 py-1.5 rounded-lg hover:bg-slate-100">IKD</Link>
          <div className="flex-1" />
          {user ? (
            <>
              <Link to={user.role === 'ADMIN' ? '/admin' : '/petugas'} className="px-3 py-1.5 rounded-lg hover:bg-slate-100">Dashboard</Link>
              <button onClick={handleLogout} className="px-3 py-1.5 rounded-lg hover:bg-slate-100">Keluar</button>
            </>
          ) : (
            <Link to="/login" className="px-3 py-1.5 rounded-lg hover:bg-slate-100">Login Petugas</Link>
          )}
        </div>
        <div className="md:hidden border-t border-slate-100 px-4 py-2 flex gap-2 overflow-x-auto text-sm text-slate-600">
          <Link to="/information" className="flex items-center gap-1 px-2 py-1.5"><Info size={15} /> Info</Link>
          <Link to="/ikd" className="flex items-center gap-1 px-2 py-1.5"><Fingerprint size={15} /> IKD</Link>
          <Link to="/display" className="flex items-center gap-1 px-2 py-1.5"><MonitorPlay size={15} /> TV</Link>
          <Link to="/login" className="flex items-center gap-1 px-2 py-1.5"><LogIn size={15} /> Login</Link>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6">{children}</main>

      <footer className="bg-white border-t border-slate-200 text-xs text-slate-500 no-print">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex flex-col sm:flex-row gap-1 sm:items-center justify-between">
          <div>© 2026 Kantor Kecamatan Panakkukang, Kota Makassar.</div>
          <div>Jl. Batu Raya No. 1, Panakkukang, Makassar, Sulawesi Selatan</div>
        </div>
      </footer>
    </div>
  )
}

// ---------- Dashboard (petugas & admin) ----------
export function DashboardLayout({ children, menu, title, subtitle, eyebrow = 'PEMERINTAH KOTA MAKASSAR' }) {
  const quickLinks = [{ to: '/display', label: 'Monitor Antrean', external: true }]
  const mainMenu = (menu || []).filter((m) => m.to !== '/display')
  const [open, setOpen] = useState(false)

  // Drawer mobile: tutup via Escape + kunci scroll body saat terbuka
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#eef2f7]">
      {/* Backdrop drawer (mobile saja) */}
      {open && (
        <div onClick={() => setOpen(false)} aria-hidden="true" className="fixed inset-0 z-40 bg-black/50 md:hidden" />
      )}
      {/* Sidebar desktop / drawer geser kiri di mobile */}
      <aside className={`bg-[#0b1220] text-white px-3.5 py-4 flex flex-col gap-2 shrink-0 no-print fixed inset-y-0 left-0 z-50 w-[270px] max-w-[85vw] overflow-y-auto transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'} md:static md:z-auto md:w-[248px] md:max-w-none md:translate-x-0 md:min-h-screen md:h-screen md:sticky md:top-0 md:overflow-visible`}>
        <div className="px-1.5 pt-1 pb-2 md:pb-3 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <GovBrand />
          </div>
          <button onClick={() => setOpen(false)} aria-label="Tutup menu" className="md:hidden p-2 -mr-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 shrink-0">
            <X size={18} />
          </button>
        </div>
        <nav onClick={() => setOpen(false)} className="flex flex-col gap-2 flex-1 md:mt-1">
          {mainMenu.map((m) => (
            <DashboardNavItem key={m.to + m.label} to={m.to} icon={m.icon} external={m.external}>
              {m.label}
            </DashboardNavItem>
          ))}
          <div className="hidden md:block mt-4 mb-1.5 px-3 text-[10px] font-bold tracking-[0.14em] text-slate-500">AKSES CEPAT</div>
          <div className="hidden md:flex md:flex-col gap-2">
            {quickLinks.map((m) => (
              <DashboardNavItem key={m.to} to={m.to} icon={<MonitorPlay size={17} />} external>
                {m.label}
              </DashboardNavItem>
            ))}
          </div>
          {/* mobile: tampilkan monitor inline */}
          <div className="md:hidden flex gap-2">
            {quickLinks.map((m) => (
              <DashboardNavItem key={m.to} to={m.to} icon={<MonitorPlay size={17} />} external>
                {m.label}
              </DashboardNavItem>
            ))}
          </div>
        </nav>
        <div className="pt-3">
          <UserCard />
        </div>
      </aside>
      <div className="flex-1 min-w-0 min-h-screen">
        <div className="bg-white border-b border-slate-200/80 px-5 md:px-7 py-3.5 flex items-start gap-3 no-print">
          <button onClick={() => setOpen(true)} aria-label="Buka menu" className="md:hidden p-2 -ml-2 mt-0.5 rounded-lg text-slate-700 hover:bg-slate-100 shrink-0">
            <Menu size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold tracking-wider text-orange-600">{eyebrow}</div>
            <h1 className="text-lg font-extrabold text-slate-900 leading-tight">{title}</h1>
            {subtitle && <p className="text-[13px] text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <MonitorPill to="/display" label="Monitor" />
        </div>
        <div className="p-4 md:p-6">{children}</div>
      </div>
    </div>
  )
}
