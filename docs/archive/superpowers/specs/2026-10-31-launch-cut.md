# Launch cut: what ships in AF 1.0 and what waits

Status: drafted 2026-10-31 by the coordinator; accepted on the Owner's words.

**The Owner's words** (2026-10-31): "I don't understand why it's taking so long - none of this seems particularly complicated", then "We were supposed to use my PC, Linux, and Mac for tests, double the context limit ; make the PRs WIDE, like big feature; let's cut". Auto-acceptance stands ("Reminder that everything is auto approved and accepted, do not wait on me to do any approvals").

## 1. What 1.0 is

AF core 1.0 with the two free reference games: **Emberwick (2D)** and **base-3d (Emberwick in 3D, the dodge roll as its verb)**, both authored in the editors (the 2D editor, the 3D editor and the Studio, the Tuner, audio), shipped to the four targets (web, itch, ruken, tauri) with the CLI, the guides and the website. Plus is a separate repo and free; the extensions already built there stay, and no further Plus extension gates the launch.

## 2. The cut (83 open rows, tagged "Post-1.0" in `docs/02`)

| Group | Rows | Why it can wait |
|---|---|---|
| Plus gameplay extensions | M6.1b, M6.1c, M6.4b, M6.5, M6.6b, M6.6c, M6.7a, M6.7b, M6.8c, M6.9b, M6.12, M6.13 | The adventure game and its extensions are not what 1.0 ships; their first parts are already in automata-plus |
| Online and store | M7.1, M7.6, M7.7a, M7.7b, M7.8s, M7.8a to c, M7.9a, M7.9b, M7.10, M7.11 | Plus is free, so there is no store; multiplayer is not in either reference game |
| Plus art and audio pipelines | M3.3, M3.3a, M3.3b, M3.7d, M3.8c, M3.9, M3.9a, M3.9b, M5.8 to M5.8c | Optional extensions |
| The 3D adventure | M9.3 to M9.8, GAME-3D.1f, GAME-3D.1g | Moved to Plus by the base-3d rescope |
| Editor suite beyond the two games | EDS.3, EDS.4b, EDS.5b, EDS.P, EDS.6, EDS.7, EDS.8, ED3D.9, ED3D.9c, ED3D.10, ED3D.10b | Feel, Writer, Schematic, Sequence, the world view and the Ask panel are not needed to build the two games |
| Paid apps and collaboration | APP.S1, APP.1 to APP.5, COLLAB.1, COLLAB.2, NDX.1, NDX.2 | After launch |
| Plus store and checkout | PRODUCT.5h, PRODUCT.8 to PRODUCT.8e, M10.1 to M10.3, QB.5 to QB.5b | Plus is free; the Party Racer starter is optional |
| Standalone leftovers | M8.11, M8.12, M8.9p, ASSET.1, ASSET.3, ASSET.4, EX.4p | FloorFifty and The Last Light slices contradict "AF is standalone"; the rest are optional |

A cut row is **not a prerequisite** of any row that ships in 1.0; where a kept row names one, the name is void. Nothing is deleted: a tagged row keeps its text and can be pulled back.

## 3. The critical path that remains

1. Free `base-3d` (GAME-3D.1m, then 1a, 1h, 1i, 1j, 1k, 1l) and Emberwick authored in the editors (GAME-2D.ED); the editor rows those need (ED2D, ED3D, EDK, EDS.1, EDS.2, EDS.4a, EDS.5a, EDS.9, EDS.10, EDS.11).
2. The 3D packages the free game uses (M9.0 to M9.2, M9.9), `render-pixi3d` and `figures` (M3.x).
3. DIST, the CLI (M8.x), the docs and website (DX.10 to DX.12, M10.4 to M10.6), then API freeze (M8.7), the 1.0 release (M8.9) and Pixi 3D going public (M9.10, M8.9a, about 2026-11-13).

## 4. How the work runs from here

- **Wide PRs** (docs/04): one PR per feature, not per milestone row group: for example the whole free base-3d game, the whole 3D editor remainder, the whole CLI 1.0. A PR is ready when its feature is done end to end.
- **Spread the tests over the machines** (a separate PR, `ci.yml`): the three game-ci jobs read `AF_GAME_RUNNER` (falling back to `AF_LINUX_RUNNER`, then `af-linux`), so setting that repository variable moves them off the PC runner with no further workflow change. Checks, consumer smoke and e2e stay on the Linux runner; parity stays on the Macs.
- **Longer lane sessions:** lanes hand off at about 90% of their context instead of 80%.
