/**
 * mock — dataset DÉMO réaliste (fallback quand le backend n'a pas encore de
 * données). Seedé → déterministe. Reflète l'équilibre MESURÉ des Voies (Cosmos
 * fort, Mirage faible…) + un biais joueur (on gagne plus souvent vs CPU), pour
 * que tous les graphes soient vivants et plausibles avant la 1re vraie partie.
 */
import {
  MOVES,
  RPSLS_BEATS,
  type ArenaTurnEvent,
  type EndReason,
  type LaneOutcome,
  type LaneResult,
  type MatchRecord,
  type Mode,
  type Move,
  type Result,
  type TurnPlay,
} from "./types";

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

/** Déroulé tour par tour PLAUSIBLE (démo v:2) — cohérent avec les trajectoires. */
function mockTurnLog(
  rng: () => number,
  turns: number,
  trajSelf: number[],
  trajOpp: number[],
  playerVoie: Move,
  oppVoie: Move | null,
  finisherSelf: boolean,
): ArenaTurnEvent[] {
  const log: ArenaTurnEvent[] = [];
  let engine = 0, engineOpp = 0, deck = 26, unlocked = false;
  const finisherTurn = finisherSelf ? Math.min(turns, 6 + Math.floor(rng() * 5)) : -1;
  for (let t = 1; t <= turns; t++) {
    const hpSelf = trajSelf[t] ?? trajSelf[trajSelf.length - 1] ?? 0;
    const hpOpp = trajOpp[t] ?? trajOpp[trajOpp.length - 1] ?? 0;
    const dHpSelf = hpSelf - (trajSelf[t - 1] ?? 20);
    const dHpOpp = hpOpp - (trajOpp[t - 1] ?? 20);
    const manaMax = Math.min(10, t);

    const plays: TurnPlay[] = [];
    let manaSpent = 0;
    const nSummon = rng() < 0.2 ? 0 : 1 + (rng() < 0.35 ? 1 : 0);
    for (let s = 0; s < nSummon; s++) {
      const move = rng() < 0.62 ? playerVoie : pick(rng, MOVES);
      plays.push({ kind: "summon", card: `c${Math.floor(rng() * 40)}`, lane: s % 3, move, affinity: move === playerVoie, manaCost: 1 });
      manaSpent += 1;
    }
    if (rng() < 0.4) {
      const cost = 1 + Math.floor(rng() * 3);
      plays.push({ kind: "spell", card: `s${Math.floor(rng() * 20)}`, affinity: false, manaCost: cost });
      manaSpent += cost;
    }
    manaSpent = Math.min(manaMax, manaSpent);

    const playsOpp: TurnPlay[] = [];
    if (rng() > 0.25) {
      const move = oppVoie && rng() < 0.6 ? oppVoie : pick(rng, MOVES);
      playsOpp.push({ kind: "summon", card: `o${Math.floor(rng() * 40)}`, lane: 0, move, affinity: !!oppVoie && move === oppVoie, manaCost: 1 });
    }

    const rose = rng() < 0.45 && plays.some((p) => p.affinity);
    if (rose && engine < 3) engine++;
    if (rng() < 0.3 && engineOpp < 3) engineOpp++;
    if (t === finisherTurn && !unlocked) {
      engine = 3;
      unlocked = true;
    }

    const toOpp = Math.max(0, -dHpOpp);
    const lanes: LaneOutcome[] = [];
    const myMove = plays.find((p) => p.kind === "summon")?.move ?? null;
    const oppMove = playsOpp.find((p) => p.kind === "summon")?.move ?? null;
    if (myMove || oppMove) {
      let result: LaneResult = "none";
      let splashToOpp = 0, directToOpp = 0, killOpp = false, killSelf = false;
      if (myMove && oppMove) {
        if (RPSLS_BEATS[myMove].includes(oppMove)) {
          result = "counterWinSelf";
          killOpp = true;
          splashToOpp = Math.min(toOpp, 1 + Math.floor(rng() * 3));
        } else if (RPSLS_BEATS[oppMove].includes(myMove)) {
          result = "counterWinOpp";
          killSelf = true;
        } else result = "mirror";
      } else if (myMove) {
        result = "emptySelf";
        directToOpp = Math.min(toOpp, 2 + Math.floor(rng() * 3));
      } else result = "emptyOpp";
      lanes.push({ lane: 0, selfMove: myMove, oppMove, result, killSelf, killOpp, saved: false, splashToOpp, splashToSelf: 0, directToOpp, directToSelf: 0 });
    }

    deck = Math.max(0, deck - nSummon - 1);
    log.push({
      turn: t,
      manaMax,
      manaSpent,
      handStart: Math.max(0, 3 + Math.floor(rng() * 4) - Math.floor(t / 4)),
      drawn: t === 1 ? 5 : 2,
      deckLeft: deck,
      plays,
      playsOpp,
      engine,
      engineOpp,
      engineRose: rose,
      finisherUnlocked: t === finisherTurn,
      hpSelf,
      hpOpp,
      dHpSelf,
      dHpOpp,
      deadTurn: dHpSelf === 0 && dHpOpp === 0 && !rose,
      lanes,
    });
  }
  return log;
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

    const finisherFired = rng() < 0.18 + VOIE_STRENGTH[playerVoie] * 0.15;
    const trajSelf = trajectory(rng, turns, finalHpSelf);
    const trajOpp = trajectory(rng, turns, finalHpOpp);
    // ~65% des parties (les plus récentes) ont le déroulé détaillé v:2 ; le reste
    // reste en v:1 pour démontrer la dégradation gracieuse (mix réel à venir).
    const hasLog = i >= count * 0.35;
    const turnLog = hasLog ? mockTurnLog(rng, turns, trajSelf, trajOpp, playerVoie, oppVoie, finisherFired) : undefined;

    out.push({
      v: hasLog ? 2 : 1,
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
      finisherFired,
      oppFinisherFired: rng() < 0.16,
      hpTrajectorySelf: trajSelf,
      hpTrajectoryOpp: trajOpp,
      endReason,
      appVersion: "0.4.48",
      ...(turnLog ? { turnLog } : {}),
    });
  }
  return out.sort((a, b) => a.ts - b.ts);
}
