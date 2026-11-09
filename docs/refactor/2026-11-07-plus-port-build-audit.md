# Automata Plus port build audit (stage 5)

- **Date:** 2026-11-08. **Stage:** 5 of 6 of the Plus port (build audit, Opus medium), with the superpowers plugin
  (`verification-before-completion`: every claim below was checked by a command or a file read in this session).
  Native, no subagents. Nothing was fixed here; stage 6 (Sonnet high) fixes the findings.
- **Audited:** PR #458, branch `claude/project-thread-d62n7h` at `43489a7b`, against the
  [plan](2026-11-07-plus-port-plan.md) (with the section 6 addendum of the
  [3D scope trim](2026-11-07-3d-scope-trim.md)), the [spec](2026-11-07-plus-port-spec.md), the plan's execution log,
  [`plus-progress.md`](plus-progress.md), `AGENTS.md` and the Owner's standing rules. The 3D build's head merged into
  the branch (`71b36676`, PR #467) is the baseline for "what the port added to core".
- **Result:** no Critical finding, 7 Important, 12 Minor. All 27 tasks have code behind them except 3.4, which a merge
  undid (I1). Five of the builder's rulings are sound; the lamp ruling is not (I5).

## What was run (Node 24, Chromium only)

| Check | Result |
| --- | --- |
| `pnpm lint`, `typecheck`, `boundaries`, `style`, `source-names`, `knip`, `check:changesets` | all exit 0 |
| `character-kit`, `world-kit`, `examples-runner`, `editor` unit tests, each alone, default 5 s timeout | 74, 92, 65 (+1 skipped), 3,408: all pass; slowest tests 2.8 s, 3.4 s, 2.0 s, 2.2 s |
| The same four plus `3d` and `net-server`, `turbo run test:unit --concurrency=4`, no timeout flag | `character-kit` 1, `world-kit` 2, `examples-runner` 1 test time out at 5 s; `editor`, `3d`, `net-server` pass (I3) |
| `games/base-3d` unit | 105 pass |
| `site` unit | fails before its tests: `api-index` wants `@automata/framework`'s `dist` (core's too, so not new with the port; the extensions now add to the builds it needs) |

Not run: WebKit and Firefox (the Owner's Mac), browser suites and journeys (the builder ran them in Chromium; not
repeated), `pnpm api-index --write`, `pnpm secrets` (shallow clone).

## The builder's rulings

| Ruling | Verdict |
| --- | --- |
| Two cutscene examples instead of one `cutscene.ts` | **Sound.** The catalog's 100-line budget (`CODE_LINE_BUDGET`) and the inline gait make one file too long; names follow the catalog's `<module>-<name>.ts`. |
| Modules `characterkit` and `worldkit` | **Sound, with a cost.** The catalog's path rule (`EXAMPLE_PATH`, `[a-z0-9]+`) allows no hyphen in a module, and the plan's `figures-*`/`world-*` would be core modules with `Tier: core`, which may not import an extension. The section names now differ from the package names (M7). |
| The 3D plan's "Notes from the automata-plus audit" left alone | **Sound.** The section already opens with the Owner's 15:05 decision and points at spec section 9. |
| The cutscene lamp scales the room's light | **Not sound** (I5). |
| `@automata/3d/timeline` exports `bracket`, `Timed`, `mixNumber` | **Sound and minimal.** They existed in `shared/timeline/sample.ts`; only the entry line changed, and `cutscenes/src/shared/director/sequence.ts` uses all three. |
| `kitSurfacesSchema` exported | **Sound and minimal.** One `export` keyword; `world-kit`'s `kit.schema.ts` reuses it instead of a copy. |
| `@automata/3d/props-kit` | **Right idea, too wide** (I7). |

## Important

