/** FilterChip — pastille toggle néon. accent = couleur Voie/résultat (sinon cyan). */
export function FilterChip({
  label,
  on,
  accent,
  outline,
  onClick,
}: {
  label: string;
  on: boolean;
  accent?: string;
  outline?: boolean;
  onClick: () => void;
}) {
  const cls = `wt-chip${on ? (outline ? " on-outline" : " on") : ""}`;
  return (
    <button className={cls} style={accent ? { ["--chip-accent" as string]: accent } : undefined} onClick={onClick} type="button">
      {label}
    </button>
  );
}
