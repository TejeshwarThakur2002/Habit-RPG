# Habit RPG: Full Project Scope

Oct 19, 2026 · @Tejeshwar Thakur

## 1. Start here (read this first, Claude Code)

You are building **Habit RPG**, an offline-first React Native app where real-life habits become quests for a pixel-art hero. This document is the single source of truth: product, rules, UI, stack, data model, build plan and git workflow. Follow it in order.

**Owner context:** a developer building this as a portfolio project to get hired. Code quality, tests, commit history, a clean README and a short demo video matter as much as features. Skills: TypeScript, React, React Native, Node.js, Python, PostgreSQL.

**How to work**

1. **Phase 0, before any code:** read the whole document, then ask me up to 8 questions about anything unclear or missing (see section 14, open questions). Wait for answers.
2. **Plan one phase at a time** (section 11). At the start of each phase, restate the task list and wait for my go-ahead.
3. **Small, verifiable steps.** One feature per branch, small commits, tests alongside code (section 12 and 13).
4. **Before saying a phase is done:** lint, type-check, tests and a build must all pass. Summarise what was built, what was tested, and what you deferred. Then stop and wait.
5. **Check current docs** for Expo, Expo Router, expo-sqlite, Drizzle, Supabase and Reanimated before writing code against them. Versions change; do not rely on memory. Record the versions you used in `docs/DECISIONS.md`.
6. **If this document conflicts with current library behaviour,** say so and propose an alternative. Do not silently change the design.

**Hard rules (must always hold)**

- **Offline-first:** every user action works with no network. The UI reads from the local SQLite database, never directly from the network.
- **Server is authoritative for game state** (XP, HP, gold, boss HP). The client computes optimistically; the server's result wins on sync (section 8).
- **No secrets in the app or the repo.** Only the Supabase URL and anon (publishable) key may ship in the app. The service-role key lives only in server-side environments. Keep `.env.example` current.
- **Row Level Security on every table.** A user can only read or write their own rows, plus party data for parties they belong to.
- **No real-money purchases.** Gold is cosmetic and earned only by completing habits.
- **Original art and names.** Draw sprites in code or use CC0/CC-BY assets with the licence recorded in `docs/ASSETS.md`. Do not copy artwork, names or text from Habitica or any other game.
- **Accessibility:** touch targets at least 44 pt, text contrast at least 4.5:1, every control labelled, respect Reduce Motion, never use colour alone to show state.
- **TypeScript strict mode,** no `any` without a comment explaining why.
- **Ask when unsure.** Do not make large silent assumptions.

**Companion file:** the visual designs for the four main screens exist as a canvas called "Habit RPG Screens". Section 5 reproduces every value from it (colours, sizes, copy), so you can build from this document alone.

## 2. Product

**One line:** your real life is the game. Finishing habits levels up a pixel-art hero; skipping them costs HP; friends team up to beat a weekly boss.

**Problem:** habit trackers are boring, so people stop using them after a week or two. Games keep people coming back through visible progress, small rewards and social pressure.

**Target users:** people who want to build habits and like games (students, developers, gamers, friends who want accountability).

**Second audience:** recruiters and hiring managers reviewing the owner's portfolio. For them the app must be easy to try (demo account, demo video, TestFlight/Expo link) and the README must explain the hard engineering: offline-first sync, conflict handling, time-zone-correct daily jobs, and real-time party play.

**What makes it different**

- **Truly offline-first:** instant taps, works in a tunnel, syncs later with no data loss.
- **Social boss fights:** shared weekly boss that every member's habits damage.
- **Small and focused:** four tabs, no clutter, no ads, no real-money purchases.
- **Honest note:** Habitica already exists in this space. This project is a fresh, smaller take with its own art, names and rules; it is not a clone and must not reuse Habitica's assets or text.

**Success metrics (portfolio and product)**

| Metric | Target |
| --- | --- |
| Habit check-off feels instant | under 100 ms from tap to updated UI, even in airplane mode |
| Sync correctness | 0 lost or duplicated completions in the two-offline-devices test |
| Daily job correctness | passes DST and time-zone test cases |
| Cold start | under 2 s on a mid-range phone |
| Quality gates | CI green, 80%+ coverage on game logic and sync code |
| Showcase | TestFlight or Play internal build, demo video under 90 s, README with architecture diagram |

**Platforms:** iOS and Android via Expo (one codebase). Portrait phones only for MVP; tablets and web are out of scope.

**Out of scope for MVP:** in-app purchases, a public marketplace, chat between users beyond the battle log, web app, widgets (stretch), localisation (English only).

## 3. Game rules (exact formulas)

All rules live in one dependency-free TypeScript package, `packages/game-core`, used by both the app (optimistic updates) and the server (authoritative results). Every formula below needs unit tests. Numbers in the screen mockups are sample data and may not match these formulas exactly; these rules win.

**Core loop:** complete a habit, gain XP and gold, level up, and damage your party's boss. Miss a scheduled habit and lose HP. At 0 HP you faint.

**Habit types and difficulty**

| Difficulty | Base XP | Base gold | HP lost if missed |
| --- | --- | --- | --- |
| Easy | 10 | 3 | 4 |
| Medium | 20 | 6 | 6 |
| Hard | 30 | 9 | 8 |
| Bad habit ("don't" quest) | 5 | 2 | 8 |

- **Daily:** scheduled every day.
- **Weekdays:** scheduled on chosen days (Mon to Sun). Misses only count on scheduled days.
- **Bad habit:** shown as a "don't" quest. Tapping it means "I resisted today" and claims the reward. If it is still unclaimed when the day closes, it counts as a slip and costs 8 HP.
- **Category** (optional, drives stats): Body (STR), Mind (INT), Health (CON), or None.

**Rewards for one completion**

```text
streak_mult = 1 + 0.05 * min(global_streak_days, 10)        // max 1.5
xp          = round(base_xp * streak_mult * (1 + INT / 200))
gold        = base_gold, doubled if crit
crit        = (hash32(completion_id) % 100) < min(LUCK, 25)  // deterministic, same on device and server
boss_damage = round(base_xp * (1 + STR / 100))
```

The crit roll uses the completion's UUID as the seed so the phone and the server always agree, even offline.

**Levels**

```text
xp_to_next(level) = 150 + 50 * level          // level 7 needs 500
```

Extra XP carries over to the next level. Levelling up restores HP to full and grants 25 gold. Show the level-up celebration modal.

**HP, stats and fainting**

```text
max_hp = 39 + CON                              // CON 11 gives 50
STR, INT, CON = 5 + floor(completions_in_category / 5) + gear_bonus     // cap 99
LUCK = floor(longest_streak_days / 2) + gear_bonus                      // cap 99
```

- **Faint at 0 HP:** lose 25% of gold (rounded down) and all XP in the current level. Level is kept. HP resets to 50% of max. Show the "You fainted" modal.
- HP never goes below 0 or above max.

**Streaks**

- **Global streak:** consecutive local days with at least one completion. A day with zero completions resets it to 0 when that day closes.
- **Per-habit streak:** consecutive scheduled days completed. Shown on the habit detail screen.
- Streak freeze is a stretch feature.

**Day close (the nightly job)**

- A "day" is the user's local calendar date, in the time zone stored on their profile.
- Day D closes at **03:00 local time on D+1** (a 3-hour grace period for night owls and slow syncs).
- At close: for each scheduled habit not completed on D, apply the HP loss (after gear blocks). Then update streaks and write one `day_closures` row (unique per user and date, so the job is idempotent).
- **Late sync:** the phone may sync a completion for day D after D closed, if the date is within the last 2 days. The server accepts it, voids that day's miss penalty for the habit, and awards XP without the streak bonus.
- Never use 24-hour arithmetic for days; use local dates, so daylight-saving changes (23 or 25 hour days) work.
- The server rejects completion dates earlier than 2 days ago or later than tomorrow in the user's time zone.

**Gear (cosmetic with small bonuses; one item per slot)**

| Item | Slot | Price (gold) | Unlock level | Effect |
| --- | --- | --- | --- | --- |
| Iron Sword | Weapon | 60 | 1 | +3 STR |
| Oak Shield | Off-hand | 40 | 1 | +2 CON; blocks the HP loss of 1 missed daily per day |
| Wizard Hat | Head | 75 | 1 | +3 INT; +10% XP on Mind habits |
| Leather Boots | Feet | 50 | 1 | +1 STR, +1 CON |
| Lucky Clover Charm | Trinket | 90 | 3 | +3 LUCK |
| Dragon Cape | Back | 200 | 10 | +2 STR, +2 LUCK |

Equipped gear is drawn on the hero sprite as an overlay. Items are bought once, then equipped or unequipped for free.

**Parties and weekly bosses**

