# Habit RPG

An offline-first habit tracker where real-life habits become quests for a pixel-art hero. Finish habits to level up, skip them and lose HP, and team up with friends to beat a weekly boss.

Built with React Native (Expo), SQLite and Supabase.

**Status:** Phase 0 (setup and tooling). An architecture diagram, a feature tour and a demo will be added as the project grows. The full plan is in [docs/SCOPE.md](docs/SCOPE.md).

## Run it locally

Requirements: Node 24, pnpm 12, and for the backend a Docker runtime (Docker Desktop or OrbStack). To open the app on a simulator you also need Xcode (iOS) or Android Studio (Android).

```bash
pnpm install
pnpm dev               # Expo dev server
pnpm supabase:start    # local Supabase stack
```

Copy the app section of [.env.example](.env.example) to `apps/mobile/.env` and fill in the values `pnpm supabase:start` prints.

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
```

The same checks, a secret scan (gitleaks) and a fresh database build run in CI on every pull request.
