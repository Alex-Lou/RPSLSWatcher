/**
 * CardStats — tracker des cartes RÉELLEMENT jouées (turnLog.cards, v:2). Stats
 * par carte sur toutes les parties filtrées : fréquence, parties vues, win-rate
 * quand jouée (corrélation), fusions distinguées. Tri fréquence / win-rate.
 */
import { useMemo, useState } from "react";
import { cardStats, withTurnLog } from "../data/diagnostics";
import { VOIE_META, type MatchRecord } from "../data/types";

const pct = (x: number) => `${Math.round(x * 100)}%`;
const RARITY_COLOR: Record<string, string> = {
  common: "var(--ink)",
  rare: "var(--neon-cyan)",
  epic: "var(--neon-violet)",
  legendary: "var(--neon-amber)",
};

export function CardStats({ matches }: { matches: MatchRecord[] }) {
  const [sort, setSort] = useState<"freq" | "wr">("freq");
  const n = withTurnLog(matches).length;
  const rows = useMemo(() => {
    const base = cardStats(matches);
    if (sort === "wr") {
      // les cartes sous le seuil d'échantillon (n<3) tombent en bas.
      const score = (c: { gamesSeen: number; winRateWhenPlayed: number }) => (c.gamesSeen >= 3 ? c.winRateWhenPlayed : -1);
      return [...base].sort((a, b) => score(b) - score(a) || b.timesPlayed - a.timesPlayed);
    }
    return base;
  }, [matches, sort]);

  if (!rows.length) {
    return (
      <div className="wt-empty" style={{ textAlign: "left", padding: "8px 2px" }}>
        Aucune carte enregistrée pour l'instant (parties v:2). Joue avec le build à jour : chaque carte posée —
        créature, sort ou fusion — sera traquée ici (fréquence, win-rate, fusions).
      </div>
    );
  }

  return (
    <div className="wt-cards">
      <div className="wt-cards-head">
        <span className="wt-diag-note">
          <b>{rows.length}</b> cartes distinctes sur {n} parties détaillées
        </span>
        <div className="wt-toggle">
          <button className={sort === "freq" ? "on" : ""} onClick={() => setSort("freq")}>
            Fréquence
          </button>
          <button className={sort === "wr" ? "on" : ""} onClick={() => setSort("wr")}>
            Win-rate
          </button>
        </div>
      </div>
      <div className="wt-table-wrap">
        <table className="wt-table wt-cards-table">
          <thead>
            <tr>
              <th>Carte</th>
              <th>Jouée</th>
              <th>Parties</th>
              <th>Win-rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>
                  <span style={{ color: RARITY_COLOR[c.rarity] ?? "var(--ink)" }}>{c.name}</span>
                  {c.fusion && <span className="wt-fuse-badge">⚗️ fusion</span>}
                  {c.voie && <span className="wt-voie-dot" style={{ color: `var(${VOIE_META[c.voie].cssVar})` }}>●</span>}
                </td>
                <td>{c.timesPlayed}</td>
                <td>{c.gamesSeen}</td>
                <td className={c.gamesSeen < 5 ? "weak" : c.winRateWhenPlayed >= 0.5 ? "win" : "loss"}>
                  {c.gamesSeen >= 3 ? pct(c.winRateWhenPlayed) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="lab-legend">
        <span>Win-rate = parties gagnées où la carte a été jouée (corrélation, pas cause)</span>
        <span>« — » = trop peu de données · ⚗️ = carte de fusion</span>
      </div>
    </div>
  );
}
