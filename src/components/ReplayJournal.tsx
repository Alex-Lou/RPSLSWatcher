/**
 * ReplayJournal — rejoue UNE partie coup par coup, en langage simple (lisible
 * tech ET non-tech). Lit le turnLog (v:2) ; si une partie n'en a pas, elle
 * n'apparaît pas dans le sélecteur. Scrub via slider + boutons.
 */
import { useMemo, useState } from "react";
import {
  BEAT_VERB,
  MOVE_LABEL,
  VOIE_META,
  type ArenaTurnEvent,
  type LaneOutcome,
  type MatchRecord,
  type Move,
  type TurnPlay,
} from "../data/types";

const RES_LABEL: Record<string, string> = { win: "Victoire", loss: "Défaite", draw: "Nul" };

function verb(w: Move, l: Move): string {
  return BEAT_VERB[w]?.[l] ?? "bat";
}

function playsText(plays: TurnPlay[]): string {
  if (!plays.length) return "rien";
  const spells = plays.filter((p) => p.kind === "spell").length;
  const summons = plays
    .filter((p) => p.kind === "summon")
    .map((p) => `${p.move ? MOVE_LABEL[p.move] : "?"}${p.lane != null ? ` (lane ${p.lane + 1})` : ""}${p.affinity ? " ⚡" : ""}`);
  const parts = [...summons];
  if (spells === 1) parts.push("un sort");
  else if (spells > 1) parts.push(`${spells} sorts`);
  return parts.length ? parts.join(", ") : "rien";
}

type Tone = "win" | "loss" | "mute";

function laneLine(l: LaneOutcome): { text: string; tone: Tone } | null {
  const me = l.selfMove ? MOVE_LABEL[l.selfMove] : null;
  const opp = l.oppMove ? MOVE_LABEL[l.oppMove] : null;
  switch (l.result) {
    case "counterWinSelf":
      return { tone: "win", text: `Lane ${l.lane + 1} : ta ${me} ${verb(l.selfMove!, l.oppMove!)} ses ${opp} → KO sec${l.splashToOpp ? ` (+${l.splashToOpp} sur son héros)` : ""}` };
    case "counterWinOpp":
      return { tone: "loss", text: `Lane ${l.lane + 1} : ses ${opp} ${verb(l.oppMove!, l.selfMove!)} ta ${me}${l.saved ? " — sauvegardée" : " → perdue"}${l.splashToSelf ? ` (−${l.splashToSelf} sur toi)` : ""}` };
    case "mirror":
      return { tone: "mute", text: `Lane ${l.lane + 1} : ${me} vs ${opp} → même symbole, échange de coups` };
    case "emptySelf":
      return { tone: "win", text: `Lane ${l.lane + 1} : ta ${me} frappe son héros (−${l.directToOpp})` };
    case "emptyOpp":
      return { tone: "loss", text: `Lane ${l.lane + 1} : sa ${opp} frappe ton héros (−${l.directToSelf})` };
    default:
      return null;
  }
}

function Delta({ d }: { d: number }) {
  if (d === 0) return <span className="wt-replay-delta zero">±0</span>;
  const up = d > 0;
  return <span className={`wt-replay-delta ${up ? "up" : "down"}`}>{up ? "▲" : "▼"}{Math.abs(d)}</span>;
}

