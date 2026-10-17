# PRODUCT: a free core you can scale on, and Automata Plus

> **Status:** reviewed. Drafted 2026-10-16; **approved by the Owner on 2026-10-16** with PD-1 to PD-5 (§11). Its contracts are frozen; changes are additive or go through a written change request. Each task still writes its TDD plan before code.
>
> **Why (Owner, 2026-10-16):** "I want to be at a point where someone can build FloorFifty using the automata framework with extensions (excluding content)." The framework splits into a free core and a paid plan that works like Tailwind's paid plan. The framework side should be as close to raylib in spirit as possible, the packages AF is built on should be explained, and the product is "a hybrid between those ShipFast website templates and raylib". Then: "let's make that extra stuff be paid; can't recreate FloorFifty without the paid stuff, but you should have a VERY solid foundation to make sure whatever you prompt next will scale well." Localization is part of that foundation. The Owner's biggest pain points building FloorFifty were UI, gamepad, mobile responsiveness, networking, post-processing and screens.
>
> This spec sits on top of the [DX spec](./2026-10-16-dx-small-games-ai-native-design.md), which makes small games small and the agent story true. PRODUCT decides what is free, what is paid, what is cut, and what the free foundation must guarantee.

## 0. Sources

| Source | Revision | Used for |
|---|---|---|
| FloorFifty, `SNEKPRTY/FloorFifty` | `ac72660` (`master`, committed 2026-10-13) | Feature inventory and line counts (§3, appendix A) |
| [Extraction map](./2026-10-11-core-and-extensions-extraction-map.md) | FloorFifty `122a220` | Which FloorFifty modules already map to AF core and extensions |
| AF `main` | `365f115` | What exists today (`packages/*/src`) |
| [Master spec](./2026-10-11-automata-framework-ruken-first-design.md) §5 placement rule, §12 D-2 and D-7 | — | The core/extension line; the business model recorded 2026-10-11 |

## 1. The product in one paragraph

**Automata core** is raylib for browser games on Ruken: free, MIT, on public npm. It has a small set of flat verbs, one import, a cheatsheet and a playable example per feature. It is complete enough to ship a single-player game and solid enough that an agent can keep adding to it without the code turning to mush (§2).

**Automata Plus** is the paid plan, in the shape of Tailwind Plus with a ShipFast flavor. It contains:
- the extensions (networking, post-processing, juice, music streaming, physics and the rest);
- copy-in UI and screen kits;
- complete starter games wired to Ruken.

FloorFifty is the measure: with core plus Plus, the Party Racer starter reproduces FloorFifty's game loop on placeholder content. With core alone, you get the foundation it stands on.

## 2. The free foundation: what "scales well" means

Each property has a check. A property without a passing check is not claimed.

| # | Property | Check | Task |
|---|---|---|---|
| F1 | **Every paid feature plugs into a public seam that user code can use too.** Core exposes the ports Plus uses: input profiles, a `NetworkPort` (remote commands in, authoritative snapshots out; the sim already takes commands and restores snapshots), audio buses, a render layer and post-filter slot, the settings schema, presentation-bus events, the host's leaderboard call, and `defineExtension`. | A boundary test in `automata-plus` fails on any import of a core path that isn't a public `exports` entry. Core's existing rule (core never imports an extension) also covers Plus. | PRODUCT.1 |
| F2 | **Determinism holds as the game grows.** Replays, goldens and the 200-seed property test exist (M2). Every generated game ships a golden test, so any prompt that changes behavior shows up as a golden diff, never as a silent change. | `create-game` output contains a golden test; `automata check` runs it (DX.5, DX.6). | DX.5 |
| F3 | **Conventions are enforced in the game, not only in AF.** `automata check` runs sim boundaries, style (role suffixes, kebab-case), typecheck, tests and the no-eval scan. Agent hooks run it after edits. | DX.6, DX.7 acceptance cases. | DX.6, DX.7 |
| F4 | **Agents know the real API.** The API index, skills and `llms` files are generated from the published `.d.ts`. | DX.4's drift test. | DX.4 |
| F5 | **Performance is measured, not assumed.** A frame-budget probe and a core stress example (N entities, M systems, views and UI), with budgets checked on the GPU runner. No Effect allocation per frame (ADR 0003). | The probe reports ms/frame from the actual build; the budget is set from the first measured run and recorded with its evidence. | PRODUCT.7 |
| F6 | **Contracts are versioned.** A public API report per core package is diffed on each release; a breaking change needs a major changeset and, from M8, a codemod. | A release check fails on an undeclared API break. | PRODUCT.1 |
| F7 | **Localization is built in, not bolted on** (§4). A new screen that breaks in a long language fails `automata check`. | PRODUCT.L acceptance cases. | PRODUCT.L |

