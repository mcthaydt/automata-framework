# @mcthaydt/automata-ui

## 0.0.3

### Patch Changes

- 221a178: Document the exports of ui: the geometry owner and its types, the device, form factor and height tier classifiers, the landscape gate, the focus navigator, the input method tracker, the hidden browser bar, the action bar and boot failure types, and the `@component` comments of ActionBar, CornerControls, Dialog, ErrorPanel, BootFailurePanel, LoaderOverlay, ScreenFrame and ScrollList.
- a52d4ec: Add BootDefect support to boot failure panel so unexpected runtime defects render with full error details and retry support.
- e317692: Touch input (M4.3): `TouchControls`, sticky on-screen buttons that hold an action while any finger is on them and hide without remounting; `SwipeSurface`, which forwards fingers to a gesture tracker and draws the thumb's line; and the `PointerLatch`, `StickyPointers` and `nearestTarget` bookkeeping behind them.
- ddd4f23: Rebinding and Settings (M4.4): `Prompt` and its labels (`keyLabel`, `padLabel`, `promptView`, `readKeyboardLayout`); `ControlsSection`, `DisplaySection` and the core `SettingsScreen`, whose sections are the screen's snippets or an extension's `settings.sections` components. The private runtime and game packages gain the saved bindings (`inputSettingsSchema`, `applyOverrides`, `rebindProfile`, `Input.rebind`, `resetBindings`, `capture`), the core settings (`CORE_SETTINGS`), `keys()` labels, and the default Settings screen reached from paused.
- 687882c: M4.5 focus, back and cursor: `FocusNavigator` gains `steer` (spatial inside a `[data-focus-grid]`, DOM order elsewhere), `page`, `adjust` and the keyboard repeat `guard`. New exports: `sendBack` and `interceptBackGesture` (the system back gesture as Back, history key `afBackGuard`), `CursorRunner`, `cursorHidden` and `CURSOR_IDLE_MS` (an idle pointer hides on `gameplay` screens only), and the paging helpers `isTap`, `releaseStep`, `WheelPager` and `PAGE_SWIPE`. Additive for every caller.
  
  BREAKING: the API report counts `FocusNavigator`'s added methods (`steer`, `page`, `adjust`, `guard`) as a changed class. Every existing call behaves as before.
