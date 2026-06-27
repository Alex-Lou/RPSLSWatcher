/**
 * EndReasonBars — comment se terminent tes parties : KO / tour-limite / mort
 * subite. Barre empilée + légende nette. Trop de « tour-limite » = problème de
 * finition (santé du jeu).
 */
import type { EndReasonCounts } from "../data/analysis";

const SEGS: { key: keyof EndReasonCounts; label: string; cssVar: string }[] = [
  { key: "ko", label: "KO", cssVar: "--neon-cyan" },
  { key: "hardcap", label: "Tour-limite", cssVar: "--neon-amber" },
  { key: "suddendeath", label: "Mort subite", cssVar: "--neon-magenta" },
];

export function EndReasonBars({ counts }: { counts: EndReasonCounts }) {
  const total = counts.ko + counts.hardcap + counts.suddendeath || 1;
  return (
    <div>
      <div style={{ display: "flex", height: 26, borderRadius: 6, overflow: "hidden", border: "1px solid var(--stroke-faint)" }}>
        {SEGS.map((s) => {
          const v = counts[s.key];
          const pct = (v / total) * 100;
          if (pct === 0) return null;
          return (
            <div
              key={s.key}
              title={`${s.label} : ${v}`}
              style={{
                width: `${pct}%`,
                background: `color-mix(in oklab, var(${s.cssVar}) 70%, var(--bg-2))`,
                boxShadow: `inset 0 0 12px color-mix(in oklab, var(${s.cssVar}) 40%, transparent)`,
              }}
            />
          );
        })}
      </div>
      <div className="lab-legend" style={{ marginTop: 10 }}>
        {SEGS.map((s) => (
          <span key={s.key} style={{ color: `var(${s.cssVar})` }}>
            ● {s.label} {Math.round((counts[s.key] / total) * 100)}% ({counts[s.key]})
          </span>
        ))}
      </div>
    </div>
  );
}
