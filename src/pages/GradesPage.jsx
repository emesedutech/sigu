import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import {
  BookOpen, Save, Loader2, ChevronLeft, ChevronRight,
  BarChart2, TrendingUp, TrendingDown, FileText, Users
} from 'lucide-react'

const toISO  = d => d.toISOString().slice(0, 10)
const fmtLong = d => new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

const scoreColor = v => {
  const n = Number(v)
  if (v === '' || v == null) return 'border-slate-200 bg-white'
  if (n >= 85) return 'border-emerald-400 bg-emerald-50 text-emerald-800'
  if (n >= 70) return 'border-brand-400 bg-brand-50 text-brand-800'
  if (n >= 60) return 'border-amber-400 bg-amber-50 text-amber-800'
  return 'border-rose-400 bg-rose-50 text-rose-800'
}

const scoreBadge = v => {
  const n = Number(v)
  if (v === '' || v == null) return null
  if (n >= 85) return { label: 'A', cls: 'bg-emerald-100 text-emerald-700' }
  if (n >= 70) return { label: 'B', cls: 'bg-brand-100 text-brand-700' }
  if (n >= 60) return { label: 'C', cls: 'bg-amber-100 text-amber-700' }
  return { label: 'D', cls: 'bg-rose-100 text-rose-700' }
}

// ──── SQL schema patch needed: ────────────────────────────────────────
// ALTER TABLE grades ADD COLUMN IF NOT EXISTS assessment_name TEXT;
// ─────────────────────────────────────────────────────────────────────

