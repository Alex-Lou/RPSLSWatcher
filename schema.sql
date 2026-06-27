-- RPSLSWatcher — schéma D1 (Cloudflare). Une partie = une ligne. Les
-- trajectoires de PV sont stockées en JSON (tableaux courts). Idempotent sur id.
CREATE TABLE IF NOT EXISTS matches (
  id                 TEXT PRIMARY KEY,
  ts                 INTEGER NOT NULL,         -- epoch ms (quand jouée)
  mode               TEXT NOT NULL,            -- pro | ranked
  player_voie        TEXT NOT NULL,            -- rock|paper|scissors|lizard|spock
  opp_voie           TEXT,                     -- nullable
  opp_kind           TEXT NOT NULL,            -- cpu | human
  result             TEXT NOT NULL,            -- win | loss | draw
  turns              INTEGER NOT NULL,
  final_hp_self      INTEGER NOT NULL,
  final_hp_opp       INTEGER NOT NULL,
  finisher_fired     INTEGER NOT NULL,         -- 0/1
  opp_finisher_fired INTEGER NOT NULL,         -- 0/1
  hp_self            TEXT NOT NULL,            -- JSON array of int
  hp_opp             TEXT NOT NULL,            -- JSON array of int
  end_reason         TEXT NOT NULL,            -- ko | hardcap | suddendeath
  app_version        TEXT,
  created_at         INTEGER NOT NULL          -- epoch ms (quand ingéré)
);

CREATE INDEX IF NOT EXISTS idx_matches_ts ON matches(ts);
CREATE INDEX IF NOT EXISTS idx_matches_voie ON matches(player_voie);