- A party has 1 to 4 members. Members join with a 6-character code (letters A to Z except I and O, plus digits 2 to 9). A user can be in one party at a time and can leave at any time.
- The party week runs Monday 00:00 to Sunday 23:59 in the time zone of the party's creator (fixed when the party is created).
- **Boss HP** is `500 * member_count`, fixed at the start of the week. Each completion by any member deals `boss_damage`.
- **Missed habits:** the HP loss is the same as normal, but the battle log narrates it as the boss hitting that member.
- **Boss defeated:** every member gets +50 gold and a trophy shown on the Stats screen. **Not defeated:** the boss retreats, with no penalty.
- Boss roster (rotates weekly, in this order): Procrastination Slime, Snooze Goblin, Doomscroll Wraith, Couch Golem, Deadline Dragon, Junk Food Ogre, Burnout Specter, Monday (final boss). Each has its own pixel sprite.

**Hero classes (MVP: cosmetic only):** Knight, Mage, Rogue. The class sets the sprite and the title shown under the name (for example "Level 7 Knight"). Mechanical class perks are a stretch feature.

## 4. Features and acceptance criteria

Each story has an ID. Reference the ID in branch names, commits and tests (for example `feat/F3-complete-habit`). A story is done only when every acceptance criterion passes.

### MVP (must ship)

**F1. Sign in and onboarding**

- Given a new install, when I open the app, then I can sign in with an email one-time code (Google sign-in is a stretch; see section 14).
- Given I am signed in for the first time, then onboarding asks for hero name (2 to 20 characters), class (Knight, Mage, Rogue) and time zone (pre-filled from the device, editable), then creates my hero with level 1, 44 HP and 0 gold.
- Given I have signed in once, when I later open the app with no network, then I still get in and see my local data.

**F2. Habit management**

- Given I tap the Add button on the Quests tab, then a sheet lets me set name (required, max 60 characters), type (daily, weekdays, bad habit), difficulty, category, weekdays when relevant, and an optional daily reminder time.
- Given an existing habit, when I open it, then I can edit it, archive it (hidden but history kept), or delete it (soft delete).
- Given I have more than one habit, then I can reorder them by drag and the order persists.

**F3. Complete a habit (the core action)**

- Given a habit scheduled today, when I tap its row, then within 100 ms the checkbox fills, the row dims with a strike-through, XP and gold update, a light haptic fires, and a small floating "+20 XP" animation plays. This works fully offline.
- Given I tapped by mistake, when I tap the checked row again within today, then the completion is undone and its rewards are reversed.
- Given my XP crosses the level threshold, then the level-up modal shows, HP refills, and the hero sprite plays a short celebration.

**F4. Day close and fainting**

- Given a scheduled habit was not completed on day D, when the server closes day D (03:00 local on D+1), then HP is reduced per section 3 and the change appears in my app after the next sync.
- Given HP reaches 0, then on next app open I see the "You fainted" modal with what was lost.
- Given the job runs twice for the same user and day, then penalties are applied only once.

**F5. Hero screen and gear shop**

- Given I open the Hero tab, then I see my sprite with equipped gear, stats, gold, and the shop list with prices and unlock levels.
- Given I have enough gold and the level, when I tap Buy, then gold is deducted, the item moves to my inventory, and I can equip it. Items I cannot afford or have not unlocked show a disabled button with the reason.
- Equipping changes the sprite overlay and the stats immediately.

**F6. Stats screen**

- Given I open the Stats tab, then I see current streak, this month's completion rate, bosses beaten, a 12-week heatmap, per-habit completion rates for the last 30 days, and the sync status card.
- Every number is computed from local data, so the screen works offline.

**F7. Party and weekly boss**

- Given I have no party, when I open the Party tab, then I can create one (name, 3 to 24 characters) or join with a code.
- Given I am in a party, then I see the boss, its HP bar, each member's damage this week, the invite code, days left, and the battle log.
- Given a member completes a habit, then every other member's Party screen updates within 5 seconds while online (real-time), and on next sync while offline.
- Given the boss HP reaches 0, then every member sees a victory modal and gets the reward once.
- Given I leave the party, then my past damage stays on the boss but I stop appearing in future weeks.

**F8. Offline sync**

- Given I am offline, when I create, edit or complete habits, then changes are saved locally and the sync card shows "Offline, N changes waiting".
- Given the network returns, then changes upload automatically within 10 seconds, the card shows "Synced", and the server's authoritative character state replaces my local estimate.
- Given two devices edited offline, when both sync, then no completion is lost or duplicated (section 8 explains the rules).
- The Retry button on the sync card forces a sync now. Failed syncs retry with exponential backoff (2 s, 4 s, 8 s, up to 5 minutes).

**F9. Reminders**

- Given a habit has a reminder time, then a local notification fires at that time on scheduled days, works offline, and is cancelled if the habit is completed or deleted.
- Given I deny notification permission, then the app keeps working and shows a one-time hint in Settings.

**F10. Settings and account**

