/**
 * verdict — traduit les agrégats en LANGAGE SIMPLE : une phrase-verdict + une
 * liste de diagnostics colorés. Règles à seuils, gardées par la taille
 * d'échantillon (Wald) pour ne pas crier sur du bruit.
 */
import {
  endReasonCounts,
  finisherStats,
  kpis,
  matchupGrid,
  mean,
  segmentByOpp,
  voieAggs,
} from "./analysis";
import { affinityLeverage, deadTurnStats, withTurnLog } from "./diagnostics";
import { VOIE_META, type MatchRecord } from "./types";

export type Severity = "high" | "warn" | "ok";
export interface Diagnostic {
  severity: Severity;
  text: string;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Une phrase qui résume l'état (ce que tu dois retenir en 1 coup d'œil). */
export function buildVerdict(matches: MatchRecord[]): string {
  const n = matches.length;
  if (n === 0) return "Aucune partie sur ce filtre — élargis la sélection ou lance une démo.";
  const k = kpis(matches);
  const best = k.bestVoie ? VOIE_META[k.bestVoie].name : null;
  const worst = k.worstVoie ? VOIE_META[k.worstVoie].name : null;
  const wr = pct(k.winRate);
  const streak = k.currentStreak;
  const streakTxt =
    streak && streak.length >= 3
      ? streak.kind === "win"
        ? ` Série de ${streak.length} victoires en cours 🔥.`
        : streak.kind === "loss"
          ? ` Série de ${streak.length} défaites — souffle un coup.`
          : ""
      : "";
  const voieTxt = best && worst && best !== worst ? ` Ta ${best} porte, ta ${worst} cale.` : best ? ` Ta ${best} sort du lot.` : "";
  return `${wr} de victoires sur ${n} parties.${voieTxt}${streakTxt}`;
}

/** Les alertes/forces, en clair. n_v/n gates pour éviter le bruit. */
export function buildDiagnostics(matches: MatchRecord[]): Diagnostic[] {
  const out: Diagnostic[] = [];
  const n = matches.length;
  if (n === 0) return out;

  if (n < 30) {
    out.push({ severity: "warn", text: `Seulement ${n} parties sur ce filtre — les chiffres sont indicatifs (joue plus pour fiabiliser).` });
  }

  // Voies sur/sous-performantes (n_v ≥ 20)
  for (const a of voieAggs(matches)) {
    if (a.games < 20) continue;
    const name = VOIE_META[a.voie].name;
    if (a.winRate > 0.58) out.push({ severity: "ok", text: `${name} sur-performe à ${pct(a.winRate)} (${a.games} parties) — c'est ta valeur sûre.` });
    else if (a.winRate < 0.42) out.push({ severity: "warn", text: `${name} sous-performe à ${pct(a.winRate)} (${a.games} parties) — à retravailler ou à éviter.` });
    if (a.finisherRate < 0.15) out.push({ severity: "warn", text: `Ton finisher ${name} ne part que ${pct(a.finisherRate)} du temps — son engine monte trop peu.` });
  }

  // Matchups cassés (n ≥ 15)
  for (const row of matchupGrid(matches)) {
    for (const c of row) {
      if (c.att === c.def || c.games < 15 || Number.isNaN(c.winRate)) continue;
      if (Math.abs(c.winRate - 0.5) > 0.25) {
        const a = VOIE_META[c.att].name;
        const d = VOIE_META[c.def].name;
        const sev: Severity = c.winRate < 0.5 ? "high" : "ok";
        out.push({ severity: sev, text: `${a} vs ${d} : ${pct(c.winRate)} sur ${c.games} parties — matchup ${c.winRate < 0.5 ? "très défavorable" : "très favorable"}.` });
      }
    }
  }

  // Fins de partie : trop de hardcaps
  const er = endReasonCounts(matches);
  if (n >= 20 && er.hardcap / n > 0.25) {
    out.push({ severity: "warn", text: `${pct(er.hardcap / n)} des parties vont au tour-limite (hardcap) — ça manque de finition.` });
  }

  // Domination sans suspense
  const margin = mean(matches.map((m) => m.finalHpSelf - m.finalHpOpp));
  if (n >= 20 && margin > 8) {
    out.push({ severity: "warn", text: `Marge moyenne de ${margin.toFixed(0)} PV — tu écrases (peu de parties serrées).` });
  }

  // CPU trop facile vs humain
  const seg = segmentByOpp(matches);
  const cpu = seg.find((s) => s.kind === "cpu");
  const human = seg.find((s) => s.kind === "human");
  if (cpu && human && cpu.games >= 15 && human.games >= 15 && cpu.winRate - human.winRate > 0.2) {
    out.push({ severity: "warn", text: `Tu gagnes ${pct(cpu.winRate)} vs l'IA mais ${pct(human.winRate)} vs humain — l'IA est un sparring trop tendre.` });
  }

  // Finisher décisif ?
  const fin = finisherStats(matches);
  if (n >= 30 && fin.lift > 0.2) {
    out.push({ severity: "ok", text: `Tes parties avec finisher sont gagnées ${pct(fin.lift)} plus souvent — mais le finisher = engine maxé = souvent des parties déjà longues/contrôlées (corrélation, pas forcément la cause).` });
  }

  // Turn-level (parties v:2 avec déroulé détaillé)
  if (withTurnLog(matches).length >= 20) {
    const dead = deadTurnStats(matches);
    if (dead.rate > 0.3) {
      const peak = dead.byTurn.reduce((b, v, i) => (v > dead.byTurn[b] ? i : b), 0);
      out.push({ severity: "warn", text: `${pct(dead.rate)} de tes tours sont creux (rien ne bouge) — le rythme casse, surtout vers le tour ${peak + 1}.` });
    }
    const aff = affinityLeverage(matches);
    if (aff.leverage !== null && aff.leverage > 0.1) {
      out.push({ severity: "ok", text: `Jouer dans ta Voie paye : +${pct(aff.leverage)} de victoires quand tu restes en affinité.` });
    } else if (aff.leverage !== null && aff.leverage < -0.1) {
      out.push({ severity: "high", text: `Rester dans ta Voie te dessert (${pct(aff.leverage)}) — l'affinité ne tient pas ses promesses sur ce filtre.` });
    }
  }

  if (out.length === 0) out.push({ severity: "ok", text: "Rien d'alarmant : profil équilibré sur ce filtre." });
  return out;
}
