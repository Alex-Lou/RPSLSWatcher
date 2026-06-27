/**
 * StreakStrip — la « forme » récente : une tuile par partie (V/N/D) du plus
 * ancien au plus récent, + 3 KPI (meilleure série de victoires, pire série de
 * défaites, série en cours). Lecture tilt / hot-hand.
 */
import type { Streaks } from "../data/analysis";
import type { Result } from "../data/types";

const COLOR: Record<Result, string> = { win: "--res-win", loss: "--res-loss", draw: "--res-draw" };
const GLYPH: Record<Result, string> = { win: "V", loss: "D", draw: "N" };

export function StreakStrip({ results, streaks }: { results: Result[]; streaks: Streaks }) {
  const recent = results.slice(-40);
  const cur = streaks.current;
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
        {recent.map((r, i) => (
          <span
            key={i}
            title={r}
            style={{
              width: 18,
              height: 18,
              borderRadius: 4,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-num)",
              fontSize: 10,
              color: "var(--bg-0)",
              background: `var(${COLOR[r]})`,
            }}
          >
            {GLYPH[r]}
          </span>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        <Mini label="Meilleure série V" value={streaks.bestWin} color="--res-win" />
        <Mini label="Pire série D" value={streaks.worstLoss} color="--res-loss" />
        <Mini
          label="En cours"
          value={cur ? cur.length : 0}
          color={cur ? COLOR[cur.kind] : "--ink-dim"}
          suffix={cur ? ` ${GLYPH[cur.kind]}` : ""}
        />
      </div>
    </div>
  );
}

function Mini({ label, value, color, suffix = "" }: { label: string; value: number; color: string; suffix?: string }) {
  return (
    <div style={{ background: "var(--bg-2)", borderRadius: 6, padding: "8px 10px" }}>
      <div style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "var(--ink-dim)" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-num)", fontSize: 20, color: `var(${color})` }}>
        {value}
        {suffix}
      </div>
    </div>
  );
}
