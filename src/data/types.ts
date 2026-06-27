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

/** Étiquette du SYMBOLE RPSLS (≠ nom de Voie) — pour décrire un coup posé. */
export const MOVE_LABEL: Record<Move, string> = {
  rock: "Pierre",
  paper: "Feuille",
  scissors: "Ciseaux",
  lizard: "Lézard",
  spock: "Spock",
};

/** Verbe RPSLS « gagnant → perdant » (vulgarisation du replay). */
export const BEAT_VERB: Partial<Record<Move, Partial<Record<Move, string>>>> = {
  rock: { scissors: "écrase", lizard: "écrase" },
  paper: { rock: "enveloppe", spock: "réfute" },
  scissors: { paper: "coupe", lizard: "décapite" },
  lizard: { paper: "dévore", spock: "empoisonne" },
  spock: { rock: "vaporise", scissors: "brise" },
};

/** UN enregistrement de partie (le contrat jeu → Worker → Watcher). */
export interface MatchRecord {
  v: 1 | 2; // 1 = résumé seul · 2 = inclut turnLog (déroulé tour par tour)
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
  turnLog?: ArenaTurnEvent[]; // [v:2] déroulé tour par tour — absent sur les parties v:1
}

/* ───────────────────── Turn-log v:2 (déroulé tour par tour) ─────────────────
 * Produit par le recorder in-game (observationnel, Tier A+B). Permet de juger
 * rythme, pioche, dégâts, affinité, points morts ET de rejouer une partie en
 * langage simple. TOUT est optionnel à la lecture : une partie v:1 n'en a pas.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Issue d'une lane après combat (du point de vue « moi » = a). */
export type LaneResult =
  | "counterWinSelf" // ma créature contre (RPSLS) la sienne
  | "counterWinOpp" // la sienne me contre
  | "mirror" // même symbole → échange de coups
  | "emptySelf" // j'ai une créature seule (frappe son héros)
  | "emptyOpp" // il a une créature seule (frappe mon héros)
  | "none"; // lane sans combat décisif

/** Résolution d'UNE lane (Tier B). Les dégâts sont déjà attribués au héros. */
export interface LaneOutcome {
  lane: number; // 0..2
  selfMove: Move | null; // symbole de ma créature (null = lane vide côté moi)
  oppMove: Move | null;
  result: LaneResult;
  killSelf: boolean; // ma créature est morte ce tour
  killOpp: boolean; // la sienne est morte
  saved: boolean; // une sauvegarde (Esquive/Aegis/anti-taunt) a annulé un KO
  splashToOpp: number; // surplus d'ATK d'un contre gagnant → son héros
  splashToSelf: number;
  directToOpp: number; // créature en lane vide → son héros (ATK pleine)
  directToSelf: number;
}

/** Un coup posé dans le tour (sort ou invocation). */
export interface TurnPlay {
  kind: "summon" | "spell";
  card: string; // CardId
  lane?: number; // invocations : 0..2
  move?: Move; // symbole RPSLS de l'invocation
  affinity: boolean; // move === ma Voie ? (le levier d'affinité)
  manaCost: number;
}

/** Un tour résolu, du point de vue du joueur (« moi » = a, « adv » = b). */
export interface ArenaTurnEvent {
  turn: number;
  // — économie & rythme (moi) —
  manaMax: number; // mana max ce tour
  manaSpent: number; // mana réellement dépensé
  handStart: number; // taille de main au début du planning
  drawn: number; // cartes piochées en entrant dans ce tour
  deckLeft: number; // cartes restantes au deck (fatigue imminente)
  // — coups posés —
  plays: TurnPlay[]; // moi
  playsOpp: TurnPlay[]; // adversaire (révélés)
  // — moteur de Voie / affinité —
  engine: number; // valeur de ma jauge de Voie après le tour
  engineOpp: number;
  engineRose: boolean; // ma jauge a monté ce tour (contre d'affinité réussi)
  finisherUnlocked: boolean; // finisher débloqué CE tour (jauge maxée)
  // — PV —
  hpSelf: number; // après le tour
  hpOpp: number;
  dHpSelf: number; // delta PV moi (négatif = subi, positif = soin)
  dHpOpp: number;
  deadTurn: boolean; // 0 PV bougé des deux côtés + jauges stagnantes
  // — Tier B : résolution RPSLS par lane —
  lanes?: LaneOutcome[];
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
