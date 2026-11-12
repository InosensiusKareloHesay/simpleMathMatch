// game.js - Logika Utama MathPairs

// =================== AUDIO SYNTHESIS (Web Audio API) ===================
const SoundManager = {
  ctx: null,
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },
  playTone(freq, type = 'sine', duration = 0.15, gainVal = 0.1) {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      // Audio fallback jika browser membatasi autoplay
    }
  },
  flip() {
    this.playTone(480, 'triangle', 0.08, 0.08);
  },
  match() {
    this.playTone(523.25, 'sine', 0.15, 0.12); // C5
    setTimeout(() => this.playTone(659.25, 'sine', 0.2, 0.12), 90); // E5
    setTimeout(() => this.playTone(783.99, 'sine', 0.3, 0.15), 180); // G5
  },
  wrong() {
    this.playTone(220, 'sawtooth', 0.2, 0.08); // A3
    setTimeout(() => this.playTone(180, 'sawtooth', 0.25, 0.08), 100);
  },
  win() {
    const melody = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    melody.forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 'triangle', 0.3, 0.15), idx * 120);
    });
  }
};

// =================== STORAGE & DEFAULT DATA ===================
const STORAGE_KEY_PLAYER = 'mathpairs_player_v1';
const STORAGE_KEY_LEADERBOARD = 'mathpairs_leaderboard_v1';

const DEFAULT_LEADERBOARD = [
  { id: 'bot_1', name: 'Nadia Putri', totalScore: 8500, totalMoves: 120, totalTime: 420 },
  { id: 'bot_2', name: 'Andi Pratama', totalScore: 7800, totalMoves: 135, totalTime: 490 },
  { id: 'bot_3', name: 'Budi Santoso', totalScore: 7200, totalMoves: 148, totalTime: 540 },
  { id: 'bot_4', name: 'Citra Amelia', totalScore: 6500, totalMoves: 160, totalTime: 620 },
  { id: 'bot_5', name: 'Doni Saputra', totalScore: 5900, totalMoves: 175, totalTime: 680 }
];

let player = {
  id: '',
  name: '',
  unlockedLevel: 1,
  scores: {} // { [lvl]: { score: 950, moves: 8, time: 45, stars: 3 } }
};

function loadPlayerData() {
  const data = localStorage.getItem(STORAGE_KEY_PLAYER);
  if (data) {
    try {
      player = JSON.parse(data);
    } catch (e) {
      console.error(e);
    }
  }
}

function savePlayerData() {
  localStorage.setItem(STORAGE_KEY_PLAYER, JSON.stringify(player));
  updateLeaderboardWithCurrentPlayer();
}

function getLeaderboard() {
  const data = localStorage.getItem(STORAGE_KEY_LEADERBOARD);
  let list = DEFAULT_LEADERBOARD;
  if (data) {
    try {
      list = JSON.parse(data);
    } catch (e) {}
  }
  return list;
}

function saveLeaderboard(list) {
  localStorage.setItem(STORAGE_KEY_LEADERBOARD, JSON.stringify(list));
}

function updateLeaderboardWithCurrentPlayer() {
  if (!player.name) return;
  const list = getLeaderboard();
  
  // Hitung agregasi player
  let totalScore = 0;
  let totalMoves = 0;
  let totalTime = 0;
  for (const lvl in player.scores) {
    totalScore += player.scores[lvl].score || 0;
    totalMoves += player.scores[lvl].moves || 0;
    totalTime += player.scores[lvl].time || 0;
  }

  const existingIdx = list.findIndex(item => item.id === player.id);
  const entry = {
    id: player.id,
    name: player.name,
    totalScore,
    totalMoves,
    totalTime,
    isCurrent: true
  };

  if (existingIdx !== -1) {
    list[existingIdx] = entry;
  } else {
    list.push(entry);
  }

  // Aturan Peringkat Konsep:
  // 1. Total score tertinggi
  // 2. Jika sama, move lebih sedikit
  // 3. Jika sama, waktu lebih sedikit
  list.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (a.totalMoves !== b.totalMoves) return a.totalMoves - b.totalMoves;
    return a.totalTime - b.totalTime;
  });

  saveLeaderboard(list);
}

