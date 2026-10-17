# M4.2 Gamepad source: TDD plan

- **Task:** M4.2 in [02](../../02-master-delivery-plan.md). M4 spec [§4.3](../specs/2026-10-16-m4-input-display-design.md), §4.2 (active device, facts), §5 (pad hot-plug), §6 (non-standard pad, pad unplugged mid-play), §9 (unit and SDK-contract layers), M4-D2, M4-D3, M4-D9. Acceptance I-c, I-d, I-e.
- **Lane:** runtime, with the game lane's `keys()` and default screens (this session owns both). **Depends on:** M4.0 (merged) and M4.1 (stacked: this branch starts from `claude/clever-pasteur-ujmu6e-m4-1`, because the gamepad source feeds M4.1's `Input` rather than a second copy of its bookkeeping).
- **Status:** In progress.
- **Progress:** 5 of 9 steps.

## Sources, read at these commits

- **FloorFifty `apps/client/src/managers/gamepad-source.ts` at `ac72660`** (300 lines) and `tests/client/managers/gamepad-source.test.ts` (369 lines). Taken:
  - `readPad`'s radial deadzone `DEADZONE` 0.25 (line 31), `TRIGGER_PRESSED` 0.5, and the menu directions along the stick's stronger axis;
  - `HandoverMask` (line 104), unchanged in behavior;
  - the held-direction repeat, `REPEAT_DELAY_MS` 400 and `REPEAT_EVERY_MS` 120 (lines 35–36); buttons never repeat;
  - the active pad, which is the newest pad to send a press (`activeIndex`), with a press reported on every new press and not only on a change of pad;
  - release on `gamepaddisconnected`.
- **Left in FloorFifty**, because they are race-specific: fast-fall, reset, the shoulder "hop" buttons and the race target.
- **FloorFifty `apps/client/src/ui/glyphs.ts` at `ac72660`**: `glyphFamily(id)` only. The label table (`GLYPHS`) is prompts, M4.4.
- **The ported test cases**, as behavior specs:
  - "reading a pad": the deadzone;
  - "stick drift and the deadzone";
  - "d-pad and stick parity";
  - "more than one pad";
  - "a handover": every case except the race-only ones;
  - "repeats a held direction after a delay";
  - "releases what it held when the pad is unplugged".
- **Ruken SDK, vendored** (`vendor/ruken/ruken-sdk-0.0.0.tgz`, `dist/index.js`, `createGamepadPoller`). It summons the host after a 600 ms hold of standard button 8, and it emits `host.summon` with `button: 8`. The contract test reads that behavior through the fake host. AF never states the number on its own authority (R-3).

## Scope

**In:**

- `packages/runtime/src/input/gamepad/`: `readPad`, `quantizeAxis`, `HandoverMask`, `NavRepeat` and `glyphFamily`.
- `Input` reads them:
  - stick directions drive actions bound with `stick`;
  - `stick(side)` returns the active pad's quantized vector (−127..127, M4-D2);
  - menu navigation comes from the D-pad and the left stick, with repeat (`poll(nowMs)`);
  - the handover mask applies on `setContext`.
- **Hot-plug:**
  - `pads` (a `SubscriptionRef` of `PadInfo`);
  - `input.pad.connected` and `input.pad.disconnected` facts, each with `standard`, so M4.6's toast can say "not supported" once per pad;
  - a disconnect releases that pad's sources.
- `device` becomes `ActiveDevice { device, glyphs }`. The glyph family is sniffed from the active pad's `id`.
- `PauseReason` `input`.
- **The default play screen pauses on the active pad's disconnect** and shows "Reconnect your controller" (M4-D9). Resume, from any device, releases the `input` reason.
- `keys()` gains a `stick` option (direction → payload), the same way `pad` works.
- The SDK contract test for the reserved button.
- Example `core/core-input-gamepad.ts`.

**Out, each in its owning task:**

