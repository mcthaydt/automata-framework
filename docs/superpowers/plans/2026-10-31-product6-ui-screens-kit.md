# PRODUCT.6: the UI and screen kit, first set (TDD plan)

- **Row:** PRODUCT.6 in the framework's `docs/02-master-delivery-plan.md`; PRODUCT spec §5 (UI, Screens) and §6; ui spec §3.11 (the kit
  rule). Prerequisites PRODUCT.5e, PRODUCT.5d and PRODUCT.1b1: all merged (checked 2026-10-31 on main's `docs/02`).
- **Branch:** `claude/plus-PRODUCT.6-ui-screens-kit`, from main `4065924`; one PR, one commit per part.
- **Scope accepted:** the coordinator, 2026-10-31 (Owner: "everything is auto approved and accepted"): the kit is a copy-in set with
  Results new; Title, Pause, Settings, Loading and Error as thin compositions over core's primitives that duplicate no core logic and
  consume core's copy contracts.
- **Source (read-only):** the game UI source at its recorded extraction commit, for the results layout only. Its repository and commit go
  in the framework's `docs/provenance/sources.md` (an AF PR) and nowhere here.
- **Status:** built and locally checked (steps 1 to 7). CI verified, deployed and Owner accepted: not yet. Visual acceptance is recorded by the
  coordinator after it opens the committed images (`docs/evidence/owner-visual/product6-ui-screens-kit/`).

## What core already has (so the kit does not repeat it)

`@mcthaydt/automata-game` ships default Title, Paused, Play and Settings screens, with their words in `ScreensCopy` and layout tests at
every reference size. `@mcthaydt/automata-ui` ships `ScreenFrame`, `ActionBar`, `Button`, `Modal`, `ErrorPanel`, `LoaderOverlay`,
the focus model and the layout test harness (`@mcthaydt/automata-ui/testing`). `@mcthaydt/automata-testing` has `REFERENCE_SIZES`,
`VARIANTS` and `mountFixture`. A game that wants the defaults changes nothing. The kit is for the game that wants the source: it copies
screens it can edit (layout, order of actions, extra buttons) while core keeps the logic, the geometry and the words' types.

## Scope

In (`kits/ui-screens`, a private workspace package; the kit is copied into a game, so its files import only `@mcthaydt/automata-ui`,
each other by relative path, and `svelte`):

- **`kit.json`** per PRODUCT.5d: `name: "ui-screens"`, `requires.core` a range over the installed core, and `files` mapping each
  `src/...` file here to `src/screens/...` in the game (GL spec: a game's `screens/` folder).
- **`ResultsScreen.svelte`** (new). Props: `title`, `rows` (`{ id, label, value, detail? }[]`, shown in the order given, never
  re-ordered or ranked by the screen), `highlight?` (a row id), `actions` (1 to 3 `{ id, label, primary? }`), `copy`, `onAction`. The
  frame is `ScreenFrame` (stack on a short or narrow screen, split when wide); rows are a declared scroll region, actions stay outside
  it. First action is focused. Escape or the system back calls `onBack` when given. 44 px targets, 48 px primary.
- **`TitleScreen.svelte`**, **`PauseScreen.svelte`**, **`SettingsScreen.svelte`**: compositions of core's `ScreenFrame`, `Modal`,
  `ActionBar` and core's settings sections. They take their words from core's `ScreensCopy` (`@mcthaydt/automata-game` type, imported as
  a type) and their behaviour as callbacks. Pause: Resume (primary, focused), Settings, Quit with a confirm; Escape steps back one
  level. No save, leaderboard or reconnect logic: those stay core's default screen, and the kit says so in its README.
- **`LoadingScreen.svelte`** and **`ErrorScreen.svelte`**: `LoaderOverlay` and `ErrorPanel` inside `ScreenFrame`, with the slow-load
  label and the way-forward rule core's `ErrorPanel` already enforces.
- **`README.md`**: what is core's, what is the kit's, how to add and edit it.

Tests (all through `kits/ui-screens`):

- DOM (`*.test.ts`, jsdom, Testing Library): each screen's states, focus on mount, Escape and back, callbacks, no re-ordering of
  results, the copy is used (no raw text), an action list outside the scroll region.
- Layout (`*.layout.test.ts`, Chromium via `@vitest/browser-playwright`): every screen at every `REFERENCE_SIZES` entry (780x270
  included) and every variant, in English and the `xx-long` pseudo-locale: no document scroll, targets 44/48 px, nothing off screen or
  under the host strip, every essential action visible and hit-testable (core's `checkLayout`).
- Kit rule: the check-style kit rule (ui spec §3.11: no `{@html}`, no platform chrome, no host name written in) runs over
  `kits/ui-screens/src` as a Plus test (`tooling/boundary` runs core's rule from `.core/af` if it exports one; otherwise the same
  patterns are asserted in the kit's tests and the gap is logged in the execution log and sent to the coordinator).
- Manifest: `kit.json` parses with the same rules as the CLI's `kitManifestSchema` (relative `from`/`to`, no `..`, no `.git` or
  `node_modules` target, no duplicate destination); every `from` exists; every `to` is under `src/screens/`.
- Boundary: `tooling/boundary` scans `kits/*` too (a kit is Plus source importing core), so a deep core import in a kit fails.
- Copy-in proof: a test copies the kit to a temp game folder as `kit.json` says and type-checks and mounts the copied screens, so the
  kit works outside this workspace.

Out: lobby, room code, ready room (M7.9b), select screens, credits, photosensitivity warning, unlock banner (later kit sets); any
change to core; real-device testing (the Owner's).

## Decisions for the Owner's veto

- **UK-D1:** the kit is a thin, editable composition over core, not a fork of core's default screens (one contract owner). Default
  taken (accepted by the coordinator).
- **UK-D2:** `kits/` is a new top-level workspace folder (`pnpm-workspace.yaml` lists `kits/*`; the boundary test scans it).
- **UK-D3:** Results never orders or ranks: the caller passes rows in display order and the screen only shows them.

## Interfaces

- Produces: `kits/ui-screens/kit.json`; `ResultsScreen`, `TitleScreen`, `PauseScreen`, `SettingsScreen`, `LoadingScreen`,
  `ErrorScreen` and their `*Copy` types in `kits/ui-screens/src/screens/`.
- Consumes (core, public entries only): `@mcthaydt/automata-ui` (`ScreenFrame`, `ActionBar`, `Button`, `Modal`, `ErrorPanel`,
  `LoaderOverlay`, focus and geometry), `@mcthaydt/automata-ui/testing`, `@mcthaydt/automata-testing`,
  `@mcthaydt/automata-game` (types), `@mcthaydt/automata-content/locale` (pseudo-locale).

## Steps

- [x] 1. This plan (first commit); `kits/*` in the workspace and the boundary scan, failing test first.
- [x] 2. The kit package, `kit.json` and its manifest tests (red first), the copy-in proof skeleton.
- [x] 3. `ResultsScreen`: DOM tests red, then the component; layout test at all sizes and variants.
- [x] 4. `LoadingScreen` and `ErrorScreen`: DOM and layout tests, then the components.
- [x] 5. `TitleScreen`, `PauseScreen`, `SettingsScreen`: DOM and layout tests, then the components.
- [x] 6. Kit rule test, copy-in proof complete, README.
- [x] 7. Review images (expected/actual of each screen at three sizes) committed under `docs/evidence/owner-visual/product6-ui-screens-kit/`
  with a README; gates; PR; the AF provenance PR.

## Gates

Selected while iterating: the kit's unit and layout projects, `tooling/boundary`. At the end: `pnpm exec biome check --write`, `pnpm format`,
`pnpm check`, the kit's browsers project. Omitted: parity (no sim), changesets (private). Pending: Plus CI on the head; the
coordinator's visual acceptance. Owner gates: real-device testing of the kit screens.

## Execution log

- Step 1: the boundary test and manifest rules both failed first for `kits/` (they read only `packages/`, `tooling/` and `starters/`); both now
  cover `kits/*`, and `pnpm-workspace.yaml` lists `kits/*`.
- Step 2: `kit.json` is checked by the CLI's own `kitManifestSchema`, read from the framework checkout at core.ref (the `cli` package is
  private and not packed), so the manifest rules have one owner. It failed first on the missing screen file.
- Step 3 to 5: every DOM test failed first (the component did not exist). The layout contract's first run found real problems that
  shaped the screens: with the `xx-long` pseudo-locale the action bar collapsed to level 3 on narrow phones, so Results and Title take a
  `shortLabel` per secondary action (README says so); and a reconnect line above Pause's menu pushed the buttons out of reach at 780 x 270
  and TV scale, so it sits under the menu, as core's own default pause puts its save lines.
- Core finding (no change made, no stop needed): core's default Paused screen can put its reconnect line above the menu, and core's
  layout contract does not cover that variant. The same short-screen problem would show there. Reported to the coordinator.
- Settings is a mapping layer, not new presentation: core's `SettingsScreen` is already presentational and the sections' wiring lives in
  `@mcthaydt/automata-game` (not exported), so the kit maps core's `settings.screen` words onto it and takes the game's `tabs`.
- Step 7: opening the images found two defects, fixed before they were committed: the error screen's title sat under core's opaque error
  panel (the screen no longer has a title), and the loading screen's title was dimmed by core's overlay scrim (the frame now sits above
  the scrim). The Loading layout contract has no controls to check, so it passes without proving the title is visible; the images do.
- No sim, golden or published package is touched; no changeset. The AF provenance row goes in the framework's `docs/provenance/sources.md`.
