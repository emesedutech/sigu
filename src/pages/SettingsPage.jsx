import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import {
  Settings, User, School, BookOpen, Plus, Trash2,
  Save, Loader2, CheckCircle2, AlertCircle, GraduationCap, X
} from 'lucide-react'

export default function SettingsPage() {
  const { user, profile } = useAuth()

  // --- Profile state ---
  const [fullName,   setFullName]   = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg,    setProfileMsg]    = useState(null) // {type, text}

  // --- Subjects state ---
  const [subjects,     setSubjects]    = useState([])
  const [newSubject,   setNewSubject]  = useState('')
  const [savingSubj,   setSavingSubj]  = useState(false)
  const [loadingSubj,  setLoadingSubj] = useState(true)

  // populate form from profile
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '')
      setSchoolName(profile.school_name || '')
    }
  }, [profile])

  // load subjects from schedules distinct + dedicated subjects table fallback
  useEffect(() => {
    if (!user) return
    loadSubjects()
  }, [user])

  const loadSubjects = async () => {
    setLoadingSubj(true)
    // Use a dedicated subjects table if exists, otherwise fall back to schedules
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .eq('teacher_id', user.id)
      .order('name')
    if (!error) {
      setSubjects(data || [])
    } else {
      // fallback: get from schedules
      const { data: schData } = await supabase
        .from('schedules').select('subject').eq('teacher_id', user.id)
      const unique = [...new Set((schData || []).map(s => s.subject))].sort()
      setSubjects(unique.map((name, i) => ({ id: i, name, teacher_id: user.id })))
    }
    setLoadingSubj(false)
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setSavingProfile(true)
    setProfileMsg(null)
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, school_name: schoolName })
      .eq('id', user.id)
    setSavingProfile(false)
    if (error) setProfileMsg({ type: 'error', text: error.message })
    else setProfileMsg({ type: 'success', text: 'Profil berhasil disimpan!' })
    setTimeout(() => setProfileMsg(null), 3000)
  }

  const handleAddSubject = async (e) => {
    e.preventDefault()
    if (!newSubject.trim()) return
    setSavingSubj(true)
    const { error } = await supabase
      .from('subjects')
      .insert({ name: newSubject.trim(), teacher_id: user.id })
    setSavingSubj(false)
    if (!error) { setNewSubject(''); loadSubjects() }
  }

  const handleDeleteSubject = async (id) => {
    if (!confirm('Hapus mata pelajaran ini?')) return
    await supabase.from('subjects').delete().eq('id', id)
    loadSubjects()
  }

  const SUBJECT_PRESETS = [
    'Matematika','Bahasa Indonesia','Bahasa Inggris','IPA','IPS',
    'PKn','Agama','Seni Budaya','PJOK','Prakarya','Informatika','Bahasa Daerah'
  ]

  return (
    <div className="space-y-6 animate-fadeUp max-w-2xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-800">Pengaturan</h1>
        <p className="text-slate-500 text-sm">Kelola profil, sekolah, dan daftar mata pelajaran</p>
      </div>

      {/* ── Profil ── */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 bg-brand-50 rounded-xl"><User size={18} className="text-brand-600" /></div>
          <h2 className="font-display font-bold text-slate-800">Profil Guru</h2>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="label">Nama Lengkap</label>
            <input className="input" value={fullName} onChange={e => setFullName(e.target.value)}
              placeholder="Budi Santoso, S.Pd" required />
          </div>
          <div>
            <label className="label">Nama Sekolah</label>
            <div className="relative">
              <School size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input pl-10" value={schoolName} onChange={e => setSchoolName(e.target.value)}
                placeholder="SDN 01 Maju Bersama" />
            </div>
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input bg-slate-50 text-slate-400" value={user?.email || ''} disabled />
            <p className="text-xs text-slate-400 mt-1">Email tidak dapat diubah</p>
          </div>

          {profileMsg && (
            <div className={`flex items-center gap-2 rounded-xl p-3 text-sm
              ${profileMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              {profileMsg.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
              {profileMsg.text}
            </div>
          )}

          <div className="flex justify-end">
            <button type="submit" className="btn-primary flex items-center gap-2" disabled={savingProfile}>
              {savingProfile ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {savingProfile ? 'Menyimpan...' : 'Simpan Profil'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Mata Pelajaran ── */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 bg-violet-50 rounded-xl"><BookOpen size={18} className="text-violet-600" /></div>
          <div>
            <h2 className="font-display font-bold text-slate-800">Daftar Mata Pelajaran</h2>
            <p className="text-xs text-slate-400">Digunakan sebagai autocomplete di penilaian &amp; jadwal</p>
          </div>
        </div>

        {/* Add form */}
        <form onSubmit={handleAddSubject} className="flex gap-2 mb-4">
          <input className="input flex-1" value={newSubject} onChange={e => setNewSubject(e.target.value)}
            placeholder="Tambah mata pelajaran..." list="preset-list" />
          <datalist id="preset-list">
            {SUBJECT_PRESETS.map(s => <option key={s} value={s} />)}
          </datalist>
          <button type="submit" className="btn-primary flex items-center gap-2 shrink-0" disabled={savingSubj}>
            {savingSubj ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Tambah
          </button>
        </form>

        {/* Preset chips */}
        <div className="mb-4">
          <p className="text-xs text-slate-400 mb-2">Tambah dari preset:</p>
          <div className="flex flex-wrap gap-2">
            {SUBJECT_PRESETS.filter(p => !subjects.some(s => s.name === p)).map(p => (
              <button key={p} type="button"
                onClick={() => setNewSubject(p)}
                className="text-xs px-3 py-1 rounded-full border border-dashed border-slate-300 text-slate-500 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50 transition-colors">
                + {p}
              </button>
            ))}
          </div>
        </div>

        {/* Subject list */}
        {loadingSubj ? (
          <div className="flex justify-center py-8"><Loader2 size={20} className="text-brand-500 animate-spin" /></div>
        ) : subjects.length === 0 ? (
          <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-100 rounded-xl">
            <BookOpen size={28} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Belum ada mata pelajaran</p>
            <p className="text-xs mt-1">Tambah dari form di atas atau pilih preset</p>
          </div>
        ) : (
          <div className="space-y-2">
            {subjects.map((s, i) => (
              <div key={s.id || i} className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 rounded-xl group">
                <div className="w-6 h-6 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                  <span className="text-violet-700 text-xs font-bold">{i + 1}</span>
                </div>
                <span className="flex-1 text-sm font-medium text-slate-700">{s.name}</span>
                {s.id && typeof s.id === 'string' && (
                  <button onClick={() => handleDeleteSubject(s.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition-all">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Informasi Aplikasi ── */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-slate-50 rounded-xl"><GraduationCap size={18} className="text-slate-600" /></div>
          <h2 className="font-display font-bold text-slate-800">Tentang Aplikasi</h2>
        </div>
        <div className="space-y-2 text-sm text-slate-600">
          <div className="flex justify-between py-2 border-b border-slate-50">
            <span className="text-slate-400">Aplikasi</span>
            <span className="font-medium">Asisten Guru Pintar</span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-50">
            <span className="text-slate-400">Versi</span>
            <span className="font-medium">1.0.0</span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-50">
            <span className="text-slate-400">Database</span>
            <span className="font-medium">Supabase PostgreSQL</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-slate-400">User ID</span>
            <span className="font-mono text-xs text-slate-400">{user?.id?.slice(0, 16)}...</span>
          </div>
        </div>
      </div>

      {/* SQL note for subjects table */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <p className="font-semibold mb-1">⚠️ Jalankan SQL ini di Supabase jika belum:</p>
        <pre className="text-xs bg-amber-100 rounded-lg p-3 overflow-x-auto font-mono">{`CREATE TABLE IF NOT EXISTS subjects (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_id, name)
);
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subjects_owner" ON subjects
  FOR ALL USING (auth.uid() = teacher_id);`}</pre>
      </div>
    </div>
  )
}
