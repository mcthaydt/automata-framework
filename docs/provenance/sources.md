# Extraction sources

AF is standalone: its code, tests, published text and website never name the projects it was extracted from. This file
is the only place their repositories and commits are named (AGENTS.md "Core and extensions"). It is not shipped, not
published and not on the website. Each entry records the source repository, the commit read, what was taken or is to be
taken, and the licence. Specs, plans and code refer to a source only by its neutral name below.

STANDALONE.2 extends this file to every earlier extraction; until then it holds M6's entries only.

## M6: gameplay extensions ([M6 spec](../superpowers/specs/2026-10-16-m6-gameplay-extensions-design.md))

### The adventure source

| Field | Value |
| --- | --- |
| Repository | `mcthaydt/PixiJS3D_Experiment_001` (private) |
| First read | `17eb568`, 2026-10-16 (the M6 spec's line and test counts) |
| Recorded extraction commit | `92e67047a33161c5cfb1c5f9d8b981e91e1c55b9` (`92e6704`, committed 2026-10-22), re-read 2026-10-31 for M6.0a |
| Taken (M6.3 onward, into `mcthaydt/automata-plus`) | `sectors`, `nav`, `puzzle`, `systems`, `narrative`, `cutscenes`, `feel`'s frame model and coverage, `audio-synth`, `debug`'s boards and driver, the environment (blockout) pipeline, and the modules in M6 spec §4.13 (storylets, conversations, delivery, portraits, music), all rewritten on Koota under the porting rules (M6 spec §4.9), with the source's tests as behavior specs. The source itself is not edited (decision 8) |
| Earlier extraction | `@mcthaydt/automata-editor-3d` `format/` and `geometry/` (ED3D.1, ED3D.1c) from `src/game/sector-format.ts` at `92e6704` and the source's sector and nav geometry |
| Moved, M6-D17 (2026-10-31) | The format file (`sector.schema.ts`, from `src/game/sector-format.ts` at `92e6704`) moved with its constants to core `@mcthaydt/automata-sector-format` (`packages/sector-format/src`); its header no longer names the source |
| Converted, M6.5 (automata-plus#24) | `nav`: `src/game/nav.ts` (`clear`, `nearestNode`, `route`) rewritten on Koota; its three tests (`tests/nav.test.ts`) ported as behaviour specs; the clinic's `NODES`, `EDGES` and `BOXES` (`src/game/level.ts`) converted once to TOML fixtures by `packages/nav/scripts/convert-adventure-nav.ts` at `92e6704` (18 nodes, 22 edges, 21 boxes) |
| Converted, M6.7a (automata-plus#24) | `systems`: `src/game/systems.ts`, `agents.ts`, `probes.ts`, `pursuit.ts`, `contracts/systems.ts` and `nav.ts`'s `reserveNodes` and `reachable` rewritten on Koota; `tests/agents.test.ts`, `systems.test.ts` and `pursuit.test.ts` ported as behaviour specs (all but `wallRing` and `withHiding`); the four scenes' `SYSTEMS` (`src/scenes/{prologue,clinic,clinic-dawn,bay}/systems.ts`) converted once to TOML fixtures by `packages/systems/scripts/convert-adventure-systems.ts` at `92e6704` |
| Licence | No `LICENSE` file and no `license` field at `92e6704`: the Owner's own private repository, extracted on the Owner's direction (2026-10-11) |

### The arcade source

| Field | Value |
| --- | --- |
| Repository | `SNEKPRTY/FloorFifty` (private) |
| Recorded commit | `ac72660`, read 2026-10-16 |
| Taken (M6.1, into `mcthaydt/automata-plus` `feel`) | `apps/client/src/systems/gameplay/juice/` (`hit-stop`, `second-order`, `squash`, `lean`, `dust-pool`, `word-pool`, `word-text`, `room-beats`, `feel-director`'s routing), `systems/haptics.ts`, `content/juice.toml`'s shape, and their tests (M6 spec §4.1). `trauma.ts` informs core's `camera2d.shake` (M4) and is not extracted twice |
| Licence | Not checked in this record (no checkout here on 2026-10-31); the Owner's direction (2026-10-11) covers its use. M6.1's plan records it from the checkout it extracts from |

### Design input (not code)

| Field | Value |
| --- | --- |
| Repository | `mcthaydt/AutomataEngine-LegacyV2-` (private) |
| Commit | `18525fc` |
| Used | `docs/references/Narrative Architecture.md` (layered storylets; one shared state of facts, relationships, promises and reputations) as design input for `narrative` (row M6.8a; Owner, 2026-10-30: "Steal everything you need to") |
