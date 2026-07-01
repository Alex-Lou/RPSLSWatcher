/**
 * fps — agrégation du profil FPS par partie (FpsSummary) pour piloter la PERF
 * comme on pilote l'équilibrage. Pur, dérivé des records filtrés. Une partie
 * sans `fps` (ancienne, ou trop courte) est simplement ignorée des stats.
 */
import type { MatchRecord, Move } from "./types";

export interface FpsDeviceRow {
  device: string;
  n: number;
  avg: number;    // FPS moyen sur cet appareil
  low: number;    // 5%-low moyen
  jankPct: number;
}

export interface FpsWorstRow {
  id: string;
  ts: number;
  voie: Move;
  avg: number;
  low: number;
  jankPct: number;
  longFrames: number;
  device: string;
}

export interface FpsStats {
  n: number;          // parties avec profil FPS
  avg: number;        // FPS moyen (moyenne des moyennes)
  low: number;        // 5%-low moyen (le stutter ressenti)
  worstAvg: number;   // pire moyenne d'une seule partie
  jankPct: number;    // % de frames janky moyen
  longFrames: number; // total de hitches (frames > 50ms)
  byDevice: FpsDeviceRow[];
  worst: FpsWorstRow[]; // pires parties (par FPS moyen), top 8
}

const round1 = (x: number) => Math.round(x * 10) / 10;

export function fpsStats(matches: MatchRecord[]): FpsStats {
  const withFps = matches.filter((m) => m.fps && m.fps.frames > 0);
  const n = withFps.length;
  if (n === 0) {
    return { n: 0, avg: 0, low: 0, worstAvg: 0, jankPct: 0, longFrames: 0, byDevice: [], worst: [] };
  }
  let sumAvg = 0, sumLow = 0, sumJank = 0, longFrames = 0, worstAvg = Infinity;
  const dev = new Map<string, { n: number; avg: number; low: number; jank: number }>();
  for (const m of withFps) {
    const fp = m.fps!;
    sumAvg += fp.avg;
    sumLow += fp.low;
    sumJank += fp.jankPct;
    longFrames += fp.longFrames;
    if (fp.avg < worstAvg) worstAvg = fp.avg;
    const key = fp.device || "?";
    const d = dev.get(key) ?? { n: 0, avg: 0, low: 0, jank: 0 };
    d.n++; d.avg += fp.avg; d.low += fp.low; d.jank += fp.jankPct;
    dev.set(key, d);
  }
  const byDevice: FpsDeviceRow[] = [...dev.entries()]
    .map(([device, d]) => ({ device, n: d.n, avg: round1(d.avg / d.n), low: round1(d.low / d.n), jankPct: round1(d.jank / d.n) }))
    .sort((a, b) => a.avg - b.avg); // pire appareil en premier

  const worst: FpsWorstRow[] = withFps
    .map((m) => ({
      id: m.id, ts: m.ts, voie: m.playerVoie,
      avg: m.fps!.avg, low: m.fps!.low, jankPct: m.fps!.jankPct,
      longFrames: m.fps!.longFrames, device: m.fps!.device || "?",
    }))
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 8);

  return {
    n,
    avg: round1(sumAvg / n),
    low: round1(sumLow / n),
    worstAvg: round1(worstAvg),
    jankPct: round1(sumJank / n),
    longFrames,
    byDevice,
    worst,
  };
}
