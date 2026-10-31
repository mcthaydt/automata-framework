# STANDALONE.3: remove the game-specific stage profile from the 2D editor

**Row:** `docs/02-master-delivery-plan.md` STANDALONE.3 (added with ADR 0006, PR #311). Lane **editors**. Size M.
**Owner, 2026-10-31:** "automata framework is standalone"; for the stage profile the Owner chose "Drop the profile".
Accepted under "Reminder that everything is auto approved and accepted, do not wait on me to do any approvals".

**Goal:** delete the stage profile EDFF.1 added (its code, fixtures, goldens, tests and UI entries), drop it from the
suite's sample, and keep every genre-general behaviour of the 2D editor (the `level-project` profile with its level and
world views) and its tests. No behaviour of the built-in profile changes; no golden of another package changes.

This is a deletion, so its tests are the existing suites staying green with the profile gone: typecheck proves nothing
still imports it, knip proves no file, export or dependency it alone used is left behind, and the architecture test
proves the generic areas still name no profile.

## Files

**Delete**

- `packages/editor-2d/src/profiles/<stage profile>/` (85 files: codec, checks, commands, templates, schema, tunables,
  goldens, the four copied stage fixtures and their `PROVENANCE.md`). Nothing outside the folder imports it except the
  test below (measured with `grep -rn` at `753ba9ac`).

**Modify**

- `packages/editor-2d/src/app/checks/ChecksView.dom.test.ts`: drop the stage profile's `describe` and its registration;
  the `level-project` cases (group findings, apply repairs one undo step each, choose a door target, locate, no problems)
  already cover the generic Checks view.
- `packages/editor-2d/src/app/profiles.ts`, `packages/editor-2d/src/profiles/profile.ts`: comments that promise the
  profile (`joins in EDFF.2`, the `id` example, the `preview` note) say what stays.
- `packages/editor-2d/src/profiles/profile.test.ts`, `packages/editor-2d/src/architecture.test.ts`,
  `packages/editor-2d/src/testing/architecture.ts`: the registry and boundary tests use a neutral second profile id
  (`stage-profile`) where they used the removed one; the architecture's list of profile ids drops it.
- `packages/editor-2d/src/testing/planted-profile.ts`: the comment names the removed profile's text patching; reword.
- `packages/editor-2d/package.json`, `pnpm-lock.yaml`, `docs/versions.md`: `@decimalturn/toml-patch` was used only by
  the profile's codec; remove the dependency and its versions row.
- `knip.jsonc`: drop the profile's `make-goldens.mjs` entry.
- `packages/editor-suite/src/testing/sample-ports.ts`, `packages/editor-suite/src/shell/suite-session.test.ts` and the
  list fixture's header comment: the suite's sample drops its stage file (the 2D editor no longer opens that format).
  Renaming the fixture and the sample constant is STANDALONE.2's.

**Consumed/produced interfaces:** none change. `Profile`, `ProfileRegistry`, `createAppProfiles()` and the suite's
`samplePorts()` keep their shapes; the sample map loses one entry.

## Steps

- [x] 1. Survey and plan (this file).
- [ ] 2. Delete the profile folder; drop the Checks view stage case. `pnpm --filter @mcthaydt/automata-editor-2d
  typecheck` passes (nothing else imports it).
- [ ] 3. Neutral ids and comments in the registry, architecture and planted-profile files. `pnpm --filter
  @mcthaydt/automata-editor-2d exec vitest run --project unit --project dom` passes.
- [ ] 4. Remove `@decimalturn/toml-patch` (package.json, lockfile, versions row) and the knip entry. `pnpm knip` and
  `node tooling/versions/...` (the versions check `pnpm check` runs) pass.
- [ ] 5. Suite sample drops the stage file. `pnpm --filter @mcthaydt/automata-editor-suite test:unit` passes.
- [ ] 6. Gates: `pnpm format`, `TURBO_FORCE=true pnpm check`; parity for editor-2d and editor-suite (`test:parity`,
  three browsers) since their tests changed; `grep -rni` for the profile's name in `packages/editor-2d` and the suite's
  sample returns nothing.

## Gates

- Selected: `pnpm format`, `TURBO_FORCE=true pnpm check`, `pnpm --filter @mcthaydt/automata-editor-2d test:parity`,
  `pnpm --filter @mcthaydt/automata-editor-suite test:parity`.
- Omitted: `pnpm build`/`api-report`/`api-index`/`agent-skills` (private packages, no published exports change);
  changeset (private packages must not be named).
- Pending: the Mac's CI.

## Execution log

- 2026-10-31: plan written at `753ba9ac`.
