-- Schema SQL untuk MathPairs di Supabase
-- Buka Dashboard Supabase -> SQL Editor -> Tempel query ini lalu klik RUN.

-- 1. Tabel Pemain (players)
CREATE TABLE IF NOT EXISTS public.players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabel Skor Terbaik Pemain per Level (player_level_scores)
CREATE TABLE IF NOT EXISTS public.player_level_scores (
  id BIGSERIAL PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  level INT NOT NULL,
  score INT NOT NULL,
  moves INT NOT NULL,
  time INT NOT NULL, -- dalam detik
  stars INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_player_level UNIQUE (player_id, level)
);

-- 3. Tabel Riwayat Sesi Permainan (game_sessions)
CREATE TABLE IF NOT EXISTS public.game_sessions (
  id BIGSERIAL PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  level INT NOT NULL,
  score INT NOT NULL,
  moves INT NOT NULL,
  time INT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. View Leaderboard Otomatis (diagregasi dari skor terbaik tiap level)
CREATE OR REPLACE VIEW public.leaderboard_view AS
SELECT 
  p.id AS player_id,
  p.name AS player_name,
  COALESCE(SUM(s.score), 0)::INT AS total_score,
  COALESCE(SUM(s.moves), 0)::INT AS total_moves,
  COALESCE(SUM(s.time), 0)::INT AS total_time,
  COUNT(s.level)::INT AS completed_levels
FROM public.players p
LEFT JOIN public.player_level_scores s ON p.id = s.player_id
GROUP BY p.id, p.name
ORDER BY total_score DESC, total_moves ASC, total_time ASC;

-- 5. Aktifkan Row Level Security (RLS) dengan kebijakan publik untuk kemudahan integrasi
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_level_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

-- Kebijakan akses baca dan tulis publik (Anon key)
CREATE POLICY "Public Read Players" ON public.players FOR SELECT USING (true);
CREATE POLICY "Public Insert Players" ON public.players FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Players" ON public.players FOR UPDATE USING (true);

CREATE POLICY "Public Read Scores" ON public.player_level_scores FOR SELECT USING (true);
CREATE POLICY "Public Insert/Update Scores" ON public.player_level_scores FOR ALL USING (true);

CREATE POLICY "Public Insert Sessions" ON public.game_sessions FOR INSERT WITH CHECK (true);

