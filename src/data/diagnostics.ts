/**
 * diagnostics — analyse EXPERTE au niveau du tour (consomme turnLog, v:2).
 * Toutes les fonctions sont PURES et tolèrent l'absence de turnLog : elles ne
 * regardent que les parties v:2. Vulgarisé côté UI/verdict.
 *
 * Ce que ça juge, en clair : le rythme (mana gaspillé), la pioche (noyée vs
 * affamée), le LEVIER D'AFFINITÉ (jouer dans sa Voie paye-t-il ?), les points
 * morts, la provenance des dégâts (KO sec vs frappe directe vs sorts) et le
 * timing réel du finisher.
 */
import { mean } from "./analysis";
import { MOVES, type ArenaTurnEvent, type MatchRecord, type Move } from "./types";

type LoggedMatch = MatchRecord & { turnLog: ArenaTurnEvent[] };

/** Parties disposant du déroulé tour par tour (v:2). */
export function withTurnLog(matches: MatchRecord[]): LoggedMatch[] {
  return matches.filter(
    (m): m is LoggedMatch => Array.isArray(m.turnLog) && m.turnLog.length > 0,
  );
}

const byVoieZero = (): Record<Move, number> => ({ rock: 0, paper: 0, scissors: 0, lizard: 0, spock: 0 });

// Seuils heuristiques (tunables) pour qualifier la pioche.
const FLOOD_HAND = 6; // main « saturée » : beaucoup de cartes bloquées
const STARVE_HAND = 1; // main « affamée »

const isWin = (m: MatchRecord) => m.result === "win";

/* ───────────────────────────── Tempo / mana ────────────────────────────── */

export interface TempoStats {
  n: number;
  wastedPerTurn: number; // moyenne (manaMax − manaSpent)
  byVoie: Record<Move, number>;
}

export function tempoStats(matches: MatchRecord[]): TempoStats {
  const ms = withTurnLog(matches);
  const waste = (rec: LoggedMatch[]): number => {
    const perTurn: number[] = [];
    for (const m of rec) for (const t of m.turnLog) perTurn.push(Math.max(0, t.manaMax - t.manaSpent));
    return mean(perTurn);
  };
  const byVoie = byVoieZero();
  for (const v of MOVES) byVoie[v] = waste(ms.filter((m) => m.playerVoie === v));
  return { n: ms.length, wastedPerTurn: waste(ms), byVoie };
}

/* ───────────────────────────── Pioche ──────────────────────────────────── */

export interface DrawStats {
  n: number;
  avgHandStart: number;
  floodedRate: number; // % tours main saturée (≥ FLOOD_HAND)
  starvedRate: number; // % tours main affamée (≤ STARVE_HAND) ou deck vide (fatigue)
  byVoie: Record<Move, { flooded: number; starved: number }>;
}

export function drawStats(matches: MatchRecord[]): DrawStats {
  const ms = withTurnLog(matches);
  const calc = (rec: LoggedMatch[]) => {
    let turns = 0, flooded = 0, starved = 0, handSum = 0;
    for (const m of rec)
      for (const t of m.turnLog) {
        turns++;
        handSum += t.handStart;
        if (t.handStart >= FLOOD_HAND) flooded++;
        if (t.handStart <= STARVE_HAND || t.deckLeft === 0) starved++;
      }
    return { turns, flooded: turns ? flooded / turns : 0, starved: turns ? starved / turns : 0, avgHand: turns ? handSum / turns : 0 };
  };
  const all = calc(ms);
  const byVoie = {} as Record<Move, { flooded: number; starved: number }>;
  for (const v of MOVES) {
    const c = calc(ms.filter((m) => m.playerVoie === v));
    byVoie[v] = { flooded: c.flooded, starved: c.starved };
  }
  return { n: ms.length, avgHandStart: all.avgHand, floodedRate: all.flooded, starvedRate: all.starved, byVoie };
}

/* ─────────────────────────── Levier d'affinité ─────────────────────────── */

export interface AffinityLeverage {
  n: number;
  playRate: number; // % d'invocations DANS ma Voie
  engineRiseRate: number; // % de tours où ma jauge monte
  byVoie: Record<Move, { playRate: number; engineRiseRate: number }>;
  winRateHiAff: number | null; // win-rate quand je joue surtout dans ma Voie (ratio ≥ 0.6)
  winRateLoAff: number | null;
  leverage: number | null; // hi − lo (positif = jouer dans sa Voie paye)
}

/** Ratio d'invocations dans la Voie pour UNE partie. null si aucune invocation. */
function matchAffinityRatio(m: LoggedMatch): number | null {
  let inV = 0, total = 0;
  for (const t of m.turnLog)
    for (const p of t.plays)
      if (p.kind === "summon" && p.move) {
        total++;
        if (p.affinity) inV++;
      }
  return total ? inV / total : null;
}

