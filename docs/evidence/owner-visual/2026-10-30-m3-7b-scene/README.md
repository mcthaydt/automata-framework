# M3.7b part 3: the first slice's scene (review images)

**What:** `games/base-3d`'s page drawn in 3D for the first time (M3.7b plan, part 3): the hall and the kiln from `src/content/first-slice.ts`, Wick and the target as figure content, the angled camera with its two views, the cut-away walls, the fading pillar, three static props from The Last Light and fog. New images, no baseline: nothing earlier drew base-3d.

**How they were made:** `pnpm --filter @af-games/base-3d build`, `vite preview`, Playwright's Chromium (SwiftShader WebGL2) at 844×390 and 780×270, standalone (no host frame). The script presses Play, then holds keys in real time: W to the doorway, W into the kiln, Shift held (lock), J (slash), K held (guard), D (strafe while locked), Shift released, E (turn the camera). Real-time holds under software GL, so Wick's exact spot differs run to run; the sim's route is proved by the golden, not by these.

| Image | What it shows |
|---|---|
| `*-1-hall` | The hall's view (yaw 0, 24 mm, 25° down, 5 m back). Wick at the spawn holding the sword; the pillar (2.4 m, west of the route), the pallet stack (west, near) and the oil drum (east, far). The south wall behind the camera is cut away; the side walls stand. |
| `*-2-doorway` | Wick at the doorway, still in the hall's view; the pillar is near the camera's line and is drawn at full opacity because it does not cover him here. |
| `*-3-kiln` | Past the doorway the view cuts to the kiln's (yaw 90, looking +x): the dividing wall is cut to its floor trim, the burner bench stands against the east wall, the target figure stands at (2, 9). |
| `*-4-lock` | Shift held: Wick turns to face the target and the camera leans its focus toward it (lock-on framing, up to 35%). |
| `*-5-slash` | J: the slash clip starts over the stance (right arm and torso only). |
| `*-6-guard` | K held: the guard stance raises the off arm. |
| `*-7-lock-strafe` | D while locked: Wick strafes, still facing the target; the framing follows both. |
| `*-8-kiln-turned` | Shift released, E held: the camera turns freely (120° a second on keys); the walls between the camera and Wick cut away to their trims, the far ones stand. |

**Things a reviewer will notice, all expected:**
- **The sky is near black (7, 4, 7).** The fog colour is Endesga 64 #2e222f; `@pixi/3d` 0.1.0-beta.2 draws a fully fogged surface as the colour's linear value, so render-pixi3d paints the sky the same so fogged walls meet it with no edge (S7-Q10, `light/view-fog.ts`). The 20 px bands at the top and bottom of 844×390 are the letterbox in the authored colour.
- **Tall things near the frame's edge lean outward** (the target, the drum, the pillar): a 24 mm lens pitched 25° down converges verticals. The Owner's camera (M3R-D20).
- **The props are The Last Light's palette**, not Endesga 64 (`games/base-3d/public/models/PROVENANCE.md`).
- **The pillar and the props have no collider** (the area's walls do); they stand off the golden's route up x = 0. Colliders come with `af-sector` rooms (GAME-3D.1i).
- **No touch controls in the images**: the page saw a mouse. Touch buttons come from `inputs()`; the analog stick and the camera drag are GAME-3D.1h's.
- The first figure build logs `figure on pose took ~110 ms (budget 5 ms)` under SwiftShader; the build budget is a device check (M3 spec, G3-u), not this run's.

**Acceptance:** for the coordinator to record once a reviewer has opened the images; real-device play is the Owner's.
