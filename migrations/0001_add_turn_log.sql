-- Migration v:2 — ajoute la colonne turn_log (déroulé tour par tour, JSON nullable).
-- Rétro-compatible : les lignes v:1 existantes restent valides (turn_log = NULL).
-- À jouer UNE fois sur la base distante :
--   npx wrangler@3 d1 execute rpsls-watcher --remote --file=migrations/0001_add_turn_log.sql
ALTER TABLE matches ADD COLUMN turn_log TEXT;
