import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore.js'

import Display from '../pages/display/Display.jsx'
import Login from '../pages/auth/Login.jsx'

import PetugasQueue from '../pages/petugas/Queue.jsx'
import PetugasHistory from '../pages/petugas/History.jsx'
import PetugasRest from '../pages/petugas/Rest.jsx'
import PetugasProfile from '../pages/petugas/Profile.jsx'

import AdminDashboard from '../pages/admin/Dashboard.jsx'
import AdminServices from '../pages/admin/Services.jsx'
import AdminUsers from '../pages/admin/Users.jsx'
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

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      {/* Monitor hanya untuk petugas/admin yang login (TV ruang pelayanan login sekali sebagai petugas) */}
      <Route path="/display" element={<RequireAuth roles={['PETUGAS', 'ADMIN']}><Display /></RequireAuth>} />

      <Route path="/petugas" element={<Navigate to="/petugas/queue" replace />} />
      <Route path="/petugas/queue" element={<RequireAuth roles={['PETUGAS', 'ADMIN']}><PetugasQueue /></RequireAuth>} />
      <Route path="/petugas/history" element={<RequireAuth roles={['PETUGAS', 'ADMIN']}><PetugasHistory /></RequireAuth>} />
      <Route path="/petugas/rest" element={<RequireAuth roles={['PETUGAS', 'ADMIN']}><PetugasRest /></RequireAuth>} />
      <Route path="/petugas/profile" element={<RequireAuth roles={['PETUGAS', 'ADMIN']}><PetugasProfile /></RequireAuth>} />

      <Route path="/admin" element={<RequireAuth roles={['ADMIN']}><AdminDashboard /></RequireAuth>} />
      <Route path="/admin/services" element={<RequireAuth roles={['ADMIN']}><AdminServices /></RequireAuth>} />
      <Route path="/admin/users" element={<RequireAuth roles={['ADMIN']}><AdminUsers /></RequireAuth>} />
      <Route path="/admin/announcements" element={<RequireAuth roles={['ADMIN']}><AdminAnnouncements /></RequireAuth>} />
      <Route path="/admin/display" element={<RequireAuth roles={['ADMIN']}><AdminDisplay /></RequireAuth>} />
      <Route path="/admin/statistics" element={<RequireAuth roles={['ADMIN']}><AdminStatistics /></RequireAuth>} />

      <Route path="*" element={<div className="card p-10 text-center"><h1 className="text-2xl font-bold">404 — Halaman tidak ditemukan</h1><Link to="/login" className="text-orange-700 underline">Kembali ke halaman login</Link></div>} />
    </Routes>
  )
}
