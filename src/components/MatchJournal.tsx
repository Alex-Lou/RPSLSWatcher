/** MatchJournal — journal brut des parties (accordéon replié). Table mono. */
import { VOIE_META, type MatchRecord } from "../data/types";

const RES_LABEL: Record<string, string> = { win: "V", loss: "D", draw: "N" };

export function MatchJournal({ matches }: { matches: MatchRecord[] }) {
  const rows = [...matches].sort((a, b) => b.ts - a.ts).slice(0, 200);
  return (
    <details className="wt-journal">
      <summary>JOURNAL ({matches.length} parties) ▾</summary>
      <div className="wt-table-wrap">
        <table className="wt-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Ma Voie</th>
              <th>Adv.</th>
              <th>Type</th>
              <th>Issue</th>
              <th>Tours</th>
              <th>PV</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <td>{new Date(m.ts).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}</td>
                <td>
                  {VOIE_META[m.playerVoie].glyph} {VOIE_META[m.playerVoie].name}
                </td>
                <td>{m.oppVoie ? VOIE_META[m.oppVoie].glyph : "?"}</td>
                <td>{m.oppKind === "cpu" ? "IA" : "Humain"}</td>
                <td className={m.result}>{RES_LABEL[m.result]}</td>
                <td>{m.turns}</td>
                <td>
                  {m.finalHpSelf}–{m.finalHpOpp}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
