# DX.2d: the default screens' words in the game's language TDD plan

- **Row:** `docs/02-master-delivery-plan.md` DX.2d (follow-up found in DX.2). Lane **game**; PD-4 localization. Prerequisite PRODUCT.L3a (merged, #210 `d5bf155`). Size M. Unblocks GAME-3D.1a part 2.
- **Spec:** PRODUCT spec `docs/superpowers/specs/2026-10-16-product-core-and-plus-design.md` §4 (items 1, 2 and 7; acceptance L-a and L-c); DX spec §7 (the default screens); M4 spec §4.8 (Settings copy); M5 spec §4.8 (saves and board copy).
- **Status:** drafted 2026-10-31. **Progress:** 0 of 8 steps.
- **Branch:** `claude/dx-2d-screen-copy`, from `main` at `c9952bf`.

## What is there today

- English literals in `packages/game/src/screens/`: `TitleScreen.svelte` (Play), `PlayScreen.svelte` (the corner button's `aria-label="Pause"`), `PausedScreen.svelte` (Paused, Resume, Back, Mute/Unmute, Settings, Quit to title, the quit prompt, Cancel), `default-screens.ts` (`BOARD_COPY`), `screen-kit.ts` (`PAD_UNSUPPORTED`), and the constants in `settings-copy.ts` (seven ui copy records plus `SETTINGS_COPY`) and `saves-copy.ts` (slots, status, changed-elsewhere, the toast).
- `GameSpec.copy` is `GameDefinition['copy']`: the runtime's boot and failure copy only.
- The runtime binds Paraglide to the `Locale` service (`packages/runtime/src/locale/paraglide.ts`): a game's compiled `m.key()` and `createT(m)`'s `t('key')` read `Locale.current` on each call, and `Locale.subscribe` reports each change (PRODUCT.L1/L2).
- PRODUCT.L3a gives `pseudoLocalize`, `hasRawText` and `PSEUDO_LOCALE` (`xx-long`) in `@mcthaydt/automata-content/locale`, and ui's fixtures run their layout contract in it (`packages/ui/src/testing/locale-fixture.ts`).

## Design

- **One record.** `ScreensCopy` (`packages/game/src/screens/screens-copy.ts`): `title.play`; `play.pause`; `paused.{title, resume, back, mute, unmute, settings, quit, quitPrompt, quitConfirm, cancel}`; `settings.{screen, prompts, controls, language, vibration, audio, touch, display}` (the existing ui copy types); `saves.{slots, status, changedElsewhere, changedElsewhereToast}`; `board` (`LeaderboardCopy`); `padUnsupported`. `DEFAULT_SCREENS_COPY` holds today's English words unchanged, so nothing on screen changes for a game that sets nothing.
- **Overrides.** `ScreensCopyOverrides` is a deep partial of `ScreensCopy` whose leaves are the record's strings and functions. `ScreensCopyInput` is an overrides object, or a function of the locale returning one, so a Paraglide game writes `screens: () => ({ title: { play: m.play() } })` or uses `t`.
- **Where it goes.** `GameSpec.copy` widens to `GameCopy = GameDefinition['copy'] & { readonly screens?: ScreensCopyInput }`. `defineGame` strips `screens` before the runtime's definition (the runtime's copy type is unchanged) and hands it to `defaultScreens` as `ScreensGame.copy`.
- **Served live.** `screensCopy(input)` (`screens-copy.svelte.ts`) is an Effect over `Locale` in the screen's scope: a `$state` holder `{ current }` resolved for `Locale.current` and re-resolved on each `Locale.subscribe` call, released with the screen. The screens read `copy.current…` in markup, so a language change re-renders the words without a remount and keeps focus (L-c).
- **`xx-long`.** `pseudoScreensCopy()` (test helper) maps every string, and every function's result, through `pseudoLocalize`. `screens.layout.test.ts` runs each default screen in it at every reference size, and fails on any text `hasRawText` finds outside `xx-long`, except text printed on a device (keys and pad buttons, as ui's `findUntranslated` does).

## Interfaces

