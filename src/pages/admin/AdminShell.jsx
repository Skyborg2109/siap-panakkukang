import { LayoutDashboard, Wrench, Users, Info, Megaphone, Image, BarChart3 } from 'lucide-react'
import { DashboardLayout } from '../../layouts/layouts.jsx'

export const adminMenu = [
  { to: '/admin', label: 'Dashboard', icon: <LayoutDashboard size={17} /> },
  { to: '/admin/services', label: 'Layanan', icon: <Wrench size={17} /> },
  { to: '/admin/users', label: 'Pengguna', icon: <Users size={17} /> },
  { to: '/admin/information', label: 'Informasi & IKD', icon: <Info size={17} /> },
  { to: '/admin/announcements', label: 'Pengumuman', icon: <Megaphone size={17} /> },
  { to: '/admin/display', label: 'Gambar Display', icon: <Image size={17} /> },
  { to: '/admin/statistics', label: 'Statistik', icon: <BarChart3 size={17} /> },
]

export default function AdminShell({ title, subtitle, children }) {
  return (
    <DashboardLayout menu={adminMenu} title={title} subtitle={subtitle}>
      {children}
    </DashboardLayout>
  )
}