**Where the F1 seams live (PRODUCT.1).** All are exports of a public `exports` entry, listed in `tooling/api-report/src/seams.ts` and checked against the committed reports by `seams.test.ts`. `runtime` `.`: `inputProfileSchema`, `InputProfile`, `actionsForKey`, `actionsForPadButton`; `NetworkPort`, `AuthoritativeSnapshot`; `AudioBuses`, `audioBusGainsSchema`; `settingsStore`/`SettingsDef`; `PresentationBus`, `RuntimeFacts`, `typedBus`; `runtime/extension`: `defineExtension`. `render-pixi` `.`: `PixiStage` (layers `backdrop`, `world`, `ui` and `postFilters`), `createPixiRenderer`, `createPostFilterSlot`, `filterPrograms`. `host` `.`: `Hosting.leaderboards` (`HostingLeaderboards`), relaying Ruken's `LeaderboardsApi` with the SDK's error codes; Ruken lacks nothing for it, so no Ruken request was needed. `runtime` and `render-pixi` are not published yet; publishing them is PRODUCT.1b.

## 3. FloorFifty on AF: gaps by tier (content excluded)

FloorFifty at `ac72660`:
- four players, an authoritative Colyseus server and one deterministic Planck simulation shared by server and client;
- Pixi 8 and Svelte 5 on the client, Paraglide for i18n, hosted on Ruken.

Non-test TypeScript and Svelte, by area (appendix A):

| Area | Lines |
|---|---|
| Client, all of `apps/client/src` | 52,832 |
| of which systems (gameplay 8,914; render 7,536; netcode 2,197) | 19,834 |
| of which UI (components 11,604) | 19,165 |
| of which managers (audio 4,285; network 1,161) | 8,459 |
| of which screens | 3,154 |
| Server (`apps/server/src`; rooms 4,324) | 5,548 |
| Shared sim, replay, level, CPU (`packages/shared`) | 6,273 |
| Asset contract (fonts, palettes, asset manifest) | 8,729 |

"Content excluded" means the race rules, course generation, art, songs and characters stay the game's. Everything else must come from core, Plus, or a few lines of the game's own code.

Tier key:
- **Core:** free.
- **Plus:** paid.
- **Cut:** the game writes it; a gallery example shows how.