// =================== GAME STATE ===================
let currentLevel = 1;
let movesCount = 0;
let timerSeconds = 0;
let timerInterval = null;
let timerStarted = false;
let flippedCards = [];
let matchedPairs = 0;
let totalPairsInLevel = 0;
let isBoardLocked = false;

// =================== NAVIGATION ===================
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(screenId);
  if (target) {
    target.classList.add('active');
  }

  // Update top bar visibility
  const nav = document.getElementById('topNavbar');
  const userPill = document.getElementById('navbarUserPill');
  if (screenId === 'screenLogin') {
    nav.style.display = 'none';
  } else {
    nav.style.display = 'flex';
    userPill.innerHTML = `👤 ${player.name || 'Pemain'}`;
  }

  if (screenId === 'screenDashboard') renderDashboard();
  if (screenId === 'screenLevelSelect') renderLevelSelect();
  if (screenId === 'screenLeaderboard') renderLeaderboard();
  if (screenId === 'screenProfile') renderProfile();
}

// =================== INITIALIZATION ===================
window.addEventListener('DOMContentLoaded', () => {
  loadPlayerData();

  // Pastikan default leaderboard ada
  if (!localStorage.getItem(STORAGE_KEY_LEADERBOARD)) {
    saveLeaderboard(DEFAULT_LEADERBOARD);
  }

  if (player && player.name) {
    showScreen('screenDashboard');
  } else {
    showScreen('screenLogin');
  }

  // Login handler
  document.getElementById('formLogin').addEventListener('submit', (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('inputPlayerName');
    const name = nameInput.value.trim();
    if (!name) return;

    SoundManager.init();
    player.id = 'usr_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    player.name = name;
    player.unlockedLevel = 1;
    player.scores = {};
    savePlayerData();
    showScreen('screenDashboard');
  });
});

// =================== DASHBOARD & SCREENS ===================
function renderDashboard() {
  document.getElementById('dashPlayerName').innerText = player.name;
  
  // Hitung total skor
  let totalScore = 0;
  let completedCount = 0;
  for (let i = 1; i <= 10; i++) {
    if (player.scores[i]) {
      totalScore += player.scores[i].score;
      completedCount++;
    }
  }

  document.getElementById('dashTotalScore').innerText = totalScore.toLocaleString();
  document.getElementById('dashProgressText').innerText = `${completedCount} / 10`;
  document.getElementById('dashUnlockedLvl').innerText = `Level ${player.unlockedLevel}`;
}

function renderLevelSelect() {
  const grid = document.getElementById('levelGridContainer');
  grid.innerHTML = '';

  for (let lvl = 1; lvl <= 10; lvl++) {
    const config = LEVEL_CONFIGS[lvl];
    const isUnlocked = lvl <= player.unlockedLevel;
    const scoreData = player.scores[lvl];

    const card = document.createElement('div');
    card.className = `level-card ${isUnlocked ? 'unlocked' : 'locked'}`;

    let starsHtml = '';
    if (scoreData && scoreData.stars) {
      starsHtml = '⭐'.repeat(scoreData.stars) + '☆'.repeat(3 - scoreData.stars);
    } else if (isUnlocked) {
      starsHtml = '☆☆☆';
    } else {
      starsHtml = '🔒';
    }

    card.innerHTML = `
      <div class="level-num">Level ${lvl}</div>
      <div class="level-cards-count">${config.cards} Kartu (${config.pairs} Pasang)</div>
      <div class="level-stars">${starsHtml}</div>
      <div class="level-best">${scoreData ? `${scoreData.score} Pts` : (isUnlocked ? 'Tersedia' : 'Terkunci')}</div>
    `;

    if (isUnlocked) {
      card.addEventListener('click', () => {
        SoundManager.init();
        startLevel(lvl);
      });
    }

    grid.appendChild(card);
  }
}

