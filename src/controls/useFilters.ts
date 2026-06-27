/**
 * useFilters — état des filtres (unique vérité dérivée : applyFilters tourne sur
 * records + filters, aucun panneau ne garde d'état). Persistance localStorage.
 * Toggles ET (multi-sélection par dimension). Période en presets.
 */
import { useCallback, useMemo, useState } from "react";
import { EMPTY_FILTERS, type Filters, type Mode, type Move, type OppKind, type Result } from "../data/types";

const KEY = "watcher.filters.v1";
export type Period = "all" | "24h" | "7d" | "30d";

function load(): Filters {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Filters>;
      // garde de forme : un localStorage corrompu ne doit pas casser applyFilters.
      return {
        voies: Array.isArray(p.voies) ? p.voies : [],
        results: Array.isArray(p.results) ? p.results : [],
        oppKinds: Array.isArray(p.oppKinds) ? p.oppKinds : [],
        modes: Array.isArray(p.modes) ? p.modes : [],
        since: typeof p.since === "number" ? p.since : null,
        until: typeof p.until === "number" ? p.until : null,
      };
    }
  } catch {
    /* ignore */
  }
  return { ...EMPTY_FILTERS };
}

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

const DAY = 86_400_000;
const PERIOD_MS: Record<Period, number | null> = { all: null, "24h": DAY, "7d": 7 * DAY, "30d": 30 * DAY };

export function useFilters(nowMs: number) {
  const [filters, setFilters] = useState<Filters>(load);

  const persist = useCallback((f: Filters) => {
    setFilters(f);
    try {
      localStorage.setItem(KEY, JSON.stringify(f));
    } catch {
      /* quota */
    }
  }, []);

  const api = useMemo(
    () => ({
      filters,
      toggleVoie: (v: Move) => persist({ ...filters, voies: toggle(filters.voies, v) }),
      toggleResult: (r: Result) => persist({ ...filters, results: toggle(filters.results, r) }),
      toggleOppKind: (k: OppKind) => persist({ ...filters, oppKinds: toggle(filters.oppKinds, k) }),
      toggleMode: (m: Mode) => persist({ ...filters, modes: toggle(filters.modes, m) }),
      // fenêtre calculée à l'instant du clic (Date.now()) → un préset « 24h »
      // pointe toujours sur les 24 vraies dernières heures, même session longue.
      setPeriod: (p: Period) => persist({ ...filters, since: PERIOD_MS[p] == null ? null : Date.now() - (PERIOD_MS[p] as number), until: null }),
      reset: () => persist({ ...EMPTY_FILTERS }),
      isDefault:
        filters.voies.length === 0 &&
        filters.results.length === 0 &&
        filters.oppKinds.length === 0 &&
        filters.modes.length === 0 &&
        filters.since == null &&
        filters.until == null,
      activePeriod: ((): Period => {
        if (filters.since == null) return "all";
        const span = nowMs - filters.since;
        if (span <= DAY * 1.5) return "24h";
        if (span <= DAY * 8) return "7d";
        return "30d";
      })(),
    }),
    [filters, persist, nowMs],
  );

  return api;
}
