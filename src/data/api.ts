/**
 * api — couche dataSource. Tente le backend (/api/matches sur D1). Succès →
 * LIVE (+ cache localStorage). Backend KO mais cache présent → OFFLINE (PWA
 * hors-ligne). Rien → DÉMO (jamais d'écran mort). Import manuel JSON en bonus.
 */
import { generateMockMatches } from "./mock";
import type { MatchRecord } from "./types";

export type DataStatus = "live" | "demo" | "offline";

export interface DataSource {
  matches: MatchRecord[];
  status: DataStatus;
  syncedAt: number | null;
  note: string | null;
}

const CACHE_KEY = "watcher.matches.v1";

function looksLikeRecord(x: unknown): x is MatchRecord {
  const r = x as Record<string, unknown>;
  return !!r && typeof r.id === "string" && typeof r.ts === "number" && typeof r.playerVoie === "string";
}

function readCache(): { records: MatchRecord[]; syncedAt: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    const records = Array.isArray(v?.records) ? (v.records as unknown[]).filter(looksLikeRecord) : [];
    return records.length ? { records: records as MatchRecord[], syncedAt: v.syncedAt ?? 0 } : null;
  } catch {
    return null;
  }
}

export async function loadMatches(): Promise<DataSource> {
  try {
    const res = await fetch("/api/matches?limit=5000", { headers: { accept: "application/json" } });
    if (res.ok) {
      const body = (await res.json()) as { matches?: unknown };
      const arr = Array.isArray(body?.matches) ? (body.matches as unknown[]).filter(looksLikeRecord) : [];
      if (arr.length > 0) {
        const syncedAt = Date.now();
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ records: arr, syncedAt }));
        } catch {
          /* quota — non bloquant */
        }
        return { matches: arr as MatchRecord[], status: "live", syncedAt, note: null };
      }
    }
  } catch {
    /* tombe vers cache puis démo */
  }
  const cached = readCache();
  if (cached) return { matches: cached.records, status: "offline", syncedAt: cached.syncedAt, note: "cache local" };
  return { matches: generateMockMatches(), status: "demo", syncedAt: null, note: "aucune donnée" };
}

/** Force le mode DÉMO (bouton « voir une démo »). */
export function demoSource(): DataSource {
  return { matches: generateMockMatches(), status: "demo", syncedAt: null, note: "démo forcée" };
}

/** Parse un JSON collé/importé (tableau de MatchRecord). Fail-soft. */
export function parseImported(text: string): MatchRecord[] | null {
  try {
    const v = JSON.parse(text);
    const arr = Array.isArray(v) ? v : Array.isArray(v?.matches) ? v.matches : null;
    if (!arr) return null;
    const clean = (arr as unknown[]).filter(looksLikeRecord) as MatchRecord[];
    return clean.length ? clean : null;
  } catch {
    return null;
  }
}