export function affinityLeverage(matches: MatchRecord[]): AffinityLeverage {
  const ms = withTurnLog(matches);
  const rate = (rec: LoggedMatch[]) => {
    let inV = 0, total = 0, riseTurns = 0, turns = 0;
    for (const m of rec)
      for (const t of m.turnLog) {
        turns++;
        if (t.engineRose) riseTurns++;
        for (const p of t.plays)
          if (p.kind === "summon" && p.move) {
            total++;
            if (p.affinity) inV++;
          }
      }
    return { playRate: total ? inV / total : 0, engineRiseRate: turns ? riseTurns / turns : 0 };
  };
  const all = rate(ms);
  const byVoie = {} as Record<Move, { playRate: number; engineRiseRate: number }>;
  for (const v of MOVES) byVoie[v] = rate(ms.filter((m) => m.playerVoie === v));

  const hi: LoggedMatch[] = [];
  const lo: LoggedMatch[] = [];
  for (const m of ms) {
    const r = matchAffinityRatio(m);
    if (r === null) continue;
    (r >= 0.6 ? hi : lo).push(m);
  }
  const wr = (rec: LoggedMatch[]) => (rec.length ? rec.filter(isWin).length / rec.length : 0);
  const GATE = 8;
  const winRateHiAff = hi.length >= GATE ? wr(hi) : null;
  const winRateLoAff = lo.length >= GATE ? wr(lo) : null;
  const leverage = winRateHiAff !== null && winRateLoAff !== null ? winRateHiAff - winRateLoAff : null;
  return { n: ms.length, playRate: all.playRate, engineRiseRate: all.engineRiseRate, byVoie, winRateHiAff, winRateLoAff, leverage };
}

/* ───────────────────────────── Points morts ────────────────────────────── */

export interface DeadTurnStats {
  n: number;
  rate: number; // % de tours « morts » (rien ne bouge)
  byVoie: Record<Move, number>;
  byTurn: number[]; // index = n° de tour → fraction de parties où ce tour est mort
}

export function deadTurnStats(matches: MatchRecord[]): DeadTurnStats {
  const ms = withTurnLog(matches);
  const rate = (rec: LoggedMatch[]) => {
    let dead = 0, turns = 0;
    for (const m of rec) for (const t of m.turnLog) (turns++, t.deadTurn && dead++);
    return turns ? dead / turns : 0;
  };
  const byVoie = byVoieZero();
  for (const v of MOVES) byVoie[v] = rate(ms.filter((m) => m.playerVoie === v));

  const maxLen = ms.reduce((mx, m) => Math.max(mx, m.turnLog.length), 0);
  const deadCnt = new Array(maxLen).fill(0);
  const tot = new Array(maxLen).fill(0);
  for (const m of ms)
    m.turnLog.forEach((t, i) => {
      tot[i]++;
      if (t.deadTurn) deadCnt[i]++;
    });
  const byTurn = deadCnt.map((d, i) => (tot[i] ? d / tot[i] : 0));
  return { n: ms.length, rate: rate(ms), byVoie, byTurn };
}

/* ─────────────────────── Provenance des dégâts (Tier B) ─────────────────── */

export interface DamageChannels {
  n: number; // parties avec résolution par lane
  counterSplash: number; // part des PV infligés à l'adv via splash d'un contre gagnant
  direct: number; // via créature en lane vide (frappe directe)
  other: number; // résiduel = sorts + chip Cosmos
  koLaneRate: number; // part des lanes en combat finissant par un KO sec
}

export function damageChannels(matches: MatchRecord[]): DamageChannels {
  const ms = withTurnLog(matches).filter((m) => m.turnLog.some((t) => t.lanes && t.lanes.length));
  let splash = 0, direct = 0, totalToOpp = 0, koLanes = 0, combatLanes = 0;
  for (const m of ms)
    for (const t of m.turnLog) {
      totalToOpp += Math.max(0, -t.dHpOpp);
      for (const l of t.lanes ?? []) {
        splash += l.splashToOpp;
        direct += l.directToOpp;
        const combat = l.result === "counterWinSelf" || l.result === "counterWinOpp" || l.result === "mirror";
        if (combat) combatLanes++;
        if ((l.result === "counterWinSelf" || l.result === "counterWinOpp") && (l.killOpp || l.killSelf)) koLanes++;
      }
    }
  const other = Math.max(0, totalToOpp - splash - direct);
  const denom = splash + direct + other || 1;
  return {
    n: ms.length,
    counterSplash: splash / denom,
    direct: direct / denom,
    other: other / denom,
    koLaneRate: combatLanes ? koLanes / combatLanes : 0,
  };
}

/* ───────────────────────────── Timing finisher ─────────────────────────── */

export interface FinisherTiming {
  n: number; // parties (v:2) où mon finisher s'est débloqué
  avgUnlockTurn: number; // tour moyen de déblocage
  winRateAfterUnlock: number | null; // win-rate quand le finisher s'est débloqué
}

export function finisherTiming(matches: MatchRecord[]): FinisherTiming {
  const ms = withTurnLog(matches);
  const unlocked: { turn: number; win: boolean }[] = [];
  for (const m of ms) {
    const idx = m.turnLog.findIndex((t) => t.finisherUnlocked);
    if (idx >= 0) unlocked.push({ turn: m.turnLog[idx].turn, win: isWin(m) });
  }
  return {
    n: unlocked.length,
    avgUnlockTurn: unlocked.length ? mean(unlocked.map((u) => u.turn)) : 0,
    winRateAfterUnlock: unlocked.length >= 8 ? unlocked.filter((u) => u.win).length / unlocked.length : null,
  };
}

/* ──────────────────────── Confiance statistique (Wilson) ────────────────── */

/** Intervalle de Wilson (95% par défaut) pour un win-rate — garde le bruit. */
export function wilson(wins: number, n: number, z = 1.96): { lo: number; hi: number } {
  if (n <= 0) return { lo: 0, hi: 1 };
  const p = wins / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)) / denom;
  return { lo: Math.max(0, center - margin), hi: Math.min(1, center + margin) };
}
