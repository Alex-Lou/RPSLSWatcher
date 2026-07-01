/**
 * FpsPanel — profil de PERFORMANCE (FPS) des parties. Alimenté par le sampler
 * in-game (rAF continu → FpsSummary joint à chaque MatchRecord). Sert à piloter
 * la perf : FPS moyen, 5%-low (stutter ressenti), jank%, hitches, par appareil,
 * + les pires parties pour drill-down. Une partie sans profil FPS est ignorée.
 */
import { useMemo } from "react";
import { fpsStats } from "../data/fps";
import { VOIE_META, type MatchRecord } from "../data/types";
import { StatCard } from "./StatCard";

/** Couleur FPS : vert ≥55, ambre 30–55, rouge <30. */
function fpsColor(fps: number): string {
  return fps >= 55 ? "var(--res-win)" : fps >= 30 ? "var(--neon-amber)" : "var(--res-loss)";
}
/** Couleur jank% : vert <5, ambre 5–15, rouge >15. */
function jankColor(j: number): string {
  return j < 5 ? "var(--res-win)" : j <= 15 ? "var(--neon-amber)" : "var(--res-loss)";
}
const dt = (ts: number) => new Date(ts).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function FpsPanel({ matches }: { matches: MatchRecord[] }) {
  const s = useMemo(() => fpsStats(matches), [matches]);

  if (s.n === 0) {
    return (
      <div className="wt-empty" style={{ textAlign: "left", padding: "8px 2px" }}>
        Aucun profil FPS enregistré pour l'instant. Joue avec le build à jour : chaque partie mesure
        son framerate (moyen, 5%-low, jank, hitches) et l'envoie ici — pour piloter la perf par
        appareil comme on pilote l'équilibrage.
      </div>
    );
  }

  return (
    <div className="wt-fps">
      {/* KPIs */}
      <div className="wt-kpis" style={{ marginBottom: 12 }}>
        <StatCard label="FPS moyen" value={s.avg.toFixed(0)} accent={fpsColor(s.avg)} sub={`${s.n} parties mesurées`} />
        <StatCard label="5%-LOW (stutter)" value={s.low.toFixed(0)} accent={fpsColor(s.low)} sub="les 5% pires frames" />
        <StatCard label="Jank" value={`${s.jankPct.toFixed(1)}%`} accent={jankColor(s.jankPct)} sub="frames sous 30fps" />
        <StatCard label="Pire partie" value={s.worstAvg.toFixed(0)} accent={fpsColor(s.worstAvg)} sub={`${s.longFrames} hitches totaux`} />
      </div>

      {/* Par appareil */}
      {s.byDevice.length > 0 && (
        <>
          <div className="lab-panel-sub" style={{ marginBottom: 4 }}>Par appareil (pire en premier)</div>
          <table className="wt-table">
            <thead>
              <tr><th>Appareil</th><th>Parties</th><th>FPS moy.</th><th>5%-low</th><th>Jank</th></tr>
            </thead>
            <tbody>
              {s.byDevice.map((d) => (
                <tr key={d.device}>
                  <td style={{ color: "var(--ink-dim)" }}>{d.device}</td>
                  <td>{d.n}</td>
                  <td style={{ color: fpsColor(d.avg), fontWeight: 700 }}>{d.avg.toFixed(0)}</td>
                  <td style={{ color: fpsColor(d.low) }}>{d.low.toFixed(0)}</td>
                  <td style={{ color: jankColor(d.jankPct) }}>{d.jankPct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Pires parties */}
      <div className="lab-panel-sub" style={{ margin: "12px 0 4px" }}>Pires parties (FPS moyen le plus bas)</div>
      <table className="wt-table">
        <thead>
          <tr><th>Quand</th><th>Voie</th><th>FPS moy.</th><th>5%-low</th><th>Jank</th><th>Hitches</th><th>Appareil</th></tr>
        </thead>
        <tbody>
          {s.worst.map((w) => (
            <tr key={w.id}>
              <td style={{ color: "var(--ink-dim)" }}>{dt(w.ts)}</td>
              <td>{VOIE_META[w.voie].glyph} {VOIE_META[w.voie].name}</td>
              <td style={{ color: fpsColor(w.avg), fontWeight: 700 }}>{w.avg.toFixed(0)}</td>
              <td style={{ color: fpsColor(w.low) }}>{w.low.toFixed(0)}</td>
              <td style={{ color: jankColor(w.jankPct) }}>{w.jankPct.toFixed(1)}%</td>
              <td>{w.longFrames}</td>
              <td style={{ color: "var(--ink-dim)" }}>{w.device}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
