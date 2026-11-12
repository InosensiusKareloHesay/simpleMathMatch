// src/lib/supabase.js - Disesuaikan dengan Skema Database Supabase User + Password & Real Data Only

import { createClient } from '@supabase/supabase-js';

// Bersihkan format URL dari trailing slash atau path /rest/v1 jika terbawa
let rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/^['"]|['"]$/g, '');
rawUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');

const rawKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim().replace(/^['"]|['"]$/g, '');

const supabaseUrl = rawUrl;
const supabaseAnonKey = rawKey;

export const isSupabaseConfigured = () => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('your-project-id') &&
    supabaseUrl.startsWith('https://')
  );
};

export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * 1. Login atau Daftar Pemain Baru dengan Password
 */
export async function authenticatePlayerInSupabase(displayName, password) {
  if (!supabase || !displayName) return { success: false, error: 'Database belum terhubung' };

  try {
    const cleanName = displayName.trim();
    const cleanPass = password ? password.trim() : '';

    const { data: existing, error: fetchErr } = await supabase
      .from('players')
      .select('*')
      .eq('display_name', cleanName)
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    if (existing) {
      if (existing.password && existing.password !== cleanPass) {
        return {
          success: false,
          error: 'Password salah untuk nama ini! Silakan periksa kembali atau gunakan nama lain.'
        };
      }

      if (!existing.password && cleanPass) {
        await supabase
          .from('players')
          .update({ password: cleanPass })
          .eq('id', existing.id);
      }

      return { success: true, player: existing, isNew: false };
    }

    const { data: newPlayer, error: insertErr } = await supabase
      .from('players')
      .insert({
        display_name: cleanName,
        password: cleanPass
      })
      .select()
      .single();

    if (insertErr) throw insertErr;
    return { success: true, player: newPlayer, isNew: true };
  } catch (err) {
    console.warn('[Supabase] Auth error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 2. Simpan skor level ke Supabase (tabel player_level_scores & game_sessions)
 */
export async function saveLevelScoreToSupabase(playerId, levelNumber, score, moves, timeSeconds) {
  if (!supabase || !playerId) return null;

  try {
    const { data: existing, error: fetchErr } = await supabase
      .from('player_level_scores')
      .select('best_score')
      .eq('player_id', playerId)
      .eq('level_number', levelNumber)
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    if (!existing || score > existing.best_score) {
      const { error: upsertErr } = await supabase
        .from('player_level_scores')
        .upsert({
          player_id: playerId,
          level_number: levelNumber,
          best_score: score,
          best_moves: moves,
          best_time_seconds: timeSeconds,
          achieved_at: new Date().toISOString()
        }, { onConflict: 'player_id,level_number' });

      if (upsertErr) throw upsertErr;
    }

    await supabase
      .from('game_sessions')
      .insert({
        player_id: playerId,
        level_number: levelNumber,
        score: score,
        moves: moves,
        time_seconds: timeSeconds,
        completed_at: new Date().toISOString()
      });

    return true;
  } catch (err) {
    console.warn('[Supabase] Gagal simpan skor:', err.message);
    return false;
  }
}

/**
 * 3. Ambil data leaderboard berdasarkan Level atau Akumulasi Total
 * @param {'all' | number} selectedLevel - 'all' untuk total akumulasi, atau 1..10 untuk level spesifik
 */
export async function fetchLeaderboardFromSupabase(selectedLevel = 'all') {
  if (!supabase) return [];

  try {
    // A. JIKA FILTER LEVEL SPESIFIK (Level 1 s/d 10)
    if (selectedLevel && selectedLevel !== 'all') {
      const lvlNum = parseInt(selectedLevel, 10);
      const { data, error } = await supabase
        .from('player_level_scores')
        .select(`
          player_id,
          level_number,
          best_score,
          best_moves,
          best_time_seconds,
          players!inner ( id, display_name )
        `)
        .eq('level_number', lvlNum)
        .order('best_score', { ascending: false })
        .order('best_moves', { ascending: true })
        .order('best_time_seconds', { ascending: true });

      if (error) throw error;

      return (data || []).map(row => ({
        id: row.player_id,
        name: row.players?.display_name || 'Pemain',
        score: row.best_score,
        moves: row.best_moves,
        time: row.best_time_seconds,
        levelNumber: row.level_number
      }));
    }

    // B. JIKA TOTAL AKUMULASI SELURUH LEVEL
    const { data, error } = await supabase
      .from('player_level_scores')
      .select(`
        player_id,
        best_score,
        best_moves,
        best_time_seconds,
        players!inner ( id, display_name )
      `);

    if (error) throw error;
    if (!data || data.length === 0) return [];

    const playerMap = {};
    data.forEach(row => {
      const pid = row.player_id;
      const pName = row.players?.display_name || 'Pemain';

      if (!playerMap[pid]) {
        playerMap[pid] = {
          id: pid,
          name: pName,
          totalScore: 0,
          totalMoves: 0,
          totalTime: 0,
          completedLevels: 0
        };
      }

      playerMap[pid].totalScore += row.best_score || 0;
      playerMap[pid].totalMoves += row.best_moves || 0;
      playerMap[pid].totalTime += row.best_time_seconds || 0;
      playerMap[pid].completedLevels += 1;
    });

    const list = Object.values(playerMap);
    list.sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (a.totalMoves !== b.totalMoves) return a.totalMoves - b.totalMoves;
      return a.totalTime - b.totalTime;
    });

    return list;
  } catch (err) {
    console.warn('[Supabase] Gagal ambil leaderboard:', err.message);
    return [];
  }
}

/**
 * 4. Ambil semua skor dan level yang sudah diselesaikan pemain
 */
export async function fetchPlayerScoresFromSupabase(playerId) {
  if (!supabase || !playerId) return null;

  try {
    const { data, error } = await supabase
      .from('player_level_scores')
      .select('*')
      .eq('player_id', playerId);

    if (error) throw error;

    const scores = {};
    let maxLevelUnlocked = 1;

    (data || []).forEach(row => {
      const stars = row.best_score >= 850 ? 3 : row.best_score >= 650 ? 2 : 1;

      scores[row.level_number] = {
        score: row.best_score,
        moves: row.best_moves,
        time: row.best_time_seconds,
        stars: stars
      };

      if (row.level_number >= maxLevelUnlocked && row.level_number < 10) {
        maxLevelUnlocked = row.level_number + 1;
      }
    });

    return { scores, maxLevelUnlocked };
  } catch (err) {
    console.warn('[Supabase] Gagal ambil skor pemain:', err.message);
    return null;
  }
}
