# M4: Input and display (milestone spec)

- **Status:** Owner-approved 2026-10-16, every open decision on its recommended default. Task **M4.0** in [02 Master delivery plan](../../02-master-delivery-plan.md). Nothing here is implemented before that review (01 Decomposition §5, [04 How we build](../../04-how-we-build.md)). Review freezes the contracts in §4; after that they change only additively or through a written change request. Open decisions M4-D1 to M4-D11 (§15) run on their recommended defaults until the Owner changes them.
- **Owner direction (2026-10-16):** "Draft M4.0 and M5.0, core parts first." Per the [PRODUCT spec](./2026-10-16-product-core-and-plus-design.md) PD-3, the free core comes first and the Plus parts after it. Gamepad and all input and mobile responsiveness are two of the Owner's six pain points (PRODUCT spec §5), so they get the deepest work here.
- **Depends on:** M1 (merged). It does not wait on M3 (PD-3). It consumes the PRODUCT.1 seams (input profiles, post-filter slot, settings schema) and DX.2's `InputMap` (§2.2).

## 0. Sources

| Source | Revision | Used for |
|---|---|---|
| AF `main` | `71c3410` | What exists (§2). Every "exists" cell was checked against `packages/*/src` at this commit. |
| PRODUCT.1 branch `claude/clever-pasteur-ujmu6e-product1` | `a42c58f` (pending review, not merged) | `InputProfile`, `inputProfileSchema`, `actionsForKey`, `actionsForPadButton` (`packages/runtime/src/input/input-profile.schema.ts`); `PostFilterSlot` (`packages/render-pixi/src/filter/post-filter-slot.ts`) |
| [DX spec](./2026-10-16-dx-small-games-ai-native-design.md) §3.3 | approved 2026-10-16 | `keys(command, bindings, options)` and `InputMap` (DX.2, not built yet) |
| [EX spec](./2026-10-16-examples-one-file-design.md) §6 | approved 2026-10-16 | One-file examples (`core-input-gamepad`, `core-camera-2d`) |
| FloorFifty, `SNEKPRTY/FloorFifty` | `ac72660` (local clone at `/home/user/floorfifty`, re-surveyed 2026-10-16) | Every extraction row in §4. The extraction map surveyed `122a220`; paths below were re-checked at `ac72660`. |
| Ruken SDK `@ruken/sdk`, vendored | RukenApp `b30d31b` ([`vendor/ruken/`](../../../vendor/ruken/README.md)) | `InputModePayload`, `DisplayMetricsPayload`, `FullscreenRes`, the gamepad poller (`createGamepadPoller` in the SDK bundle), `@ruken/manifest` `INPUTS` and `ORIENTATIONS` |
| [M1.6 ui spec](./2026-10-11-m1-ui-design.md) | — | What M1 deferred to M4 (§1 table: Split, OptionGroup, PagerDots, back gesture, page swipe, touch controls, cursor policy, pad guard, steer/page/adjust) |
| [M1.5 runtime spec](./2026-10-12-m1-runtime-design.md) §1, Q6 | — | Input deferred to M4; the landscape gate and fullscreen request deferred to M4 display policy |

The Last Light (`mcthaydt/PixiJS3D_Experiment_001`, `input.ts` `stickVector`, `swipeTurn`; `ui/access.ts`) is named by the extraction map but has no local clone in this environment. Its rows are marked "not re-surveyed" and must be read at its current commit before M4.1 and M4.3's plans are written.

## 1. Goal and boundaries

**Goal.** A game declares its actions once. The player can then play with keyboard, gamepad or touch on any form factor, rebind controls and see prompts for the device in their hand. Screens keep their focus, layout and essential actions through rotation, a compact height, the host's reserved strip, the on-screen keyboard and the browser's bars. A failure in any of these is a named state, not a silent fallback. The input × form-factor E2E matrix proves it under Ruken's fake host.

**Core first (all free, MIT):**
1. One `Input` service over keyboard, gamepad and touch, driven by input profiles (M4.1).
2. A gamepad source: standard mapping, radial deadzones, hot-plug, held-direction repeat, the handover mask, reserved buttons (M4.2).
3. Touch: on-screen buttons from the same bindings, and gestures as data (M4.3).
4. Rebinding saved in settings, device prompts and a core Controls settings section (M4.4).
5. Focus navigation completed across composed screens: steer, page, adjust, the pad guard, focus on screen change, back handling, cursor policy (M4.5).
6. The remaining `ui` primitives (M4.6).
7. Display policy: the landscape and rotate gate, fullscreen, the touch-overlay placement rule and the HUD layer (M4.7).
8. `camera2d` (M4.8).
9. Graphics quality tiers and render targets (M4.9).
10. The input × form-factor E2E matrix under the fake Ruken host (M4.10).

**Plus, after core (M4.11):** the `dev-tools` extension (evidence capture and promotion, worktree cleanup; master spec §4.1). It is dev-only and never in a game bundle. It moves to `mcthaydt/automata-plus` with PRODUCT.5.

