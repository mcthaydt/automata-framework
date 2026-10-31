# base-3d rescope: the free 3D game mirrors Emberwick; the adventure moves to Plus

Status: drafted 2026-10-31 by the coordinator; accepted on the Owner's words below; implementation rows in `docs/02` (GAME-3D.1j/1k/1l, M9.x, M6.12) are restated by this spec.

**The Owner's words** (2026-10-31, ~15:25Z): "Should we downscale the 3D even further? I'd prefer the 3D function nearly identical to 2D, but in 3D; the Zelda stuff should be in plus imo". Asked whether the free game keeps the playable hero (Wick, third person, free-turn camera) with all combat dropped, the Owner answered (~16:10Z, relayed by the previous coordinator): "Go with your recommendation". Auto-acceptance stands ("Reminder that everything is auto approved and accepted, do not wait on me to do any approvals", 2026-10-31).

This spec **wins** over `games/base-3d/DESIGN.md` §0 (the trimmed slice) and over GAME-3D.1 to 1l wherever they disagree.

## 1. Scope and ownership

| Game | Repo | Tier | What it is |
|---|---|---|---|
| `games/base-3d` | AF | free, core | Emberwick in 3D: the same flow, saves, settings and HUD pattern, one small area, simple pickups and a goal, a third-person hero (Wick) on the angled free-turn camera, procedural figures. **No combat, no lock-on, no enemies, no boss, no inventory of weapons, no dungeon pieces.** |
| `games/base-adventure` | automata-plus | Plus (free to use, separate repo) | The action-adventure: lock-on, combat, enemies and the Ashen Warden, items, the dungeon pieces and the 3-room Cold Kiln, as built in AF PR #354. M6.12. |

**Seed.** PR #354 (GAME-3D.1h + 1i) lands first with the full adventure inside `games/base-3d`. Then:

1. Plus copies the adventure from AF at that commit (provenance row in `docs/provenance/sources.md`: AF's own commit; M6.12).
2. A new AF row, GAME-3D.1m, strips the adventure from `games/base-3d` down to the free game below, keeping the free-package candidates (controller, camera, figures, 3D render) and their tests.
3. The sim goldens split: `base-3d` records a new route golden for the free game (the PR names the sim change and the removed behaviours; the old adventure goldens move to Plus with the code, where they stay asserted). A cross-engine mismatch is investigated, never rebaselined.

## 2. The free game (what stays in `games/base-3d`)

Mirror of `games/emberwick` (flow, saves, settings, HUD) with these 3D parts:

- **Flow:** splash → menu (New, Continue, Settings) → play → pause (Resume, Settings, Quit to title) → end screen (goal reached). Same screens, same words in the game's language, same Ruken/itch/web/tauri targets through `Hosting` (ADR 0006).
- **Saves:** one slot through `Hosting`; progress (embers collected, goal reached) with a migration from version 1; a denied or missing hosted capability never falls back to device storage.
- **Area:** one small room or yard authored as one `af-sector/1` file in ED3D, with camera-view ids and occlude walls where the room needs them.
- **Hero:** Wick as a procedural figure with the IK rig, idle and walk clips; third-person controller (camera-relative movement, linear ramp, M3R-D15 latch, heading in the sim); the angled 24 mm free-turn camera (25° down, 5 m back), on klipp where M9.1 pins it.
- **Pickups and goal:** embers (collectable, counted in the HUD); no health. A goal object ends the run, as Emberwick's goal does.
- **HUD and controls:** embers count, pause button, move stick plus camera drag on touch, keys and gamepad; 44 px touch targets; the landscape rotate gate as the 2D game decides for phones.
- **Content in the editors:** the room in ED3D, Wick in the Studio, text through core localization, tuning through the Tuner, sounds in the suite where EDS.0 gives a format.

Out of the free game: lock-on, combat, hurt and fall, health and hearts, enemies, the boss, weapons, shield, sling, bombs, hookchain, keys, doors, switches, blocks, chests as puzzle pieces, the map and inventory screens, ground-contact IK on stairs (GAME-3D.1g stays cut), cutscenes beyond the intro line.

## 3. Interfaces and ownership

- Free packages (AF): third-person controller and camera (M9.2), `figures` IK and poses, `render-pixi3d` (unpublished while D-1 stands). They never import a Plus package.
- Plus (automata-plus): lock-on (M9.3), combat (M9.4), items and inventory (M9.5), dungeon pieces (M9.6) as packages or `puzzle` kinds, and `games/base-adventure` on them (M6.12). Plus imports the free controller and camera.
- The adventure's code leaves AF only through the seed copy above; AF keeps no copy after GAME-3D.1m.

## 4. Failure and recovery

- If #354 fails parity, nothing in this spec starts; the seed commit is the merge commit of #354.
- If the Plus copy is not green on its own CI, GAME-3D.1m waits (the adventure must live somewhere green before AF deletes it).
- Save migration: version 1 saves written by the adventure (`resume: 'kiln'`, inventory fields) are not read by the free game; the free game's slot has its own `schema` id so a stale adventure save is ignored, not mis-read.

## 5. Acceptance cases

- **F3-a:** the journeys at the phone sizes cover splash → menu → play → collect every ember → goal → end, and pause/settings/quit.
- **F3-b:** a golden replay (new route golden) is identical in Node, Chromium, WebKit and Firefox.
- **F3-c:** `pnpm boundaries --game base-3d` is clean and the game imports only free packages.
- **F3-d:** a save written by the free game round-trips through `Hosting`; a denied capability shows the hosted failure, with no device fallback (adapter tests).
- **F3-e:** controls at 360×640 and 640×360: touch targets ≥ 44 px, camera drag and stick work together.
- **F3-f:** `base-adventure` in Plus passes the moved adventure golden with its hash unchanged from `base-3d`@#354.
- **Owner:** a real-device pass (Android phone and an iPhone) and visual acceptance against Emberwick's quality.

## 6. Row changes (applied in `docs/02` in the same PR)

| Row | Change |
|---|---|
| GAME-3D.1 | Restated: base-3d is Emberwick in 3D; the adventure is M6.12 in Plus |
| 1b to 1e | Done as the adventure's seed; their code moves to Plus (M6.12 and M9.3 to M9.5) |
| 1f dungeon pieces | Seed only; moves to Plus (M9.6); no further AF work |
| 1g ground-contact IK | Stays cut (M9.7 keeps the free `figures` probe only if the controller needs it; otherwise cut) |
| 1h, 1i | Finish with #354 as the seed |
| 1j figures | Wick only (the other characters belong to Plus content) |
| 1k text, tuning, audio, feel | The free game's strings, tuning and sounds; no feel or cutscene work in AF |
| **1m (new)** | Strip the adventure from `games/base-3d` to the free game (§2); new route golden; Plus copy green first |
| 1l gates, deploy, acceptance | Over the free game (F3-a to F3-e) |
| M9.2 | Third-person controller and camera, free: unchanged |
| M9.3 to M9.6 | Plus; unchanged, now fed by the seed copy |
| M9.7 | Shrinks to what Wick's walk needs, else cut |
| M9.8 | Brush environments: only what the one room needs, else deferred |
| M9.9 | base-3d on the free packages; no lock-on/combat/items/dungeon code to keep |
| M6.12 | Restated: the adventure, seeded from AF at #354's merge commit, Cold Kiln and Warden included |
