/**
 * analysis — toute la stat-math du Watcher, pure et testable. Filtrage CÔTÉ
 * CLIENT + agrégations (win-rate par Voie, matchups, distributions + ajustement
 * gaussien, séries temporelles, trajectoires PV, KPI). Vulgarisé côté UI.
 */
import {
  MOVES,
  RPSLS_BEATS,
  type Distribution,
  type Filters,
  type Kpis,
  type MatchRecord,
  type MatchupCell,
  type Move,
  type OppKind,
  type Result,
  type TimePoint,
  type VoieAgg,
} from "./types";

/* ─────────────────────────────── Filtrage ─────────────────────────────── */

export function applyFilters(matches: MatchRecord[], f: Filters): MatchRecord[] {
  return matches.filter((m) => {
    if (f.voies.length && !f.voies.includes(m.playerVoie)) return false;
    if (f.results.length && !f.results.includes(m.result)) return false;
    if (f.oppKinds.length && !f.oppKinds.includes(m.oppKind)) return false;
    if (f.modes.length && !f.modes.includes(m.mode)) return false;
    if (f.since != null && m.ts < f.since) return false;
    if (f.until != null && m.ts > f.until) return false;
    return true;
  });
}

/* ───────────────────────────────── KPI ─────────────────────────────────── */

const isWin = (r: Result) => r === "win";

/** Tri chronologique DÉTERMINISTE (ts puis id) — partagé par kpis et streaks pour
 *  qu'ils désignent EXACTEMENT la même « dernière partie » sur des ts égaux. */
