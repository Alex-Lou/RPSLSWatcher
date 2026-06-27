/**
 * mock — dataset DÉMO réaliste (fallback quand le backend n'a pas encore de
 * données). Seedé → déterministe. Reflète l'équilibre MESURÉ des Voies (Cosmos
 * fort, Mirage faible…) + un biais joueur (on gagne plus souvent vs CPU), pour
 * que tous les graphes soient vivants et plausibles avant la 1re vraie partie.
 */
import { MOVES, type EndReason, type MatchRecord, type Mode, type Move, type Result } from "./types";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Force relative de chaque Voie (≈ win-rate de base mesuré en sim).
const VOIE_STRENGTH: Record<Move, number> = {
  spock: 0.71,
  paper: 0.62,
  scissors: 0.46,
  rock: 0.43,
  lizard: 0.24,
};

/** Tirage ~normal (somme de 3 uniformes), clampé [lo, hi]. */
function gaussish(rng: () => number, mean: number, spread: number, lo: number, hi: number): number {
  const u = (rng() + rng() + rng()) / 3 - 0.5; // ~N(0, …), borné [-0.5,0.5]
  return Math.max(lo, Math.min(hi, Math.round(mean + u * spread * 2)));
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function trajectory(rng: () => number, turns: number, finalHp: number): number[] {
  const out = [20];
  for (let t = 1; t <= turns; t++) {
    const target = 20 - ((20 - finalHp) * t) / turns;
    out.push(Math.max(0, Math.round(target + (rng() - 0.5) * 3)));
  }
  out[out.length - 1] = finalHp;
  return out;
}

export function generateMockMatches(count = 280, seed = 0xc0ffee): MatchRecord[] {
  const rng = mulberry32(seed);
  const now = 1_750_000_000_000; // base fixe (déterminisme) ~mi-2025
  const DAY = 86_400_000;
  const out: MatchRecord[] = [];

  for (let i = 0; i < count; i++) {
    const playerVoie = pick(rng, MOVES);
    const oppKind = rng() < 0.78 ? "cpu" : "human";
    const oppVoie: Move | null = rng() < 0.92 ? pick(rng, MOVES) : null;
    const mode: Mode = rng() < 0.62 ? "pro" : "ranked";

    // proba de victoire = force Voie + bonus joueur (skill vs CPU) ± matchup
    let pWin = VOIE_STRENGTH[playerVoie];
    if (oppKind === "cpu") pWin += 0.12; // le joueur bat plus souvent l'IA
    if (oppVoie) pWin += (VOIE_STRENGTH[playerVoie] - VOIE_STRENGTH[oppVoie]) * 0.3;
    pWin = Math.max(0.08, Math.min(0.94, pWin));

    const roll = rng();
    const result: Result = roll < pWin ? "win" : roll < pWin + 0.06 ? "draw" : "loss";

    const turns = gaussish(rng, 10, 3, 4, 15);
    const finalHpSelf = result === "win" ? gaussish(rng, 9, 4, 1, 20) : result === "draw" ? gaussish(rng, 3, 2, 0, 6) : 0;
    const finalHpOpp = result === "loss" ? gaussish(rng, 9, 4, 1, 20) : result === "draw" ? gaussish(rng, 3, 2, 0, 6) : 0;
    const endReason: EndReason = turns >= 15 ? "hardcap" : finalHpSelf === 0 || finalHpOpp === 0 ? "ko" : "suddendeath";

    out.push({
      v: 1,
      id: `mock-${i.toString(36)}-${Math.floor(rng() * 1e9).toString(36)}`,
      ts: now - (count - i) * (DAY / 6) - Math.floor(rng() * DAY * 0.4),
      mode,
      playerVoie,
      oppVoie,
      oppKind,
      result,
      turns,
      finalHpSelf,
      finalHpOpp,
      finisherFired: rng() < 0.18 + VOIE_STRENGTH[playerVoie] * 0.15,
      oppFinisherFired: rng() < 0.16,
      hpTrajectorySelf: trajectory(rng, turns, finalHpSelf),
      hpTrajectoryOpp: trajectory(rng, turns, finalHpOpp),
      endReason,
      appVersion: "0.4.48",
    });
  }
  return out.sort((a, b) => a.ts - b.ts);
}