- I can change hero name, time zone, and a global "Reduce motion" override, sign out, and delete my account and all data (confirmation required; the server deletes everything).
- A link to the privacy policy (a plain page in the repo's `docs/`) is shown.

**F11. Demo mode for recruiters**

- A "Try the demo" button on the sign-in screen opens a pre-filled local-only hero with sample habits and a fake party. No account is needed. Data is stored locally and never synced. This lets a hiring manager try the app in 10 seconds.

### Stretch (design for it, do not build until MVP is done)

- S1. Home-screen widget to check off today's habits
- S2. Streak freeze item
- S3. Class perks (mechanical differences)
- S4. AI quest master that suggests habits from a goal
- S5. Push notifications for party events (boss defeated, member needs help)
- S6. Achievements and badges
- S7. Apple and Google sign-in
- S8. "x times per week" habit schedule
- S9. Export my data as JSON

## 5. UI and design spec

**Look and feel:** a cosy, dark pixel-art RPG. Deep purple-navy backgrounds, a pixel font for headings and numbers, a clean sans-serif for everything else, chunky 2 px borders, flat colours with no gradients or shadows. Colour carries meaning: gold is rewards, teal is XP and success, red is HP and danger, green is the boss, orange is streaks, purple is the hero.

The four main screens are designed in the canvas "Habit RPG Screens" (390 x 844 reference size). This section reproduces all values so you do not need the canvas. Where the canvas lacks something the stories need (add button, invite code, modals), this document specifies it and marks it **(new)**.

### 5.1 Design tokens

**Colours (dark theme only for MVP; set the status bar to light)**

| Token | Hex | Used for |
| --- | --- | --- |
| `bg` | `#14121F` | Screen background |
| `surface` | `#1F1C2E` | Cards, habit rows |
| `surface-2` | `#2A2640` | Sprite tiles, stat chips, empty heat cells, avatars |
| `surface-nav` | `#1A1727` | Tab bar, completed rows |
| `border` | `#2E2A44` | Card borders, bar tracks |
| `border-strong` | `#3A3554` | Disabled and dashed borders, secondary buttons |
| `checkbox-idle` | `#5E5878` | Unchecked checkbox border |
| `text` | `#F2EEE3` | Primary text |
| `text-soft` | `#C9C4DB` | Battle log, locked item names |
| `muted` | `#A8A2BD` | Secondary text (passes 4.5:1 on all surfaces) |
| `gold` | `#F2B84B` | Titles, rewards, active tab, primary buttons (pressed: `#FFD27A`) |
| `teal` | `#4FD1B5` | XP, success, done state, synced |
| `red` | `#F0626A` | HP, danger, boss attacks |
| `orange` | `#F08A4B` | Streak |
| `purple` | `#8B7CF6` | Hero armour, your avatar (dark shade `#5B4FC4`) |
| `boss-green` | `#6EE7A8` | Boss HP fill (card bg `#1A2A22`, border `#2F5A42`, label `#9FD9B8`, track `#0F1F17`) |
| `bad-habit-border` | `#5A2E3A` | Border of "don't" quests |
| `heat-0..4` | `#2A2640`, `#2F5A4C`, `#3C8C72`, `#4FD1B5`, `#A6F2DE` | Heatmap levels |

Put these in `packages/ui/tokens.ts` and use them everywhere; no hard-coded hex values in screens.

**Typography**

- **Pixelify Sans** (500 and 700, SIL OFL licence, via `@expo-google-fonts/pixelify-sans`): screen titles 22/700 gold, hero and boss names 20/700, section titles 18/500, big numbers 24, rewards and prices 13 to 16.
- **Inter** (400, 500, 600, via `@expo-google-fonts/inter`): body 14, secondary 13, meta 12, tab labels and bar labels 11.
- Support Dynamic Type / font scaling up to 130% without clipping; rows grow in height and text wraps.

**Spacing, shape, targets**

- Screen padding: 20 horizontal; first content below the status bar (reference 56 including safe area); 16 gap between sections; 8 between list rows.
- Radii: hero card 16, cards 14, rows and chips 12, buttons 10, checkbox 4, bars 2 to 3, pills 999.
- Borders: cards and rows 2 px; pills 1 px. No shadows.
- Touch targets: at least 44 x 44. Habit rows are at least 58 tall.
- Tab bar: 84 tall including bottom safe area, 4 equal columns, icon 22 plus a 11 px label (the label is always visible).

### 5.2 Shared components (build these first in `packages/ui`)

| Component | Notes and states |
| --- | --- |
| `ScreenHeader` | Pixelify 22/700 gold title on the left; right slot for a pill or icon button |
| `SyncPill` | 1 px bordered pill, 8 px status square plus text. States: **Synced** (teal, "Synced · works offline"), **Syncing** (gold, "Syncing..."), **Offline** (gold, "Offline · N waiting"), **Error** (red, "Sync failed"). Tapping opens the Stats sync card |
| `StatBar` | Label + value row above a 10 px bar (track `border`, radius 2). HP red, XP teal. Fill width animates 300 ms ease-out. Always shows numbers, not only colour |
| `Chip` | 10 px coloured square + text, used for gold and streak |
| `HabitRow` | Full-width button, `accessibilityRole="checkbox"`. Parts: 26 px checkbox, name 14/500, meta 12 muted, reward on the right. States: **todo**, **done** (bg `surface-nav`, name muted with strike-through, reward reads "Done" in teal, checkbox gold with a pixel check mark), **bad-habit** (border `bad-habit-border`, reward in red), **not scheduled today** (hidden from Quests; shown in a collapsed "Later this week" group (new)) |
| `HeroSprite` | Renders class sprite plus gear overlays at a given pixel scale |
| `BossSprite` | Renders the current boss; defeated state is desaturated with a "Defeated" label |
| `BossCard`, `MemberRow`, `BattleLogLine` | See Party screen |
| `StatChip` | `surface-2` tile, label 12 muted over a Pixelify 16 value |
| `ShopItem` | 44 px icon tile, name 14/600, effect 12 muted, price/action button min 72 x 44. States: **buyable**, **too expensive** (outlined, disabled, caption "Need N more gold"), **owned** (button "Equip"), **equipped** (button "Equipped", teal outline), **locked** (dashed border, caption "Unlocks at level N") |
| `Heatmap` | 12 week-columns x 7 day-rows (Monday on top), 22 px cells, 4 px gap, radius 3, plus a Less/More legend. Levels by completions that day: 0, 1, 2, 3 to 4, 5 or more. Has one summary `accessibilityLabel` |
| `Button` | **Primary** (gold fill, `bg`-coloured Pixelify text), **Secondary** (2 px `border-strong`, transparent), **Ghost** (text only), **Danger** (red outline). All min 44 tall; disabled uses `border-strong` and `muted` |
| `BottomSheet`, `Modal`, `TextField`, `SegmentedControl`, `Toast` | Standard, themed with the tokens above |

**Sprites:** pixel art is stored as small palette-index matrices in `packages/sprites` and drawn with `react-native-svg` using `<Rect>` cells and `shapeRendering="crispEdges"`. Hero grid is 10 x 12 cells, boss grid is 12 x 8 cells, each cell 8 units. One matrix per class (Knight, Mage, Rogue), per gear overlay, and per boss (8 bosses). Add a test that every matrix has the right dimensions and only valid palette indices. The Knight and the Procrastination Slime in the canvas are the reference style: chunky, 3 to 5 colours each, one dark outline colour. Never import third-party art without recording its licence in `docs/ASSETS.md`.

### 5.3 Navigation map

Expo Router with a bottom tab bar of four tabs: **Quests** (home), **Party**, **Hero**, **Stats**. Active tab: gold icon and label, label weight 600. Inactive: `muted`.

```text
(auth)/sign-in            email, "Send code", "Try the demo"
(auth)/verify             6-digit code entry
(auth)/onboarding         3 steps: name, class, time zone
(tabs)/index              Quests
(tabs)/party              Party
(tabs)/hero               Hero
(tabs)/stats              Stats
modal/habit/[id]          Add or edit habit (bottom sheet)
modal/party/create        Create party
modal/party/join          Join with code
modal/settings            Settings (opened from the gear on Stats)
modal/level-up            Level-up celebration
modal/fainted             Fainted summary
modal/boss-victory        Boss defeated summary
```

Route guards: no session and not in demo mode goes to sign-in; session without a hero goes to onboarding.

### 5.4 Screen 1: Quests (home)

Top to bottom:

1. **Header:** "Quest Board" (gold title) and the `SyncPill`.
2. **Hero card** (`surface`, 2 px `border`, radius 16, padding 16): left a 104 x 120 sprite tile (`surface-2`, radius 12, sprite 80 x 96 at the bottom); right the hero name (Pixelify 20/700) and "Lv N" (12 muted) on one line, then the HP bar ("HP 42 / 50"), the XP bar ("XP 340 / 500"), then two chips: gold amount and "12-day streak".
3. **Section row:** "Today's quests" (Pixelify 18/500) on the left, "2 of 5 done" (13 muted) on the right.
4. **Quest list:** one `HabitRow` per habit scheduled today. Tap toggles done. Long-press or the accessibility action "Edit" opens the habit sheet.
5. **Add row (new):** a dashed `border-strong` row, min 58 tall, gold text "+ Add a quest", opens the habit sheet.
6. **Boss mini-card:** a link to the Party tab. Green square with "!", "Party boss: Procrastination Slime", a 6 px boss-green bar and "62% HP". Hidden if the user has no party; replaced by a "Start or join a party" card.

**Copy examples in the sample data:** "Drink 8 glasses of water (Daily, Easy)", "Code for 1 hour (Daily, Medium)", "30 min workout (Daily, Hard)", "Read 20 pages (Daily, Medium)", "No doomscrolling after 11pm (Bad habit, lose 8 HP if broken)".

**States**

| State | What the user sees |
| --- | --- |
| First launch, no habits | The hero card, then a friendly empty state: "No quests yet. Add your first one and start earning XP." with a primary button |
| All done | A teal banner above the list: "All quests done! See you tomorrow." plus a one-time confetti burst |
| Loading | None needed: data comes from local SQLite, so first paint is already complete. Show skeleton rows only if the database is still opening |
| Offline | Sync pill shows "Offline · N waiting". Nothing else changes |
| Completed habit | Row dims, strike-through, "Done" in teal, floating "+20 XP" and "+6 gold" rise from the row, XP bar animates |

The reward shown on an unchecked row is the **actual** XP this completion will give (including streak and INT bonus), recomputed locally.

### 5.5 Screen 2: Party

1. **Header:** party name (gold title) and "4 days left" (12 muted).
2. **Boss card** (bg `#1A2A22`, 2 px border `#2F5A42`, radius 16, centred, padding 20 x 16): label "WEEKLY BOSS" (12, uppercase, 1 px letter-spacing, `#9FD9B8`); sprite 144 x 96; boss name (Pixelify 20/700); a 14 px HP bar (track `#0F1F17`, 1 px border `#2F5A42`, fill `#6EE7A8`); under it "1,240 / 2,000 HP" on the left and "Every habit you finish = a hit" on the right (12, `#9FD9B8`).
3. **"Party damage this week"** card: one `MemberRow` per member: 32 x 32 avatar (radius 6, initials, a different colour per member, yours is purple), name (14), damage on the right (Pixelify, gold). Your row says "(you)". Sorted by damage, highest first.
4. **"Battle log"**: the latest 20 events, 13 px `text-soft`. Names of members who dealt damage are teal; the boss is red. Examples: "Mage Ravi finished "Read 20 pages" · 20 dmg · 2m ago", "The Slime hit Bard Jay for 8 · missed workout".
5. **Invite card (new):** "Invite code: K7M2QX" with Copy and Share buttons (share sheet).
6. **Leave party (new):** a Danger ghost button at the bottom with a confirmation dialog.

**States:** *No party:* two cards, "Create a party" and "Join with a code". *Boss defeated:* sprite desaturated, "Defeated!" label, a gold "Claim reward" button once, then a countdown to the next boss. *Offline or stale:* a muted banner "Showing last synced data (3 h ago)". *Real-time:* subscribe to the party's events channel while the tab is focused; a new damage event animates the HP bar and adds a log line at the top.

### 5.6 Screen 3: Hero

1. **Header:** "Your Hero" and the gold amount chip (12 px gold square, 14/600).
2. **Hero card** (padding 18): sprite tile 136 x 168 with the sprite at 110 x 132; name (Pixelify 20/700), "Level 7 Knight" (12 muted); a 2 x 2 grid of `StatChip`s: STR, INT, CON, LUCK. Tapping a chip opens a small tooltip with how that stat is gained and what it does.
3. **Helper text (12 muted):** "Body habits raise STR, Mind habits raise INT, Health habits raise CON. LUCK grows with your best streak."
4. **Gear shop:** section title "Gear shop", caption "Cosmetic only, no real money". A `SegmentedControl` **(new)** with "Shop" and "Owned". Items as `ShopItem`s (Oak Shield: "+2 CON · blocks 1 missed daily", 40 g; Wizard Hat: "+3 INT · 10% more XP from Mind habits", 75 g; Dragon Cape: "Unlocks at level 10", 200 g, locked). Buying shows a confirm toast with Undo for 5 seconds.

### 5.7 Screen 4: Stats (Adventure Log)

1. **Header:** "Adventure Log" and a gear icon button **(new)** (44 x 44) that opens Settings.
2. **Three tiles** in a grid: current streak (orange number), this-month completion rate (teal), bosses beaten (gold); Pixelify 24 over a 12 px muted label.
3. **Heatmap card:** title "Last 12 weeks", caption "habits done per day", the `Heatmap`, and the Less/More legend.
4. **"Quest completion":** up to 5 habits with the best and worst last-30-day rates; label left, percent right, 8 px bar (teal at 70% or more, gold below). Tapping a row opens that habit's detail with its per-habit streak.
5. **Sync card:** status dot (gold when offline), title "Offline · 3 changes waiting", subtitle "Saved on your phone. Syncs when you're back online.", and a secondary "Retry" button. When synced: "All synced" with the last sync time, and the button reads "Sync now".

### 5.8 Sheets and modals (new, not in the canvas)

| Screen | Content |
| --- | --- |
| Sign-in | Title, tagline "Turn your habits into an adventure", email field, primary "Send code", ghost "Try the demo" |
| Verify | 6-digit code field with auto-submit, "Resend in 30 s" |
| Onboarding | Step 1 hero name; step 2 three class cards (Knight, Mage, Rogue) each with its sprite; step 3 time zone with the detected zone and a "Change" link; progress dots; ends with a short "Your adventure begins" animation |
| Habit sheet | Name; `SegmentedControl` type (Daily, Weekdays, Don't); difficulty (Easy, Medium, Hard) with the XP/gold/HP numbers shown live; category chips; weekday picker (only for Weekdays); reminder time toggle and picker; Save, and for edits Archive and Delete |
| Level-up | Hero sprite hops, text "Level 8!", "HP restored, +25 gold", primary "Continue" |
| Fainted | Gentle tone: "You fainted! You lost 12 gold and your progress to the next level. Rest up and try again." with what was missed |
| Boss victory | Boss sprite fading out, "Procrastination Slime defeated!", "+50 gold", per-member damage list, "Claim" |
| Create party | Name field, "Create" |
| Join party | 6-character code field (uppercase, no I or O), "Join"; errors: "Code not found", "Party is full" |
| Settings | Hero name, time zone, Reduce motion (system / on / off), notification permission status, privacy policy, version, Sign out, Delete account (red, confirm with typing DELETE) |

### 5.9 Motion, haptics, sound

- Checkbox pop: scale 1 to 1.15 to 1 in 150 ms. Floating reward text: rise 24 px and fade over 600 ms. XP and HP bars: 300 ms ease-out. Level-up: sprite hop (2 frames), up to 30 pixel confetti particles for 1.2 s.
- Haptics (expo-haptics): light impact on complete, success notification on level-up and boss victory, warning notification on faint, selection tick on tab change.
- **Reduce Motion** (system setting or in-app override): no bouncing, confetti or hop; state changes are instant; keep haptics.
- No sound in MVP.

### 5.10 Accessibility checklist

- Every `HabitRow` reads like: "Code for 1 hour, daily, medium, plus 20 XP, not done" with `checked` state exposed. Icon-only buttons have labels.
- Colour is never the only signal: done rows also have strike-through and the word "Done"; bars always show numbers; sync state always has text.
- Heatmap and charts expose a text summary ("7 of the last 12 weeks had a streak of 5 days or more").
- Text contrast at least 4.5:1; focus order follows visual order; support VoiceOver and TalkBack; test at 130% font scale.

## 6. Architecture

&#91;embedded content: Habit RPG architecture · phone, server, shared rules\]

The screens only ever talk to the local database. A sync engine moves changes to and from the server in the background, and one shared rules library keeps the phone's guess and the server's answer identical.

**How one tap travels**

1. The user taps a habit. `game-core` computes the rewards. In a single SQLite transaction the app writes the completion, the updated hero, and an outbox row. A live query repaints the screen (under 100 ms, no network).
2. The sync engine sends the outbox in batches to the `sync` Edge Function whenever the network is up, the app returns to the foreground, or the user taps Retry.
3. `sync` verifies the user, inserts completions idempotently (the completion's UUID is the key, so retries never duplicate), recomputes the hero from the completion ledger using `game-core`, writes party damage if the user is in a party, and returns everything that changed since the phone's last cursor.
4. The app applies the server's changes in one transaction. The server's hero state replaces the local estimate.
5. A party damage row is inserted into Postgres; Realtime broadcasts it to the other members' phones, whose Party screen animates.
6. Every hour `pg_cron` calls `daily-tick`, which closes the day for every user whose local time just passed 03:00 and applies HP loss once.

**Key decisions**

- The app never queries Postgres directly. All reads and writes go through the local database and the `sync` function. This keeps security rules in one place.
- Game logic is TypeScript in `packages/game-core`, imported by the app and by the Edge Functions (Deno). Verify the current best way to share code with Supabase Edge Functions (import map or a build-time copy) and record it in `docs/DECISIONS.md`.
- Only the Supabase URL and publishable key are in the app. The service-role key exists only in Edge Function secrets.

## 7. Tech stack

Use these unless you find a strong reason not to. If you do, propose the change with the trade-off in `docs/DECISIONS.md` and ask before switching. **Always check the current official docs and pin the latest stable versions** at project start (Expo SDK, React Native, Drizzle, Supabase); do not rely on memory.

| Area | Choice | Why |
| --- | --- | --- |
| Language | TypeScript, strict mode | Shared types across app, game rules and server |
| App framework | React Native with Expo (managed workflow, development builds), Expo Router | One codebase for iOS and Android, file-based navigation, easy builds with EAS |
| Local database | `expo-sqlite` + Drizzle ORM (`drizzle-orm/expo-sqlite`, `drizzle-kit` migrations, live queries) | Offline-first source of truth with typed queries and reactive UI |
| Backend | Supabase: Postgres, Auth (email OTP), Realtime, Edge Functions (Deno, TypeScript), `pg_cron`, `pg_net` | One hosted service covers auth, database, live party updates and scheduled jobs; free tier is enough |
| Sync | Custom sync over one Edge Function (section 8) | The hard part is the portfolio value. Fallback if it takes too long: PowerSync |
| Shared rules | `packages/game-core` (pure TypeScript, no dependencies) | Same maths on phone and server; trivially unit-testable |
| Shared types | `packages/shared` with Zod schemas | One definition of API payloads, validated on both sides |
| UI state | Zustand (only for transient UI: modals, toasts, reduce-motion) | Tiny; everything persistent lives in SQLite |
| Forms | `react-hook-form` + `zod` | Habit sheet and onboarding validation |
| Animation | `react-native-reanimated`, `react-native-svg` (sprites), `expo-haptics` | 60 fps animations on the UI thread, crisp pixel art at any scale |
| Fonts | `@expo-google-fonts/pixelify-sans`, `@expo-google-fonts/inter` | Both under the SIL Open Font Licence |
| Dates and time zones | `date-fns` v4 with `@date-fns/tz` (or Luxon if simpler) | Correct local-date maths across DST; same library on Deno |
| Network status | `@react-native-community/netinfo` | Trigger sync when connectivity returns |
| Notifications | `expo-notifications` (local, scheduled) | Reminders that work offline; remote push is a stretch |
| Auth storage | `expo-secure-store` for the Supabase session | Tokens in the keychain, not plain storage |
| Lint and format | ESLint, Prettier, `commitlint`, `lint-staged` with `husky` (or `lefthook`) | Consistent code and commit messages enforced automatically |
| Unit and component tests | Vitest for `game-core` and `shared`; Jest (`jest-expo`) with React Native Testing Library for the app | Fast logic tests plus screen-level tests |
| Database and function tests | Supabase local stack (`supabase start`), pgTAP for Row Level Security, `deno test` for Edge Functions | Proves security rules and sync logic really work |
| End-to-end tests | Maestro flows | Simple YAML flows on a simulator; runs in CI |
| Monorepo | pnpm workspaces | Apps and packages in one repo. Follow the current Expo monorepo guide (hoisting and Metro config) |
| CI/CD | GitHub Actions; EAS Build, EAS Submit, EAS Update | Automated checks, store builds and over-the-air updates |
| Error reporting | Sentry (`@sentry/react-native`) free tier, optional | Crash visibility for the demo; no analytics or ad SDKs |

**Not using, and why:** Redux (no server state to manage; SQLite is the store), Realm and WatermelonDB (more lock-in; Drizzle on SQLite is simpler and portable), Firebase (document model fits this relational data poorly), any ad or tracking SDK (privacy and review risk).

**Accounts and costs for a portfolio launch:** Supabase free tier (check whether free projects pause after inactivity and add a weekly keep-alive ping if so), GitHub, Expo/EAS free tier, Sentry free tier. Optional: Apple Developer Program for TestFlight (paid, yearly) and Google Play Console (one-time fee). Without them, ship an Android APK through EAS internal distribution and an Expo Go or development-build link, plus the demo video.

**Environment variables** (document all in `.env.example`; never commit real values):

| Variable | Where | Secret? |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | App | No |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` (publishable key) | App | No (protected by Row Level Security) |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Function secrets only | **Yes** |
| `CRON_SECRET` | Edge Function secrets and the `pg_cron` job | **Yes** |
| `SENTRY_DSN` | App | No |
| `EAS_TOKEN`, `SUPABASE_ACCESS_TOKEN` | GitHub Actions secrets only | **Yes** |

## 8. Data model and offline sync

### 8.1 Server schema (Postgres, in `supabase/migrations`)

Use this as the starting point; refine column types as needed and keep migrations in version control. IDs are UUIDs created on the device (`expo-crypto` `randomUUID()`), so the phone can create rows offline without asking the server.

```sql
-- every synced table also has: server_seq bigint (set by trigger from one global sequence), updated_at timestamptz
create sequence sync_seq;

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  hero_name text not null check (char_length(hero_name) between 2 and 20),
  class text not null check (class in ('knight','mage','rogue')),
  timezone text not null,                       -- IANA name, e.g. 'America/Toronto'
  created_at timestamptz not null default now()
);

create table characters (                        -- server-owned, never written by the client
  user_id uuid primary key references profiles on delete cascade,
  level int not null default 1, xp_in_level int not null default 0,
  hp int not null default 44, gold int not null default 0,
  current_streak int not null default 0, longest_streak int not null default 0,
  last_closed_date date
);

create table habits (
  id uuid primary key, user_id uuid not null references profiles on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  type text not null check (type in ('daily','weekdays','bad')),
  difficulty text not null check (difficulty in ('easy','medium','hard')),
  category text not null default 'none' check (category in ('body','mind','health','none')),
  weekdays smallint not null default 127,       -- bitmask Mon=1 ... Sun=64
  reminder_time time, sort_order int not null default 0,
  archived_at timestamptz, deleted_at timestamptz,
  client_updated_at timestamptz not null, updated_at timestamptz not null default now()
);

create table completions (                       -- insert-only ledger of what the user did
  id uuid primary key, user_id uuid not null references profiles on delete cascade,
  habit_id uuid not null references habits, local_date date not null,
  completed_at timestamptz not null, category text not null,
  xp_awarded int not null, gold_awarded int not null, boss_damage int not null,
  is_late boolean not null default false, undone_at timestamptz
);
create unique index one_completion_per_habit_day on completions (habit_id, local_date) where undone_at is null;

create table day_closures (
  user_id uuid references profiles on delete cascade, local_date date,
  closed_at timestamptz not null default now(), hp_lost int not null, missed jsonb not null,
  primary key (user_id, local_date)               -- makes the nightly job idempotent
);

create table inventory (
  id uuid primary key, user_id uuid not null references profiles on delete cascade,
  item_id text not null, equipped boolean not null default false, purchased_at timestamptz not null,
  unique (user_id, item_id)
);

create table character_events (                  -- audit ledger; unique key makes every effect idempotent
  id bigint generated always as identity primary key, user_id uuid not null,
  kind text not null, ref_id text not null, xp_delta int, gold_delta int, hp_delta int,
  created_at timestamptz not null default now(), unique (kind, ref_id)
);

create table parties (
  id uuid primary key default gen_random_uuid(), name text not null, code text not null unique,
  creator_id uuid not null references profiles, timezone text not null, created_at timestamptz default now()
);
create table party_members (
  party_id uuid references parties on delete cascade, user_id uuid references profiles on delete cascade,
  joined_at timestamptz default now(), left_at timestamptz, primary key (party_id, user_id)
);
create unique index one_active_party_per_user on party_members (user_id) where left_at is null;
create table boss_weeks (
  id uuid primary key default gen_random_uuid(), party_id uuid references parties on delete cascade,
  week_start date not null, boss_key text not null, max_hp int not null, current_hp int not null,
  defeated_at timestamptz, unique (party_id, week_start)
);
create table party_events (                      -- published to Supabase Realtime
  id uuid primary key default gen_random_uuid(), party_id uuid references parties on delete cascade,
  boss_week_id uuid references boss_weeks, user_id uuid, kind text not null,  -- damage | boss_attack | victory | join | leave
  amount int, habit_name text, created_at timestamptz default now()
);
create table boss_claims (
  boss_week_id uuid references boss_weeks, user_id uuid references profiles, claimed_at timestamptz default now(),
  primary key (boss_week_id, user_id)            -- reward can be claimed once
);
```

**Row Level Security (mandatory, on every table):** enable RLS, then add policies so that `profiles`, `characters`, `habits`, `completions`, `day_closures`, `inventory` and `character_events` are readable only where `user_id = auth.uid()`. The client has **no write access** to `characters`, `day_closures`, `character_events`, parties, bosses or claims; writes to synced tables happen only through the `sync` Edge Function (service role, after it verifies the JWT). Party tables and `party_events` are readable only by active members of that party (use a `security definer` helper function `is_party_member(party_id)`). Write pgTAP tests that prove user A cannot read or write user B's rows.

### 8.2 Local schema (SQLite via Drizzle)

Mirror `habits`, `completions`, `inventory`, `characters`, `day_closures` and party read-models (`parties`, `members`, `boss_weeks`, `party_events`). Use text for UUIDs and ISO dates, integer 0/1 for booleans. Add local-only tables:

- `outbox` (`id` integer autoincrement, `table_name`, `row_id`, `op` upsert or delete, `payload` JSON, `created_at`, `attempts`, `last_error`)
- `sync_state` (`cursor` bigint, `last_sync_at`, `device_id`, `user_id`)
- `settings` (reduce-motion override, onboarding done, demo mode)

Every user action that changes synced data runs in **one SQLite transaction**: change the row, update the local hero estimate, and insert the outbox row. Use Drizzle live queries so screens update automatically.

### 8.3 Sync protocol

One endpoint: `POST /functions/v1/sync` with the user's JWT.

```jsonc
// request
{ "device_id": "uuid", "cursor": 1234, "app_version": "1.0.0",
  "changes": [ { "table": "completions", "op": "upsert", "id": "uuid", "data": { /* row */ }, "client_updated_at": "2026-10-19T21:04:11Z" } ] }

// response
{ "cursor": 1301, "has_more": false, "server_time": "...",
  "changes": [ { "table": "habits", "op": "upsert", "data": { /* row incl. server_seq */ } } ],
  "character": { /* authoritative hero state */ },
  "applied": ["uuid", "uuid"],
  "rejected": [ { "id": "uuid", "table": "completions", "reason": "duplicate | not_scheduled | date_out_of_range | insufficient_gold | invalid" } ] }
```

**Client algorithm:** (1) read up to 100 outbox rows in order; (2) send with the current cursor; (3) in one transaction apply `changes`, store the new cursor, replace the local `characters` row, delete outbox rows listed in `applied`, and handle `rejected` (roll back the local row and show a toast, for example "That purchase failed: not enough gold"); (4) if `has_more`, repeat; (5) on a network or 5xx error, keep the outbox and retry with exponential backoff (2 s, 4 s, 8 s, up to 5 min). Sync triggers: app start, return to foreground, connectivity regained, after every local write (debounced 2 s), and the Retry button. Use one in-flight sync at a time.

**Pull cursor:** a single global `server_seq` (from `sync_seq`, set by a trigger on every insert and update) is the cursor, not timestamps, so clock skew cannot lose changes. The server returns rows for this user where `server_seq > cursor`, ordered, with a page size of 500.

**Conflict rules**

| Data | Rule |
| --- | --- |
| `habits` | Last write wins per row, by `client_updated_at` (the server breaks ties by arrival order). A delete is a tombstone (`deleted_at`) and beats later edits |
| `completions` | Insert-only and idempotent by `id`, so retries never duplicate. Undo sets `undone_at`, which never goes back to null. If two devices complete the same habit on the same day, the earliest `completed_at` wins and the other is rejected as `duplicate` |
| `inventory` | Purchases are checked against the server's gold; `equipped` is last write wins. A purchase the server cannot afford is rejected and rolled back on the phone |
| `characters` | Server-owned. The client never sends it. The phone's local estimate is replaced by the server's value after every sync |
| Party data | Server-owned. Creating, joining and leaving a party need a network connection (show "You need to be online to do this" when offline). Boss damage reaches the party through the sync of completions |

**Server validation on every change:** the JWT matches `user_id`; the habit exists and belongs to the user; `local_date` is within \[today minus 2, today plus 1\] in the user's time zone; the habit was scheduled on that date; payload passes the Zod schema from `packages/shared`; maximum 200 changes per request.

**Authoritative hero:** the server applies each accepted change as an idempotent `character_events` row (unique on `kind, ref_id`) using `game-core`, updates `characters`, and updates party boss damage. A property test must show that replaying all events from zero reproduces the stored hero. Undo never reduces the level; XP is clamped at 0 in the current level.

## 9. Backend: functions, jobs and security

### 9.1 Edge Functions (TypeScript on Deno, in `supabase/functions`)

| Function | Called by | Auth | Purpose |
| --- | --- | --- | --- |
| `sync` | App | User JWT | Push changes, pull changes, return the authoritative hero (section 8.3) |
| `party` | App (online only) | User JWT | Actions `create`, `join`, `leave`, `claim_reward`. Returns the party read-model |
| `daily-tick` | `pg_cron` hourly through `pg_net` | `CRON_SECRET` header | Close days, apply HP loss, advance boss weeks |
| `delete-account` | App (Settings) | User JWT | Delete the auth user; cascades remove all rows |

Shared code (`game-core`, `shared` Zod schemas) is imported by these functions. Never trust the client: verify the JWT, re-validate every payload with Zod, and use the user id from the token, never from the request body.

### 9.2 Party rules (function `party`)

- **create:** name 3 to 24 characters; generate a unique 6-character code from letters A to Z (no I, O) and digits 2 to 9; store the creator's time zone; add the creator as a member; create this week's `boss_weeks` row.
- **join:** code lookup is case-insensitive; error `not_found` or `party_full` (4 members) or `already_in_party`; join adds a `join` event.
- **leave:** set `left_at`; add a `leave` event. If the last member leaves, delete the party after 7 days (cleanup in `daily-tick`).
- **claim\_reward:** only if the boss is defeated and the user has no `boss_claims` row; insert the claim and a `boss_reward` character event (+50 gold) in one transaction.
- Rate limit every action: at most 10 calls per minute per user (count in a small `rate_limits` table or use a documented Supabase approach; record the decision in `docs/DECISIONS.md`).

### 9.3 The nightly job (`daily-tick`)

`pg_cron` runs once an hour (minute 0). The function:

1. Finds users whose local time is at or past 03:00 and whose `characters.last_closed_date` is before yesterday (local). Handle several missed days in order if the job was down.
2. For each user and each unclosed day D: load habits scheduled on D (by weekday bitmask, not archived or deleted, created on or before D), find those with no active completion, and compute HP loss with `game-core` (gear blocks applied). Bad habits with no completion count as slips.
3. In one transaction: insert the `day_closures` row (the primary key makes a repeat a no-op), add `miss` character events, update streaks (zero completions that day resets the streak), apply fainting if HP reaches 0, and for party members insert `boss_attack` rows in `party_events` for the log.
4. Advances boss weeks: for each party whose local Monday 00:00 has passed and has no row for this week, insert a new `boss_weeks` row (next boss in the roster, `max_hp = 500 * active_members`).
5. Must be safe to run twice, or to run late. Test with: a user in `Pacific/Auckland` and one in `America/Los_Angeles`; the DST change days; a job outage of 3 days.

### 9.4 Boss damage on sync

When `sync` accepts a completion from a user in an active party, in the same transaction: lower `boss_weeks.current_hp` (never below 0), insert a `damage` row in `party_events` (this triggers Realtime), and if HP reached 0 set `defeated_at` and insert a `victory` event. An undone completion adds the damage back and inserts a correction event. Use `select ... for update` on the boss row so two members finishing at the same moment cannot corrupt HP.

### 9.5 Auth

Supabase Auth with email one-time code (6 digits). The app stores the session in `expo-secure-store` and refreshes tokens automatically; the local database stays usable if refresh fails offline. The default Supabase email sender has low rate limits; for the demo configure custom SMTP (for example Resend's free tier) and note this in the README. Sign-in with Apple or Google is a stretch feature.

### 9.6 Security and privacy checklist

- Row Level Security on every table, with pgTAP tests (section 13).
- No secrets in the app bundle or git history. Run a secret scanner in CI (for example gitleaks).
- Collect the minimum: email, hero name, time zone, habits and completions. No advertising or tracking SDKs. Habit names are personal, so never log them on the server.
- Account deletion removes all user data; party history rows that reference the user are removed or anonymised.
- A plain-language privacy policy in `docs/PRIVACY.md` (needed for store listings): what is collected, where it is stored, how to delete it.
- Basic abuse controls: payload size limits, 200 changes per sync call, per-user rate limits, no user-generated text shown to other users except hero name and party name (validate length and strip control characters).

## 10. Repository structure and conventions

```text
habit-rpg/
  apps/
    mobile/                      Expo app
      app/                       Expo Router routes ((auth), (tabs), modal)
      src/
        components/              app-specific components
        features/                quests/ party/ hero/ stats/ onboarding/ settings/
        db/                      schema.ts, client.ts, migrations/, queries/
        sync/                    engine.ts, outbox.ts, api.ts, backoff.ts
        lib/                     supabase.ts, time.ts, notifications.ts, haptics.ts
        stores/                  Zustand stores (UI state only)
      assets/                    fonts, icons, app icon, splash
      e2e/                       Maestro flows
      app.config.ts  eas.json
  packages/
    game-core/                   pure rules: rewards, levels, closure, boss, gear (+ tests)
    shared/                      Zod schemas and types for sync and party payloads
    ui/                          tokens.ts and shared components
    sprites/                     pixel matrices and SVG renderers
  supabase/
    migrations/                  SQL migrations (never edit a merged one)
    functions/                   sync/ party/ daily-tick/ delete-account/ _shared/
    tests/                       pgTAP tests (RLS) and Deno tests
    seed.sql  config.toml
  docs/
    SCOPE.md                     this document
    DECISIONS.md                 one entry per technical decision, with versions used
    ASSETS.md                    every third-party asset and its licence
    PRIVACY.md  ARCHITECTURE.md  DEMO.md (demo video script)
  .github/
    workflows/                   ci.yml, eas-build.yml, supabase-deploy.yml
    pull_request_template.md
  CLAUDE.md  README.md  .env.example  pnpm-workspace.yaml  commitlint.config.js
```

**Conventions**

- **Naming:** files in kebab-case, React components and types in PascalCase, functions and variables in camelCase, database columns in snake\_case. Path alias `@/` for `apps/mobile/src`.
- **Logic lives outside components.** Components render and call hooks; rules live in `game-core`; database access only through `src/db/queries`; network access only through `src/sync` and `src/lib/supabase.ts`.
- **Pure and testable:** `game-core` functions never call `Date.now()` or read the device time zone; they receive `now` and `timeZone` as arguments.
- **Errors:** never swallow errors. Sync failures are recorded in `outbox.last_error` and shown in the sync pill. Show friendly messages to users, log details in development only.
- **Types:** strict TypeScript, no `any` without a one-line reason, validate all external data (server responses and request bodies) with Zod.
- **Migrations:** every schema change is a new SQL migration plus a Drizzle migration; never edit one that is merged. Keep Postgres and SQLite schemas in step with a test that compares table and column names.
- **Accessibility lint:** enable `eslint-plugin-react-native-a11y`; interactive elements must have a role and a label.
- **Comments:** explain why, not what. Every non-obvious formula in `game-core` links to its rule in section 3 of this document.
- **Size limits:** keep files under about 300 lines and functions under about 50 lines; split when larger.
- **Dependencies:** prefer well-known libraries; justify each new dependency in one line in the pull request.

**`CLAUDE.md` (create it in Phase 0, under 150 lines):** project summary, stack, commands (`pnpm dev`, `pnpm test`, `pnpm lint`, `pnpm typecheck`, `supabase start`), folder map, the hard rules from section 1, the git rules from section 12, and the current phase. Update it at the end of every phase.

## 11. Development plan

&#91;embedded content: Build plan · 8 phases, about 10 weeks\]

Work through the phases in order. The app is fully usable offline in demo mode before any backend exists (end of P2), which keeps the risky sync work (P4) separate and testable. At the start of each phase: restate the task list, wait for my go-ahead. At the end: lint, type-check, tests and build pass, then summarise and stop.

### P0 Setup and tooling (about 3 days)

- [ ] Ask the Phase 0 questions (section 14) and record my answers in `docs/DECISIONS.md`
- [ ] Create the GitHub repo, protect `main`, add templates (section 12)
- [ ] pnpm workspace; Expo app (Expo Router, TypeScript strict) booting on iOS simulator and Android emulator; empty `packages/*`
- [ ] ESLint, Prettier, commitlint, `lint-staged` and hooks; Vitest and Jest each running one passing test
- [ ] GitHub Actions `ci.yml`: install, lint, type-check, test
- [ ] Supabase project created and local stack running (`supabase init`, `supabase start`); `.env.example`
- [ ] `CLAUDE.md`, `docs/DECISIONS.md` (with versions), `docs/ASSETS.md`

**Done when:** CI is green on `main`, the app boots on both platforms, and `supabase start` works.

### P1 Game rules, UI kit and sprites (about 1 week)

- [ ] `game-core`: constants, rewards, levels, HP and stats, streaks, day-close calculation, boss damage, gear, deterministic crit. Include a JSON file of **golden test vectors** that the Deno tests reuse later
- [ ] Unit tests including DST days, time zones far apart, level-up overflow, faint, undo clamping
- [ ] `packages/ui`: tokens, fonts, and every component in section 5.2 in all states, shown on a dev-only gallery screen
- [ ] `packages/sprites`: 3 hero classes, 6 gear overlays, 8 bosses as matrices, renderer, dimension tests

**Done when:** the gallery shows every component and state, and `game-core` has at least 90% coverage.

### P2 Local-only app (about 2 weeks)  covers F1 (demo mode), F2, F3, F5, F6, F9

- [ ] Drizzle schema, migrations and client; demo seed data
- [ ] Onboarding (name, class, time zone), tabs, route guards
- [ ] Quests screen, habit sheet, complete and undo, level-up and faint modals, local day-close on app open (demo mode only)
- [ ] Hero screen: stats, shop, buy, equip. Stats screen: tiles, heatmap, completion bars (SQL queries)
- [ ] Local reminders
- [ ] Tests: query tests, component tests for `HabitRow` and the habit sheet, Maestro flow "add habit, complete it, see XP"

**Done when:** the whole app works in airplane mode in demo mode, and the Maestro flow passes in CI or locally.

### P3 Backend and auth (about 1.5 weeks)  covers F1 (real sign-in), F4, F10

- [ ] Migrations for every table, triggers for `server_seq`, Row Level Security, pgTAP tests
- [ ] Email-code sign-in screens, session in secure storage
- [ ] `sync` function with validation and authoritative hero, tested with the golden vectors
- [ ] `daily-tick` and the `pg_cron` schedule; tests for time zones, DST and a 3-day outage
- [ ] `delete-account`
- [ ] CI runs `supabase start`, database tests and Deno tests

**Done when:** a scripted round trip passes, pgTAP proves RLS, and running `daily-tick` twice changes nothing the second time.

### P4 Offline sync engine (about 1.5 weeks)  covers F8

- [ ] Outbox row written inside every mutation transaction
- [ ] Engine: triggers, single in-flight sync, backoff, cursor, transactional apply
- [ ] Rejection handling with local rollback and a toast
- [ ] Sync pill and Stats sync card show real status
- [ ] Tests: engine unit tests against a fake server; integration test with two local databases against the local Supabase stack; network cut in the middle of a sync
- [ ] A dev-only screen showing the outbox, with "force sync" and "simulate offline"

**Done when:** the two-offline-devices test runs 50 times with random orderings and finds 0 lost or duplicated completions.

### P5 Party and bosses (about 1.5 weeks)  covers F7

- [ ] `party` function, party RLS, boss rollover in `daily-tick`, boss damage on sync with row locking
- [ ] Party screen with all states, create, join, leave, share invite
- [ ] Realtime subscription with a pull-on-focus fallback
- [ ] Boss victory and reward claim; trophies on Stats
- [ ] Tests: concurrent damage test on boss HP, pgTAP for party RLS, a Maestro flow for create and join

**Done when:** two accounts on two devices see each other's damage within 5 seconds, and defeating the boss pays out exactly once.

### P6 Polish and accessibility (about 1 week)

- [ ] All animations and haptics, Reduce Motion behaviour
- [ ] Empty, error and offline states on every screen
- [ ] Screen reader pass (VoiceOver and TalkBack) and 130% font scale pass
- [ ] Performance: cold start under 2 s, smooth list scrolling, memoised rows
- [ ] App icon, splash screen, store screenshots; Sentry

**Done when:** every item in section 5.10 passes and there are no console warnings.

### P7 Release and showcase (about 1 week)

- [ ] EAS build profiles (development, preview, production); internal distribution or TestFlight
- [ ] `README.md` (pitch, GIF, features, architecture diagram, sync explanation, run instructions, trade-offs, next steps), `docs/DEMO.md` and a 60 to 90 second demo video
- [ ] `docs/PRIVACY.md`; tag `v1.0.0` and publish a GitHub release with notes
- [ ] Portfolio write-up and three resume bullets (what, hard part, number)

**Done when:** a stranger can try the app in under 2 minutes using demo mode from a link or APK.

## 12. Git instructions

Recruiters read commit history, so keep it clean. Follow these rules for the whole project.

### 12.1 Rules Claude Code must follow

- **Never commit directly to `main`.** Every change goes through a branch and a pull request.
- **Never force-push, `git reset --hard`, `git clean -fd`, or rewrite shared history** without asking me first.
- **Never commit secrets,** `.env` files, keys, or build output. Check `git status` and `git diff --staged` before every commit; do not use `git add -A` blindly.
- **One task, one branch, one pull request.** Keep each under about 400 changed lines where possible; split larger work.
- **Every commit must build and pass lint and tests.** Commit small and often; each commit is one logical change.
- **Stop after opening the pull request.** I review and merge. Do not start the next task on top of an unmerged branch unless I say so.
- If a hook or CI check fails, fix the cause; never skip hooks (`--no-verify`) or disable the check.
- If your setup adds a `Co-Authored-By` trailer to commits, leave it in.

### 12.2 One-time repository setup (Phase 0)

```bash
git init -b main
# create .gitignore first (see below), then:
git add .gitignore README.md
git commit -m "chore: initialise repository"
gh repo create habit-rpg --private --source=. --remote=origin --push
```

In GitHub settings for `main`: require a pull request before merging, require the `ci` status check to pass, require branches to be up to date, block force pushes and deletions, allow **squash merging only**, and delete branches after merge.

`.gitignore` must include: `node_modules/`, `.expo/`, `dist/`, `build/`, `coverage/`, `ios/` and `android/` (if generated by prebuild), `.env`, `.env.*` with `!.env.example`, `supabase/.branches/`, `supabase/.temp/`, `*.log`, `.DS_Store`, `*.keystore`, `*.p12`, `*.mobileprovision`.

### 12.3 Branches

Short-lived branches off an up-to-date `main`, named `type/ID-short-description`:

```text
feat/F3-complete-habit        fix/F8-duplicate-completion
chore/p0-ci-pipeline          docs/p7-readme
test/p4-two-device-sync       refactor/game-core-streaks
```

### 12.4 Commit messages (Conventional Commits, enforced by commitlint)

```text
type(scope): imperative summary, 72 characters or fewer

Optional body: explain WHY, not what. Wrap at 100 characters.

Refs: F3
```

- **Types:** `feat`, `fix`, `test`, `refactor`, `perf`, `docs`, `chore`, `ci`, `build`.
- **Scopes:** `mobile`, `game-core`, `shared`, `ui`, `sprites`, `db`, `sync`, `party`, `supabase`, `ci`, `docs`.
- **Examples:**
  - `feat(game-core): add streak multiplier to reward calculation`
  - `fix(sync): ignore duplicate completion ids on retry`
  - `test(supabase): prove users cannot read other users' habits`
  - `docs: add sync conflict rules to ARCHITECTURE.md`
- A breaking schema change adds `!` and a `BREAKING CHANGE:` footer.

### 12.5 Daily loop

```bash
git switch main && git pull --ff-only
git switch -c feat/F3-complete-habit
# work in small steps; after each step:
pnpm lint && pnpm typecheck && pnpm test
git add <specific files>
git commit -m "feat(mobile): toggle habit completion with optimistic update"
# when the task is done:
git push -u origin feat/F3-complete-habit
gh pr create --fill --base main
```

After I merge, run `git switch main && git pull --ff-only` and delete the local branch. If `main` moved while you were working, rebase your **own** unmerged branch with `git fetch && git rebase origin/main`, resolve conflicts carefully, re-run the checks, then `git push --force-with-lease` (the only allowed force-push, and only on your own feature branch).

### 12.6 Hooks (husky and lint-staged)

- `pre-commit`: lint-staged runs ESLint and Prettier on staged files.
- `commit-msg`: commitlint checks the message format.
- `pre-push`: type-check and the fast unit tests.

### 12.7 Pull request template (`.github/pull_request_template.md`)

```markdown
## What and why
(2 to 4 sentences; link the story IDs, for example F3)

## Changes
- 

## How I tested it
- [ ] Unit tests added or updated
- [ ] Ran on iOS simulator / Android emulator
- [ ] Tested offline (airplane mode) where relevant

## Screenshots or GIF (for UI changes)

## Checklist
- [ ] Lint, type-check, tests and build pass
- [ ] No secrets or large binaries added
- [ ] Docs updated (DECISIONS.md, CLAUDE.md, README) if needed
- [ ] Accessibility checked (labels, contrast, touch targets)
```

### 12.8 Releases

Tag with semantic versions at the end of each phase on `main`: `v0.1.0` after P2 (local app), `v0.2.0` after P3, `v0.3.0` after P4, `v0.4.0` after P5, `v0.9.0` after P6, `v1.0.0` after P7. Create each tag with `git tag -a vX.Y.Z -m "..."` and publish a GitHub release whose notes list the stories completed.

### 12.9 If a secret is committed

Treat it as leaked: rotate the key immediately in Supabase, Expo or GitHub, then remove it from history (ask me first) and add a gitleaks check to CI if it is not there yet.

## 13. Testing, CI/CD and release

### 13.1 Test plan

| Layer | Tool | What must be covered | Target |
| --- | --- | --- | --- |
| Game rules | Vitest | Every formula in section 3, golden vectors, DST and far-apart time zones, level-up overflow, faint, undo clamping, deterministic crit | 90%+ coverage, all branches of formulas |
| Sync engine | Jest with a fake server | Outbox ordering, backoff, single in-flight sync, cursor handling, rejection rollback, network cut mid-sync | 80%+ |
| Database | pgTAP on the local Supabase stack | RLS: user A cannot read or write user B's rows; party rows only for members; client cannot write `characters` | Every table has at least one test |
| Edge Functions | `deno test` with the golden vectors | `sync` validation and idempotency, `party` rules, `daily-tick` idempotency and outage catch-up | All public behaviour |
| Components and screens | Jest + React Native Testing Library | `HabitRow` states, habit sheet validation, shop button states, empty states | Key components |
| End to end | Maestro (YAML flows) | Sign in with demo mode; add habit and complete it; buy and equip an item; offline completion then sync; create and join a party | Runs locally and on demand in CI |

**Tests that must exist (non-negotiable):**

1. **Two offline devices:** two local databases edit and complete offline, then sync in random order; assert zero lost or duplicate completions and identical final hero state. Repeat 50 times.
2. **Idempotency:** sending the same sync payload twice, and running `daily-tick` twice, changes nothing the second time.
3. **Replay equals state:** replaying all `character_events` from zero reproduces the stored hero (property test with random event sequences).
4. **Late sync:** a completion for a closed day, synced within 2 days, voids that day's penalty and awards XP without streak bonus.
5. **Time zones:** users in `Pacific/Auckland` and `America/Los_Angeles`, and the days when daylight saving starts and ends.
6. **Boss concurrency:** two members finishing at the same moment never push boss HP below 0 or lose damage.
7. **Security:** an expired JWT, a body with another user's id, and an oversized payload are all rejected.
8. **Reduce Motion:** animations are skipped when the setting is on.

**Manual QA checklist before each release:** airplane mode for a full day of use; kill the app in the middle of a sync; change the phone's time zone; change the phone's clock forward and back; sign in on a second device; deny notification permission; 130% font size; VoiceOver and TalkBack; low-end Android device.

**Performance budgets:** tap to updated UI under 100 ms (measure with a dev-only overlay); cold start under 2 s on a mid-range phone; syncing 500 changes under 3 s on a normal connection; lists scroll at 60 fps with 100 habits.

### 13.2 CI pipelines (GitHub Actions)

| Workflow | Trigger | Jobs |
| --- | --- | --- |
| `ci.yml` | Every pull request and push to `main` | Install with pnpm cache; lint; type-check; unit tests with coverage; secret scan (gitleaks); a second job starts the Supabase local stack, applies migrations, runs pgTAP and `deno test` |
| `eas-build.yml` | Tag `v*` | EAS build for the `preview` profile (internal distribution), upload artifacts |
| `supabase-deploy.yml` | Tag `v*`, manual approval | `supabase db push` and `supabase functions deploy` to the hosted project using stored secrets |
| `e2e.yml` | Manual (`workflow_dispatch`) and before release | Maestro flows on a simulator or emulator |

A pull request cannot merge unless `ci` is green. Cache dependencies to keep runs fast. Store all tokens in GitHub Actions secrets, never in the repository.

### 13.3 Release and distribution

- **EAS profiles:** `development` (dev client), `preview` (internal distribution: Android APK and iOS ad hoc or TestFlight), `production` (store builds). Use remote app version source with auto-incrementing build numbers.
- **OTA updates:** EAS Update for JavaScript-only fixes on a `preview` or `production` channel. Native changes need a new build.
- **Hosted backend:** create a separate Supabase project for production; never test against it. Apply migrations through the deploy workflow only.
- **Store readiness (optional):** app icon and splash, five screenshots, the privacy policy URL, and the data-safety answers (collected: email and user content; no tracking, no ads; deletion available in the app).
- **If no store account:** distribute an Android APK through EAS internal distribution, an Expo development-build link for iOS testers, and the demo video; mention this in the README.
- **Monitoring:** Sentry for crashes (no personal data in events); review Supabase function logs after each release. Do not log habit names or emails.

## 14. Risks, open questions and definition of done

### 14.1 Open questions (ask these in Phase 0, then record answers in `docs/DECISIONS.md`)

A recommended default is given for each, so work can continue if I answer "use the default".

| # | Question | Default |
| --- | --- | --- |
| 1 | App name and bundle identifier / package name | "Habit RPG", `com.<my-github-handle>.habitrpg` (ask for the handle) |
| 2 | Which devices do I have, and do I have an Apple Developer account? | Test on iOS simulator and Android emulator; ship an Android APK and Expo dev-build link |
| 3 | Sign-in methods for MVP | Email one-time code only; Google and Apple are stretch |
| 4 | Pixel art source | Draw sprites as code matrices (original); no third-party art |
| 5 | Supabase account and region; custom email sender (for example Resend)? | Closest region to me; set up custom SMTP in P3 |
| 6 | Repo visibility | Private until P7, public at `v1.0.0` |
| 7 | Hours per week I can spend and target finish date | About 15 hours a week, about 10 weeks |
| 8 | Should Claude Code merge its own pull requests after CI passes? | No: it opens the PR and I merge |

### 14.2 Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Custom sync is the hardest part and may take longer | Small protocol (section 8.3), golden test vectors, build it after the local app works (P4). Fallback: switch to PowerSync and document why |
| Time zones and daylight saving cause wrong penalties | Local dates not 24 h maths, a 3-hour grace period, idempotent closures, explicit DST tests |
| Phone and server disagree on game state | One shared `game-core`, deterministic crit, server is authoritative and replaces the local estimate |
| Expo with a pnpm monorepo and Metro can be fiddly | Follow the current Expo monorepo guide; prove the setup in P0 before writing features |
| Sharing TypeScript between the app and Deno Edge Functions | Decide the method in P0 (import map or build-time copy) and test it in CI |
| Supabase free tier limits (project pausing, email send limits) | Weekly keep-alive ping if needed, custom SMTP, document in the README |
| Sprite production takes too long | Code-drawn matrices, 3 classes and 8 bosses can start as recoloured shapes; polish in P6 |
| Scope creep | The stretch list is frozen until all MVP stories are done and CI is green |
| Looks like an existing app (Habitica) | Original names, art, copy and rules; record asset licences; position the project as offline-first and small |
| Cheating (clock changes, fake completions) | Server checks the date window and schedule; gold and boss damage are computed server-side; this is a personal app, so deeper anti-cheat is out of scope |
| Realtime updates drop | Fall back to pulling party data on focus and after every sync |
| App store review (privacy, account deletion) | In-app account deletion, privacy policy, no tracking SDKs |

### 14.3 Definition of done (whole project)

- [ ] All MVP stories F1 to F11 meet their acceptance criteria
- [ ] All tests in section 13.1 exist and pass; CI is green on `main`
- [ ] The app works in airplane mode for a full day and syncs correctly afterwards
- [ ] Row Level Security proven by pgTAP; no secrets in the repo or the app bundle
- [ ] Accessibility checklist (5.10) passes; cold start under 2 s; tap-to-UI under 100 ms
- [ ] Backend deployed to a production Supabase project; a build is installable by a stranger
- [ ] `README.md` has pitch, GIF, architecture diagram, sync explanation, trade-offs and run instructions; `docs/DEMO.md` and a 60 to 90 second demo video exist
- [ ] `docs/DECISIONS.md`, `docs/ASSETS.md`, `docs/PRIVACY.md` are complete; `v1.0.0` tagged and released

### 14.4 How to start the Claude Code chat

Save this document in the repo as `docs/SCOPE.md` (export it as Markdown from the document menu), open Claude Code in the empty repo folder, and send:

```text
Read docs/SCOPE.md completely. Then start Phase 0 exactly as section 1 and section 14.1 describe:
ask me your questions first, wait for my answers, then plan Phase 0 and wait for my go-ahead
before writing any code. Follow the git rules in section 12 for every change.
```