| What | Task |
|---|---|
| The "Controller connected" and "not supported" toasts (the Toast primitive) | M4.6, from the `input.pad.connected` fact |
| Focus moving on the repeated `nav-*` edges (I-d end to end), and the title and paused screens reading `Input` instead of `menuPad` | M4.5 |
| Glyph labels and prompts, and the device and glyphs from `Hosting.input` under Ruken | M4.4 (prompts are the only consumer) |
| The unplug journey under the fake host (M-b) | M4.10 |

## Contract

```ts
// packages/runtime/src/input/gamepad/read-pad.ts
export interface PadLike {
  readonly id: string; readonly index: number; readonly connected: boolean; readonly mapping: string
  readonly axes: readonly number[]; readonly buttons: readonly { readonly pressed: boolean; readonly value: number }[]
}
export const DEADZONE = 0.25
export const TRIGGER_PRESSED = 0.5
export type PadDirection = 'up' | 'down' | 'left' | 'right'
export interface PadReading {
  readonly buttons: ReadonlySet<number>            // pressed, or a trigger at ≥ 0.5
  readonly sticks: ReadonlySet<StickDirection>     // each stick past the radial deadzone, per axis sign
  readonly nav: ReadonlySet<PadDirection>          // D-pad, or the left stick along its stronger axis
}
export function readPad(pad: PadLike): PadReading
export function quantizeStick(x: number, y: number): { x: number; y: number } // centred inside the radial deadzone; else each axis rounded to −127..127, halves away from zero
// handover-mask.ts: class HandoverMask { capture(pad); clear(); apply(pad): PadLike }   (FloorFifty, unchanged)
// nav-repeat.ts:    REPEAT_DELAY_MS = 400; REPEAT_EVERY_MS = 120
//                   class NavRepeat { update(held: ReadonlySet<PadDirection>, nowMs: number): PadDirection[] }
// glyph-family.ts:  type GlyphFamily = 'xbox' | 'playstation' | 'generic'; glyphFamily(id: string): GlyphFamily

// input.manager.ts (additive, runtime is private)
export interface ActiveDevice { readonly device: InputDevice; readonly glyphs: GlyphFamily }
export interface PadInfo { readonly index: number; readonly id: string; readonly standard: boolean }
interface Input {
  poll(nowMs?: number): void                       // nowMs drives the menu repeat; play passes the frame time
  stick(side: 'left' | 'right'): { readonly x: number; readonly y: number }
  readonly device: SubscriptionRef<ActiveDevice>   // was SubscriptionRef<InputDevice>
  readonly pads: SubscriptionRef<readonly PadInfo[]>
}
// Facts: input.device.changed { device, glyphs, previous }; input.pad.connected PadInfo; input.pad.disconnected PadInfo
// time.manager.ts: PauseReason = 'lifecycle' | 'menu' | 'input'
// keys.ts: KeysOptions.stick?: Partial<Record<StickDirection, Payload<Z>>>
```

**Sources in `Input`'s bookkeeping:**

- `pad:<index>:<button>` (M4.1);
- `pad:<index>:stick:<direction>` (new).

Every source still goes through M4.1's per-device counting, so a stick and the D-pad that hold the same action release it only when both are let go. Only standard-mapping pads drive bindings. A non-standard pad appears in `pads` with `standard: false`, and its D-pad buttons are not read (DX spec §3.3 binds only the standard mapping).

## Steps

1. [x] **Plan.** This file, committed first.
2. [x] **`readPad` and `quantizeAxis` (I-c).**
   - **Files:** `packages/runtime/src/input/gamepad/read-pad.ts`, with the test `read-pad.test.ts`.
   - **Red:** Ported cases:
     - (0.15, 0.15) gives no direction and no nav; (0.2, 0.2) gives `left-right` and `left-down` (I-c);
     - drift just inside the deadzone in eight directions gives nothing;
     - just outside, one nav per direction;
     - a diagonal is one nav, along its stronger axis;
     - the D-pad and a held stick give the same nav;
     - a trigger at 0.5 counts as pressed;
     - `quantizeAxis(0.2)` is 0 and `quantizeAxis(-1)` is −127.
   - **Red reason:** the module is missing.
   - **Green:** the minimal port.
   - **Done.** Red: "Failed to resolve import ./read-pad.js". Green: 8 passed. *Deviations:*
     - Stick directions are eight-way: past the radial deadzone, an axis counts when it carries at least sin(22.5°) of the push. FloorFifty's per-axis 0.25 threshold would leave (0.2, 0.2) still, against I-c.
     - The first green failed on `quantizeAxis(-0.5)`: `Math.round(-63.5)` is −63. Halves now round away from zero, so equal pushes either way read the same size (−64 and 64), and the test pins the symmetry.