**I1. Task 3.4 is not in the tree, but the log, the progress page and the PR body say it is.** Merge `7e862734`
resolved `games/base-3d`'s level reader to "the core-only version (no sectors extension dependency)". Today
`games/base-3d/package.json` has no `@automata/sectors` and `src/features/room/sector-area.ts` imports only
`@automata/3d/level`. The execution log's 3.4 row ("`@automata/sectors` is a dependency of `@af-games/base-3d`") and
PR #458's "the base 3D game builds its area from the sectors resolver" are stale. The merge was right by the Owner's
trim ("Ember Hall uses core only, as Emberwick does", trim section 1), which the plan's 3.4 contradicts, but nobody
recorded it. Left behind: the test `finds a door from the wall's start as written, in a room whose corners run
clockwise` in `games/base-3d/tests/unit/room/sector-area.test.ts`, which builds `clockwise.corners` twice (the first is
dead code), and `Edge.reversed` in `sectors`, which only that game needed. **Fix:** a 3.4 ruling in the log (superseded
by the trim; base-3d stays core-only), the progress page and PR body corrected, the dead assignment removed. Keep
`Edge.reversed` (it is right for any reader of a clockwise room), with a `sectors` test of its own if it has none.

**I2. Five goldens were re-recorded against a hard constraint, and only one of them has the proof.** The plan's
Global Constraints: "A sim hash or golden never changes in this port. A change is investigated and its cause reverted,
never re-recorded." Task 3.2 re-recorded the `sectors` (2), `nav`, `systems` and `narrative` goldens because the
snapshot header's `schemaHash` now hashes `af-sector/2`. The cause is real and the commit says it, but
`extensions/sectors/tests/unit/shared/sim/state-bytes.test.ts` pins the pre-port state bytes for the `sectors` walkers
only; `nav`, `systems` and `narrative` rest on "every events hash unchanged". **Fix:** the same zeroed-header pin for
`nav`, `systems` and `narrative`, with values measured on the commit before `186797c1`; and an Owner line in the log,
since the constraint was the Owner's plan.

**I3. Heavy unit tests sit near the 5 s default; three fail under load.** Reproduced above:
`world-kit` `swatch-tiles.test.ts` "make the tile the pipeline makes now, byte for byte" and `textures-command.test.ts`
"writes one tile file for each textured swatch" (each runs the whole photo pipeline over all 38 photos),
`character-kit` `outfits.test.ts` "every outfit is sound" (all 11 outfits in one test), and `examples-runner`'s
`audio-sound` replay (a 2D example; older than the port). The root `pnpm test:unit`, CI and the commit hook pass
`--testTimeout=90000`, so CI is green; `pnpm --filter <kit> test` and a bare `turbo run test:unit` are not. The
thirteen ported extensions hide the same thing with a blanket `testTimeout: 90_000` in every `vitest.config.ts`; the
two kits have none, and `outfits.test.ts` already gives its per-outfit platform test `90_000` on line 33 but not its
neighbour. **Fix:** make the work smaller, not the clock longer: run the pipeline once per file (`beforeAll`) and share
it between the byte check and the ladder check, let the command test check a few swatches (the byte test covers all),
and split "every outfit is sound" per outfit as the tests above it are. Then decide whether the blanket 90 s in the
ported configs stays (core sets none, `sim` 30 s).

**I4. In the ported extensions, the feature folders are mostly empty and the wiring is in `features/`.** `AGENTS.md`:
"`app/` wires features together". Core's extension definitions are in `app/` (`packages/3d/src/app/render3d.extension.ts`,
`figures.extension.ts`), and so are the two new kits'. The nine ported ones that have one put theirs in a feature
(`extensions/sectors/src/features/level/sectors.extension.ts`, `nav/src/features/graph/nav.extension.ts`, and so on),
and every ported `app/` is empty except `net-server` and `pipelines`. Files in `features/` against `shared/`: `sectors`
1 to 14, `nav` 2 to 10, `cutscenes` 3 to 11, `feel` 3 to 8, `systems` 10 to 18, `pipelines` 10 to 26. The reason given
(the determinism checker wants one sim root) explains `shared/sim/`, not the extension files. **Fix:** move each
`*.extension.ts` to `app/`; where a package is one sim and its wiring, say in the log that `shared/sim/` is the package
and the feature folder is not needed, rather than keep a one-file feature.

