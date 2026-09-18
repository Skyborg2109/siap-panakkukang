import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { MonitorPlay, LogOut, ExternalLink, Menu, X } from 'lucide-react'
import { useAuthStore } from '../stores/authStore.js'
import { logout } from '../services/authService.js'

// export const LOGO_MAKASSAR = '/logo-kota-makassar.png'
// export const LOGO_KECAMATAN = '/logo-kecamatan-panakkukang.png'
export const LOGO_MAKASSAR = `${import.meta.env.BASE_URL}logo-kota-makassar.png`
export const LOGO_KECAMATAN = `${import.meta.env.BASE_URL}logo-kecamatan-panakkukang.png`
export const LOGO_UNDIPA = `${import.meta.env.BASE_URL}Logo-Undipa.png`
export const BG_KANTOR = `${import.meta.env.BASE_URL}bg-kantor.jpeg`

export function GovLogos({ className = 'h-10', divider = false }) {
  return (
    <>
      <img src={LOGO_MAKASSAR} alt="Logo Kota Makassar" className={`${className} w-auto object-contain shrink-0`} />
      {divider && <span aria-hidden="true" className="w-px self-stretch bg-slate-300/80" />}
      <img src={LOGO_KECAMATAN} alt="Logo Kecamatan Panakkukang" className={`${className} w-auto object-contain shrink-0`} />
    </>
  )
}

// Efek blur-in per karakter (adaptasi BlurInText framer-motion ke CSS murni:
// opacity 0 + blur(10px) → jernih, delay 0.05s/karakter).
// Looping per 8 detik: fade-in → tampil utuh ±3 detik → fade-out → ulangi.
// Dibuat tanpa dependensi baru agar tetap plain JSX + Vite.
function BlurInText({ text = 'KKL UNDIPA GEL XIII 2026', className = '', delayStep = 0.05, duration = 8 }) {
  return (
    <span className={className} aria-label={text}>
      {text.split('').map((char, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="blur-in-char-loop"
          style={{ animationDelay: `${i * delayStep}s`, animationDuration: `${duration}s` }}
        >
          {char === ' ' ? ' ' : char}
        </span>
      ))}
    </span>
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

function DashboardNavItem({ to, icon, children, external = false }) {
  const cls = ({ isActive }) =>
    `flex items-center gap-2 px-3 py-2 md:gap-2.5 md:px-3.5 md:py-2.5 rounded-xl text-[13px] md:text-sm font-semibold transition whitespace-nowrap shrink-0 ${
      isActive && !external
        ? 'bg-orange-600 text-white shadow-[0_4px_14px_rgba(234,88,12,0.4)]'
        : 'text-slate-300/90 hover:bg-white/10 hover:text-white'
    }`
  if (external) {
    // Rute internal (diawali "/") dibuka di tab baru via Link agar basename
    // BrowserRouter ("/siap-panakkukang/" di GitHub Pages) tetap dipakai —
    // <a href="/display"> polos akan lari ke domain root dan 404.
    if (to.startsWith('/')) {
      return (
        <Link to={to} target="_blank" rel="noreferrer" className={cls({ isActive: false })}>
          {icon}
          <span className="flex-1">{children}</span>
          <ExternalLink size={13} className="opacity-50" />
        </Link>
      )
    }
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

// ---------- Dashboard (petugas & admin) ----------
export function DashboardLayout({ children, menu, title, subtitle }) {
  const quickLinks = [{ to: '/display', label: 'Monitor Antrean', external: true }]
  const mainMenu = (menu || []).filter((m) => m.to !== '/display')
  const [open, setOpen] = useState(false)

  // Judul top bar mengikuti nama halaman di sidebar yang sedang aktif —
  // prop `title` hanya jadi fallback bila rute tak ada di menu.
  const { pathname } = useLocation()
  const normPath = (p) => (p && p.length > 1 ? p.replace(/\/+$/, '') : p)
  const activeItem = (menu || []).find((m) => normPath(m.to) === normPath(pathname))
  const displayTitle = activeItem?.label || title || 'Dashboard'

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
        <div className="bg-white border-b border-slate-200/80 px-5 md:px-7 py-3.5 flex items-center gap-3 no-print">
          <button onClick={() => setOpen(true)} aria-label="Buka menu" className="md:hidden p-2 -ml-2 mt-0.5 rounded-lg text-slate-700 hover:bg-slate-100 shrink-0">
            <Menu size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-extrabold text-slate-900 leading-tight">{displayTitle}</h1>
            {subtitle && <p className="text-[13px] text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="text-right leading-tight">
              <BlurInText text="KKL UNDIPA GEL XIII 2026" className="text-[10px] md:text-xs font-extrabold tracking-wide text-slate-800 whitespace-nowrap" />
            </div>
            <span aria-hidden="true" className="blur-in-loop w-px self-stretch bg-slate-300/80" />
            <img src={LOGO_UNDIPA} alt="Logo KKL Undipa" className="blur-in-loop h-9 md:h-10 w-auto object-contain" />
          </div>
        </div>
        <div className="p-4 md:p-6">{children}</div>
      </div>
    </div>
  )
}
