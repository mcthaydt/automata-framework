# The 3D editor to what the two free games need, and the Studio: plan (one wide PR)

- **Rows:** ED3D.8b, ED3D.11, ED3D.12, ED3D.13b (13a is merged: `model/definition-edits.ts`, `profile/af-sector/af-template.ts`), ED3D.14, and EDS.9a, EDS.9b, EDS.9c (EDS.9d: see "Open points"). One branch (`claude/editors-3d-wide`), one commit series per part, one draft PR when the feature is done end to end (Owner, 2026-10-31: "make the PRs WIDE, like big feature; let's cut"; [launch cut](2026-10-31-launch-cut.md) in #361).
- **Specs:** [ED3D](../specs/2026-10-23-editor-3d-design.md) §5.3 flows 4, 5, 9, §6 (Walk), §9 to §13 (ED3-a to ED3-s, minus the cut ED3-i and ED3-j); [editor suite](../specs/2026-10-30-editor-suite-design.md) §4.1 (`SuiteEditor`), §6.2 (Studio), EDS-D13, EDS-D16, EDS-q, EDS-r, EDS-s, EDS-x, EDS-aa; [kit](../specs/2026-10-23-editor-kit-design.md) §4.5, §4.8, §8.
- **Lane:** editors. **Depends on:** #350 and #353 (the thing card's field form, merged or in review; this branch starts from `origin/main` and merges #353 when it lands), `view/walk/walk-controller.ts` and `view/materials/material-picker.ts` (ED3D.8a, headless, merged), the `figures` package (`solve`, `evaluate`, `sample`, `poseSchema`, `figureSchema`, clips), `render-pixi3d`'s `figure` view (M3.5d), EDS.1a to EDS.2d (merged).
- **Status:** Drafted 2026-10-31. Accepted under the Owner's "Auto accept all spec and plans" once reported to the coordinator. Steps are ticked only when their checks pass.
- **Progress:** part E done (Studio, below); A, B, C, D, F and G follow. Order (coordinator, 2026-10-31): E first, then A, B, C, D, F, G; the branch is pushed after each part; one draft PR when all are done.

## Files by part

### A. ED3D.8b: Walk view and the material picker UI (editor-3d)
Create:
- `ui/walk/WalkCanvas.svelte`, `WalkCanvas.dom.test.ts`: the Walk viewport (WebGL2 notice when absent, ED3-p), mounts the lazy renderer, forwards gestures.
- `ui/walk/walk-renderer.ts`, `walk-renderer.canvas.test.ts`, `lazy-walk-renderer.ts`: first-person flat-shaded view on the dollhouse's mesh path (`view/mesh/sector-mesh.ts`, `camera-3d.ts`); never reads anything but `geometry(doc)`.
- `ui/walk/walk-gestures.ts`, `walk-gestures.test.ts`: two virtual sticks (move, look), tap picks the wall under the crosshair (`view/mesh/mesh-pick.ts`), WASD and QE, the Pencil never moves the camera.
- `ui/walk/WalkHud.svelte`, `WalkHud.dom.test.ts`: crosshair, minimap, the selection chip, the mode switch (Walk, Fly, Orbit), the no-spawn warning (ED3-n).
- `ui/inspector/MaterialSheet.svelte`, `MaterialSheet.dom.test.ts`, `material-sheet.layout.test.ts`: categories, search, scale, brightness, Apply to this wall, the room or matching walls (one transaction; `view/materials/material-picker.ts`).
- `ui/walk/walk.layout.test.ts` (three browsers), `ui/walk/walk-visuals.canvas.test.ts` (review images, `ED3D_VISUALS=1`).
- `ui/walk/ed3-f-s.journey.test.ts` is part C; the headless ED3-f and ED3-s cases are `app/walk-cases.test.ts`.
Modify: `ui/document/DocumentFrame.svelte` (Walk enabled in the view switch; the wall card shared with Plan), `ui/inspector/WallCard.svelte` (Material opens the sheet), `ui/suite/Levels3dRegions.svelte`, `app/levels-3d-session.ts` (the walk controller in the session), `index.ts`, `main.css`.
Tests first: `app/walk-cases.test.ts` (ED3-f: a window set from Walk shows on Plan and one undo reverts both; ED3-s: draw a rectangle against the depot's hall wall, accept the portal, walk through it; ED3-n; ED3-p's notice).

### B. ED3D.13b: definitions editor, materials-table editor, New level
Create:
- `ui/definitions/DefinitionsEditor.svelte`, `.dom.test.ts`, `definitions.layout.test.ts`: the list, a definition's id, shape, size, `single`, colour and its fields (the kit's field-definition form, moved out of editor-2d first, see below); refusals in the model's sentences, one undo step per edit.
- `ui/definitions/MaterialsTable.svelte`, `.dom.test.ts`: the af-sector materials table (add, rename, recolour, remove while unused).
- `app/definitions-controller.ts`, `.test.ts`: runs `def.*` and the materials edits through the `LevelEditor`.
- `ui/home/NewLevelCard.svelte`, `.dom.test.ts`, `app/home/new-level.ts`, `.test.ts`: New level from Home (`newAfSectorLevel`), name check, writes through the store.
- `app/ed3-r-cases.test.ts`: ED3-r end to end (a `crate` definition with a ref field, two instances, reopen, a third spawn refused by `single`).
Move (git mv, as #353 did for the field form): editor-2d's `FieldDefEditor.svelte` (+ its pure model) into `editor-kit/src/fields/` when its 2D-only parts allow it; else the 3D editor gets a thin form over the kit's `FieldRow`. Decided in B0 by reading it; recorded in the log.
Modify: `ui/inspector/Inspector.svelte` (a Definitions entry beside the cards), `ui/home/Home.svelte`, `index.ts`.

### C. ED3D.11: Pencil and touch polish, accessibility, journeys
Create:
- `vitest.config.ts` gains the `journeys` project (as editor-2d's), `src/testing/journey-editor.ts` (the 3D app on an iPad profile, like editor-2d's).
- `src/journeys/*.journey.test.ts` (WebKit iPad profiles, EDK.6b harness): draw and portal (§5.3 flow 2, ED3-c, ED3-m), edit and undo (ED3-b, ED3-e), Walk (ED3-f, ED3-s), retexture, definitions and placement (ED3-r), palm rejection (ED3-g, simulated), rotation or the keyboard mid-draw without a remount (ED3-h), three-finger undo and redo.
- `ui/plan/pencil-hover.canvas.test.ts`: hover previews the snap target and the edge length.
- `ui/a11y.dom.test.ts`: every control named, focus order, an announcement for undo and redo and a refusal.
Modify (as the tests find): `ui/plan/plan-gestures.ts` (three-finger undo and redo, the long-press menu), `ui/document/DocumentScreen`-level live region, `index.ts` keymap of §10.

### D. ED3D.12: acceptance ED3-a to ED3-s
Create: `app/acceptance.test.ts` (headless: ED3-a, b, d, e, k, l, m, o, q, r, s, over the shipped blockouts and the depot; the cut ED3-i and ED3-j are listed as "cut, post-1.0"), `ui/acceptance.layout.test.ts` (ED3-c, f, g, h, n, p on one build), `docs/evidence/ed3d-acceptance/2026-10-31.md` (the case table with each case's test and result, generated from the run, not typed). Owner's iPad pass stays the Owner's.

### E. EDS.9a, 9b, 9c: the Studio (editor-suite)
Create under `packages/editor-suite/src/editors/studio/`:
- `studio-editor.ts` (`defineSuiteEditor`: id `studio`, opens `content/figures/*.toml`, `figure-poses`, `figure-clips` per `editors.toml`), `studio-session.ts` (documents on the EDS.1a content-document module, one `History`), tests.
- Look (9a): `figure-edits.ts` (+ test: set a part field, a hem length, turn, outfit, starter figure, the FigureBuilder groups: face sliders, hair pieces, stands, garment roles; each one span-preserving edit), `StageCanvas.svelte` (+ `stage-renderer.ts`, canvas test) on `render-pixi3d`'s `figure` view with part picking, `PartFields.svelte`, `Outfits.svelte`, `StarterPicker.svelte`; EDS-r.
- Pose by hand (9b): `pose-session.ts` (handles through `solve`, `SolveReport` shown, pin, mirror, save a `figure-pose` through `printPose`), `Handles.svelte`, `ReachBadge.svelte`; EDS-q.
- Animate (9c): `clip-session.ts` (keys at the playhead, ease, loop and mask pickers, markers and cues; scrub and play through `sample`/`evaluate`), `Timeline.svelte`, `Playhead.svelte`; EDS-s, EDS-x (rotation mid-key keeps the playhead).
- `studio.layout.test.ts` (three browsers, tablet and phone sizes; phone is view and scrub only), `studio.journey.test.ts` (WebKit), `studio-visuals.canvas.test.ts` (review images).
- Fixtures: Wick's figure, the Ada cast fixture and a starter in `src/testing/fixtures/studio/` (recorded text, sha256-tested like the kit's).
Modify: `packages/editor-suite/src/index.ts` and the suite's editor list so the switcher shows Studio installed; `docs/provenance/sources.md` only for code extracted from the Studio sources (never named in code).

### F. ED3D.14: `automata editor` serves the 3D editor
Create under `packages/cli/src/editor/`: `serve-editor.ts` (+ test: loopback by default, a token for LAN, an allowlist from `content/editors.toml`, the mtime guard), `server-store.ts` (+ contract test against the kit's `ProjectStore`), `editor-command.ts` (the `automata editor` subcommand), a docs page `docs/guides/editor.md` and the agent skill via `pnpm agent-skills --write`.
Open: ED2D.9 owns this command and is not built; see "Open points".

### G. Gates and evidence
Per part: focused tests first; at the end `pnpm exec biome check --write <changed>`, `pnpm format`, `TURBO_FORCE=true pnpm check`, `pnpm build`, api-report / api-index / agent-skills (kit and cli exports), editor-3d and editor-suite `test:parity`, editor-3d `test:journeys`, the review images with their mockup frames (3D and Studio frames in `docs/design/editor-3d` and `editor-suite`).

## Open points for the coordinator
1. **EDS.9d (the pipeline gate bar)** needs M3.9a, which the cut moves to post-1.0. Default: not built; EDS.9d stays unticked with a note.
2. **ED3D.14 needs ED2D.9** (the `automata editor` command), which is not built. Default: this PR builds the shared serve command and the 3D wiring; the second (2D) PR wires the 2D editor and the 2D docs. Alternative: ED2D.9 goes first.
3. **ED3D.11 and ED3D.12 name cut prerequisites** (ED3D.9c, ED3D.10b): void under the cut; ED3-i and ED3-j are left out of the acceptance table.
4. **Overlap with ED2D.8:** `origin/main` already carries ED2D.8a and ED2D.8b (World camera and pictures), and #353 carries the ED2D.8 polish, a11y and iPad journeys. The second PR reconciles the ED2D.8 row.
5. **Size:** about 120 new files; checkpoints are the part commits, each pushed.

## Steps (ticked when their checks pass)

### E. Studio
- [x] E1. `studio-content.ts`: the figure content read through the figures schemas, problems listed, references checked (red first: module missing).
- [x] E2. `studio-session.ts`: one history over every file's text, span-preserving edits written through the workspace port, Undo and Redo write back, create and its undo (EDS-aa).
- [x] E3. `studio-edits.ts`: typed edits for sliders (face table), figure fields, handles, clip keys, length, loop, mode, mask, markers and cues.
- [x] E4. Stage: `stage-camera.ts` (pure orbit, projection, picking ray) and `stage-renderer.ts` (the game's `figure` view on a `View3D`, WebGL2, context loss), canvas tests in Chromium and WebKit.
- [x] E5. `studio-view.ts` (mode, selection, playhead, what the stage draws, handle positions and reach) and `studio-controller.ts` (every action as one step, refusal in words).
- [x] E6. Components: panel, Look, Pose, Animate fields, stage with handles, timeline dock, regions and `createStudio`, registered in the suite page; DOM tests.
- [x] E7. Layout in the shell at eight sizes in three browsers (96 of 96), WebKit iPad journeys EDS-q, EDS-r, EDS-s, EDS-x, EDS-aa (5 of 5), review images.
- [ ] A. ED3D.8b Walk and the material sheet. [ ] B. ED3D.13b. [ ] C. ED3D.11. [ ] D. ED3D.12. [ ] F. ED3D.14. [ ] G. gates and the PR.

## Execution log
- 2026-10-31, E (Studio): everything above is in `packages/editor-suite/src/editors/studio/`. Decisions and findings: (1) the figures package's entry reaches the content compiler's Node built-ins through `@mcthaydt/automata-content`'s entry, which Vite's dev server and Vitest's browser mode cannot load (a build tree-shakes them): the suite's Vite configs alias the bare entry to `src/shims/content-browser.ts`, which re-exports the package's own schema and palette files. The proper fix is a browser-safe entry in the content package (a request, not done here). (2) The kit's `ContentDocument.edit` throws from `toml-patch` when an array of tables is inserted at a new root key after `[[keys]]` tables (found with `cues`); the Studio inserts an empty array and then the item, and `session.edit` turns any throw into a refusal. (3) A stage built on `View3D` needs an ambient environment, or the figure draws black; the stage sets the sky and ground colours the figure examples use. (4) The stage renderer must not be rebuilt on a size notification (the renderer's creation reads only "has a usable size"): rebuilding it on every ResizeObserver tick hung WebKit. (5) A handle's pointer listeners are native, because Svelte delegates `pointerdown` to the root and the stage's gestures need the press stopped below it. (6) EDS-D16's stand fit check (a stand the outfit does not suit, disabled with a reason) is not built: it needs M3.6b's fit check on stands; the stand picker lists the game's stands. EDS.9d (the pipeline gate bar) stays unbuilt (M3.9a is cut). (7) The suite's top-bar Undo label reads "Undo Edit" for every editor (the write path's), not the Studio's step name; the Studio's own labels are in its history.
