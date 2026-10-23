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

**Resolved in D31** (owner's choice, 2026-10-23): a checked copy in `supabase/functions/_shared`.

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

## D20. Quests screen and completing habits (2026-10-20)

- **PR order changed within P2:** this PR is the Quests screen plus completing and undoing habits (the core of F3), and the habit sheet (F2) is the next PR. A Quests screen whose quests can't be ticked isn't usable, while the demo already has habits to tick. The level-up and faint modals, the floating "+20 XP" animation and the haptic come with the next F3 pieces.
- **Screens read with `useDbQuery`:** a synchronous query on the first render, then again after every database change (expo-sqlite's change listener). Completing a habit repaints the screen right after its transaction with no loading state, and the route guard now uses the same hook (D18).
- **Completing a habit** runs in one SQLite transaction: insert the completion with the rewards from `game-core` (streak, INT, Wizard Hat bonus, deterministic crit seeded by the new completion's UUID), then apply the XP with `applyXp` (level-ups refill HP and add 25 gold) and add the gold. A second completion of the same habit on the same day is ignored, matching the database's partial unique index. Max HP is re-derived after the insert, so a new CON point counts straight away.
- **Undo** marks the completion `undone_at` (never deleted, SCOPE.md section 8.3) and takes back its XP and gold; XP clamps at 0 in the current level, the level never drops, and the 25 gold from a level-up is kept.
- **The reward shown on an open quest** is the XP that completing it now would give (section 5.4); only gold changes on a crit, so the preview needs no completion id.
- **`SyncPill` gained a `local` state ("Saved on this phone")** for the demo and play without an account, where there is nothing to sync. P4 switches the pill to the real sync status once there is an account.
- **Not yet:** the outbox row in each mutation (P4), the "+ Add a quest" row and the empty state's button (next PR, with the habit sheet), and closing missed days on app open (with the faint modal).
- **Demo numbers follow the formulas, not the canvas:** 12 weeks of seeded water completions give the demo hero CON 18 and 57 max HP rather than the canvas's sample 50, and its quests show the real streak and INT bonuses (SCOPE.md section 3: "these rules win").

## D21. Habit sheet (2026-10-20)

- **Versions:** `react-hook-form` 7.90.0 and `@hookform/resolvers` 5.9.2, with the Zod 4 schema from the app (SCOPE.md section 7). The form keeps raw input; the schema cleans the name like hero names (section 9.6), requires 1 to 60 characters, requires a day for a Weekdays quest, and sets every day for Daily and Don't quests.
- **One route, `modal/habit/[id]`:** `new` adds a quest, any other id edits it; an unknown or deleted id just closes. It opens with Expo Router's `presentation: 'modal'`, which on iOS is the native page sheet (slides up, swipe down to close). SCOPE.md section 5.3 says "bottom sheet"; the native sheet gives the swipe-to-dismiss and keyboard handling for a long form for free, so the in-app `BottomSheet` stays for short sheets. Say if the custom sheet is wanted instead.
- **Entry points (section 5.4):** the dashed "+ Add a quest" row under the list, a button in the empty state, and long press or the accessibility action "Edit" on a row.
- **Archive and delete are soft** (section 8.3): archive sets `archived_at`, delete sets `deleted_at` after a confirm alert. Both hide the quest from the board and keep its completions for stats. Every write bumps `client_updated_at` for P4's sync.
- **The live numbers** under the difficulty ("+20 XP · +6 gold · −6 HP if missed") come from `game-core`'s base values, before streak and stat bonuses.
- **Not in this PR:** the optional daily reminder time (it needs notification permissions and scheduling, so it lands with F9 reminders), and drag to reorder (its own F2 PR). New quests go to the end of the list.
- **`cleanText`** moved from onboarding to `src/lib/text.ts`, shared by hero and quest names.

## D22. Reordering quests (decided with the owner, 2026-10-22)

- **A drag handle starts the drag.** Long press already opens the habit sheet (SCOPE.md section 5.4), so the owner chose a handle (three bars) at the right edge of each of today's quests instead of a long-press drag or a separate reorder mode. Tap still completes and long press still edits.
- **Screen readers get "Move up" and "Move down"** actions on each row, since they can't drag (section 5.10). The handle itself is hidden from them.
- **Versions:** `react-native-gesture-handler` 3.3.0 (the version Expo SDK 58 pins; `GestureHandlerRootView` now wraps the app) and `react-native-reorderable-list` 0.18.2, whose `NestedReorderableList` and `ScrollViewContainer` let the list sit inside the scrolling board. Gesture Handler 3 still runs the older `Gesture.Pan()` API the library uses. `react-native-draggable-flatlist` was the other option but hasn't been updated since 2025.
- **What gets saved:** only today's quests are on screen, so `reorderHabits` gives the moved quests the places they held between them and leaves other days' quests where they are. Active habits are renumbered 0, 1, 2… and only rows whose number changes are written and stamped for sync.
- **Tests:** dragging can't run in Jest, so the app's tests swap the list for plain views (`apps/mobile/jest.setup.js`) and cover reordering through the Move up / Move down actions, the `moveItem` helper and the query tests on sql.js. Dragging was checked on the iPhone simulator.
- **Known noise:** in development the library makes Reanimated warn "Dependencies should only be used on the web". It is harmless and comes from the library, not our code.

## D23. Closing days on the phone and fainting (2026-10-22)

- **This PR covers F4 on the phone; F3's polish is the next PR.** The planned "modals, floating XP, haptics and day close" PR is split in two to stay near the 400-line guideline: this one closes days and shows "You fainted"; the next adds the level-up modal, the floating "+20 XP", haptics and the bar animations.
- **Days close on the phone until P3** (SCOPE.md P2, "local day-close on app open"). `closeDays` closes every day from the one after `characters.last_closed_date` up to the latest day past 03:00 local time, oldest first, in one transaction. It uses game-core's `datesToClose`, `closeDay`, `applyHpChange` and `closeDayStreak`, so the rules match the server job that replaces it in P3. A hero who has never had a day closed starts from their sign-up day.
- **When it runs:** when the tabs open and whenever the app returns to the foreground, so a phone left open overnight catches up the next time it is used.
- **Repeats do nothing:** `last_closed_date` moves forward in the same transaction, and the `day_closures` key ignores a second row for the same day.
- **Habits archived or deleted on or before a day don't count for it;** their archive and delete times are turned into local dates in the hero's time zone. Equipped gear (Oak Shield) blocks misses as in section 3.
- **The faint notice is stored** in a new `settings.pending_faint` column (migration 0002) until the player taps Continue, so the modal still shows if the app is closed first. Several faints before the player looks are shown as one (gold and XP lost added up). Wiping player data (reset, new hero, demo) clears it.
- **"You fainted" is the `Modal` from packages/ui, shown over the tabs,** rather than a `modal/fainted` route (section 5.3). It needs no navigation and can't be opened by a stale link. The level-up modal will work the same way.
- **Lesson:** run `db:generate` with the dev server stopped. Metro reloaded the simulator while drizzle-kit wrote a randomly named migration, which I then renamed; the simulator had already recorded the first version, so the renamed one failed. Only the development simulator was affected.

## D24. Reward feedback: level-up, floating rewards, haptics (2026-10-22)

- **Completes F3 on the phone** (SCOPE.md sections 5.8 and 5.9). Completing a quest fires a light haptic, pops the checkbox (1 → 1.15 → 1 in 150 ms) and floats "+20 XP" and "+6 gold" up 24 pt from the row over 600 ms. Screen readers hear "Plus 20 XP and 6 gold". The XP and HP bars already eased over 300 ms (D14).
- **Level-up modal:** "Level 8!", the hero hopping in two pixel frames, up to 30 pixel confetti pieces for 1.2 s, "HP restored, +25 gold" (more gold when one completion crosses several levels) and Continue, with a success haptic. Like "You fainted" (D23) it is the packages/ui `Modal` over the screen rather than a `modal/level-up` route. It needs no saved notice: it shows right after the tap that caused it, and the new level stays on the hero card if the app closes.
- **Haptics:** `expo-haptics` 58.0.7 (the SDK 58 version, no config needed), wrapped in `src/lib/haptics.ts`: light impact on complete, success on level-up, warning when "You fainted" appears, selection tick on tab press. Boss victory comes with the party work. A haptic the phone refuses (Low Power Mode, no Taptic Engine) is logged and never blocks the action.
- **Reduce Motion:** the saved `settings.reduce_motion` now reaches `ReduceMotionProvider` at the root (until now only the dev gallery used the provider). With it on, there is no float, pop, hop or confetti and state changes are instant; haptics stay on. The Settings switch for it arrives with the Settings screen.
- **Reusable pieces in packages/ui:** `FloatingReward`, `Confetti` (seeded, so the same pattern every time), `Hop`, and the checkbox pop inside `HabitRow`.
- **Checked on the iPhone simulator with screen recordings:** the float, the level-up hop and confetti (gone after 1.2 s), and Reduce Motion. Haptics can't be felt on a simulator; tests check that the right one is requested.

## D25. Hero screen and gear shop (2026-10-22)

- **Builds F5 as SCOPE.md section 5.6 lays it out:** "Your Hero" with the gold chip; the hero card with the sprite at 110 × 132 (11 pt cells) wearing its equipped gear, the name, "Level 9 Knight" and the four stat chips; the helper line; and the gear shop with Shop and Owned tabs.
- **Shop and Owned:** Shop lists items not yet bought, each with game-core's `canBuy` state (buyable, "Need N more gold" or "Unlocks at level N"). Owned lists bought items with Equip or Equipped. Buying moves an item from Shop to Owned, matching F5's "the item moves to my inventory".
- **Buying** takes the gold and adds the item unequipped in one transaction, and shows "Bought Oak Shield" with Undo for 5 seconds. Undo gives the gold back and removes the item, taking it off first if it was already put on. A refused purchase (only possible after a very fast double tap) says why in the toast.
- **Equipping** uses game-core's `equip` (one item per slot) and `unequip`. Stats and the sprite change at once. If taking something off lowers max HP below the current HP, HP drops to the new maximum, since HP never exceeds max (section 3).
- **Stat tooltips:** tapping a stat chip shows how that stat grows and what it does, from the rules in section 3, in a panel under the chips (a screen reader reads it when it appears). Tapping the chip again hides it.
- **Item icons:** six original 8 × 8 pixel-art icons in the sprite palette (`packages/sprites/src/items.ts`) and an `ItemIcon` renderer, 24 pt by default, greyed while locked. They replace the gallery's placeholder blocks, which were the last item carried into P2 from P1. Like every sprite they are original, so docs/ASSETS.md needs no new entry.
- **Not yet:** the outbox row for purchases and equips comes with sync in P4, where the server checks the price again.

## D26. Stats screen (2026-10-23)

- **Builds F6 as SCOPE.md section 5.7 lays it out:** "Adventure Log", three tiles (day streak, this month's completion rate, bosses beaten), the 12-week heatmap card, "Quest completion" for the last 30 days, and the sync card. Every number comes from SQLite, so the screen works offline.
- **The rules live in game-core** (`stats.ts`): `completionRate`, `monthStart`, `heatmapCounts` and `heatmapSummary`, pure like the rest, so the server can reuse them. Coverage stays at 100%.
- **How a completion rate is counted:** scheduled quests completed divided by scheduled quests, from the start of the period to today. A day only counts for a quest that existed and wasn't archived or deleted yet. Today counts only the quests already done, so an unfinished morning doesn't pull the rate down. A quest with nothing scheduled in the period shows "–".
- **"Quest completion" shows up to 5 quests:** all of them, best first, when there are 5 or fewer; with more, the top 3 and the bottom 2, so both what's going well and what needs attention are visible (section 5.7 says "the best and worst" without saying how many of each).
- **The quest detail is a small pop-up** (the packages/ui `Modal`, like D23 and D24) with the last-30-day rate, the quest's own streak (game-core's `habitStreak`) and an "Edit quest" button that opens the habit sheet. A full habit detail screen isn't in the scope's route list, so this stays small.
- **Bosses beaten** counts defeated boss weeks in parties the hero belongs to; the demo party's boss isn't beaten yet, so it shows 0.
- **The sync card says "Saved on this phone"** until accounts and sync exist (P3 and P4): demo data never syncs, and a local hero's progress will once they sign in. The Retry / Sync now button arrives with sync.
- **Not yet:** the gear button in the header opens Settings, which is its own PR. Until then the temporary "Reset and sign out" button stays at the bottom of this screen.

## D27. Settings (2026-10-23)

- **Builds the phone half of F10 at `modal/settings`** (SCOPE.md sections 5.3 and 5.8), a native modal like the habit sheet (D21), opened from a 44 × 44 gear button in the Stats header. The gear is a new `IconButton` and `GearIcon` in packages/ui (shown in the dev gallery), drawn as a 22 pt outline like the tab icons.
- **Hero name and time zone** use onboarding's Zod rules (2 to 20 characters after cleaning; a real IANA zone). "Save changes" stays off until something valid changed, and a "Use this phone's zone" button appears when the phone's zone differs from the hero's. Renaming also renames the hero in the local party read-model, in the same transaction.
- **A new time zone only moves "today" from now on.** Days already closed stay closed; the next day close uses the new zone. This matches the server, which reads the zone from the profile.
- **Reduce motion** is System, On or Off, saved at once in `settings.reduce_motion`, which already feeds `ReduceMotionProvider` (D24). It is a device setting, so signing out keeps it.
- **Sign out replaces the temporary "Reset and sign out" button on Stats** (D19, D26). Until accounts exist there is nothing to sign out of, and the hero lives only on the phone, so it asks first and says what goes: "Leave the demo" in the demo; "Sign out", which deletes the local hero, otherwise.
- **Not yet:** Delete account needs the server's `delete-account` function, so it arrives with accounts in P3 (until then, signing out already removes everything from the phone). Notification permission status comes with reminders (F9). The privacy policy link waits for `docs/PRIVACY.md`. The outbox row for profile changes comes with sync in P4.

## D28. Quest reminders (decided with the owner, 2026-10-23)

- **Builds F9 with `expo-notifications` 58.1.6 and `@react-native-community/datetimepicker` 9.2.1**, installed with `npx expo install`; both config plugins are in `app.config.ts`. Local notifications work in Expo Go; only remote push needs a development build.
- **Rolling 7 days, chosen by the owner:** the phone books one-off reminders for the next 7 days rather than repeating ones. This is the only way to meet F9's "cancelled if the habit is completed" (a repeating trigger can't skip one day) and to follow the hero's time zone instead of the phone's. The app rebooks after every database change (500 ms after a burst of writes) and whenever it opens, so the window keeps moving. If the app isn't opened for over a week, reminders stop until it is.
- **The rules are in game-core** (`reminders.ts`): `upcomingReminders` skips days a quest isn't scheduled, is already done, or whose time has passed, and keeps at most 60 (iOS allows 64 pending). `zonedInstant` turns a date and HH:MM in the hero's zone into an instant; on the spring-forward day a skipped time (02:30) fires an hour later, and on the fall-back day the first 01:30 counts. Coverage stays at 100%.
- **Booking lives at the app root**, so signing out (no hero, empty plan) clears every booked reminder. The app books only reminders, so each booking cancels all scheduled notifications first.
- **Permission is asked when the player first turns on a reminder**, not at launch. If it is refused, the reminder time is still saved and the sheet says it won't arrive. Reminders also show as a banner while the app is open.
- **Habit sheet:** a "Remind me" switch; turning it on picks 8:00 PM, changed with the system time picker (compact on iOS, the dialog on Android).
- **Settings shows the notification status** (on, not set up yet with "Turn on notifications", or off with "Open phone Settings"). After a refusal it shows a one-time hint until "Got it", remembered in a new `settings.notification_hint_seen` column (migration 0003). Permission is read again whenever the app returns to the foreground.
- **Not yet:** the reminder text is fixed ("Your quest is waiting. Finish it to earn XP and gold."); custom messages or snoozing aren't in the scope. On Android 12+ reminders may arrive a few minutes late without the exact-alarm permission, which we don't request.

## D29. Maestro flow (2026-10-23)

- **Maestro 2.11.0**, installed with the official script into `~/.maestro` (the owner pre-approved it). Its anonymous analytics are switched off with `MAESTRO_CLI_NO_ANALYTICS=1` in the `e2e` script.
- **`pnpm e2e` runs every flow in `apps/mobile/e2e`** on the booted iOS simulator, in Expo Go against the dev server on port 8095. Expo Go can't be launched by app id, so a flow stops Expo Go and opens `exp://127.0.0.1:8095`, as Maestro's Expo guide describes. Helpers live in `e2e/subflows/`, which a folder run doesn't pick up as flows.
- **"Add a quest, complete it, see XP"** (SCOPE.md P2) signs out of whatever hero the simulator has, starts a local hero "Maestro", adds "Stretch", completes it, and checks that the row says done, the XP bar left "0 of 200" and the header reads "1 of 1 done". It passed three runs in a row, about 30 seconds each. **Running it deletes the simulator's current hero** (demo or local), like signing out does.
- **Selectors are the accessibility labels the app already has** (rows, tabs, the XP bar's "21 of 200" value). Two text inputs get a `testID` (`hero-name`, `habit-name`), because a field's visible label and its input share the same text. The XP reward is matched as a number pattern, since it includes the hero's bonuses from game-core.
- **Not in CI yet:** SCOPE.md section 13 plans an on-demand `e2e.yml` workflow. Running in CI needs a development build of the app rather than Expo Go, which comes with the EAS work later; for now P2's "passes in CI or locally" is met locally.

## D30. Phase 2 close (2026-10-23)

- **Built (PRs #14 to #26):** the local database and demo seed (#14); app shell and route guards (#15); onboarding and "Start without an account" (#16); Quests with complete and undo (#17); the habit sheet (#18) and drag to reorder (#19); day close and "You fainted" (#20); level-up, floating rewards and haptics with Reduce Motion (#21); Hero and the gear shop with item icons (#22); Stats (#23); Settings (#24); local reminders (#25); the Maestro flow (#26). Every SCOPE.md P2 task is done.
- **Checked at the close, on `main`:** lint, typecheck and 326 unit tests (game-core 115 at 100% coverage, ui 38, sprites 32, shared 1, app 140); the Maestro flow "add a quest, complete it, see XP" with `pnpm e2e`; and `npx expo export` for iOS and Android, which builds both Hermes bundles (5.7 MB each). There is no native build yet; EAS builds come with the release work.
- **Offline in demo mode:** the app has no network code yet (no fetch, WebSocket or Supabase client; fonts are bundled). A scripted demo tour (complete a quest, visit every tab) ran while Expo Go's connections were recorded: only the local dev server and Google addresses that belong to Expo Go itself. The Mac's network was not switched off for this check, because the simulator shares it.
- **D11 is settled: `Intl` time zones work on Hermes.** A reminder computed by game-core in America/Toronto fired at the right minute, and on the simulator Settings accepted "Pacific/Auckland" and refused "Mars/Olympus".
- **Deferred to later phases:** Delete account and real sign-in (P3); the outbox and sync (P4); the party screens (P5); the `e2e.yml` CI workflow, which needs a development build; the privacy policy page; the hosted Supabase project (the owner's call). Still open: D5 (sharing game-core with Deno), due before P3.

## D31. Sharing game-core with Edge Functions (decided by the owner, 2026-10-23)

- **Resolves D5 with a checked copy.** `scripts/copy-functions-shared.mjs` (`pnpm functions:shared`) copies `packages/game-core/src` and `packages/shared/src`, without tests, into `supabase/functions/_shared/game-core` and `_shared/shared`, each file with a "generated, do not edit" header. Functions import `../_shared/game-core/index.ts`. The owner chose this over importing the packages in place through `deno.json`, because Supabase's docs don't say whether a deploy bundles files outside `supabase/functions`, and that couldn't be tested before a hosted project exists.
- **The copy can't drift:** `pnpm functions:shared --check` fails if any copied file differs, is missing or is extra. It runs in CI and in `pnpm functions:check`, and the pre-commit hook runs the same check whenever a file in `packages/game-core/src` or `packages/shared/src` is committed, so a stale copy is caught before it reaches a PR.
- **Explicit `.ts` imports in game-core and shared** (`'./dates.ts'`, not `'./dates'`), because Deno requires file extensions. TypeScript allows them with `allowImportingTsExtensions` (in `tsconfig.base.json` and the app, ui and sprites configs, which type-check game-core's source); Metro, Jest and Vitest resolve them unchanged. Checked: typecheck, all unit tests and `npx expo export --platform ios`.
- **Deno 2.9.7** locally and in CI (`denoland/setup-deno` v2.0.5, pinned by commit SHA). `supabase/functions/tests` holds the Deno tests with their own `deno.json` and `deno.lock` (`@std/assert` 1.0.19). The first test runs the golden vectors (`packages/game-core/golden/vectors.json`) against the copy: 13 pass, the same cases Vitest checks against the source.
- **Linting Deno code:** ESLint skips `supabase/functions`, whose Expo rules don't fit Deno; `pnpm functions:check` runs `deno lint` and `deno check` there instead. Prettier still formats function code but skips the generated copy and Deno lockfiles.
- **Still to do when functions arrive:** each function gets its own `deno.json` (Supabase's recommendation), which will also map `zod` to an `npm:` specifier for the copied `shared` schemas.
