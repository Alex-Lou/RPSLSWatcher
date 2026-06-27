/**
 * WinRateTimeline — win-rate dans le temps : ligne GLISSANTE (fenêtre) + ligne
 * CUMULÉE (atténuée) + repère 50%. Montre la progression de skill vs la variance.
 */
import { useEffect, useRef } from "react";
import type { TimePoint } from "../data/types";
import { useMeasuredWidth } from "./useMeasuredWidth";
import { alpha, cssVar, cssVarNum, dataText, setupCanvas, withGlow } from "./canvasKit";

export function WinRateTimeline({ points }: { points: TimePoint[] }) {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0) return;
    const h = 200;
    const ctx = setupCanvas(canvas, width, h);
    const padL = 32;
    const padR = 12;
    const padT = 12;
    const padB = 20;
    const x0 = padL;
    const x1 = width - padR;
    const y0 = h - padB;
    const y1 = padT;
    const n = points.length;
    const xOf = (i: number) => x0 + (n <= 1 ? 0.5 : i / (n - 1)) * (x1 - x0);
    const yOf = (p: number) => y0 - p * (y0 - y1);

    // grille + repère 50%
    ctx.strokeStyle = alpha(cssVar("--grid"), 0.6);
    ctx.lineWidth = 1;
    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
      ctx.beginPath();
      ctx.moveTo(x0, yOf(p));
      ctx.lineTo(x1, yOf(p));
      ctx.stroke();
      dataText(ctx, `${p * 100}`, x0 - 5, yOf(p), { align: "right", size: 9, color: cssVar("--ink-dim") });
    }
    ctx.strokeStyle = alpha(cssVar("--ink-dim"), 0.6);
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x0, yOf(0.5));
    ctx.lineTo(x1, yOf(0.5));
    ctx.stroke();
    ctx.setLineDash([]);

    if (n === 0) {
      dataText(ctx, "—", (x0 + x1) / 2, (y0 + y1) / 2, { align: "center", color: cssVar("--ink-dim") });
      return;
    }

    // cumulé (atténué)
    ctx.strokeStyle = alpha(cssVar("--ink-dim"), 0.8);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    points.forEach((p, i) => (i === 0 ? ctx.moveTo(xOf(i), yOf(p.cumWinRate)) : ctx.lineTo(xOf(i), yOf(p.cumWinRate))));
    ctx.stroke();

    // glissant (néon glow)
    const cyan = cssVar("--neon-cyan");
    withGlow(ctx, cyan, cssVarNum("--glow-md", 12), () => {
      ctx.strokeStyle = cyan;
      ctx.lineWidth = 2.4;
      ctx.lineJoin = "round";
      ctx.beginPath();
      points.forEach((p, i) => (i === 0 ? ctx.moveTo(xOf(i), yOf(p.rolling)) : ctx.lineTo(xOf(i), yOf(p.rolling))));
      ctx.stroke();
    });
    // point courant
    const last = points[n - 1];
    withGlow(ctx, cyan, cssVarNum("--glow-sm", 6), () => {
      ctx.fillStyle = cyan;
      ctx.beginPath();
      ctx.arc(xOf(n - 1), yOf(last.rolling), 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [points, width]);

  return (
    <div ref={ref} className="lab-canvas-wrap">
      <canvas ref={canvasRef} />
      <div className="lab-legend">
        <span style={{ color: cssVar("--neon-cyan") }}>● glissant</span>
        <span style={{ color: cssVar("--ink-dim") }}>● cumulé</span>
        <span>gauche = ancien · droite = récent</span>
      </div>
    </div>
  );
}
