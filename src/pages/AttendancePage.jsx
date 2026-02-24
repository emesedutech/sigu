import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import {
  CheckCircle2, Clock, HeartPulse, XCircle,
  ChevronLeft, ChevronRight, Save, Loader2, Users,
  BarChart2, CalendarDays, FileText
} from 'lucide-react'

const STATUS_CFG = {
  Hadir: { color: 'bg-emerald-500', light: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  Izin:  { color: 'bg-sky-500',     light: 'bg-sky-50 text-sky-700 border-sky-200',             icon: Clock       },
  Sakit: { color: 'bg-amber-500',   light: 'bg-amber-50 text-amber-700 border-amber-200',       icon: HeartPulse  },
  Alpa:  { color: 'bg-rose-500',    light: 'bg-rose-50 text-rose-700 border-rose-200',          icon: XCircle     },
}
const STATUSES = Object.keys(STATUS_CFG)
const toISO  = d => d.toISOString().slice(0, 10)
const fmtLong  = d => new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const fmtShort = d => new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })

export default function AttendancePage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('input')

  /* ---- input state ---- */
  const [date,     setDate]    = useState(toISO(new Date()))
  const [kelas,    setKelas]   = useState('all')
  const [students, setStudents]= useState([])
  const [classes,  setClasses] = useState([])
  const [att,      setAtt]     = useState({})
  const [loading,  setLoading] = useState(true)
  const [saving,   setSaving]  = useState(false)
  const [saved,    setSaved]   = useState(false)

  /* ---- rekap state ---- */
  const [rekapKelas,   setRekapKelas]   = useState('all')
  const [rekapMonth,   setRekapMonth]   = useState(toISO(new Date()).slice(0, 7))
  const [rekapData,    setRekapData]    = useState([])
  const [rekapDates,   setRekapDates]   = useState([])
  const [rekapDetail,  setRekapDetail]  = useState({})
  const [rekapLoading, setRekapLoading] = useState(false)

  /* load students once */
  useEffect(() => {
    if (!user) return
    supabase.from('students').select('*').eq('teacher_id', user.id).order('class').order('name')
      .then(({ data }) => {
        setStudents(data || [])
        setClasses([...new Set((data || []).map(s => s.class))].sort())
      })
  }, [user])

  /* load attendance for selected date */
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

  /* load rekap */
  const loadRekap = useCallback(async () => {
    if (!students.length) return
    setRekapLoading(true)
    const start = rekapMonth + '-01'
    const endD  = new Date(rekapMonth + '-01'); endD.setMonth(endD.getMonth() + 1)
    const end   = toISO(endD)
    const base  = rekapKelas === 'all' ? students : students.filter(s => s.class === rekapKelas)
    const ids   = base.map(s => s.id)
    if (!ids.length) { setRekapLoading(false); return }

    const { data } = await supabase.from('attendance')
      .select('student_id, date, status')
      .in('student_id', ids).gte('date', start).lt('date', end).order('date')

    const rows   = data || []
    const dates  = [...new Set(rows.map(r => r.date))].sort()
    const detail = {}
    rows.forEach(r => {
      if (!detail[r.student_id]) detail[r.student_id] = {}
      detail[r.student_id][r.date] = r.status
    })
    setRekapDates(dates)
    setRekapDetail(detail)
    setRekapData(base.map(s => {
      const vals = Object.values(detail[s.id] || {})
      return {
        student: s,
        hadir:  vals.filter(v => v === 'Hadir').length,
        izin:   vals.filter(v => v === 'Izin').length,
        sakit:  vals.filter(v => v === 'Sakit').length,
        alpa:   vals.filter(v => v === 'Alpa').length,
        total:  vals.length,
      }
    }))
    setRekapLoading(false)
  }, [students, rekapKelas, rekapMonth])

  useEffect(() => { if (tab === 'rekap') loadRekap() }, [tab, loadRekap])

  /* helpers */
  const filtered   = kelas === 'all' ? students : students.filter(s => s.class === kelas)
  const setStatus  = (id, status) => setAtt(p => ({ ...p, [id]: { status, notes: p[id]?.notes || '' } }))
  const setNotes   = (id, notes)  => setAtt(p => ({ ...p, [id]: { ...p[id], notes } }))
  const markAll    = (status) => {
    const up = {}; filtered.forEach(s => { up[s.id] = { status, notes: att[s.id]?.notes || '' } })
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
  const stats  = STATUSES.reduce((a, s) => ({ ...a, [s]: filtered.filter(st => att[st.id]?.status === s).length }), {})
  const filled = filtered.filter(s => att[s.id]?.status).length

  return (
    <div className="space-y-5 animate-fadeUp">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-800">Absensi</h1>
          <p className="text-slate-500 text-sm">Input dan rekap kehadiran siswa</p>
        </div>
        <div className="flex bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          {[['input', CalendarDays, 'Input'], ['rekap', BarChart2, 'Rekap']].map(([id, Icon, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors
                ${tab === id ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* ════════════════ TAB: INPUT ════════════════ */}
      {tab === 'input' && (
        <>
          {/* Toolbar */}
          <div className="card p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {/* date nav */}
              <div className="flex items-center gap-0.5 bg-slate-50 rounded-xl px-1 py-1 border border-slate-100">
                <button onClick={() => shiftDate(-1)} className="p-1.5 hover:bg-white rounded-lg transition-colors">
                  <ChevronLeft size={15} className="text-slate-500" />
                </button>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="bg-transparent text-sm font-semibold text-slate-700 focus:outline-none cursor-pointer w-[130px]" />
                <button onClick={() => shiftDate(1)} className="p-1.5 hover:bg-white rounded-lg transition-colors">
                  <ChevronRight size={15} className="text-slate-500" />
                </button>
              </div>
              <button onClick={() => setDate(toISO(new Date()))}
                className="text-xs font-semibold text-brand-600 bg-brand-50 hover:bg-brand-100 px-2.5 py-1.5 rounded-lg transition-colors">
                Hari Ini
              </button>
              <select className="input w-auto text-sm py-1.5" value={kelas} onChange={e => setKelas(e.target.value)}>
                <option value="all">Semua Kelas</option>
                {classes.map(c => <option key={c} value={c}>Kelas {c}</option>)}
              </select>
              <div className="flex-1" />
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-slate-400 hidden sm:block">Tandai:</span>
                {STATUSES.map(s => (
                  <button key={s} onClick={() => markAll(s)}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border font-bold transition-colors ${STATUS_CFG[s].light}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-slate-400 pl-0.5">{fmtLong(date)}</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {STATUSES.map(s => {
              const { color, icon: Icon } = STATUS_CFG[s]
              const pct = filtered.length ? Math.round((stats[s] / filtered.length) * 100) : 0
              return (
                <div key={s} className="card px-4 py-3 flex items-center gap-3">
                  <div className={`${color} p-2 rounded-xl shrink-0`}><Icon size={15} className="text-white" /></div>
                  <div>
                    <div className="font-display text-xl font-bold text-slate-800">{stats[s]}</div>
                    <div className="text-xs text-slate-500">{s} <span className="text-slate-400">· {pct}%</span></div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Progress */}
          {filtered.length > 0 && (
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div className="bg-brand-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${(filled / filtered.length) * 100}%` }} />
              </div>
              <span className="text-xs text-slate-500 font-medium shrink-0">
                {filled}/{filtered.length}
                {filled < filtered.length && <span className="text-amber-500 ml-1">({filtered.length - filled} belum)</span>}
              </span>
            </div>
          )}

          {/* Student table */}
          <div className="card overflow-hidden">
            {/* Desktop header */}
            <div className="hidden md:flex items-center bg-slate-50 border-b border-slate-100 px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <div className="w-8 shrink-0" />
              <div className="flex-1 min-w-0 pr-4">Siswa</div>
              <div className="w-[272px] shrink-0">Status Kehadiran</div>
              <div className="flex-1 min-w-0 pl-4">Catatan</div>
            </div>

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
                      className={`px-5 transition-colors hover:bg-slate-50/70 ${!status ? 'bg-amber-50/20' : ''}
                        /* mobile */  py-3 flex flex-col gap-2.5
                        /* desktop */ md:flex-row md:items-center md:gap-0 md:py-2.5`}>

                      {/* Number */}
                      <div className="hidden md:flex w-8 shrink-0 text-xs text-slate-300 justify-end pr-2">{i + 1}</div>

                      {/* Student info */}
                      <div className="flex items-center gap-3 flex-1 min-w-0 md:pr-4">
                        <span className="md:hidden text-xs text-slate-300 w-5 shrink-0">{i + 1}</span>
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0
                          ${s.gender === 'L' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                          {s.name.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-800 text-sm leading-tight truncate">{s.name}</p>
                          <p className="text-xs text-slate-400">Kelas {s.class}{s.nisn ? ` · ${s.nisn}` : ''}</p>
                        </div>
                        {/* mobile active badge */}
                        {status && (
                          <span className={`md:hidden shrink-0 text-xs font-bold px-2 py-0.5 rounded-lg border ${STATUS_CFG[status].light}`}>
                            {status}
                          </span>
                        )}
                      </div>

                      {/* Status buttons */}
                      <div className="flex gap-1.5 md:w-[272px] md:shrink-0">
                        {STATUSES.map(st => {
                          const active = status === st
                          return (
                            <button key={st} onClick={() => setStatus(s.id, st)}
                              className={`flex-1 py-1.5 md:py-2 rounded-lg text-xs font-bold border transition-all duration-100
                                ${active
                                  ? `${STATUS_CFG[st].color} text-white border-transparent shadow-sm`
                                  : 'border-slate-200 text-slate-400 hover:border-slate-300 hover:bg-slate-50'}`}>
                              {st}
                            </button>
                          )
                        })}
                      </div>

                      {/* Notes */}
                      <div className="md:flex-1 md:min-w-0 md:pl-4">
                        <input value={notes} onChange={e => setNotes(s.id, e.target.value)}
                          placeholder="Catatan..." className="input text-xs py-1.5 w-full" />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {filtered.length > 0 && (
            <div className="flex justify-end pb-4">
              <button onClick={handleSave} disabled={saving || filled === 0}
                className={`btn-primary flex items-center gap-2 px-8 ${saved ? '!bg-emerald-500' : ''}`}>
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                {saving ? 'Menyimpan...' : saved ? '✓ Tersimpan!' : `Simpan Absensi (${filled})`}
              </button>
            </div>
          )}
        </>
      )}

      {/* ════════════════ TAB: REKAP ════════════════ */}
      {tab === 'rekap' && (
        <>
          {/* Rekap filters */}
          <div className="card p-4 flex flex-wrap items-end gap-4">
            <div>
              <label className="label">Bulan</label>
              <input type="month" className="input w-auto" value={rekapMonth}
                onChange={e => setRekapMonth(e.target.value)} />
            </div>
            <div>
              <label className="label">Kelas</label>
              <select className="input w-auto" value={rekapKelas} onChange={e => setRekapKelas(e.target.value)}>
                <option value="all">Semua Kelas</option>
                {classes.map(c => <option key={c} value={c}>Kelas {c}</option>)}
              </select>
            </div>
            <button onClick={loadRekap} className="btn-primary flex items-center gap-2">
              <BarChart2 size={15} /> Tampilkan Rekap
            </button>
          </div>

          {rekapLoading ? (
            <div className="flex justify-center py-20"><Loader2 size={28} className="text-brand-500 animate-spin" /></div>
          ) : rekapData.length === 0 ? (
            <div className="card text-center py-16 text-slate-400">
              <FileText size={40} className="mx-auto mb-3 opacity-30" />
              <p>Pilih bulan &amp; kelas, lalu klik Tampilkan Rekap</p>
            </div>
          ) : (
            <>
              {/* Summary stat cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {STATUSES.map(s => {
                  const { color, icon: Icon } = STATUS_CFG[s]
                  const total = rekapData.reduce((a, r) => a + r[s.toLowerCase()], 0)
                  return (
                    <div key={s} className="card p-4 flex items-center gap-3">
                      <div className={`${color} p-2.5 rounded-xl`}><Icon size={18} className="text-white" /></div>
                      <div>
                        <div className="font-display text-2xl font-bold text-slate-800">{total}</div>
                        <div className="text-xs text-slate-500">Total {s}</div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Rekap summary table */}
              <div className="card overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                  <BarChart2 size={15} className="text-brand-500" />
                  <h3 className="font-display font-bold text-slate-800">Rekap Kehadiran — {new Date(rekapMonth + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[560px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-xs font-semibold uppercase tracking-wide">
                        <th className="px-4 py-3 text-left text-slate-500 sticky left-0 bg-slate-50 z-10 min-w-[180px]">Nama Siswa</th>
                        <th className="px-3 py-3 text-center text-emerald-600">Hadir</th>
                        <th className="px-3 py-3 text-center text-sky-600">Izin</th>
                        <th className="px-3 py-3 text-center text-amber-600">Sakit</th>
                        <th className="px-3 py-3 text-center text-rose-600">Alpa</th>
                        <th className="px-3 py-3 text-center text-slate-500">Total</th>
                        <th className="px-3 py-3 text-center text-slate-500">% Hadir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {rekapData.map(r => {
                        const pct      = r.total > 0 ? Math.round((r.hadir / r.total) * 100) : null
                        const pctColor = pct === null ? 'text-slate-300' : pct >= 85 ? 'text-emerald-600' : pct >= 75 ? 'text-amber-600' : 'text-rose-600'
                        return (
                          <tr key={r.student.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-4 py-3 sticky left-0 bg-white z-10">
                              <div className="flex items-center gap-2.5">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0
                                  ${r.student.gender === 'L' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                                  {r.student.name.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-semibold text-slate-800 leading-tight">{r.student.name}</p>
                                  <p className="text-xs text-slate-400">Kelas {r.student.class}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-center"><span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 font-bold">{r.hadir}</span></td>
                            <td className="px-3 py-3 text-center"><span className="px-2 py-0.5 rounded-lg bg-sky-50 text-sky-700 font-bold">{r.izin}</span></td>
                            <td className="px-3 py-3 text-center"><span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 font-bold">{r.sakit}</span></td>
                            <td className="px-3 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded-lg font-bold ${r.alpa > 0 ? 'bg-rose-50 text-rose-700' : 'text-slate-300'}`}>{r.alpa}</span>
                            </td>
                            <td className="px-3 py-3 text-center font-semibold text-slate-600">{r.total || '—'}</td>
                            <td className="px-3 py-3 text-center"><span className={`font-bold ${pctColor}`}>{pct !== null ? pct + '%' : '—'}</span></td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 border-t-2 border-slate-200 text-xs font-bold text-slate-700">
                        <td className="px-4 py-3 sticky left-0 bg-slate-50 uppercase tracking-wide">Total</td>
                        {['hadir','izin','sakit','alpa'].map(k => (
                          <td key={k} className="px-3 py-3 text-center">{rekapData.reduce((a, r) => a + r[k], 0)}</td>
                        ))}
                        <td className="px-3 py-3 text-center">{rekapData.reduce((a, r) => a + r.total, 0)}</td>
                        <td className="px-3 py-3 text-center">
                          {(() => {
                            const h = rekapData.reduce((a, r) => a + r.hadir, 0)
                            const t = rekapData.reduce((a, r) => a + r.total, 0)
                            return t > 0 ? Math.round(h / t * 100) + '%' : '—'
                          })()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Detail per tanggal */}
              {rekapDates.length > 0 && (
                <div className="card overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                    <CalendarDays size={15} className="text-brand-500" />
                    <h3 className="font-display font-bold text-slate-800 text-sm">
                      Detail Per Tanggal <span className="text-slate-400 font-normal">({rekapDates.length} hari aktif)</span>
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="text-xs min-w-max">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="px-4 py-2.5 text-left font-semibold text-slate-500 sticky left-0 bg-slate-50 z-10 min-w-[160px]">Nama</th>
                          {rekapDates.map(d => (
                            <th key={d} className="px-1.5 py-2.5 text-center font-semibold text-slate-500 min-w-[40px]">
                              {fmtShort(d)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {rekapData.map(r => (
                          <tr key={r.student.id} className="hover:bg-slate-50/60">
                            <td className="px-4 py-2 font-semibold text-slate-700 sticky left-0 bg-white z-10 truncate max-w-[160px]">
                              {r.student.name}
                            </td>
                            {rekapDates.map(d => {
                              const st  = rekapDetail[r.student.id]?.[d]
                              const lbl = st ? st.charAt(0) : '·'
                              return (
                                <td key={d} className="px-1.5 py-2 text-center">
                                  <span className={`inline-flex items-center justify-center w-7 h-6 rounded text-xs font-bold border
                                    ${st ? STATUS_CFG[st].light : 'text-slate-200 border-transparent'}`}>
                                    {lbl}
                                  </span>
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-5 py-2.5 border-t border-slate-100 flex items-center gap-4 flex-wrap">
                    {STATUSES.map(s => (
                      <span key={s} className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border ${STATUS_CFG[s].light}`}>
                        <span className="font-bold">{s.charAt(0)}</span> = {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
