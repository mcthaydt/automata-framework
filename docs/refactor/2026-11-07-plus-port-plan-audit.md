# Automata Plus port plan audit (stage 3)

- **Date:** 2026-11-07. **Stage:** 3 of 6 of the Plus port (plan audit, Opus medium), with the superpowers plugin
  (`superpowers:writing-plans`' self-review checklist: spec coverage, step scan, type consistency, Review Focus,
  proportion). Native, no subagents.
- **Audited:** the [spec](2026-11-07-plus-port-spec.md) and the [plan](2026-11-07-plus-port-plan.md) at #457's head
  (`6ddc3180`), against that checkout (the 3D build's `1c7db6bf`, still #455's head), `mcthaydt/automata-plus` at
  `1766c622`, the [Plus audit](2026-11-07-plus-audit.md), the [3D plan](2026-11-07-3d-slice-plan.md) and
  [spec](2026-11-07-3d-slice-spec.md) with the port's section 9 changes, and project memory. Every finding was checked
  by a command or a file read.
- **Result:** 16 findings, all fixed in place in the spec and the plan. The shape stays: 3 parts, 4 phases, 19 tasks.
  One finding changes the 3D plan's task 7.1 (F1): it is added to spec section 9 for the 3D build.
- **P-D11 (B) is sound,** with F5's fix. The editor reads `gates.json`, the editor list's `[[gate]]` rows point at it,
  and the review desk shows it, so the reader owns the shape; under P-D1 B the editor is core and core never imports an
  extension, so A (the pipelines own it) would need the editor to import an extension. What the stage 2 text got wrong
  was the pipelines' side, not the choice.
- **Accepted** under "Reminder that everything is auto approved and accepted, do not wait on me to do any approvals"
  (Owner, 2026-10-31).

## Findings and fixes

