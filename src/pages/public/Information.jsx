import { useEffect, useState } from 'react'
import { Info, FileCheck } from 'lucide-react'
import { getServices, getRequirements, getInformation } from '../../services/masterService.js'
import { Empty } from '../../components/ui/ui.jsx'

export default function Information() {
  const [services, setServices] = useState([])
  const [active, setActive] = useState(null)
  const [reqs, setReqs] = useState([])
  const [infos, setInfos] = useState([])

  useEffect(() => {
    getServices().then((rows) => {
      setServices(rows)
      if (rows[0]) setActive(rows[0].id)
    }).catch(() => {})
    getInformation().then(setInfos).catch(() => {})
  }, [])

  useEffect(() => {
    if (active) getRequirements(active).then(setReqs).catch(() => setReqs([]))
  }, [active])

  const svc = services.find((s) => s.id === active)

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center justify-center gap-2"><Info className="text-orange-600" /> Informasi Pelayanan</h1>
        <p className="text-sm text-slate-500">Syarat & prosedur setiap layanan — tanpa perlu bertanya ke petugas.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="card p-4 h-fit">
          <div className="font-bold text-sm text-slate-700 mb-2">DAFTAR LAYANAN</div>
          <div className="space-y-1.5">
            {services.map((s) => (
              <button key={s.id} onClick={() => setActive(s.id)} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition ${active === s.id ? 'bg-orange-600 text-white shadow-[0_4px_14px_rgba(234,88,12,0.4)]' : 'hover:bg-slate-100 text-slate-700'}`}>
                <span className="font-mono text-xs opacity-70 mr-2">{s.prefix}</span>{s.name}
              </button>
            ))}
          </div>
        </div>
        <div className="md:col-span-2 card p-6">
          {!svc ? <Empty /> : (
            <>
              <span className="badge bg-orange-100 text-orange-800 font-mono">{svc.prefix}</span>
              <h2 className="text-xl font-bold text-slate-900 mt-2">{svc.name}</h2>
              <p className="text-sm text-slate-500">{svc.description}</p>
              <h3 className="font-bold text-sm mt-4 mb-2 flex items-center gap-1.5"><FileCheck size={15} className="text-emerald-600" /> Persyaratan:</h3>
              {reqs.length === 0 ? <p className="text-sm text-slate-400">Belum ada data persyaratan.</p> : (
                <ol className="list-decimal list-inside space-y-1.5 text-sm">
                  {reqs.map((r) => <li key={r.id} className="bg-slate-50 rounded-lg px-3 py-2">{r.requirement || r}</li>)}
                </ol>
              )}
              <h3 className="font-bold text-sm mt-4 mb-2">Prosedur:</h3>
              <ol className="text-sm space-y-1.5">
                  {['Datang ke ruang pelayanan dan lapor ke petugas', 'Tunggu hingga nomor antrean dipanggil di monitor', 'Serahkan berkas ke petugas', 'Verifikasi oleh petugas', 'Terima dokumen / keterangan'].map((p, i) => (
                  <li key={p} className="flex gap-2 items-start"><span className="w-6 h-6 rounded-full bg-orange-600 text-white text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span><span className="pt-0.5">{p}</span></li>
                ))}
              </ol>
            </>
          )}
        </div>
      </div>

      {infos.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {infos.map((i) => (
            <div key={i.id} className="card p-4">
              <div className="badge bg-slate-100 text-slate-600">{i.category}</div>
              <div className="font-bold mt-1.5">{i.title}</div>
              <div className="text-sm text-slate-600 whitespace-pre-line mt-1">{i.content?.replace(/\\n/g, '\n')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
