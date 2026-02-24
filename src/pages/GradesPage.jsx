import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { BookOpen, Plus, Trash2, Save, Loader2, Filter, ChevronLeft, ChevronRight } from 'lucide-react'

const toISO = d => d.toISOString().slice(0, 10)

export default function GradesPage() {
  const { user } = useAuth()
  const [date,     setDate]    = useState(toISO(new Date()))
  const [subject,  setSubject] = useState('')
  const [kelas,    setKelas]   = useState('all')
  const [students, setStudents]= useState([])
  const [classes,  setClasses] = useState([])
  const [grades,   setGrades]  = useState({}) // {studentId: {score, remarks}}
  const [subjects, setSubjects]= useState([])
  const [loading,  setLoading] = useState(true)
  const [saving,   setSaving]  = useState(false)
  const [saved,    setSaved]   = useState(false)

  useEffect(() => {
    if (!user) return
    supabase.from('students').select('*').eq('teacher_id', user.id).order('class').order('name')
      .then(({ data }) => {
        setStudents(data || [])
        setClasses([...new Set((data || []).map(s => s.class))].sort())
        setLoading(false)
      })
    supabase.from('grades').select('subject').eq('student_id', supabase.auth.getUser ? '' : '')
    // Get distinct subjects from grades table
    supabase.from('schedules').select('subject').eq('teacher_id', user.id)
      .then(({ data }) => {
        const sub = [...new Set((data || []).map(s => s.subject))].sort()
        setSubjects(sub)
        if (sub.length && !subject) setSubject(sub[0])
      })
  }, [user])

  const filtered = kelas === 'all' ? students : students.filter(s => s.class === kelas)

  useEffect(() => {
    if (!filtered.length || !subject || !date) return
    const load = async () => {
      const ids = filtered.map(s => s.id)
      const { data } = await supabase.from('grades').select('student_id, score, remarks')
        .eq('subject', subject).eq('assessment_date', date).in('student_id', ids)
      const map = {}
      ;(data || []).forEach(r => { map[r.student_id] = { score: r.score ?? '', remarks: r.remarks || '' } })
      setGrades(map)
    }
    load()
  }, [date, subject, kelas, students])

  const setField = (id, field, val) => setGrades(p => ({ ...p, [id]: { ...p[id], [field]: val } }))

  const scoreColor = v => {
    const n = Number(v)
    if (!v && v !== 0) return 'border-slate-200'
    if (n >= 85) return 'border-emerald-400 bg-emerald-50'
    if (n >= 70) return 'border-brand-400 bg-brand-50'
    if (n >= 60) return 'border-amber-400 bg-amber-50'
    return 'border-rose-400 bg-rose-50'
  }

  const handleSave = async () => {
    if (!subject) return alert('Pilih mata pelajaran terlebih dahulu')
    setSaving(true)
    const records = filtered.filter(s => grades[s.id]?.score !== '' && grades[s.id]?.score != null).map(s => ({
      student_id: s.id, subject, score: Number(grades[s.id].score),
      remarks: grades[s.id].remarks || null, assessment_date: date,
    }))
    await supabase.from('grades').upsert(records, { onConflict: 'student_id,subject,assessment_date' })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  const shiftDate = n => { const d = new Date(date); d.setDate(d.getDate() + n); setDate(toISO(d)) }

  const avg = Object.values(grades).filter(g => g.score !== '').reduce((a, g, _, arr) => a + Number(g.score) / arr.length, 0)

  return (
    <div className="space-y-5 animate-fadeUp">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-800">Penilaian Harian</h1>
        <p className="text-slate-500 text-sm">Input nilai dan catatan per siswa</p>
      </div>

      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">Tanggal</label>
          <div className="flex items-center gap-1">
            <button onClick={() => shiftDate(-1)} className="p-2 hover:bg-slate-100 rounded-lg"><ChevronLeft size={16} /></button>
            <input type="date" className="input w-auto" value={date} onChange={e => setDate(e.target.value)} />
            <button onClick={() => shiftDate(1)} className="p-2 hover:bg-slate-100 rounded-lg"><ChevronRight size={16} /></button>
          </div>
        </div>
        <div className="flex-1 min-w-[150px]">
          <label className="label">Mata Pelajaran</label>
          <div className="flex gap-2">
            <input className="input" value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="Matematika, IPA..." list="subjects-list" />
            <datalist id="subjects-list">{subjects.map(s => <option key={s} value={s} />)}</datalist>
          </div>
        </div>
        <div>
          <label className="label">Kelas</label>
          <select className="input w-auto" value={kelas} onChange={e => setKelas(e.target.value)}>
            <option value="all">Semua</option>
            {classes.map(c => <option key={c} value={c}>Kelas {c}</option>)}
          </select>
        </div>
        {Object.keys(grades).length > 0 && (
          <div className="text-center">
            <div className="text-xs text-slate-400">Rata-rata</div>
            <div className="font-display text-xl font-bold text-brand-600">{avg.toFixed(1)}</div>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 size={28} className="text-brand-500 animate-spin" /></div>
        ) : (
          <>
            <div className="grid grid-cols-[auto_1fr_100px_1fr] gap-0 bg-slate-50 px-4 py-2.5 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <div className="w-8">#</div>
              <div>Nama Siswa</div>
              <div className="text-center">Nilai (0-100)</div>
              <div className="pl-3">Catatan</div>
            </div>
            <div className="divide-y divide-slate-50">
              {filtered.map((s, i) => {
                const g = grades[s.id] || { score: '', remarks: '' }
                return (
                  <div key={s.id} className="grid grid-cols-[auto_1fr_100px_1fr] gap-0 items-center px-4 py-2.5 hover:bg-slate-50/60">
                    <span className="text-xs text-slate-300 w-8">{i+1}</span>
                    <div>
                      <p className="font-semibold text-sm text-slate-800">{s.name}</p>
                      <p className="text-xs text-slate-400">Kelas {s.class}</p>
                    </div>
                    <div className="px-2">
                      <input type="number" min="0" max="100" value={g.score}
                        onChange={e => setField(s.id, 'score', e.target.value)}
                        className={`input text-center font-bold text-sm py-1.5 ${scoreColor(g.score)}`}
                        placeholder="—" />
                    </div>
                    <div className="pl-3">
                      <input value={g.remarks} onChange={e => setField(s.id, 'remarks', e.target.value)}
                        className="input text-xs py-1.5" placeholder="Catatan (opsional)" />
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      <div className="flex justify-end pb-4">
        <button onClick={handleSave} disabled={saving} className={`btn-primary flex items-center gap-2 px-8 ${saved ? '!bg-emerald-500' : ''}`}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? 'Menyimpan...' : saved ? '✓ Tersimpan!' : 'Simpan Nilai'}
        </button>
      </div>
    </div>
  )
}
