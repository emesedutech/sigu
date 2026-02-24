# 🎓 Asisten Guru Pintar

Aplikasi manajemen kelas modern untuk guru — absensi, penilaian, jurnal sikap, dan jadwal dalam satu platform.

## 🚀 Setup & Deploy (5 Menit)

### 1. Clone & Install

```bash
git clone https://github.com/USERNAME/asisten-guru-pintar.git
cd asisten-guru-pintar
npm install
```

### 2. Buat Proyek Supabase

1. Buka [app.supabase.com](https://app.supabase.com) → **New Project**
2. Masuk ke **SQL Editor** → jalankan isi file `supabase_schema.sql`
3. Pergi ke **Settings → API**, salin:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon / public key** → `VITE_SUPABASE_ANON_KEY`

### 3. Setup Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```
VITE_SUPABASE_URL=https://xxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

### 4. Jalankan Lokal

```bash
npm run dev
# Buka http://localhost:5173
```

### 5. Deploy ke Vercel

```bash
# Push ke GitHub dulu
git add .
git commit -m "initial commit"
git push

# Kemudian di Vercel:
# 1. vercel.com → New Project → Import dari GitHub
# 2. Settings → Environment Variables → tambahkan:
#    VITE_SUPABASE_URL  = (nilai dari Supabase)
#    VITE_SUPABASE_ANON_KEY = (nilai dari Supabase)
# 3. Deploy!
```

### 6. Konfigurasi Supabase Auth (wajib untuk produksi)

Di Supabase → **Authentication → URL Configuration**:
- **Site URL**: `https://nama-app.vercel.app`
- **Redirect URLs**: `https://nama-app.vercel.app/**`

---

## 📋 Fitur

| Fitur | Deskripsi |
|-------|-----------|
| 🔐 Auth | Login/Register guru via Supabase Auth |
| 📊 Dashboard | Statistik hari ini + jadwal aktif |
| 👨‍🎓 Siswa | CRUD + import bulk dari CSV |
| ✅ Absensi | Hadir/Izin/Sakit/Alpa dengan filter tanggal & kelas |
| 📝 Penilaian | Input nilai harian per mata pelajaran |
| 💛 Jurnal Sikap | Catat perilaku positif/negatif siswa |
| 📅 Jadwal | Manajemen jadwal mengajar mingguan |

## 🛡️ Keamanan

- Row Level Security (RLS) aktif di semua tabel
- Setiap guru hanya bisa mengakses data miliknya sendiri
- Kunci `anon` digunakan di frontend (aman dengan RLS)
- Jangan pernah gunakan kunci `service_role` di frontend

## 📁 Struktur Proyek

```
src/
├── components/layout/   Layout, Sidebar
├── context/             AuthContext (Supabase session)
├── lib/                 supabaseClient.js
└── pages/
    ├── LoginPage.jsx
    ├── DashboardPage.jsx
    ├── StudentsPage.jsx     ← CSV import ada di sini
    ├── AttendancePage.jsx
    ├── GradesPage.jsx
    ├── BehaviorPage.jsx
    └── SchedulePage.jsx
```
