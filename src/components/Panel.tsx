/** Panel — wrapper de section : titre Orbitron + sous-titre/aside optionnels +
 *  corps. `id` pour l'ancre de navigation. */
import type { ReactNode } from "react";

export function Panel({
  id,
  title,
  sub,
  aside,
  children,
}: {
  id?: string;
  title: string;
  sub?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="lab-panel wt-section">
      <div className="lab-panel-head">
        <span>
          {title}
          {sub && <span className="lab-panel-sub">&nbsp;&nbsp;{sub}</span>}
        </span>
        {aside}
      </div>
      <div className="lab-panel-body">{children}</div>
    </section>
  );
}
