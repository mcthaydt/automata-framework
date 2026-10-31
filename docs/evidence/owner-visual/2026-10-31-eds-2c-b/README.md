# EDS.2c-b: Ship, the Review desk and Import (review images, 2026-10-31)

New screens; no existing golden or screenshot changed. Captured by `packages/editor-suite/src/shell/suite-ship.layout.test.ts` (memory ports, the change set "Faster player" with one write to `content/tuning.toml`, a failing `lint` check, and two reopened gates: Feel approved, Speed open), copied from the last browser of the layout run. Four sizes of spec §10 per screen: iPad 11″ landscape (1194×834), portrait (834×1194), iPad mini landscape (1133×744, the short tier) and phone portrait (390×844).

| Screen | What it shows | What to check |
|---|---|---|
| `ship-dialog-*` | The Ship dialog (§9 `ship-dialog`): title, the description drafted from the journal (changes, checks with findings, gates), the failing-check warning (Ship still allowed), files and gates, Cancel and Ship (48 px) | The description is editable; the warning is amber; Ship stays reachable at every size |
| `review-desk-*` | The Review entry (§9 `review-desk`, replacing "comes in a later update"): the change set, branch and tokens; the diff from where it started; the failing check with its finding; each gate with its decision and record link | No button records anything; an open gate reads "open, no decision yet"; an approved gate is still listed as reopened |
| `interchange-*` | Import (§9 `interchange`): a pasted scene-interchange v2 document, its plan (one change, its diff, the gates it reopens, its checks) and Apply (48 px) | Apply is enabled only on an applicable plan; the diff scrolls sideways inside the dialog |

Also new on Home: Export and Import buttons above the cards (visible in each image behind the dialog), and Ship in the top bar whenever the change-set port is there.

Known, not changed here: the toast "Locked values were cleared when the page reloaded" covers part of the bottom rail on a phone (follow-up from #275); the file chooser uses the browser's own control.
