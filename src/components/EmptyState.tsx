/** EmptyState — aucun résultat (réel vide / filtré à zéro). CTA adapté. */
export function EmptyState({ kind, onReset, onDemo }: { kind: "filtered" | "noData"; onReset?: () => void; onDemo?: () => void }) {
  if (kind === "filtered") {
    return (
      <div className="wt-empty">
        Aucune partie ne correspond à ces filtres.
        <br />
        {onReset && <button onClick={onReset}>Réinitialiser les filtres</button>}
      </div>
    );
  }
  return (
    <div className="wt-empty">
      Pas encore de partie enregistrée.
      <br />
      Joue une partie de Constellation Pro, ou regarde une démo.
      <br />
      {onDemo && <button onClick={onDemo}>Voir une DÉMO</button>}
    </div>
  );
}