- 163cc16: Adds the M4.6 primitives: `Split`, `OptionGroup`, `PagerDots`, `PagedGrid` (with `paginate`, `fitShape`, `tileSide`, `trimRows`, `fitColumns`, `pageOf` and `wrapPage`), `Button`, `IconButton`, `Toggle`, `Slider`, `Chip`, `Modal`, `Sheet` and `Toast`, with the `--af-success` and `--af-danger-edge` theme tokens. `Dialog` now shares its modal scoping with `Modal` and `Sheet`; its behaviour is unchanged. Every visible string is a prop, and a nameless `IconButton` or a toned `Chip` or `Toast` without its `toneLabel` throws while it mounts.
- 84eddc1: Display policy (M4.7): `LandscapeGate` and `RotateHint`, standalone fullscreen (`fullscreenSupport`, `isFullscreen`, `onFullscreenChange`, `enterFullscreen`), and the touch overlay's reduced set: a `TouchButtonSpec` marked `required` stays when the buttons do not all fit, never shrunk. The touch group's sticky margin no longer reaches over what sits above it, and the layout contract reports a control under a touch button. The private runtime and game packages gain the display policy (the landscape gate standalone only, the rotate hint pausing under `display`), `GameSpec.orientation`, `keys()`'s `required`, and the play screen's `hud.overlay` slot.
- b73f772: Adds `SaveStatus` and `SaveSlots` for a game's saves (M5.2). `SaveStatus` says the host's save state in words (checking, syncing, saved, offline, retrying, conflict, recovered, or "no grant") in a polite live region that is not focusable, and renders nothing where there is no status (standalone). `SaveSlots` is the slot list: rows are chosen, and the chosen row's actions (Continue, New game, Delete… behind a confirming dialog whose safe button has focus) sit in an action bar; the rows scroll in their own list and a label and a time wrap to two lines. Both take the caller's words and times, and read no store. Also exports the types `SaveStatusState`, `SaveStatusCopy`, `SaveSlotView`, `SaveSlotsView`, `SaveSlotsCopy` and `SaveSlotActivity`, and the helpers `SAVE_STATUS_TONES`, `defaultSlot` and `slotActionsOf`.
- bfc467e: The Audio settings group (M5.4): `AudioSection`, laid out as FloorFifty's (Mute, Mute in the background, a slider per bus with its percentage; unavailable when sound could not start; a note while the host's volume is down), with `AudioCopy`, `AudioValue`, `AudioSectionChange`, `AudioBus` and `AUDIO_BUSES`. `Slider` gains `layout: 'row'` (name, track and value on one row).
- 27726d2: M5.7 leaderboard flow. ui: `LeaderboardPanel` (loading, entries with the player's row marked, empty, unavailable, offline) and its `LeaderboardView`, `LeaderboardEntryView` and `LeaderboardCopy` types. ship: `prepareBuild` refuses a game that names a leaderboard its ship config does not declare (`UndeclaredBoard`, with the call site), and exports the scan (`findUndeclaredBoards`, `boardNamesIn`, `declaredBoardsIn`, `isBoardSource`). (The cli's new `automata check` step `boards`, rule `undeclared-board`, needs no changeset: the cli is private.) Additive for every caller.
- 72568b9: The boot-failure panel's exit button names the host and needs the `exit` grant: `BootFailurePanel` takes `hostName` and `canExit`, `bootFailureView` takes `canExit`, the default copy is `Back to {host}` (filled by the new `withHostName`), and "Back to …" is never drawn when the host did not grant `exit`. The (unpublished) runtime passes them from `Hosting`. Inside Ruken, which always grants `exit`, the panel still says "Back to Ruken".
  
  BREAKING: `BootFailurePanel` gains the required props `hostName` and `canExit`, and `bootFailureView` gains the required third parameter `canExit`, so a caller that draws the panel itself must pass them. The default `exit` copy changes from `Back to Ruken` to `Back to {host}`; a game's own copy may use `{host}` too.
- b64e6c4: Settings and Pause, laid out as FloorFifty's (Owner, 2026-10-18): `SettingsScreen` is a dialog of tabs (`SettingsTab`: Settings, Controls) over the dimmed game; `ControlsSection` has one section per device, the one in use first and marked, with one rebind button a row; `TouchSection` is the Touch controls group. `Modal` gains `head` (beside the title on a wide dialog) and `wide` (widens on a short band), and keeps room for a focused control's ring. `ControlsCopy` gains `touch` and `inUse` and loses `touchMode` and `touchModes` (now `TouchCopy`). The private game package's Paused screen becomes FloorFifty's pause dialog, with Quit asking first.
  
  `ScrollList` and `TouchControls` no longer measure their element after it unmounts (Svelte sets it to null).
  
  The Owner's Settings groups (2026-10-18): `LanguageSection` (Automatic, then each language by its endonym, `endonymOf`, `LanguageCopy`) and `VibrationSection` (`VibrationCopy`); `OptionGroup` gains an option's `lang` and `legendHidden`; `Slider` gains `onrelease`, and `AudioSection` asks for a sample on it (`onsample`); `Modal` gains `fill` (a phone-height sheet). `RotateToast` and `RotateToastCopy` for a game's `rotateHint: 'toast'`.
- Updated dependencies [b9f9a5b]
- Updated dependencies [ecf937f]
- Updated dependencies [e6b642f]
- Updated dependencies [50ec5a9]
  - @mcthaydt/automata-testing@0.0.3

## 0.0.2

### Patch Changes

- @mcthaydt/automata-testing@0.0.2

## 0.0.1

### Patch Changes

- c7ae066: First published build (M2.4): every package builds to `dist/` with tsdown (ui with svelte-package), bundles the
  vendored Ruken code it needs, and publishes to GitHub Packages. `check-boundaries` is now
  `@mcthaydt/automata-check-boundaries` with an `automata-check-boundaries` bin.
- Updated dependencies [c7ae066]
  - @mcthaydt/automata-testing@0.0.1
