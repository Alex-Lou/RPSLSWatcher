/**
 * ExpertDiagnostics — lecture EXPERTE du déroulé (turnLog, v:2), vulgarisée.
 * Tout est gardé par la taille d'échantillon. Si aucune partie détaillée n'est
 * encore enregistrée, on l'explique au lieu d'afficher du vide.
 */
import { useMemo } from "react";
import {
  affinityLeverage,
  damageChannels,
  deadTurnStats,
  drawStats,
  finisherTiming,
  tempoStats,
  withTurnLog,
} from "../data/diagnostics";
import { MOVES, VOIE_META, type MatchRecord } from "../data/types";

const pct = (x: number) => `${Math.round(x * 100)}%`;

function Meter({ value, max, color }: { value: number; max: number; color: string }) {
  const w = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  return (
    <div className="wt-meter">
      <div className="wt-meter-fill" style={{ width: `${w * 100}%`, background: color }} />
    </div>
  );
}

export function ExpertDiagnostics({ matches }: { matches: MatchRecord[] }) {
  const d = useMemo(() => {
    return {
      n: withTurnLog(matches).length,
      tempo: tempoStats(matches),
      draw: drawStats(matches),
      aff: affinityLeverage(matches),
      dead: deadTurnStats(matches),
      dmg: damageChannels(matches),
      fin: finisherTiming(matches),
    };
  }, [matches]);

  if (d.n === 0) {
    return (
      <div className="wt-empty" style={{ textAlign: "left", padding: "8px 2px" }}>
        Aucune partie avec déroulé détaillé (v:2) sur ce filtre. Joue avec le build à jour : chaque partie Arena Pro
        enregistrera alors le détail tour par tour, et cette analyse experte s'activera (rythme, pioche, affinité,
        provenance des dégâts, points morts).
      </div>
    );
  }

  const maxWaste = Math.max(1.5, ...MOVES.map((v) => d.tempo.byVoie[v]));
  const deadPeak = d.dead.byTurn.reduce((best, v, i) => (v > d.dead.byTurn[best] ? i : best), 0);

  return (
    <div className="wt-diag">
      <div className="wt-diag-note">
        Analyse fine sur <b>{d.n}</b> parties détaillées (déroulé tour par tour).
      </div>

      {/* Rythme / mana */}
      <div className="wt-diag-block">
        <div className="wt-diag-title">RYTHME — mana gaspillé</div>
        <div className="wt-diag-big" style={{ color: "var(--neon-cyan)" }}>
          {d.tempo.wastedPerTurn.toFixed(1)} <span>/ tour</span>
        </div>
        <div className="wt-diag-sub">
          {d.tempo.wastedPerTurn < 0.8
            ? "Courbe propre : tu dépenses presque tout ton mana."
            : d.tempo.wastedPerTurn < 1.8
              ? "Un peu de mana dort certains tours — marge d'optimisation."
              : "Beaucoup de mana gaspillé : courbe trop lente ou main qui ne suit pas."}
        </div>
        <div className="wt-diag-bars">
          {MOVES.map((v) => (
            <div className="wt-diag-barline" key={v}>
              <span className="lbl" style={{ color: `var(${VOIE_META[v].cssVar})` }}>{VOIE_META[v].name}</span>
              <Meter value={d.tempo.byVoie[v]} max={maxWaste} color={`var(${VOIE_META[v].cssVar})`} />
              <span className="val">{d.tempo.byVoie[v].toFixed(1)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pioche */}
      <div className="wt-diag-block">
        <div className="wt-diag-title">PIOCHE — noyée vs affamée</div>
        <div className="wt-diag-duo">
          <div>
            <div className="wt-diag-big" style={{ color: "var(--neon-amber)" }}>{pct(d.draw.floodedRate)}</div>
            <div className="wt-diag-sub">tours main saturée (cartes bloquées)</div>
          </div>
          <div>
            <div className="wt-diag-big" style={{ color: "var(--res-loss)" }}>{pct(d.draw.starvedRate)}</div>
            <div className="wt-diag-sub">tours affamés / deck vide (fatigue)</div>
          </div>
        </div>
        <div className="wt-diag-sub">
          Main moyenne en début de tour : <b>{d.draw.avgHandStart.toFixed(1)}</b> cartes.
        </div>
      </div>

      {/* Levier d'affinité */}
      <div className="wt-diag-block">
        <div className="wt-diag-title">LEVIER D'AFFINITÉ — jouer dans ta Voie paye-t-il ?</div>
        <div className="wt-diag-duo">
          <div>
            <div className="wt-diag-big" style={{ color: "var(--neon-violet)" }}>{pct(d.aff.playRate)}</div>
            <div className="wt-diag-sub">de tes invocations sont dans ta Voie</div>
          </div>
          <div>
            <div className="wt-diag-big" style={{ color: "var(--neon-lime)" }}>{pct(d.aff.engineRiseRate)}</div>
            <div className="wt-diag-sub">des tours, ta jauge de Voie monte</div>
          </div>
        </div>
        {d.aff.leverage !== null ? (
          <div className={`wt-diag-verdict ${d.aff.leverage >= 0 ? "good" : "bad"}`}>
            {d.aff.leverage >= 0 ? "▲" : "▼"} Jouer surtout dans ta Voie change ton win-rate de{" "}
            <b>{d.aff.leverage >= 0 ? "+" : ""}{pct(d.aff.leverage)}</b>{" "}
            ({pct(d.aff.winRateHiAff!)} en affinité forte vs {pct(d.aff.winRateLoAff!)} sinon).
          </div>
        ) : (
          <div className="wt-diag-sub">Pas encore assez de parties pour mesurer le gain net (≈8 de chaque type requises).</div>
        )}
      </div>

      {/* Provenance des dégâts (Tier B) */}
      {d.dmg.n > 0 && (
        <div className="wt-diag-block">
          <div className="wt-diag-title">PROVENANCE DES DÉGÂTS — d'où viennent tes PV infligés</div>
          <div className="wt-stack">
            <div className="wt-stack-seg" style={{ width: `${d.dmg.counterSplash * 100}%`, background: "var(--res-win)" }} title="splash de contre" />
            <div className="wt-stack-seg" style={{ width: `${d.dmg.direct * 100}%`, background: "var(--neon-cyan)" }} title="frappe directe" />
            <div className="wt-stack-seg" style={{ width: `${d.dmg.other * 100}%`, background: "var(--neon-amber)" }} title="sorts + chip" />
          </div>
          <div className="lab-legend">
            <span style={{ color: "var(--res-win)" }}>● KO sec / splash {pct(d.dmg.counterSplash)}</span>
            <span style={{ color: "var(--neon-cyan)" }}>● frappe directe {pct(d.dmg.direct)}</span>
            <span style={{ color: "var(--neon-amber)" }}>● sorts + chip {pct(d.dmg.other)}</span>
          </div>
          <div className="wt-diag-sub">
            <b>{pct(d.dmg.koLaneRate)}</b> des combats de lane finissent par un KO sec (contre RPSLS).
          </div>
        </div>
      )}

      {/* Points morts */}
      <div className="wt-diag-block">
        <div className="wt-diag-title">POINTS MORTS — tours où rien ne bouge</div>
        <div className="wt-diag-big" style={{ color: d.dead.rate > 0.25 ? "var(--res-loss)" : "var(--neon-cyan)" }}>
          {pct(d.dead.rate)}
        </div>
        <div className="wt-diag-sub">
          {d.dead.rate > 0.25
            ? "Beaucoup de tours creux — le rythme casse (problème de point mort)."
            : "Rythme soutenu : peu de tours sans enjeu."}
        </div>
        {d.dead.byTurn.length > 1 && (
          <>
            <div className="wt-spark">
              {d.dead.byTurn.map((v, i) => (
                <div
                  key={i}
                  className="wt-spark-bar"
                  title={`T${i + 1} : ${pct(v)} creux`}
                  style={{ height: `${Math.max(3, v * 100)}%`, background: i === deadPeak && v > 0 ? "var(--res-loss)" : "var(--bell-bar)" }}
                />
              ))}
            </div>
            <div className="wt-diag-sub">Plus creux : tour {deadPeak + 1} ({pct(d.dead.byTurn[deadPeak])}).</div>
          </>
        )}
      </div>

      {/* Finisher */}
      {d.fin.n > 0 && (
        <div className="wt-diag-block">
          <div className="wt-diag-title">FINISHER — timing réel</div>
          <div className="wt-diag-sub">
            Débloqué en moyenne au <b>tour {d.fin.avgUnlockTurn.toFixed(1)}</b> ({d.fin.n} parties).
            {d.fin.winRateAfterUnlock !== null && (
              <> Quand il sort, tu gagnes <b>{pct(d.fin.winRateAfterUnlock)}</b> du temps.</>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