3. [x] **`HandoverMask`, `NavRepeat` and `glyphFamily`.**
   - **Files:** `handover-mask.ts`, `nav-repeat.ts`, `glyph-family.ts`, each with its test.
   - **Red:**
     - `NavRepeat` fires a held `down` at 0, 400, 520 and 640 ms, and not at 399 or 519 (the I-d timings);
     - a release and a re-press fire at once;
     - the mask cases (an A held into the new context is masked until it is released; only what was held is masked; a stick is masked until it is back inside the deadzone);
     - `glyphFamily` for an Xbox, a DualSense and an unknown id.
   - **Red reason:** missing modules.
   - **Done.** Red: three "Failed to resolve import" errors (`./glyph-family.js`, `./handover-mask.js`, `./nav-repeat.js`). Green: 16 passed in `gamepad/`. *Deviation:* FloorFifty's `apply` forgets the mask when another pad is read; here another pad passes through untouched and the first pad's mask stays, because `Input` reads every pad on each poll.
4. [x] **`Input` reads sticks, repeats nav, masks handovers.**
   - **Test:** `input.test.ts` (new describe blocks).
   - **Red:**
     - a profile action bound to `stick: ['left-left']` is held while the left stick is at (−0.5, 0), and released at (−0.1, 0);
     - the D-pad and the stick on one action release it only when both are let go;
     - `stick('left')` is `{ x: −64, y: 0 }` at (−0.5, 0) and `{ x: 0, y: 0 }` inside the deadzone;
     - in the menu context, a held D-pad down fires `nav-down` at polls 0, 400, 520 and 640 ms, and once only for a press under 400 ms;
     - `setContext('menu')` with pad A held does not fire `confirm` until A is released and pressed again.
   - **Red reason:** stick sources and repeat are missing; `stick()` is centred.
   - **Done.** Red: 5 of the new `input.test.ts` cases failed for the expected reasons (`[]` not `['left']`; `{0,0}` not `{-64,0}`; only `[0]` fired, not `[0, 400, 520, 640]`; the handover fired `confirm` early). The D-pad-plus-stick case passed before the change, because sticks were not read yet; it stays as a guard. Green: 48 passed in `runtime/src/input`; the game's unit tests 90 passed, the I-a device hash unchanged; both typechecks 0 errors. *Deviations:*
     - `quantizeAxis` became `quantizeStick(x, y)`, which is radial like the deadzone, so `stick()` and the stick directions agree at (0.2, 0.2). Its tests were rewritten first, and they went red.
     - Real `Gamepad`s always carry `id`, `connected`, `axes` and `value`, so the test pad stubs (`input.test.ts`, `keys.test.ts`, `default-screens.test.ts`, `device-run.ts`) now do too, and `readPad` stays strict.
     - Pad menu directions come only through the repeat (D-pad or left stick), not as button edges.
