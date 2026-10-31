# ED2D.7b review images (2026-10-31)

Screenshots from `packages/editor-2d/src/app/export/export-view.layout.test.ts`: the production CSS in a real browser at
the 2D editor's sizes (spec §12), Firefox's run (the last of the three). The project is the Mossgate sample, seeded
with the Checks view's findings, so the error callout shows ("2 errors"). These are a new screen; no golden or committed
screenshot changed.

| Image | What it shows |
| --- | --- |
| `export-view-ipad-pro-11-landscape.png` | The reference size: both targets checked with their sizes, the 5 files with theirs and the total, the error callout, and the actions at the foot: Download (primary, 48 px), then Share and Copy (disabled: they take one file) and Write to folder (disabled: there is no game folder yet), each with its reason. |
| `export-view-ipad-pro-11-portrait.png` | Medium: the rail is the tab bar; the same content at full width. |
| `export-view-ipad-mini-landscape.png` | Wide but short. |
| `export-view-phone-portrait.png` | Compact: the actions wrap onto two rows and stay at the foot. |
| `export-view-phone-landscape.png` | Compact and short (390 px tall): the targets and files scroll in their own region; the actions stay in view above the status line and the tab bar. |

Not shown: the folder write and its conflict dialog (no game folder can be attached until ED2D.8; the DOM tests cover
them over a folder-kind store). Real-device testing stays the Owner's.
