import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import {
  Users, ClipboardCheck, BookOpen, Calendar,
  TrendingUp, Clock, CheckCircle2, XCircle, Activity
} from 'lucide-react'

const TODAY = new Date().toISOString().slice(0, 10)
const DAYS  = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu']
const dayIdx = new Date().getDay() + 1 // 1=Mon ... 7=Sun, but JS getDay() 0=Sun

export default function DashboardPage({ setPage }) {
  const { user, profile } = useAuth()
  const [stats, setStats]     = useState({ students: 0, hadir: 0, alpa: 0, sakit: 0, izin: 0 })
  const [schedule, setSchedule] = useState([])
  const [recent, setRecent]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const jsDay = new Date().getDay() // 0=Sun
      const dbDay = jsDay === 0 ? 7 : jsDay

      const [stuRes, attRes, schRes] = await Promise.all([
        supabase.from('students').select('id', { count: 'exact' }).eq('teacher_id', user.id),
        supabase.from('attendance').select('status, students!inner(teacher_id)')
          .eq('date', TODAY).eq('students.teacher_id', user.id),
        supabase.from('schedules').select('*').eq('teacher_id', user.id).eq('day_of_week', dbDay).order('start_time'),
      ])

      const att = attRes.data || []
      setStats({
        students: stuRes.count || 0,
        hadir:  att.filter(a => a.status === 'Hadir').length,
        alpa:   att.filter(a => a.status === 'Alpa').length,
        sakit:  att.filter(a => a.status === 'Sakit').length,
        izin:   att.filter(a => a.status === 'Izin').length,
      })
      setSchedule(schRes.data || [])
      setLoading(false)
    })()
  }, [user])

  const fmt = t => {
    if (!t) return ''
    const [h, m] = t.split(':')
    return `${h}:${m}`
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 11) return 'Selamat Pagi'
    if (h < 15) return 'Selamat Siang'
    if (h < 18) return 'Selamat Sore'
    return 'Selamat Malam'
  }

  return (
    <div className="space-y-6 animate-fadeUp">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-600 to-brand-700 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute right-0 top-0 w-48 h-48 bg-white/5 rounded-full -translate-y-12 translate-x-12" />
        <div className="relative">
          <p className="text-brand-200 text-sm font-medium">{greeting()},</p>
          <h1 className="font-display text-2xl font-bold mt-0.5">{profile?.full_name || 'Guru'} 👋</h1>
          <p className="text-brand-200 text-sm mt-1">
            {DAYS[new Date().getDay()]}, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Siswa',  value: stats.students, icon: Users,         color: 'bg-brand-50 text-brand-600',   action: () => setPage('students') },
          { label: 'Hadir Hari Ini', value: stats.hadir, icon: CheckCircle2,  color: 'bg-emerald-50 text-emerald-600', action: () => setPage('attendance') },
          { label: 'Alpa',          value: stats.alpa,   icon: XCircle,       color: 'bg-rose-50 text-rose-600',      action: () => setPage('attendance') },
          { label: 'Sakit/Izin',    value: stats.sakit + stats.izin, icon: Activity, color: 'bg-amber-50 text-amber-600', action: () => setPage('attendance') },
        ].map(s => {
          const Icon = s.icon
          return (
            <button key={s.label} onClick={s.action}
              className="card p-5 text-left hover:shadow-md transition-shadow group">
              <div className={`inline-flex p-2.5 rounded-xl mb-3 ${s.color}`}>
                <Icon size={20} />
              </div>
              <div className="font-display text-3xl font-bold text-slate-800">{loading ? '…' : s.value}</div>
              <div className="text-xs text-slate-500 font-medium mt-0.5">{s.label}</div>
            </button>
          )
        })}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Today's schedule */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={16} className="text-brand-500" />
            <h2 className="font-display font-bold text-slate-800">Jadwal Hari Ini</h2>
          </div>
          {schedule.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Calendar size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Tidak ada jadwal hari ini</p>
              <button onClick={() => setPage('schedule')} className="text-xs text-brand-500 hover:underline mt-1">Tambah jadwal →</button>
            </div>
          ) : (
            <div className="space-y-2">
              {schedule.map((s, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="text-center min-w-[52px]">
                    <p className="text-xs font-bold text-brand-600">{fmt(s.start_time)}</p>
                    <p className="text-xs text-slate-400">{fmt(s.end_time)}</p>
                  </div>
                  <div className="w-px h-8 bg-slate-200" />
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{s.subject}</p>
                    {s.class && <p className="text-xs text-slate-400">Kelas {s.class} {s.room ? `• ${s.room}` : ''}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-brand-500" />
            <h2 className="font-display font-bold text-slate-800">Aksi Cepat</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Catat Absensi', icon: ClipboardCheck, page: 'attendance', color: 'border-emerald-200 hover:bg-emerald-50 text-emerald-700' },
              { label: 'Input Nilai',   icon: BookOpen,       page: 'grades',     color: 'border-brand-200 hover:bg-brand-50 text-brand-700' },
              { label: 'Jurnal Sikap',  icon: Activity,     page: 'behavior',   color: 'border-violet-200 hover:bg-violet-50 text-violet-700' },
              { label: 'Tambah Siswa',  icon: Users,          page: 'students',   color: 'border-amber-200 hover:bg-amber-50 text-amber-700' },
            ].map(a => {
              const Icon = a.icon
              return (
                <button key={a.label} onClick={() => setPage(a.page)}
                  className={`border rounded-xl p-4 text-left transition-colors ${a.color}`}>
                  <Icon size={20} className="mb-2" />
                  <p className="text-sm font-semibold leading-tight">{a.label}</p>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
