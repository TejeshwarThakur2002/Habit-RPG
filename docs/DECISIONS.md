# Decisions

One entry per technical or product decision, newest last. Each entry says what was decided, why, and what it replaces if anything. See [SCOPE.md](SCOPE.md) for the full design.

## D1. Phase 0 answers (2026-10-19)

Answers to the open questions in SCOPE.md section 14.1.

| #   | Question                                        | Answer                                                                                                                                                                                                                         |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | App name and bundle identifier                  | "Habit RPG", `com.tejeshwar.habitrpg` (iOS bundle id and Android package)                                                                                                                                                      |
| 2   | Devices and store accounts                      | iOS simulator and Android emulator only. No Apple Developer or Google Play Console account, so release builds ship as an Android APK through EAS internal distribution plus an Expo development-build link                     |
| 3   | Sign-in methods for MVP                         | Email one-time code only. Google and Apple stay stretch goal S7                                                                                                                                                                |
| 4   | Pixel art source                                | Original sprites drawn as palette matrices in `packages/sprites`. No third-party art                                                                                                                                           |
| 5   | Supabase region and email sender                | `ca-central-1` (Canada Central), the closest region to Ontario. Custom SMTP through Resend's free tier, set up in P3                                                                                                           |
| 6   | Repo visibility                                 | **Public from day one** (the default was private until v1.0.0). Because of this, secret scanning (gitleaks) runs in CI from the first tooling PR, and `.gitignore` covers env files and signing material from the first commit |
| 7   | Time budget and target date                     | No deadline. The phase lengths in SCOPE.md section 11 are rough guides; quality comes before speed                                                                                                                             |
| 8   | Should Claude Code merge its own pull requests? | No. Claude Code opens the PR and stops; the owner reviews and merges                                                                                                                                                           |

## D2. Pinned versions (checked 2026-10-19)

Latest stable releases on npm at project start. Expo SDK packages are installed with `npx expo install` so they match the SDK; the versions below are what that resolves to or the latest stable for non-Expo packages.

| Area                   | Package                                                           | Version                           |
| ---------------------- | ----------------------------------------------------------------- | --------------------------------- |
| Runtime                | Node.js                                                           | 24.x (local: 24.3.0)              |
| Package manager        | pnpm                                                              | 12.14.0                           |
| App framework          | `expo` (SDK 58, released 2026-09-29)                              | 58.0.16                           |
| Navigation             | `expo-router`                                                     | 58.0.24                           |
| React Native           | `react-native` / `react`                                          | 0.88.0 / 19.3.1                   |
| Local database         | `expo-sqlite` / `drizzle-orm` / `drizzle-kit`                     | 58.0.13 / 0.45.4 / 0.31.11        |
| Backend client         | `@supabase/supabase-js`                                           | 2.118.0                           |
| Backend CLI            | Supabase CLI                                                      | 2.67.1                            |
| Edge Functions runtime | Deno                                                              | 2.9.7                             |
| Animation and sprites  | `react-native-reanimated` / `react-native-svg`                    | 4.7.1 / 15.16.0                   |
| Validation             | `zod`                                                             | 4.6.7                             |
| Tests                  | `vitest` / `jest` / `jest-expo` / `@testing-library/react-native` | 5.0.5 / 30.5.2 / 58.0.11 / 14.1.0 |
| Lint and format        | `eslint` / `eslint-config-expo` / `prettier`                      | 10.13.0 / 58.0.4 / 3.9.10         |
| Commits and hooks      | `@commitlint/cli` / `husky` / `lint-staged`                       | 21.2.4 / 9.1.7 / 17.6.0           |

TypeScript uses whatever version Expo SDK 58 expects, not simply the newest release, because TypeScript 7 is a major rewrite and tooling support may lag. The SDK 58 template pins `typescript ~6.0.3`, used in every workspace package.

## D3. Monorepo setup follows the current Expo guide (2026-10-19)

From the Expo monorepo guide (docs.expo.dev/guides/monorepos, examples on SDK 58):

- pnpm workspaces with `apps/*` and `packages/*` in `pnpm-workspace.yaml`.
- Expo configures Metro for monorepos automatically from SDK 52 through `expo/metro-config`, so no `watchFolders` or `nodeModulesPaths` overrides.
- pnpm's default isolated installs are supported from SDK 54. We start isolated; if a native module misbehaves, the fallback is `nodeLinker: hoisted` in `pnpm-workspace.yaml`, recorded here if used.

