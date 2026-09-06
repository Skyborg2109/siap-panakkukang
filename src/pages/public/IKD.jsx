import { useEffect, useState } from 'react'
import { Fingerprint, Smartphone, ShieldCheck, BadgeCheck } from 'lucide-react'
import { getIKD } from '../../services/masterService.js'

export default function IKD() {
  const [ikd, setIkd] = useState(null)

  useEffect(() => {
    getIKD().then(setIkd).catch(() => {})
  }, [])

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-orange-500 text-white flex items-center justify-center mb-3"><Fingerprint size={28} /></div>
        <h1 className="text-2xl font-extrabold text-slate-900">{ikd?.title || 'Identitas Kependudukan Digital (IKD)'}</h1>
        <p className="text-sm text-slate-500">KTP digital resmi Dukcapil Kemendagri — pengganti fotokopi KTP.</p>
      </div>

      <div className="card p-6">
        <div className="whitespace-pre-line text-[15px] leading-relaxed text-slate-700">{ikd?.content || 'Memuat…'}</div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        {[
          { icon: <Smartphone size={20} />, t: 'Tanpa Fotokopi', d: 'Cukup tunjukkan QR dari HP' },
          { icon: <ShieldCheck size={20} />, t: 'Aman & Resmi', d: 'Terproteksi PIN & verifikasi wajah' },
          { icon: <BadgeCheck size={20} />, t: 'Gratis', d: 'Aktivasi di ruang pelayanan, ±5 menit' },
        ].map((f) => (
          <div key={f.t} className="card p-4 text-center">
            <div className="mx-auto w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center mb-2">{f.icon}</div>
            <div className="font-bold text-sm">{f.t}</div>
            <div className="text-xs text-slate-500">{f.d}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
