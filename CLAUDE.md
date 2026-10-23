# Habit RPG

Offline-first React Native (Expo) app where real-life habits become quests for a pixel-art hero:
finishing habits earns XP and gold, skipping them costs HP, and friends team up against a weekly
boss. Portfolio project: code quality, tests and a clean commit history matter as much as features.

**Source of truth:** [docs/SCOPE.md](docs/SCOPE.md). Read the relevant section before building
anything. Decisions and pinned versions: [docs/DECISIONS.md](docs/DECISIONS.md). Third-party assets
and licences: [docs/ASSETS.md](docs/ASSETS.md).

## Current phase

**P1 Game rules, UI kit and sprites is complete** once its last PR merges; **P2 Local-only app**
is next and needs the owner's go-ahead (restate its task list first). Still deferred from P0:
creating the hosted Supabase project (ask the owner first).

P1 delivered `game-core` (every rule in SCOPE.md section 3, golden vectors, 100% coverage),
`packages/ui` (tokens, fonts and every section 5.2 component in every state) and
`packages/sprites` (3 classes, 6 gear overlays, 8 bosses). See them all on the dev-only
`/dev/gallery` screen. Carried into P2: shop item icons (placeholders in the gallery) and a
check that `Intl` time zones work on Hermes (DECISIONS.md D11).

On this Mac the Android emulator renders black with its default GPU mode; start it with
`emulator -avd Medium_Phone_API_37.0 -gpu swiftshader_indirect`.

## Stack

- TypeScript (strict) everywhere; pnpm 12 workspaces; Node 24
- App: Expo SDK 58, Expo Router, React Native 0.88 (`apps/mobile`)
- Local database (P2): `expo-sqlite` + Drizzle; the UI reads only from SQLite
- Backend (P3): Supabase (Postgres, email-code Auth, Realtime, Deno Edge Functions, `pg_cron`)
- Tests: Vitest in packages, Jest + React Native Testing Library in the app, Maestro flows in
  `apps/mobile/e2e` (local, on the iOS simulator); pgTAP and `deno test` arrive in P3
- CI: GitHub Actions (`ci`, `gitleaks`, `supabase` jobs)

## Commands

```bash
pnpm install              # install everything (frozen lockfile in CI)
pnpm dev                  # start the Expo dev server
pnpm ios / pnpm android   # open on a simulator or emulator
pnpm lint                 # ESLint (incl. accessibility rules) + Prettier check
pnpm format               # Prettier write
pnpm typecheck            # tsc in every workspace
pnpm test                 # Vitest + Jest in every workspace
pnpm e2e                  # Maestro flows (needs the dev server on port 8095 and a booted simulator)
pnpm supabase:start       # local Supabase stack (needs Docker, e.g. OrbStack)
pnpm supabase:stop
pnpm exec supabase db reset   # re-apply migrations and seed locally
```

Add Expo packages to the app with `npx expo install <pkg>` (run inside `apps/mobile`) so versions
match the SDK. Run lint, typecheck and tests before calling any task done.

## Folder map

```text
apps/mobile/            Expo app
  app/                  Expo Router routes ((auth), (tabs), modal) — screens only
  src/                  app code, imported with the @/ alias (components, features, db, sync, lib, stores)
  app.config.ts         app config (bundle id com.tejeshwar.habitrpg)
packages/
  game-core/            pure game rules, no dependencies, used by app and server
  shared/               Zod schemas and types for sync and party payloads
  ui/                   design tokens (tokens.ts) and shared components
  sprites/              pixel-art matrices (art.ts), palette and HeroSprite/BossSprite
supabase/               config.toml, seed.sql; migrations/, functions/, tests/ arrive in P3
docs/                   SCOPE, DECISIONS, ASSETS (PRIVACY, ARCHITECTURE, DEMO later)
.github/workflows/      ci.yml
```

## Hard rules (SCOPE.md section 1)

- **Offline-first:** every user action works with no network. Screens read from local SQLite,
  never from the network.
- **Server is authoritative** for XP, HP, gold and boss HP. The client computes optimistically with
  `game-core`; the server's result wins on sync.
- **No secrets in the app or the repo.** Only the Supabase URL and publishable key may ship in the
  app. The service-role key and `CRON_SECRET` live only in Edge Function secrets. Keep
  `.env.example` current.
- **Row Level Security on every table:** users reach only their own rows, plus party data for
  parties they belong to.
- **No real-money purchases.** Gold is cosmetic and earned only from habits.
- **Original art and names.** Never copy art, names or text from Habitica or any other game. Record
  every third-party asset in `docs/ASSETS.md`.
- **Accessibility:** touch targets at least 44 pt, contrast at least 4.5:1, every control has a role
  and label, respect Reduce Motion, never use colour alone to show state.
- **TypeScript strict;** no `any` without an eslint-disable comment explaining why.
- **Ask when unsure.** If the scope conflicts with current library behaviour, say so and propose an
  alternative; don't change the design silently.

## Code conventions (SCOPE.md section 10)

- Files kebab-case; components and types PascalCase; functions and variables camelCase; DB columns
  snake_case.
- Logic lives outside components: rules in `game-core`, database access only through
  `src/db/queries`, network only through `src/sync` and `src/lib/supabase.ts`.
- `game-core` never calls `Date.now()` or reads the device time zone; `now` and `timeZone` are
  arguments. Use local dates, never 24-hour arithmetic, for days.
- No raw hex colours in screens; use `colors` from `@habit-rpg/ui`.
- Validate all external data with Zod. Never swallow errors.
- Files under ~300 lines, functions under ~50. Comments explain why, not what.
- Every schema change is a new migration; never edit a merged one.
- Check the current official docs before writing code against Expo, Expo Router, expo-sqlite,
  Drizzle, Supabase or Reanimated, and record versions in DECISIONS.md.

## Git rules (SCOPE.md section 12)

- Never commit to `main`; it is protected (PR required, squash merge only, CI must pass).
- One task, one branch, one PR, ideally under ~400 changed lines. Stop after opening the PR; the
  owner reviews and merges. Don't start the next task on an unmerged branch.
- Branch names: `type/ID-short-description`, e.g. `feat/F3-complete-habit`, `chore/p0-ci-pipeline`.
- Commits: Conventional Commits, `type(scope): imperative summary` (72 chars max), body explains
  why, footer `Refs: F3`. Types: feat, fix, test, refactor, perf, docs, chore, ci, build. Scopes:
  mobile, game-core, shared, ui, sprites, db, sync, party, supabase, ci, docs. commitlint enforces
  this.
- Stage specific files and check `git diff --staged` before committing; never commit `.env` files,
  keys or build output.
- Never skip hooks (`--no-verify`), force-push, `reset --hard` or rewrite shared history without
  asking. The only allowed force-push is `--force-with-lease` on your own rebased feature branch.
- Keep the `Co-Authored-By` trailer.

## Phase workflow

At the start of each phase, restate its task list and wait for the owner's go-ahead. Before saying
a phase is done, lint, type-check, tests and a build must pass; then summarise what was built,
tested and deferred, update this file's "Current phase", and stop.
