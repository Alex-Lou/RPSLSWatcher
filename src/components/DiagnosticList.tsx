/** DiagnosticList — les alertes/forces en clair, colorées par sévérité. */
import type { Diagnostic } from "../data/verdict";

const ICON: Record<Diagnostic["severity"], string> = { high: "▲", warn: "◆", ok: "●" };

export function DiagnosticList({ diagnostics }: { diagnostics: Diagnostic[] }) {
  if (!diagnostics.length) return <div className="wt-empty">— rien à signaler —</div>;
  return (
    <ul className="lab-diag">
      {diagnostics.map((d, i) => (
        <li key={i} className={`lab-diag-item sev-${d.severity}`}>
          <span className="lab-diag-icon">{ICON[d.severity]}</span>
          {d.text}
        </li>
      ))}
    </ul>
  );
}
