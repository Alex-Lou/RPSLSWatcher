/** Header — titre + pastille d'état de la source (LIVE / DÉMO / HORS-LIGNE). */
import type { DataStatus } from "../data/api";

const PILL: Record<DataStatus, { cls: string; label: string }> = {
  live: { cls: "live", label: "● LIVE" },
  demo: { cls: "demo", label: "◌ DÉMO" },
  offline: { cls: "offline", label: "⚠ HORS-LIGNE" },
};

export function Header({ status }: { status: DataStatus }) {
  const p = PILL[status];
  return (
    <header className="wt-header">
      <h1 className="wt-title">RPSLS&nbsp;WATCHER</h1>
      <span className={`wt-pill ${p.cls}`}>{p.label}</span>
    </header>
  );
}
