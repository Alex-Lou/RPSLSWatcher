/** KpiTiles — les 4 chiffres de tête : win-rate · parties · durée · marge PV. */
import type { Kpis } from "../data/types";
import { StatCard } from "./StatCard";

export function KpiTiles({ k, total, avgMargin }: { k: Kpis; total: number; avgMargin: number }) {
  const wr = Math.round(k.winRate * 100);
  return (
    <div className="wt-kpis">
      <StatCard
        label="Taux de victoire"
        value={`${wr}%`}
        accent={k.winRate >= 0.5 ? "var(--res-win)" : "var(--res-loss)"}
        sub={`${k.games} parties`}
      />
      <StatCard label="Parties (filtre)" value={`${k.games}`} accent="var(--neon-cyan)" sub={`sur ${total} au total`} />
      <StatCard label="Durée moyenne" value={`${k.avgTurns.toFixed(1)}`} accent="var(--neon-violet)" sub="tours" />
      <StatCard
        label="Marge moyenne PV"
        value={`${avgMargin >= 0 ? "+" : ""}${avgMargin.toFixed(1)}`}
        accent={avgMargin >= 0 ? "var(--res-win)" : "var(--res-loss)"}
        sub={avgMargin >= 0 ? "tu domines" : "tu encaisses"}
      />
    </div>
  );
}
