/**
 * FilterBar — barre sticky. Chips ET par dimension (Ma Voie / Résultat /
 * Adversaire / Mode / Période) + compteur vivant n/total + reset. Recalcule tout
 * en mémoire (aucun re-fetch).
 */
import { MOVES, VOIE_META, type Mode, type OppKind, type Result } from "../data/types";
import { FilterChip } from "./FilterChip";
import type { Period, useFilters } from "./useFilters";

type FilterApi = ReturnType<typeof useFilters>;

const RESULTS: { v: Result; label: string; accent: string }[] = [
  { v: "win", label: "Victoires", accent: "var(--res-win)" },
  { v: "draw", label: "Nuls", accent: "var(--res-draw)" },
  { v: "loss", label: "Défaites", accent: "var(--res-loss)" },
];
const OPP: { v: OppKind; label: string }[] = [
  { v: "cpu", label: "vs IA" },
  { v: "human", label: "vs Humain" },
];
const MODES: { v: Mode; label: string }[] = [
  { v: "pro", label: "Pro" },
  { v: "ranked", label: "Classé" },
];
const PERIODS: { v: Period; label: string }[] = [
  { v: "24h", label: "24h" },
  { v: "7d", label: "7j" },
  { v: "30d", label: "30j" },
  { v: "all", label: "Tout" },
];

export function FilterBar({ f, total, filtered }: { f: FilterApi; total: number; filtered: number }) {
  const weak = filtered < 8;
  return (
    <div className="wt-filterbar">
      <div className="wt-filter-row">
        <span className="wt-filter-tag">Voie</span>
        {MOVES.map((m) => (
          <FilterChip
            key={m}
            label={`${VOIE_META[m].glyph} ${VOIE_META[m].name}`}
            on={f.filters.voies.includes(m)}
            accent={`var(${VOIE_META[m].cssVar})`}
            onClick={() => f.toggleVoie(m)}
          />
        ))}
        <span className={`wt-count${weak ? " weak" : ""}`}>
          {filtered}/{total}
        </span>
      </div>
      <div className="wt-filter-row">
        <span className="wt-filter-tag">Issue</span>
        {RESULTS.map((r) => (
          <FilterChip key={r.v} label={r.label} on={f.filters.results.includes(r.v)} accent={r.accent} outline onClick={() => f.toggleResult(r.v)} />
        ))}
        {OPP.map((o) => (
          <FilterChip key={o.v} label={o.label} on={f.filters.oppKinds.includes(o.v)} onClick={() => f.toggleOppKind(o.v)} />
        ))}
        {MODES.map((mo) => (
          <FilterChip key={mo.v} label={mo.label} on={f.filters.modes.includes(mo.v)} onClick={() => f.toggleMode(mo.v)} />
        ))}
      </div>
      <div className="wt-filter-row">
        <span className="wt-filter-tag">Période</span>
        {PERIODS.map((p) => (
          <FilterChip key={p.v} label={p.label} on={f.activePeriod === p.v} accent="var(--neon-cyan)" outline onClick={() => f.setPeriod(p.v)} />
        ))}
        {!f.isDefault && (
          <button className="wt-reset" onClick={f.reset}>
            ⟲ Reset
          </button>
        )}
      </div>
    </div>
  );
}