export default function GradesPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('input')

  /* ── input state ── */
  const [date,           setDate]          = useState(toISO(new Date()))
  const [subject,        setSubject]       = useState('')
  const [assessmentName, setAssessmentName]= useState('')
  const [kelas,          setKelas]         = useState('all')
  const [students,       setStudents]      = useState([])
  const [classes,        setClasses]       = useState([])
  const [grades,         setGrades]        = useState({})
  const [subjects,       setSubjects]      = useState([])
  const [loading,        setLoading]       = useState(true)
  const [saving,         setSaving]        = useState(false)
  const [saved,          setSaved]         = useState(false)

  /* ── rekap state ── */
  const [rekapKelas,   setRekapKelas]   = useState('all')
  const [rekapSubject, setRekapSubject] = useState('')
  const [rekapData,    setRekapData]    = useState([]) // [{student, entries:[{date,name,score,remarks}], avg}]
  const [rekapLoading, setRekapLoading] = useState(false)
  const [rekapCols,    setRekapCols]    = useState([]) // [{date, name}] unique sorted

  /* load students + subjects */
  useEffect(() => {
    if (!user) return
    supabase.from('students').select('*').eq('teacher_id', user.id).order('class').order('name')
      .then(({ data }) => {
        setStudents(data || [])
        setClasses([...new Set((data || []).map(s => s.class))].sort())
        setLoading(false)
      })
    supabase.from('schedules').select('subject').eq('teacher_id', user.id)
      .then(({ data }) => {
        setSubjects([...new Set((data || []).map(s => s.subject))].sort())
      })
  }, [user])

  const filtered = kelas === 'all' ? students : students.filter(s => s.class === kelas)

  /* load grades for current filters */
  useEffect(() => {
    if (!filtered.length || !subject || !date) return
    const load = async () => {
      const ids = filtered.map(s => s.id)
      const { data } = await supabase.from('grades')
        .select('student_id, score, remarks, assessment_name')
        .eq('subject', subject).eq('assessment_date', date).in('student_id', ids)
      const map = {}
      ;(data || []).forEach(r => {
        map[r.student_id] = {
          score: r.score ?? '',
          remarks: r.remarks || '',
          assessment_name: r.assessment_name || '',
        }
      })
      // prefill assessment_name from first loaded row
      const first = data?.[0]
      if (first?.assessment_name && !assessmentName) setAssessmentName(first.assessment_name)
      setGrades(map)
    }
    load()
  }, [date, subject, kelas, students])

  const setField = (id, field, val) => setGrades(p => ({ ...p, [id]: { ...p[id], [field]: val } }))

  const handleSave = async () => {
    if (!subject) return alert('Pilih mata pelajaran terlebih dahulu')
    setSaving(true)
    const records = filtered
      .filter(s => grades[s.id]?.score !== '' && grades[s.id]?.score != null)
      .map(s => ({
        student_id:      s.id,
        subject,
        assessment_name: assessmentName || null,
        score:           Number(grades[s.id].score),
        remarks:         grades[s.id].remarks || null,
        assessment_date: date,
      }))
    const { error } = await supabase.from('grades')
      .upsert(records, { onConflict: 'student_id,subject,assessment_date' })
    if (error) console.error(error)
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  const shiftDate = n => { const d = new Date(date); d.setDate(d.getDate() + n); setDate(toISO(d)) }

  const filledScores = Object.values(grades).filter(g => g.score !== '' && g.score != null)
  const avg = filledScores.length
    ? filledScores.reduce((a, g) => a + Number(g.score), 0) / filledScores.length
    : null
  const highest = filledScores.length ? Math.max(...filledScores.map(g => Number(g.score))) : null
  const lowest  = filledScores.length ? Math.min(...filledScores.map(g => Number(g.score))) : null

  /* ── rekap ── */
  const loadRekap = useCallback(async () => {
    if (!students.length || !rekapSubject) return
    setRekapLoading(true)
    const base = rekapKelas === 'all' ? students : students.filter(s => s.class === rekapKelas)
    const ids  = base.map(s => s.id)
    const { data } = await supabase.from('grades')
      .select('student_id, assessment_date, assessment_name, score, remarks')
      .eq('subject', rekapSubject)
      .in('student_id', ids)
      .order('assessment_date').order('created_at')

    const rows = data || []
    // unique columns: date + name combo
    const colMap = new Map()
    rows.forEach(r => {
      const key = r.assessment_date + '||' + (r.assessment_name || '')
      if (!colMap.has(key)) colMap.set(key, { date: r.assessment_date, name: r.assessment_name || '' })
    })
    const cols = [...colMap.values()]
    setRekapCols(cols)

    // per student
    const byStudent = {}
    rows.forEach(r => {
      if (!byStudent[r.student_id]) byStudent[r.student_id] = {}
      const key = r.assessment_date + '||' + (r.assessment_name || '')
      byStudent[r.student_id][key] = r.score
    })

    const summary = base.map(s => {
      const scores = Object.values(byStudent[s.id] || {}).filter(v => v != null)
      return {
        student: s,
        cells:   byStudent[s.id] || {},
        avg:     scores.length ? scores.reduce((a, v) => a + v, 0) / scores.length : null,
        highest: scores.length ? Math.max(...scores) : null,
        count:   scores.length,
      }
    })
    setRekapData(summary)
    setRekapLoading(false)
  }, [students, rekapKelas, rekapSubject])

  useEffect(() => { if (tab === 'rekap' && rekapSubject) loadRekap() }, [tab, loadRekap])

  return (
    <div className="space-y-5 animate-fadeUp">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-800">Penilaian</h1>
          <p className="text-slate-500 text-sm">Input nilai dan rekap hasil penilaian siswa</p>
        </div>
        <div className="flex bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          {[['input', BookOpen, 'Input'], ['rekap', BarChart2, 'Rekap']].map(([id, Icon, label]) => (
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
          {/* Filter bar */}
          <div className="card p-4 space-y-3">
            <div className="flex flex-wrap gap-3 items-end">
              {/* Tanggal */}
              <div>
                <label className="label">Tanggal Penilaian</label>
                <div className="flex items-center gap-0.5 bg-slate-50 rounded-xl px-1 py-1 border border-slate-100">
                  <button onClick={() => shiftDate(-1)} className="p-1.5 hover:bg-white rounded-lg transition-colors">
                    <ChevronLeft size={15} className="text-slate-500" />
                  </button>
                  <input type="date" className="bg-transparent text-sm font-semibold text-slate-700 focus:outline-none w-[130px]"
                    value={date} onChange={e => setDate(e.target.value)} />
                  <button onClick={() => shiftDate(1)} className="p-1.5 hover:bg-white rounded-lg transition-colors">
                    <ChevronRight size={15} className="text-slate-500" />
                  </button>
                </div>
              </div>

              {/* Nama Penilaian */}
              <div className="flex-1 min-w-[160px]">
                <label className="label">Nama Penilaian</label>
                <input className="input" value={assessmentName} onChange={e => setAssessmentName(e.target.value)}
                  placeholder="Ulangan Harian 1, UTS, UAS..." list="aname-list" />
                <datalist id="aname-list">
                  {['Ulangan Harian 1','Ulangan Harian 2','Ulangan Harian 3','UTS','UAS','Tugas 1','Tugas 2','Kuis','Praktik'].map(n => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </div>

              {/* Mata Pelajaran */}
              <div className="flex-1 min-w-[140px]">
                <label className="label">Mata Pelajaran</label>
                <input className="input" value={subject} onChange={e => setSubject(e.target.value)}
                  placeholder="Matematika, IPA..." list="subjects-list" />
                <datalist id="subjects-list">{subjects.map(s => <option key={s} value={s} />)}</datalist>
              </div>

              {/* Kelas */}
              <div>
                <label className="label">Kelas</label>
                <select className="input w-auto" value={kelas} onChange={e => setKelas(e.target.value)}>
                  <option value="all">Semua</option>
                  {classes.map(c => <option key={c} value={c}>Kelas {c}</option>)}
                </select>
              </div>
            </div>
            <p className="text-xs text-slate-400">{fmtLong(date)}</p>
          </div>

          {/* Stats */}
          {filledScores.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Rata-rata', value: avg?.toFixed(1), icon: TrendingUp,   color: 'text-brand-600',   bg: 'bg-brand-50' },
                { label: 'Tertinggi', value: highest,         icon: TrendingUp,   color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Terendah',  value: lowest,          icon: TrendingDown, color: 'text-rose-600',    bg: 'bg-rose-50' },
              ].map(s => {
                const Icon = s.icon
                return (
                  <div key={s.label} className="card px-5 py-3.5 flex items-center gap-3">
                    <div className={`${s.bg} p-2 rounded-xl`}><Icon size={16} className={s.color} /></div>
                    <div>
                      <div className={`font-display text-xl font-bold ${s.color}`}>{s.value ?? '—'}</div>
                      <div className="text-xs text-slate-500">{s.label} · {filledScores.length} siswa</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Grade table */}
          <div className="card overflow-hidden">
            {/* Desktop header */}
            <div className="hidden md:flex items-center bg-slate-50 border-b border-slate-100 px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide gap-0">
              <div className="w-8 shrink-0" />
              <div className="flex-1 min-w-0 pr-4">Nama Siswa</div>
              <div className="w-28 shrink-0 text-center">Nilai (0–100)</div>
              <div className="w-10 shrink-0 text-center">Grade</div>
              <div className="flex-1 min-w-0 pl-4">Catatan / Komentar</div>
            </div>

            {loading ? (
              <div className="flex justify-center py-16"><Loader2 size={28} className="text-brand-500 animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <Users size={40} className="mx-auto mb-3 opacity-30" />
                <p>Tidak ada siswa</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {filtered.map((s, i) => {
                  const g     = grades[s.id] || { score: '', remarks: '' }
                  const badge = scoreBadge(g.score)
                  return (
                    <div key={s.id}
                      className="px-5 transition-colors hover:bg-slate-50/70
                        py-3 flex flex-col gap-2
                        md:flex-row md:items-center md:py-2.5 md:gap-0">

                      {/* num */}
                      <div className="hidden md:flex w-8 shrink-0 text-xs text-slate-300 justify-end pr-2">{i + 1}</div>

                      {/* student */}
                      <div className="flex items-center gap-3 flex-1 min-w-0 md:pr-4">
                        <span className="md:hidden text-xs text-slate-300 w-5 shrink-0">{i + 1}</span>
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0
                          ${s.gender === 'L' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                          {s.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 text-sm leading-tight truncate">{s.name}</p>
                          <p className="text-xs text-slate-400">Kelas {s.class}</p>
                        </div>
                        {/* mobile: show score badge */}
                        {badge && (
                          <span className={`md:hidden ml-auto text-xs font-bold px-2 py-0.5 rounded-lg ${badge.cls}`}>{badge.label} · {g.score}</span>
                        )}
                      </div>

                      {/* score input */}
                      <div className="flex items-center gap-2 md:w-28 md:shrink-0 md:px-2">
                        <input type="number" min="0" max="100" value={g.score}
                          onChange={e => setField(s.id, 'score', e.target.value)}
                          className={`input text-center font-bold text-sm py-1.5 w-full md:w-24 ${scoreColor(g.score)}`}
                          placeholder="—" />
                      </div>

                      {/* grade badge desktop */}
                      <div className="hidden md:flex w-10 shrink-0 justify-center">
                        {badge
                          ? <span className={`text-xs font-bold px-1.5 py-0.5 rounded-lg ${badge.cls}`}>{badge.label}</span>
                          : <span className="text-slate-200">—</span>
                        }
                      </div>

                      {/* remarks */}
                      <div className="md:flex-1 md:min-w-0 md:pl-4">
                        <input value={g.remarks} onChange={e => setField(s.id, 'remarks', e.target.value)}
                          placeholder="Catatan / komentar..." className="input text-xs py-1.5 w-full" />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Grade legend */}
          <div className="flex items-center gap-3 flex-wrap text-xs text-slate-500">
            <span className="font-medium">Grade:</span>
            {[['A','≥85','bg-emerald-100 text-emerald-700'],['B','70–84','bg-brand-100 text-brand-700'],['C','60–69','bg-amber-100 text-amber-700'],['D','<60','bg-rose-100 text-rose-700']].map(([g,r,c])=>(
              <span key={g} className={`px-2 py-0.5 rounded-lg font-semibold ${c}`}>{g} ({r})</span>
            ))}
          </div>

          <div className="flex justify-end pb-4">
            <button onClick={handleSave} disabled={saving}
              className={`btn-primary flex items-center gap-2 px-8 ${saved ? '!bg-emerald-500' : ''}`}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {saving ? 'Menyimpan...' : saved ? '✓ Tersimpan!' : 'Simpan Nilai'}
            </button>
          </div>
        </>
      )}

      {/* ════════════════ TAB: REKAP ════════════════ */}
      {tab === 'rekap' && (
        <>
          {/* Rekap filters */}
          <div className="card p-4 flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[140px]">
              <label className="label">Mata Pelajaran</label>
              <input className="input" value={rekapSubject} onChange={e => setRekapSubject(e.target.value)}
                placeholder="Matematika..." list="rek-subjects" />
              <datalist id="rek-subjects">{subjects.map(s => <option key={s} value={s} />)}</datalist>
            </div>
            <div>
              <label className="label">Kelas</label>
              <select className="input w-auto" value={rekapKelas} onChange={e => setRekapKelas(e.target.value)}>
                <option value="all">Semua Kelas</option>
                {classes.map(c => <option key={c} value={c}>Kelas {c}</option>)}
              </select>
            </div>
            <button onClick={loadRekap} disabled={!rekapSubject} className="btn-primary flex items-center gap-2">
              <BarChart2 size={15} /> Tampilkan Rekap
            </button>
          </div>

          {rekapLoading ? (
            <div className="flex justify-center py-20"><Loader2 size={28} className="text-brand-500 animate-spin" /></div>
          ) : rekapData.length === 0 ? (
            <div className="card text-center py-16 text-slate-400">
              <FileText size={40} className="mx-auto mb-3 opacity-30" />
              <p>Pilih mata pelajaran lalu klik Tampilkan Rekap</p>
            </div>
          ) : (
            <>
              {/* Summary stats */}
              {rekapData.filter(r => r.count > 0).length > 0 && (() => {
                const avgs    = rekapData.filter(r => r.avg !== null).map(r => r.avg)
                const classAvg = avgs.length ? avgs.reduce((a, v) => a + v, 0) / avgs.length : null
                const countA   = rekapData.filter(r => r.avg !== null && r.avg >= 85).length
                const countD   = rekapData.filter(r => r.avg !== null && r.avg < 60).length
                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Rata-rata Kelas', value: classAvg?.toFixed(1) ?? '—', color: 'text-brand-600',   bg: 'bg-brand-50',   icon: TrendingUp   },
                      { label: 'Penilaian',        value: rekapCols.length,             color: 'text-slate-700',  bg: 'bg-slate-50',   icon: BookOpen     },
                      { label: 'Nilai A (≥85)',     value: countA,                       color: 'text-emerald-600',bg: 'bg-emerald-50', icon: TrendingUp   },
                      { label: 'Perlu Perhatian',   value: countD,                       color: 'text-rose-600',  bg: 'bg-rose-50',    icon: TrendingDown },
                    ].map(s => {
                      const Icon = s.icon
                      return (
                        <div key={s.label} className="card p-4 flex items-center gap-3">
                          <div className={`${s.bg} p-2.5 rounded-xl`}><Icon size={18} className={s.color} /></div>
                          <div>
                            <div className={`font-display text-2xl font-bold ${s.color}`}>{s.value}</div>
                            <div className="text-xs text-slate-500">{s.label}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}

              {/* Rekap table */}
              <div className="card overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                  <BarChart2 size={15} className="text-brand-500" />
                  <h3 className="font-display font-bold text-slate-800">
                    Rekap Nilai — {rekapSubject}
                    {rekapKelas !== 'all' && <span className="text-slate-400 font-normal ml-1.5">Kelas {rekapKelas}</span>}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="text-sm min-w-max w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-xs font-semibold uppercase tracking-wide">
                        <th className="px-4 py-3 text-left text-slate-500 sticky left-0 bg-slate-50 z-10 min-w-[180px]">Nama Siswa</th>
                        {rekapCols.map((c, i) => (
                          <th key={i} className="px-3 py-3 text-center text-slate-500 min-w-[90px]">
                            <div className="font-bold text-slate-700">{c.name || 'Penilaian'}</div>
                            <div className="font-normal text-slate-400 normal-case text-xs">
                              {new Date(c.date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                            </div>
                          </th>
                        ))}
                        <th className="px-3 py-3 text-center text-brand-600">Rata-rata</th>
                        <th className="px-3 py-3 text-center text-slate-500">Grade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {rekapData.map(r => {
                        const badge = r.avg !== null ? scoreBadge(r.avg) : null
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
                            {rekapCols.map((c, i) => {
                              const key = c.date + '||' + c.name
                              const val = r.cells[key]
                              return (
                                <td key={i} className="px-3 py-3 text-center">
                                  {val != null
                                    ? <span className={`inline-block px-2.5 py-0.5 rounded-lg font-bold text-sm ${scoreColor(val).replace('border-','').replace('bg-','bg-').split(' ').filter(c => c.startsWith('bg-') || c.startsWith('text-')).join(' ')}`}>{val}</span>
                                    : <span className="text-slate-200 text-sm">—</span>
                                  }
                                </td>
                              )
                            })}
                            <td className="px-3 py-3 text-center">
                              {r.avg !== null
                                ? <span className={`font-bold text-sm ${scoreColor(r.avg).split(' ').filter(c => c.startsWith('text-')).join(' ')}`}>{r.avg.toFixed(1)}</span>
                                : <span className="text-slate-300">—</span>
                              }
                            </td>
                            <td className="px-3 py-3 text-center">
                              {badge
                                ? <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${badge.cls}`}>{badge.label}</span>
                                : <span className="text-slate-200">—</span>
                              }
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 border-t-2 border-slate-200 text-xs font-bold text-slate-700">
                        <td className="px-4 py-3 sticky left-0 bg-slate-50 uppercase tracking-wide">Rata-rata Kelas</td>
                        {rekapCols.map((c, i) => {
                          const key    = c.date + '||' + c.name
                          const scores = rekapData.map(r => r.cells[key]).filter(v => v != null)
                          const colAvg = scores.length ? scores.reduce((a, v) => a + v, 0) / scores.length : null
                          return (
                            <td key={i} className="px-3 py-3 text-center">
                              {colAvg !== null
                                ? <span className={scoreColor(colAvg).split(' ').filter(c=>c.startsWith('text-')).join(' ')}>{colAvg.toFixed(1)}</span>
                                : '—'
                              }
                            </td>
                          )
                        })}
                        <td className="px-3 py-3 text-center text-brand-700">
                          {(() => {
                            const avgs = rekapData.filter(r => r.avg !== null).map(r => r.avg)
                            return avgs.length ? (avgs.reduce((a,v)=>a+v,0)/avgs.length).toFixed(1) : '—'
                          })()}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