// =================== GAMEPLAY LOGIC ===================
function startLevel(lvl) {
  currentLevel = lvl;
  movesCount = 0;
  timerSeconds = 0;
  timerStarted = false;
  flippedCards = [];
  matchedPairs = 0;
  isBoardLocked = false;

  clearInterval(timerInterval);

  // Update HUD
  const config = LEVEL_CONFIGS[lvl];
  totalPairsInLevel = config.pairs;
  document.getElementById('hudLevelName').innerText = `Level ${lvl}`;
  document.getElementById('hudMoves').innerText = '0';
  document.getElementById('hudTimer').innerText = '00:00';
  document.getElementById('hudPairs').innerText = `0 / ${totalPairsInLevel}`;

  // Generate cards
  const { cards } = generateCardsForLevel(lvl);
  const board = document.getElementById('gameBoard');
  board.className = `game-board board-${cards.length}`;
  board.innerHTML = '';

  cards.forEach(cardData => {
    const cardEl = document.createElement('div');
    cardEl.className = 'math-card';
    cardEl.dataset.cardId = cardData.id;
    cardEl.dataset.target = cardData.targetValue;
    cardEl.dataset.pairId = cardData.pairId;

    cardEl.innerHTML = `
      <div class="math-card-inner">
        <div class="math-card-back"></div>
        <div class="math-card-front">${cardData.expression}</div>
      </div>
    `;

    cardEl.addEventListener('click', () => handleCardClick(cardEl, cardData));
    board.appendChild(cardEl);
  });

  showScreen('screenGame');
}

function startTimerIfNeeded() {
  if (timerStarted) return;
  timerStarted = true;
  timerInterval = setInterval(() => {
    timerSeconds++;
    const mins = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
    const secs = String(timerSeconds % 60).padStart(2, '0');
    document.getElementById('hudTimer').innerText = `${mins}:${secs}`;
  }, 1000);
}

function handleCardClick(cardEl, cardData) {
  if (isBoardLocked) return;
  if (cardEl.classList.contains('flipped') || cardEl.classList.contains('matched')) return;

  startTimerIfNeeded();
  SoundManager.flip();

  cardEl.classList.add('flipped');
  flippedCards.push({ element: cardEl, data: cardData });

  if (flippedCards.length === 2) {
    movesCount++;
    document.getElementById('hudMoves').innerText = movesCount;
    checkMatch();
  }
}

function checkMatch() {
  const [first, second] = flippedCards;
  const isMatch = (first.data.pairId === second.data.pairId) || 
                  (first.data.targetValue === second.data.targetValue);

  if (isMatch) {
    // Jawaban Benar
    isBoardLocked = true;
    setTimeout(() => {
      SoundManager.match();
      first.element.classList.add('matched');
      second.element.classList.add('matched');

      matchedPairs++;
      document.getElementById('hudPairs').innerText = `${matchedPairs} / ${totalPairsInLevel}`;
      flippedCards = [];
      isBoardLocked = false;

      // Cek apakah game selesai
      if (matchedPairs === totalPairsInLevel) {
        handleLevelComplete();
      }
    }, 450);
  } else {
    // Jawaban Salah
    isBoardLocked = true;
    setTimeout(() => {
      SoundManager.wrong();
      first.element.classList.add('wrong');
      second.element.classList.add('wrong');
    }, 350);

    setTimeout(() => {
      first.element.classList.remove('flipped', 'wrong');
      second.element.classList.remove('flipped', 'wrong');
      flippedCards = [];
      isBoardLocked = false;
    }, 1100);
  }
}

function handleLevelComplete() {
  clearInterval(timerInterval);
  SoundManager.win();

  const finalStats = calculateScore(currentLevel, movesCount, timerSeconds);
  const mins = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
  const secs = String(timerSeconds % 60).padStart(2, '0');
  const timeFormatted = `${mins}:${secs}`;

  // Cek dan simpan skor terbaik
  const prevBest = player.scores[currentLevel] ? player.scores[currentLevel].score : 0;
  const isNewBest = finalStats.score > prevBest;

  if (!player.scores[currentLevel] || isNewBest) {
    player.scores[currentLevel] = {
      score: finalStats.score,
      moves: movesCount,
      time: timerSeconds,
      stars: finalStats.stars
    };
  }

  // Unlock level berikutnya jika level ini adalah level tertinggi yg dicapai
  let unlockNotice = '';
  if (currentLevel === player.unlockedLevel && player.unlockedLevel < 10) {
    player.unlockedLevel++;
    unlockNotice = `🎉 Level ${player.unlockedLevel} Terbuka!`;
  }

  savePlayerData();

  // Tampilkan Modal Hasil
  const modal = document.getElementById('modalResult');
  document.getElementById('resTitle').innerText = `Level ${currentLevel} Selesai!`;
  document.getElementById('resStars').innerText = '⭐'.repeat(finalStats.stars) + '☆'.repeat(3 - finalStats.stars);
  document.getElementById('resScore').innerText = `${finalStats.score} PTS`;
  document.getElementById('resMoves').innerText = movesCount;
  document.getElementById('resTime').innerText = timeFormatted;
  document.getElementById('resBestScore').innerText = Math.max(prevBest, finalStats.score);

  const unlockEl = document.getElementById('resUnlockMsg');
  if (unlockNotice) {
    unlockEl.innerText = unlockNotice;
    unlockEl.style.display = 'block';
  } else {
    unlockEl.style.display = 'none';
  }

  const nextBtn = document.getElementById('btnNextLevel');
  if (currentLevel < 10) {
    nextBtn.style.display = 'inline-flex';
    nextBtn.onclick = () => {
      modal.classList.remove('active');
      startLevel(currentLevel + 1);
    };
  } else {
    nextBtn.style.display = 'none';
  }

  modal.classList.add('active');
}

