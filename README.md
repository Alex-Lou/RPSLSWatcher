# RPSLS Watcher

Tableau de bord **cyberpunk** de monitoring & analyse des vraies parties de
**Constellation Pro** (jeu RPSLS). Tu joues → la partie est enregistrée → ici tu
vois **tout** : win-rate, matchups, courbes de Gauss, tendances, trajectoires de
PV — filtrable, vulgarisé, installable comme app sur ton téléphone (PWA).

- **Front** : Vite + React + TS, PWA, charts canvas faits main (cyberpunk).
- **Backend** : Cloudflare **Pages Functions** (`functions/api/`) + **D1** (SQLite).
- **Déploiement** : Cloudflare **Pages**, branche de prod **`main`** (auto-deploy).

L'app marche **immédiatement** en mode **DÉMO** (dataset simulé) tant que la base
D1 est vide — pour voir le design avant de brancher quoi que ce soit.

---

## 🌿 Branche de production

**`main`** — pointe ton projet Cloudflare Pages dessus.

## 🚀 Mise en route Cloudflare (une fois)

> Pré-requis : `npm i -g wrangler` puis `wrangler login`.

1. **Créer la base D1**
   ```bash
   wrangler d1 create rpsls-watcher
   ```
   > ⚠️ **Ne mets PAS le `database_id` dans `wrangler.toml`** — Cloudflare le valide
   > au déploiement et un placeholder fait échouer la publication de la Function
   > (« Invalid database UUID »). Le binding D1 se fait dans le dashboard (étape 4).

2. **Appliquer le schéma**
   ```bash
   wrangler d1 execute rpsls-watcher --remote --file=./schema.sql
   ```

3. **Projet Pages** (dashboard Cloudflare → Workers & Pages → Create → Pages →
   Connect to Git → ce repo) :
   - Production branch : **`main`**
   - Build command : `pnpm build`
   - Build output directory : `dist`

4. **Binding D1** (Pages → Settings → Functions → D1 database bindings) :
   - Variable name : **`DB`** → database : **`rpsls-watcher`**

5. **Secret d'ingest** (Pages → Settings → Environment variables) :
   - **`INGEST_KEY`** = une longue chaîne secrète (sert au jeu pour POSTer).

6. **Déployer** : un `git push` sur `main` déclenche le build + déploiement.
   Les Pages Functions de `functions/` partent avec le site.

## 🔌 API

- `GET /api/matches?limit=2000&since=<ms>` → `{ ok, count, matches: MatchRecord[] }` (lecture ouverte, capée).
- `POST /api/matches` (header `X-Ingest-Key: <INGEST_KEY>`) → un `MatchRecord` ou un tableau (1..200). Idempotent sur `id`.

Schéma `MatchRecord` : voir [`src/data/types.ts`](src/data/types.ts).

## 🎮 Brancher le jeu (phase 2)

Côté Constellation Pro, à la fin de chaque partie Arena : construire un
`MatchRecord` et le `POST` à `https://<ton-domaine>/api/matches` avec l'en-tête
`X-Ingest-Key`. Fire-and-forget, fail-soft (ne jamais bloquer le jeu).
*(Cette partie touche le jeu et sera câblée + testée sur device séparément.)*

**Durcissement à prévoir au moment du câblage** (la clé d'ingest voyagera dans le
client de jeu → la traiter comme semi-publique) :
- Ajouter une **Cloudflare Rate Limiting rule** sur `POST /api/matches` (par IP).
- Idéalement **dériver `id` côté serveur** (hash des champs de la partie) au lieu
  de faire confiance au `id` client → les rejeux d'une même partie fusionnent.
- Optionnel : job de **rétention** (purge des parties > N jours) pour borner la table.

## 🧪 Dev local

```bash
pnpm install
pnpm dev                 # front seul (DÉMO, pas de Functions)
# Functions + D1 en local :
wrangler pages dev -- pnpm dev      # ou: pnpm build && wrangler pages dev dist
```

### Aperçu sur ton téléphone (dev)

Le site de prod est déjà public (Pages). Pour tester la version **locale** sur
ton tél avant un déploiement, expose le serveur dev :

```bash
cloudflared tunnel --url http://localhost:5173     # tunnel Cloudflare
# ou
ngrok http 5173                                     # cf. ngrok.yml
```

Puis ouvre l'URL https sur le téléphone → menu navigateur → « Ajouter à l'écran
d'accueil » (PWA).