| Capability (FloorFifty source) | AF today | Gap | Milestone | Tier |
|---|---|---|---|---|
| Boot, no-eval, WebGL2, letterbox, canvas resolution, screens, veil, presentation bus, loading (`managers/app.ts`, `letterbox.ts`, `screen-manager.ts`, `veil.ts`, `load-meter.ts`) | `runtime`, `render-pixi` | — | M1 done | Core |
| Ruken lifecycle, saves, exit flush, analytics, session locale (`ruken/`) | `host` | — | M1 done | Core |
| Deterministic sim, seeded RNG, replay codec, stepper, state hash (`shared/replay`, `level/rng.ts`) | `sim`, `sim/replay`, `testing` | — | M2 done | Core |
| UI primitives, geometry owner, focus navigation (`ui/layout/`, `form-factor.ts`, `focus-nav.ts`) | `ui` (geometry, layout, focus, dialog, status) | Completion (§5) | M1 done, M4 | Core |
| Keyboard, gamepad, touch buttons, gestures (`managers/input.ts`, `gamepad-source.ts` 300, `touch-controls.ts`, `swipe-*.ts`) | — | `InputMap` (DX.2), input profiles (§5) | DX.2, M4 | Core |
| 2D camera: follow, bounds, shake (`gameplay/camera.ts`) | — | `camera2d` | **new** → M4 | Core |
| Graphics quality tiers, render targets (`quality.ts`, `quality-rebuild.ts`, `render-target.ts`) | filter shader helpers | Quality settings, filter slot (§5) | M4 | Core |
| Frame-budget probe (`playwright.config.ts` `frame-budget` projects) | — | Probe and stress example | **new** → PRODUCT.7 | Core |
| Audio buses, unlock, ducking, host gain (`audio/manager.ts`, `engine.ts`, `graph.ts`) | — | Core audio | M5 | Core |
| Localization: six languages, detection, formatting (`i18n/` 229, `tools/i18n`) | `content` locale keys, `host` locale | §4 | **PRODUCT.L** | Core |
| Saves with versions and migrations, settings over host storage | `runtime` settings with migration | Save migrations | M5 | Core |
| Font subsetting, atlas packing, glyph coverage (`asset-contract`, `tools/i18n/characters.ts`) | `content` preload, palette | Asset build | **new** → M5 | Core |
| Leaderboards (`ruken/scores.ts`, `score-boards.ts`) | — | Expose the Ruken SDK's `LeaderboardsApi` through `Hosting` | M5 | Core (no extension) |
| Multiplayer client: prediction, reconciliation, snapshot buffer, render clock, input lead (`systems/netcode/` 2,197, `colyseus-network.ts` 927) | — | `net` on core's `NetworkPort` | M7 | Plus |
| Authoritative server: rooms, input queue, tick scheduler, seats, room codes, lobby and ready, origin and rate-limit gates, drain (`apps/server/src`) | — | `server`, plus a server deploy target | M7 (deploy **new**) | Plus |
| Post-processing library: ten GLSL filters, stack guard (`render/filters/`, `filter-stack-guard.ts`) | — | `post-retro` | M3 (its 2D part moves earlier, PD-3) | Plus |
| Juice: hit-stop, trauma, squash, second-order motion, word pops, haptics (`gameplay/juice/`, 18 files; `haptics.ts`) | — | `feel` | M6 | Plus |
| Music: deck, streaming, menu stream, preloading (`audio/deck.ts` 689, `song-bridge.ts`, `menu-stream.ts`) | — | `audio-stream` | M5 | Plus |
| 2D physics (Planck, in `simulation/planck/`) | `packages/physics` (Rapier 2D/3D) | Moves to Plus (PD-1); the Party Racer ports to Rapier (PD-2) | M2 done | Plus |
| Translation workflow, extra font packs, language-first screen (`tools/i18n` catalogue, csv, review) | — | `i18n-extra` | PRODUCT.L | Plus |
| 56 screens and components (lobby, room code, ready room, HUD, countdown, results, pause, settings, photosensitivity warning, select screens, credits, unlock banner and so on) | — | UI and screen kit | PRODUCT.6 | Plus (kit) |
| CPU players (`shared/cpu`) | — | `server` bot-seat hook only | M7 | Cut |
| Unlocks and progression (`unlocks/conditions.ts`) | — | Example `examples/content/unlocks` | — | Cut |
| Replay viewer, video clip export (`systems/replay/`) | replay codec | — | — | Cut |
| Beat clock, music sync (`beat-clock.ts`, `song-timings.ts`) | — | Example on the audio clock | — | Cut |
| Parallax (`menu-parallax.ts`, `stage-layers.ts`) | — | Example on `camera2d` | — | Cut |
| Particles as a package (`sky-particles.ts`, `dust-pool.ts`) | — | Pixi's `ParticleContainer`; `feel` keeps a burst helper | — | Cut |
| Ops telemetry (`ops-telemetry.ts`, server endpoint) | `host` `track()` | — | — | Cut |
| Synth, voices (`audio/synth.ts`, `voices.ts`) | — | `audio-synth` (The Last Light path) | M6 | Later, off the FloorFifty path |
| Tutorial system (`systems/tutorial/`) | — | A coach-prompt screen in the kit | — | Cut |

**Why each cut.** Each is game-specific or only a few lines on top of core. A package for it would be a generic abstraction no second game needs (AGENTS.md: no speculative abstractions). Each becomes a raylib-style gallery example, so the "how" is still shipped.

