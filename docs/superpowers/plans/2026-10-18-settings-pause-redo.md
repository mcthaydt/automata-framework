# Settings and Pause redo, to FloorFifty's layout and function: TDD plan

- **Task:** the follow-up row "Settings and Pause redo (Owner rejection)" in [02](../../02-master-delivery-plan.md), after M4.4 (#87) and M4.7 (#88).
- **Owner, 2026-10-18 (via the Desk):**
  - the M4.4 Settings screen is rejected;
  - "Match the layout and function, not the style": FloorFifty's Settings and Pause are the reference for structure, grouping, order, what is on each screen, how rebinding, reset and quality work, scrolling, the dimmed backdrop, tap targets and behaviour at each size. AF keeps its own look, finished and polished;
  - a standing rule: nothing visual goes to the Owner before it is compared side by side with the matching FloorFifty screen and the gaps are fixed. M4.7's gate and rotate hint get the same check.
- **Lanes:** ui, game. **Depends on:** M4.4 and M4.7, merged.
- **Status:** Plan drafted 2026-10-18.
- **Progress:** 12 of 14 steps.

## Sources, read at these commits

- **FloorFifty at `a28dc44`** (`/home/user/floorfifty`):
  - `apps/client/src/ui/components/PauseOverlay.svelte` (182 lines):
    - a `Modal` that fades in over the game, titled "Paused", with a status line;
    - a menu of Resume (primary), Mute, Settings and Leave, one column, two across once the dialog is 340 px wide;
    - Settings opens _inside the same dialog_, with a "← Back" under it;
    - Leave asks first (a confirm view with the destructive action primary and Cancel);
    - Escape steps back one level: from Settings or Leave to the menu, and from the menu it resumes. Focus lands on the button the view was opened from.
  - `SettingsPanel.svelte` (381):
    - two tabs, Settings and Controls; the section scrolls under the tabs in one `ScrollList` that fades and counts what is below;
    - grouped fieldsets with legends: Language; Audio (mute, mute when unfocused, three volume sliders with their percentages, rumble); Display (toggles, then Graphics quality: the name on its row and the three choices together under it); Touch controls (coarse pointer only);
    - groups two across when the dialog is at least 560 px wide;
    - every row a 44 px target;
    - settings apply and save live; there is no Apply button;
    - Controls: one section per input method, the one in the player's hand first and marked "current", each a list of keys or buttons and what they do.
  - `Modal.svelte`:
    - dims the page (ink at 45%) rather than blurring it;
    - the dialog stays inside the visible band and the safe area, and clear of the host's strip;
    - it widens on a short, wide band so the settings' groups go two across;
    - a visible Close; Escape and Tab handled; focus in on open and back to the opener.
  - `LandscapeGate.svelte`, `RotateHint.svelte`, `FullscreenPicker.svelte`: M4.7's sources; checked again in step 7.
- **AF on `main` (`7a37588`):**
  - `packages/game/src/screens/PausedScreen.svelte`: a full `ScreenFrame` with "Paused", Resume and Quit to title at the bottom, and a gear in the corner. No dim, and no confirm on Quit.
  - `packages/game/src/screens/SettingsView.svelte` and `settings-screen.svelte.ts`, `packages/ui/src/settings/{SettingsScreen,ControlsSection,DisplaySection}.svelte`: a full-screen frame with Back, Controls (a row per action with a rebind button per device), Reset and Display (quality, reduced motion). No tabs, groups or dim; the stage shows through undimmed.
  - `packages/ui`: `Modal`, `ScrollList` (FloorFifty's), `OptionGroup`, `Button`, `IconButton`, `Toggle`, `Slider`.
  - Flow: `paused ⇄ settings` are two screens (M4.4); the tests rely on focus coming back to Settings from Settings' Back (F-b), the back gesture (F-c), and the `settings.sections` slot.

## Scope

**In:**

- **Paused**, as FloorFifty's: a dialog over the dimmed game, titled "Paused"; a menu of Resume (primary), Settings, and Quit to title, two across from 340 px; Quit to title asks first (confirm view: "Quit to title? This run is lost." with Quit primary and Cancel); Escape steps back one level; the pad's B does the same.
- **Settings**, as FloorFifty's, in the same dialog frame and size over the same dim, with "← Back" under it:
  - tabs **Settings** and **Controls**, the section scrolling under them in one `ScrollList`;
  - **Settings** tab: grouped fieldsets: Display (Graphics quality as the name on its row and the three choices under it; Reduced motion, read from the device), Touch controls (button or swipe mode, coarse pointer only, when the game offers both), then each extension's `settings.sections`; two groups across from a 560 px dialog;
  - **Controls** tab: one section per device the player can use, the current one first and marked "In use": Keyboard (each action's row: its name, its key as a rebind button), Controller (once a pad has connected: the same with pad buttons), Touch (what the on-screen buttons do; no rebinding, §4.5), then **Reset controls**; the capture status line above the rows, as M4.4's;
  - live apply and save, as now.
- Flow and focus as now: `paused ⇄ settings` stay two flow screens, so F-b, F-c, the back gesture, the host's back and the `settings.sections` slot keep working. The two screens share one dialog frame, so going between them reads as one dialog changing its view, as FloorFifty's does.
- **M4.7 check** (step 7): the gate and the rotate hint side by side with FloorFifty's at each size, gaps fixed.
- Side-by-side screenshots (AF and FloorFifty, same sizes) to the Desk, never straight to the Owner.

**Out:**

| What                                                               | Where                                                          |
| ------------------------------------------------------------------ | -------------------------------------------------------------- |
| Audio group (mute, volumes, mute when unfocused) and Mute in Pause | M5.4 (next in the queue), into the group structure this builds |
| Language picker                                                    | PRODUCT.L / the endonyms follow-up                             |
| FloorFifty's look (colours, fonts, art)                            | Not copied (Owner): AF's own theme tokens                      |

## Steps

Each step starts with its test, run red, with the failure reason recorded. Layout steps run the `layout` project at every reference size and variant in three engines.

- [x] **1. This plan,** and the 02 row. _Verify:_ `pnpm format`.
  - _Done: a5f9427._
- [x] **2. FloorFifty reference captures.** FloorFifty's pause and settings (both tabs) at 390×844, 844×390, 780×270, 820×1180 and 1280×720, built from `a28dc44`, kept with the evidence (`docs/evidence/owner-visual/…/floorfifty/`). No code.
  - *Done: `docs/evidence/owner-visual/2026-10-18-redo/` (README pairs every AF capture with FloorFifty's). FloorFifty's `PauseOverlay`, `LandscapeGate` and `RotateHint` mounted alone in its client (uncommitted harness, removed), 820x1180 and 1280x720 in place of the other two sizes named above as the Desk's reference set. Set beside AF's, three gaps found and fixed test-first:*
    - *Pause widened to 704 px on a short band (FloorFifty widens only Settings): `Modal` takes `wide`, Settings passes it (red: 704 > 512);*
    - *Resume's focus ring was cut by the dialog's scroll body: the body keeps the ring's room (red: clipped);*
    - *Controls, Settings' only section, was held to half the dialog by the two-across grid, its inputs far from their actions: a lone section spans, and the label is a column (red: 318 of 660 px).*
  - *ui layout 608 of 608 and game layout 100 of 100 in Chromium after the fixes.*
- [x] **3. `PauseDialog` frame** (`packages/ui/src/dialog/PauseDialog.svelte`, DOM test then layout test). _Red:_ the frame dims the page behind (a scrim with the theme's dim token), centres a dialog within the visible band, the safe area and the host's strip, holds the page like `Modal` (inert behind, focus in, Escape calls `onback`), widens on a short wide band (the container query FloorFifty uses), and keeps a 44 px Close.
  - _Done as an extension of ui's Modal rather than a new frame (AF's Modal is FloorFifty's, with the page held, focus in and out, Escape, a 44 px Close and the dim). Added: the panel is container af-dialog, so content lays out by the dialog's width; on a short or compact band it widens to 44rem. Red: 512 px at 844x390 (expected at least 560), then green; dialog layout 27 of 27 in Chromium (all engines in step 8's gates). Step 2 (FloorFifty captures) waits for the machine to be free of M4.10's gates._
- [x] **4. Paused** (`PausedScreen.svelte`, `default-screens.test.ts`, `screens.layout.test.ts`). _Red:_
  - the menu: Resume primary and focused, Settings, Quit to title;
  - two across at a 340 px dialog;
  - Quit asks first; Cancel returns to the menu with focus on Quit;
  - Escape resumes from the menu and steps back from the confirm.
  - _Done: d0a784f. On Modal; game screens 41 of 41._
- [x] **5. Settings tabs and groups** (`ui/src/settings/`, `SettingsView.svelte`). _Red:_
  - two tabs with Settings first;
  - the Settings tab's fieldsets with legends, Touch controls only on a coarse pointer with both modes;
  - extension sections after the core groups;
  - two across from 560 px;
  - one `ScrollList` under the tabs that counts what is below.
  - _Done. `SettingsScreen` takes `tabs` (`SettingsTab`); one tab draws no tab list. Two findings at the layout contract, fixed test-first:_
    - _on a short band the tab row cost the list its first row (780x270: the quality choices clipped). Modal gained a `head` slot, beside the title from a 480 px dialog and under it below that (red: no head; then green, dialog layout 3 of 3);_
    - _under TV scale (1.333) on 667x375 and 780x270 the full-width Back row still clipped them. On short and compact bands Back under the dialog is not drawn; the dialog's Close, named Back, does the same, as FloorFifty's Settings from its title has only its Close. Tall bands draw both, as FloorFifty's pause. The contract's essentials are the Close, Back where drawn, the tabs and the tab's first row._
  - _Touch controls stay in ControlsSection until step 6 moves them to the Settings tab._
  - _Settings layout 102 of 103 in Chromium: the one red, Controls under TV scale at 780x270 (each row stacks its rebind buttons), is step 6's first red._
- [x] **6. Controls by device** (`ControlsSection.svelte`). _Red:_
  - a section per device, the one in use first and marked;
  - the controller section only after a pad connects;
  - the touch section describes the buttons;
  - rebind, capture, conflict, reserved, cancel and reset keep M4.4's behaviour and tests;
  - Reset at the end of the tab.
  - _Done. Red: 7 of 7 ControlsSection tests (no device sections), TouchSection unresolved, and two game tests (the device order; the touch mode on a coarse pointer). Then green: ui 524 of 524, game 133 of 133; Settings and dialog layouts 103 of 103 in Chromium (step 5's one red, Controls under TV scale at 780x270, now passes with one rebind button a row)._
    - _The device in use comes from ui's `InputMethodTracker` (a key or a finger, as play's touch buttons) and the Input's device (a pad press): raw touches do not change the Input's device._
    - _The section's own "Controls" heading went (the tab names it); its name is the section's `aria-label`._
    - _`ControlsCopy` gained `touch` and `inUse` and lost `touchMode` and `touchModes`, which are `TouchSection`'s `TouchCopy`; `ControlsSection` lost its `touch` modes prop, and its `touch` now says whether to draw the Touch section. ui is pre-1.0: a patch._
- [x] **7. M4.7 against FloorFifty.** The gate and the hint at each size beside FloorFifty's `LandscapeGate` and `RotateHint`. Gaps found are fixed test-first; none found is recorded with the images.
  - *Done. The gate matches FloorFifty's (structure, words, one primary action). The rotate hint differs in function: FloorFifty's is a dismissible toast for a game that plays both ways; AF's is M4 spec §4.9's blocking cover over a game locked to one orientation. Matching it would change the approved spec, so it goes to the Desk (README), unchanged here.*
- [ ] **8. E2E, evidence and gates.**
  - The matrix and rebind journeys follow the new test ids.
  - Side-by-side captures, AF beside FloorFifty, of Paused, Settings (both tabs) and the covers, at each size, sent to the Desk.
  - Gates: `pnpm format`, `pnpm check`, CI extras, `pnpm test:parity`, `CI=1 pnpm test:e2e`, prepare-ruken.
  - Records: 02, 03, this plan.

## Owner rulings and Desk review, 2026-10-18 (steps 9 to 14)

The Desk reviewed the side-by-sides: Pause is good; Settings is not ready. The Owner then ruled:
- **Language, Audio and Vibration are required framework Settings groups**, beside Display, matching FloorFifty's layout and function (lifted from FloorFifty `SettingsPanel.svelte`, `LanguagePicker.svelte`, `i18n/locales.ts`, `managers/audio`, `systems/haptics.ts`, generalised).
- **The orientation hint is configurable:** `rotateHint: 'block' | 'toast'`, `'block'` by default (M4 spec §4.9 as it stands), `'toast'` FloorFifty's dismissible message.
- The Desk: Settings fills the phone's height as FloorFifty's does, with the list, its "+N more" and Back at the bottom; the evidence is shot over a real-looking game frame.

M5.4 (#92) is folded into this branch (the Audio group, Pause's Mute; its plan holds its record).

- [x] **9. Language group.** *Red:*
  - `Locale` says the player's choice (`choice`: a locale, or null for Automatic);
  - ui `LanguageSection`: Automatic, then each of the game's locales by its endonym (its own name in its own language, from `Intl.DisplayNames`, a game's own name winning), each in its own `lang`; a pick calls `Locale.set`;
  - the game's Settings tab: Language first, as FloorFifty's.
  - *Done. Red: `locale.choice` undefined; `LanguageSection.svelte` unresolved; the game's first group was Display. Green: runtime locale 31 of 31, ui 532, game 141; Settings, layout and dialog layouts 134 of 134 in Chromium.*
    - *The groups follow FloorFifty's order: Language, Audio, Display, then Touch controls and extensions; on a wide dialog Language sits beside Audio.*
    - *`GameSpec` gains `locale` (passed to the runtime): a `defineGame` game could not declare its languages before.*
    - *`OptionGroup` gains an option's `lang` and `legendHidden`.*
    - *M5.4's D-pad test walked Pause by the menu's repeat on the wall clock, which Mute's extra step outran (it failed on M5.4's own head too); it now taps once a step and checks each tap moves focus.*
- [x] **10. Vibration group.** *Red:*
  - runtime `Haptics`: `pulse` rumbles the first pad with an actuator, else buzzes a touch phone (`navigator.vibrate`), else nothing; never throws; off while the setting is off; `supported` says whether this device can do either (FloorFifty `systems/haptics.ts` and its tests);
  - the core settings keep `haptics.enabled`;
  - ui `VibrationSection`: one toggle; the game's Settings tab shows it only where `supported`.
  - *Done. Red: `haptics.manager.js` unresolved (FloorFifty's routing tests, generalised to a game's `HapticPulse`); the core settings lacked `haptics`; screens got no `Haptics`; the game's Vibration group absent and the saved setting not applied. Green: runtime haptics 6, settings 20, boot 1 new; game 144; settings layouts 78 of 78 in Chromium. `VibrationSection`'s one DOM test was written beside it (red only as an unresolved import).*
    - *`Haptics` is a runtime service (the 13th), the browser's by default (`browserHaptics`: pads, `navigator.vibrate`, a coarse pointer), a seam in tests. The group sits after Audio, where FloorFifty keeps its rumble row.*
- [x] **11. A sample sound on a volume's release.** *Red:* releasing a bus's slider plays a short sample on that bus (FloorFifty `requestUiSound`), a tone the graph makes, so no game asset is needed.
  - *Done. Red: `audio.sample is not a function`; no sample on a slider's `change` (ui); the game's released slider played nothing. Green: audio 50, ui settings and controls 36, game 145. The tone is a 120 ms 660 Hz sine falling to silence, made once in the graph's context (`createBuffer`, `sampleRate` join `AudioContextLike` and its fake) and played as a voice on the bus. `Slider` gains `onrelease`.*
- [x] **12. Settings fills a phone's height.** *Red:* on a phone (`phone-portrait`, `phone-landscape`), Settings' dialog fills the visible band's height, the list taking the rest, Back at the bottom (FloorFifty `Modal.svelte`'s body that scrolls in its own list).
  - *Done. Red: with a short tab (`settings-short`, Display alone) the dialog took 40% of an iPhone 14's band. `Modal` gains `fill`: on a phone (`data-form-factor` phone-portrait or phone-landscape) the dialog is the band's height, the body taking the rest and the actions at the bottom; Settings passes it. A desktop keeps to its content. Green: Settings and dialog layouts 134 of 134 in Chromium (the contract now covers `settings-short` at every size and variant).*
- [x] **13. `rotateHint: 'block' | 'toast'`.** *Red:* a game's `rotateHint: 'toast'` shows a dismissible message (FloorFifty `RotateHint.svelte`: "Turn your phone for a bigger view", OK, remembered) and does not pause; the default stays the blocking cover. M4 spec §4.9 records the amendment.
  - *Done. Red: with `rotateHint: 'toast'` the policy still showed the cover and paused. Green: display policy 13 of 13 (the toast shows without pausing, goes when dismissed or turned; the default still blocks), runtime 447, game 145. ui `RotateToast`; `rotateHint` on `GameDefinition` and `GameSpec`, passed by boot.*
    - *Deviations from FloorFifty's toast: dismissal lasts the session (FloorFifty saves it on the device; AF would need device storage outside `Hosting`, which its rules refuse; M5.2's per-device settings can carry it), and it does not retire itself after 6 s (no timer outside `Time`). The plumbing from `GameSpec` to the policy is typechecked, not tested end to end; the toast's layout contract is in step 14's evidence.*
- [ ] **14. Gates and evidence.**
  - *The Desk's round-2 polish, test-first: (1) sliders draw a 20 px thumb (scaled with TV mode) on the 44 px input, which stays the target, and the track fills with the accent up to the value (`--af-slider-fill`; red: no fill property); (2) a `wide` dialog widens wherever there is room, so on a 1280x720 desktop Settings sets its groups two across and the groups a desktop shows fit without scrolling (red: Language over Audio in one column). Settings, controls and dialog layouts 135 of 135 in Chromium.* Gates as step 8; side-by-sides over a real-looking game frame, sent to the Desk; not merged until the Owner has reviewed it.

## Verification

Layout and function match FloorFifty at every reference size (the Desk checks the side-by-sides first). Owner visual acceptance stays open until the Owner gives it.
