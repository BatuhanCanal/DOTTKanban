# AGENTS.md

## Must-follow constraints

- **Never modify or fork Planka.** It runs as the stock `ghcr.io/plankanban/planka` image. Companion only consumes Planka's REST API, and `companion/server/planka.js` is the **only** file allowed to make Planka HTTP calls. Route/helper files must import it.
- **Companion's SQLite stores only what Planka has no field for**: templates, card *start* dates (`card_dates`), label groups. Never cache or copy Planka-owned data (boards, lists, cards, labels) into it — views always re-fetch from Planka.
- **Every API route must be registered with `requireAuth`** (`companion/server/auth.js`). It re-validates the cookie token against Planka `GET /api/users/me` (60 s cache). Cookie presence alone is not authentication — companion-only endpoints (templates, label groups) would otherwise be open to a forged cookie.
- **Before writing companion-local data keyed by a card or board, confirm via Planka that the user can see it** — see `findCardOnBoard` in `companion/server/routes/boards.js`. Without this check any logged-in user can write dates onto cards in boards they cannot access.
- Server is CommonJS (`'use strict'`, `require`), Node **>= 24** (built-in `node:sqlite`); client is ESM React. Do not introduce a server build step, TypeScript, or a native-compiled SQLite dependency — the production image runs `npm install --omit=dev` on Alpine.

## Validation before finishing

There are no tests, no linter and no CI. Validate by running:

- `./scripts/yerel-onizleme.sh` — builds the client, starts the fake Planka (`companion/dev/planka-mock.js`) and the server on :3001. Node only, no Docker. Login: `admin`/anything = Planka admin, any other username = regular member.
- Client-only change: `npm --prefix companion/client run build` must succeed.
- **If you add or change a Planka API call, mirror it in `companion/dev/planka-mock.js`** or the preview breaks.

## Repo-specific conventions

- User-facing strings (UI, API error messages) are **Turkish with full diacritics**. Code — filenames, identifiers, comments — is **ASCII only** (`sablon`, `zaman-cizelgesi.js`, `varsayilan-listeler.js`). Do not add diacritics to code, and do not strip them from user-facing text.
- Ordering uses Planka's position scheme: `planka.POSITION_GAP = 65536`; an insert takes the midpoint between neighbours. Never renumber existing positions.
- Board payload shaping lives in `companion/server/board-data.js`: `normalizeBoard` (UI) and `buildSnapshot` (ID-free template snapshot). Add view logic there, not in routes.
- Label/list colors must come from `companion/client/src/colors.js` (a mirror of Planka's palette) so companion renders identically to Planka.
- Styling is a single plain `companion/client/src/styles.css`. No CSS modules, no Tailwind, no component libraries.
- Admin gating: `isAdmin(user)` = `user.role === 'admin' || user.isAdmin === true`; the `requireAdmin` middleware lives in `routes/label-groups.js`.

## Change safety rules

- SQLite schema changes must be **additive and idempotent** at startup in `companion/server/db.js` (`CREATE TABLE IF NOT EXISTS`, plus `PRAGMA table_info` + `ALTER TABLE ... ADD COLUMN`). There is no migration tool and deployed installs hold live data.
- Templates deliberately omit due dates, start dates, completion flags, assignees, comments, attachments **and card descriptions**. Descriptions are a security constraint, not a preference: templates are readable by every logged-in user, so storing free text from a board the reader cannot access would leak it. Never add `description` back to `buildSnapshot`.
- `.env` is never committed; `scripts/yerel-kur.sh` must never overwrite an existing `.env`.
- Backups span **three** stores (`db-data`, `planka-data`, `companion-data`). Any new persistent store requires updating `scripts/yedek-al.sh`.
- Keep companion working when attached to a pre-existing Planka stack: it must run on the five env vars in `companion/server/config.js` alone, with no `.env` from this repo's `docker-compose.yml`.

## Known gotchas

- The "one label per label group" rule is enforced **only in the client drag code**; the server accepts multiple. Do not assume server-side enforcement.
- Sorting by due date disables drag-and-drop on purpose — drop indexes do not map to Planka positions in that order.
- Companion must be served from a domain root; the Vite build assumes `/`, so sub-path deployment (`ornek.org/kanban`) breaks.
- Behind a reverse proxy, `COMPANION_TRUST_PROXY` and `COMPANION_COOKIE_SECURE` must be set, otherwise the login rate limiter puts every user in the proxy's single bucket.
- `card_dates` rows orphaned by card deletion in Planka are expected and harmless — views always join against Planka's live card list.
