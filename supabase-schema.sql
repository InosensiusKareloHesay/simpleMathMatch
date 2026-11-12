-- ==============================================================
-- Skema Database Supabase MathPairs (Dengan Kolom Password)
-- Jalankan ini di SQL Editor Supabase
-- ==============================================================

-- 1. Data pemain (menambahkan kolom password)
CREATE TABLE IF NOT EXISTS public.players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name TEXT NOT NULL UNIQUE,
    password TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jika tabel players sudah terlanjur dibuat sebelumnya, tambahkan kolom password:
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS password TEXT;

-- 2. Skor terbaik setiap pemain pada setiap level
CREATE TABLE IF NOT EXISTS public.player_level_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    level_number INTEGER NOT NULL CHECK (level_number BETWEEN 1 AND 10),
    best_score INTEGER NOT NULL DEFAULT 0,
    best_moves INTEGER NOT NULL DEFAULT 0,
    best_time_seconds INTEGER NOT NULL DEFAULT 0,
    achieved_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (player_id, level_number)
);

-- 3. Riwayat permainan
CREATE TABLE IF NOT EXISTS public.game_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    level_number INTEGER NOT NULL CHECK (level_number BETWEEN 1 AND 10),
    score INTEGER NOT NULL DEFAULT 0,
    moves INTEGER NOT NULL DEFAULT 0,
    time_seconds INTEGER NOT NULL DEFAULT 0,
    completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_level_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

-- Policy tabel players
DROP POLICY IF EXISTS "Public Read Players" ON public.players;
CREATE POLICY "Public Read Players" ON public.players FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Insert Players" ON public.players;
CREATE POLICY "Public Insert Players" ON public.players FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public Update Players" ON public.players;
CREATE POLICY "Public Update Players" ON public.players FOR UPDATE USING (true);

-- Policy tabel player_level_scores
DROP POLICY IF EXISTS "Public Read Scores" ON public.player_level_scores;
CREATE POLICY "Public Read Scores" ON public.player_level_scores FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Upsert Scores" ON public.player_level_scores;
CREATE POLICY "Public Upsert Scores" ON public.player_level_scores FOR ALL USING (true);

-- Policy tabel game_sessions
DROP POLICY IF EXISTS "Public Read Sessions" ON public.game_sessions;
CREATE POLICY "Public Read Sessions" ON public.game_sessions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Insert Sessions" ON public.game_sessions;
CREATE POLICY "Public Insert Sessions" ON public.game_sessions FOR INSERT WITH CHECK (true);
