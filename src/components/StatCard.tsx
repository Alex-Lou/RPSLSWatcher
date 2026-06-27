/** StatCard — une tuile KPI néon. Chiffre net (Share Tech Mono), glow seulement
 *  sur le liseré gauche (via --kpi-accent). Delta optionnel coloré. */
export function StatCard({
  label,
  value,
  accent = "var(--neon-cyan)",
  sub,
  delta,
  deltaDir,
}: {
  label: string;
  value: string;
  accent?: string;
  sub?: string;
  delta?: string;
  deltaDir?: "up" | "down";
}) {
  return (
    <div className="wt-kpi" style={{ ["--kpi-accent" as string]: accent }}>
      <div className="wt-kpi-label">{label}</div>
      <div className="wt-kpi-value">{value}</div>
      {(sub || delta) && (
        <div className="wt-kpi-sub">
          {delta && <span className={`wt-kpi-delta ${deltaDir ?? ""}`}>{delta}</span>}
          {delta && sub ? " · " : ""}
          {sub}
        </div>
      )}
    </div>
  );
}
