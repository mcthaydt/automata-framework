## Summary

M4.2 gamepad source ([plan](docs/superpowers/plans/2026-10-17-m4-2-gamepad-source.md); M4 spec §4.3, §4.2, §5, §6; M4-D2, M4-D3, M4-D9; acceptance I-c, I-d, I-e). Built on M4.1 (merged, #74): it feeds this into its `Input` rather than a second copy of the bookkeeping. `main` is merged in. The first commit is the TDD plan.

- **`packages/runtime/src/input/gamepad/`**, ported from FloorFifty `gamepad-source.ts` and `ui/glyphs.ts` at `ac72660`, with their tests:
  - `readPad`: radial deadzone 0.25, triggers from 0.5, menu directions along the stronger axis. Stick directions read eight-way, so (0.2, 0.2) moves (I-c).
  - `quantizeStick`: −127..127 per axis, radial, halves away from zero (M4-D2).
  - `HandoverMask`.
  - `NavRepeat`: 400 ms, then every 120 ms. A held direction fires at 0, 400, 520 and 640 ms (I-d timings).
  - `glyphFamily`.
- **`Input`:**
  - stick directions drive actions bound with `stick`;
  - `stick()` returns the active pad's quantized vector;
  - D-pad and left-stick menu directions repeat;
  - whatever a pad holds across `setContext` stays masked until it is released.
- **Hot-plug:**
  - `Input.pads`;
  - the `input.pad.connected` fact, with `standard` (feeds M4.6's "not supported" toast);
  - the `input.pad.disconnected` fact, with `wasActive`;
  - an unplugged pad releases what it held.
- **Active device:** `device` is now `{ device, glyphs }`. The newest pad to be used sets the glyph family (I-e).
- **Reserved button contract (M4-D3, R-3):** the vendored SDK's poller, driven through the fake host, summons the host on a button that `RESERVED_PAD_BUTTONS` holds (8). The test finds the button from the SDK's own `host.summon` and does not assume it.
- **Reconnect pause (M4-D9):**
  - `PauseReason` gains `input`;
  - the default play screen pauses with "Reconnect your controller" when the pad in use is unplugged;
  - Resume, Quit or Escape, from any device, clears it;
  - a spare pad, or play on the keyboard, does not pause.
- **`keys()`** gains a `stick` option.
- **Example:** `core-input-gamepad`, with a new 120-tick golden recorded once in Node that matches in Chromium, WebKit and Firefox.
- **Unchanged goldens:** Emberwick, `core-input-keys` and the I-a device hash.

**Left to their tasks:**
- the toasts: M4.6;
- focus moving on repeated nav, and the menus reading `Input`: M4.5;
- glyph labels and prompts, and `Hosting.input` under Ruken: M4.4;
- the unplug journey under the fake host: M4.10.

## Gates (local, `TURBO_FORCE=true`, re-run after merging `main`)

| Gate | Result |
|---|---|
| `pnpm format` | Clean |
| `pnpm check` | Passed, 30 of 30 |
| CI checks-job extras | Passed (changeset status, `check-changesets`, `build:examples`, `api-report`, `build`, `test:dist`, `api-index`, `agent-skills`, demos, size budget). The agent skill `api.md` was stale from M4.1; it was refreshed on M4.1 (`656cf2f`) and merged here. |
| `pnpm test:parity` | Passed, 11 of 11 (examples-runner 21 passed, 3 skipped), including `core-input-gamepad` in Chromium, WebKit and Firefox |
| `CI=1 pnpm test:e2e` | 74 passed, 2 skipped (after merging `main`) |
| `prepare-ruken` | Passed for Emberwick and the placeholder |

**Owner acceptance, not claimed:** real controllers (M4.10, spec §13).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01QQDa25MEpciFkK7k5UV2dC
