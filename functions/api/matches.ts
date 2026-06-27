/**
 * /api/matches — Pages Function (Cloudflare). Déployée AVEC le site (pas de
 * wrangler deploy séparé). Deux routes :
 *   POST  → ingest d'UN MatchRecord (ou tableau). Gardé par X-Ingest-Key.
 *   GET   → liste les parties (lecture publique, capée) pour le Watcher.
 * Stockage : D1 (binding `DB`). Idempotent sur `id` (INSERT OR IGNORE).
 *
 * Sécurité (mandat intégrité données) : écriture clé-gardée + validation stricte
 * type/enum + clamp des tableaux. Lecture seule ouverte (stats de jeu, peu
 * sensibles) mais bornée. CORS permissif (le jeu natif POST en cross-origin).
 */

interface Env {
  DB: D1Database;
  INGEST_KEY: string;
}

const MOVES = ["rock", "paper", "scissors", "lizard", "spock"];
const RESULTS = ["win", "loss", "draw"];
const OPP_KINDS = ["cpu", "human"];
const MODES = ["pro", "ranked"];
const END_REASONS = ["ko", "hardcap", "suddendeath"];
const MAX_TRAJ = 40;
const PLAY_KINDS = ["summon", "spell"];
const LANE_RESULTS = ["counterWinSelf", "counterWinOpp", "mirror", "emptySelf", "emptyOpp", "none"];
const MAX_TURNS_LOG = 40; // ≥ hard cap du jeu (15), marge confortable
const MAX_PLAYS = 16; // coups par tour (par camp)
const MAX_LANES = 3;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Ingest-Key",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204, headers: CORS });

/* ───────────────────────────── Validation ───────────────────────────── */

function num(x: unknown, lo: number, hi: number): number | null {
  return typeof x === "number" && Number.isFinite(x) && x >= lo && x <= hi ? x : null;
}
function enumOf(x: unknown, allowed: string[]): string | null {
  return typeof x === "string" && allowed.includes(x) ? x : null;
}
function trajOf(x: unknown): number[] | null {
  if (!Array.isArray(x) || x.length > MAX_TRAJ) return null;
  const out: number[] = [];
  for (const v of x) {
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 999) return null;
    out.push(Math.round(v));
  }
  return out;
}

/* ── Turn-log v:2 — validation stricte + clamp (mandat intégrité). Une seule
 *    valeur malformée fait CHUTER tout le turnLog (→ null) : la partie reste
 *    enregistrée en v:1, jamais de JSON douteux en base. ── */
function int(x: unknown, lo: number, hi: number): number | null {
  if (typeof x !== "number" || !Number.isFinite(x)) return null;
  const v = Math.round(x);
  return v >= lo && v <= hi ? v : null;
}

function cleanPlay(x: unknown): Record<string, unknown> | null {
  if (!x || typeof x !== "object") return null;
  const r = x as Record<string, unknown>;
  const kind = enumOf(r.kind, PLAY_KINDS);
  const card = typeof r.card === "string" && r.card.length > 0 && r.card.length <= 60 ? r.card : null;
  if (kind === null || card === null) return null;
  const lane = r.lane == null ? null : int(r.lane, 0, 2);
  if (r.lane != null && lane === null) return null;
  const move = r.move == null ? null : enumOf(r.move, MOVES);
  if (r.move != null && move === null) return null;
  const out: Record<string, unknown> = { kind, card, affinity: !!r.affinity, manaCost: int(r.manaCost, 0, 99) ?? 0 };
  if (lane !== null) out.lane = lane;
  if (move !== null) out.move = move;
  return out;
}

function cleanLane(x: unknown): Record<string, unknown> | null {
  if (!x || typeof x !== "object") return null;
  const r = x as Record<string, unknown>;
  const lane = int(r.lane, 0, 2);
  const result = enumOf(r.result, LANE_RESULTS);
  if (lane === null || result === null) return null;
  const selfMove = r.selfMove == null ? null : enumOf(r.selfMove, MOVES);
  const oppMove = r.oppMove == null ? null : enumOf(r.oppMove, MOVES);
  if ((r.selfMove != null && selfMove === null) || (r.oppMove != null && oppMove === null)) return null;
  return {
    lane, selfMove, oppMove, result,
    killSelf: !!r.killSelf, killOpp: !!r.killOpp, saved: !!r.saved,
    splashToOpp: int(r.splashToOpp, 0, 99) ?? 0, splashToSelf: int(r.splashToSelf, 0, 99) ?? 0,
    directToOpp: int(r.directToOpp, 0, 99) ?? 0, directToSelf: int(r.directToSelf, 0, 99) ?? 0,
  };
}

