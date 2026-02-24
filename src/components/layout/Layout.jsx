import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  GraduationCap, LayoutDashboard, Users, ClipboardCheck,
  BookOpen, Heart, Calendar, LogOut, Menu, X, ChevronRight
} from 'lucide-react'

const NAV = [
  { id: 'dashboard',  label: 'Dashboard',    icon: LayoutDashboard },
  { id: 'students',   label: 'Siswa',         icon: Users },
  { id: 'attendance', label: 'Absensi',       icon: ClipboardCheck },
  { id: 'grades',     label: 'Penilaian',     icon: BookOpen },
  { id: 'behavior',   label: 'Jurnal Sikap',  icon: Heart },
  { id: 'schedule',   label: 'Jadwal',        icon: Calendar },
]

export default function Layout({ page, setPage, children }) {
  const { profile, signOut } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const NavLink = ({ item }) => {
    const Icon = item.icon
    const active = page === item.id
    return (
      <button onClick={() => { setPage(item.id); setMobileOpen(false) }}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group
          ${active
            ? 'bg-brand-600 text-white shadow-md shadow-brand-200'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}>
        <Icon size={18} className={active ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'} />
        <span>{item.label}</span>
        {active && <ChevronRight size={14} className="ml-auto text-brand-200" />}
      </button>
    )
  }

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-100">
        <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center shrink-0">
          <GraduationCap size={20} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="font-display font-bold text-sm text-slate-800 leading-tight">Asisten Guru</p>
          <p className="text-xs text-slate-400 truncate">{profile?.school_name || 'Pintar'}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV.map(item => <NavLink key={item.id} item={item} />)}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-slate-100">
        <div className="flex items-center gap-3 px-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
            <span className="text-brand-700 font-bold text-sm">
              {(profile?.full_name || 'G').charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-700 truncate">{profile?.full_name || 'Guru'}</p>
            <p className="text-xs text-slate-400">Guru</p>
          </div>
        </div>
        <button onClick={signOut}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors">
          <LogOut size={15} /> Keluar
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 bg-white border-r border-slate-100 shrink-0">
        <Sidebar />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 h-full bg-white shadow-xl">
            <Sidebar />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile topbar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-100">
          <button onClick={() => setMobileOpen(true)} className="p-1.5 rounded-lg hover:bg-slate-100">
            <Menu size={20} className="text-slate-600" />
          </button>
          <span className="font-display font-bold text-slate-800">
            {NAV.find(n => n.id === page)?.label || 'Dashboard'}
          </span>
        </div>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
