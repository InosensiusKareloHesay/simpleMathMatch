'use client';

import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { LEVEL_CONFIGS, generateCardsForLevel, calculateScore } from '../lib/levels';
import { sounds } from '../lib/audio';
import {
  isSupabaseConfigured,
  authenticatePlayerInSupabase,
  saveLevelScoreToSupabase,
  fetchLeaderboardFromSupabase,
  fetchPlayerScoresFromSupabase
} from '../lib/supabase';

const LOCAL_STORAGE_PLAYER = 'mathpairs_player_v4';

export default function MathPairsApp() {
  // Navigation & Player State
  const [screen, setScreen] = useState('login'); // 'login' | 'dashboard' | 'levels' | 'game' | 'leaderboard' | 'profile' | 'how-to-play'
  const [player, setPlayer] = useState({ id: '', name: '', unlockedLevel: 1, scores: {} });
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [loginError, setLoginError] = useState('');

  // Gameplay State
  const [currentLevel, setCurrentLevel] = useState(1);
  const [cards, setCards] = useState([]);
  const [flippedCards, setFlippedCards] = useState([]);
  const [matchedCardIds, setMatchedCardIds] = useState(new Set());
  const [wrongCardIds, setWrongCardIds] = useState(new Set());
  const [moves, setMoves] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isBoardLocked, setIsBoardLocked] = useState(false);

  // Modal Result State
  const [resultModal, setResultModal] = useState({
    isOpen: false,
    stars: 3,
    score: 0,
    moves: 0,
    time: '00:00',
    bestScore: 0,
    unlockedNext: false
  });

  // Leaderboard Data State (DIPISAH SESUAI LEVEL)
  const [leaderboardTab, setLeaderboardTab] = useState('all'); // 'all' | 1 | 2 | ... | 10
  const [leaderboardList, setLeaderboardList] = useState([]);
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false);

  // Ref untuk timer interval
  const timerRef = useRef(null);

  // Inisialisasi Player & Supabase
  useEffect(() => {
    const isConfigured = isSupabaseConfigured();
    setSupabaseConnected(isConfigured);

    // Ambil data sesi lokal
    const localData = localStorage.getItem(LOCAL_STORAGE_PLAYER);
    if (localData) {
      try {
        const parsed = JSON.parse(localData);
        if (parsed.name && parsed.id) {
          setPlayer(parsed);
          setScreen('dashboard');

          // Sinkronisasi data progres terbaru jika Supabase aktif
          if (isConfigured) {
            refreshOnlineData(parsed);
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Timer Effect
  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(s => s + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isTimerRunning]);

  // Refresh skor & level terbuka dari Supabase
  const refreshOnlineData = async (activePlayer) => {
    try {
      const online = await fetchPlayerScoresFromSupabase(activePlayer.id);
      if (online) {
        const merged = {
          ...activePlayer,
          scores: { ...activePlayer.scores, ...online.scores },
          unlockedLevel: Math.max(activePlayer.unlockedLevel, online.maxLevelUnlocked)
        };
        setPlayer(merged);
        localStorage.setItem(LOCAL_STORAGE_PLAYER, JSON.stringify(merged));
      }
    } catch (err) {
      console.warn('Sync warning:', err);
    }
  };

  // Login / Registrasi Pemain dengan Password
  const handleAuth = async (e) => {
    e.preventDefault();
    setLoginError('');
    const nameInput = e.target.playerName.value.trim();
    const passInput = e.target.playerPassword.value.trim();

    if (!nameInput) {
      setLoginError('Nama pemain harus diisi.');
      return;
    }

    if (!passInput) {
      setLoginError('Password harus diisi untuk mengamankan akunmu.');
      return;
    }

    sounds.init();
    setLoadingText('Memverifikasi akun...');

    if (isSupabaseConfigured()) {
      const authRes = await authenticatePlayerInSupabase(nameInput, passInput);
      if (!authRes.success) {
        setLoginError(authRes.error || 'Gagal masuk. Periksa password Anda.');
        setLoadingText('');
        return;
      }

      const dbPlayer = authRes.player;
      let activeScores = {};
      let maxUnlocked = 1;

      // Ambil progres permainan yang sudah pernah diselesaikan
      const online = await fetchPlayerScoresFromSupabase(dbPlayer.id);
      if (online) {
        activeScores = online.scores;
        maxUnlocked = online.maxLevelUnlocked;
      }

      const activePlayer = {
        id: dbPlayer.id,
        name: dbPlayer.display_name,
        unlockedLevel: maxUnlocked,
        scores: activeScores
      };

      setPlayer(activePlayer);
      localStorage.setItem(LOCAL_STORAGE_PLAYER, JSON.stringify(activePlayer));
      setLoadingText('');
      setScreen('dashboard');
    } else {
      // Offline fallback
      const activePlayer = {
        id: 'local_' + Date.now().toString(36),
        name: nameInput,
        unlockedLevel: 1,
        scores: {}
      };
      setPlayer(activePlayer);
      localStorage.setItem(LOCAL_STORAGE_PLAYER, JSON.stringify(activePlayer));
      setLoadingText('');
      setScreen('dashboard');
    }
  };

  // Fungsi Logout
  const handleLogout = () => {
    if (confirm('Apakah kamu yakin ingin keluar (logout)?')) {
      localStorage.removeItem(LOCAL_STORAGE_PLAYER);
      setPlayer({ id: '', name: '', unlockedLevel: 1, scores: {} });
      setScreen('login');
      setLoginError('');
    }
  };

  // Mulai Permainan Level
  const startLevel = (lvl) => {
    sounds.init();
    setCurrentLevel(lvl);
    setMoves(0);
    setTimerSeconds(0);
    setIsTimerRunning(false);
    setFlippedCards([]);
    setMatchedCardIds(new Set());
    setWrongCardIds(new Set());
    setIsBoardLocked(false);

    const { cards: generatedCards } = generateCardsForLevel(lvl);
    setCards(generatedCards);
    setScreen('game');
  };

  // Klik Kartu
  const handleCardClick = (card) => {
    if (isBoardLocked) return;
    if (matchedCardIds.has(card.id)) return;
    if (flippedCards.some(c => c.id === card.id)) return;

    if (!isTimerRunning) {
      setIsTimerRunning(true);
    }

    sounds.flip();
    const nextFlipped = [...flippedCards, card];
    setFlippedCards(nextFlipped);

    if (nextFlipped.length === 2) {
      setMoves(m => m + 1);
      checkCardsMatch(nextFlipped[0], nextFlipped[1]);
    }
  };

  // Cek Kesamaan Hasil Matematika
  const checkCardsMatch = (first, second) => {
    const isMatch = first.pairId === second.pairId || first.targetValue === second.targetValue;

    if (isMatch) {
      setIsBoardLocked(true);
      setTimeout(() => {
        sounds.match();
        const nextMatched = new Set(matchedCardIds);
        nextMatched.add(first.id);
        nextMatched.add(second.id);
        setMatchedCardIds(nextMatched);
        setFlippedCards([]);
        setIsBoardLocked(false);

        // Cek Selesai Level
        const config = LEVEL_CONFIGS[currentLevel];
        if (nextMatched.size >= config.cards) {
          handleLevelComplete();
        }
      }, 400);
    } else {
      setIsBoardLocked(true);
      setTimeout(() => {
        sounds.wrong();
        setWrongCardIds(new Set([first.id, second.id]));
      }, 300);

      setTimeout(() => {
        setWrongCardIds(new Set());
        setFlippedCards([]);
        setIsBoardLocked(false);
      }, 1000);
    }
  };

  // Selesai Level
  const handleLevelComplete = async () => {
    setIsTimerRunning(false);
    sounds.win();

    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (e) {}

    const stats = calculateScore(currentLevel, moves + 1, timerSeconds);
    const mins = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
    const secs = String(timerSeconds % 60).padStart(2, '0');
    const formattedTime = `${mins}:${secs}`;

    const prevBest = player.scores[currentLevel]?.score || 0;
    const isNewBest = stats.score > prevBest;
    let nextUnlocked = player.unlockedLevel;

    if (currentLevel === player.unlockedLevel && player.unlockedLevel < 10) {
      nextUnlocked = player.unlockedLevel + 1;
    }

    const updatedPlayer = {
      ...player,
      unlockedLevel: nextUnlocked,
      scores: {
        ...player.scores,
        [currentLevel]: {
          score: Math.max(prevBest, stats.score),
          moves: isNewBest ? moves + 1 : (player.scores[currentLevel]?.moves || moves + 1),
          time: isNewBest ? timerSeconds : (player.scores[currentLevel]?.time || timerSeconds),
          stars: isNewBest ? stats.stars : (player.scores[currentLevel]?.stars || stats.stars)
        }
      }
    };

    setPlayer(updatedPlayer);
    localStorage.setItem(LOCAL_STORAGE_PLAYER, JSON.stringify(updatedPlayer));

    // Simpan ke Supabase (tabel player_level_scores & game_sessions)
    if (isSupabaseConfigured() && player.id) {
      saveLevelScoreToSupabase(player.id, currentLevel, stats.score, moves + 1, timerSeconds);
    }

    setResultModal({
      isOpen: true,
      stars: stats.stars,
      score: stats.score,
      moves: moves + 1,
      time: formattedTime,
      bestScore: Math.max(prevBest, stats.score),
      unlockedNext: nextUnlocked > player.unlockedLevel
    });
  };

  // Load Leaderboard berdasarkan tab level yang dipilih
  const loadLeaderboardData = async (lvl) => {
    setIsLeaderboardLoading(true);

    if (isSupabaseConfigured()) {
      const realData = await fetchLeaderboardFromSupabase(lvl);
      setLeaderboardList(realData || []);
    } else {
      // Offline fallback
      if (lvl === 'all') {
        const myTotalScore = Object.values(player.scores).reduce((sum, item) => sum + (item.score || 0), 0);
        const myTotalMoves = Object.values(player.scores).reduce((sum, item) => sum + (item.moves || 0), 0);
        const myTotalTime = Object.values(player.scores).reduce((sum, item) => sum + (item.time || 0), 0);

        if (myTotalScore > 0 && player.name) {
          setLeaderboardList([{
            id: player.id,
            name: player.name,
            totalScore: myTotalScore,
            totalMoves: myTotalMoves,
            totalTime: myTotalTime,
            completedLevels: Object.keys(player.scores).length
          }]);
        } else {
          setLeaderboardList([]);
        }
      } else {
        const lvlData = player.scores[lvl];
        if (lvlData && player.name) {
          setLeaderboardList([{
            id: player.id,
            name: player.name,
            score: lvlData.score,
            moves: lvlData.moves,
            time: lvlData.time,
            levelNumber: lvl
          }]);
        } else {
          setLeaderboardList([]);
        }
      }
    }

    setIsLeaderboardLoading(false);
  };

  // Buka Halaman Leaderboard
  const openLeaderboard = async () => {
    setScreen('leaderboard');
    setLeaderboardTab('all');
    loadLeaderboardData('all');
  };

  // Switch tab level pada leaderboard
  const switchLeaderboardTab = (tab) => {
    setLeaderboardTab(tab);
    loadLeaderboardData(tab);
  };

  // Helper Total Skor Player
  const totalScore = Object.values(player.scores).reduce((sum, s) => sum + (s.score || 0), 0);
  const completedCount = Object.keys(player.scores).length;

  return (
    <div className="min-h-screen flex flex-col items-center p-4">
      <div className="w-full max-w-4xl flex flex-col flex-1">

        {/* Top Navbar */}
        {screen !== 'login' && (
          <header className="flex justify-between items-center bg-white/90 backdrop-blur-md px-5 py-3 rounded-2xl shadow-sm mb-4 border border-indigo-100">
            <div className="flex items-center gap-2 cursor-pointer font-bold text-indigo-700 text-xl" onClick={() => setScreen('dashboard')}>
              <span>🧠 MathPairs</span>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* Supabase Status Indicator */}
              <div className={`text-xs px-2.5 py-1 rounded-full font-semibold flex items-center gap-1.5 ${
                supabaseConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                <span className={`w-2 h-2 rounded-full ${supabaseConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                <span className="hidden sm:inline">{supabaseConnected ? 'Mode Online' : 'Mode Offline'}</span>
              </div>

              {/* User Profile Pill */}
              <div
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm px-3 py-1.5 rounded-full cursor-pointer flex items-center gap-1 transition"
                onClick={() => setScreen('profile')}
              >
                👤 {player.name || 'Pemain'}
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-xs px-3 py-1.5 rounded-full flex items-center gap-1 transition"
                title="Keluar dari akun"
              >
                <span>Keluar</span>
                <span>🚪</span>
              </button>
            </div>
          </header>
        )}

        {/* ================= 1. LOGIN SCREEN ================= */}
        {screen === 'login' && (
          <div className="my-auto max-w-md w-full mx-auto bg-white/95 rounded-3xl p-8 shadow-xl border border-indigo-100 text-center animate-fadeIn">
            <div className="text-6xl mb-3 animate-bounce">🎴✨</div>
            <h1 className="text-3xl font-extrabold text-indigo-600 mb-1">MathPairs</h1>
            <p className="text-slate-500 text-sm mb-6">Learn · Play · Match<br />Media Pembelajaran Interaktif Matematika</p>

            {loginError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold p-3 rounded-xl mb-4 text-left">
                ⚠️ {loginError}
              </div>
            )}

            <form onSubmit={handleAuth} className="space-y-4">
              <div className="text-left">
                <label className="block text-slate-700 font-bold text-xs mb-1 uppercase tracking-wider">Nama Siswa / Username</label>
                <input
                  type="text"
                  name="playerName"
                  placeholder="Masukkan nama panggilanmu..."
                  required
                  maxLength={25}
                  className="w-full px-4 py-3 text-base font-bold border-2 border-slate-200 rounded-xl focus:border-indigo-600 focus:outline-none transition"
                />
              </div>

              <div className="text-left">
                <label className="block text-slate-700 font-bold text-xs mb-1 uppercase tracking-wider">Password / PIN</label>
                <input
                  type="password"
                  name="playerPassword"
                  placeholder="Masukkan password akun..."
                  required
                  className="w-full px-4 py-3 text-base font-bold border-2 border-slate-200 rounded-xl focus:border-indigo-600 focus:outline-none transition"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  *Jika akun baru, password ini akan didaftarkan sebagai kunci login kamu.
                </p>
              </div>

              <button
                type="submit"
                disabled={Boolean(loadingText)}
                className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-extrabold py-3.5 px-6 rounded-xl shadow-lg shadow-indigo-300 transition transform active:scale-95 disabled:opacity-50 mt-2"
              >
                {loadingText || 'Masuk & Mulai Bermain 🚀'}
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-400">
              {supabaseConnected ? (
                <span className="text-emerald-600 font-medium">✓ Terhubung ke Database Supabase</span>
              ) : (
                <span>Mode Offline: Skor disimpan di browser</span>
              )}
            </div>
          </div>
        )}

        {/* ================= 2. DASHBOARD SCREEN ================= */}
        {screen === 'dashboard' && (
          <div className="space-y-5 animate-fadeIn">
            {/* Hero Card */}
            <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 rounded-3xl p-6 text-white shadow-lg shadow-indigo-200 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div>
                <span className="text-xs font-bold tracking-wider text-indigo-200 uppercase">Selamat Datang</span>
                <h1 className="text-2xl sm:text-3xl font-extrabold mt-0.5">Halo, {player.name}! 👋</h1>
                <p className="text-indigo-100 text-sm mt-1">Asah kecepatan hitung dan daya ingat matematika!</p>
              </div>

              <div className="flex gap-3 bg-white/15 backdrop-blur-md p-3 rounded-2xl border border-white/20">
                <div className="text-center px-3 border-r border-white/20">
                  <div className="text-2xl font-black">{totalScore.toLocaleString()}</div>
                  <div className="text-[10px] font-bold text-indigo-200">TOTAL POIN</div>
                </div>
                <div className="text-center px-3">
                  <div className="text-2xl font-black">{completedCount} / 10</div>
                  <div className="text-[10px] font-bold text-indigo-200">SELESAI</div>
                </div>
              </div>
            </div>

            {/* Menu Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                onClick={() => setScreen('levels')}
                className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="text-4xl mb-3 group-hover:scale-110 transition transform origin-left">🎮</div>
                  <h3 className="text-lg font-bold text-slate-800">Mulai Bermain</h3>
                  <p className="text-xs text-slate-500 mt-1">Pilih Level 1 hingga 10 untuk mencocokkan kartu matematika.</p>
                </div>
                <span className="text-indigo-600 font-extrabold text-sm mt-4 flex items-center gap-1">Pilih Level →</span>
              </div>

              <div
                onClick={openLeaderboard}
                className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="text-4xl mb-3 group-hover:scale-110 transition transform origin-left">🏆</div>
                  <h3 className="text-lg font-bold text-slate-800">Papan Peringkat</h3>
                  <p className="text-xs text-slate-500 mt-1">Lihat peringkat skor terbaik per level atau total akumulasi.</p>
                </div>
                <span className="text-indigo-600 font-extrabold text-sm mt-4 flex items-center gap-1">Lihat Peringkat →</span>
              </div>

              <div
                onClick={() => setScreen('profile')}
                className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="text-4xl mb-3 group-hover:scale-110 transition transform origin-left">👤</div>
                  <h3 className="text-lg font-bold text-slate-800">Profil & Riwayat</h3>
                  <p className="text-xs text-slate-500 mt-1">Pantau perolehan bintang, move, dan rekor waktu tiap level.</p>
                </div>
                <span className="text-indigo-600 font-extrabold text-sm mt-4 flex items-center gap-1">Detail Profil →</span>
              </div>

              <div
                onClick={() => setScreen('how-to-play')}
                className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="text-4xl mb-3 group-hover:scale-110 transition transform origin-left">📖</div>
                  <h3 className="text-lg font-bold text-slate-800">Cara Bermain</h3>
                  <p className="text-xs text-slate-500 mt-1">Pelajari mekanisme hasil perhitungan kartu dan trik efisiensi skor.</p>
                </div>
                <span className="text-indigo-600 font-extrabold text-sm mt-4 flex items-center gap-1">Baca Panduan →</span>
              </div>
            </div>

            {/* Quick Action Footer */}
            <div className="bg-white/80 rounded-2xl p-4 flex justify-between items-center border border-indigo-50 shadow-sm">
              <div>
                <span className="text-xs text-slate-400 font-bold uppercase">Level Terbuka Saat Ini</span>
                <div className="text-slate-800 font-extrabold text-base">Level {player.unlockedLevel}</div>
              </div>
              <button
                onClick={() => startLevel(player.unlockedLevel)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-md transition"
              >
                Lanjutkan Level {player.unlockedLevel} 🚀
              </button>
            </div>
          </div>
        )}

        {/* ================= 3. LEVEL SELECTION ================= */}
        {screen === 'levels' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-indigo-700">Pilih Level</h2>
                <p className="text-slate-500 text-xs">Selesaikan level secara bertahap untuk membuka level berikutnya</p>
              </div>
              <button
                onClick={() => setScreen('dashboard')}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-sm transition"
              >
                ← Kembali
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {Array.from({ length: 10 }, (_, i) => i + 1).map(lvl => {
                const config = LEVEL_CONFIGS[lvl];
                const isUnlocked = lvl <= player.unlockedLevel;
                const scoreData = player.scores[lvl];

                return (
                  <div
                    key={lvl}
                    onClick={() => isUnlocked && startLevel(lvl)}
                    className={`rounded-2xl p-4 text-center border-2 transition ${
                      isUnlocked
                        ? 'bg-white border-indigo-200 hover:border-indigo-600 hover:-translate-y-1 shadow-sm cursor-pointer'
                        : 'bg-slate-50 border-dashed border-slate-200 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div className="text-2xl font-black text-indigo-700 mb-1">
                      {isUnlocked ? `Level ${lvl}` : `🔒 Lvl ${lvl}`}
                    </div>
                    <div className="text-[11px] font-bold text-slate-500 mb-2">
                      {config.cards} Kartu ({config.pairs} Pasang)
                    </div>

                    <div className="text-sm mb-1 text-amber-500">
                      {scoreData?.stars ? '⭐'.repeat(scoreData.stars) + '☆'.repeat(3 - scoreData.stars) : (isUnlocked ? '☆☆☆' : '—')}
                    </div>

                    <div className="text-xs font-bold text-emerald-600">
                      {scoreData ? `${scoreData.score} Pts` : (isUnlocked ? 'Tersedia' : 'Terkunci')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= 4. GAMEPLAY SCREEN ================= */}
        {screen === 'game' && (
          <div className="space-y-4 animate-fadeIn">
            {/* In-Game HUD */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-indigo-100 flex justify-between items-center flex-wrap gap-2">
              <div className="text-center">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase">Level</span>
                <div className="text-lg font-black text-indigo-600">Level {currentLevel}</div>
              </div>
              <div className="text-center">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase">Percobaan (Move)</span>
                <div className="text-lg font-black text-slate-800">{moves}</div>
              </div>
              <div className="text-center">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase">Waktu</span>
                <div className="text-lg font-black text-slate-800">
                  {String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:
                  {String(timerSeconds % 60).padStart(2, '0')}
                </div>
              </div>
              <div className="text-center">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase">Pasangan Cocok</span>
                <div className="text-lg font-black text-emerald-600">
                  {matchedCardIds.size / 2} / {LEVEL_CONFIGS[currentLevel]?.pairs}
                </div>
              </div>
              <button
                onClick={() => {
                  if (confirm('Keluar dari ronde permainan ini?')) setScreen('levels');
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs px-3 py-1.5 rounded-lg transition"
              >
                Keluar
              </button>
            </div>

            {/* Grid Kartu */}
            <div
              className={`grid gap-2 sm:gap-3 mx-auto justify-center ${
                cards.length <= 10
                  ? 'grid-cols-5 max-w-lg'
                  : cards.length <= 20
                  ? 'grid-cols-4 sm:grid-cols-5 max-w-xl'
                  : cards.length <= 40
                  ? 'grid-cols-5 sm:grid-cols-8 max-w-2xl'
                  : 'grid-cols-6 sm:grid-cols-10 max-w-3xl'
              }`}
            >
              {cards.map(card => {
                const isFlipped = flippedCards.some(c => c.id === card.id);
                const isMatched = matchedCardIds.has(card.id);
                const isWrong = wrongCardIds.has(card.id);

                return (
                  <div
                    key={card.id}
                    onClick={() => handleCardClick(card)}
                    className={`aspect-[1/1.15] cursor-pointer perspective-1000 select-none ${
                      isMatched ? 'animate-matched' : ''
                    }`}
                  >
                    <div
                      className={`relative w-full h-full transform-style-3d transition-transform duration-300 rounded-xl shadow-sm ${
                        isFlipped || isMatched ? 'rotate-y-180' : ''
                      } ${isWrong ? 'animate-shake' : ''}`}
                    >
                      {/* Kartu Belakang (Tertutup) */}
                      <div className="absolute inset-0 backface-hidden bg-gradient-to-br from-indigo-500 to-purple-600 border-2 border-indigo-300 rounded-xl flex items-center justify-center text-white text-xl sm:text-2xl font-bold shadow-sm">
                        ❓
                      </div>

                      {/* Kartu Depan (Terbuka - Soal Matematika) */}
                      <div className="absolute inset-0 backface-hidden rotate-y-180 bg-white border-2 border-indigo-200 rounded-xl flex items-center justify-center p-1 text-center font-extrabold text-indigo-700 text-xs sm:text-base shadow-sm">
                        {card.expression}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= 5. LEADERBOARD SCREEN (PER LEVEL & REAL DATA ONLY) ================= */}
        {screen === 'leaderboard' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-indigo-700">🏆 Papan Peringkat</h2>
                <p className="text-slate-500 text-xs">Peringkat resmi berdasarkan data asli di database Supabase</p>
              </div>
              <button
                onClick={() => setScreen('dashboard')}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-sm transition"
              >
                ← Kembali
              </button>
            </div>

            {/* Level Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
              <button
                onClick={() => switchLeaderboardTab('all')}
                className={`px-3.5 py-1.5 rounded-xl font-bold text-xs whitespace-nowrap transition ${
                  leaderboardTab === 'all'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                🌟 Total Akumulasi
              </button>

              {Array.from({ length: 10 }, (_, i) => i + 1).map(lvl => (
                <button
                  key={lvl}
                  onClick={() => switchLeaderboardTab(lvl)}
                  className={`px-3.5 py-1.5 rounded-xl font-bold text-xs whitespace-nowrap transition ${
                    leaderboardTab === lvl
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  Level {lvl}
                </button>
              ))}
            </div>

            {/* Table Container */}
            <div className="bg-white rounded-2xl shadow-sm border border-indigo-50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase border-b border-slate-100">
                    <tr>
                      <th className="py-3 px-4">Peringkat</th>
                      <th className="py-3 px-4">Nama Siswa</th>
                      <th className="py-3 px-4">
                        {leaderboardTab === 'all' ? 'Total Poin' : `Skor Level ${leaderboardTab}`}
                      </th>
                      <th className="py-3 px-4">
                        {leaderboardTab === 'all' ? 'Total Move' : 'Percobaan (Move)'}
                      </th>
                      <th className="py-3 px-4">
                        {leaderboardTab === 'all' ? 'Total Waktu' : 'Waktu'}
                      </th>
                      {leaderboardTab === 'all' && (
                        <th className="py-3 px-4">Level Selesai</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLeaderboardLoading ? (
                      <tr>
                        <td colSpan={leaderboardTab === 'all' ? 6 : 5} className="py-8 text-center text-slate-400">
                          Memuat data peringkat terbaru...
                        </td>
                      </tr>
                    ) : leaderboardList.length === 0 ? (
                      <tr>
                        <td colSpan={leaderboardTab === 'all' ? 6 : 5} className="py-12 text-center text-slate-400">
                          <div className="text-4xl mb-2">🏆</div>
                          <div className="font-bold text-slate-700 text-base">
                            {leaderboardTab === 'all'
                              ? 'Belum Ada Skor Tercatat'
                              : `Belum Ada Skor di Level ${leaderboardTab}`}
                          </div>
                          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                            {leaderboardTab === 'all'
                              ? 'Belum ada siswa yang menyelesaikan level. Selesaikan level sekarang untuk memimpin peringkat!'
                              : `Jadilah siswa pertama yang menaklukkan tantangan Level ${leaderboardTab}!`}
                          </p>
                          <button
                            onClick={() => startLevel(leaderboardTab === 'all' ? 1 : leaderboardTab)}
                            className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition"
                          >
                            Mainkan {leaderboardTab === 'all' ? 'Level 1' : `Level ${leaderboardTab}`} Sekarang 🚀
                          </button>
                        </td>
                      </tr>
                    ) : (
                      leaderboardList.map((row, idx) => {
                        const isMe = row.id === player.id;
                        const scoreVal = leaderboardTab === 'all' ? row.totalScore : row.score;
                        const movesVal = leaderboardTab === 'all' ? row.totalMoves : row.moves;
                        const rawTime = leaderboardTab === 'all' ? row.totalTime : row.time;

                        const mins = String(Math.floor((rawTime || 0) / 60)).padStart(2, '0');
                        const secs = String((rawTime || 0) % 60).padStart(2, '0');

                        return (
                          <tr key={row.id || idx} className={isMe ? 'bg-indigo-50/70 font-bold text-indigo-900' : 'hover:bg-slate-50'}>
                            <td className="py-3 px-4">
                              {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`}
                            </td>
                            <td className="py-3 px-4 flex items-center gap-1.5">
                              <span>{row.name}</span>
                              {isMe && <span className="bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">Kamu</span>}
                            </td>
                            <td className="py-3 px-4 font-black text-indigo-600">{(scoreVal || 0).toLocaleString()}</td>
                            <td className="py-3 px-4 text-slate-600">{movesVal || 0}</td>
                            <td className="py-3 px-4 text-slate-600">{mins}:{secs}</td>
                            {leaderboardTab === 'all' && (
                              <td className="py-3 px-4 text-slate-600 font-bold">
                                {row.completedLevels || 0} / 10
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= 6. PROFILE SCREEN ================= */}
        {screen === 'profile' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-indigo-700">👤 Profil Siswa</h2>
                <p className="text-slate-500 text-xs">Capaian & statistik pembelajaran matematika</p>
              </div>
              <button
                onClick={() => setScreen('dashboard')}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-sm transition"
              >
                ← Kembali
              </button>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-sm border border-indigo-100 space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-3xl text-white shadow-md">
                    🎓
                  </div>
                  <div>
                    <h3 className="text-2xl font-extrabold text-slate-800">{player.name}</h3>
                    <div className="text-xs text-slate-400 font-mono">ID: {player.id}</div>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs px-4 py-2 rounded-xl border border-red-200 transition"
                >
                  Keluar dari Akun 🚪
                </button>
              </div>

              {/* Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-4 rounded-2xl text-center border border-slate-100">
                  <div className="text-xs font-bold text-slate-400 uppercase">Total Poin</div>
                  <div className="text-2xl font-black text-indigo-600 mt-1">{totalScore.toLocaleString()}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl text-center border border-slate-100">
                  <div className="text-xs font-bold text-slate-400 uppercase">Level Selesai</div>
                  <div className="text-2xl font-black text-emerald-600 mt-1">{completedCount} / 10</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl text-center border border-slate-100">
                  <div className="text-xs font-bold text-slate-400 uppercase">Level Tertinggi</div>
                  <div className="text-2xl font-black text-amber-500 mt-1">Level {player.unlockedLevel}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl text-center border border-slate-100">
                  <div className="text-xs font-bold text-slate-400 uppercase">Database</div>
                  <div className="text-sm font-bold text-slate-700 mt-2">
                    {supabaseConnected ? '🟢 Supabase' : '🟡 Offline'}
                  </div>
                </div>
              </div>

              {/* History per Level */}
              <div>
                <h4 className="font-extrabold text-slate-800 mb-3 text-sm">Riwayat Per Level</h4>
                <div className="space-y-2">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map(lvl => {
                    const data = player.scores[lvl];
                    const mins = data ? String(Math.floor(data.time / 60)).padStart(2, '0') : '00';
                    const secs = data ? String(data.time % 60).padStart(2, '0') : '00';

                    return (
                      <div key={lvl} className="flex justify-between items-center py-2 px-3 bg-slate-50 rounded-xl text-sm border border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-700">Level {lvl}</span>
                          <span className="text-amber-500 text-xs">
                            {data ? '⭐'.repeat(data.stars) : ''}
                          </span>
                        </div>
                        <div>
                          {data ? (
                            <span className="font-bold text-indigo-600">
                              {data.score} Pts <span className="text-slate-400 font-normal text-xs">({data.moves} moves, {mins}:{secs})</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">Belum selesai</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= 7. HOW TO PLAY SCREEN ================= */}
        {screen === 'how-to-play' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-black text-indigo-700">📖 Panduan MathPairs</h2>
              <button
                onClick={() => setScreen('dashboard')}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-sm transition"
              >
                ← Kembali
              </button>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-sm border border-indigo-100 space-y-5 text-sm leading-relaxed text-slate-700">
              <div className="bg-indigo-50 border-l-4 border-indigo-600 p-4 rounded-xl">
                <h3 className="font-extrabold text-indigo-800 text-base mb-1">🎯 Konsep Utama: Mencocokkan Hasil Hitungan</h3>
                <p className="text-indigo-950">
                  Dua kartu adalah pasangan cocok jika memiliki <strong>hasil perhitungan yang sama</strong>, meskipun operasi matematikanya berbeda!
                </p>
                <div className="mt-2 text-xs font-semibold bg-white/80 p-2.5 rounded-lg text-indigo-800">
                  Contoh: Kartu <strong>5 + 3</strong> (hasil 8) cocok dengan kartu <strong>4 × 2</strong> (hasil 8).
                </div>
              </div>

              <div>
                <h4 className="font-extrabold text-slate-900 mb-2">⚙️ Aturan Dasar:</h4>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                  <li>Buka 2 kartu dengan cara mengkliknya.</li>
                  <li>Jika benar: kedua kartu akan menghilang dari papan.</li>
                  <li>Jika salah: kartu akan tertutup kembali. Ingat-ingat posisinya!</li>
                  <li><strong>Move Counter</strong>: Dihitung setiap kali kamu membuka 2 kartu.</li>
                  <li><strong>Timer</strong>: Mulai berjalan saat kamu membuka kartu pertama.</li>
                </ul>
              </div>

              <div>
                <h4 className="font-extrabold text-slate-900 mb-2">⭐ Rahasia Skor Tinggi:</h4>
                <p className="text-slate-600">
                  Skor dihitung dari efisiensi langkah (bobot 60%) dan kecepatan waktu (bobot 40%). Semakin sedikit move yang digunakan dan semakin cepat kamu menyelesaikannya, semakin besar kemungkinan memperoleh <strong>3 Bintang (⭐⭐⭐)</strong>!
                </p>
              </div>

              <div className="text-center pt-3">
                <button
                  onClick={() => setScreen('levels')}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-6 py-3 rounded-xl shadow-md transition"
                >
                  Ayo Mainkan Sekarang! 🚀
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= MODAL RESULT ================= */}
        {resultModal.isOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl border border-indigo-100">
              <h2 className="text-2xl font-black text-indigo-700">Level Selesai! 🎉</h2>
              <div className="text-4xl my-3 tracking-widest text-amber-400">
                {'⭐'.repeat(resultModal.stars) + '☆'.repeat(3 - resultModal.stars)}
              </div>

              <div className="my-4">
                <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Skor Diperoleh</span>
                <div className="text-4xl font-black text-emerald-600 mt-0.5">{resultModal.score} PTS</div>
              </div>

              {resultModal.unlockedNext && (
                <div className="bg-emerald-50 text-emerald-700 text-xs font-bold py-2 px-3 rounded-xl mb-4 border border-emerald-200">
                  🎉 Level Baru Berhasil Terbuka!
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 my-4 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-400 font-bold">TOTAL MOVE</span>
                  <div className="text-base font-extrabold text-slate-800 mt-0.5">{resultModal.moves}</div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-400 font-bold">WAKTU</span>
                  <div className="text-base font-extrabold text-slate-800 mt-0.5">{resultModal.time}</div>
                </div>
              </div>

              <div className="flex gap-2 justify-center mt-6">
                <button
                  onClick={() => {
                    setResultModal(m => ({ ...m, isOpen: false }));
                    setScreen('dashboard');
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl text-sm transition"
                >
                  Dashboard
                </button>
                {currentLevel < 10 && (
                  <button
                    onClick={() => {
                      setResultModal(m => ({ ...m, isOpen: false }));
                      startLevel(currentLevel + 1);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl text-sm shadow-md transition"
                  >
                    Level Selanjutnya →
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
