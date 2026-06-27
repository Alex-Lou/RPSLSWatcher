/**
 * MatchupHeatmap — grille 5×5 : ligne = MA Voie, colonne = Voie adverse. Couleur
 * divergente centrée sur 50% (res-loss → neutre → res-win), opacité ∝ nombre de
 * parties (confiance). % net + n (ambre si faible). Diagonale (miroir) hachurée.
 * Tap cellule → filtre (onCell).
 */
import { useEffect, useRef } from "react";
import { MOVES, VOIE_META, type MatchupCell, type Move } from "../data/types";
import { useMeasuredWidth } from "./useMeasuredWidth";
import { alpha, cssVar, cssVarNum, dataText, setupCanvas, withGlow } from "./canvasKit";

export function MatchupHeatmap({ grid, onCell }: { grid: MatchupCell[][]; onCell?: (att: Move, def: Move) => void }) {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const geomRef = useRef({ gut: 0, top: 0, cw: 0, ch: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0) return;
    const n = MOVES.length;
    const gut = width < 380 ? 40 : 64;
    const top = 30;
    const cw = (width - gut - 4) / n;
    const ch = 46;
    const h = top + n * ch + 6;
    geomRef.current = { gut, top, cw, ch };
    const ctx = setupCanvas(canvas, width, h);
    const showN = width >= 360;

    // labels colonnes (adversaire)
    MOVES.forEach((mv, j) => {
      dataText(ctx, VOIE_META[mv].glyph, gut + j * cw + cw / 2, top - 14, { align: "center", size: 16 });
    });

    for (let i = 0; i < n; i++) {
      dataText(ctx, VOIE_META[MOVES[i]].glyph, gut - 8, top + i * ch + ch / 2, { align: "right", size: 16 });
      for (let j = 0; j < n; j++) {
        const c = grid[i][j];
        const x = gut + j * cw;
        const y = top + i * ch;
        if (i === j) {
          // miroir : hachuré
          ctx.fillStyle = alpha(cssVar("--ink-dim"), 0.08);
          ctx.fillRect(x + 1, y + 1, cw - 2, ch - 2);
          ctx.strokeStyle = alpha(cssVar("--ink-dim"), 0.25);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x + 4, y + ch - 4);
          ctx.lineTo(x + cw - 4, y + 4);
          ctx.stroke();
          continue;
        }
        if (Number.isNaN(c.winRate) || c.games === 0) {
          ctx.fillStyle = alpha(cssVar("--bg-3"), 0.6);
          ctx.fillRect(x + 1, y + 1, cw - 2, ch - 2);
          dataText(ctx, "·", x + cw / 2, y + ch / 2, { align: "center", size: 12, color: cssVar("--ink-dim") });
          continue;
        }
        const d = c.winRate - 0.5;
        const base = d >= 0 ? cssVar("--res-win") : cssVar("--res-loss");
        const conf = Math.min(1, c.games / 12);
        ctx.fillStyle = alpha(base, Math.min(0.62, Math.abs(d) * 2 * 0.55 * conf + 0.05));
        ctx.fillRect(x + 1, y + 1, cw - 2, ch - 2);
        ctx.strokeStyle = alpha("#000000", 0.35);
        ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1);
        if (c.winRate > 0.65 || c.winRate < 0.35) {
          withGlow(ctx, base, cssVarNum("--glow-sm", 6), () => {
            ctx.strokeStyle = base;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x + 1.5, y + 1.5, cw - 3, ch - 3);
          });
        }
        dataText(ctx, `${(c.winRate * 100).toFixed(0)}%`, x + cw / 2, y + ch / 2 - (showN ? 6 : 0), { align: "center", size: 13, color: cssVar("--ink-bright") });
        if (showN) dataText(ctx, `n${c.games}`, x + cw / 2, y + ch / 2 + 9, { align: "center", size: 9.5, color: c.games < 12 ? cssVar("--neon-amber") : cssVar("--ink-dim") });
      }
    }
  }, [grid, width]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onCell) return;
    const { gut, top, cw, ch } = geomRef.current;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const j = Math.floor((px - gut) / cw);
    const i = Math.floor((py - top) / ch);
    if (i >= 0 && i < MOVES.length && j >= 0 && j < MOVES.length && i !== j) onCell(MOVES[i], MOVES[j]);
  };

  return (
    <div ref={ref} className="lab-canvas-wrap">
      <canvas ref={canvasRef} onClick={handleClick} style={{ cursor: onCell ? "pointer" : "default" }} />
      <div className="lab-legend">
        <span style={{ color: cssVar("--res-loss") }}>◀ tu perds</span>
        <span>50% équilibré</span>
        <span style={{ color: cssVar("--res-win") }}>tu domines ▶</span>
        <span>opacité = nombre de parties</span>
      </div>
    </div>
  );
}
