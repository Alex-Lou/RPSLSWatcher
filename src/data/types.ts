/**
 * types — le CONTRAT de données du Watcher. MatchRecord est produit par le jeu
 * (recorder in-game), stocké par le Worker Cloudflare (D1), lu par le Watcher.
 * Forme STABLE (versionnée) : ne pas casser sans bump de `v`.
 */

export type Move = "rock" | "paper" | "scissors" | "lizard" | "spock";
export type Result = "win" | "loss" | "draw";
export type OppKind = "cpu" | "human";
export type Mode = "pro" | "ranked";
export type EndReason = "ko" | "hardcap" | "suddendeath";

export const MOVES: Move[] = ["rock", "paper", "scissors", "lizard", "spock"];

/** RPSLS : qui bat qui (clé bat les valeurs). */
export const RPSLS_BEATS: Record<Move, Move[]> = {
  rock: ["scissors", "lizard"],
  paper: ["rock", "spock"],
  scissors: ["paper", "lizard"],
  lizard: ["paper", "spock"],
  spock: ["rock", "scissors"],
};

/** Étiquette FR + néon (var CSS) par Voie — source unique pour toute la viz. */
export const VOIE_META: Record<Move, { name: string; glyph: string; cssVar: string }> = {
  rock: { name: "Montagne", glyph: "🪨", cssVar: "--voie-rock" },
  paper: { name: "Forêt", glyph: "🌿", cssVar: "--voie-paper" },
  scissors: { name: "Tranchant", glyph: "✂️", cssVar: "--voie-scissors" },
  lizard: { name: "Mirage", glyph: "🦎", cssVar: "--voie-lizard" },
  spock: { name: "Cosmos", glyph: "🖖", cssVar: "--voie-spock" },
};

/** UN enregistrement de partie (le contrat jeu → Worker → Watcher). */
export interface MatchRecord {
  v: 1; // schema version
  id: string; // uuid client (clé d'idempotence à l'ingest)
  ts: number; // epoch ms — quand la partie a été jouée
  mode: Mode;
  playerVoie: Move;
  oppVoie: Move | null; // null si inconnue
  oppKind: OppKind;
  result: Result;
  turns: number; // durée (tours)
  finalHpSelf: number;
  finalHpOpp: number;
  finisherFired: boolean; // mon engine de Voie a maxé (finisher débloqué)
  oppFinisherFired: boolean;
  hpTrajectorySelf: number[]; // PV par tour (index 0 = départ)
  hpTrajectoryOpp: number[];
  endReason: EndReason;
  appVersion?: string; // version du jeu (cohorting), optionnel
}

/** Filtres appliqués CÔTÉ CLIENT (recalcul live). Listes vides = « tout ». */
export interface Filters {
  voies: Move[];
  results: Result[];
  oppKinds: OppKind[];
  modes: Mode[];
  since: number | null; // ts >= since
  until: number | null; // ts <= until
}

export const EMPTY_FILTERS: Filters = {
  voies: [],
  results: [],
  oppKinds: [],
  modes: [],
  since: null,
  until: null,
};

/* ─────────────────────── Types agrégés (analysis.ts) ─────────────────────── */

export interface VoieAgg {
  voie: Move;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number; // 0..1
  avgTurns: number;
  avgFinalHp: number;
  finisherRate: number; // 0..1
}

export interface MatchupCell {
  att: Move; // ma Voie
  def: Move; // Voie adverse
  games: number;
  winRate: number; // 0..1 (mon win-rate quand je joue att contre def)
}

/** Distribution + ajustement gaussien (cloche normale) pour l'overlay. */
export interface Distribution {
  values: number[];
  n: number;
  mean: number;
  std: number;
  min: number;
  max: number;
  bins: { x0: number; x1: number; count: number }[];
}

export interface TimePoint {
  ts: number;
  result: Result;
  cumWinRate: number; // win-rate cumulé jusqu'ici
  rolling: number; // win-rate glissant (fenêtre)
}

export interface Kpis {
  games: number;
  winRate: number;
  avgTurns: number;
  finisherRate: number;
  bestVoie: Move | null;
  worstVoie: Move | null;
  currentStreak: { kind: Result; length: number } | null;
}
