# MathPairs (Next.js + Tailwind + Supabase) 🧠🎴

Media pembelajaran matematika interaktif untuk siswa kelas 6 SD dengan integrasi database **Supabase Cloud**.

---

## 🌟 Fitur Utama
1. **Next.js 14 (App Router) + Tailwind CSS**: Desain UI modern, responsif, dan animasi 3D flip kartu.
2. **Integrasi Supabase Cloud**:
   - `players`: Menyimpan identitas siswa.
   - `player_level_scores`: Menyimpan skor tertinggi, perolehan bintang, moves, dan waktu per level.
   - `game_sessions`: Riwayat setiap sesi permainan.
   - `leaderboard_view`: Leaderboard otomatis yang diagregasi di database Supabase.
3. **Smart Offline Fallback**: Jika kredensial Supabase belum diisi, game tetap dapat dimainkan menggunakan penyimpanan lokal (`localStorage`) tanpa error.
4. **10 Level Bertahap Anti-Ambiguitas**: Menggunakan formula matematika unik per pasangan agar setiap soal tepat memiliki 1 pasangan.
5. **Efek Audio & Confetti**: Efek suara sintetis (Web Audio API) dan ledakan confetti saat menyelesaikan level.

---

## 🛠️ Langkah Menghubungkan ke Supabase

### 1. Buat Project di Supabase
1. Masuk ke [supabase.com](https://supabase.com) dan buat project baru.
2. Buka menu **SQL Editor** di dashboard Supabase.
3. Buka file [supabase-schema.sql](file:///d:/Latihan/simpleMathMatch/supabase-schema.sql), salin seluruh isinya, tempel ke SQL Editor Supabase, lalu klik **RUN**.

### 2. Atur Kredensial di `.env.local`
1. Buka menu **Project Settings -> API** di Supabase.
2. Salin **Project URL** dan **Project API Keys (`anon` / `public`)**.
3. Buka file [.env.local](file:///d:/Latihan/simpleMathMatch/.env.local) lalu isi:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```

---

## 🚀 Menjalankan Aplikasi

Jalankan perintah berikut di terminal:

```bash
# Menjalankan server development
npm run dev
```

Buka browser di [http://localhost:3000](http://localhost:3000).
