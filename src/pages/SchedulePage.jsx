import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { Calendar, Plus, Trash2, X, Loader2 } from 'lucide-react'

const DAYS = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
const DAY_COLORS = ['','bg-brand-50 border-brand-200','bg-violet-50 border-violet-200','bg-emerald-50 border-emerald-200','bg-amber-50 border-amber-200','bg-rose-50 border-rose-200','bg-sky-50 border-sky-200','bg-slate-50 border-slate-200']
const DAY_TEXT   = ['','text-brand-700','text-violet-700','text-emerald-700','text-amber-700','text-rose-700','text-sky-700','text-slate-700']

export default function SchedulePage() {
  const { user } = useAuth()
  const [schedules, setSchedules] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [modal,     setModal]     = useState(false)
  const [form,      setForm]      = useState({ day_of_week: 1, subject: '', class: '', start_time: '07:00', end_time: '08:30', room: '' })
  const [saving,    setSaving]    = useState(false)

  const load = async () => {
    const { data } = await supabase.from('schedules').select('*').eq('teacher_id', user.id).order('day_of_week').order('start_time')
    setSchedules(data || [])
    setLoading(false)
  }
  useEffect(() => { if (user) load() }, [user])

  const handleAdd = async (e) => {
    e.preventDefault(); setSaving(true)
    await supabase.from('schedules').insert({ ...form, teacher_id: user.id })
    await load(); setSaving(false); setModal(false)
    setForm({ day_of_week: 1, subject: '', class: '', start_time: '07:00', end_time: '08:30', room: '' })
  }

  const handleDelete = async id => {
    if (!confirm('Hapus jadwal ini?')) return
    await supabase.from('schedules').delete().eq('id', id)
    setSchedules(p => p.filter(s => s.id !== id))
  }

  const fmt = t => t ? t.slice(0,5) : ''
  const grouped = DAYS.slice(1).map((_, i) => ({ day: i + 1, items: schedules.filter(s => s.day_of_week === i + 1) }))

  return (
    <div className="space-y-5 animate-fadeUp">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-800">Jadwal Mengajar</h1>
          <p className="text-slate-500 text-sm">Kelola jadwal mingguan Anda</p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={15} /> Tambah Jadwal
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={28} className="text-brand-500 animate-spin" /></div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {grouped.map(({ day, items }) => (
            <div key={day} className={`rounded-2xl border-2 p-4 ${DAY_COLORS[day]}`}>
              <h3 className={`font-display font-bold mb-3 ${DAY_TEXT[day]}`}>{DAYS[day]}</h3>
              {items.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Tidak ada jadwal</p>
              ) : (
                <div className="space-y-2">
                  {items.map(s => (
                    <div key={s.id} className="bg-white rounded-xl p-3 shadow-sm flex items-start gap-3">
                      <div className="text-center min-w-[44px]">
                        <p className={`text-xs font-bold ${DAY_TEXT[day]}`}>{fmt(s.start_time)}</p>
                        <p className="text-xs text-slate-400">{fmt(s.end_time)}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-slate-800 truncate">{s.subject}</p>
                        <p className="text-xs text-slate-400">
                          {s.class && `Kelas ${s.class}`}{s.room && ` · ${s.room}`}
                        </p>
                      </div>
                      <button onClick={() => handleDelete(s.id)} className="p-1 hover:bg-rose-50 rounded text-slate-300 hover:text-rose-500 transition-colors shrink-0">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fadeUp">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="font-display font-bold text-slate-800">Tambah Jadwal</h2>
              <button onClick={() => setModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
            </div>
            <form onSubmit={handleAdd} className="p-6 space-y-4">
              <div>
                <label className="label">Hari *</label>
                <select className="input" value={form.day_of_week} onChange={e => setForm({...form, day_of_week: Number(e.target.value)})}>
                  {DAYS.slice(1).map((d, i) => <option key={i+1} value={i+1}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Mata Pelajaran *</label>
                <input className="input" required value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} placeholder="Matematika" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Kelas</label>
                  <input className="input" value={form.class} onChange={e => setForm({...form, class: e.target.value})} placeholder="7A" />
                </div>
                <div>
                  <label className="label">Ruang</label>
                  <input className="input" value={form.room} onChange={e => setForm({...form, room: e.target.value})} placeholder="R.101" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Mulai *</label>
                  <input type="time" className="input" required value={form.start_time} onChange={e => setForm({...form, start_time: e.target.value})} />
                </div>
                <div>
                  <label className="label">Selesai *</label>
                  <input type="time" className="input" required value={form.end_time} onChange={e => setForm({...form, end_time: e.target.value})} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1">Batal</button>
                <button type="submit" className="btn-primary flex-1" disabled={saving}>
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
