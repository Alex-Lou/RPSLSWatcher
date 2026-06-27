/** AnchorChips — saut rapide vers les sections (scroll-x sur mobile). */
export function AnchorChips({ items }: { items: { id: string; label: string }[] }) {
  return (
    <nav className="wt-anchors" aria-label="Sections">
      {items.map((it) => (
        <a key={it.id} className="wt-anchor" href={`#${it.id}`}>
          {it.label}
        </a>
      ))}
    </nav>
  );
}