function sortChrono(ms: MatchRecord[]): MatchRecord[] {
  return [...ms].sort((a, b) => a.ts - b.ts || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function kpis(matches: MatchRecord[]): Kpis {
  const games = matches.length;
  if (games === 0) {
    return { games: 0, winRate: 0, avgTurns: 0, finisherRate: 0, bestVoie: null, worstVoie: null, currentStreak: null };
  }
  const wins = matches.filter((m) => isWin(m.result)).length;
  const aggs = voieAggs(matches).filter((a) => a.games >= 3);
  const sorted = [...aggs].sort((a, b) => b.winRate - a.winRate);
  // streak : depuis la partie la plus récente (tri chronologique partagé).
  const chrono = sortChrono(matches);
  const streakKind = chrono[chrono.length - 1].result;
  let len = 0;
  for (let i = chrono.length - 1; i >= 0 && chrono[i].result === streakKind; i--) len++;
  return {
    games,
    winRate: wins / games,
    avgTurns: mean(matches.map((m) => m.turns)),
    finisherRate: matches.filter((m) => m.finisherFired).length / games,
    bestVoie: sorted[0]?.voie ?? null,
    worstVoie: sorted[sorted.length - 1]?.voie ?? null,
    currentStreak: { kind: streakKind, length: len },
  };
}

/* ───────────────────────────── Par Voie ───────────────────────────────── */

export function voieAggs(matches: MatchRecord[]): VoieAgg[] {
  return MOVES.map((voie) => {
    const ms = matches.filter((m) => m.playerVoie === voie);
    const g = ms.length;
    const wins = ms.filter((m) => isWin(m.result)).length;
    const losses = ms.filter((m) => m.result === "loss").length;
    const draws = ms.filter((m) => m.result === "draw").length;
    return {
      voie,
      games: g,
      wins,
      losses,
      draws,
      winRate: g ? wins / g : 0,
      avgTurns: g ? mean(ms.map((m) => m.turns)) : 0,
      avgFinalHp: g ? mean(ms.map((m) => m.finalHpSelf)) : 0,
      finisherRate: g ? ms.filter((m) => m.finisherFired).length / g : 0,
    };
  });
}

/** Matrice [ma Voie][Voie adverse] = mon win-rate (parties avec oppVoie connue). */
export function matchupMatrix(matches: MatchRecord[]): MatchupCell[] {
  const cells: MatchupCell[] = [];
  for (const att of MOVES) {
    for (const def of MOVES) {
      const ms = matches.filter((m) => m.playerVoie === att && m.oppVoie === def);
      cells.push({ att, def, games: ms.length, winRate: ms.length ? ms.filter((m) => isWin(m.result)).length / ms.length : NaN });
    }
  }
  return cells;
}

/* ─────────────────────── Distribution + Gauss ──────────────────────────── */

export function distribution(values: number[], binCount = 12): Distribution {
  const n = values.length;
  if (n === 0) return { values, n: 0, mean: 0, std: 0, min: 0, max: 0, bins: [] };
  const mn = Math.min(...values);
  const mx = Math.max(...values);
  const m = mean(values);
  const std = Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
  const span = mx - mn || 1;
  const width = span / binCount;
  const bins = Array.from({ length: binCount }, (_, i) => ({ x0: mn + i * width, x1: mn + (i + 1) * width, count: 0 }));
  for (const v of values) {
    let idx = Math.floor((v - mn) / width);
    if (idx >= binCount) idx = binCount - 1;
    if (idx < 0) idx = 0;
    bins[idx].count++;
  }
  return { values, n, mean: m, std, min: mn, max: mx, bins };
}

/** Densité normale (cloche) en x, pour overlay sur l'histogramme. */
export function normalPdf(x: number, mean: number, std: number): number {
  if (std <= 0) return 0;
  return Math.exp(-((x - mean) ** 2) / (2 * std * std)) / (std * Math.sqrt(2 * Math.PI));
}

/* ───────────────────────── Séries temporelles ─────────────────────────── */

export function timeSeries(matches: MatchRecord[], window = 20): TimePoint[] {
  const ms = [...matches].sort((a, b) => a.ts - b.ts);
  const out: TimePoint[] = [];
  let cumWins = 0;
  for (let i = 0; i < ms.length; i++) {
    if (isWin(ms[i].result)) cumWins++;
    const from = Math.max(0, i - window + 1);
    const slice = ms.slice(from, i + 1);
    const rollWins = slice.filter((m) => isWin(m.result)).length;
    out.push({
      ts: ms[i].ts,
      result: ms[i].result,
      cumWinRate: cumWins / (i + 1),
      rolling: rollWins / slice.length,
    });
  }
  return out;
}

/** Trajectoire de PV MOYENNE par tour pour une Voie (ou toutes). Index = tour. */
export function avgHpTrajectory(matches: MatchRecord[], voie?: Move): number[] {
  const ms = voie ? matches.filter((m) => m.playerVoie === voie) : matches;
  if (ms.length === 0) return [];
  const maxLen = Math.max(...ms.map((m) => m.hpTrajectorySelf.length));
  const sum = new Array(maxLen).fill(0);
  const cnt = new Array(maxLen).fill(0);
  for (const m of ms) {
    m.hpTrajectorySelf.forEach((hp, t) => {
      sum[t] += hp;
      cnt[t]++;
    });
  }
  return sum.map((s, t) => (cnt[t] ? s / cnt[t] : 0));
}

/* ───────────────────────── RPSLS théorique vs réel ─────────────────────── */

export interface RpslsDelta {
  voie: Move;
  real: number; // taux de SCORE réel (win=1, draw=0.5, loss=0) — même échelle qu'expected
  expected: number; // taux de score « pur RPSLS » attendu vu les adversaires rencontrés
  delta: number; // real − expected (>0 = la Voie sur-performe sa position RPSLS)
  n: number;
}

/** Signe RPSLS d'un duel : 1 si att gagne, 0 si def gagne, 0.5 miroir. */
function rpslsSign(att: Move, def: Move): number {
  if (att === def) return 0.5;
  if (RPSLS_BEATS[att].includes(def)) return 1;
  return 0;
}

/** Taux de score (win=1, draw=0.5, loss=0) — aligné sur l'échelle de rpslsSign. */
function scoreRate(ms: MatchRecord[]): number {
  return mean(ms.map((m) => (m.result === "win" ? 1 : m.result === "draw" ? 0.5 : 0)));
}

export function rpslsDeltas(matches: MatchRecord[]): RpslsDelta[] {
  return MOVES.map((voie) => {
    const ms = matches.filter((m) => m.playerVoie === voie && m.oppVoie);
    const n = ms.length;
    const real = n ? scoreRate(ms) : 0;
    const expected = n ? mean(ms.map((m) => rpslsSign(voie, m.oppVoie as Move))) : 0.5;
    return { voie, real, expected, delta: real - expected, n };
  });
}

/* ───────────────────────────── Matrice 5×5 ─────────────────────────────── */

export function matchupGrid(matches: MatchRecord[]): MatchupCell[][] {
  return MOVES.map((att) =>
    MOVES.map((def) => {
      const ms = matches.filter((m) => m.playerVoie === att && m.oppVoie === def);
      return { att, def, games: ms.length, winRate: ms.length ? ms.filter((m) => isWin(m.result)).length / ms.length : NaN };
    }),
  );
}

/* ───────────────────────────── Fins de partie ──────────────────────────── */

export interface EndReasonCounts {
  ko: number;
  hardcap: number;
  suddendeath: number;
}

export function endReasonCounts(matches: MatchRecord[]): EndReasonCounts {
  const c: EndReasonCounts = { ko: 0, hardcap: 0, suddendeath: 0 };
  for (const m of matches) c[m.endReason]++;
  return c;
}

/* ───────────────────────────────── Finishers ───────────────────────────── */

export interface FinisherStats {
  selfRate: number;
  oppRate: number;
  lift: number; // wr|finisher − wr|sans (corrélation, pas causalité)
  byVoie: Record<Move, { self: number; opp: number }>;
}

export function finisherStats(matches: MatchRecord[]): FinisherStats {
  const g = matches.length || 1;
  const withFin = matches.filter((m) => m.finisherFired);
  const without = matches.filter((m) => !m.finisherFired);
  const wr = (ms: MatchRecord[]) => (ms.length ? ms.filter((m) => isWin(m.result)).length / ms.length : 0);
  const byVoie = {} as Record<Move, { self: number; opp: number }>;
  for (const v of MOVES) {
    const ms = matches.filter((m) => m.playerVoie === v);
    const k = ms.length || 1;
    byVoie[v] = {
      self: ms.filter((m) => m.finisherFired).length / k,
      opp: ms.filter((m) => m.oppFinisherFired).length / k,
    };
  }
  return {
    selfRate: withFin.length / g,
    oppRate: matches.filter((m) => m.oppFinisherFired).length / g,
    lift: withFin.length && without.length ? wr(withFin) - wr(without) : 0,
    byVoie,
  };
}

/* ─────────────────────────── Segments adversaire ───────────────────────── */

export interface SegmentStat {
  kind: OppKind;
  games: number;
  winRate: number;
  avgTurns: number;
  avgMargin: number;
  finisherRate: number;
}

export function segmentByOpp(matches: MatchRecord[]): SegmentStat[] {
  return (["cpu", "human"] as OppKind[]).map((kind) => {
    const ms = matches.filter((m) => m.oppKind === kind);
    const g = ms.length;
    return {
      kind,
      games: g,
      winRate: g ? ms.filter((m) => isWin(m.result)).length / g : 0,
      avgTurns: g ? mean(ms.map((m) => m.turns)) : 0,
      avgMargin: g ? mean(ms.map((m) => m.finalHpSelf - m.finalHpOpp)) : 0,
      finisherRate: g ? ms.filter((m) => m.finisherFired).length / g : 0,
    };
  });
}

/* ─────────────────────────────────── Streaks ───────────────────────────── */

export interface Streaks {
  bestWin: number;
  worstLoss: number;
  current: { kind: Result; length: number } | null;
}

export function streaks(matches: MatchRecord[]): Streaks {
  const ms = sortChrono(matches);
  let bestWin = 0;
  let worstLoss = 0;
  let runW = 0;
  let runL = 0;
  for (const m of ms) {
    runW = m.result === "win" ? runW + 1 : 0;
    runL = m.result === "loss" ? runL + 1 : 0;
    bestWin = Math.max(bestWin, runW);
    worstLoss = Math.max(worstLoss, runL);
  }
  let current: Streaks["current"] = null;
  if (ms.length) {
    const last = ms[ms.length - 1].result;
    let len = 0;
    for (let i = ms.length - 1; i >= 0 && ms[i].result === last; i--) len++;
    current = { kind: last, length: len };
  }
  return { bestWin, worstLoss, current };
}

/* ─────────────────────────────── utils ─────────────────────────────────── */

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

/** Asymétrie (skewness) — pour annoter si la cloche de Gauss « ment ». */
export function skewness(xs: number[]): number {
  const n = xs.length;
  if (n < 3) return 0;
  const m = mean(xs);
  const s = Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1));
  if (s === 0) return 0;
  return xs.reduce((a, x) => a + ((x - m) / s) ** 3, 0) / n;
}
