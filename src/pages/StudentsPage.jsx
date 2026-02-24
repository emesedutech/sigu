import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import Papa from 'papaparse'
import {
  Users, Plus, Search, Upload, Trash2, Pencil, X,
  Download, CheckCircle2, AlertCircle, Loader2, Filter
} from 'lucide-react'

const GENDERS = { L: 'Laki-laki', P: 'Perempuan' }
const SAMPLE_CSV = `nisn,name,class,gender\n1234567890,Budi Santoso,7A,L\n0987654321,Siti Rahayu,7A,P`

export default function StudentsPage() {
  const { user } = useAuth()
  const [students, setStudents] = useState([])
  const [search,   setSearch]   = useState('')
  const [filter,   setFilter]   = useState('all')
  const [classes,  setClasses]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [modal,    setModal]    = useState(null) // null | 'add' | 'edit' | 'import'
  const [form,     setForm]     = useState({ nisn: '', name: '', class: '', gender: 'L' })
  const [saving,   setSaving]   = useState(false)
  const [editId,   setEditId]   = useState(null)

  // CSV import state
  const [csvValid,   setCsvValid]   = useState([])
  const [csvInvalid, setCsvInvalid] = useState([])
  const [csvStage,   setCsvStage]   = useState('idle') // idle|preview|importing|done
  const [csvProgress, setCsvProgress] = useState(0)
  const [csvResult,   setCsvResult]   = useState({ inserted: 0, updated: 0, failed: 0 })
  const fileRef = useRef(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('students').select('*')
      .eq('teacher_id', user.id).order('class').order('name')
    setStudents(data || [])
    setClasses([...new Set((data || []).map(s => s.class))].sort())
    setLoading(false)
  }

  useEffect(() => { if (user) load() }, [user])

  const filtered = students.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.nisn || '').includes(search)
    const matchClass  = filter === 'all' || s.class === filter
    return matchSearch && matchClass
  })

  const openAdd  = () => { setForm({ nisn: '', name: '', class: '', gender: 'L' }); setEditId(null); setModal('add') }
  const openEdit = (s)  => { setForm({ nisn: s.nisn || '', name: s.name, class: s.class, gender: s.gender }); setEditId(s.id); setModal('edit') }

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true)
    const payload = { ...form, teacher_id: user.id, nisn: form.nisn || null }
    if (editId) {
      await supabase.from('students').update(payload).eq('id', editId)
    } else {
      await supabase.from('students').insert(payload)
    }
    await load(); setSaving(false); setModal(null)
  }

  const handleDelete = async (id) => {
    if (!confirm('Hapus siswa ini?')) return
    await supabase.from('students').delete().eq('id', id)
    await load()
  }

  // --- CSV ---
  const handleCSV = (file) => {
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      transformHeader: h => h.trim().toLowerCase().replace(/\s+/g, '_'),
      complete: ({ data }) => {
        const valid = []; const invalid = []
        data.forEach((r, i) => {
          if (r.gender) r.gender = String(r.gender).toUpperCase().trim()
          const errs = []
          if (!r.name?.trim()) errs.push('nama kosong')
          if (!r.class?.trim()) errs.push('kelas kosong')
          if (!['L','P'].includes(r.gender)) errs.push('gender harus L/P')
          if (errs.length) invalid.push({ ...r, _errors: errs, _line: i + 2 })
          else valid.push(r)
        })
        setCsvValid(valid); setCsvInvalid(invalid); setCsvStage('preview')
      }
    })
  }

  const runImport = async () => {
    setCsvStage('importing')
    let inserted = 0
    let updated  = 0
    let failed   = 0

    // Fetch existing NISNs for this teacher to decide insert vs update
    const { data: existing } = await supabase
      .from('students')
      .select('id, nisn')
      .eq('teacher_id', user.id)
    const nisnToId = {}
    ;(existing || []).forEach(s => { if (s.nisn) nisnToId[String(s.nisn).trim()] = s.id })

    const toInsert = []
    const toUpdate = []

    csvValid.forEach(r => {
      const nisn = r.nisn ? String(r.nisn).trim() : null
      const row = {
        teacher_id: user.id,
        nisn,
        name:   String(r.name).trim(),
        class:  String(r.class).trim(),
        gender: r.gender,
      }
      if (nisn && nisnToId[nisn]) {
        toUpdate.push({ id: nisnToId[nisn], ...row })
      } else {
        toInsert.push(row)
      }
    })

    // Insert new students in batches of 50
    const BATCH = 50
    for (let i = 0; i < toInsert.length; i += BATCH) {
      const batch = toInsert.slice(i, i + BATCH)
      const { data, error } = await supabase.from('students').insert(batch).select()
      if (!error) inserted += data?.length || 0
      else failed++
      setCsvProgress(Math.round(((i + BATCH) / Math.max(csvValid.length, 1)) * 70))
    }

    // Update existing students one by one (or in batch via upsert with id)
    for (let i = 0; i < toUpdate.length; i++) {
      const { id, ...fields } = toUpdate[i]
      const { error } = await supabase.from('students').update(fields).eq('id', id)
      if (!error) updated++
      else failed++
      setCsvProgress(70 + Math.round(((i + 1) / Math.max(toUpdate.length, 1)) * 30))
    }

    setCsvResult({ inserted, updated, failed })
    setCsvStage('done')
    load()
  }

  const resetCSV = () => { setCsvStage('idle'); setCsvValid([]); setCsvInvalid([]); setCsvProgress(0); setCsvResult({ inserted: 0, updated: 0, failed: 0 }); if (fileRef.current) fileRef.current.value = '' }

  return (
    <div className="space-y-5 animate-fadeUp">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-800">Data Siswa</h1>
          <p className="text-slate-500 text-sm">{students.length} siswa terdaftar</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { resetCSV(); setModal('import') }} className="btn-secondary flex items-center gap-2">
            <Upload size={15} /> Import CSV
          </button>
          <button onClick={openAdd} className="btn-primary flex items-center gap-2">
            <Plus size={15} /> Tambah Siswa
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-10" placeholder="Cari nama atau NISN..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">Semua Kelas</option>
          {classes.map(c => <option key={c} value={c}>Kelas {c}</option>)}
        </select>
      </div>

      {/* Student grid */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={28} className="text-brand-500 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16 text-slate-400">
          <Users size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Belum ada siswa</p>
          <button onClick={openAdd} className="text-sm text-brand-500 hover:underline mt-1">Tambah siswa pertama →</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(s => (
            <div key={s.id} className="card p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold shrink-0
                  ${s.gender === 'L' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                  {s.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{s.name}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-medium">Kelas {s.class}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                      ${s.gender === 'L' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'}`}>
                      {GENDERS[s.gender] || s.gender}
                    </span>
                  </div>
                  {s.nisn && <p className="text-xs text-slate-400 mt-1 font-mono">{s.nisn}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {(modal === 'add' || modal === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fadeUp">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="font-display font-bold text-slate-800">{editId ? 'Edit Siswa' : 'Tambah Siswa'}</h2>
              <button onClick={() => setModal(null)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="label">Nama Lengkap *</label>
                <input className="input" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Budi Santoso" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Kelas *</label>
                  <input className="input" required value={form.class} onChange={e => setForm({...form, class: e.target.value})} placeholder="7A" />
                </div>
                <div>
                  <label className="label">Gender *</label>
                  <select className="input" value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}>
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">NISN</label>
                <input className="input" value={form.nisn} onChange={e => setForm({...form, nisn: e.target.value})} placeholder="0012345678 (opsional)" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1">Batal</button>
                <button type="submit" className="btn-primary flex-1" disabled={saving}>
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {modal === 'import' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-fadeUp">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="font-display font-bold text-slate-800">Import CSV</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => {
                  const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' })
                  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'template_siswa.csv' })
                  a.click()
                }} className="text-xs text-brand-500 flex items-center gap-1 hover:underline">
                  <Download size={12} /> Template
                </button>
                <button onClick={() => { setModal(null); resetCSV() }} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
              </div>
            </div>
            <div className="p-6">
              {csvStage === 'idle' && (
                <div
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-brand-400 rounded-xl p-10 text-center cursor-pointer transition-colors group">
                  <Upload size={32} className="mx-auto text-slate-300 group-hover:text-brand-400 mb-3 transition-colors" />
                  <p className="font-semibold text-slate-600">Klik untuk pilih file CSV</p>
                  <p className="text-xs text-slate-400 mt-1">Kolom: nisn, name, class, gender</p>
                  <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => e.target.files?.[0] && handleCSV(e.target.files[0])} />
                </div>
              )}

              {csvStage === 'preview' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    {[
                      ['Total', csvValid.length + csvInvalid.length, 'text-slate-700 bg-slate-50'],
                      ['Valid', csvValid.length, 'text-emerald-700 bg-emerald-50'],
                      ['Error', csvInvalid.length, 'text-rose-700 bg-rose-50'],
                    ].map(([l, v, c]) => (
                      <div key={l} className={`rounded-xl p-3 ${c}`}>
                        <div className="text-2xl font-bold">{v}</div>
                        <div className="text-xs font-medium">{l}</div>
                      </div>
                    ))}
                  </div>
                  {csvInvalid.length > 0 && (
                    <div className="bg-amber-50 rounded-xl p-3 text-xs text-amber-700 max-h-24 overflow-y-auto">
                      {csvInvalid.map((r,i) => <p key={i}>Baris {r._line}: {r._errors.join(', ')}</p>)}
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button onClick={resetCSV} className="btn-secondary flex-1">Ulang</button>
                    <button onClick={runImport} disabled={!csvValid.length} className="btn-primary flex-1">
                      Import {csvValid.length} Siswa
                    </button>
                  </div>
                </div>
              )}

              {csvStage === 'importing' && (
                <div className="text-center py-8 space-y-3">
                  <Loader2 size={36} className="mx-auto text-brand-500 animate-spin" />
                  <p className="font-semibold text-slate-700">Mengimpor...</p>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div className="bg-brand-500 h-2 rounded-full transition-all" style={{ width: `${csvProgress}%` }} />
                  </div>
                </div>
              )}

              {csvStage === 'done' && (
                <div className="text-center py-8 space-y-4">
                  <CheckCircle2 size={48} className="mx-auto text-emerald-500" />
                  <div>
                    <p className="font-bold text-xl text-slate-800">Import Selesai!</p>
                    <div className="flex justify-center gap-4 mt-3">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-emerald-600">{csvResult.inserted}</div>
                        <div className="text-xs text-slate-500">Siswa baru</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-brand-600">{csvResult.updated}</div>
                        <div className="text-xs text-slate-500">Diperbarui</div>
                      </div>
                      {csvResult.failed > 0 && (
                        <div className="text-center">
                          <div className="text-2xl font-bold text-rose-500">{csvResult.failed}</div>
                          <div className="text-xs text-slate-500">Gagal</div>
                        </div>
                      )}
                    </div>
                  </div>
                  <button onClick={() => { setModal(null); resetCSV() }} className="btn-primary px-8">Tutup</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
