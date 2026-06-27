/**
 * App — shell du Watcher. Vérité unique : `records` (immuable après fetch) +
 * `filters`. Tout le dérivé = un seul useMemo (aggregate) → zéro désync, zéro
 * re-fetch sur filtre. Scroll vertical unique, du verdict au détail.
 */
import { useEffect, useMemo, useState } from "react";
import {
  applyFilters,
  avgHpTrajectory,
  endReasonCounts,
  finisherStats,
  kpis,
  matchupGrid,
  mean,
  segmentByOpp,
  streaks,
  timeSeries,
  voieAggs,
} from "./data/analysis";
import { demoSource, loadMatches, type DataSource } from "./data/api";
import { buildDiagnostics, buildVerdict } from "./data/verdict";
import { MOVES, VOIE_META, type MatchRecord, type Move } from "./data/types";
import { useFilters } from "./controls/useFilters";
import { FilterBar } from "./controls/FilterBar";
import { Header } from "./components/Header";
import { AnchorChips } from "./components/AnchorChips";
import { VerdictStrip } from "./components/VerdictStrip";
import { KpiTiles } from "./components/KpiTiles";
import { Panel } from "./components/Panel";
import { DiagnosticList } from "./components/DiagnosticList";
import { MatchJournal } from "./components/MatchJournal";
import { ReplayJournal } from "./components/ReplayJournal";
import { ExpertDiagnostics } from "./components/ExpertDiagnostics";
import { CardStats } from "./components/CardStats";
import { EmptyState } from "./components/EmptyState";
import { PwaInstall } from "./components/PwaInstall";
import { WinRateBars } from "./viz/WinRateBars";
import { PowerRadar } from "./viz/PowerRadar";
import { MatchupHeatmap } from "./viz/MatchupHeatmap";
import { HpTrajectory } from "./viz/HpTrajectory";
import { GaussHisto } from "./viz/GaussHisto";
import { WinRateTimeline } from "./viz/WinRateTimeline";
import { StreakStrip } from "./viz/StreakStrip";
import { EndReasonBars } from "./viz/EndReasonBars";
import { PairedBars } from "./viz/PairedBars";

const ANCHORS = [
  { id: "voies", label: "Voies" },
  { id: "matchups", label: "Matchups" },
  { id: "pv", label: "PV/tour" },
  { id: "distributions", label: "Distributions" },
  { id: "finishers", label: "Finishers" },
  { id: "tendance", label: "Tendance" },
  { id: "diagnostic", label: "Diagnostic" },
  { id: "expert", label: "Analyse experte" },
  { id: "cartes", label: "Cartes" },
  { id: "replay", label: "Replay" },
];

function avgTrajOpp(ms: MatchRecord[]): number[] {
  if (!ms.length) return [];
  const maxLen = Math.max(...ms.map((m) => m.hpTrajectoryOpp.length));
  const sum = new Array(maxLen).fill(0);
  const cnt = new Array(maxLen).fill(0);
  for (const m of ms) m.hpTrajectoryOpp.forEach((hp, t) => ((sum[t] += hp), cnt[t]++));
  return sum.map((s, t) => (cnt[t] ? s / cnt[t] : 0));
}