// =================== LEADERBOARD & PROFILE ===================
function renderLeaderboard() {
  const tbody = document.getElementById('leaderboardBody');
  tbody.innerHTML = '';

  const list = getLeaderboard();
  list.forEach((item, idx) => {
    const tr = document.createElement('tr');
    if (item.id === player.id) {
      tr.className = 'highlight-user';
    }

    let rankBadge = `<span class="rank-badge">${idx + 1}</span>`;
    if (idx === 0) rankBadge = `<span class="rank-badge rank-1">🥇</span>`;
    if (idx === 1) rankBadge = `<span class="rank-badge rank-2">🥈</span>`;
    if (idx === 2) rankBadge = `<span class="rank-badge rank-3">🥉</span>`;

    const mins = String(Math.floor((item.totalTime || 0) / 60)).padStart(2, '0');
    const secs = String((item.totalTime || 0) % 60).padStart(2, '0');

    tr.innerHTML = `
      <td>${rankBadge}</td>
      <td><strong>${item.name}</strong> ${item.id === player.id ? '(Kamu)' : ''}</td>
      <td><strong>${(item.totalScore || 0).toLocaleString()}</strong></td>
      <td>${item.totalMoves || 0}</td>
      <td>${mins}:${secs}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderProfile() {
  document.getElementById('profName').innerText = player.name;
  let totalScore = 0;
  let totalMoves = 0;
  let totalSecs = 0;
  let completed = 0;

  for (let i = 1; i <= 10; i++) {
    if (player.scores[i]) {
      totalScore += player.scores[i].score;
      totalMoves += player.scores[i].moves;
      totalSecs += player.scores[i].time;
      completed++;
    }
  }

  document.getElementById('profTotalScore').innerText = totalScore.toLocaleString();
  document.getElementById('profCompleted').innerText = `${completed} / 10`;
  document.getElementById('profMaxLevel').innerText = `Level ${player.unlockedLevel}`;

  // History list
  const historyList = document.getElementById('profLevelHistory');
  historyList.innerHTML = '';
  for (let i = 1; i <= 10; i++) {
    const d = player.scores[i];
    const li = document.createElement('div');
    li.style.display = 'flex';
    li.style.justifyContent = 'space-between';
    li.style.padding = '10px 0';
    li.style.borderBottom = '1px solid #e2e8f0';

    if (d) {
      const mins = String(Math.floor(d.time / 60)).padStart(2, '0');
      const secs = String(d.time % 60).padStart(2, '0');
      li.innerHTML = `
        <div><strong>Level ${i}</strong> ${'⭐'.repeat(d.stars)}</div>
        <div><strong style="color:var(--primary)">${d.score} Pts</strong> (${d.moves} moves, ${mins}:${secs})</div>
      `;
    } else {
      li.innerHTML = `
        <div style="color:#94a3b8">Level ${i}</div>
        <div style="color:#94a3b8">${i <= player.unlockedLevel ? 'Belum dimainkan' : 'Terkunci'}</div>
      `;
    }
    historyList.appendChild(li);
  }
}

function resetPlayerData() {
  if (confirm('Apakah kamu yakin ingin mereset seluruh progres permainan?')) {
    localStorage.removeItem(STORAGE_KEY_PLAYER);
    location.reload();
  }
}

