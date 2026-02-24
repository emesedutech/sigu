import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { Heart, ThumbsUp, ThumbsDown, Plus, Trash2, Search, Loader2, X } from 'lucide-react'

const toISO = d => d.toISOString().slice(0, 10)

export default function BehaviorPage() {
  const { user } = useAuth()
  const [logs,     setLogs]    = useState([])
  const [students, setStudents]= useState([])
  const [search,   setSearch]  = useState('')
  const [filter,   setFilter]  = useState('all') // all|positive|negative
  const [modal,    setModal]   = useState(false)
  const [form,     setForm]    = useState({ student_id: '', type: 'positive', description: '', date: toISO(new Date()) })
  const [saving,   setSaving]  = useState(false)
  const [loading,  setLoading] = useState(true)

  const load = async () => {
    const { data: studs } = await supabase.from('students').select('id, name, class').eq('teacher_id', user.id).order('name')
    setStudents(studs || [])
    const ids = (studs || []).map(s => s.id)
    if (!ids.length) { setLoading(false); return }
    const { data } = await supabase.from('behavior_logs').select('*, students(name, class)')
      .in('student_id', ids).order('date', { ascending: false }).order('created_at', { ascending: false })
    setLogs(data || [])
    setLoading(false)
  }

  useEffect(() => { if (user) load() }, [user])

  const filtered = logs.filter(l => {
    const matchType   = filter === 'all' || l.type === filter
    const matchSearch = l.students?.name?.toLowerCase().includes(search.toLowerCase()) ||
      l.description.toLowerCase().includes(search.toLowerCase())
    return matchType && matchSearch
  })

  const handleAdd = async (e) => {
    e.preventDefault(); setSaving(true)
    await supabase.from('behavior_logs').insert(form)
    await load(); setSaving(false); setModal(false)
    setForm({ student_id: '', type: 'positive', description: '', date: toISO(new Date()) })
  }

  const handleDelete = async id => {
    if (!confirm('Hapus catatan ini?')) return
    await supabase.from('behavior_logs').delete().eq('id', id)
    setLogs(p => p.filter(l => l.id !== id))
  }

  return (
    <div className="space-y-5 animate-fadeUp">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-800">Jurnal Sikap</h1>
          <p className="text-slate-500 text-sm">Catat perilaku positif dan negatif siswa</p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={15} /> Tambah Catatan
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Catatan', value: logs.length,                                           color: 'bg-slate-50', text: 'text-slate-700', icon: Heart },
          { label: 'Positif',       value: logs.filter(l => l.type === 'positive').length,        color: 'bg-emerald-50', text: 'text-emerald-700', icon: ThumbsUp },
          { label: 'Negatif',       value: logs.filter(l => l.type === 'negative').length,        color: 'bg-rose-50', text: 'text-rose-700', icon: ThumbsDown },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className={`card p-4 flex items-center gap-3 ${s.color}`}>
              <Icon size={20} className={s.text} />
              <div>
                <div className={`font-display text-2xl font-bold ${s.text}`}>{s.value}</div>
                <div className="text-xs text-slate-500">{s.label}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-10" placeholder="Cari siswa atau catatan..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex bg-white border border-slate-200 rounded-xl overflow-hidden">
          {[['all','Semua'],['positive','Positif'],['negative','Negatif']].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`px-4 py-2 text-sm font-medium transition-colors
                ${filter === v ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Log list */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 size={28} className="text-brand-500 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-16 text-slate-400">
            <Heart size={40} className="mx-auto mb-3 opacity-30" />
            <p>Belum ada catatan sikap</p>
          </div>
        ) : (
          filtered.map(l => (
            <div key={l.id} className="card p-4 flex items-start gap-4 hover:shadow-md transition-shadow">
              <div className={`p-2.5 rounded-xl shrink-0 ${l.type === 'positive' ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                {l.type === 'positive'
                  ? <ThumbsUp size={18} className="text-emerald-600" />
                  : <ThumbsDown size={18} className="text-rose-600" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-semibold text-slate-800">{l.students?.name}</span>
                    <span className="text-xs text-slate-400 ml-2">Kelas {l.students?.class}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-slate-400">{new Date(l.date).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' })}</span>
                    <button onClick={() => handleDelete(l.id)} className="p-1 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-500 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-slate-600 mt-1">{l.description}</p>
                <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mt-2
                  ${l.type === 'positive' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  {l.type === 'positive' ? 'Positif' : 'Negatif'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fadeUp">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="font-display font-bold text-slate-800">Tambah Catatan Sikap</h2>
              <button onClick={() => setModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
            </div>
            <form onSubmit={handleAdd} className="p-6 space-y-4">
              <div>
                <label className="label">Siswa *</label>
                <select className="input" required value={form.student_id} onChange={e => setForm({...form, student_id: e.target.value})}>
                  <option value="">-- Pilih Siswa --</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name} - Kelas {s.class}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Jenis Sikap</label>
                <div className="flex gap-3">
                  {[['positive','👍 Positif'],['negative','👎 Negatif']].map(([v,l]) => (
                    <button key={v} type="button" onClick={() => setForm({...form, type: v})}
                      className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold transition-colors
                        ${form.type === v
                          ? v === 'positive' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-rose-500 bg-rose-50 text-rose-700'
                          : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Deskripsi *</label>
                <textarea className="input resize-none" rows={3} required
                  value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                  placeholder="Contoh: Membantu teman yang kesulitan memahami pelajaran..." />
              </div>
              <div>
                <label className="label">Tanggal</label>
                <input type="date" className="input" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1">Batal</button>
                <button type="submit" className="btn-primary flex-1" disabled={saving}>
                  {saving ? 'Menyimpan...' : 'Simpan Catatan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