## D4. Accessibility lint plugin under ESLint 9 (decided 2026-10-20)

SCOPE.md section 10 asks for `eslint-plugin-react-native-a11y`. Its latest release (3.5.1) declares support only up to ESLint 8.

Decision:

- **ESLint 9.39, not 10.** `eslint-config-expo` 58 depends on `eslint-plugin-react` and `eslint-plugin-import`, which support ESLint up to 9. ESLint 10 would leave those unsupported.
- **The a11y plugin is kept**, wrapped with `fixupPluginRules` from `@eslint/compat` for flat config. A probe file confirmed its rules fire: a touchable with no role or label fails `has-valid-accessibility-descriptors`, and an invalid role fails `has-valid-accessibility-role`.
- The `all` rule set is enabled for `.tsx` files in `apps/mobile`, `packages/ui` and `packages/sprites`, except `has-accessibility-hint`: hints are optional context, while the scope requires roles and labels.

## D5. Open: sharing `game-core` with Edge Functions (2026-10-19)

The Supabase dependency docs recommend one `deno.json` per function and say nothing about importing local TypeScript from outside `supabase/functions`. The method (a relative import through `deno.json` imports, or a build-time copy into `supabase/functions/_shared`) is decided and tested in CI before `game-core` is first imported by a function (P3), and recorded here.

## D6. Workspace scaffold choices (2026-10-20)

- **pnpm 12 supply-chain policy kept on.** pnpm 12 refuses packages published within its minimum release age. Rather than adding `minimumReleaseAgeExclude` entries, Expo ranges are written as `~58.0.0` so pnpm picks the newest patch old enough to pass. Today that resolves `expo` 58.0.14 and `expo-router` 58.0.23, one or two patches behind what `expo-doctor` expects; the next `pnpm update` after the cutoff passes picks up the newer patches.
- **Routes live in `apps/mobile/app/`** and other app code in `apps/mobile/src/` with the `@/` alias, as SCOPE.md section 10 lays out. Current Expo templates default to `src/app/`; both are supported.
- **App config is `app.config.ts`** (typed, and able to read env vars later) instead of the template's `app.json`.
- **Workspace packages ship TypeScript source** (`main: src/index.ts`). Metro transpiles them in the app; nothing is prebuilt.
- **`react-dom` peer warning:** `expo-router` pulls `react-dom` 19.3.1 as an optional peer, which wants `react` ^19.3.1 while SDK 58 pins `react` 19.3.0. The app does not target web, so this is a warning only.
- The template's `LICENSE` (Expo's MIT notice for the template), `AGENTS.md` and `.claude/settings.json` were removed: the repo's own licence is the owner's decision and `CLAUDE.md` covers agent guidance.

## D7. Dependency build scripts stay off (2026-10-20)

