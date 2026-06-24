# Technical Project Context

Snapshot reviewed: 2026-06-24, repository HEAD `f56b67c`.

## Scope and evidence rules

This document describes the repository as checked in. It does not claim access to the deployed Supabase catalog or production rows.

- **Source-confirmed** means directly visible in tracked source, `package.json`, or `package-lock.json`.
- **Inferred** means strongly suggested by Supabase calls and TypeScript shapes, but not provable without SQL DDL or catalog inspection.
- **Not visible** means no supporting migration, schema dump, policy definition, generated database type, function, trigger, view, or index definition is checked in.
- Environment variable values were not read or recorded. Names only are listed.

## 1. Project overview

### Exact stack

| Area | Package / approach | Declared version | Installed lockfile version |
|---|---|---:|---:|
| Web framework | Next.js App Router | `16.2.9` | `16.2.9` |
| UI runtime | React | `19.2.4` | `19.2.4` |
| DOM renderer | React DOM | `19.2.4` | `19.2.4` |
| Database/auth client | `@supabase/supabase-js` | `^2.108.2` | `2.108.2` |
| Supabase SSR helpers | `@supabase/ssr` | `^0.12.0` | `0.12.0` |
| Styling | Tailwind CSS 4 through PostCSS | `^4` | `4.3.1` |
| Tailwind PostCSS adapter | `@tailwindcss/postcss` | `^4` | `4.3.1` |
| Language | TypeScript | `^5` | `5.9.3` |
| Linting | ESLint + `eslint-config-next` | `^9` / `16.2.9` | `9.39.4` / `16.2.9` |
| External AI integration | Gemini REST API with Google Search grounding | no SDK package | model string `gemini-2.5-flash` |

The application uses the App Router. Pages are server components unless marked `"use client"`; the main league dashboard and admin screen are large client components. API endpoints are Next.js Route Handlers. Next.js 16 dynamic route params are correctly treated as promises in server pages and handlers, while the client admin page uses `useParams()`.

Environment variable names referenced by source:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`

### Package scripts

| Script | Command | Purpose |
|---|---|---|
| `npm run dev` | `next dev` | Local development server |
| `npm run build` | `next build` | Production compilation and framework/type checks |
| `npm run start` | `next start` | Serve a production build |
| `npm run lint` | `eslint` | Lint the repository |

There is no checked-in test script, migration script, Supabase CLI script, seed script, or generated type script.

### Relevant structure

```text
app/
  api/
    leagues/
      route.ts                         # create league + owner player
      [code]/
        route.ts                       # league lock/admin-edit state
        players/route.ts               # membership lookup/join
        matches/route.ts               # create one match
        matches/import/route.ts        # bulk match import
        matches/[matchId]/route.ts     # edit score/details, delete
        predictions/route.ts           # save/upsert a prediction
        predictions/import/route.ts    # owner bulk prediction import
        ai-matches/route.ts            # Gemini fixture discovery
        ai-results/route.ts            # Gemini final-score discovery
    my-leagues/route.ts                # current user's memberships
  league/[code]/
    page.tsx                           # server-side league data load
    admin/page.tsx                     # complete admin UI/workflows
  create-league/page.tsx
  join-league/page.tsx
  account/page.tsx
  auth/callback/route.ts
