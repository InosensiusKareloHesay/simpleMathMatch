import './globals.css';

export const metadata = {
  title: 'MathPairs - Game Edukasi Matematika Siswa Kelas 6 SD',
  description: 'Media pembelajaran matematika interaktif berbasis web dengan Supabase & Next.js',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700&family=Quicksand:wght@500;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased selection:bg-indigo-500 selection:text-white" style={{ fontFamily: "'Fredoka', 'Quicksand', sans-serif" }}>
        {children}
      </body>
    </html>
  );
}

