/**
 * GaussHisto — LA courbe de Gauss. Histogramme des échantillons + cloche normale
 * (μ, σ Bessel n−1) en repère visuel. Ordre de dessin imposé (lisibilité) :
 * barres (sans glow) → bande σ → aire dégradée → CONTOUR cloche (seul glow) →
 * ligne μ → valeurs nettes. Sous-titre skew = « où la cloche ment ».
 */
import { useEffect, useRef } from "react";
import { mean, skewness } from "../data/analysis";
import { useMeasuredWidth } from "./useMeasuredWidth";
import { alpha, cssVar, cssVarNum, dataText, setupCanvas, withGlow } from "./canvasKit";

function besselStd(xs: number[], m: number): number {
  if (xs.length < 2) return 0;
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}
function normalPdf(x: number, m: number, s: number): number {
  if (s <= 0) return 0;
  return Math.exp(-((x - m) ** 2) / (2 * s * s)) / (s * Math.sqrt(2 * Math.PI));
}

export function GaussHisto({
  samples,
  color,
  unit = "",
  bins,
  height = 210,
}: {
  samples: number[];
  color: string;
  unit?: string;
  bins?: number;
  height?: number;
}) {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0) return;
    const ctx = setupCanvas(canvas, width, height);
    const padL = 34;
    const padR = 14;
    const padT = 14;
    const padB = 30;
    const x0 = padL;
    const x1 = width - padR;
    const y0 = height - padB;
    const y1 = padT;
    const accent = cssVar(color);

    const n = samples.length;
    if (n === 0) {
      dataText(ctx, "—", (x0 + x1) / 2, (y0 + y1) / 2, { align: "center", color: cssVar("--ink-dim") });
      return;
    }
    const lo = Math.min(...samples);
    const hi = Math.max(...samples);
    if (hi === lo) {
      // valeur constante → pas d'histogramme/cloche trompeur, on l'annonce.
      dataText(ctx, `valeur constante : ${fmt(lo)}${unit} (σ=0)`, (x0 + x1) / 2, (y0 + y1) / 2, {
        align: "center",
        size: 13,
        color: cssVar("--ink-dim"),
        font: '"Rajdhani", sans-serif',
      });
      return;
    }
    const span = hi - lo;
    const binCount = Math.max(1, bins ?? Math.min(14, Math.max(6, Math.round(Math.sqrt(n)))));
    const bw = span / binCount;
    const counts = new Array(binCount).fill(0);
    for (const v of samples) {
      let i = Math.floor((v - lo) / bw);
      if (i >= binCount) i = binCount - 1;
      if (i < 0) i = 0;
      counts[i]++;
    }
    const peak = Math.max(...counts, 1);

    const m = mean(samples);
    const s = besselStd(samples, m);

    const xOf = (v: number) => x0 + ((v - lo) / span) * (x1 - x0);
    const yCount = (c: number) => y0 - (c / peak) * (y0 - y1);

    // axe X (min, μ, max)
    ctx.strokeStyle = alpha(cssVar("--ink-dim"), 0.4);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, y0 + 0.5);
    ctx.lineTo(x1, y0 + 0.5);
    ctx.stroke();
    dataText(ctx, fmt(lo) + unit, x0, y0 + 14, { align: "left", size: 10, color: cssVar("--ink-dim") });
    dataText(ctx, fmt(hi) + unit, x1, y0 + 14, { align: "right", size: 10, color: cssVar("--ink-dim") });

    // (1) barres histogramme — SANS glow
    const innerGap = Math.min(3, (x1 - x0) / binCount / 6);
    ctx.fillStyle = cssVar("--bell-bar");
    for (let i = 0; i < binCount; i++) {
      const bx0 = xOf(lo + i * bw) + innerGap;
      const bx1 = xOf(lo + (i + 1) * bw) - innerGap;
      const top = yCount(counts[i]);
      ctx.fillRect(bx0, top, Math.max(1, bx1 - bx0), y0 - top);
    }

    if (s > 0) {
      // (2) bande σ (μ±σ)
      ctx.fillStyle = alpha(accent, 0.06);
      ctx.fillRect(xOf(m - s), y1, xOf(m + s) - xOf(m - s), y0 - y1);

      // densité scalée au pic de l'histo
      const pdfPeak = normalPdf(m, m, s) || 1;
      const yBell = (x: number) => y0 - (normalPdf(x, m, s) / pdfPeak) * (y0 - y1) * 0.96;
      const steps = 80;
      const pts: [number, number][] = [];
      for (let i = 0; i <= steps; i++) {
        const xv = lo + (span * i) / steps;
        pts.push([xOf(xv), yBell(xv)]);
      }
      // (3) aire dégradée — SANS glow
      const grad = ctx.createLinearGradient(0, y1, 0, y0);
      grad.addColorStop(0, alpha(accent, 0.16));
      grad.addColorStop(1, alpha(accent, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], y0);
      for (const [px, py] of pts) ctx.lineTo(px, py);
      ctx.lineTo(pts[pts.length - 1][0], y0);
      ctx.closePath();
      ctx.fill();

      // (4) CONTOUR cloche — seul glow
      withGlow(ctx, accent, cssVarNum("--glow-md", 12), () => {
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2.5;
        ctx.lineJoin = "round";
        ctx.beginPath();
        pts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
        ctx.stroke();
      });

      // (5) ligne μ pointillée
      withGlow(ctx, cssVar("--bell-mean"), cssVarNum("--glow-sm", 6), () => {
        ctx.strokeStyle = cssVar("--bell-mean");
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(xOf(m), y1);
        ctx.lineTo(xOf(m), y0);
        ctx.stroke();
        ctx.setLineDash([]);
      });
    }

    // (6) valeurs nettes
    dataText(ctx, `μ ${fmt(m)}${unit}`, xOf(m), y1 + 2, { align: "center", baseline: "top", size: 12, color: cssVar("--bell-mean") });
    dataText(ctx, `σ ${fmt(s)}`, x1, y1 + 2, { align: "right", baseline: "top", size: 11, color: cssVar("--ink-dim") });
  }, [samples, color, unit, bins, height, width]);

  const skew = samples.length >= 3 ? skewness(samples) : 0;
  const shape = Math.abs(skew) < 0.5 ? "symétrique" : skew > 0 ? "étalée à droite" : "étalée à gauche";

  return (
    <div ref={ref} className="lab-canvas-wrap">
      <canvas ref={canvasRef} />
      <div className="lab-legend">
        <span>μ = moyenne · σ = dispersion (large = aléatoire)</span>
        <span>forme : {shape}</span>
      </div>
    </div>
  );
}

function fmt(x: number): string {
  return Math.abs(x) >= 10 || Number.isInteger(x) ? x.toFixed(0) : x.toFixed(1);
}
