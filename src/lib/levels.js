// src/lib/levels.js - Generator Soal Matematika MathPairs (ES Module)

export const LEVEL_CONFIGS = {
  1: { cards: 10, pairs: 5, ops: ['+', '-'], maxNum: 15, baseScore: 1000, targetTime: 35, title: "Penjumlahan & Pengurangan Dasar" },
  2: { cards: 20, pairs: 10, ops: ['+', '-'], maxNum: 25, baseScore: 1200, targetTime: 60, title: "Penjumlahan & Pengurangan Lanjutan" },
  3: { cards: 30, pairs: 15, ops: ['+', '-', '*'], maxNum: 30, baseScore: 1500, targetTime: 90, title: "Pengenalan Perkalian" },
  4: { cards: 40, pairs: 20, ops: ['+', '-', '*'], maxNum: 50, baseScore: 1800, targetTime: 120, title: "Kombinasi Tambah, Kurang, Kali" },
  5: { cards: 50, pairs: 25, ops: ['+', '-', '*', '/'], maxNum: 50, baseScore: 2200, targetTime: 150, title: "Empat Operasi Dasar Lengkap" },
  6: { cards: 60, pairs: 30, ops: ['+', '-', '*', '/'], maxNum: 70, baseScore: 2600, targetTime: 180, title: "Operasi Variatif" },
  7: { cards: 70, pairs: 35, ops: ['+', '-', '*', '/'], maxNum: 90, baseScore: 3000, targetTime: 210, title: "Angka Lebih Besar" },
  8: { cards: 80, pairs: 40, ops: ['+', '-', '*', '/'], maxNum: 100, baseScore: 3500, targetTime: 240, title: "Tantangan Menengah" },
  9: { cards: 90, pairs: 45, ops: ['+', '-', '*', '/'], maxNum: 120, baseScore: 4000, targetTime: 270, title: "Tantangan Tingkat Tinggi" },
  10: { cards: 100, pairs: 50, ops: ['+', '-', '*', '/'], maxNum: 150, baseScore: 5000, targetTime: 300, title: "Master Matematika Kelas 6" }
};

function generateExpressionsForTarget(R, allowedOps) {
  const expressions = [];

  // Penjumlahan (a + b = R)
  if (allowedOps.includes('+') && R >= 2) {
    const a = Math.floor(Math.random() * (R - 1)) + 1;
    const b = R - a;
    expressions.push({ text: `${a} + ${b}`, op: '+' });
  }

  // Pengurangan (a - b = R)
  if (allowedOps.includes('-')) {
    const b = Math.floor(Math.random() * 12) + 1;
    const a = R + b;
    expressions.push({ text: `${a} − ${b}`, op: '-' });
  }

  // Perkalian (a * b = R)
  if (allowedOps.includes('*')) {
    const factors = [];
    for (let i = 2; i <= Math.sqrt(R); i++) {
      if (R % i === 0) factors.push(i);
    }
    if (factors.length > 0) {
      const f = factors[Math.floor(Math.random() * factors.length)];
      expressions.push({ text: `${f} × ${R / f}`, op: '*' });
    } else if (R <= 12) {
      expressions.push({ text: `1 × ${R}`, op: '*' });
    }
  }

  // Pembagian (a / b = R)
  if (allowedOps.includes('/')) {
    const bList = [2, 3, 4, 5, 6, 7, 8, 9];
    const b = bList[Math.floor(Math.random() * bList.length)];
    const a = R * b;
    expressions.push({ text: `${a} ÷ ${b}`, op: '/' });
  }

  // Fallback jaminan 2 ekspresi
  while (expressions.length < 2) {
    const offset = Math.floor(Math.random() * 8) + 1;
    if (Math.random() > 0.5) {
      expressions.push({ text: `${R + offset} − ${offset}`, op: '-' });
    } else {
      const half = Math.floor(R / 2);
      expressions.push({ text: `${half} + ${R - half}`, op: '+' });
    }
  }

  const unique = [];
  const seen = new Set();
  for (const exp of expressions.sort(() => Math.random() - 0.5)) {
    if (!seen.has(exp.text)) {
      seen.add(exp.text);
      unique.push(exp);
      if (unique.length === 2) break;
    }
  }

  if (unique.length < 2) {
    unique.push({ text: `${R + 3} − 3`, op: '-' });
  }

  return unique;
}

export function generateCardsForLevel(levelNumber) {
  const config = LEVEL_CONFIGS[levelNumber] || LEVEL_CONFIGS[1];
  const pairCount = config.pairs;
  const cards = [];
  const usedTargets = new Set();

  let attempts = 0;
  while (usedTargets.size < pairCount && attempts < 2000) {
    attempts++;
    let minR = 2;
    let maxR = Math.min(config.maxNum, 80);
    if (config.ops.includes('*') || config.ops.includes('/')) {
      minR = 3;
    }
    const targetR = Math.floor(Math.random() * (maxR - minR + 1)) + minR;

    if (!usedTargets.has(targetR)) {
      const exprs = generateExpressionsForTarget(targetR, config.ops);
      if (exprs.length >= 2 && exprs[0].text !== exprs[1].text) {
        usedTargets.add(targetR);
        const pairId = `pair_${targetR}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

        cards.push({
          id: `card_${cards.length}_a`,
          pairId,
          targetValue: targetR,
          expression: exprs[0].text
        });

        cards.push({
          id: `card_${cards.length}_b`,
          pairId,
          targetValue: targetR,
          expression: exprs[1].text
        });
      }
    }
  }

  // Shuffle Fisher-Yates
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }

  return { cards, config };
}

export function calculateScore(levelNumber, actualMoves, actualSeconds) {
  const config = LEVEL_CONFIGS[levelNumber] || LEVEL_CONFIGS[1];
  const minMoves = config.pairs;
  const targetTime = config.targetTime;
  const baseScore = config.baseScore;

  const moveEff = Math.min(1.0, minMoves / Math.max(minMoves, actualMoves));
  const timeEff = Math.min(1.0, targetTime / Math.max(targetTime, actualSeconds));
  const totalEff = (0.6 * moveEff) + (0.4 * timeEff);

  const finalScore = Math.max(100, Math.round((baseScore * totalEff) / 10) * 10);
  return {
    score: Math.min(baseScore, finalScore),
    stars: totalEff >= 0.85 ? 3 : totalEff >= 0.65 ? 2 : 1,
    efficiencyPercent: Math.round(totalEff * 100)
  };
}