export function ReplayJournal({ matches }: { matches: MatchRecord[] }) {
  const logged = useMemo(
    () =>
      matches
        .filter((m): m is MatchRecord & { turnLog: ArenaTurnEvent[] } => Array.isArray(m.turnLog) && m.turnLog.length > 0)
        .sort((a, b) => b.ts - a.ts)
        .slice(0, 40),
    [matches],
  );
  const [selId, setSelId] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  if (!logged.length) {
    return (
      <div className="wt-empty" style={{ textAlign: "left", padding: "10px 2px" }}>
        Aucune partie détaillée pour l'instant. Joue une partie Arena Pro avec le build à jour : son déroulé
        tour par tour apparaîtra ici, rejouable en clair.
      </div>
    );
  }

  const match = logged.find((m) => m.id === selId) ?? logged[0];
  const log = match.turnLog;
  const idx = Math.min(step, log.length - 1);
  const ev = log[idx];
  const waste = Math.max(0, ev.manaMax - ev.manaSpent);
  const lanes = (ev.lanes ?? []).map(laneLine).filter(Boolean) as { text: string; tone: Tone }[];
  const voieName = VOIE_META[match.playerVoie].name;

  const select = (id: string) => {
    setSelId(id);
    setStep(0);
  };

  return (
    <div className="wt-replay">
      <div className="wt-replay-picker">
        {logged.map((m) => (
          <button key={m.id} className={`wt-replay-pick${m.id === match.id ? " on" : ""}`} onClick={() => select(m.id)}>
            <span>{new Date(m.ts).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}</span>
            <span style={{ color: `var(${VOIE_META[m.playerVoie].cssVar})` }}>{VOIE_META[m.playerVoie].glyph}</span>
            <span className={`res ${m.result}`}>{m.result === "win" ? "V" : m.result === "loss" ? "D" : "N"}</span>
          </button>
        ))}
      </div>

      <div className="wt-replay-headline">
        <span style={{ color: `var(${VOIE_META[match.playerVoie].cssVar})` }}>
          {VOIE_META[match.playerVoie].glyph} {voieName}
        </span>
        <span className="vs">vs</span>
        <span style={{ color: match.oppVoie ? `var(${VOIE_META[match.oppVoie].cssVar})` : undefined }}>
          {match.oppVoie ? `${VOIE_META[match.oppVoie].glyph} ${VOIE_META[match.oppVoie].name}` : "?"}
        </span>
        <span className={`res ${match.result}`}>{RES_LABEL[match.result]}</span>
        <span className="meta">
          {match.turns} tours · {match.oppKind === "cpu" ? "IA" : "Humain"}
        </span>
      </div>

      <div className="wt-replay-stage">
        <div className="wt-replay-turnno">TOUR {ev.turn}</div>
        <div className="wt-replay-hp">
          <span>
            PV toi <b>{ev.hpSelf}</b> <Delta d={ev.dHpSelf} />
          </span>
          <span>
            adv <b>{ev.hpOpp}</b> <Delta d={ev.dHpOpp} />
          </span>
        </div>

        {ev.deadTurn && <div className="wt-replay-line mute">Tour creux — rien de décisif ne s'est passé.</div>}

        <div className="wt-replay-line">
          <em>Tu poses :</em> {playsText(ev.plays)}
        </div>
        <div className="wt-replay-line mute">
          <em>Adv. :</em> {playsText(ev.playsOpp)}
        </div>

        {lanes.map((l, i) => (
          <div key={i} className={`wt-replay-line ${l.tone}`}>
            {l.text}
          </div>
        ))}

        <div className="wt-replay-line eng">
          Énergie {voieName} : <b>{ev.engine}</b>
          {ev.engineRose && <span className="rise"> ⚡ +1</span>}
          <span className="mute"> · mana {ev.manaSpent}/{ev.manaMax}{waste ? ` (${waste} gaspillé)` : ""}</span>
        </div>
        {ev.finisherUnlocked && <div className="wt-replay-line fin">★ FINISHER DÉBLOQUÉ</div>}
      </div>

      <div className="wt-replay-nav">
        <button disabled={idx === 0} onClick={() => setStep(idx - 1)}>
          ◀
        </button>
        <input
          type="range"
          min={0}
          max={log.length - 1}
          value={idx}
          onChange={(e) => setStep(Number(e.target.value))}
        />
        <button disabled={idx === log.length - 1} onClick={() => setStep(idx + 1)}>
          ▶
        </button>
        <span className="wt-replay-count">
          {idx + 1}/{log.length}
        </span>
      </div>

      <div className="lab-legend">
        <span>⚡ = joué dans ta Voie</span>
        <span>KO sec = contre RPSLS (tue quel que soit le PV)</span>
      </div>
    </div>
  );
}
