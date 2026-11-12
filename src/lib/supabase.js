// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

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
 * Simpan / perbarui pemain di Supabase
 */
export async function syncPlayerToSupabase(player) {
  if (!supabase || !player?.id) return null;
  try {
    const { data, error } = await supabase
      .from('players')
      .upsert({ id: player.id, name: player.name }, { onConflict: 'id' })
      .select();

    if (error) throw error;
    return data;
  } catch (err) {
    console.warn('[Supabase] Gagal sync player:', err.message);
    return null;
  }
}

/**
 * Simpan skor level ke Supabase (upsert skor terbaik & log sesi)
 */
export async function saveLevelScoreToSupabase(playerId, level, score, moves, time, stars) {
  if (!supabase || !playerId) return null;

  try {
    // 1. Cek skor terbaik yang sudah ada
    const { data: existing } = await supabase
      .from('player_level_scores')
      .select('score')
      .eq('player_id', playerId)
      .eq('level', level)
      .maybeSingle();

    // Hanya update jika skor baru lebih tinggi atau belum ada
    if (!existing || score > existing.score) {
      await supabase
        .from('player_level_scores')
        .upsert({
          player_id: playerId,
          level: level,
          score: score,
          moves: moves,
          time: time,
          stars: stars,
          updated_at: new Date().toISOString()
        }, { onConflict: 'player_id,level' });
    }

    // 2. Simpan juga ke riwayat sesi game
    await supabase
      .from('game_sessions')
      .insert({
        player_id: playerId,
        level: level,
        score: score,
        moves: moves,
        time: time
      });

    return true;
  } catch (err) {
    console.warn('[Supabase] Gagal simpan skor:', err.message);
    return false;
  }
}

/**
 * Ambil data leaderboard dari Supabase
 */
export async function fetchLeaderboardFromSupabase() {
  if (!supabase) return null;
  try {
    // Coba ambil dari leaderboard_view
    const { data, error } = await supabase
      .from('leaderboard_view')
      .select('*')
      .limit(50);

    if (error) {
      // Fallback jika view belum dibuat: hitung manual dari players & scores
      const { data: scoresData, error: sErr } = await supabase
        .from('player_level_scores')
        .select(`
          player_id,
          score,
          moves,
          time,
          players ( name )
        `);

      if (sErr) throw sErr;

      // Agregasi manual
      const map = {};
      scoresData.forEach(item => {
        const pid = item.player_id;
        const pName = item.players?.name || 'Pemain';
        if (!map[pid]) {
          map[pid] = { id: pid, name: pName, totalScore: 0, totalMoves: 0, totalTime: 0 };
        }
        map[pid].totalScore += item.score || 0;
        map[pid].totalMoves += item.moves || 0;
        map[pid].totalTime += item.time || 0;
      });

      const list = Object.values(map);
      list.sort((a, b) => {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        if (a.totalMoves !== b.totalMoves) return a.totalMoves - b.totalMoves;
        return a.totalTime - b.totalTime;
      });
      return list;
    }

    return (data || []).map(row => ({
      id: row.player_id,
      name: row.player_name,
      totalScore: row.total_score,
      totalMoves: row.total_moves,
      totalTime: row.total_time,
      completedLevels: row.completed_levels
    }));
  } catch (err) {
    console.warn('[Supabase] Gagal ambil leaderboard:', err.message);
    return null;
  }
}

/**
 * Ambil skor pemain yang tersimpan di Supabase
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
      scores[row.level] = {
        score: row.score,
        moves: row.moves,
        time: row.time,
        stars: row.stars
      };
      if (row.level >= maxLevelUnlocked && row.level < 10) {
        maxLevelUnlocked = row.level + 1;
      }
    });

    return { scores, maxLevelUnlocked };
  } catch (err) {
    console.warn('[Supabase] Gagal ambil skor pemain:', err.message);
    return null;
  }
}

