/** Mesure la largeur d'un élément (synchrone au montage + ResizeObserver) →
 *  canvas responsive. Mesure synchrone via getBoundingClientRect = largeur
 *  non-nulle dès le 1er rendu (l'observer prend le relais aux resizes). */
import { useLayoutEffect, useRef, useState } from "react";

export function useMeasuredWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const cw = Math.round(el.getBoundingClientRect().width);
      if (cw > 0) setW((prev) => (prev === cw ? prev : cw));
    };
    measure();
    // filet : une mesure post-layout (au cas où le 1er passe avant la mise en page)
    const raf = requestAnimationFrame(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);
  return [ref, w];
}