5. [x] **Hot-plug and active device (I-e).**
   - **Test:** `input.test.ts`.
   - **Red:**
     - `gamepadconnected` adds a `PadInfo` to `pads` and publishes `input.pad.connected` (with `standard: false` for a non-standard pad);
     - a second pad's first press makes it active, and `device` becomes `{ device: 'gamepad', glyphs: 'playstation' }` for a DualSense id;
     - a second pad at rest never releases what the first holds;
     - `gamepaddisconnected` releases that pad's held actions, removes it from `pads` and publishes `input.pad.disconnected`;
     - a non-standard pad's buttons drive nothing.
   - **Red reason:** no connect listeners; `device` is a bare `InputDevice`.
   - **Also:** M4.1's tests and the game's default-screens test move to the `ActiveDevice` shape.
   - **Done.** Red: 4 failed. The device was still the bare `'keyboard'` string; `input.pads` was undefined (`reading 'ref'`); the glyph family was missing; an unplugged pad still held `left`. Green: 52 passed in `runtime/src/input`; game unit 90 passed; runtime typecheck 0 errors. `RuntimeFacts` gains `input.pad.connected` and `input.pad.disconnected` (`PadInfo`) and `glyphs` on `input.device.changed`. The runtime index exports `ActiveDevice`, `PadInfo` and `GlyphFamily`. The game's default-screens test reads no device, so it needed no change.
6. [ ] **Reserved button contract (M4-D3, R-3).**
   - **Test:** `packages/runtime/src/input/reserved.contract.test.ts`, using `HostingTest` with an `env` override: injected `getGamepads`, `hasFocus` true, and a manual `requestFrame` and `timers.now`.
   - **Red:**
     - holding standard button 8 for 600 ms of frames makes the fake host receive one `host.summon` whose `button` is in `RESERVED_PAD_BUTTONS`;
     - an `Input` over the same pad holds no action and fires no menu edge for that button.
   - **Red reason:** first written against a deliberately wrong expectation, `button` ∉ `[16]`, to prove the test reads the SDK; then set to the reserved list.
7. [ ] **`keys()` sticks, and the reconnect pause (M4-D9).**
   - **Tests:** `packages/game/src/input/keys.test.ts`, `packages/game/src/screens/default-screens.test.ts`, `packages/runtime/src/time/time.test.ts`.
   - **Red:**
     - `keys(Move, {}, { stick: { 'left-left': { x: -1 } } })` puts `stick: ['left-left']` on the action, and the payload merges as `pad` does;
     - `Time` accepts the `input` reason;
     - in play with the gamepad active, a `gamepaddisconnected` for the active pad stops the sim and opens paused with "Reconnect your controller";
     - Resume, by any device, clears the message and the `input` reason, and the sim steps again;
     - a disconnect while the keyboard is active does not pause.
   - **Red reason:** missing option, reason and listener.
8. [ ] **Example.**
   - **File:** `examples/core/core-input-gamepad.ts`. A square moves by the left stick (digital, through the deadzone) or the D-pad. `Shows` names the deadzone, the repeat-free play input and the reconnect pause.
   - **Golden:** the golden is new and recorded once in Node (`AUTOMATA_UPDATE_GOLDENS=1`), then matches in the browsers' parity project. This is a recording, not a rebaseline.
   - **Checks:** the catalog test, the examples typecheck and `build:examples`.
9. [ ] **Verify and record.**
   - `pnpm format`; `pnpm check` (`TURBO_FORCE=true`).
   - The CI checks-job extras, including the changeset status, `check-changesets` (patches only before 1.0), `api-report`, `pnpm cheatsheet` if ship or game exports change, `build`, `test:dist`, and `prepare-ruken` for both games.
   - `pnpm test:parity`; `CI=1 pnpm test:e2e`.
   - Tick the M4.2 row in 02, and record the evidence and commits in 02's execution record and in 03.

## Acceptance mapping

| Case | Test |
|---|---|
| I-c | `read-pad.test.ts` (and `input.test.ts` for the action) |
| I-d | `nav-repeat.test.ts` and `input.test.ts` give the timings; focus moving is M4.5 |
| I-e | `input.test.ts`, the active pad and the glyph family; prompts switching is M4.4 |

## Risks

- **Emberwick's golden and `core-input-keys`'s golden must not move.** Keyboard input is untouched, and the pad paths are additive. A move is a defect, never a rebaseline.
- **`device`'s shape changes.** Every consumer is in this repo (`runtime` is private); the API report shows the change.
- **Timing in `poll(nowMs)`.** Play polls once per fixed step, from the app loop's step time. Menus keep `menuPad` until M4.5, so the repeat is proven at unit level here.
