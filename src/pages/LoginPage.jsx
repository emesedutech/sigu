import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { GraduationCap, Mail, Lock, Eye, EyeOff, User, School, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const { signIn, signUp } = useAuth()
  const [mode,     setMode]     = useState('login') // 'login' | 'register'
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [school,   setSchool]   = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [success,  setSuccess]  = useState('')

  const handle = async (e) => {
    e.preventDefault()
    setError(''); setSuccess(''); setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password)
        if (error) setError(error.message)
      } else {
        const { error } = await signUp(email, password, fullName, school)
        if (error) setError(error.message)
        else setSuccess('Akun berhasil dibuat! Cek email Anda untuk konfirmasi, lalu login.')
      }
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-600 via-brand-700 to-slate-900 flex items-center justify-center p-4">
      {/* Background decorative circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-brand-400/20 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm animate-fadeUp">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur rounded-2xl mb-4 shadow-xl">
            <GraduationCap size={32} className="text-white" />
          </div>
          <h1 className="font-display text-2xl font-bold text-white">Asisten Guru Pintar</h1>
          <p className="text-brand-200 text-sm mt-1">Platform manajemen kelas modern</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <div className="flex bg-slate-100 rounded-xl p-1 mb-6">
            {['login','register'].map((m) => (
              <button key={m} onClick={() => { setMode(m); setError(''); setSuccess('') }}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200
                  ${mode === m ? 'bg-white shadow text-brand-600' : 'text-slate-500 hover:text-slate-700'}`}>
                {m === 'login' ? 'Masuk' : 'Daftar'}
              </button>
            ))}
          </div>

          <form onSubmit={handle} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="label">Nama Lengkap</label>
                  <div className="relative">
                    <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input className="input pl-10" placeholder="Budi Santoso, S.Pd"
                      value={fullName} onChange={e => setFullName(e.target.value)} required />
                  </div>
                </div>
                <div>
                  <label className="label">Nama Sekolah</label>
                  <div className="relative">
                    <School size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input className="input pl-10" placeholder="SDN 01 Maju Bersama"
                      value={school} onChange={e => setSchool(e.target.value)} />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="input pl-10" type="email" placeholder="guru@sekolah.com"
                  value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="input pl-10 pr-10" type={showPw ? 'text' : 'password'}
                  placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
                  required minLength={6} />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-rose-50 text-rose-700 rounded-xl p-3 text-sm">
                <AlertCircle size={15} className="shrink-0 mt-0.5" /> {error}
              </div>
            )}
            {success && (
              <div className="bg-emerald-50 text-emerald-700 rounded-xl p-3 text-sm">{success}</div>
            )}

            <button type="submit" className="btn-primary w-full mt-2 flex items-center justify-center gap-2" disabled={loading}>
              {loading ? (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
              ) : mode === 'login' ? 'Masuk ke Akun' : 'Buat Akun'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