**I5. The cutscene example fakes its lamp.** `examples/3d/cutscenes/cutscenes-door-and-lamp.ts` sets
`view.environment.intensity` to the lamp's level, so the whole room's ambient light rises; no lamp lights anything.
Its header says "a baked room would hand the level to the scene light instead", which reads as if core cannot. Core
can: `createPixi3dRenderer({ lighting })` makes a `SceneLight`, the `scene` hook receives it as its fourth argument,
`light.bake(mesh)` bakes the drawn meshes, and `light.setLevels({ [id]: level })` rebakes what a lamp reaches
(`packages/3d/src/shared/render/light/scene-light.ts`; `render3d-lighting-fog.ts` shows it). An example teaches the
pattern it shows. **Fix:** drive the pendant through `lighting` and `light.setLevels` from `scene.lamps`; if that does
not fit 100 lines, keep the door and the camera here and show the lamp in the second example.

**I6. The extensions have no READMEs.** Thirteen of seventeen have none (only `character-kit`, `world-kit`, `ui-screens` and `pipelines` do), including eight of the nine that 4.1 publishes to npm
(`physics`, `puzzle`, `feel`, `audio-synth`, `debug`, `net`, `net-ui`, `net-server`; `ui-screens` has one) and the
3D ones a game author meets first (`sectors`, `cutscenes`). Every core package has one. Plus had none either, so this
was carried over, not made, but a published package with a blank page fails the drunk grandma test: nobody can tell
what it is or how to turn it on. The root README's `extensions/` row also leaves out `character-kit` and `world-kit`,
and `docs/README.md` and `docs/status.md` (the agents' read order) never mention extensions. **Fix:** a short README
per extension on the kits' pattern (what it is, turn it on, what you get, what it says when you forget), the two kits
in the root README row, one line in `docs/README.md`.

**I7. `@automata/3d/props-kit` exports more than the kit uses, and a second `tube`.** The Owner's rule is that 3D core
stays as light as 2D. The entry exports 48 names; `world-kit` (src and tests) and the examples use 37. Unused: `World`,
`WorldPiece`, `Params`, `PropFault`, `ResolvedProp`, `TubeOptions`, `Ring`, `Limb` (type), `Q`, `noise3`, and
`RegistryClash` (only the entry's own test). Worse, `tube` here is `shared/math/geometry.ts`'s (rings to a mesh) while
`@automata/3d/figures-kit` exports `shared/math/superquadric.ts`'s `tube` (a skirt's bulging tube), each with its own
`TubeOptions`: one package, two public functions with one name. **Fix:** cut the entry to what a prop maker uses
(knip does not see unused entry exports), and rename one `tube` in core (for example `ringTube`) so each name means one
thing; `pnpm api-report --update`.

## Minor

- **M1. OKLab is written a third time.** `extensions/world-kit/src/features/textures/colour.ts` `oklab` repeats
  `packages/3d/src/shared/math/colour.ts` line for line (and `packages/content/src/shared/palette/duel.ts` has a
  third). Import core's, adding it to the props-kit entry if needed, and keep only `rgbFromLab` in the kit.
- **M2. `sectors` keeps its own segment geometry.** `shared/sim/check-level.ts` writes `orientation` and
  `segmentsMeet` next to core's `crossing` and `segmentDistance` (R1: one owner of sector geometry). The loop
  simplicity check is one any `af-sector/2` reader needs; ask core for it in `@automata/3d/level` or say in the log why
  it stays.
- **M3. The sky passes run on the wall clock.** `world-kit/src/features/sky/sky-passes.ts` drives rain and stars from
  `Ticker.shared`, not the renderer's injected `clock`, because core's `LookPass.make(look, time)` passes no frame
  time. Rain keeps falling under a paused game and is not reproducible in a visual test. A request to core: a time
  input on `LookPass` (and the kit reading it).
- **M4. `character-kit` keeps its goldens at the package root** (`goldens/dress.json`) where core keeps them in
  `tests/fixtures/goldens/`, and its scripts reach `../../packages/3d/scripts/extensionless-ts.ts` by path.
- **M5. Five map files are camelCase** (`world-kit/library/maps/forestClearing.af-sector.json`, `neonBar`,
  `streetNight`): `AGENTS.md` asks for kebab-case file names.
- **M6. `world-kit`'s `test` script runs the unit project only;** every other package's `test` runs all its projects.
- **M7. Catalog naming.** The sections read `characterkit` and `worldkit` while the packages are `character-kit` and
  `world-kit` (see the rulings); a display name in the catalog would hide it. The comment on `UNPUBLISHED_EXTENSIONS`
  (`tooling/examples-runner/src/catalog.ts`) explains only `@automata/3d`, which it calls an extension, and keeps a
  plan id (`M3R-D7`); it should say the three new ones are private because they build on it.
- **M8. `dev-tools` did not get the plan's moves.** Plan 2.7 lists "the five moves for `pipelines` and `dev-tools`";
  `tooling/dev-tools/src` is flat and still has `node-seams.ts`. Flat is how every other `tooling/*` package is laid
  out, so the result is consistent; the log should say so as a ruling.
- **M9. Test-first slipped twice, and the log says so.** 3.2: "The pit, the readSectorMap and the check tests were
  written after the code"; 2.6's `requires.test.ts` passed on its first run (it described behaviour that held). No
  action beyond the record, but stage 6 should write its tests first.
- **M10. `character-kit`'s README "Try it" points at `tests/fixtures/content`**, which a package user does not have.
  Say the styles are examples in the repository, or ship them (the log notes shipping them was not asked).
- **M11. `turbo.json`'s `test:unit` has no `passThroughEnv: ["PLAYWRIGHT_BROWSERS_PATH"]`,** so `pipelines`' audio
  test fails under `pnpm check` in a session and the builder committed with `--no-verify`. `test:browser` already passes
  it through.
- **M12. One `net-ui` line misses the drunk grandma test:** "The room refused you. Try another room." does not say
  why. If the server sends no reason, "This room won't let you in right now. Try another room." is kinder; the other
  messages name a cause and a next step.

## Checked and sound

- Phase 1 and 2: names, `MIT` and `#src` maps (`extension-manifests` passes), `--no-extension-imports`, Effect only in
  `net-server` and `pipelines` (`--forbid` list in `boundaries`), the role-file factory rule (it still requires every
  return to be a `define*` call), no source file over 600 lines (largest `net-server` `room-engine.ts`, 542).
- 3.3: the director keeps every `CutsceneFrame` member, the eases map as planned (no ease is `smooth`, `cut` is `step`,
  `out` is the exact cubic), and the frames recorded before the change are the test.
- 3.6: no hair piece or garment named outside its own file; core figures unchanged with and without the kit; core's
  additions (`placeHems` follow, `HairPiece.crown` as a function, a few exports) are additive and small.
- 3.7 and 3.8: generators through `registerPropGenerator`, lettering as library data, one `Tile` format, tiles stamped
  with their photo's sha-256, `checkReads` returns `LevelProblem`s. The kit README's copy is plain and its error quotes
  match core's messages.
- 5.1 to 5.4: the geometry, the walking helper, the `ui-screens` cut and the file splits are as logged.
- The debug overlay's rewritten words pass the drunk grandma test.

## For stage 6

Fix on `claude/project-thread-d62n7h` (PR #458), in this order: I1 (records), I2 (pins before anything else touches
the sims), I3, I7 (core, then `pnpm api-report --update`), I4, I5, I6, then the Minor list. M3 and the core half of M2
are requests to core: record them, do not build them in the kit. WebKit and Firefox stay pending on the Owner's Mac.
