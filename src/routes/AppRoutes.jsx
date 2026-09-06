import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import PublicLayout from '../layouts/layouts.jsx'
import { useAuthStore } from '../stores/authStore.js'

import Home from '../pages/public/Home.jsx'
import Information from '../pages/public/Information.jsx'
import IKD from '../pages/public/IKD.jsx'
import Display from '../pages/display/Display.jsx'
import Login from '../pages/auth/Login.jsx'

import PetugasQueue from '../pages/petugas/Queue.jsx'
import PetugasHistory from '../pages/petugas/History.jsx'
import PetugasProfile from '../pages/petugas/Profile.jsx'

import AdminDashboard from '../pages/admin/Dashboard.jsx'
import AdminServices from '../pages/admin/Services.jsx'
import AdminUsers from '../pages/admin/Users.jsx'
import AdminInformation from '../pages/admin/Information.jsx'
import AdminAnnouncements from '../pages/admin/Announcements.jsx'
import AdminDisplay from '../pages/admin/DisplayImages.jsx'
import AdminStatistics from '../pages/admin/Statistics.jsx'

function RequireAuth({ children, roles }) {
  const { user } = useAuthStore()
  const loc = useLocation()
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/petugas'} replace />
  }
  return children
}

const pub = (el) => <PublicLayout>{el}</PublicLayout>

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={pub(<Home />)} />
      <Route path="/information" element={pub(<Information />)} />
      <Route path="/ikd" element={pub(<IKD />)} />
      <Route path="/login" element={<Login />} />
      <Route path="/display" element={<Display />} />

      <Route path="/petugas" element={<Navigate to="/petugas/queue" replace />} />
      <Route path="/petugas/queue" element={<RequireAuth roles={['PETUGAS', 'ADMIN']}><PetugasQueue /></RequireAuth>} />
      <Route path="/petugas/history" element={<RequireAuth roles={['PETUGAS', 'ADMIN']}><PetugasHistory /></RequireAuth>} />
      <Route path="/petugas/profile" element={<RequireAuth roles={['PETUGAS', 'ADMIN']}><PetugasProfile /></RequireAuth>} />

      <Route path="/admin" element={<RequireAuth roles={['ADMIN']}><AdminDashboard /></RequireAuth>} />
      <Route path="/admin/services" element={<RequireAuth roles={['ADMIN']}><AdminServices /></RequireAuth>} />
      <Route path="/admin/users" element={<RequireAuth roles={['ADMIN']}><AdminUsers /></RequireAuth>} />
      <Route path="/admin/information" element={<RequireAuth roles={['ADMIN']}><AdminInformation /></RequireAuth>} />
      <Route path="/admin/announcements" element={<RequireAuth roles={['ADMIN']}><AdminAnnouncements /></RequireAuth>} />
      <Route path="/admin/display" element={<RequireAuth roles={['ADMIN']}><AdminDisplay /></RequireAuth>} />
      <Route path="/admin/statistics" element={<RequireAuth roles={['ADMIN']}><AdminStatistics /></RequireAuth>} />

      <Route path="*" element={pub(<div className="card p-10 text-center"><h1 className="text-2xl font-bold">404 — Halaman tidak ditemukan</h1><a href="/" className="text-orange-700 underline">Kembali ke beranda</a></div>)} />
    </Routes>
  )
}
