/**
 * PairedBars — barres appariées (deux séries A/B par ligne). Sert au taux de
 * finisher (moi vs adverse) ET à la perf CPU vs Humain. Valeurs nettes en mono.
 */
export interface PairedGroup {
  label: string;
  a: number;
  b: number;
  accent?: string; // override couleur de ligne (ex. Voie)
}

export function PairedBars({
  groups,
  aColor,
  bColor,
  aLabel,
  bLabel,
  format = (n) => `${Math.round(n * 100)}%`,
  scaleMax = 1,
}: {
  groups: PairedGroup[];
  aColor: string;
  bColor: string;
  aLabel: string;
  bLabel: string;
  format?: (n: number) => string;
  scaleMax?: number;
}) {
  const max = Math.max(scaleMax, ...groups.flatMap((g) => [g.a, g.b])) || 1;
  return (
    <div>
      <div className="lab-legend" style={{ marginBottom: 8, marginTop: 0 }}>
        <span style={{ color: aColor }}>● {aLabel}</span>
        <span style={{ color: bColor }}>● {bLabel}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {groups.map((g) => (
          <div key={g.label} style={{ display: "grid", gridTemplateColumns: "78px 1fr", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12.5, color: g.accent ?? "var(--ink)", fontFamily: "var(--font-ui)" }}>{g.label}</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <Bar value={g.a} max={max} color={aColor} text={format(g.a)} />
              <Bar value={g.b} max={max} color={bColor} text={format(g.b)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Bar({ value, max, color, text }: { value: number; max: number; color: string; text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 12, background: "color-mix(in oklab, var(--ink-dim) 14%, transparent)", borderRadius: 3, overflow: "hidden" }}>
        <div
          style={{
            width: `${Math.max(0, Math.min(1, value / max)) * 100}%`,
            height: "100%",
            background: color,
            boxShadow: `0 0 8px color-mix(in oklab, ${color} 45%, transparent)`,
          }}
        />
      </div>
      <span style={{ fontFamily: "var(--font-num)", fontSize: 11.5, color: "var(--ink-bright)", minWidth: 34, textAlign: "right" }}>{text}</span>
    </div>
  );
}