| # | What was wrong (evidence) | Fix (where) |
|---|---|---|
| F1 | `af-sector/2` could not hold the clinic. `clinic.sector-map.toml` uses `zone` on every sector, three `[[masses]]`, and `cut` and `hideFrom` on its walls; `ResolvedMap` carries masses and each edge's `cut`. `/1`'s `AfSectorEntry` has no `zone`, `AfSector` no `masses`, and `AfWall = Omit<WallDef, 'hideFrom' \| 'cut'>`; spec 9's `/2` table adds none of them. The converted clinic would resolve to a different map, so the port's central proof fails. | 3D 7.1 adds `zone`, `masses`, `cut`, `hideFrom` to `/2` (spec 9 row 7.1); port 3.2 checks they survive and adds them itself if 7.1 merged without (spec 7.1; plan 3.2) |
| F2 | The proof `expect(resolveLevel(...)).toEqual(clinicResolved)` cannot pass: `ResolvedMap` holds `sectorAt`, `floorAt` and `segmentBlocked`, and the fixture is a `ResolvedFixture` (with `sourceCommit`) that `resolve.test.ts` compares field by field within 1e-12. Today's function is `resolveMap`, not `resolve`. | Run today's `resolve.test.ts` comparisons on `resolveLevel` (spec 7.1; plan 3.2) |
| F3 | Review Focus 1 said the TOML maps could not hold a non-box room. They can (`SectorDef.corners`, `holes`); the box-only reader is base-3d's `sector-area.ts`. Pits and sloped floors are what Plus never resolved; "pits by flag" had no defined meaning in `ResolvedMap`, and a `/2` slope would have been read flat. | A pit sets `Sector.pit` and `floorAt` is `undefined` there; a slope is a `sloped-floor` problem (spec 7.1; plan Review Focus 1, 3.2) |
| F4 | Task 3.3's `SceneState` dropped most of Plus's `CutsceneFrame` (`actors`, `fade`, `flicker`, `done`, `held`, the `caption` object) and swapped Plus's eases for AF's, which differ: Plus's `in` is `t²`, `out` `t(2 − t)`, a key with no ease is `smooth`; AF's `in`/`out` are CSS's curves (`ease.ts` `NAMED`) and no ease is linear. The fixtures have 13 `out` keys and 57 `linear`. Every presentation frame would move, and the "same sim hashes" proof does not see presentation. | `SceneState` keeps every `CutsceneFrame` member; no ease → `smooth`; `out` rewritten as the exact `[1/3, 2/3, 2/3, 1]`; `cut` → `step`; Plus's frames recorded before the change and matched within 1e-9; lints unchanged (spec 7.2; plan 3.3) |
| F5 | P-D11's note said the pipelines keep "their own richer `state.json`". There is none: the pipelines read `gates.json` back (`run-state.ts` line 110, a strict keyed `gateFileSchema`) and their `GateRecord` has `stage`, `files`, `summary`, `note`, `requestedAt`, `by`. Changing only the writer breaks the pipelines' next run. | Both sides move to `{ gates: [...] }`; the pipelines' fields ride along (the editor's `z.object` ignores them); an old keyed file is read once and rewritten (spec P-D11; plan Review Focus 4, 2.7) |
| F6 | Review Focus 4 had the editor's reader "return a problem, not a throw". The reader's contract is to reject, and the review desk shows the message after "Gates not readable: " (`ReviewDesk.svelte` line 65). The plan's test path `tests/unit/suite/gates-reader.test.ts` is `tests/unit/suite/node/gates-reader.test.ts`. `gate-records.schema.ts`'s own comment ("the Plus pipelines … replaces this when it lands") was left. | Reject with the older-version words; the path; the comment (plan 2.7) |
| F7 | Task 1.2 put `ErrorPanel` and `SettingsScreen` in `entries/game.ts`, which `entries/index.ts` does not re-export, so the root would not have them. The UI components are in `entries/ui.ts` as `default as X` from `.svelte` files. | `entries/ui.ts` with the exact files (spec 8; plan 1.2) |
| F8 | "The five that depend on `@automata/3d`" missed `pipelines`, which imports `sectors`, `nav`, `narrative`, `systems`. `test:browser:affected` has the same 3D exclusions as `:2d` and was not named. `3d.yml`'s paths do not include `extensions/**`, so a 3D-dependent extension's change would not run the 3D suites; `ci.yml`'s parity scope regex does not know `extensions/`. | Six; `:affected`; both workflows (spec 6; plan 1.3) |
| F9 | `tooling/release`'s `GROUPS` is a hand list (`packages`, `tooling`, `games`, `examples`); `check-changesets`, `api-index` and the consumer smoke find packages through it, so the nine would never be published or checked. `tooling/versions`' `workspace()` reads only `packages/*`, `tooling/*`, `examples/*`, so the pin check would skip the extensions (audit C9). | `GROUPS` in 4.1; `workspace()` in 2.8 (spec 6, 8) |
| F10 | `cutscenes`' schema is a sim file and would import `easeSchema` from `@automata/3d/timeline`, which is not in `automata.simEntries`, so `pnpm boundaries` fails; the timeline's Zod schema is file-private (`clip.schema.ts`'s `const ease`) and `Mix` was not re-exported. The cutscene schema's own `Ease` would also break the acceptance grep. | 3.1 exports `easeSchema`, `Mix`; `./timeline` joins `simEntries` and the sim list; the cutscene `Ease` goes (spec 7.2, 8, 9; plan 3.1, 3.3) |
| F11 | Task 3.4 said "the sectors plugin with the room's `*.af-sector.json`". base-3d's systems collide with `AreaSource` boxes from `sector-area.ts`; wiring the sectors plugin and its Rapier colliders would change how Wick moves, so the golden replay could not hold. | `areaFromResolved(resolveLevel(...))` builds the same `AreaSource`; the systems stay (spec 7.1; plan 3.4) |
| F12 | Task 2.4's `NetError` (`kind: 'unreachable' \| 'refused' \| 'closed' \| 'timeout'`) does not exist. Today's is `Data.TaggedError('NetError')` with `code: NetErrorCode` (from `NET_ERROR_CODES`) and `operation`. | A plain `Error` subclass with the same two fields (plan 2.4) |
| F13 | Task 2.3's `createFeel(table, clock)` does not match `createFeel(options: FeelOptions)`. | `FeelOptions` gains `clock` (plan 2.3) |
| F14 | Task 2.6 hedged on `ExtensionDef` having no `requires`. It has one (`define-extension.ts` line 22), `systemsExtension` already says `requires: ['sectors', 'nav', 'puzzle']`, and `resolveExtensions` throws `ExtensionError { reason: 'missing', names }`; it is internal, reached through `defineGame`. | A concrete test through `defineGame` (plan Review Focus 5, 2.6) |
| F15 | Task 1.3's `BoundaryFinding` is `Finding` (`check.ts`), and `forbid.ts`'s `forbidFindings` already does what the new flag needs (type-only imports count, strings do not). | `Finding`; the flag is `forbidFindings` per root (spec 8; plan 1.3) |
| F16 | `pnpm agent-skills --write` does not exist: `tooling/agent-skills/src/cli.ts` takes only `--root` and checks (the 3D plan audit's P11 found the same). | `pnpm agent-skills` as a check (spec 6, 8; plan Global Constraints, 1.2, 4.1) |

## Checked and left as written

- Package list, names and dependencies (spec 4) match each Plus `package.json`; `simEntries` exist for every sim package.
- The test floor 1,816 = 2,042 − 181 (Plus's root tooling) − 45 (the starter), from the audit's section 3.
- Every name Plus imports from `-sector-format` (`SectorDef`, `MassDef`, `Point`, `Corner`, `Trim`, `WALL_THICK`,
  `STEP`, `DEFAULT_TRIM`) is still exported by `@automata/3d/level`, so part A does not wait on 3D.
- The style rule's factory shape matches `createCutscenes` in `cutscene.plugin.ts`.
- The tools the plan runs exist: the mover, the module mover, `rename-scope-cli.ts`, `source-names-cli.ts`,
  `check-style --plan-comments`, `deps:new`, `audit:deps`, `check:changesets`.
- The subtree import: Plus's `main` has 231 commits, so `--depth=1000` fetches all of it and nothing pushed is shallow.
- Copy: the new player- and author-facing words (the gates message, the sloped-floor and pit behaviour) were read
  against the drunk grandma test; the editor says "gates" elsewhere, so the message does too.
