/**
 * HpTrajectory — trajectoires de PV MOYENNES par tour : moi (cyan) vs adversaire
 * (res-loss), rubans ±σ optionnels, remplissage de l'écart, ligne PV=0. Montre la
 * FORME de tes parties (domination vs come-back).
 */
import { useEffect, useRef } from "react";
import { useMeasuredWidth } from "./useMeasuredWidth";
import { alpha, cssVar, cssVarNum, dataText, setupCanvas, withGlow } from "./canvasKit";

const HP_MAX = 20;

export function HpTrajectory({
  self,
  opp,
  bandSelf,
  bandOpp,
}: {
  self: number[];
  opp: number[];
  bandSelf?: number[];
  bandOpp?: number[];
}) {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0) return;
    const h = 220;
    const ctx = setupCanvas(canvas, width, h);
    const padL = 30;
    const padR = 12;
    const padT = 14;
    const padB = 24;
    const x0 = padL;
    const x1 = width - padR;
    const y0 = h - padB;
    const y1 = padT;
    const maxT = Math.max(2, self.length - 1, opp.length - 1);
    const xOf = (t: number) => x0 + (t / maxT) * (x1 - x0);
    const yOf = (hp: number) => y0 - (hp / HP_MAX) * (y0 - y1);

    // grille Y
    ctx.strokeStyle = alpha(cssVar("--grid"), 0.6);
    ctx.lineWidth = 1;
    for (let hp = 0; hp <= HP_MAX; hp += 5) {
      ctx.beginPath();
      ctx.moveTo(x0, yOf(hp));
      ctx.lineTo(x1, yOf(hp));
      ctx.stroke();
      dataText(ctx, String(hp), x0 - 5, yOf(hp), { align: "right", size: 9, color: cssVar("--ink-dim") });
    }
    for (let t = 0; t <= maxT; t += Math.max(1, Math.ceil(maxT / 8))) {
      dataText(ctx, `T${t}`, xOf(t), y0 + 11, { align: "center", size: 9, color: cssVar("--ink-dim") });
    }

    const selfC = cssVar("--neon-cyan");
    const oppC = cssVar("--res-loss");

    const ribbon = (series: number[], band: number[] | undefined, color: string) => {
      if (!band) return;
      ctx.fillStyle = alpha(color, 0.12);
      ctx.beginPath();
      series.forEach((hp, t) => {
        const px = xOf(t);
        const py = yOf(Math.min(HP_MAX, hp + (band[t] ?? 0)));
        t === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      });
      for (let t = series.length - 1; t >= 0; t--) {
        ctx.lineTo(xOf(t), yOf(Math.max(0, series[t] - (band[t] ?? 0))));
      }
      ctx.closePath();
      ctx.fill();
    };
    ribbon(self, bandSelf, selfC);
    ribbon(opp, bandOpp, oppC);

    const line = (series: number[], color: string) => {
      if (series.length < 2) return;
      withGlow(ctx, color, cssVarNum("--glow-md", 12), () => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.4;
        ctx.lineJoin = "round";
        ctx.beginPath();
        series.forEach((hp, t) => (t === 0 ? ctx.moveTo(xOf(t), yOf(hp)) : ctx.lineTo(xOf(t), yOf(hp))));
        ctx.stroke();
      });
    };
    line(self, selfC);
    line(opp, oppC);
  }, [self, opp, bandSelf, bandOpp, width]);

  return (
    <div ref={ref} className="lab-canvas-wrap">
      <canvas ref={canvasRef} />
      <div className="lab-legend">
        <span style={{ color: cssVar("--neon-cyan") }}>● toi</span>
        <span style={{ color: cssVar("--res-loss") }}>● adversaire</span>
        <span>PV moyens par tour (rubans = ±σ)</span>
      </div>
    </div>
  );
}