export function App() {
  const [now] = useState(() => Date.now());
  const [src, setSrc] = useState<DataSource | null>(null);
  const f = useFilters(now);

  useEffect(() => {
    loadMatches().then(setSrc);
  }, []);

  const records = src?.matches ?? [];
  const filtered = useMemo(() => applyFilters(records, f.filters), [records, f.filters]);

  const agg = useMemo(() => {
    const k = kpis(filtered);
    const vstats = voieAggs(filtered);
    const wrByVoie = {} as Record<Move, number>;
    for (const v of vstats) wrByVoie[v.voie] = v.winRate;
    const fin = finisherStats(filtered);
    const seg = segmentByOpp(filtered);
    const cpu = seg.find((s) => s.kind === "cpu")!;
    const human = seg.find((s) => s.kind === "human")!;
    return {
      k,
      vstats,
      wrByVoie,
      grid: matchupGrid(filtered),
      trajSelf: avgHpTrajectory(filtered),
      trajOpp: avgTrajOpp(filtered),
      gaussTurns: filtered.map((m) => m.turns),
      gaussHpWin: filtered.filter((m) => m.result === "win").map((m) => m.finalHpSelf),
      gaussMargin: filtered.map((m) => m.finalHpSelf - m.finalHpOpp),
      endReason: endReasonCounts(filtered),
      fin,
      cpu,
      human,
      timeline: timeSeries(filtered),
      streakData: streaks(filtered),
      avgMargin: mean(filtered.map((m) => m.finalHpSelf - m.finalHpOpp)),
      verdict: buildVerdict(filtered),
      diagnostics: buildDiagnostics(filtered),
      results: filtered.map((m) => m.result),
    };
  }, [filtered]);

  if (!src) {
    return (
      <div className="wt-app">
        <Header status="demo" />
        <div className="wt-empty">Chargement…</div>
      </div>
    );
  }

  const noData = records.length === 0;
  const noMatch = !noData && filtered.length === 0;

  return (
    <div className="wt-app">
      <Header status={src.status} />
      <FilterBar f={f} total={records.length} filtered={filtered.length} />

      {noData ? (
        <EmptyState kind="noData" onDemo={() => setSrc(demoSource())} />
      ) : noMatch ? (
        <EmptyState kind="filtered" onReset={f.reset} />
      ) : (
        <>
          <AnchorChips items={ANCHORS} />
          <VerdictStrip text={agg.verdict} />
          <KpiTiles k={agg.k} total={records.length} avgMargin={agg.avgMargin} />

          <Panel id="voies" title="WIN-RATE PAR VOIE" sub="ta performance perso">
            <WinRateBars stats={agg.vstats} />
          </Panel>

          <div className="wt-grid-2">
            <Panel id="radar" title="FORME DE JEU" sub="win-rate par Voie">
              <PowerRadar values={agg.wrByVoie} mode="winrate" />
            </Panel>
            <Panel id="matchups" title="MATCHUPS 5×5" sub="ligne = toi · colonne = adv.">
              <MatchupHeatmap grid={agg.grid} onCell={(att) => f.toggleVoie(att)} />
            </Panel>
          </div>

          <Panel id="pv" title="PV MOYENS PAR TOUR" sub="la forme de tes parties">
            <HpTrajectory self={agg.trajSelf} opp={agg.trajOpp} />
          </Panel>

          <Panel id="distributions" title="DISTRIBUTIONS — COURBES DE GAUSS" sub="μ moyenne · σ dispersion">
            <div className="wt-grid-2">
              <div>
                <div className="lab-panel-sub" style={{ marginBottom: 4 }}>Durée des parties (tours)</div>
                <GaussHisto samples={agg.gaussTurns} color="--neon-cyan" unit="t" />
              </div>
              <div>
                <div className="lab-panel-sub" style={{ marginBottom: 4 }}>PV restants quand tu gagnes</div>
                <GaussHisto samples={agg.gaussHpWin} color="--res-win" />
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <div className="lab-panel-sub" style={{ marginBottom: 4 }}>Marge PV (toi − adversaire)</div>
              <GaussHisto samples={agg.gaussMargin} color="--neon-violet" />
            </div>
          </Panel>

          <div className="wt-grid-2">
            <Panel id="finishers" title="FINISHERS" sub="moi vs adversaire">
              <PairedBars
                groups={MOVES.map((m) => ({ label: VOIE_META[m].name, a: agg.fin.byVoie[m].self, b: agg.fin.byVoie[m].opp, accent: `var(${VOIE_META[m].cssVar})` }))}
                aColor="var(--neon-cyan)"
                bColor="var(--res-loss)"
                aLabel="moi"
                bLabel="adv."
              />
            </Panel>
            <Panel title="FINS DE PARTIE" sub="comment ça se termine">
              <EndReasonBars counts={agg.endReason} />
            </Panel>
          </div>

          <Panel title="ADVERSAIRE — IA vs HUMAIN" sub="l'IA est-elle un bon sparring ?">
            <PairedBars
              groups={[
                { label: "Victoires", a: agg.cpu.winRate, b: agg.human.winRate },
                { label: "Finisher", a: agg.cpu.finisherRate, b: agg.human.finisherRate },
              ]}
              aColor="var(--neon-amber)"
              bColor="var(--neon-cyan)"
              aLabel={`IA (${agg.cpu.games})`}
              bLabel={`Humain (${agg.human.games})`}
            />
          </Panel>

          <Panel id="tendance" title="TENDANCE" sub="win-rate dans le temps">
            <WinRateTimeline points={agg.timeline} />
            <div style={{ marginTop: 12 }}>
              <StreakStrip results={agg.results} streaks={agg.streakData} />
            </div>
          </Panel>

          <Panel id="diagnostic" title="DIAGNOSTIC" sub="en clair">
            <DiagnosticList diagnostics={agg.diagnostics} />
          </Panel>

          <Panel id="expert" title="ANALYSE EXPERTE" sub="déroulé tour par tour (v:2)">
            <ExpertDiagnostics matches={filtered} />
          </Panel>

          <Panel id="cartes" title="CARTES" sub="ce que tu joues vraiment (créatures · sorts · fusions)">
            <CardStats matches={filtered} />
          </Panel>

          <Panel id="replay" title="REPLAY" sub="rejoue une partie, coup par coup">
            <ReplayJournal matches={filtered} />
          </Panel>

          <Panel title="JOURNAL" sub="parties brutes">
            <MatchJournal matches={filtered} />
          </Panel>
        </>
      )}

      <footer className="wt-footer">
        <span>
          {src.status === "live" ? "Source : D1 live" : src.status === "offline" ? "Source : cache local" : "Source : démo"}
          {src.syncedAt ? ` · ${new Date(src.syncedAt).toLocaleString("fr-FR")}` : ""}
        </span>
        <PwaInstall />
      </footer>
    </div>
  );
}
