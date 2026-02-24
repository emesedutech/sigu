import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import {
  CheckCircle2, Clock, HeartPulse, XCircle,
  ChevronLeft, ChevronRight, Save, Loader2, Filter, Users
} from 'lucide-react'

const STATUS_CFG = {
  Hadir: { color: 'bg-emerald-500', light: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  Izin:  { color: 'bg-sky-500',     light: 'bg-sky-50 text-sky-700 border-sky-200',             icon: Clock       },
  Sakit: { color: 'bg-amber-500',   light: 'bg-amber-50 text-amber-700 border-amber-200',       icon: HeartPulse  },
  Alpa:  { color: 'bg-rose-500',    light: 'bg-rose-50 text-rose-700 border-rose-200',          icon: XCircle     },
}
const STATUSES = Object.keys(STATUS_CFG)

const toISO = d => d.toISOString().slice(0, 10)

export default function AttendancePage() {
  const { user } = useAuth()
  const [date,      setDate]      = useState(toISO(new Date()))
  const [kelas,     setKelas]     = useState('all')
  const [students,  setStudents]  = useState([])
  const [classes,   setClasses]   = useState([])
  const [att,       setAtt]       = useState({})
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)

  useEffect(() => {
    if (!user) return
    supabase.from('students').select('*').eq('teacher_id', user.id).order('class').order('name')
      .then(({ data }) => {
        setStudents(data || [])
        setClasses([...new Set((data || []).map(s => s.class))].sort())
      })
  }, [user])

  const loadAtt = useCallback(async () => {
    if (!students.length) return
    setLoading(true)
    const ids = students.map(s => s.id)
    const { data } = await supabase.from('attendance')
      .select('student_id, status, notes').eq('date', date).in('student_id', ids)
    const map = {}
    ;(data || []).forEach(r => { map[r.student_id] = { status: r.status, notes: r.notes || '' } })
    setAtt(map)
    setLoading(false)
  }, [date, students])

  useEffect(() => { loadAtt() }, [loadAtt])

  const filtered = kelas === 'all' ? students : students.filter(s => s.class === kelas)

  const setStatus = (id, status) => setAtt(p => ({ ...p, [id]: { ...p[id], status, notes: p[id]?.notes || '' } }))
  const setNotes  = (id, notes)  => setAtt(p => ({ ...p, [id]: { ...p[id], notes } }))
  const markAll   = (status) => {
    const up = {}
    filtered.forEach(s => { up[s.id] = { status, notes: att[s.id]?.notes || '' } })
    setAtt(p => ({ ...p, ...up }))
  }

  const handleSave = async () => {
    setSaving(true)
    const records = filtered.filter(s => att[s.id]?.status).map(s => ({
      student_id: s.id, date, status: att[s.id].status, notes: att[s.id].notes || null,
    }))
    await supabase.from('attendance').upsert(records, { onConflict: 'student_id,date' })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  const shiftDate = n => { const d = new Date(date); d.setDate(d.getDate() + n); setDate(toISO(d)) }

  const stats = STATUSES.reduce((a, s) => ({ ...a, [s]: filtered.filter(st => att[st.id]?.status === s).length }), {})
  const filled = filtered.filter(s => att[s.id]?.status).length

  return (
    <div className="space-y-5 animate-fadeUp">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-800">Absensi Harian</h1>
        <p className="text-slate-500 text-sm">Catat kehadiran siswa per hari</p>
      </div>

      {/* Controls */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => shiftDate(-1)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronLeft size={16} className="text-slate-500" />
          </button>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="input w-auto text-sm font-semibold" />
          <button onClick={() => shiftDate(1)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronRight size={16} className="text-slate-500" />
          </button>
          <button onClick={() => setDate(toISO(new Date()))} className="text-xs text-brand-600 hover:underline font-medium px-1">
            Hari ini
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400" />
          <select className="input w-auto text-sm" value={kelas} onChange={e => setKelas(e.target.value)}>
            <option value="all">Semua Kelas</option>
            {classes.map(c => <option key={c} value={c}>Kelas {c}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5 ml-auto flex-wrap">
          <span className="text-xs text-slate-400">Tandai semua:</span>
          {STATUSES.map(s => (
            <button key={s} onClick={() => markAll(s)}
              className={`text-xs px-2.5 py-1.5 rounded-lg border font-bold transition-colors ${STATUS_CFG[s].light}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {STATUSES.map(s => {
          const cfg = STATUS_CFG[s]; const Icon = cfg.icon
          const pct = filtered.length ? Math.round((stats[s] / filtered.length) * 100) : 0
          return (
            <div key={s} className="card p-4 flex items-center gap-3">
              <div className={`${cfg.color} p-2 rounded-xl shrink-0`}><Icon size={16} className="text-white" /></div>
              <div>
                <div className="font-display text-2xl font-bold text-slate-800">{stats[s]}</div>
                <div className="text-xs text-slate-500">{s} <span className="text-slate-400">({pct}%)</span></div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Progress */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
            <div className="bg-brand-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${filtered.length ? (filled / filtered.length) * 100 : 0}%` }} />
          </div>
          <span className="text-xs text-slate-500 whitespace-nowrap font-medium">
            {filled}/{filtered.length}
            {filled < filtered.length && <span className="text-amber-500"> ({filtered.length - filled} belum)</span>}
          </span>
        </div>
      )}

      {/* Student list */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 size={28} className="text-brand-500 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Users size={40} className="mx-auto mb-3 opacity-30" />
            <p>Tidak ada siswa{kelas !== 'all' ? ` di kelas ${kelas}` : ''}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map((s, i) => {
              const status = att[s.id]?.status
              const notes  = att[s.id]?.notes || ''
              return (
                <div key={s.id}
                  className={`px-4 py-3 flex flex-wrap md:flex-nowrap items-center gap-3 transition-colors hover:bg-slate-50/60
                    ${!status ? 'bg-amber-50/30' : ''}`}>
                  <div className="flex items-center gap-3 min-w-[200px] flex-1 md:flex-none">
                    <span className="text-xs text-slate-300 w-6 text-right shrink-0">{i + 1}</span>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0
                      ${s.gender === 'L' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                      {s.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 text-sm truncate">{s.name}</p>
                      <p className="text-xs text-slate-400">Kelas {s.class}{s.nisn ? ` · ${s.nisn}` : ''}</p>
                    </div>
                  </div>

                  <div className="flex gap-1.5 flex-wrap">
                    {STATUSES.map(st => {
                      const cfg = STATUS_CFG[st]; const active = status === st
                      return (
                        <button key={st} onClick={() => setStatus(s.id, st)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all duration-100
                            ${active ? `${cfg.color} text-white border-transparent shadow-sm scale-105` : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}>
                          {st}
                        </button>
                      )
                    })}
                  </div>

                  <input value={notes} onChange={e => setNotes(s.id, e.target.value)}
                    placeholder="Catatan..." className="input flex-1 min-w-[100px] text-xs py-1.5" />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Save */}
      {filtered.length > 0 && (
        <div className="flex justify-end pb-4">
          <button onClick={handleSave} disabled={saving || filled === 0}
            className={`btn-primary flex items-center gap-2 px-8 ${saved ? '!bg-emerald-500' : ''}`}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {saving ? 'Menyimpan...' : saved ? '✓ Tersimpan!' : 'Simpan Absensi'}
          </button>
        </div>
      )}
    </div>
  )
}