**What core still needs, in order (PD-3):**
1. the §2 seams (PRODUCT.1);
2. localization (PRODUCT.L);
3. M4's input, display, camera and quality parts (§5);
4. M5's core audio, save migrations, asset build and leaderboards call;
5. the frame-budget probe (PRODUCT.7).

The Plus extensions on the FloorFifty path follow: `net` and `server`, `post-retro` (2D), `feel` and `audio-stream`. Then comes the Party Racer starter.

## 4. Localization (PRODUCT.L, core)

Ruken requires localization from `session.locale` of every game (master spec §5 placement rule), so it is core. Today `content` generates locale keys (`packages/content/src/locale/messages.ts`) and the Ruken `content.languages` field, and `Hosting.locale` reads the session locale (`packages/host/src/hosting.ts`). Nothing at runtime consumes them, and `ui`'s boot-failure copy notes "replaced by Paraglide keys in M5" (`packages/ui/src/status/boot-failure.ts`). PRODUCT.L takes localization out of M5 and does it first, extracted from FloorFifty `apps/client/src/i18n/` and `tools/i18n/` at `ac72660`.

**Core:**
1. **Messages.** Paraglide compiles the content compiler's locale keys into typed `t()` functions. This settles the open question in the master spec's `i18n-extra` row on FloorFifty's proven setup. A key missing from a declared language fails the content compile with `file:line:col`.
2. **Negotiation** (`detect.ts`, `strategy.ts`). The order is:
   1. Ruken `session.locale`;
   2. the saved setting;
   3. the browser's languages;
   4. the game's default.

   The result is known before first render. A runtime change is a presentation-bus event; the screen is not remounted, focus is kept, and the sim is untouched.
3. **Formatting** (`format.ts`): numbers, durations, ordinals and plurals through `Intl`.
4. **Document** (`document.svelte.ts`): `<html lang dir>` follows the locale. PRODUCT.L converts `ui`'s remaining physical left/right properties to logical ones and adds a right-to-left layout contract, so a right-to-left language lays out mirrored.
5. **Content.** Text fields in TOML content compile per locale. The sim stores keys, never strings, so content hashes and goldens don't change with language.
6. **Glyph coverage** (`characters.ts`). Each locale's character set feeds the font-subsetting asset build (M5), and a glyph missing from a shipped font fails the build.
7. **Pseudo-locale.** A generated `xx-long` locale: about 40% longer, accented, wrapped in brackets. Every `ui` primitive's layout contract also runs in it at every reference size, including 780×270. Clipping, overlap or a hidden action fails.
8. **`automata check`.** Adds missing and unused keys and glyph coverage. The pseudo-locale layout run is a GPU-runner lane.
9. **Language picker.** A core `ui` primitive and a settings key, so a player can always reach the setting.

**Plus (`i18n-extra`):**
- the translation workflow from `tools/i18n` (catalogue, CSV export and import, review status);
- agent-drafted translations marked unreviewed until a person approves them;
- extra font packs (CJK, Korean, a dyslexia-friendly face);
- the kit's language-first onboarding screen.

**Acceptance:**
- **L-a.** The core single-player example runs in English, one other language and `xx-long`, with no clipped, overlapping or unreachable element at any reference size.
- **L-b.** Under the fake host, a `session.locale` of `fr` shows French on the first rendered frame (no English flash).
- **L-c.** Switching language mid-screen keeps the screen, the focused element and the sim hash.
- **L-d.** Failure case: a key missing in `fr` fails the content compile with its path.
- **L-e.** Failure case: a glyph missing from the subset font fails the asset build.

## 5. The Owner's pain points: where depth goes

These six get the deepest work. Each lists what "done" means and the FloorFifty source it is extracted from.