**Exclusions:**
- Haptics and controller rumble: `feel` (Plus, M6). M4's Input exposes no rumble call; `feel` adds it through `defineExtension`.
- Post-processing filters: `post-retro` (Plus). M4 adds only the quality tiers that decide which slot owners run (§4.11).
- The language picker and localized prompt words: PRODUCT.L owns them. M4 prompts take their words from PRODUCT.L's `t()`.
- Copy-in screens (title, pause, settings in the kit's style): PRODUCT.6 (Plus). M4 ships a plain core Settings screen (M4-D8) so rebinding is always reachable.
- A second local player, split screen, keyboard-and-mouse aiming and pointer lock: not on either reference game's path.
- 3D cameras: `render-pixi3d` (M3, M9).

**Prerequisites:** PRODUCT.1 merged (input profile and post-filter slot) before M4.1 and M4.9 are planned; DX.2 merged (`InputMap`) before M4.1 is planned. M4.2, M4.5, M4.6, M4.7 and M4.8 depend on neither and can be planned first.

## 2. What already exists (verified at `71c3410`, not rebuilt)

### 2.1 On `main`

| Capability | Where | M4 does |
|---|---|---|
| Geometry owner: form factor, height tier, safe area (max of env, host), `hostReserved` strip, `scale` hint, visual-viewport inset, hidden browser bar, keyboard resize without reclassifying | `packages/ui/src/geometry/{geometry.ts,geometry-owner.svelte.ts,form-factor.ts,height-tier.ts}` | Consumes it. Adds no geometry field (§4.9) |
| Layout primitives: ScreenFrame, ActionBar, CornerControls, ScrollList, Dialog, LoaderOverlay, ErrorPanel, BootFailurePanel | `packages/ui/src/{layout,dialog,status}/` | Adds the rest (§4.8) |
| Focus navigation: DOM order, modal scoping, `move`/`confirm`/`back`/`recover`, `padKeyEvents` | `packages/ui/src/focus/focus-nav.ts` | Adds steer, page, adjust and the pad guard (§4.7) |
| Input method tracker (`keyboard`/`gamepad`/`touch`) | `packages/ui/src/browser/input-method.svelte.ts` | Fed by `Input.device` (§4.2) |
| Landscape gate classifier (`landscapeGate(inputs)`) | `packages/ui/src/browser/landscape-gate.ts` | Wires the screen and the fullscreen request (§4.9) |
| Reduced motion, device class, overscroll lock, page-gesture suppression, sleep when hidden | `packages/ui/src/browser/` | Consumes them |
| Letterbox, canvas resolution (`MAX_RESOLUTION` 2) | `packages/render-pixi/src/letterbox/` | Quality tiers cap the resolution (§4.11) |
| Filter-program helpers (GLSL + WGSL pairs) | `packages/render-pixi/src/filter/filter-programs.ts` | Consumes them |
| `Hosting.input`, `Hosting.display`, `Hosting.setFullscreen` | `packages/host/src/hosting.ts` | Consumes them; no host change |
| Settings over `Hosting.saves` with versions and migrations (`SettingsDef`, `readSettings`) | `packages/runtime/src/settings/` | Bindings and quality are settings fields (§4.5, §4.11) |
| `Time` with pause reasons `lifecycle` and `menu` | `packages/runtime/src/time/time.manager.ts` | Adds `input` (M4-D9) |
| UI slots `settings.sections`, `hud.overlay` (names only) | `packages/ui/src/slots/ui-slot.ts` | Renders them (§4.8, §4.9) |
| Layout assertions and `REFERENCE_SIZES` (18 sizes plus breakpoint boundaries, 780×270 included) | `packages/testing/src/layout/` | The matrix reuses them (§9) |
| Playwright projects for `base-2d` (Pixel 7 and 780×270) and `ui-primitives` | `playwright.config.ts` | The matrix adds projects (§9) |
| Emberwick's own input (`examples/base-2d/src/input/{keys,devices}.ts`, 128 lines with tests) | `examples/base-2d` | Replaced through DX.2's `keys()`; no M4 change |

### 2.2 Pending elsewhere (consumed, not redefined)

- **PRODUCT.1** (branch `a42c58f`): `InputBinding { keys, pad, touch }`, `InputProfile { id, bindings }`, `inputProfileSchema`, `actionsForKey`, `actionsForPadButton`, `STANDARD_PAD_BUTTON_MAX` (16); `PostFilterSlot` with `set(id, filters, order)`. M4 extends the binding additively (§4.1). It does not copy it.
- **DX.2**: `keys(command, bindings, options)` returns an `InputMap` that turns held keys into one command per tick (DX spec §3.3). M4 needs the `InputMap` to carry its default `InputProfile` and a pure `toCommand(held)`, so rebinding swaps the profile and never the command mapping. If DX.2 lands without them, M4.1 files a change request to the game lane rather than adding a second mapping.

**Not in AF anywhere:** gamepad reading, touch buttons, gestures, rebinding, prompts, cursor policy, back gesture, Split, OptionGroup, PagerDots, paged grids, Button, IconButton, Toggle, Slider, Chip, Modal, Sheet, Toast, `camera2d`, quality tiers, render targets.

## 3. Ownership

| State or artifact | Owner (package, folder) | Writers | Readers |
|---|---|---|---|
| Held actions per device, the active device, the active profile | `runtime` `input/` (`Input` service) | the keyboard, gamepad and touch sources inside `Input`; `Input.rebind` | the app loop (one sample per tick), `ui` prompts and focus, the game |
| Saved bindings | the game's settings record (`Settings`), field `input` | `Input.rebind`, `Input.resetBindings` | `Input` at boot and on change |
| Sim commands made from input | the game's `InputMap` (DX.2) | `InputMap.toCommand(held)` once per fixed step | the sim (law 1: only the sim changes gameplay state) |
| Focus | the DOM; `ui` `focus/` decides moves | `FocusNavigator`, called by `Input` (pad and keys) and by Flow on screen change | — |
| Gestures (swipe, flick) | `runtime` `input/gestures/` as pure trackers; `ui` `SwipeSurface` feeds pointer events | — | `Input` |
| Geometry | `ui` geometry owner (unchanged, single source of layout geometry) | the owner only | everything |
| Landscape gate state | `ui` `browser/landscape-gate.ts` classifier; runtime `display/` screen wiring | the runtime gate | Flow |
| Camera transform | `render-pixi` `camera/` | the camera, from read-only sim views | the renderer. Never the sim |
| Quality tier | the game's settings record, field `display.quality` | the Display settings section | `render-pixi` (resolution cap, slot owners), extensions |
| Render target (fixed-resolution composite) | `render-pixi` `target/` | the renderer | slot filters |
| E2E matrix projects and helpers | `testing` (`fake-gamepad`, touch helpers, matrix list); root `playwright.config.ts` through the ship lane | — | examples and games |

Laws kept: input reaches the sim only as commands sampled at a tick (law 1, law 6); no device, DOM or clock reaches `packages/sim`; presentation (camera, prompts, quality) observes and never writes sim state.

## 4. Contracts

### 4.1 Input bindings (additive to PRODUCT.1's `InputBinding`)

```ts
// packages/runtime/src/input/input-profile.schema.ts (PRODUCT.1), extended additively in M4.1
export interface InputBinding {
  readonly keys: readonly string[]          // KeyboardEvent.code (PRODUCT.1)
  readonly pad: readonly number[]           // standard-mapping buttons (PRODUCT.1)
  readonly touch: boolean                   // an on-screen button (PRODUCT.1)
  readonly stick?: readonly StickDirection[] // M4: 'left-up' | 'left-down' | 'left-left' | 'left-right' | 'right-…'
  readonly gesture?: readonly GestureName[]  // M4: 'swipe-left' | 'swipe-right' | 'swipe-up' | 'swipe-down' | 'flick-down' | 'tap'
  readonly required?: boolean               // M4: rebinding may never leave it unbound on a device it had
  readonly context?: 'play' | 'menu' | 'any' // M4: where the action is live; default 'play'
}
export const RESERVED_PAD_BUTTONS: readonly number[]  // M4-D3: [8, 16]
export const RESERVED_KEYS: readonly string[]         // M4-D3: ['Escape', 'Tab']
```

- `inputProfileSchema` gains the optional fields and one refinement: a reserved pad button or key in any binding fails the parse with the action named (M4-D3). This is a change request to PRODUCT.1's schema, raised before PRODUCT.1 merges so it lands without a breaking change.
- Menu actions are fixed and not part of a game's profile: `nav-up`, `nav-down`, `nav-left`, `nav-right`, `confirm`, `back`, `page-prev`, `page-next`, `adjust-dec`, `adjust-inc`, `pause`. Their default bindings come from FloorFifty `gamepad-source.ts` (`B` table, line 39) and the keyboard's arrows, Enter, Space and Escape. Only `pause` is rebindable (M4-D3).

### 4.2 `Input` service (`packages/runtime/src/input/input.manager.ts`)

```ts
export type InputDevice = 'keyboard' | 'gamepad' | 'touch'
export type GlyphFamily = 'xbox' | 'playstation' | 'generic'
export interface ActiveDevice { readonly device: InputDevice; readonly glyphs: GlyphFamily }

export interface Input {
  /** Actions held now, the union over devices. A plain function: the loop calls it once per fixed step (no Effect per frame, ADR 0003). */
  held(): ReadonlySet<string>
  /** Quantized stick vector for an analog action, each axis an integer in −127..127 (M4-D2). */
  stick(side: 'left' | 'right'): { readonly x: number; readonly y: number }
  /** Menu and UI actions as edges (pause, back, confirm): never sent to the sim. Returns the unsubscribe. */
  onPress(action: string, listener: () => void): () => void
  readonly device: Subscribable.Subscribable<ActiveDevice>
  readonly profile: Subscribable.Subscribable<InputProfile>
  readonly pads: Subscribable.Subscribable<readonly PadInfo[]> // connected standard-mapping pads
  rebind(action: string, device: InputDevice, capture: Capture): Effect.Effect<void, RebindError>
  readonly resetBindings: Effect.Effect<void>
  /** Waits for the next key or pad button (Escape or pad B cancels; `REBIND_TIMEOUT` 10 s on Effect's Clock). */
  capture(device: Exclude<InputDevice, 'touch'>): Effect.Effect<Capture, RebindCancelled | RebindTimedOut>
}
export const Input: Context.Tag<Input, Input>
export const InputLive: Layer.Layer<Input, never, Hosting | Settings | PresentationBus | Scope.Scope>
```

Rules:
- **Per-device bookkeeping** (FloorFifty `managers/input.ts` lines 42–60): each device holds its own set; a keyup on one never releases what another still holds. Losing window focus, `lifecycle` going to `background`, or a gamepad disconnecting releases that device's set.
- **Sampling.** The app loop calls `held()` and `stick()` once per fixed step and passes them to `InputMap.toCommand`. Edge-triggered gameplay ("jump pressed") stays a sim concern (DX spec §3.3), so replays remain a pure function of the command stream.
- **Context.** While Flow's current screen has `pausesSim` or a modal is open, `play` actions are released and `menu` actions drive the focus navigator; otherwise the reverse. `any` actions are live in both.
- **Active device** follows the last real input, with the SDK's `Hosting.input` as the source under Ruken when it reports `gamepad`. Glyph family: under Ruken, `InputModePayload.gamepad.layout` (`xbox` or `other` → `generic`); standalone, FloorFifty `ui/glyphs.ts` `glyphFamily(id)` sniffing. `ui`'s `InputMethodTracker` is fed from `device`; its own listeners stay for pages without a runtime.
- **Facts.** `input.device.changed`, `input.pad.connected`, `input.pad.disconnected` and `input.bindings.changed` on the presentation bus.

### 4.3 Gamepad source (`packages/runtime/src/input/gamepad/`, M4.2)

Extracted from FloorFifty `managers/gamepad-source.ts` (300 lines) with `tests/client/managers/gamepad-source.test.ts`:
- `readPad(pad)`: radial deadzone `DEADZONE` 0.25 (line 31; a stick resting off-centre on both axes stays still), triggers pressed at 0.5, D-pad and stick merged into the four directions along the stronger axis.
- Polled once per animation frame from the frame loop's existing callback, with `getGamepads` injected. Only pads with `mapping === 'standard'` drive bindings; others show a "controller not supported" toast once (§6) and still drive menus through D-pad buttons when they expose them.
- **Hot-plug.** `gamepadconnected` adds a pad; the newest pad that sends a press becomes active (FloorFifty `activeIndex`). `gamepaddisconnected` releases its held set and publishes `input.pad.disconnected`; during play with the gamepad active this pauses through `Time.pause('input')` (M4-D9).
- **Held-direction repeat** for menu navigation: first repeat after `REPEAT_DELAY_MS` 400, then every `REPEAT_EVERY_MS` 120 (lines 35–36). Buttons never repeat.
- **Handover mask** (`HandoverMask`, line 104): when input moves between play and menu context, whatever the pad holds is masked on the new side until released, so a held confirm cannot activate the first button of a new screen.
- **Reserved buttons** (M4-D3): standard button 8 (View/Back) is the host's. Ruken's SDK summons the host menu on a 600 ms hold of it (`createGamepadPoller` in the vendored SDK); 16 (Home) is the system's. Neither is bindable, and neither drives the focus navigator. A contract test drives the SDK's poller through a fake `SdkEnv` and asserts the button index from the SDK's behavior, so AF never restates the number on its own authority (Ruken request R-3).

### 4.4 Touch and gestures (`packages/runtime/src/input/gestures/`, `packages/ui/src/touch/`, M4.3)

- **Touch buttons.** Every binding with `touch: true` gets an on-screen button in `TouchControls.svelte` (from FloorFifty `ui/components/TouchControls.svelte` 257 and `systems/gameplay/touch-controls.ts` 211: `StickyPointers` with `STICKY_MARGIN_PX` 24, `PointerLatch`, `nearestTarget`). Buttons are 48 px minimum (primary action size), placed by §4.9's rule. Shown when `Input.device` is `touch`, hidden otherwise, never remounting the screen.
- **Gestures as data.** `SwipeTracker` (FloorFifty `systems/gameplay/swipe-tracker.ts` 109) becomes a pure tracker over pointer samples. Its thresholds are content tuning, with FloorFifty's values as defaults: `deadZonePx` 12, `saturationPx` 48, `flickPx` 40, `flickMs` 180. A binding's `gesture` names which gesture holds or presses an action. `SwipeSurface.svelte` (FloorFifty 104) is the DOM surface; only the first finger steers, any finger may flick (FloorFifty rule, Owner 2026-10-10).
- **Touch mode** setting: `buttons` or `swipe` (FloorFifty `input.touchMode`), shown in the Controls section only when the profile binds both.
- Gesture times come from `PointerEvent.timeStamp`, never `Date.now()`; tests feed samples directly.

### 4.5 Rebinding and saved bindings (M4.4)

- Saved as `input: { profile: string, overrides: Record<action, Partial<InputBinding>> }` inside the game's `SettingsDef`; the defaults are the `InputMap`'s profile. Overrides store only what changed, so a game update that adds an action keeps the player's other bindings.
- **Flow:** the player picks an action and a device in the Controls section; `Input.capture(device)` waits; the captured key or button is checked against reserved inputs, then against conflicts in the same context.
- **Conflict** (M4-D4): the input moves to the new action and leaves the old one. If that would leave a `required` action with no binding on that device, the rebind is refused with `RebindConflict { action, with }` and nothing changes.
- **Reset** restores the profile's defaults for all devices.
- A settings write that `Hosting.saves` refuses keeps the new bindings for this session and logs a warning, as M1.5's settings store already does. It never falls back to device storage.

### 4.6 Device prompts (`packages/ui/src/prompts/`, M4.4)

- `<Prompt action="jump" />` renders the active device's label: a key name (`navigator.keyboard.getLayoutMap()` where the browser has it, else the `code` without its `Key`/`Digit` prefix), a pad glyph by family (FloorFifty `ui/glyphs.ts` 48 lines: printed labels `A`/`B`, `✕`/`○`; words through PRODUCT.L's `t()`), or a touch icon.
- It follows `Input.device` and `Input.profile` live: rebinding or switching device changes the label without remounting.
- A prompt for an unbound action renders "Unbound" (a localized key) and never an empty box.