function cleanTurnLog(x: unknown): string | null {
  if (x == null) return null;
  if (!Array.isArray(x) || x.length === 0 || x.length > MAX_TURNS_LOG) return null;
  const out: Record<string, unknown>[] = [];
  for (const ev of x) {
    if (!ev || typeof ev !== "object") return null;
    const r = ev as Record<string, unknown>;
    const turn = int(r.turn, 0, 200);
    const manaMax = int(r.manaMax, 0, 99);
    const manaSpent = int(r.manaSpent, 0, 99);
    const handStart = int(r.handStart, 0, 99);
    const drawn = int(r.drawn, 0, 99);
    const deckLeft = int(r.deckLeft, 0, 999);
    const engine = int(r.engine, 0, 99);
    const engineOpp = int(r.engineOpp, 0, 99);
    const hpSelf = int(r.hpSelf, 0, 999);
    const hpOpp = int(r.hpOpp, 0, 999);
    const dHpSelf = int(r.dHpSelf, -999, 999);
    const dHpOpp = int(r.dHpOpp, -999, 999);
    if (
      turn === null || manaMax === null || manaSpent === null || handStart === null || drawn === null ||
      deckLeft === null || engine === null || engineOpp === null || hpSelf === null || hpOpp === null ||
      dHpSelf === null || dHpOpp === null
    ) {
      return null;
    }
    if (!Array.isArray(r.plays) || !Array.isArray(r.playsOpp) || r.plays.length > MAX_PLAYS || r.playsOpp.length > MAX_PLAYS) {
      return null;
    }
    const plays: Record<string, unknown>[] = [];
    for (const p of r.plays) { const c = cleanPlay(p); if (!c) return null; plays.push(c); }
    const playsOpp: Record<string, unknown>[] = [];
    for (const p of r.playsOpp) { const c = cleanPlay(p); if (!c) return null; playsOpp.push(c); }
    const ev2: Record<string, unknown> = {
      turn, manaMax, manaSpent, handStart, drawn, deckLeft, plays, playsOpp,
      engine, engineOpp, engineRose: !!r.engineRose, finisherUnlocked: !!r.finisherUnlocked,
      hpSelf, hpOpp, dHpSelf, dHpOpp, deadTurn: !!r.deadTurn,
    };
    if (r.lanes != null) {
      if (!Array.isArray(r.lanes) || r.lanes.length > MAX_LANES) return null;
      const lanes: Record<string, unknown>[] = [];
      for (const l of r.lanes) { const c = cleanLane(l); if (!c) return null; lanes.push(c); }
      ev2.lanes = lanes;
    }
    out.push(ev2);
  }
  return JSON.stringify(out);
}

interface CleanRecord {
  id: string;
  ts: number;
  mode: string;
  playerVoie: string;
  oppVoie: string | null;
  oppKind: string;
  result: string;
  turns: number;
  finalHpSelf: number;
  finalHpOpp: number;
  finisherFired: number;
  oppFinisherFired: number;
  hpSelf: string;
  hpOpp: string;
  endReason: string;
  appVersion: string | null;
  turnLog: string | null;
}

function clean(r: Record<string, unknown>): CleanRecord | null {
  if (!r || typeof r !== "object") return null;
  const id = typeof r.id === "string" && r.id.length > 0 && r.id.length <= 80 ? r.id : null;
  const ts = num(r.ts, 0, 4_102_444_800_000); // ≤ an 2100
  const mode = enumOf(r.mode, MODES);
  const playerVoie = enumOf(r.playerVoie, MOVES);
  const oppVoie = r.oppVoie === null || r.oppVoie === undefined ? null : enumOf(r.oppVoie, MOVES);
  const oppKind = enumOf(r.oppKind, OPP_KINDS);
  const result = enumOf(r.result, RESULTS);
  const turns = num(r.turns, 0, 100);
  const finalHpSelf = num(r.finalHpSelf, 0, 999);
  const finalHpOpp = num(r.finalHpOpp, 0, 999);
  const endReason = enumOf(r.endReason, END_REASONS);
  const hpSelf = trajOf(r.hpTrajectorySelf);
  const hpOpp = trajOf(r.hpTrajectoryOpp);
  const turnLog = cleanTurnLog(r.turnLog); // null si absent OU malformé (la partie reste en v:1)
  if (
    id === null || ts === null || mode === null || playerVoie === null || oppKind === null ||
    result === null || turns === null || finalHpSelf === null || finalHpOpp === null ||
    endReason === null || hpSelf === null || hpOpp === null || (r.oppVoie != null && oppVoie === null)
  ) {
    return null;
  }
  return {
    id, ts, mode, playerVoie, oppVoie, oppKind, result, turns, finalHpSelf, finalHpOpp,
    finisherFired: r.finisherFired ? 1 : 0,
    oppFinisherFired: r.oppFinisherFired ? 1 : 0,
    hpSelf: JSON.stringify(hpSelf),
    hpOpp: JSON.stringify(hpOpp),
    endReason,
    appVersion: typeof r.appVersion === "string" ? r.appVersion.slice(0, 24) : null,
    turnLog,
  };
}