| Pain point | Tier | Done means | Extract from |
|---|---|---|---|
| **Mobile responsiveness** | Core | Geometry owner and letterbox (exist), plus: safe area, Ruken `hostReserved` and scale hint, rotate and landscape gate, browser-bar and on-screen-keyboard changes without reclassifying or remounting, and touch-control overlay placement that never covers a required action. Layout contracts at every reference size, including 780×270. | `ui/form-factor.ts`, `height-tier.ts`, `viewport-tracking.svelte.ts`, `LandscapeGate.svelte`, `RotateHint.svelte`, `managers/letterbox.ts` |
| **Gamepad and all input** | Core | One Input service: keyboard, gamepad (hot-plug, deadzones, standard mapping), touch buttons, gestures as data, and rebinding saved in settings. Focus navigation on every screen, with one model for D-pad, keyboard and touch (extends `ui/focus`). Button prompts follow the active device. | `managers/gamepad-source.ts`, `input.ts`, `ui/focus-nav.ts`, `cursor-policy.ts`, `back-gesture.ts`, `touch-controls.ts`, `swipe-*.ts` |
| **UI** | Core primitives, Plus kit | Core adds Button, IconButton, Toggle, Slider, Chip, Modal, Sheet, Toast and the language picker to the existing primitives. Every one keeps 44 px targets and 48 px primary actions, with a fixture and a layout contract. Plus: the game component kit. | `ui/layout/*`, `ui/components/*` |
| **Screens** | Core flow, Plus kit | Core: flow (exists), plus screen transitions (veil), pause and resume on host events, back handling, and the screen template every kit screen is built on. Plus: title, main menu, settings, pause, results, lobby, room code, ready room, select, credits, photosensitivity warning, loading and error. | `screen-manager.ts`, `screens/screen.ts`, `veil.ts`, `render/transition-veil.ts` |
| **Networking** | Plus (`net`, `server`) | Rooms and matchmaking, room codes, lobby, ready and seats, the authoritative tick, input queue, client prediction and reconciliation over core's `NetworkPort`, snapshot buffer, render clock, reconnect, origin and rate-limit gates, drain, and a server deploy target. Bot seats as a hook. A two-client replay golden. | `systems/netcode/*`, `managers/network/*`, `apps/server/src/rooms/*`, `gate/*`, `drain.ts` |
| **Post-processing** | Core slot, Plus `post-retro` | Core: the filter slot, the GLSL + WGSL pair helper (exists), render targets, and quality tiers that drop filters on weak devices. Plus: the filter library (bloom, dither, palette lock, outline, CRT and LCD, and FloorFifty's ten filters made generic) with a stack guard. WebGL2 stays at parity with WebGPU. | `systems/render/filters/*`, `filter-stack-guard.ts`, `quality*.ts`, `render-target.ts` |

## 6. Automata Plus

Shaped like Tailwind Plus (one purchase, source you own, lifetime updates), with ShipFast's "the plumbing is done" starters.

| Part | Contents | Form |
|---|---|---|
| Extensions | `net`, `server`, `post-retro`, `feel`, `audio-stream`, `physics`, `i18n-extra`; later the M6 set on The Last Light's path | Packages with tests and demos |
| UI and screen kit | About 50 game screens and components on core `ui` primitives (§5) | Copy-in source |
| Look and feel packs | Filter stacks, palettes and LUTs; `feel` presets (FloorFifty's juice tuning made generic) | Copy-in source and content |
| Starters | **Party Racer** (FloorFifty's structure: lobby, room codes, four-player net race, results, leaderboards); **Platformer** (single player, levels, saves); **Arcade** (score attack, leaderboard). Each is wired to Ruken publish, settings, localization and analytics, with placeholder content. | Cloneable game repo |
| Agent packs | Skills that drive the extensions and kits ("add a lobby", "add a results screen") | Skills |

**Delivery (until M10):**
- Plus lives in a private repo, `mcthaydt/automata-plus`.
- Extensions publish to a private registry (GitHub Packages, the M2.4 setup).
- Kits and starters are copied by `npx automata add <kit>`, which reads the repo with the buyer's own git credentials.
- Access is granted on purchase.
- Plus code carries a commercial license; core stays MIT.
- Pricing, the store and license enforcement stay in M10 (D-7).
- No license check runs inside a game bundle. Ruken's CSP and the no-eval rule make that both unsafe and unnecessary.

**Physics moves now.** `packages/physics` and `examples/physics/bodies-2d` move to `automata-plus` before DX.11's first public publish. Nothing has been published yet, so no published package is withdrawn. This touches:
- the consumer smoke's physics step;
- `check-boundaries`' physics import entries;
- the release list test (`tooling/release/src/release-list.test.ts`).

Each moves to Plus or is replaced by a core-only equivalent in PRODUCT.5.

## 7. raylib spirit (core)

| raylib | AF core |
|---|---|
| One header, `raylib.h` | One import, `@mcthaydt/automata`: a core umbrella re-exporting `game` and the common verbs. Plus extensions are separate imports. |
| Flat verbs, few concepts | `startGame`, `keys`, `rect`, `sprite`, `text`, `sound`, `music`, `camera2d`, `tween`, `t` |
| Immediate drawing (`DrawRectangle`) | A read-only `draw(ctx)` layer for HUD, debug and prototypes. It reads state and never writes the sim (law 1). |
| The cheatsheet | One page grouped by module, generated from the API index (DX.4) |
| An example per feature | The gallery (raylib headers already enforced by `examples/gallery`): one file of 100 lines or fewer each, playable on the site beside its source |
| Modules | rcore → `game`/`runtime`/`host`/input · rshapes → views · rtextures → `sprite` · rtext → `text`/`t` · raudio → audio · raymath → `sim/math` · rlgl → `render-pixi` filters · raygui → `ui`. raylib's extras map to Plus (physac → `physics`). |

The ECS and determinism stay; the simplicity comes from defaults and verbs. Every verb is a thin layer over a public lower-level API the game can always drop down to.

## 8. What's inside: the libraries explained

A generated `docs/stack.md`, with versions read from the pins in `tooling/versions`. The website renders it on an `/inside` page (a DX.10-style restoration task). One card per library says:
- what it does in AF;
- why it was chosen;
- what AF adds on top;
- its license;
- which tier uses it.

| Library | Role in AF | Tier |
|---|---|---|
| PixiJS 8 | 2D rendering, WebGL2 by default, WebGPU opt-in (ADR 0002) | Core |
| Koota | The sim's ECS | Core |
| Effect | Runtime services, time, scopes, outside the sim (ADR 0003) | Core |
| Zod | Every schema | Core |
| Svelte 5 | UI primitives | Core |
| Paraglide | Compiled, typed messages (§4) | Core |
| smol-toml | Content files | Core |
| Ruken SDK | The host | Core |
| Vite, Vitest, Playwright | Build, unit and browser tests | Core |
| Rapier (deterministic-compat) | Physics, cross-engine deterministic | Plus |
| Colyseus | Rooms and transport for `net` and `server` | Plus |

The page also says why FloorFifty's Planck becomes Rapier: Rapier is already proven deterministic across Node, Chromium, WebKit and Firefox (M2.1), and one engine means one parity suite.

## 9. Ownership, flows and failure policy

| Artifact | Owner | Consumers |
|---|---|---|
| Core seams (§2 F1) and the public API reports | the owning core package; integration coordinates | Plus, games |
| Localization runtime | `runtime` (negotiation, `t()`), `content` (compile, glyph sets), `ui` (picker, pseudo-locale fixtures) | games, kits |
| `automata-plus` repo, registry and `automata add` | ship lane (registry, release); integration (`automata add`) | buyers |
| Kits and starters | `automata-plus` | buyers |
| `docs/stack.md` | ship lane (generated) | website |

**Flows:**
- **Buy and add:**
  1. The buyer gets repo access.
  2. They run `npx automata add lobby`.
  3. The CLI clones the kit at the buyer's installed core version.
  4. It copies the files.
  5. It runs `automata check`.
- **Extension install:** `npm i @mcthaydt/automata-net` from the private registry, then `defineExtension` registration in `startGame({ extensions })`.

**Failures:**
- `automata add` without repo access fails with the access message and changes no files.
- A kit whose required core version is newer than the installed one fails before copying, naming both versions.
- A Plus package importing a non-public core path fails the F1 boundary test.
- A paid capability is never silently replaced by a weaker free path (as with AGENTS.md's host-authority rule).

## 10. Tasks

| ID | Task | Lane | Depends on | Deliverable |
|---|---|---|---|---|
| PRODUCT.0 | This spec, reviewed | integration | — | Owner review |
| PRODUCT.1 | Core seams and API reports | integration (+ each owning lane) | PRODUCT.0 | §2 F1 ports, including `NetworkPort`; public API reports and the release break check (F6) |
| PRODUCT.L | Core localization | runtime, content, ui | PRODUCT.0 | §4 with acceptance cases L-a to L-e; M5's localization part points here |
| PRODUCT.2 | Umbrella import and `draw` layer | game | DX.2 | §7 |
| PRODUCT.3 | Cheatsheet | ship | DX.4 | §7, generated from the API index |
| PRODUCT.4 | Stack page | ship | PRODUCT.0 | §8, generated from the pins |
| PRODUCT.5 | `automata-plus` repo, private registry, `automata add`, physics move | ship, integration | PRODUCT.0; Owner creates the repo | §6; before DX.11's first publish |
| PRODUCT.6 | UI and screen kit (first set: settings, pause, results, title, loading and error) | ui | PRODUCT.1, M4 core parts | §5 |
| PRODUCT.7 | Frame-budget probe and core stress example | testing | PRODUCT.0 | §2 F5 |
| PRODUCT.8 | Party Racer starter | integration | `net`, `server`, `post-retro` 2D, `feel`, `audio-stream`, PRODUCT.6 | The acceptance case P-b below |

**Gaps added to existing milestones** (02 Master delivery plan):
- M4: `camera2d`, quality tiers and §5's input and display parts.
- M5: the asset build, save migrations and the leaderboards call.
- M7: the server deploy target and the bot-seat hook.

Per PD-3, M4, M5 and M7 no longer wait on M3, and `post-retro`'s 2D part moves ahead of M3.

**Acceptance:**
- **P-a.** The core stress example and a core-only single-player game pass `automata check` and the frame budget.
- **P-b.** The Party Racer reproduces FloorFifty's loop (create room, join by code, ready, countdown, four-player race, results, leaderboard) on placeholder content. Its game-specific code is measured against FloorFifty's baseline (appendix A), and the target is set when the starter's plan is written.
- **P-c.** The F1 boundary test passes for every Plus package.
- **P-d.** Failure case: a deep core import from a Plus package fails P-c's test.

## 11. Owner decisions (decided 2026-10-16)

| ID | Decision | Follow-up |
|---|---|---|
| PD-1 | **Tiers.** Core is free (MIT, public npm) and is the foundation. Automata Plus is paid and holds every extension, the kits and the starters. The line is AGENTS.md's: core is what Ruken requires of every game or what both reference games need. This keeps the 2026-10-11 model (00 Overview) and adds kits and starters. | D-7 keeps pricing, the store and license enforcement (M10). |
| PD-2 | **Physics.** Rapier only; the Party Racer ports FloorFifty's Planck race onto Rapier 2D. Physics is an extension, so it is Plus. | PRODUCT.5 moves it before the first public publish. |
| PD-3 | **Order.** Foundation first (PRODUCT.1, PRODUCT.L, the core parts of M4 and M5, PRODUCT.7), then the Plus extensions on the FloorFifty path, then the Party Racer. M3 continues on its own thread and no longer gates the 2D path. | 02 prerequisites updated. |
| PD-4 | **Localization is core** (§4); the translation workflow and extra fonts are Plus. | PRODUCT.L |
| PD-5 | **Depth and cuts.** The Owner's pain points (UI, gamepad, mobile responsiveness, networking, post-processing, screens) get the deepest work (§5). CPU players, progression, the replay viewer and clip export, the beat clock, parallax, a particles package, a leaderboards extension, extra telemetry and a tutorial system are cut to examples or hooks (§3). | — |

## Appendix A. How the FloorFifty counts were produced

On a clone of `SNEKPRTY/FloorFifty` at `ac72660`:

```sh
for d in apps/client/src/* apps/client/src/*/* apps/server/src/* packages/shared/src/* packages/*/; do
  [ -d "$d" ] && echo "$(find "$d" -name '*.ts' -o -name '*.svelte' | grep -v test | xargs cat 2>/dev/null | wc -l) $d"
done | sort -k2
```

Totals for `apps/client/src` and `apps/server/src` use the same `find` over the whole folder. Counts are non-test `.ts` and `.svelte` lines, including comments.
