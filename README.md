# MathPairs - Educational Math Memory Game 🧠🎴

Media pembelajaran matematika interaktif untuk siswa kelas 6 SD berbasis web. Menggabungkan konsep **Memory Card Game** dengan latihan operasi hitung matematika (+, −, ×, ÷).

---

## 🎯 Fitur yang Telah Dibuat (Sesuai Konsep MVP)
1. **Login Simpel**: Cukup masukkan nama panggilan tanpa repot email & password.
2. **Dashboard Siswa**: Menampilkan nama pemain, total akumulasi poin, progres level (misal: 3/10), dan navigasi cepat.
3. **10 Level Bertahap**:
   - Level 1: 10 kartu (5 pasang) - Penjumlahan & pengurangan sederhana
   - Level 2: 20 kartu (10 pasang) - Penjumlahan & pengurangan lanjutan
   - Level 3: 30 kartu (15 pasang) - Perkalian dasar
   - Level 4: 40 kartu (20 pasang) - Penjumlahan, pengurangan, perkalian
   - Level 5: 50 kartu (25 pasang) - 4 operasi dasar
   - Level 6 s/d Level 10: Hingga 100 kartu dengan variasi angka lebih besar dan tantangan tinggi
4. **Mekanisme Anti-Ambiguitas**: Setiap pasangan kartu dalam satu sesi dipastikan memiliki hasil unik (*tidak ada kartu dengan hasil sama dari pasangan lain*).
5. **Sistem Move & Timer**:
   - Percobaan (move) dihitung setiap kali 2 kartu dibuka.
   - Timer otomatis mulai ketika kartu pertama dibuka.
6. **Sistem Skor & Bintang (⭐⭐⭐)**: Dihitung menggunakan formula efisiensi langkah dan waktu terhadap skor dasar tiap level.
7. **Penyimpanan Skor Terbaik & Level Unlock**: Menggunakan `localStorage` browser sehingga progres tidak hilang saat halaman di-refresh.
8. **Papan Peringkat (Leaderboard)**: Mengurutkan peringkat berdasarkan total akumulasi skor terbaik, jumlah move, dan total waktu.
9. **Profil Siswa**: Menampilkan statistik lengkap, capaian bintang, dan riwayat skor setiap level.
10. **Efek Audio Sintetis (Web Audio API)**: Suara flip kartu, benar (match), salah (buzzer), dan nada kemenangan saat level selesai tanpa perlu download file mp3.
11. **Tampilan Responsif**: Nyaman dimainkan di laptop, komputer, tablet, maupun layar HP.

---

## 🚀 Cara Menjalankan

Game ini dibuat dengan pendekatan **Zero Dependency & Super Ringan**:
1. Cukup buka file [index.html](file:///d:/Latihan/simpleMathMatch/index.html) langsung dengan klik ganda (double-click) di File Explorer atau buka di browser Chrome/Edge/Firefox.
2. Atau jika menggunakan ekstensi **Live Server** di VS Code, klik kanan `index.html` lalu pilih **Open with Live Server**.