/* ─────────────────────────────── Ingest ─────────────────────────────── */

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.INGEST_KEY || request.headers.get("X-Ingest-Key") !== env.INGEST_KEY) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad json" }, 400);
  }
  const records = Array.isArray(body) ? body : [body];
  if (records.length === 0 || records.length > 200) {
    return json({ ok: false, error: "batch 1..200" }, 400);
  }

  const stmt = env.DB.prepare(
    `INSERT OR IGNORE INTO matches
      (id, ts, mode, player_voie, opp_voie, opp_kind, result, turns,
       final_hp_self, final_hp_opp, finisher_fired, opp_finisher_fired,
       hp_self, hp_opp, end_reason, app_version, turn_log, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  const createdAt = Date.now();
  const batch: D1PreparedStatement[] = [];
  let rejected = 0;
  for (const raw of records) {
    const c = clean(raw as Record<string, unknown>);
    if (!c) {
      rejected++;
      continue;
    }
    batch.push(
      stmt.bind(
        c.id, c.ts, c.mode, c.playerVoie, c.oppVoie, c.oppKind, c.result, c.turns,
        c.finalHpSelf, c.finalHpOpp, c.finisherFired, c.oppFinisherFired,
        c.hpSelf, c.hpOpp, c.endReason, c.appVersion, c.turnLog, createdAt,
      ),
    );
  }
  if (batch.length === 0) return json({ ok: false, error: "no valid records", rejected }, 400);
  await env.DB.batch(batch);
  return json({ ok: true, accepted: batch.length, rejected });
};

/* ──────────────────────────────── Query ─────────────────────────────── */

interface Row {
  id: string; ts: number; mode: string; player_voie: string; opp_voie: string | null;
  opp_kind: string; result: string; turns: number; final_hp_self: number; final_hp_opp: number;
  finisher_fired: number; opp_finisher_fired: number; hp_self: string; hp_opp: string;
  end_reason: string; app_version: string | null; turn_log: string | null;
}

function rowToRecord(r: Row): Record<string, unknown> {
  const parse = (s: string): number[] => {
    try {
      const v = JSON.parse(s);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  };
  const parseLog = (s: string | null): unknown[] | null => {
    if (!s) return null;
    try {
      const v = JSON.parse(s);
      return Array.isArray(v) && v.length ? v : null;
    } catch {
      return null;
    }
  };
  const turnLog = parseLog(r.turn_log);
  return {
    v: turnLog ? 2 : 1, id: r.id, ts: r.ts, mode: r.mode, playerVoie: r.player_voie, oppVoie: r.opp_voie,
    oppKind: r.opp_kind, result: r.result, turns: r.turns, finalHpSelf: r.final_hp_self,
    finalHpOpp: r.final_hp_opp, finisherFired: !!r.finisher_fired, oppFinisherFired: !!r.opp_finisher_fired,
    hpTrajectorySelf: parse(r.hp_self), hpTrajectoryOpp: parse(r.hp_opp),
    endReason: r.end_reason, appVersion: r.app_version ?? undefined,
    ...(turnLog ? { turnLog } : {}),
  };
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const limit = Math.min(5000, Math.max(1, Number(url.searchParams.get("limit") ?? 2000) || 2000));
  const since = Number(url.searchParams.get("since") ?? 0) || 0;
  try {
    const res = await env.DB.prepare(
      `SELECT id, ts, mode, player_voie, opp_voie, opp_kind, result, turns,
              final_hp_self, final_hp_opp, finisher_fired, opp_finisher_fired,
              hp_self, hp_opp, end_reason, app_version, turn_log
       FROM matches WHERE ts >= ? ORDER BY ts DESC LIMIT ?`,
    )
      .bind(since, limit)
      .all<Row>();
    const matches = (res.results ?? []).map(rowToRecord);
    return json({ ok: true, count: matches.length, matches });
  } catch (e) {
    // ne pas renvoyer le message D1 brut au public (hygiène) — log côté serveur.
    console.error("GET /api/matches", e);
    return json({ ok: false, error: "db" }, 500);
  }
};
