# Decisions

One entry per technical or product decision, newest last. Each entry says what was decided, why, and what it replaces if anything. See [SCOPE.md](SCOPE.md) for the full design.

## D1. Phase 0 answers (2026-10-19)

Answers to the open questions in SCOPE.md section 14.1.

| # | Question | Answer |
| --- | --- | --- |
| 1 | App name and bundle identifier | "Habit RPG", `com.tejeshwar.habitrpg` (iOS bundle id and Android package) |
| 2 | Devices and store accounts | iOS simulator and Android emulator only. No Apple Developer or Google Play Console account, so release builds ship as an Android APK through EAS internal distribution plus an Expo development-build link |
| 3 | Sign-in methods for MVP | Email one-time code only. Google and Apple stay stretch goal S7 |
| 4 | Pixel art source | Original sprites drawn as palette matrices in `packages/sprites`. No third-party art |
| 5 | Supabase region and email sender | `ca-central-1` (Canada Central), the closest region to Ontario. Custom SMTP through Resend's free tier, set up in P3 |
| 6 | Repo visibility | **Public from day one** (the default was private until v1.0.0). Because of this, secret scanning (gitleaks) runs in CI from the first tooling PR, and `.gitignore` covers env files and signing material from the first commit |
| 7 | Time budget and target date | No deadline. The phase lengths in SCOPE.md section 11 are rough guides; quality comes before speed |
| 8 | Should Claude Code merge its own pull requests? | No. Claude Code opens the PR and stops; the owner reviews and merges |

## D2. Pinned versions (checked 2026-10-19)

Latest stable releases on npm at project start. Expo SDK packages are installed with `npx expo install` so they match the SDK; the versions below are what that resolves to or the latest stable for non-Expo packages.

| Area | Package | Version |
| --- | --- | --- |
| Runtime | Node.js | 24.x (local: 24.3.0) |
| Package manager | pnpm | 12.14.0 |
| App framework | `expo` (SDK 58, released 2026-09-29) | 58.0.16 |
| Navigation | `expo-router` | 58.0.24 |
| React Native | `react-native` / `react` | 0.88.0 / 19.3.1 |
| Local database | `expo-sqlite` / `drizzle-orm` / `drizzle-kit` | 58.0.13 / 0.45.4 / 0.31.11 |
| Backend client | `@supabase/supabase-js` | 2.118.0 |
| Backend CLI | Supabase CLI | 2.67.1 |
| Edge Functions runtime | Deno | 2.9.7 |
| Animation and sprites | `react-native-reanimated` / `react-native-svg` | 4.7.1 / 15.16.0 |
| Validation | `zod` | 4.6.7 |
| Tests | `vitest` / `jest` / `jest-expo` / `@testing-library/react-native` | 5.0.5 / 30.5.2 / 58.0.11 / 14.1.0 |
| Lint and format | `eslint` / `eslint-config-expo` / `prettier` | 10.13.0 / 58.0.4 / 3.9.10 |
| Commits and hooks | `@commitlint/cli` / `husky` / `lint-staged` | 21.2.4 / 9.1.7 / 17.6.0 |

TypeScript uses whatever version Expo SDK 58 expects, not simply the newest release, because TypeScript 7 is a major rewrite and tooling support may lag. The SDK 58 template pins `typescript ~6.0.3`, used in every workspace package.

## D3. Monorepo setup follows the current Expo guide (2026-10-19)

From the Expo monorepo guide (docs.expo.dev/guides/monorepos, examples on SDK 58):

- pnpm workspaces with `apps/*` and `packages/*` in `pnpm-workspace.yaml`.
- Expo configures Metro for monorepos automatically from SDK 52 through `expo/metro-config`, so no `watchFolders` or `nodeModulesPaths` overrides.
- pnpm's default isolated installs are supported from SDK 54. We start isolated; if a native module misbehaves, the fallback is `nodeLinker: hoisted` in `pnpm-workspace.yaml`, recorded here if used.

## D4. Open: accessibility lint plugin vs ESLint 10 (2026-10-19)

SCOPE.md section 10 asks for `eslint-plugin-react-native-a11y`. Its latest release (3.5.1) declares support only up to ESLint 8, while `eslint-config-expo` 58 uses ESLint 9+ flat config. Options:

1. Try the plugin under ESLint 10 through `@eslint/compat` and keep it if every rule runs cleanly.
2. Drop the plugin and enforce roles and labels through a small custom ESLint rule plus React Native Testing Library checks (`getByRole` queries fail when a role or label is missing).

To be decided with the owner in the tooling PR.

## D5. Open: sharing `game-core` with Edge Functions (2026-10-19)

The Supabase dependency docs recommend one `deno.json` per function and say nothing about importing local TypeScript from outside `supabase/functions`. The method (a relative import through `deno.json` imports, or a build-time copy into `supabase/functions/_shared`) is decided and tested in CI before `game-core` is first imported by a function (P3), and recorded here.

## D6. Workspace scaffold choices (2026-10-20)

- **pnpm 12 supply-chain policy kept on.** pnpm 12 refuses packages published within its minimum release age. Rather than adding `minimumReleaseAgeExclude` entries, Expo ranges are written as `~58.0.0` so pnpm picks the newest patch old enough to pass. Today that resolves `expo` 58.0.14 and `expo-router` 58.0.23, one or two patches behind what `expo-doctor` expects; the next `pnpm update` after the cutoff passes picks up the newer patches.
- **Routes live in `apps/mobile/app/`** and other app code in `apps/mobile/src/` with the `@/` alias, as SCOPE.md section 10 lays out. Current Expo templates default to `src/app/`; both are supported.
- **App config is `app.config.ts`** (typed, and able to read env vars later) instead of the template's `app.json`.
- **Workspace packages ship TypeScript source** (`main: src/index.ts`). Metro transpiles them in the app; nothing is prebuilt.
- **`react-dom` peer warning:** `expo-router` pulls `react-dom` 19.3.1 as an optional peer, which wants `react` ^19.3.1 while SDK 58 pins `react` 19.3.0. The app does not target web, so this is a warning only.
- The template's `LICENSE` (Expo's MIT notice for the template), `AGENTS.md` and `.claude/settings.json` were removed: the repo's own licence is the owner's decision and `CLAUDE.md` covers agent guidance.