components/
  LeagueClient.tsx                     # dashboard, predictions, rankings
  auth/*
lib/
  supabase.ts                          # plain anon client
  supabaseBrowser.ts                   # browser SSR client
  supabaseServer.ts                    # cookie-aware server client
  supabaseAdmin.ts                     # server-only service-role client
```

No `supabase/`, `migrations/`, `schema.sql`, SQL file, or generated `Database` type file exists in the tracked tree.

## 2. Database / Supabase

### Client boundaries

- `lib/supabase.ts` creates a plain anonymous Supabase client. `app/league/[code]/page.tsx` uses it to load league, players, matches, and predictions.
- `lib/supabaseBrowser.ts` creates a browser client using public environment variable names. The admin page uses it for authenticated identity and direct reads.
- `lib/supabaseServer.ts` creates a cookie-aware server client and is used by Route Handlers to establish the current authenticated user.
- `lib/supabaseAdmin.ts` creates a service-role client. Every mutation Route Handler shown below authorizes the caller in application code and then performs reads/writes with this client. The service role bypasses RLS, so these authorization checks are security-critical.

### Existing migrations

**None are checked in.** Consequently, there is no repository-verifiable migration history to summarize and no reliable way to print the original DDL. Production migrations may exist in the hosted Supabase project, but they are outside this repository snapshot.

### Source-observed data model

The types below are evidence-based approximations. Exact PostgreSQL types, nullability, defaults, primary/foreign keys, delete actions, checks, and indexes are marked unknown unless source behavior makes them explicit.

#### `leagues`

| Column | Observed TypeScript shape / likely PostgreSQL type | Evidence and behavior |
|---|---|---|
| `id` | `string`; likely `uuid` | Selected and used as `league_id`; primary key is inferred, not visible. |
| `name` | `string`; likely `text` | Inserted during league creation. |
| `code` | `string`; likely `text` | Five-character generated lookup code. Application checks for collisions; a database unique constraint/index is not visible. |
| `admin_name` | likely `text` | Inserted during creation; not present in local component interfaces. |
| `admin_code` | `string | null`; likely nullable `text` | Four-digit legacy admin code used from local storage by the admin UI. |
| `owner_id` | `string | null`; likely nullable `uuid` | Compared to Supabase Auth `user.id`; a foreign key to `auth.users(id)` is plausible but not visible. |
| `predictions_locked` | `boolean` | Global league lock. Default is not visible; UI normalizes it with `Boolean(...)`. |
| `admin_edit_mode` | `boolean` | Allows owner override only while the league is locked. Default is not visible. |
| `created_at` | likely timestamp string | Selected in `my-leagues` relation and used for ordering; exact type/default are not visible. |

Observed application constraints:

- `code` is normalized to uppercase for lookups.
- Only `owner_id === authenticated user.id` may mutate league state through the service-role Route Handler.
- `admin_edit_mode=true` is rejected unless `predictions_locked=true`.
- Unlocking predictions forces `admin_edit_mode=false`.

#### `players`

| Column | Observed TypeScript shape / likely PostgreSQL type | Evidence and behavior |
|---|---|---|
| `id` | `string`; likely `uuid` | Used as prediction `player_id`; primary key inferred. |
| `league_id` | `string`; likely `uuid` | Used in all membership filters; FK to `leagues.id` inferred. |
| `name` | `string`; likely `text` | User-selected display name. |
| `user_id` | `string | null`; likely nullable `uuid` | Compared with Auth user ID. FK to `auth.users.id` inferred. |
| `created_at` | likely timestamp string | Players are ordered by it; exact type/default unknown. |

The join API first queries by `(league_id, user_id)` and avoids a duplicate in application code. A matching unique database constraint is recommended but not visible. There is no repository-defined `profiles` table. User identity is Supabase Auth plus the per-league `players` row.

#### `matches`

| Column | Observed TypeScript shape / likely PostgreSQL type | Evidence and behavior |
|---|---|---|
| `id` | `string`; likely `uuid` | Match identifier; primary key inferred. |
| `league_id` | `string`; likely `uuid` | Required on every insertion; FK to `leagues.id` inferred. |
| `home_team` | `string`; likely `text` | Trimmed and required by API validation. |
| `away_team` | `string`; likely `text` | Trimmed and required by API validation. |
| `start_time` | ISO `string`; likely `timestamptz` | Parsed as JavaScript `Date`, stored as ISO UTC. |
| `status` | `string`; likely `text` | Source writes only `upcoming` and `finished`. No database check is visible. |
| `home_score` | `number | null`; likely nullable integer | Both scores are set together; non-negative integer enforced in APIs. |
| `away_score` | `number | null`; likely nullable integer | Same behavior as `home_score`. |

No persisted `live` state exists. A match becomes `finished` when both scores are written. Imports with a score also create it as `finished`; otherwise it is `upcoming`. Started matches without scores retain `upcoming` in storage and are treated as “started/live or awaiting result” by time comparisons in the UI.

Bulk-import duplicate detection is application-only and keys on normalized teams plus date/time. The browser pre-filter uses ISO time to the minute; the server match-import route uses the **Israel calendar date** plus teams, so two same-team fixtures on the same local date would collide on the server even if kickoff times differ. No database unique constraint/index is visible.

#### `predictions`

| Column | Observed TypeScript shape / likely PostgreSQL type | Evidence and behavior |
|---|---|---|
| `id` | `string`; likely `uuid` | Selected after insert/upsert; primary key inferred. |
| `match_id` | `string`; likely `uuid` | FK to `matches.id` inferred. |
| `player_id` | `string`; likely `uuid` | FK to `players.id` inferred. |
| `pick` | `string`; likely `text` | Application permits only `1`, `X`, or `2`; DB check not visible. |
| `updated_at` | ISO `string`; likely `timestamptz` | Explicitly set on normal upsert; bulk import does not set it. Default/trigger unknown. |

Normal saves use `upsert(..., { onConflict: "match_id,player_id" })`. Successful operation requires a matching unique/exclusion constraint in the deployed database, so a unique `(match_id, player_id)` constraint is operationally expected, but its DDL and index definition are not checked in. The UI warns that deleting a match deletes predictions, suggesting `ON DELETE CASCADE`, but the actual FK/delete action is not visible.

There is no `standings`, `ranking`, `points`, `profiles`, or application-owned `users` table referenced by source.

### RLS policies

No policy SQL is checked in, so exact RLS enablement and policy predicates are **not visible**.

Behavior implies that the anonymous/public client can select at least some rows from `leagues`, `players`, `matches`, and `predictions`, because the league server page uses an anon client without the request's auth cookies. The admin browser client also directly selects leagues, players, and matches. All server mutations use the service-role client after explicit user/owner checks and therefore do not depend on RLS for enforcement.

Important audit point: `app/league/[code]/page.tsx` loads `predictions` with `.select("*")` and no league or match filter. Any RLS policy permitting broad prediction reads could expose or transfer every readable prediction to every league page. Stage V1 should replace this with a query scoped to the selected stage's match IDs regardless of RLS.

### SQL functions, triggers, RPCs, and views

None are referenced or defined. There are no `.rpc(...)` calls. No SQL-based standings calculation exists. A default timestamp trigger or cascade may exist remotely, but it cannot be established from this repository.

### Existing TypeScript database types

There is no generated Supabase `Database` interface and none of the clients are parameterized as `createClient<Database>()`. Data types are local handwritten interfaces in:

- `components/LeagueClient.tsx`: `Player`, `Match`, `League`, `Prediction`.
- `app/league/[code]/admin/page.tsx`: `League`, `Player`, `Match`, import/preview/AI response types.
- Individual API routes: request-body and projected-row types.

This means schema drift is discovered late and many query results effectively rely on inferred Supabase client types.

## 3. Match flow

### Loading

Public league load occurs in `app/league/[code]/page.tsx`:

1. Normalize route code to uppercase.
2. Select one `leagues` row by code.
3. Select all `players` for the league, ordered by `created_at`.
4. Select all `matches` for the league, ordered by `start_time`.
5. Select all readable `predictions` without a league filter.
6. Pass everything into `LeagueClient`.

Admin load occurs in `loadLeagueAndMatches` in `app/league/[code]/admin/page.tsx` through the browser Supabase client. It loads the league, checks owner or legacy local-storage admin code, then directly loads league players and matches.

### Admin creation and import

- Single creation: admin form `handleSubmit` calls `POST /api/leagues/[code]/matches`. The handler authenticates, verifies league ownership, validates teams/time, and inserts an `upcoming` match.
- Manual bulk import: `parseMatchesImportText` accepts `date | home | away` or an optional `| home-away score`. `importMatchesFromText` performs a browser duplicate preview and calls `POST /matches/import`; the server revalidates, limits to 150, deduplicates, and inserts upcoming or finished rows.
- AI-assisted import: `checkMatchesWithAi` calls `POST /ai-matches` with free-text tournament and stage. Gemini returns a validated fixture list. The UI converts it to the same manual text format and requires the admin to inspect and invoke the normal import. The AI `stage` is currently prompt text only and is not stored.

### Result updates

- Manual per-match result: `updateScore` calls `PATCH /matches/[matchId]`; setting both scores forces `status="finished"`.
- Pasted result batch: `previewResultsImport` parses and matches rows by normalized teams plus kickoff minute. Existing scores are marked and not overwritten. `importCheckedResults` PATCHes each ready match with `only_if_no_score=true`; the handler adds `IS NULL` guards to both score columns to close the preview/commit race.
- AI results: `POST /ai-results` selects up to 30 league matches whose kickoff has passed and both scores are null, asks Gemini for confirmed final scores, validates returned IDs/scores, and returns a preview only. The admin then uses the same guarded pasted-result update path.
- Match details and deletion: `PATCH /matches/[matchId]` edits teams/time; `DELETE` deletes a league-owned match. Whether predictions cascade is not verifiable from checked-in DDL.

### State model

| Effective state | Persisted/derived condition |
|---|---|
| Upcoming | Usually `status !== "finished"`, no complete score, and `start_time > now`. |
| Started/live/awaiting result | Derived: `start_time <= now`, no complete score, and status not finished. There is no explicit live status or live-score feed. |
| Finished | `status === "finished"` and both scores non-null; only this combination produces a 1/X/2 result. |

Some UI lists primarily use timestamps, while finished-state logic uses `getMatchResult`. Inconsistent data such as `status="finished"` with a null score is treated as unfinished for scoring but may render with finished labels elsewhere. Database checks should eventually prevent that state.

## 4. Prediction flow

### Submission and storage

`LeagueClient.savePrediction(matchId, pick)` calls `POST /api/leagues/[code]/predictions` with the selected player. The handler:

1. Authenticates the user.
2. Loads league ownership, global lock, and admin-edit state.
3. Allows an owner override only when the league is locked and admin-edit mode is enabled.
4. Confirms the player belongs to the league.
5. For normal users, confirms `player.user_id === user.id`.
6. Confirms the match belongs to the league.
7. For normal users, rejects `start_time <= now`.
8. Upserts `(match_id, player_id, pick, updated_at)` on `match_id,player_id`.

The client immediately merges the returned row into local state.

### Locking/edit blocking

There are two layers:

- Frontend disables picks when the whole league is locked or when the match time has arrived.
- The Route Handler independently enforces the global league lock, player ownership, and match start time.

The owner can activate admin-edit mode only while predictions are globally locked; this bypasses both player ownership and kickoff-time checks. Bulk owner prediction import is separate: it verifies owner and player/league membership, matches input to league fixtures, skips existing rows, and inserts new predictions. It currently does **not** check the league lock or match kickoff despite the admin UI displaying a `skippedLocked` count that the endpoint never returns.

### Correctness and points

`getMatchResult` returns home (`1`), draw (`X`), or away (`2`) only for finished matches with both scores. A prediction is:

- correct when `prediction.pick === getMatchResult(match)`;
- wrong when a result exists and the pick differs;
- pending when no result exists;
- missing when no prediction exists for a finished match.

Each correct prediction is exactly one point. There is no scoreline prediction, bonus, penalty, tie-break, SQL calculation, or persisted points value.

## 5. Standings flow

All standings logic lives in `components/LeagueClient.tsx`.

- `finishedMatches` filters the supplied matches through `getMatchResult`.
- `getPlayerStatsForMatches(playerId, matchesForStats)` loops matches, finds the player's prediction, counts guessed matches, and adds one point for an exact 1/X/2 result.
- `getPlayerStats` applies that function to all finished matches.
- `rankedPlayers` sorts all players by points descending.
- `rankedRows` assigns rank as array index + 1.
- Rank movement removes only the latest finished match, recomputes prior ordering, and compares array positions.

There is no secondary sort, stable explicit tie-break, or shared rank for equal points. JavaScript's stable sort preserves the original player ordering for ties, which originates from `players.created_at ASC`; tied players nevertheless receive different sequential ranks.

Standings currently include **all finished matches supplied for the league**, with no stage, date, tournament, or status subset beyond finished/result validity. Because the server page passes all league matches, points are lifetime league totals.

No SQL query aggregates points; no RPC, server action, standings API, utility module, materialized view, or standings table exists.

## 6. Admin flow

### Files, responsibilities, and important functions

| Path | Responsibility | Important functions |
|---|---|---|
| `app/league/[code]/admin/page.tsx` | Monolithic client admin UI: authorization gate, load, create/import/edit/delete matches, result preview/update, AI helpers, prediction import, global locks. | `loadLeagueAndMatches`, `handleSubmit`, `parseMatchesImportText`, `importMatchesFromText`, `previewResultsImport`, `checkMatchesWithAi`, `checkResultsWithAi`, `importCheckedResults`, `importPredictionsFromText`, `toggleLeaguePredictionsLock`, `toggleAdminEditMode`, `updateScore`, `updateMatchDetails`, `deleteMatch`, `MatchAdminCard`. |
| `app/api/leagues/route.ts` | Creates a league and its owner player after authentication. | `createUniqueLeagueCode`, `POST`. |
| `app/api/leagues/[code]/route.ts` | Owner-only global prediction-lock and admin-edit state. | `PATCH`. |
| `app/api/leagues/[code]/players/route.ts` | Authenticated membership lookup and join/create player. | `GET`, `POST`. |
| `app/api/leagues/[code]/matches/route.ts` | Owner-only single match creation. | `POST`. |
| `app/api/leagues/[code]/matches/import/route.ts` | Owner-only bulk match validation, duplicate handling, insert. | `verifyLeagueOwner`, `normalizeTeamName`, `getIsraelDate`, `getMatchKey`, `POST`. |
| `app/api/leagues/[code]/matches/[matchId]/route.ts` | Owner-only match edit/result update/delete; supports guarded no-overwrite result import. | `verifyLeagueOwner`, `PATCH`, `DELETE`. |
| `app/api/leagues/[code]/ai-matches/route.ts` | Owner-only Gemini fixture discovery; returns data without writing. | `extractJsonArray`, `normalizeTeamName`, `isValidAiMatchItem`, `POST`. |
| `app/api/leagues/[code]/ai-results/route.ts` | Owner-only Gemini final-result discovery for past scoreless matches; returns preview without writing. | `extractJsonArray`, `isValidAiResultItem`, `POST`. |
| `app/api/leagues/[code]/predictions/import/route.ts` | Owner-only bulk insert for a selected player; matches text rows to fixtures and skips existing predictions. | `verifyLeagueOwner`, `makeMatchKey`, `POST`. |
| `components/LeagueClient.tsx` | Owner admin-edit UI on the public dashboard; can select any player and submit through normal prediction endpoint when global lock+override are enabled. | `savePrediction`. |

### User management

There is no general admin user-management panel (no rename/remove/ban/role management). League membership is represented by `players`:

- league creation inserts an owner-linked player;
- join checks for `(league_id, user_id)`, returning the existing row or inserting one;
- the admin page reads players mainly to target prediction imports;
- the public page associates the signed-in Auth user with a player by `user_id`.

Legacy admin access uses a locally stored `admin_code` comparison in the client for opening the page, but all mutation endpoints require authenticated `owner_id`; therefore a legacy-code-only visitor can pass the UI gate but cannot perform owner-only API mutations.

## 7. Critical file contents

There are no schema or migration files to print. Each critical checked-in file is reproduced in full in the appendix after the Stage V1 analysis, once per path to avoid duplicate copies.

Included:

- Supabase client boundary files.
- Public league data loader.
- Match, result, and prediction Route Handlers.
- League state and player Route Handlers relevant to authorization.
- Complete standings/prediction dashboard.
- Complete admin page.

There is no standings backend file to include.

## 8. Stage V1 impact analysis

### Recommended model

Use a normalized per-league stage table rather than a free-text column:

`league_stages` (new):

- `id uuid primary key default gen_random_uuid()`
- `league_id uuid not null references leagues(id) on delete cascade`
- `stage_code` constrained to: `group_stage`, `round_of_32`, `round_of_16`, `quarterfinal`, `semifinal`, `third_place`, `final`
- `display_name text not null`
- `sort_order smallint not null` with a positive/order check
- `predictions_locked boolean not null default false`
- `admin_edit_mode boolean not null default false`
- `created_at timestamptz not null default now()`
- unique `(league_id, stage_code)`
- unique `(league_id, id)` to support same-league composite foreign keys
- check that admin-edit mode implies predictions are locked

Add `matches.stage_id uuid`, then enforce a composite FK `(league_id, stage_id) -> league_stages(league_id, id)`. This prevents attaching a league's match to another league's stage.

Add `leagues.active_stage_id uuid`, then enforce `(id, active_stage_id) -> league_stages(league_id, id)`. The active stage becomes the default dashboard/admin scope.

Do **not** add `stage_id` to `predictions` in V1. A prediction belongs to exactly one match, and the match owns the stage. Duplicating it would create mismatch risk. Stage isolation must be implemented by selecting predictions through selected-stage match IDs (or an inner join to `matches` filtered by `stage_id`).

Move stage-specific lock state to `league_stages`. Keep the existing `leagues.predictions_locked` and `leagues.admin_edit_mode` columns temporarily during an expand/contract rollout, copy their Group Stage values, switch the app, and only remove them in a later migration after production verification.

### Exact table impact

| Table | Change | Why | Risk |
|---|---|---|---|
| `league_stages` | New table with seven rows per league, stage order, per-stage lock/edit state. | Durable stage identity/history and safe admin selection. | Medium |
| `matches` | Add/backfill/require `stage_id`; add composite FK and `(league_id, stage_id, start_time)` index. | Every match must belong to exactly one isolated stage. | High because all existing matches must be backfilled without loss. |
| `leagues` | Add/backfill `active_stage_id`; later retire global lock columns. | Default stage and zero-UI-change default behavior. | Medium |
| `predictions` | No V1 column required; verify FK/cascade/unique constraint and add indexes if missing. | Stage follows match while preserving existing rows unchanged. | Low schema risk, high query-scoping importance. |
| `players` | No schema change. | Same league participants compete independently in every stage. | Low |
| `standings` | No table exists; no schema change. | Standings remain derived from the selected stage. | Low |

Recommended indexes, after checking deployed catalog for equivalent indexes:

- `league_stages (league_id, sort_order)`
- unique `league_stages (league_id, stage_code)`
- `matches (league_id, stage_id, start_time)`
- `predictions (match_id, player_id)` unique (expected already because upsert depends on it)
- `predictions (player_id, match_id)` if player-first lookups are frequent

### Likely migrations

Use at least two deploy-safe migrations, not a destructive rewrite.

1. **Expand and backfill**
   - Create the stage-code enum or an equivalent text `CHECK`.
   - Create `league_stages`.
   - Seed all seven stages for every existing league idempotently with `ON CONFLICT DO NOTHING`.
   - Add nullable `matches.stage_id` and `leagues.active_stage_id`.
   - Backfill every existing match to its own league's `group_stage`.
   - Backfill every league's active stage to `group_stage`.
   - Copy existing league lock/admin-edit values into that league's Group Stage row.
   - Add supporting indexes.
   - Add same-league FKs as `NOT VALID`, validate after backfill, then apply `NOT NULL` only after zero-null verification.
2. **Contract after the application has run safely**
   - Remove fallback reads/writes to global league lock columns.
   - Optionally drop `leagues.predictions_locked` and `leagues.admin_edit_mode` in a later release, never in the initial rollout.

If enum evolution is operationally undesirable, use `text` plus a named `CHECK`; either is safe when the seven keys are stable. Display labels must not be used as identifiers.

### Exact file/query changes

| Path | Required Stage V1 change | Risk |
|---|---|---|
| `app/league/[code]/page.tsx` | Load league plus active/selected stage; default to active stage; filter matches by `stage_id`; replace global prediction select with selected-stage match scoping; load stage list for history selector. | High |
| `components/LeagueClient.tsx` | Add stage metadata/selection UI with active default and history option. Keep existing calculations but feed only selected-stage matches/predictions. Scope progress, recent matches, rank movement, open matches, and all counters automatically via props. Use selected stage lock/edit state. | High |
| `app/league/[code]/admin/page.tsx` | Load stage list and active stage; require stage selection for create/manual import/AI import; filter managed matches/results/prediction imports by selected stage; expose active-stage change; use per-stage locks. | High |
| `app/api/leagues/[code]/matches/route.ts` | Accept a stable `stage_id` or `stage_code`, validate it belongs to the league, and insert it. | High |
| `app/api/leagues/[code]/matches/import/route.ts` | Require/validate stage, scope duplicate lookup to that stage, and insert `stage_id`. | High |
| `app/api/leagues/[code]/matches/[matchId]/route.ts` | Continue league ownership checks; optionally accept stage movement only through an explicit validated operation. Never silently change stage during result/detail updates. | Medium |
| `app/api/leagues/[code]/predictions/route.ts` | Load match stage; normal users may write only the league's active stage; read lock/admin-edit from that stage. Validate match, player, league, and stage consistently. | High |
| `app/api/leagues/[code]/predictions/import/route.ts` | Require selected stage; filter match map by stage; apply that stage's lock policy; preserve “skip existing” behavior. | High |
| `app/api/leagues/[code]/ai-matches/route.ts` | Accept a validated stage identifier separately from prompt display text; return it with preview context. Persistence still goes through match import. | Medium |
| `app/api/leagues/[code]/ai-results/route.ts` | Require/derive selected stage and add `.eq("stage_id", ...)` to the scoreless-match query. | High |
| `app/api/leagues/[code]/route.ts` | Replace/extend global lock mutation with active-stage selection and stage-specific lock/edit updates, or split into `/stages/[stageId]` Route Handlers. | High |
| `app/api/leagues/route.ts` | When creating a league, create seven stage rows and set Group Stage active in one reliable server workflow/RPC transaction. Until a transaction exists, handle partial failure explicitly. | Medium |
| `app/api/leagues/[code]/players/route.ts` | No stage filtering needed; players remain league-wide. | Low |
| Supabase clients/types | Generate and use typed `Database` definitions after migration; add `LeagueStage` and stage fields to local props during transition. | Medium |

There are no server actions, standings utilities, ranking APIs, or RPCs to update. The entire ranking surface is the data loader plus `LeagueClient`.

### Isolation semantics

- **Matches:** every query must include selected `stage_id`.
- **Predictions:** select through selected-stage matches; normal mutations reject non-active-stage matches.
- **Points/standings:** calculate from only selected-stage finished matches. This naturally starts every stage at zero because a new stage initially has no finished matches/predictions.
- **Default view:** resolve `leagues.active_stage_id` server-side; do not rely only on a client default.
- **History:** allow an explicit stage selector/query parameter. Historical stages should be read-only for ordinary users; admin edit rights must be intentional.
- **Admin:** chosen stage must travel as a stable ID/code in every create/import/result workflow. The free-text AI prompt stage is not sufficient.

### RLS implications

Before deployment, export and review the actual policies from Supabase because none are versioned here.

- Add SELECT policy coverage for `league_stages` consistent with league visibility.
- If browser reads remain, stage rows, matches, and predictions must be readable only to the intended audience.
- Do not treat `stage_id` as authorization by itself. Policies and service-role handlers must verify stage-to-league ownership.
- Every service-role handler must keep explicit authentication, owner/player authorization, and same-league stage validation.
- Scope prediction reads by stage even if RLS is correct; RLS is a security boundary, not a substitute for correct query shape.
- If direct browser admin reads are retained, test that owner/legacy behavior matches policy. Prefer owner-authenticated access; legacy client-only admin code does not authorize service-role endpoints.

### Production-data risks

| Risk | Consequence | Mitigation |
|---|---|---|
| Incomplete `matches.stage_id` backfill | Existing matches disappear from UI or fail `NOT NULL`. | Backfill by league join; assert zero nulls and per-league counts before constraints/app switch. |
| Wrong active-stage backfill | Existing dashboard opens at zero points. | Set every existing league to its seeded Group Stage row in the same migration. |
| Prediction query not stage-scoped | Points and counts leak across stages. | Filter matches first and predictions by those match IDs/join; add integration tests. |
| Dropping global lock columns too early | Lock state or admin override changes unexpectedly. | Dual-read/fallback during expand release; contract later. |
| Cross-league stage ID accepted by service role | Owner could mutate/read mismatched data. | Composite FK plus handler validation on `league_id` and `stage_id`. |
| Duplicate import semantics change | Existing or future fixtures skipped incorrectly. | Include stage in all duplicate keys and add tests for same teams/date in different stages. |
| 72-match assumption applied globally | Other leagues/data are misclassified or a count assertion fails incorrectly. | Backfill **all existing matches** to each league's Group Stage; separately assert 72 for the known target league by ID/code in a verification query. |
| Long table lock while adding constraints/defaults | Production writes block. | Add nullable columns first, backfill, use `NOT VALID`/validate, then set `NOT NULL` in a controlled window. |
| Untyped query drift | Runtime errors after schema rollout. | Generate Supabase types from local/development schema and compile before deployment. |

### Safe preservation path for the existing Group Stage

1. Take a production backup and export schema/policies before any migration.
2. Record pre-migration counts per league: matches, finished matches, predictions, players, and prediction-to-match links. For the known league, verify the expected 72 matches explicitly.
3. Seed seven `league_stages` rows per existing league idempotently.
4. Add nullable stage references.
5. In one controlled migration, update every existing `matches` row to that match's league-specific Group Stage row. Do not identify the 72 rows by date/team text.
6. Set each existing league's active stage to Group Stage.
7. Copy current lock/admin-edit state to Group Stage.
8. Verify:
   - total match count unchanged;
   - the known league still has 72 Group Stage matches;
   - zero matches have null/foreign stage IDs;
   - player and prediction counts unchanged;
   - every prediction still joins to its original match and now resolves to Group Stage;
   - finished score/status distribution unchanged;
   - old and new Group Stage standings are identical player-by-player.
9. Validate FKs/checks and set required columns non-null only after successful verification.
10. Deploy stage-aware application code with Group Stage fallback, then activate later stages only after smoke tests.

No existing prediction row needs to be rewritten if stage is derived through `match_id`.

### Recommended rollout and local test plan

1. Add versioned Supabase migration infrastructure to the repository and capture the current remote schema as a reviewed baseline without secrets.
2. Apply the expand migration to a local Supabase database seeded with a sanitized production-shaped fixture: at least 72 Group Stage matches, finished/upcoming/started-without-score cases, several users, ties, predictions, and lock states.
3. Generate TypeScript database types locally.
4. Implement server query/mutation scoping first, then minimal stage selectors in the public/admin UI.
5. Automated tests should cover:
   - default active Group Stage;
   - selecting history does not change active stage;
   - a new stage displays all players at zero;
   - Group Stage points exactly match the pre-migration baseline;
   - a correct prediction in one stage gives no point in another;
   - normal user cannot predict a historical/future inactive stage by crafted request;
   - owner import/create requires a valid same-league stage;
   - duplicate fixture detection is stage-local;
   - AI results only scan the selected stage;
   - per-stage lock and admin override do not affect another stage;
   - deletes/cascades and prediction uniqueness behave as expected;
   - tied ranking behavior is accepted or deliberately improved.
6. Run `npm run lint` and `npm run build`.
7. Rehearse migrations against a restored/sanitized production snapshot; run pre/post count and standings comparison SQL.
8. Deploy the expand migration, then application code. Keep old columns and fallback behavior for one observation window.
9. Activate Round of 32 only after Group Stage/history/standings and admin import smoke tests pass.
10. Perform the contract migration in a later release.

### Recommended implementation order

1. Version/capture schema, policies, and generated types.
2. Add `league_stages`, nullable references, indexes, idempotent seed/backfill, and verification SQL.
3. Add constraints after validation.
4. Make all server reads and mutations stage-aware.
5. Make the public loader and `LeagueClient` stage-scoped; add minimal active/history selector.
6. Make admin create/import/results/prediction flows stage-aware.
7. Add per-stage lock/admin-edit behavior.
8. Run local integration, lint, build, migration rehearsal, and standings equivalence checks.
9. Deploy expand migration and app; observe.
10. Later remove compatibility columns/fallbacks.

### Risk level by change

- **High:** existing-match backfill and constraints; public prediction query scoping; standings input scoping; prediction authorization; match/prediction/result imports.
- **Medium:** new stage metadata table; active-stage state; per-stage locks; AI request context; generated types; league creation transaction.
- **Low:** players remaining league-wide; stage display selector; history labels; no-change prediction schema.

### Stage V1 completion checklist

- [ ] Seven canonical stages exist for every league.
- [ ] Every existing match is assigned to that league's Group Stage.
- [ ] Known existing league still has 72 Group Stage matches.
- [ ] Existing users, players, predictions, results, and points are unchanged.
- [ ] Every league has a valid active stage; Group Stage is the migration default.
- [ ] Public matches, predictions, counters, points, ranking, and movement are selected-stage only.
- [ ] New stages begin at zero points/rank input.
- [ ] Previous stages are separately selectable history.
- [ ] Admin create/manual import/AI import requires an explicit stage.
- [ ] Result update and AI result search are stage-scoped.
- [ ] Prediction writes reject inactive/historical stages for normal users.
- [ ] Locks/admin-edit mode are stage-specific.
- [ ] RLS and every service-role authorization path are reviewed and tested.
- [ ] Migration pre/post count and standings-equivalence checks pass locally.
- [ ] `npm run lint` and `npm run build` pass.
- [ ] Deployment uses expand-first migration and a later contract cleanup.

## Appendix: full critical files


