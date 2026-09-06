import { useEffect, useRef, useState, useCallback } from 'react'
import { hasRealName, kkCallNote } from '../utils/queue.js'

// const OPENING_SOUND = '/opening sound.mp3'
// const CLOSING_SOUND = '/closing sound.mp3'
const OPENING_SOUND = `${import.meta.env.BASE_URL}opening sound.mp3`
const CLOSING_SOUND = `${import.meta.env.BASE_URL}closing sound.mp3`

// Putar file audio hingga selesai (resolve langsung bila gagal)
function playFile(src) {
  return new Promise((resolve) => {
    try {
      const a = new Audio(encodeURI(src))
      let done = false
      const finish = () => { if (!done) { done = true; resolve() } }
      a.onended = finish
      a.onerror = finish
      a.play().catch(finish)
      setTimeout(finish, 15000)
    } catch {
      resolve()
    }
  })
}

// Web Speech API — prioritas suara perempuan Bahasa Indonesia
export function useSpeech() {
  const [enabled, setEnabled] = useState(() => localStorage.getItem('siap_tts') !== 'off')
  const [voices, setVoices] = useState([])

  useEffect(() => {
    const load = () => setVoices(window.speechSynthesis?.getVoices() || [])
    load()
    window.speechSynthesis?.addEventListener?.('voiceschanged', load)
    return () => window.speechSynthesis?.removeEventListener?.('voiceschanged', load)
  }, [])

  const toggle = useCallback(() => {
    setEnabled((v) => {
      localStorage.setItem('siap_tts', v ? 'off' : 'on')
      if (v) window.speechSynthesis?.cancel()
      return !v
    })
  }, [])

  const pickVoice = useCallback(() => {
    if (!voices.length) return null
    const id = voices.filter((v) => v.lang?.toLowerCase().startsWith('id'))
    if (id.length) {
      const female = id.find((v) => /female|perempuan|google|natural|zira|siti|gadis/i.test(v.name))
      return female || id[0]
    }
    return voices.find((v) => v.lang?.toLowerCase().startsWith('en')) || voices[0]
  }, [voices])

  const speak = useCallback((text) => {
    if (!enabled || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'id-ID'
    u.rate = 0.95
    u.pitch = 1.05
    const v = pickVoice()
    if (v) u.voice = v
    window.speechSynthesis.speak(u)
  }, [enabled, pickVoice])

  // Ucapkan 2x dengan jeda pendek agar panggilan lebih jelas terdengar
  const speakRepeat = useCallback((text, times = 2, onDone) => {
    if (!enabled || !('speechSynthesis' in window)) {
      if (onDone) onDone()
      return
    }
    window.speechSynthesis.cancel()
    let n = 0
    const say = () => {
      if (n >= times) {
        if (onDone) onDone()
        return
      }
      n++
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'id-ID'
      u.rate = 0.95
      u.pitch = 1.05
      const v = pickVoice()
      if (v) u.voice = v
      if (n < times) {
        let fired = false
        const next = () => { if (!fired) { fired = true; setTimeout(say, 700) } }
        u.onend = next
        u.onerror = next
      } else if (onDone) {
        let fired = false
        const finish = () => { if (!fired) { fired = true; onDone() } }
        u.onend = finish
        u.onerror = finish
      }
      window.speechSynthesis.speak(u)
    }
    say()
  }, [enabled, pickVoice])

  // Rangkaian penuh: opening → pengumuman 2x → closing.
  // Generasi baru membatalkan rangkaian lama agar panggilan tak bertumpuk.
  const callSeq = useRef(0)
  const announceWithJingle = useCallback((text) => {
    if (!enabled || !('speechSynthesis' in window)) return
    const my = ++callSeq.current
    const alive = () => callSeq.current === my
    window.speechSynthesis.cancel()
    playFile(OPENING_SOUND).then(() => {
      if (!alive()) return
      speakRepeat(text, 2, () => {
        if (alive()) playFile(CLOSING_SOUND)
      })
    })
  }, [enabled, speakRepeat])

  const announceQueue = useCallback((queue) => {
    if (!queue) return
    const num = String(queue.number || '').replace('-', ' ')
    const tujuan = queue.counter_name ? `, silakan menuju ${queue.counter_name}` : ', silakan masuk ke ruang pelayanan'
    // Nama opsional: kalau kosong / "Tanpa Nama", panggil nomor saja tanpa "atas nama"
    // IKD: selalu nomor saja tanpa nama warga
    const isIKD = String(queue.prefix || '').toUpperCase() === 'IKD'
    const withName = hasRealName(queue.name) && !isIKD
    announceWithJingle(withName
      ? `Nomor antrean ${num}, atas nama ${String(queue.name).trim()}${tujuan}.`
      : `Nomor antrean ${num}${tujuan}.`)
  }, [announceWithJingle])

  // Panggilan serentak beberapa nomor: satu kalimat gabungan
  // ("Nomor antrean KTP 5, KTP 6, dan KTP 7, silakan masuk ke ruang pelayanan.")
  // — satu nomor didelegasikan ke announceQueue (ikut aturan nama/IKD).
  const announceQueues = useCallback((list) => {
    const rows = (list || []).filter(Boolean)
    if (!rows.length) return
    if (rows.length === 1) return announceQueue(rows[0])
    const ordered = [...rows].sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
    const nums = ordered.map((q) => String(q.number || '').replace('-', ' '))
    const last = nums.pop()
    const joined = nums.length ? `${nums.join(', ')}, dan ${last}` : last
    const tujuan = ordered[0].counter_name ? `, silakan menuju ${ordered[0].counter_name}` : ', silakan masuk ke ruang pelayanan'
    announceWithJingle(`Nomor antrean ${joined}${tujuan}.`)
  }, [announceQueue, announceWithJingle])

  const announceKK = useCallback((item) => {
    if (!item) return
    announceWithJingle(`Kartu Keluarga atas nama ${item.name}, ${kkCallNote(item.note, item.counter_name)}.`)
  }, [announceWithJingle])

  // Pengumuman spontan petugas — bacakan isi pesannya apa adanya
  const announceBroadcast = useCallback((item) => {
    const msg = String(item?.message || '').trim()
    if (msg) announceWithJingle(msg)
  }, [announceWithJingle])

  return { enabled, toggle, speak, speakRepeat, announceQueue, announceQueues, announceKK, announceBroadcast }
}

export function useClock(intervalMs = 1000) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

export function useLocalSignal() {
  const [, force] = useState(0)
  useEffect(() => {
    const fn = () => force((x) => x + 1)
    window.addEventListener('siap:queues-changed', fn)
    window.addEventListener('siap:master-changed', fn)
    window.addEventListener('storage', fn)
    return () => {
      window.removeEventListener('siap:queues-changed', fn)
      window.removeEventListener('siap:master-changed', fn)
      window.removeEventListener('storage', fn)
    }
  }, [])
}

export function useRealtimeQueues(fetchFn, { pollMs = 3000 } = {}) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const timer = useRef(null)

  const refresh = useCallback(async () => {
    try {
      const rows = await fetchFn()
      setData(rows)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [fetchFn])

  useEffect(() => {
    refresh()
    const onChange = () => refresh()
    window.addEventListener('siap:queues-changed', onChange)
    window.addEventListener('storage', onChange)
    timer.current = setInterval(refresh, pollMs)
    return () => {
      clearInterval(timer.current)
      window.removeEventListener('siap:queues-changed', onChange)
      window.removeEventListener('storage', onChange)
    }
  }, [refresh, pollMs])

  return { data, loading, refresh }
}
