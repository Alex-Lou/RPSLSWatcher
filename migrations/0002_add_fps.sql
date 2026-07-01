-- 0002 — profil FPS par partie (JSON FpsSummary), nullable. Idempotent-safe :
-- à n'appliquer qu'une fois (D1 n'a pas ADD COLUMN IF NOT EXISTS).
--   wrangler d1 execute rpsls-watcher --remote --file=./migrations/0002_add_fps.sql
ALTER TABLE matches ADD COLUMN fps TEXT;