pnpm 12 does not run dependency install scripts unless they are approved in `pnpm-workspace.yaml` (`allowBuilds`). Two packages asked and were denied, because both ship prebuilt native binaries and their scripts are only a fallback that compiles from source: `unrs-resolver` (used by the ESLint import resolver) and `@parcel/watcher` (used by Jest's file watcher). Any future approval gets its own entry here.

## D8. CI pipeline (2026-10-20)

- `.github/workflows/ci.yml` runs on every pull request and every push to `main`, with two jobs: **`ci`** (frozen-lockfile install, lint, type-check, tests) and **`gitleaks`** (secret scan of the full git history). Both are meant to be required checks on the `main` ruleset.
- Third-party actions are pinned to commit SHAs with the release named in a comment, so a moved tag cannot change what runs. Releases at least two weeks old were chosen (checkout v7.0.0, setup-node v7.0.0, pnpm/action-setup v6.0.10, gitleaks-action v3.0.0).
- The workflow token is read-only (`contents: read`). Gitleaks PR comments are off because they need a write token; a finding still fails the job.
- Deferred from SCOPE.md section 13.2: coverage reporting arrives with the first real `game-core` code in P1, and the second job that starts the local Supabase stack arrives with the Supabase setup PR.

## D9. Local Supabase setup (2026-10-20)

- **The Supabase CLI is a pinned workspace dev dependency** (`supabase` 2.120.0 on npm), run through `pnpm exec supabase` or the `pnpm supabase:*` scripts. Local machines and CI therefore use the same version, instead of whatever Homebrew has installed. The npm package has no install script, so D7's build-script policy is unaffected.
- **Docker runtime:** OrbStack on the owner's Mac. CI uses the Docker on GitHub's Ubuntu runners.
- **`supabase/config.toml` changes from the defaults:** `project_id = "habit-rpg"`; Storage turned off because the app stores no files; Auth `site_url` and redirect URLs set to the app scheme `habitrpg://`. Email sign-in uses 6-digit codes (the CLI default `otp_length = 6`), matching SCOPE.md section 9.5.
- **CI:** a third job, `supabase`, starts the stack without the services the tests don't need, then runs `supabase db reset` so every migration and the seed are applied from scratch on each PR. pgTAP and Deno tests join this job in P3.
- **Hosted project:** not created yet. When it is, it goes in region `ca-central-1` (D1), and only its URL and publishable key go in the app (`.env.example`).

## D10. Game-core rule details the scope leaves open (2026-10-20)

SCOPE.md section 3 gives the formulas; these are the choices where it does not say exactly how.

- **Bad habits ignore difficulty.** The difficulty table lists "Bad habit" as its own row (5 XP, 2 gold, 8 HP), so a "don't" quest always uses those values, even though the habit row still stores a difficulty.
- **Crit hash is 32-bit FNV-1a** over the completion id's UTF-16 code units (`Math.imul`, unsigned). It is tiny, has published test vectors (checked in the tests), and gives identical results in Hermes and Deno.
- **Integer arithmetic for rewards.** `xp` is computed as one integer fraction, `base * streak% * (200 + INT) * bonus% / (100 * 200 * 100)`, then rounded halves-up; boss damage the same way. This avoids floating-point drift such as `10 * 1.05` landing just under or over `.5` on different engines.
- **Gear XP bonuses multiply last.** The Wizard Hat's "+10% XP on Mind habits" multiplies the XP after the streak and INT bonuses.
- **Rounding on faint:** gold lost is `floor(gold * 25%)` and HP returns at `floor(max_hp * 50%)`.
- **Late completions** skip the streak multiplier entirely (multiplier 1.0); INT and gear bonuses still apply.

## D11. Dates, streaks and day close in game-core (2026-10-20)

- **Time zones use the built-in `Intl.DateTimeFormat`, not a date library.** SCOPE.md section 7 suggests `date-fns` v4 with `@date-fns/tz`, but section 3 makes `game-core` dependency-free. `Intl` with an IANA `timeZone` works in Node, Deno and Hermes, so `game-core` keeps zero dependencies. Calendar arithmetic (adding days, weekdays) runs on plain dates through UTC, which has no daylight saving. This still needs one check on a real Hermes build in P2 (Expo Go ran the placeholder fine, but no time-zone code yet); if Hermes misbehaves, the fallback is `@date-fns/tz` in the app only.
- **Tested zones:** `America/Los_Angeles` and `Pacific/Auckland`, including both 2026 daylight-saving changes in each, and one instant that is a different date in each zone (SCOPE.md section 13.1, test 5).
- **Scheduling:** `daily` habits run every day whatever their bitmask; `weekdays` habits and "don't" quests follow the bitmask (Monday = 1 … Sunday = 64, all days = 127).
- **The global streak changes at day close:** +1 for a day with any completion, reset to 0 for a day with none. The longest streak never shrinks.
- **A habit's own streak** counts back from today, skipping unscheduled days; if today is scheduled but not done yet, it counts from yesterday, since today is still open.
- **Oak Shield** ("blocks the HP loss of 1 missed daily per day") blocks the costliest missed habit that day; a broken "don't" quest is a slip, not a missed daily, so it is never blocked.
- **A habit counts on day D** if it was created on or before D and not archived or deleted on or before D.
- **A user's first day close** starts from their sign-up date (`firstDate`); later runs start the day after `last_closed_date`, which covers job outages.

## D12. Gear, bosses and golden vectors (2026-10-20)

- **Gear ids** are kebab-case slugs (`iron-sword`, `oak-shield`, `wizard-hat`, `leather-boots`, `lucky-clover-charm`, `dragon-cape`); these are what `inventory.item_id` will store. Each of the six items has its own slot, so equipping one replaces only an item in that slot.
- **The shop's disabled reasons** come from `canBuy`: `owned`, `locked` (with the unlock level) or `insufficient_gold` (with the gold still needed), matching the "Unlocks at level N" and "Need N more gold" captions in SCOPE.md section 5.2.
- **The boss roster wraps:** after Monday, the final boss, the next week starts again with the Procrastination Slime.
- **A defeated boss stays defeated** when a member undoes a completion. SCOPE.md section 9.4 says an undo gives the damage back, but taking back a victory after members may have claimed the +50 gold would be confusing and could double-pay; undoing still refunds damage while the boss is alive.
- **Party codes** are generated from a caller-supplied random source (the server passes a crypto RNG), keeping `game-core` free of randomness so it stays deterministic and testable.
- **Golden vectors** live in `packages/game-core/golden/vectors.json`. Every expected value is worked out by hand from the formulas (each case names its arithmetic), not produced by running `game-core`. Vitest checks them now; the Deno Edge Function tests load the same file in P3.

## D13. UI foundation (2026-10-20)

- **Fonts load with `useFonts` in the root layout**, holding the splash screen until they are ready. This is the method that works in Expo Go; the `expo-font` config plugin (fonts embedded at build time) only works in development builds, so it can replace this once the app moves to one. If fonts fail to load, the app continues with system fonts rather than staying on the splash screen.
- **Versions added:** `@expo-google-fonts/pixelify-sans` and `@expo-google-fonts/inter` 0.4.2, `expo-font` 58.0.8, `expo-splash-screen` 58.0.10, `react-native-reanimated` 4.7.1, `react-native-worklets` 0.13.0 (all via `npx expo install`).
- **`packages/ui` is a React Native package:** `react`, `react-native` and `react-native-reanimated` are peer dependencies (the app provides them) and dev dependencies (for its own type-check and tests). It has its own Jest config with the `jest-expo` preset.
- **Reanimated under Jest uses a small hand-written mock** (`packages/ui/jest.setup.js`, shared by the app's Jest config). Reanimated 4.7's own mock imports the native module and fails, and its web resolver needs `react-native-web`, which this app does not use. The mock covers only the APIs `packages/ui` uses and jumps animations to their final values; extend it when a component uses more.
- **Reduce Motion** comes from `useReduceMotion()`: the system setting, unless the in-app override (`ReduceMotionProvider`, set from Settings in P2) forces it on or off. Animated components skip straight to the end state when it is on.
- **Progress bars expose `accessibilityValue={{ text: "42 of 50" }}`**: the accessibility lint rule allows numbers or text, not both, and the text form reads naturally.
- **The gallery** is the route `/dev/gallery`, linked from the home screen only in development and redirecting home in production builds.

## D14. Game components (2026-10-20)

- **`react-native-svg` 15.16.0** is added (via `npx expo install`) for the pixel check mark and, next, the sprites.
- **No `shapeRendering="crispEdges"`.** SCOPE.md section 5.2 asks for it on sprites, but `react-native-svg` has no such prop. Pixel art stays sharp on native as long as every cell is a whole-unit `Rect` drawn at a whole-number scale, so sprites will be drawn that way. The design canvas's check-mark path also traced over itself and filled almost nothing, so the check is drawn as a 7 × 7 grid of 2-unit cells instead.
- **HabitRow** is a `checkbox` with its checked state exposed, a label that reads like the SCOPE.md section 5.10 example, and an "Edit" screen-reader action alongside long press. It is memoised for long lists.
- **ShopItem's states come in as data** (`buyable`, `expensive` with gold needed, `owned`, `equipped`, `locked` with unlock level), matching `canBuy` in `game-core`. A too-expensive item keeps its effect text and adds "Need N more gold" after it.
- **Heatmap input** is 84 daily counts, oldest first, one Monday-to-Sunday week after another. The grid is a single accessible image described by a summary sentence; the Less/More legend is hidden from screen readers because the summary already says it.
- **Numbers like "1,240"** are formatted with a small helper rather than `toLocaleString`, so they look the same on every device whatever its locale.
- **Testing:** React Native Testing Library 14 makes `fireEvent` async, so every call is awaited; overlapping ones break the following tests. ESLint now resolves each workspace's tsconfig paths, including the app's `@/` alias.

## D15. Overlays and form controls (2026-10-20)

- **Modal and BottomSheet wrap React Native's own `Modal`** (fade for dialogs, slide for sheets, no animation when Reduce Motion is on) rather than adding a bottom-sheet library; the app's sheets are short forms that don't need drag-to-resize. If the habit sheet later needs gestures, `@gorhom/bottom-sheet` is the candidate and gets its own entry here.
- **Screen readers can always close an overlay:** both mark themselves modal (`accessibilityViewIsModal`), which hides the tap-outside backdrop from VoiceOver, so both also handle the VoiceOver escape gesture (`onAccessibilityEscape`); Android's back button closes them through `onRequestClose`.
- **Toast** is presentational: the message is a polite `alert`, an optional action (Undo) sits beside it, and it calls `onDismiss` after 5 seconds (SCOPE.md section 5.6). Which toast is showing will live in the Zustand UI store in P2.
- **SegmentedControl** is a `tablist` of `tab`s with the selected one announced; each segment is at least 44 pt tall. **TextField** shows a character count when it has a `maxLength`, and an error replaces its hint and is announced.
- **`react-native-safe-area-context`** is a peer dependency of `packages/ui` (the sheet pads above the home indicator); its own Jest mock reports zero insets.
- **`StyleSheet.absoluteFillObject` is gone in React Native 0.88**; use `StyleSheet.absoluteFill`.

## D16. Sprites (2026-10-20)

- **One shared palette, character keys.** Every sprite is an array of equal-length strings; each character is a key into one palette (`packages/sprites/src/palette.ts`) and `.` is transparent. This is the scope's "palette-index matrices" in a form that is easy to read and edit as text. Tests check every matrix's size (heroes and gear 10 × 12, bosses 12 × 8) and that every character is in the palette.
- **The Knight and the Procrastination Slime are copied cell for cell from the design canvas**; the Mage, Rogue, six gear overlays and seven other bosses are original art in the same chunky style. Nothing is third-party, so `docs/ASSETS.md` gains no rows. The canvas Knight uses 8 colours with no separate outline colour; the art follows the canvas rather than the "3 to 5 colours" line in SCOPE.md section 5.2.
- **Heroes have no weapon of their own.** The canvas Knight holds a sword; here the sword is the Iron Sword overlay, so equipping and unequipping it changes the sprite as F5 requires.
- **Gear layers:** capes draw behind the hero, everything else in front, in shop order.
- **Rendering:** each sprite is one SVG whose `viewBox` is in cells, so every rectangle sits on whole units; neighbouring same-colour cells in a row merge into one rectangle (a sprite draws about 30 rectangles instead of 120). The on-screen cell size should be a whole number of points.
- **A defeated boss** is drawn in greys of the same brightness and its accessible name says "defeated"; the visible "Defeated!" label is on the BossCard.
- **`HeroClass`** (`knight` | `mage` | `rogue`) now lives in `game-core`, next to the other domain types.

## D17. Local database (2026-10-20)

- **Versions:** `expo-sqlite` 58.0.13 (via `npx expo install`), `drizzle-orm` 0.45.4 and `drizzle-kit` 0.31.11. The Drizzle Expo guide currently shows its 1.0 release candidates (`@rc`); the stable 0.45 line is used instead, and moving to 1.0 gets its own entry once it is stable.
- **Setup follows the Drizzle Expo guide:** `drizzle.config.ts` with `driver: 'expo'`, `babel-plugin-inline-import` so the `.sql` migration files are bundled as strings, `.sql` added to Metro's source extensions, and `useMigrations` in a `DatabaseGate` that holds the first screen until migrations finish. The database opens with `enableChangeListener: true` so `useLiveQuery` can repaint screens after writes.
- **Migrations** are generated with `pnpm --filter @habit-rpg/mobile db:generate` into `apps/mobile/src/db/migrations` (ignored by lint and Prettier because drizzle-kit writes them). Never edit a generated migration; change the schema and generate a new one.
- **Schema:** mirrors SCOPE.md section 8.1 for `profiles`, `characters`, `habits`, `completions` (with the partial unique index allowing one active completion per habit per day), `day_closures`, `inventory` and the party read-models, plus the local-only `outbox`, `sync_state` and `settings` from section 8.2. Two additions the server schema will need in P3: `habits.created_date` (day close must skip days before a habit existed, D11) and display fields on `party_members` (hero name and class, so the Party screen works offline).
- **Queries are synchronous** and take an `AppDb` type (`BaseSQLiteDatabase<'sync', …>`) that both expo-sqlite and sql.js satisfy. Synchronous writes keep a habit completion inside one SQLite transaction with no awaits, which helps the 100 ms target.
- **Query tests run on sql.js** (SQLite compiled to WebAssembly) in a separate plain-Node Jest project, with the real migrations applied. That tests the same SQL as the phone without native modules or build scripts. jest-expo's runtime polyfills broke sql.js's async start-up, hence the separate project.
- **Demo seed** (`seedDemo`) replaces all local data with the design canvas's hero (Sir Commit, level 7, 12-day streak), the five sample quests with 12 weeks of history, two gear items and a four-member party fighting the Procrastination Slime. It takes `now`, the time zone and an id generator, so tests are deterministic.
- **`esbuild`'s install script is denied** like the two in D7; drizzle-kit runs fine on its prebuilt binary.

## D18. App shell and route guards (2026-10-20)

- **Route groups follow SCOPE.md section 5.3:** `(auth)/sign-in`, `(auth)/onboarding`, `(tabs)` with Quests (`index`), Party, Hero and Stats, and the dev-only gallery. Expo Router's `Stack.Protected` guards decide which group is reachable; a pure `decideArea` function holds the rule (no session and no demo → sign-in; no hero yet → onboarding; otherwise the tabs) and is unit-tested.
- **The guard reads the database synchronously on the first render**, then re-reads after every change through expo-sqlite's `addDatabaseChangeListener`. Drizzle's `useLiveQuery` returns empty data on its first render, which made the guard pick sign-in for one frame and then switch, and Expo Router logged a `ROUTE_NAMES_CHANGED` error while the tabs were mounting.
- **Until P3 there is no real sign-in:** the sign-in screen shows the email field with "Send code" disabled and a note, and "Try the demo" seeds the demo hero. A temporary "Leave the demo" button on the Stats tab returns to sign-in until Settings (with Sign out) exists. The onboarding route is a placeholder until its own PR.
- **Tab bar:** four equal tabs with the design canvas's outline icons (square, circle, shield, axis), gold when active and muted otherwise, labels always shown, 60 pt plus the bottom safe area (84 on an iPhone with a home indicator). The tab-change haptic from section 5.9 waits for the P6 polish pass with the other haptics.
- **`expo-crypto` 58.0.7** supplies UUIDs for new rows (`newId`); the device time zone comes from `Intl.DateTimeFormat().resolvedOptions().timeZone`.

## D19. Playing without an account (decided by the owner, 2026-10-20)

- **"Start without an account" on the sign-in screen** creates a real local hero through onboarding. It changes the scope slightly: SCOPE.md F1 assumes email sign-in comes first. The owner chose it so a player can use the full app in P2 before the backend exists, and it keeps the app usable fully offline from the very first launch.
- **How it works:** the button sets `settings.local_only`, which the route guard treats like a session, so it opens onboarding (name, class, time zone). `createHero` writes a level 1 hero with 44 HP and no gold under the local user id, replaces any leftover demo data, and marks onboarding done, which opens the tabs. The flag needed migration `0001_add_local_only_setting`.
- **In P3** signing in will attach this local hero and its history to the new account and upload it through the sync outbox, instead of starting over. That flow gets its own entry when it is built.
- **Onboarding validation** uses Zod in the app: hero names are cleaned (whitespace tidied, control and invisible characters removed, SCOPE.md section 9.6) and must then be 2 to 20 characters; the time zone must be one `Intl.DateTimeFormat` accepts. The device's zone is pre-filled and can be changed. `react-hook-form` (SCOPE.md section 7) is left for the habit sheet, which has more fields; three single-field steps don't need it.
- **"Reset and sign out"** on the Stats tab (temporary, until Settings exists) wipes all player data and returns to sign-in, for the demo and a local hero alike.
- **The "Your adventure begins" animation** at the end of onboarding (section 5.8) waits for the P6 animation pass; finishing goes straight to the tabs for now.
- **Layout fix:** with `behavior="padding"`, `KeyboardAvoidingView` replaces its own bottom padding with the keyboard height, so the safe-area padding moved to an inner view (`KeyboardScreen`). Before that, the bottom buttons on sign-in sat over the home indicator.