- **Consumed:** `Locale` (`@mcthaydt/automata-runtime`); `GameDefinition['copy']`; the ui copy types (`PromptCopy`, `ControlsCopy`, `LanguageCopy`, `VibrationCopy`, `AudioCopy`, `TouchCopy`, `DisplayCopy`, `SaveSlotsCopy`, `SaveStatusCopy`, `LeaderboardCopy`); `pseudoLocalize`, `hasRawText`, `PSEUDO_LOCALE` (`@mcthaydt/automata-content/locale`, a new **dev** dependency of game).
- **Produced (public, `@mcthaydt/automata-game`):** `ScreensCopy`, `ScreensCopyOverrides`, `ScreensCopyInput`, `GameCopy`, `DEFAULT_SCREENS_COPY`; `GameSpec.copy: GameCopy`.

## Files

- **Create:** `packages/game/src/screens/screens-copy.ts`, `screens-copy.svelte.ts`, `screens-copy.test.ts`, `pseudo-copy.ts` (test helper, not exported).
- **Modify:** `TitleScreen.svelte`, `PlayScreen.svelte`, `PausedScreen.svelte`, `SettingsView.svelte`, `settings-screen.svelte.ts`, `saves-title.ts`, `saves-paused.ts`, `screen-kit.ts`, `default-screens.ts`, `settings-copy.ts` and `saves-copy.ts` (become the defaults' parts), `define-game.ts`, `index.ts`, `default-screens.test.ts`, `screens.layout.test.ts`, `define-game.test.ts`, `packages/game/package.json` (dev dependency), `etc/` API report, the agent skills, a changeset.

## Steps

- [ ] **1. The record and its defaults.** Test first (`screens-copy.test.ts`): `DEFAULT_SCREENS_COPY` holds exactly today's words (each part equals the constant it replaces); `resolveScreensCopy(overrides)` deep-merges a partial over the defaults, a function leaf replaces a function leaf, and an absent input gives the defaults. Then `screens-copy.ts`.
- [ ] **2. Live over `Locale`.** Test first: with a fake `Locale`, `screensCopy(fn)` calls `fn` with the current locale, re-resolves on a change, and stops listening when its scope closes. Then `screens-copy.svelte.ts`.
- [ ] **3. Title, play and paused.** Test first (`default-screens.test.ts`): a game with `copy.screens` overrides shows its Play, the corner button's label, and every paused word (menu, quit confirm, back); a locale switch while paused changes them without a remount and keeps the focused button. Then the three components and `default-screens.ts`.
- [ ] **4. Settings, saves, board and the pad notice.** Test first: overrides reach the Settings screen's groups, the save slots, status and changed-elsewhere step, the board and the unsupported-pad notice. Then the components and modules; `settings-copy.ts` and `saves-copy.ts` keep their exports as the defaults' parts (ui fixtures and tests that import them keep working).
- [ ] **5. `GameSpec.copy.screens`.** Test first (`define-game.test.ts`): `screens` reaches `defaultScreens` and not the runtime definition's `copy`, and the runtime's copy keys still reach the runtime. Then `define-game.ts` and the exports.
- [ ] **6. `xx-long` layout.** Test first: the layout contract fails when one word bypasses the copy (a planted literal). Then every default screen in `xx-long` at every reference size, including 780×270, with nothing untranslated, clipped, overlapping or unreachable; fix what it finds.
- [ ] **7. Generated files.** `pnpm build`, `pnpm api-report --update`, `pnpm api-index` (and `pnpm cheatsheet` if it says stale), `pnpm agent-skills --write` as asked; a patch changeset for `@mcthaydt/automata-game`.
- [ ] **8. Gates.** `pnpm format`; `TURBO_FORCE=true pnpm check`; `pnpm --filter @mcthaydt/automata-game test:parity` and `pnpm --filter @mcthaydt/automata-ui test:parity` (all three browsers); `pnpm changeset status --since=origin/main` and `node tooling/release/src/check-changesets.ts`; visual images of the changed screens in English and `xx-long`.

## Decisions for the Owner's veto (defaults taken)

- `GameSpec.copy` gains `screens` beside the runtime's keys rather than a new top-level `GameSpec.screensCopy`: one place for a game's words. The runtime's `GameDefinition['copy']` is unchanged.
- The input may be a function of the locale, so a Paraglide game passes its messages without the framework knowing its catalog.

## Execution log

- 2026-10-31: plan drafted at `c9952bf`.
