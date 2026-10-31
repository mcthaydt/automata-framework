# M6.9a: `cutscenes`: content, tick-time playback plugin and lint (TDD plan)

- **Spec:** the framework's M6 spec (`docs/superpowers/specs/2026-10-16-m6-gameplay-extensions-design.md`): §4.8, §5 (the
  cutscene flow), §6 (failure policy), §13 CS-a, CS-b, CS-c; decisions M6-D6 (scripts are content) and M6-D7 (cutscene
  time is sim ticks).
- **Row:** M6.9a in the framework's `docs/02-master-delivery-plan.md`. Prerequisites M6.4a (sectors), M6.5 (nav), M6.8a
  (narrative), all merged. Size L.
- **Branch:** `claude/plus-M6.9a-cutscenes`, from main `1cd8c1e`; one PR, one commit per part.
- **Source (read-only):** the adventure source at `92e67047a33161c5cfb1c5f9d8b981e91e1c55b9`: `src/game/cutscenes.ts` (134,
  `evaluate`), `cutscene-builder.ts` (243), `cutscene-lint.ts` (191), the four scenes' `cutscenes.ts` (28 scripts) and
  `tests/cutscenes.test.ts`, `cutscene-builder.test.ts`, `cutscene-camera-acting.test.ts`, `cutscene-lint.test.ts`,
  `cutscene-pose.test.ts`. Provenance goes in the framework's `docs/provenance/sources.md` only.
- **Status:** plan drafted.

## Scope

In:
- **Content:** a `cutscene` kind: a script as data. Rows `camera` (t, pos, look, cut, lens, ease), `actor` (who, t, at or
  x/z, facing, alpha, moving, cut, through, pose, frame, y, shiver, density, face), `caption` (t, until, line, speaker),
  `light` (t, lamp, level), `sound` (t, kind), plus `shake`, `fade`, `states`, `flicker`, `victory` and `lintAllow`. An actor
  position `at` is a point or an anchor name (`player`, `actor:<who>`, or a name the game gives: a hotspot, a nav node), resolved
  when the cutscene starts. Each cross-reference inside the script is checked at its path.
- **`cutscenes/play`** (not a sim entry): `evaluate(script, t)` (the source's, on the new rows, pure), `resolveAnchors`.
- **Sim (`cutscenes/sim`):** `cutscene.state` (the id and its start tick), `cutscene.scene` (each script's id, duration and
  anchors), the command `cutscene.skip`, the events `cutscene.started` and `cutscene.ended`, `startCutscene(ctx, id)` for the
  game and puzzle's hook, and `locked(ctx)`. A cutscene ends at `start + round(duration / dt)` ticks, or on a skip, on the next tick.
  A script whose anchor does not resolve at the start is skipped (`cutscene.ended` with `skipped`, no lock; CS-c).
- **Input gating:** puzzle, narrative and nav take a `locked` option and ignore their input commands while it holds; puzzle takes
  a `cutscene` hook (as `dialogue`).
- **Lint (`cutscenes/tools`):** duration, fade range, caption lines exist, reading time and overlap, sound and lamp keys exist,
  shot length, dead air, camera inside the map and clear of walls (sectors), actors on the floor and clear of walls.
- **The four scenes' 28 scripts** converted once to TOML (absolute positions from a canonical context), parsed in tests; the
  clinic's linted against the clinic map and graph.
- **Golden:** a replay of a run with cutscenes in the four engines (CS-a, CS-b, CS-c as tests).

Out (M6.9b): the `CameraRig` override, actor views and figure clips, lamps, caption strip, the hold-to-skip control, the preview
tool, conversation staging and the cutscene and conversation audits. The source's ceiling, cut-away, sprite-scale and
back-to-camera lint rules read the source's renderer (NR-D9, CS-D3).

## Decisions for the Owner's veto

- **CS-D1:** `locked` options on puzzle, narrative and nav (and puzzle's `cutscene` hook) are how input is ignored during a cutscene: the
  sim has no command filter, and each plugin reads its own commands. Options change no schema, so the goldens do not move.
- **CS-D2:** a missing anchor skips the cutscene and emits `cutscene.ended { skipped: true }`; there is no log in the sim (law 2), so the
  event carries the missing anchor for the game to log.
- **CS-D3:** lint rules that need the source's renderer (ceiling, cut-away walls, sprite scale, back to camera, solid boxes) are not ported; they
  return with the renderer in M6.9b.
- **CS-D4:** the converted scripts have absolute positions (the source's scripts are functions of a context); anchors are for new scripts.

## Steps

Each step: write the test, see it fail for the stated reason, write the minimum, see it pass.

1. Package; the `cutscene` schema, content kind and extension. Fails: no package.
   - [x] 1 (the extension joins the plugin in step 3)
2. `evaluate` and `resolveAnchors` (the source's evaluate cases). Fails: no module.
   - [x] 2
3. The sim plugin: start, ticks, skip, end, missing anchor, `locked`; CS-a, CS-b, CS-c. Fails: no plugin.
   - [ ] 3
4. `locked` in puzzle, narrative and nav; puzzle's `cutscene` hook. Fails: input still applies.
   - [ ] 4
5. The lint. Fails: no module.
   - [ ] 5
6. The converter and the four scenes' scripts. Fails: no fixtures.
   - [ ] 6
7. The golden in four engines.
   - [ ] 7
8. Gates, provenance row, ready line.
   - [ ] 8

## Gates

- `pnpm format`, Plus `pnpm check`; `test:parity` for cutscenes, puzzle, nav and narrative (their goldens must not move: puzzle
  `cd73a8d0b545c212`, narrative `f07b6a56c0f4182b`).
- No changeset (private).

## Follow-ups

- The scene builder as a build-time writer (M6-D6): the converted scripts are data; a shot vocabulary that writes them is M6.9b's with the preview.

## Execution log

- 2026-10-31: plan written from the M6 spec, Plus main `1cd8c1e` and the adventure source at `92e6704`.
