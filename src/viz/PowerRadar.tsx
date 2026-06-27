/**
 * PowerRadar — pentagone des 5 Voies : ta « forme de jeu ». Valeur = win-rate
 * (0..1) ou volume (part des parties), un sommet par Voie teinté --voie-*.
 * Contour cyan glow, valeurs nettes à l'extérieur. 2e polygone (compare) en
 * magenta pointillé si fourni.
 */
import { useEffect, useRef } from "react";
import { MOVES, VOIE_META, type Move } from "../data/types";
import { useMeasuredWidth } from "./useMeasuredWidth";
import { alpha, cssVar, cssVarNum, dataText, setupCanvas, withGlow } from "./canvasKit";

export function PowerRadar({
  values,
  compare,
  mode,
}: {
  values: Record<Move, number>;
  compare?: Record<Move, number>;
  mode: "winrate" | "volume";
}) {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0) return;
    const h = 260;
    const ctx = setupCanvas(canvas, width, h);
    const cx = width / 2;
    const cy = h / 2 + 4;
    const R = Math.min(width, h) / 2 - 42;
    const n = MOVES.length;
    const angle = (k: number) => -Math.PI / 2 + (k / n) * Math.PI * 2;

    // toile (anneaux + rayons)
    ctx.strokeStyle = alpha(cssVar("--grid"), 0.7);
    ctx.lineWidth = 1;
    for (let r = 1; r <= 4; r++) {
      ctx.beginPath();
      for (let k = 0; k <= n; k++) {
        const a = angle(k % n);
        const px = cx + Math.cos(a) * (R * r) / 4;
        const py = cy + Math.sin(a) * (R * r) / 4;
        k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    MOVES.forEach((mv, k) => {
      const a = angle(k);
      ctx.strokeStyle = alpha(cssVar("--grid"), 0.7);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      ctx.stroke();
      dataText(ctx, VOIE_META[mv].glyph, cx + Math.cos(a) * (R + 18), cy + Math.sin(a) * (R + 14), { align: "center", size: 15 });
    });

    const poly = (vals: Record<Move, number>, color: string, dash: boolean, fill: boolean) => {
      ctx.save();
      if (dash) ctx.setLineDash([5, 4]);
      const draw = () => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.fillStyle = alpha(color, 0.08);
        ctx.beginPath();
        MOVES.forEach((mv, k) => {
          const v = Math.max(0, Math.min(1, vals[mv] ?? 0));
          const a = angle(k);
          const px = cx + Math.cos(a) * R * (0.08 + 0.92 * v);
          const py = cy + Math.sin(a) * R * (0.08 + 0.92 * v);
          k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        });
        ctx.closePath();
        if (fill) ctx.fill();
        ctx.stroke();
      };
      withGlow(ctx, color, cssVarNum("--glow-sm", 6), draw);
      ctx.restore();
    };

    if (compare) poly(compare, cssVar("--neon-magenta"), true, false);
    poly(values, cssVar("--neon-cyan"), false, true);

    // valeurs nettes au sommet
    MOVES.forEach((mv, k) => {
      const v = values[mv] ?? 0;
      const a = angle(k);
      const px = cx + Math.cos(a) * R * (0.08 + 0.92 * Math.max(0, Math.min(1, v)));
      const py = cy + Math.sin(a) * R * (0.08 + 0.92 * Math.max(0, Math.min(1, v)));
      dataText(ctx, mode === "winrate" ? `${Math.round(v * 100)}%` : `${Math.round(v * 100)}%`, px, py - 9, { align: "center", size: 10, color: cssVar("--ink-bright") });
    });
  }, [values, compare, mode, width]);

  return (
    <div ref={ref} className="lab-canvas-wrap">
      <canvas ref={canvasRef} />
    </div>
  );
}