### 4.7 Focus navigation completed (`packages/ui/src/focus/`, M4.5)

Added to `FocusNavigator`, from FloorFifty `ui/focus-nav.ts` (249) and `ui/page-swipe.ts` (41):
- `steer(direction)`: spatial moves inside a `[data-focus-grid]` (paged grids, OptionGroup), DOM order elsewhere.
- `page(delta)` on `[data-pager]` regions (shoulder buttons, PageUp/PageDown, page swipe).
- `adjust(delta)` on Slider and OptionGroup without leaving them.
- **Pad guard:** after a screen change, confirm is ignored until it has been released once (FloorFifty's pad guard, and the handover mask in §4.3).
- **Focus on screen change:** Flow's enter focuses `[data-autofocus]` or the first tabbable; returning to a screen restores the element focused when it was left, if it is still there.
- **Back:** one path. Keyboard Escape, pad B, the corner Back control and (standalone) the system back gesture all reach `FocusNavigator.back()`, which closes the topmost dialog or asks Flow to go back. The back gesture (FloorFifty `ui/back-gesture.ts` 71: one history entry added inside a user activation) runs standalone only (M4-D10); hosted, the host owns system back (Ruken request R-2). Where a screen has nothing to go back to, the gesture leaves the page as normal.
- **Cursor policy** (FloorFifty `ui/cursor-policy.ts` 64): the pointer is hidden only on a screen marked `gameplay` that is not paused, when the last input was not the pointer or the pointer has been still for `CURSOR_IDLE_MS` 2000. Never on a menu. `ScreenDef` gains an optional `kind: 'menu' | 'gameplay'` (default `menu`).

### 4.8 UI primitives completed (`packages/ui`, M4.6)

| Primitive | Source (FloorFifty `ac72660` unless noted) | Notes |
|---|---|---|
| Split | `ui/layout/Split.svelte` 51, `split.ts` 7 | Two panes side by side at `wide`, stacked otherwise |
| OptionGroup | `ui/layout/OptionGroup.svelte` 71 | Radio-group semantics; `adjust` cycles |
| PagerDots, `pager.ts` | `ui/layout/PagerDots.svelte` 113, `pager.ts` 8 | Each dot is a 44 px target |
| PagedGrid | `ui/tile-pages.ts` 129 (page arithmetic only; FloorFifty's tile types stay) | Never scrolls; page shape from the measured box at the smallest target size |
| Button, IconButton | Ruken `packages/ui` (interaction rules, extraction map §1) | IconButton always has an accessible name |
| Toggle, Slider | new, Ruken interaction rules | Slider steps by `adjust`; keyboard arrows; 44 px thumb |
| Chip | `ui/components/Chip.svelte` 64 | — |
| Modal, Sheet | `ui/components/Modal.svelte` 257, `MenuSheet.svelte` 53 | Built on the existing Dialog's modal scoping |
| Toast | Ruken `packages/ui` Toast | Polite live region; never steals focus; above `hostReserved` and the keyboard |

Every primitive: a renderer-free fixture, a DOM behavior test, a layout contract at every reference size and variant, 44 px targets and 48 px primary actions times `scale`, every visible string a prop. The language picker is PRODUCT.L's.

**Core Settings screen** (M4-D8): a plain `SettingsScreen` built from ScreenFrame, ScrollList and the sections. Core sections: **Controls** (bindings per device, touch mode, reset) and **Display** (quality, reduced motion as the browser reports it, read-only). PRODUCT.L adds Language. Extensions add theirs through the `settings.sections` slot. The kit's styled settings screen (PRODUCT.6, Plus) replaces it by flow.

### 4.9 Display policy (M4.7)

- **Orientation** comes from the manifest's `runtime.orientation` (`@mcthaydt/automata-ship` config). A `portrait` or `landscape` game in the other orientation on a phone shows the rotate hint (FloorFifty `RotateHint.svelte` 106) over a paused game; `any` never does.
- **Landscape gate** (FloorFifty `LandscapeGate.svelte` 109, `ui/fullscreen.ts` 75; classifier already in `ui`): standalone only (M4-D5). `fullscreen` asks for one tap and calls `Hosting.setFullscreen(true)`; `rotate-or-install` explains both ways. Under Ruken the gate is off: the host frames the game, and `display.metrics.fullscreen` is the host's.
- **Touch-overlay placement.** Touch buttons sit inside `geometry.visible`, outside the bounding boxes of `[data-corner-controls]`, the ActionBar and every `[data-way-out]`, and outside the host's reserved strip. Where they cannot fit at 48 px (780×270 with an ActionBar), the overlay drops to the minimum set (actions marked `required`), never shrinks a target and never covers a required action. `checkLayout`'s `findIntrusions` gains the overlay as an intruder.
- **HUD layer** renders the `hud.overlay` slot inside `geometry.visible`, above the canvas and below dialogs.
- **Keyboard and browser bars:** already handled by the geometry owner (no reclassification, no remount; M1.6 §3.1). M4 adds the E2E proof under the fake host (D-c).
- **`scale` hint** (Ruken TV mode 1.333) enlarges targets and text through `--af-scale`, never CSS zoom (unchanged).

### 4.10 `camera2d` (`packages/render-pixi/src/camera/`, M4.8)

```ts
export interface Camera2dOptions {
  readonly follow?: { readonly rate: number; readonly deadZone?: Rect }  // exponential approach per second
  readonly bounds?: Rect                                                   // world rect the view never leaves
  readonly zoom?: number
}
export interface Camera2d {
  target(x: number, y: number): void
  shake(trauma: number): void      // 0..1, decays; amplitude 0 under reduced motion
  update(frameSeconds: number): void
  readonly transform: { readonly x: number; readonly y: number; readonly scale: number }
}
export function createCamera2d(stage: Container, options: Camera2dOptions, seed?: number): Camera2d
```

**Amended in M4.8 (2026-10-17, [plan](../plans/2026-10-17-m4-8-camera2d.md)).** `view: { width, height }` is required: centring a target needs the size of the area shown, and a Pixi `Container` has no viewport. `reducedMotion?: () => boolean` is injectable (default `ui`'s `reducedMotion()`, read every frame). `follow.deadZone` is a `{ width, height }` centred on the view, not a `Rect`. `SHAKE_DECAY` (1.5/s) and `SHAKE_MAX_OFFSET` (8 px × trauma²) are exported. `@mcthaydt/automata-game` re-exports `createCamera2d`, so examples and the umbrella reach it through a public entry.

From FloorFifty `systems/gameplay/camera.ts` (258; follow by `rate * delta` approach, `visibleField`, punch and freeze). It is presentation only (FloorFifty's comment: "never touches a coordinate the simulation produced"). It reads interpolated positions from `RenderDeltaConsumer` and writes only the stage container's transform. Shake noise comes from a seeded generator so visual tests are stable; `reducedMotion()` sets amplitude 0. FloorFifty's race-specific zoom (`contentFitZoom`, danger) stays in the game. Parallax stays an example on top of it (PRODUCT spec §3, cut).

### 4.11 Graphics quality and render targets (`packages/render-pixi`, M4.9)

- `QualityTier = 'high' | 'medium' | 'low'`, a settings field `display.quality`, default `high` (M4-D6; FloorFifty `QUALITY_LEVEL`).
- `low` caps canvas resolution at 1 (`canvasResolutionFor`), `medium` at 1.5, `high` at `MAX_RESOLUTION` 2.
- Post-filter slot owners register a minimum tier: `slot.set(id, filters, order, { minTier })`, an additive option on PRODUCT.1's `set`. Owners below the current tier are left out of the composed list, so a weak device drops optional passes and never the art direction (FloorFifty `quality.ts`: the palette lock stays at every tier).
- `rebuildOnQuality(settings, build)` (FloorFifty `quality-rebuild.ts` 44): a change destroys the old build before making the new one.
- `CompositeTarget` (FloorFifty `render-target.ts` 95): the world draws at resolution 1 and the play field's logical size, then is nearest-upscaled into the letterbox. It is opt-in through `PixiRendererOptions.composite`, on by default when `pixelArt` is true.
- A filter a renderer cannot compile drops out of the chain with a logged warning and an `render.filter.dropped` fact, rather than failing the mount (FloorFifty `quality.ts` header).

### 4.12 Colour and accessibility (M4.6, M4.7)

No runtime colour-blind filter in core (M4-D7). Instead:
- **Never by colour alone.** Every core status primitive (Toast, Chip, ErrorPanel, Toggle) carries a shape or text with its colour (FloorFifty gameplay-feel spec: glyphs reinforce colour roles). A DOM test per primitive checks the state is readable with colour removed.
- **Contrast.** A unit test checks every text and background pair in `theme.css` at WCAG AA (4.5:1 for body text, 3:1 for large text and control outlines).
- Reduced motion (existing) also stops `camera2d` shake and the Toast slide.

### 4.13 Manifest consistency (M4.1)

`ruken.toml`'s `runtime.inputs` (Ruken `INPUTS`: `touch`, `keyboard`, `gamepad`) is checked against the profile: a profile that binds pad buttons with `gamepad` not declared, or declares `touch` with no touch binding and no gestures, fails `automata-ship prepare` (and `automata check`, DX.6) with the action and field named. AF generates nothing Ruken does not define.

### 4.14 Testing additions (`packages/testing`, M4.10)

- `fakeGamepad(page)`: FloorFifty `tests/e2e/support/fake-gamepad.ts` (196): an init script replaces `navigator.getGamepads` with one standard pad; helpers press, hold, tap, move sticks, connect and unplug, each waiting on animation frames, never a sleep.
- `touch` helpers: tap, hold, swipe and flick through Playwright's touchscreen and CDP touch events.
- `INPUT_MATRIX`: the matrix cells (§9) as data, so a game's own journeys reuse them.
- A Vitest fake gamepad for unit tests (`getGamepads` injection).

## 5. Data and lifecycle flows

**Boot** (after M1.5's step 3, settings loaded):
1. `InputLive` builds from the `InputMap`'s profile and the saved overrides. A bad override record falls back to defaults per field (`readSettings` rules).
2. It subscribes to `Hosting.input` and window keyboard and pointer events in the runtime scope, and starts the gamepad poll on the frame loop.
3. The active device starts from `Hosting.input.mode` under Ruken, or from `(pointer: coarse)` standalone (as `InputMethodTracker` does).
4. Touch controls mount in the HUD layer when the device is `touch`. Nothing renders before `session.ready` (unchanged).

**Per fixed step:** `held()` and `stick()` are read once, `InputMap.toCommand` makes one command, and the sim steps it. No allocation of an Effect per frame; the poll writes into preallocated sets.

**Device change:** the last real input changes `device`. Prompts and touch controls update in place; the screen does not remount; focus stays.

**Pad hot-plug:** connect: `pads` updates and the toast "Controller connected" shows. Disconnect: the pad's held set is released; during gameplay with the gamepad active, `Time.pause('input')` and the pause screen opens with "Reconnect your controller" (M4-D9); reconnecting or any other device's input lets the player resume through the pause screen.

**Rebind:** Controls section → `capture` → reserved check → conflict check → `Settings.update` (memory first, then `Hosting.saves.set` forked) → `input.bindings.changed` → prompts update.

**Screen change:** Flow exits the old screen (its scope releases its listeners), applies the handover mask, enters the new one and focuses per §4.7.

**Host display change** (`Hosting.display`): the geometry owner re-measures; touch-overlay placement recomputes; nothing remounts.

**Lifecycle background:** every device's held set is released (no stuck keys), the gamepad poll stops while hidden, and the app loop is already paused by `Time` (M1.5).

**Restart and dispose:** closing the runtime scope removes every listener, stops the poll and drops the `Input` service. A restart builds it again from the saved bindings.

## 6. Failure policy

| Case | Result |
|---|---|
| A profile binds a reserved key or button | `inputProfileSchema` fails with the action named; at boot this is a `BootDefect` before anything renders (developer error) |
| A saved override is malformed or for an unknown action | That override is dropped; defaults stand; a warning is logged; the record is rewritten on the next change |
| `capture` gets Escape or pad B | `RebindCancelled`; nothing changes |
| `capture` gets nothing for 10 s (Effect `Clock`, tested with `TestClock`) | `RebindTimedOut`; the section says so; nothing changes |
| A rebind would leave a `required` action unbound on that device | `RebindConflict`; refused with both actions named |
| `Hosting.saves` refuses the settings write | The bindings hold for the session; warning logged; no device-storage fallback |
| A non-standard-mapping pad | Toast "This controller isn't supported yet" once per pad; menus still work through its D-pad buttons where it has them; gameplay bindings ignore it |
| Pad unplugged mid-play | Pause with "Reconnect your controller" (M4-D9) |
| `setFullscreen` fails or answers `support: 'none'` | The gate stays `none`; the game plays in the window |
| A filter fails to compile | It drops out; `render.filter.dropped` fact; the game still draws |
| Touch overlay cannot fit at 48 px | Only `required` actions show; the layout contract fails the build if even those cannot fit at a reference size |
| `navigator.keyboard.getLayoutMap` missing or rejected | The prompt shows the `code`-derived label |
| Window loses focus with keys held | All held keys release (FloorFifty `devices.ts` behavior) |

## 7. UI inventory and states

| Component | States | Focus and input | Host-aware |
|---|---|---|---|
| `TouchControls` | hidden (device not touch), shown, pressed per button, reduced (only required) | Pointer only; never in the focus order | Placed outside `hostReserved` and the keyboard |
| `SwipeSurface` | idle, steering (left or right), flick | Pointer only | Inside `visible` |
| `Prompt` | keyboard label, pad glyph per family, touch icon, unbound | Not focusable | Follows `Hosting.input` |
| Controls section | list, capturing (with countdown), conflict message, saved, save refused | Every row a 44 px control; capture cancels on Escape or B | Hidden pad rows when no pad has ever connected |
| Display section | quality options | OptionGroup with `adjust` | — |
| `SettingsScreen` | sections, slot sections | ScrollList; Back in the corner | Back to Ruken is the host's, not here |
| `RotateHint` | shown, hidden | Not interactive; game paused | Off under Ruken for the landscape gate; the hint applies to both |
| `LandscapeGate` | none, fullscreen (one tap), rotate-or-install | The tap button is focused | Standalone only |
| Reconnect pause | shown on pad loss | Any device resumes through Resume | — |
| New primitives (§4.8) | each its own enabled, disabled, focused, pressed, selected states as applicable | All four input paths | `scale` |

## 8. Responsive and input inventory

| Situation | Policy |
|---|---|
| Phone portrait (360–430 × 640–932) | Touch buttons along the bottom inside `visible`; the ActionBar above them on menus only |
| Phone landscape and compact (780×270, 844×340, 667×320) | Touch buttons in the lower corners; minimum set if the ActionBar would be covered; no essential below the fold |
| Tablet (744–1180 wide) | Same as phone of the same orientation, larger gaps |
| Desktop | Touch hidden unless the last input was touch |
| `hostReserved` strip on either edge | No control, touch button or toast under it |
| On-screen keyboard | Form factor unchanged; a focused field stays visible; touch controls hide while a text field has focus |
| Browser bar showing and hiding | No remount; touch buttons follow `visible` |
| Rotation | The screen stays mounted; focus and held state stay (released only if the device changed) |
| `scale` 1.333 | Targets and prompts scale; layout contracts hold |
| Long text (`xx-long`, PRODUCT.L) | Prompts and Controls rows wrap; targets never shrink |
| Input mode switch mid-screen | Prompts change in place; focus ring shows for keyboard and pad, not for touch |

## 9. Test allocation

| Layer | Where | What it proves |
|---|---|---|
| Unit (Node, `test:unit`) | `runtime/input`, `runtime/input/gamepad`, `runtime/input/gestures`, `render-pixi/camera`, `render-pixi/quality` | Profile schema and reserved inputs; per-device bookkeeping; `readPad` deadzone and axis choice; repeat timings with `TestClock`; handover mask; swipe and flick thresholds from samples; rebind conflict and timeout; override merge; camera follow, bounds and seeded shake; tier filtering of slot owners; manifest `inputs` check. Ported FloorFifty tests: `gamepad-source`, `input`, `swipe-tracker`, `swipe-controls`, `touch-controls`, `camera`, `glyphs`, `cursor-policy`, `back-gesture`, `focus-nav`, `page-swipe`, `landscape-gate`, `rotate-hint`, `fullscreen` (each as a behavior spec, extraction map §4) |
| SDK contract | `runtime/input` with the vendored SDK and a fake `SdkEnv` | Button 8 hold summons the host; AF's reserved list matches that behavior |
| DOM (jsdom, Testing Library) | `packages/ui` | Every new primitive's states and interactions; Prompt per device; Controls capture, conflict and cancel; colour-removed readability |
| Layout contracts (real browser, `test:layout`, Chromium, WebKit, Firefox) | `packages/ui/src/**/*.layout.test.ts` | Every new primitive and the Settings screen at every reference size and variant; touch overlay placement with an ActionBar at 780×270 |
| Parity | `packages/runtime` | A replay recorded from a scripted input sequence has the same golden hash in Node, Chromium, WebKit and Firefox |
| Fake-host E2E matrix | `examples/core/*` and Emberwick, Playwright under `@ruken/sdk-host`'s fake host | §9.1 |
| Device and Owner | real phone, real controller | Owner acceptance only (§13) |

### 9.1 The input × form-factor matrix

Journey per cell: boot → title → play (move and one action) → pause → Settings → rebind one action → resume → the new binding works → back to title. Each cell also asserts zero console errors, zero CSP violations and the layout contract on every screen it visits.

| Form factor (viewport) | Keyboard | Gamepad (fake) | Touch | Host |
|---|---|---|---|---|
| Phone portrait 390×844 | — | Chromium | Chromium, WebKit | fake Ruken host |
| Phone landscape 844×390 | — | Chromium | Chromium, WebKit | fake Ruken host |
| Compact 780×270 | — | Chromium | Chromium | fake Ruken host |
| Tablet portrait 820×1180 | Chromium | Chromium | Chromium, WebKit | fake Ruken host |
| Desktop 1280×720 | Chromium, WebKit, Firefox | Chromium, WebKit | — | fake Ruken host and standalone |

Host-event cells (desktop and phone portrait, Chromium): `display.metrics` changes `hostReserved` from right to left mid-screen; `input.mode` switches to `gamepad` and prompts change; `lifecycle` background releases held keys; host summon (button 8 held 600 ms) reaches the fake host and the game sees no action; a focused text field with a simulated keyboard keeps `data-form-factor` and the screen mounted.

Failure cells: a pad unplugged mid-play pauses with the reconnect message; a non-standard pad shows the toast once; a refused settings save keeps the binding for the session.

Placement (M4-D11): desktop and phone-portrait Chromium cells run locally and in hosted CI when runners exist (D-5: local is the green gate today). The rest run on the GPU runner nightly and on request (`test:remote <spec> --project=<cell>`). WebKit gamepad cells are best effort: FloorFifty's `webkit-gamepad` passes only on the Mac runner (FloorFifty `AGENTS.md`).

## 10. Feedback workflow

- Focused first: `pnpm --filter @mcthaydt/automata-runtime exec vitest run src/input/<file>`, then the `ui` `layout` project for one primitive, then one matrix cell with `CI=1 pnpm exec playwright test <spec> --project=<cell>`.
- Browser readiness waits on `session.ready`, `document.fonts.ready` and an animation frame after a viewport or pad change; the fake gamepad helper waits on frames, never a sleep.
- Every result names its build ID, commit and browser. First-attempt failures are kept.
- Full local gate before each PR: `pnpm check` and `pnpm test:parity` under the heavy-gates lock, plus `pnpm test:e2e` when the change touches runtime, ui or an example.

## 11. Ruken alignment and requests

| Behavior | Ruken contract (vendored `@ruken/sdk`, `b30d31b`) |
|---|---|
| Active device and pad layout | `InputApi` / `InputModePayload` (`mode`, `gamepad.layout`, `gamepad.connected`) through `Hosting.input` |
| Host menu on the controller | The SDK's gamepad poller (button 8 held 600 ms) and `onMenuRequest`; AF reserves the button (§4.3) |
| Safe area, reserved strip, scale, orientation, fullscreen | `DisplayMetricsPayload`, `FullscreenRes` through `Hosting.display` and `Hosting.setFullscreen` |
| Declared inputs and orientation | `@ruken/manifest` `INPUTS`, `ORIENTATIONS` (`runtime.inputs`, `runtime.orientation`) |
| Pausing on background | `LifecyclePayload` through `Time` (M1.5) |

**Requests to Ruken** (the Owner files them; links are recorded here when filed):
- **R-1.** `InputModePayload.gamepad.layout` has only `xbox` and `other`. Add `playstation` (and `nintendo`) so hosted prompts match the pad; standalone, AF sniffs the pad id as FloorFifty does.
- **R-2.** A host event for the system back action (Android back, the host shell's back), delivered like `onMenuRequest`, so a hosted game handles back without adding history entries inside the frame.
- **R-3.** Export the host-summon button and hold time from `@ruken/sdk` (or the protocol's `meta`), so AF's reserved list reads Ruken's constant instead of a contract test inferring it.
- **R-4.** Question: does a framed game's `visualViewport` report the on-screen keyboard on Ruken's iOS and Android shells, or should `display.metrics` carry a keyboard inset? Not verifiable here (no RukenApp checkout or device in this environment).

## 12. Tasks

| ID | Task | Lane | Depends on | Deliverable and acceptance |
|---|---|---|---|---|
| M4.0 | This spec, reviewed | integration | — | Owner review; M4-D1 to M4-D11 confirmed or changed |
| M4.1 | `Input` service and bindings | runtime | M4.0, PRODUCT.1, DX.2 | §4.1, §4.2, §4.13; the PRODUCT.1 schema change request; example `core/core-input-keys.ts` updated to the service; I-a, I-b, I-g |
| M4.2 | Gamepad source | runtime | M4.0 | §4.3; example `core/core-input-gamepad.ts`; I-c, I-d, I-e |
| M4.3 | Touch buttons and gestures | runtime, ui | M4.1 | §4.4; example `core/core-input-touch.ts`; I-f |
| M4.4 | Rebinding, prompts, Controls and Display sections, core Settings screen | runtime, ui | M4.1, M4.6 | §4.5, §4.6, §4.8 Settings; example `core/core-input-rebind.ts`; I-h, I-i, I-j |
| M4.5 | Focus navigation, back and cursor policy | ui, runtime | M4.0 | §4.7; F-a, F-b, F-c |
| M4.6 | Remaining `ui` primitives | ui | M4.0 | §4.8, §4.12; examples `ui/ui-*.ts`; U-a, U-b |
| M4.7 | Display policy | runtime, ui | M4.3, M4.6 | §4.9; D-a to D-d |
| M4.8 | `camera2d` | render-pixi | M4.0 | §4.10; example `core/core-camera-2d.ts`; C-a, C-b |
| M4.9 | Quality tiers and render targets | render-pixi, runtime | M4.0, PRODUCT.1 | §4.11; example `render/render-quality.ts`; Q-a, Q-b |
| M4.10 | E2E matrix under the fake host | testing, integration | M4.1 to M4.9 | §4.14, §9.1; M-a, M-b |
| M4.11 | `dev-tools` extension (Plus, after core) | ship | M4.10, PRODUCT.5 | Evidence capture and promotion (FloorFifty `tools/promote-evidence`), worktree cleanup (`tools/worktree-gc`), in `automata-plus`; never in a game bundle |

Order: M4.2, M4.5, M4.6 and M4.8 start at once (no unmerged prerequisite); M4.1 and M4.9 after PRODUCT.1 (and DX.2 for M4.1) merge; then M4.3, M4.4, M4.7; M4.10 last; M4.11 after PRODUCT.5.

## 13. Exit criteria and acceptance cases

**Success:**
- **I-a.** One action bound to a key, a pad button and a touch button produces the same command stream from each device in a scripted run; the replay golden matches in Node, Chromium, WebKit and Firefox.
- **I-b.** Releasing a key while the pad still holds the same action keeps the action held.
- **I-c.** A stick at (0.2, 0.2) (radius 0.28, above 0.25) moves; at (0.15, 0.15) (radius 0.21) it does not.
- **I-d.** Holding a D-pad direction in a menu moves focus at 0, 400, 520, 640 ms (`TestClock`).
- **I-e.** A pad connected mid-session becomes active on its first press; prompts switch to its glyph family.
- **I-f.** A flick down of 40 px within 180 ms presses its bound action; 39 px or 181 ms does not.
- **I-g.** `ship prepare` with a profile that binds pad buttons and a manifest without `gamepad` fails naming the action and `runtime.inputs`.
- **I-h.** Rebinding jump to `KeyK` on desktop under the fake host saves through `Hosting.saves`, survives a reload, and the Prompt shows "K".
- **I-i.** Rebinding moves a key from one action to another; the old action shows "Unbound" when it is not required.
- **F-a.** After a screen change, a confirm held from the previous screen does not activate the new screen's first button.
- **F-b.** Returning from Settings to Pause restores focus to the Settings button.
- **F-c.** Standalone, the system back gesture on Settings returns to Pause; on the title it leaves the page.
- **U-a.** Every new primitive passes its layout contract at every reference size and variant in three engines.
- **D-a.** At 780×270 with an ActionBar, touch buttons cover no required action and keep 48 px.
- **D-b.** Moving `hostReserved` from right to left mid-play moves the touch buttons and remounts nothing.
- **D-c.** Opening the on-screen keyboard (simulated visual-viewport inset) keeps `data-form-factor` and the screen instance.
- **C-a.** The camera never shows outside `bounds`; following a target settles within the expected frames at the given rate.
- **Q-a.** At `low`, a slot owner registered with `minTier: 'medium'` is absent from the filter list and canvas resolution is 1.
- **M-a.** Every cell of §9.1 passes, with zero console errors and zero CSP violations.

**Failure cases that must be shown by tests:**
- **I-j.** A profile binding pad button 8 fails `inputProfileSchema` naming the action.
- **I-k.** `capture` times out at 10 s and changes nothing; Escape cancels and changes nothing.
- **I-l.** A rebind that would leave a required action unbound is refused with both names.
- **D-d.** Under the fake Ruken host the landscape gate never shows; standalone on a coarse pointer at 844×390 with `support: 'element'` it does.
- **U-b.** A Toast in its error state is distinguishable with colour removed.
- **C-b.** With reduced motion, `shake(1)` moves nothing.
- **Q-b.** A filter that fails to compile drops out and the frame still renders.
- **M-b.** Unplugging the fake pad during play pauses with the reconnect message.

**Gates reported separately:** implemented; locally verified (`pnpm check`, `pnpm test:parity`, the local matrix cells); GPU-runner verified (the remaining cells); Owner accepted. **Owner acceptance (never ticked by an agent):** a real phone (touch, portrait and landscape) and a real controller (one Xbox-layout, one other) play Emberwick or the core example under Ruken's local stack and standalone, with the device, browser and date recorded.

## 14. Risks

| Risk | Mitigation |
|---|---|
| The Gamepad API differs across engines (WebKit gamepads only on the Mac runner in FloorFifty) | Fake gamepad at the Gamepad API boundary; WebKit gamepad cells best effort; a real controller is an Owner gate |
| Analog values entering commands could break cross-engine determinism | Sticks are quantized to integers before they reach a command (M4-D2); the parity row in §9 proves it |
| Rebinding grows into a remapping UI per game | Only the profile's actions are listed, with one capture flow; Plus kits restyle it |
| The back-gesture trick depends on Chrome's history-activation rule | Standalone only; a hosted path waits on R-2 |
| DX.2's `InputMap` lands without a profile | M4.1 files the change request instead of adding a second mapping (§2.2) |
| The quality default (`high`) is too heavy on weak phones | PRODUCT.7's frame-budget probe measures it; changing the default is a recorded decision with that evidence |

## 15. Open decisions (recommended defaults in effect until the Owner reviews)

| ID | Question | Recommended default | Why |
|---|---|---|---|
| M4-D1 | Does Input move to its own core package? (master spec §4.1 left it to M4) | **No.** It stays in `runtime/src/input/`; touch and prompt components in `ui`; camera and quality in `render-pixi` | PRODUCT.1 already put the profile seam in `runtime`; one fewer package keeps the umbrella import flat (PRODUCT spec §7) |
| M4-D2 | Analog sticks | **Digital by default** through the radial deadzone (0.25). An analog action reads `stick()`, quantized to integers −127..127 per axis | FloorFifty is digital; quantizing keeps commands small and cross-engine exact |
| M4-D3 | Reserved inputs | **Pad 8 (View) and 16 (Home), keyboard Escape and Tab** are never bindable; only `pause` among menu actions is rebindable | Ruken's SDK summons the host on button 8; Escape is the one back path; Tab is focus |
| M4-D4 | Rebind conflicts | **Move** the input to the new action; **refuse** if a `required` action would be left unbound on that device | Fewest steps for the player; the game can never become unplayable |
| M4-D5 | Landscape gate under Ruken | **Off under Ruken**, on standalone | FloorFifty skips it inside Ruken; the host owns framing and fullscreen |
| M4-D6 | Quality default and auto-detection | **`high`, no auto-detect** until PRODUCT.7 has measured the phone profiles | No evidence yet for a device-class rule |
| M4-D7 | Colour-blind support | **No runtime filter in core.** Never colour alone, plus an AA contrast check on theme tokens | A filter changes the art direction; redundant encoding works for every type of colour blindness |
| M4-D8 | A core Settings screen | **Yes, plain:** Controls and Display (Language from PRODUCT.L) plus the `settings.sections` slot; the kit's version is Plus | Rebinding and language must always be reachable in a free game |
| M4-D9 | A pad unplugged during play | **Pause** with a reconnect message (new `PauseReason` `input`) | Standard console behavior; avoids the player losing a run to a cable |
| M4-D10 | System back gesture when hosted | **Standalone only** until Ruken answers R-2 | History entries inside a frame interact with the host page's history |
| M4-D11 | Where matrix cells run | **Desktop and phone-portrait Chromium locally (and in hosted CI when runners return); the rest on the GPU runner nightly and on request** | D-5; heavy suites stay off the developer's machine |
