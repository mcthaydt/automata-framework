# M5.4 Audio settings section: TDD plan

- **Task:** M5.4 in [02](../../02-master-delivery-plan.md). M5 spec [§7](../specs/2026-10-16-m5-saves-audio-design.md) (UI inventory: the Audio settings section) and §4.6 (core audio), acceptance A-e.
- **Lanes:** ui, with runtime and game for the wiring. **Depends on:** M5.3 (core audio, merged), M4.4 and M4.6 (merged), and the Settings and Pause redo (#91), whose Settings tab groups this joins.
- **Status:** Plan drafted 2026-10-18.
- **Progress:** 1 of 7 steps.

## Sources, read at these commits

- **FloorFifty at `a28dc44`** (`/home/user/floorfifty`), `apps/client/src/ui/components/SettingsPanel.svelte`:
  - the Audio group is a fieldset with a legend, on the Settings tab beside Language (two across from a 560 px dialog);
  - rows, each a 44 px target: Mute, Mute in background (`muteUnfocused`), then one slider per volume with its name on the row and its percentage after it (`formatPercent`), then rumble;
  - every change applies and saves at once; there is no Apply button;
  - Pause has Mute as its second button (`PauseOverlay.svelte`), which toggles the same setting.
  - `common/settings.ts` keeps the audio fields on the device (`keepAudioOnDevice`; Owner 2026-10-10: "muting a Mac must not mute the same player's iPad").
- **AF at `c2fe68e`** (the redo branch, `main` `c2cca72` merged in):
  - `packages/runtime/src/audio/`: `Audio` (`setMuted`, a master-only mute), `AudioBuses` (`gain`, `setGain` per bus), `audioBusGainsSchema` (five buses, each 0..1, a missing one at full), `AUDIO_BUS_NAMES`. `muteUnfocused` is a construction option only, not a live setting. The host's volume arrives as `Hosting.audio` changes, already combined in `gain`.
  - `audio.unavailable` on the presentation bus when the context cannot be built (A-e's runtime half, M5.3).
  - `packages/runtime/src/settings/core-settings.ts`: `CORE_SETTINGS` v1 holds `input` and `display`; no `audio` yet. Per-device fields (`deviceFields`, spec §4.5) are M5.2's.
  - `packages/ui`: `Slider`, `Toggle`, `OptionGroup`; the Settings tab's groups (`SettingsTab`, `TouchSection`, `DisplaySection`) from the redo.

## Scope

**In:**
- `AudioSection.svelte` in `ui`: a group titled Audio, laid out as FloorFifty's. It has:
  - Mute;
  - Mute when in the background;
  - one slider per bus, in the order master, music, sfx, ui, voice, each with its name and its percentage;
  - states: ready and unavailable. Unavailable means audio could not start: the section says so, and its controls are disabled but still shown;
  - "The host's volume also applies" when the host's volume is below 1.
- Core settings v2 gain `audio: { muted, muteUnfocused, gains }`, with a migration from v1 that fills the defaults (not muted, full gains).
- `Audio` takes the mute-when-unfocused setting live (`setMuteUnfocused`), as it takes `setMuted`.
- The default Settings screen's Settings tab: Display, Audio, Touch controls, then extensions; the two-across grid sets Display beside Audio. A change applies at once (`setMuted`, `setGain`, `setMuteUnfocused`) and saves through the settings store.
- Pause gains Mute as its second button, as FloorFifty's; it toggles the same setting.

**Out:**

| What | Where |
|---|---|
| Audio fields kept on the device, not the account (`deviceFields`) | M5.2 (spec §4.5). Until then they save with the other core settings; the plan's step 7 records the gap in 03 |
| Rumble | Not in AF's core (no vibration in the M4 input spec) |
| Language group | PRODUCT.L and the endonyms follow-up |

## Steps

Each step starts with its test, run red, with the failure reason recorded.

- [x] **1. This plan,** and the 02 row. *Verify:* `pnpm format`.
- [ ] **2. Settings v2** (`runtime/src/settings/core-settings.ts`, `audio-settings.schema.ts`, tests). *Red:* a v1 record reads as v2 with audio defaults; a bad audio record falls back to the defaults; the saved shape round-trips.
- [ ] **3. Live mute when unfocused** (`runtime/src/audio/audio.manager.ts`, `audio.test.ts`). *Red:* `setMuteUnfocused(true)` silences the master on `blur` and restores it on `focus`; `false` leaves it alone; the construction option still works.
- [ ] **4. `AudioSection`** (`ui/src/settings/AudioSection.svelte`, `audio-section.ts`, DOM test). *Red:*
  - two toggles and five sliders in FloorFifty's order, each named, each slider showing its percentage;
  - a change reports its field and value;
  - unavailable: the message shows and the controls are disabled;
  - the host's note shows only when its volume is below 1.
- [ ] **5. Layout** (`ui/src/testing/SettingsFixture.svelte`, `settings.layout.test.ts`). *Red:* the Settings tab with Display and Audio at every reference size and variant: every toggle and slider thumb a whole 44 px target; Display beside Audio from a 560 px dialog; the first row in view.
- [ ] **6. Wiring and Pause's Mute** (`game/src/screens/{SettingsView.svelte,settings-screen.svelte.ts,PausedScreen.svelte,default-screens.ts}`, `default-screens.test.ts`). *Red:*
  - a slider moves its bus's gain and saves it;
  - Mute mutes and saves it, and Pause's Mute shows and toggles the same setting;
  - `audio.unavailable` shows the section's unavailable state (A-e);
  - a saved setting applies at boot.
- [ ] **7. E2E, side-by-side and gates.**
  - The rebind and matrix journeys still pass.
  - Side-by-side captures beside FloorFifty's Audio group, sent to the Desk first.
  - Gates: `pnpm format`, `pnpm check`, CI extras, `pnpm test:parity`, `CI=1 pnpm test:e2e`, prepare-ruken.
  - A `ui` changeset (patch), alone.
  - Records: 02, 03, this plan.

## Verification

A-e passes in the game's tests and the section's unavailable state is in the layout contract. Owner visual acceptance comes after the Desk's side-by-side check.
