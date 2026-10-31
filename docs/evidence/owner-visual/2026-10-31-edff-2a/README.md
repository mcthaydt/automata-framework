# EDFF.2a-1 review images (2026-10-31)

The Stage view from `packages/editor-2d/src/profiles/floorfifty-stage/views/stage-view.layout.test.ts` (a Chromium
run) and Home from the existing `home` layout test (the parity run), at the 2D editor's sizes (spec §12). The stage
is a Simple city stage with one override (MAX_MOVE_SPEED 400). No golden or committed screenshot changed.

| Image | What it shows |
| --- | --- |
| `stage-view-ipad-pro-11-landscape.png` | New screen. The stage profile's rail (Scene, Course, Pieces, Stage, Assets, Checks, Export; only Stage is built here) and the Stage view's form: Identity (Id, Name, Unlock, Platform), Presentation (Refraction, Horizon lift, the light height, shimmer and silhouette check boxes, Remove presentation), then Course tuning further down. |
| `stage-view-ipad-mini-portrait.png` | Medium: the rail is the tab bar. |
| `stage-view-phone-portrait.png` | Compact: the form at full width, scrolling in its own region. |
| `stage-view-phone-landscape.png` | Compact and short. |
| `home-ipad-pro-11-landscape.png` | Changed screen. With two profiles registered, Home's template cards carry their kind's tag (the existing rule for more than one profile), and the stage's Empty, Sky only and Simple city follow the level project's three templates. |

The rail says "Scene" where the spec says "Compose": "Compose" is cut ("Comp…") in the 56 px rail (plan decision 5).
Real-device testing stays the Owner's.
