/**
 * WinRateBars — win-rate par Voie jouée, barres horizontales triées. Couleur de
 * barre = Voie ; glow = issue (res-win si >50%, res-loss sinon). Repère 50%.
 * Valeur nette + n sous le label. (Perf perso, ≠ équilibrage du jeu.)
 */
import { useEffect, useRef } from "react";
import { VOIE_META, type VoieAgg } from "../data/types";
import { useMeasuredWidth } from "./useMeasuredWidth";
import { alpha, cssVar, cssVarNum, dataText, setupCanvas, withGlow } from "./canvasKit";

export function WinRateBars({ stats }: { stats: VoieAgg[] }) {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0) return;
    const rows = [...stats].filter((s) => s.games > 0).sort((a, b) => b.winRate - a.winRate);
    const padL = 92;
    const padR = 52;
    const padT = 12;
    const rowH = 38;
    const h = padT * 2 + Math.max(1, rows.length) * rowH;
    const ctx = setupCanvas(canvas, width, h);
    const x0 = padL;
    const x1 = width - padR;
    const span = x1 - x0;
    const xOf = (p: number) => x0 + Math.max(0, Math.min(1, p)) * span;

    // repère 50 %
    ctx.strokeStyle = alpha(cssVar("--ink-dim"), 0.5);
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(xOf(0.5) + 0.5, padT - 2);
    ctx.lineTo(xOf(0.5) + 0.5, padT + rows.length * rowH);
    ctx.stroke();
    ctx.setLineDash([]);
    dataText(ctx, "50%", xOf(0.5), padT - 6, { align: "center", baseline: "bottom", size: 9, color: cssVar("--ink-dim") });

    rows.forEach((s, i) => {
      const cy = padT + i * rowH + rowH / 2;
      const voie = cssVar(VOIE_META[s.voie].cssVar);
      const glow = s.winRate >= 0.5 ? cssVar("--res-win") : cssVar("--res-loss");
      dataText(ctx, VOIE_META[s.voie].name, x0 - 10, cy - 5, { align: "right", color: voie, size: 13, font: '"Rajdhani", sans-serif' });
      dataText(ctx, `${s.games} parties`, x0 - 10, cy + 10, { align: "right", color: cssVar("--ink-dim"), size: 10 });
      // rail
      ctx.fillStyle = alpha(cssVar("--ink-dim"), 0.12);
      ctx.fillRect(x0, cy - 7, span, 14);
      withGlow(ctx, glow, cssVarNum("--glow-md", 12), () => {
        ctx.fillStyle = voie;
        ctx.fillRect(x0, cy - 7, xOf(s.winRate) - x0, 14);
      });
      dataText(ctx, `${(s.winRate * 100).toFixed(0)}%`, x1 + 8, cy, { align: "left", size: 13, color: cssVar("--ink-bright") });
    });
  }, [stats, width]);

  return (
    <div ref={ref} className="lab-canvas-wrap">
      <canvas ref={canvasRef} />
    </div>
  );
}
