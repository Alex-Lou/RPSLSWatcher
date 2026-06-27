/**
 * canvasKit — helpers canvas 2D partagés (copiés/étendus du balancelab du jeu ;
 * indépendance de déploiement > DRY). Glow néon natif via shadowBlur. Règle
 * d'or : glow sur contours/courbes, JAMAIS sur un chiffre lu (dataText shadow=0).
 */

/** Résout une var CSS (--neon-cyan…) en couleur concrète pour le canvas. */
export function cssVar(name: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || "#2af5ff";
}

/** Résout une var CSS numérique (--glow-md → 12). Cappe le blur sur mobile. */
export function cssVarNum(name: string, fallback = 0): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(raw);
  const val = Number.isFinite(n) ? n : fallback;
  // mobile : un blur trop fort bave → cappe à ~6 sous 520px.
  return window.innerWidth < 520 ? Math.min(val, 6) : val;
}

/** Prépare un canvas hi-DPI (net Retina) et renvoie son contexte 2D. */
export function setupCanvas(canvas: HTMLCanvasElement, cssW: number, cssH: number): CanvasRenderingContext2D {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  // largeur en % (suit le conteneur → ne le force pas à rester large : le
  // ResizeObserver peut re-mesurer au rétrécissement). Hauteur en px (ratio fixe).
  canvas.style.width = "100%";
  canvas.style.height = `${cssH}px`;
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  return ctx;
}

/** Exécute un dessin avec un halo néon, puis restaure (shadow off). */
export function withGlow(ctx: CanvasRenderingContext2D, color: string, blur: number, fn: () => void): void {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  fn();
  ctx.restore();
}

/** Texte de DONNÉES net (sans glow) — pour les valeurs lues. */
export function dataText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: { color?: string; align?: CanvasTextAlign; baseline?: CanvasTextBaseline; size?: number; font?: string } = {},
): void {
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.fillStyle = opts.color ?? cssVar("--ink");
  ctx.textAlign = opts.align ?? "left";
  ctx.textBaseline = opts.baseline ?? "middle";
  ctx.font = `${opts.size ?? 12}px ${opts.font ?? '"Share Tech Mono", monospace'}`;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Quadrillage de fond technique discret. */
export function grid(ctx: CanvasRenderingContext2D, w: number, h: number, step = 28): void {
  ctx.save();
  ctx.strokeStyle = cssVar("--grid");
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = step; x < w; x += step) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
  }
  for (let y = step; y < h; y += step) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
  }
  ctx.stroke();
  ctx.restore();
}

/** Applique une opacité à une couleur hex (#rrggbb) → rgba. */
export function alpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
