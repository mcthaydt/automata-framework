# PUB.2: `ship --target itch` TDD plan

- **Spec:** [PUB spec](../specs/2026-10-16-publish-targets-design.md) §4, §6, §7 (`packages/ship` rows), §8, §12 PUB-b; [ADR 0005](../../adr/0005-publish-targets.md).
- **Status:** drafted 2026-10-16 (PUB.0 Owner-approved 2026-10-16 with every recommended default); steps 1–7 implemented and locally verified 2026-10-16. Owner review pending.
- **Lane:** ship. **Branch:** `claude/clever-pasteur-ujmu6e-pub2`.

## Global constraints

- **Strict TDD** in `packages/ship`: write the failing test, run it, confirm the failure reason, make the minimal change, confirm green.
- **The Ruken path does not change.** `prepare`, `publish` and `deploy-dev` without `--target` keep their behavior; every existing ship test stays green unedited.
- **Scope.** Ship prepares and publishes a _given_ `dist`. Building a game with `resolve.conditions: ['automata-web']` (`build:itch`) belongs to PUB.1 (adapter) and PUB.5 (`create-game`); the release CI job and UI label are PUB.4; the harness is PUB.3.
- **Zip choice.** A small writer in `src/targets/itch-zip.ts` on `node:zlib` (`deflateRawSync`, `crc32`), not `yazl`: `yazl` 3.3.1 is already a ship dependency (for the vendored Ruken CLI) but has no types and encodes its DOS timestamp in the machine's local time zone, which a fixed-time writer has to work around. Ours stores the DOS epoch (1980-01-01 00:00) directly, UTF-8 names, fixed `0644` unix mode, entries sorted by path, and deflate only when it is smaller than the file. Same Node, same bytes.
- **Gates:** `pnpm format`, `pnpm check`. Parity and E2E are omitted: no runtime, rendering, UI, host or game code changes.
- **Changeset:** `@mcthaydt/automata-ship` is published (not private), so a patch changeset.

## Files

- **Create:**
  - `packages/ship/src/targets/itch-limits.ts` (the itch.io limits, source URL and date read)
  - `packages/ship/src/targets/itch-checks.ts`, `itch-checks.test.ts` (entry, limits, case, `ruken.toml`)
  - `packages/ship/src/targets/itch-zip.ts`, `itch-zip.test.ts`
  - `packages/ship/src/targets/prepare-itch.ts`, `prepare-itch.test.ts`
  - `packages/ship/src/prepare/build-files.ts` (the build-file walk, moved out of `root-absolute.ts` to share it)
  - `packages/ship/src/config/itch-config.schema.ts`, `itch-config.schema.test.ts`
  - `packages/ship/src/publish/find-executable.ts`, `find-executable.test.ts`
  - `packages/ship/src/publish/publish-to-itch.ts`, `publish-to-itch.test.ts`
  - `.changeset/pub2-ship-target-itch.md`
- **Modify:** `packages/ship/src/config/ship-config.ts` (`itch?`), `src/errors.ts` (itch errors), `src/cli-args.ts` and `cli-args.test.ts` (`--target`), `src/cli.ts` (wiring), `src/index.ts` (exports), `src/prepare/root-absolute.ts` (imports the walk).

## Interfaces

- **Consumed:** `Files`, `ProcessRunner`, `FileError`, `ProcessError` (`@mcthaydt/automata-node`); `checkVersion`, `findRootAbsoluteReferences` (ship); `ShipConfig`.
- **Produced:**
  - `ShipConfig.itch?: { project: string; channel?: string }`; `itchConfigSchema` (Zod: `project` is lower-case `user/game`, `channel` defaults to `html5`).
  - `ITCH_LIMITS`, `ITCH_LIMITS_SOURCE`.
  - `checkItchEntry`, `checkFileCount`, `checkPathLengths`, `checkFileSizes`, `findCaseMismatches`, `checkNoRukenToml` (each returns problems naming file and limit); `buildFiles(distDir)`.
  - `writeDeterministicZip(outPath, distDir, files)`.
  - `prepareItch({ distDir, config, tag }): Effect<{ zipPath }, PrepareItchError>` (the zip goes beside `dist/`, never inside it, so `butler push <dist>` does not upload it).
  - `publishToItch({ distDir, config, tag, apiKey, butlerPath }): Effect<{ firstPush }, PublishItchError, ProcessRunner>`; `ITCH_FIRST_PUSH_CHECKLIST` (the CLI prints it when `firstPush`); `findExecutable(name, PATH)`.
  - Errors: `ItchBuildInvalid { check, problems }`, `ItchSettingMissing { setting }`, `ButlerFailed { exitCode }`.
  - CLI: `prepare --target itch`, `publish --target itch`; `target` on the parsed `prepare`/`publish` commands.

## Steps

- [x] **1. Config.** `itch-config.schema.test.ts`: `mcthaydt/emberwick` parses with channel `html5`; `McThaydt/Emberwick`, `emberwick` and `a/b/c` fail naming `project`. Fails: module missing. Add the schema and `ShipConfig.itch`.
- [x] **2. Limits and checks.** `itch-checks.test.ts`, one fixture each, each problem naming the file and the limit:
  - no `index.html`; `game.entry = 'play.html'` says itch.io needs `index.html`;
  - 1,001 files (limit 1,000); a 241-character path (limit 240); a sparse 200 MB + 1 byte file (limit 200 MB); three 200 MB sparse files (total limit 500 MB);
  - `<img src="assets/Hero.png">` with `assets/hero.png` on disk; a CSS `url()` and a JS string the same; an exactly-cased build passes;
  - `ruken.toml` present.

  Fails: module missing. Add `itch-limits.ts` and `itch-checks.ts`.

- [x] **3. Zip.** `itch-zip.test.ts`: two zips of the same folder are byte-identical; entries are sorted; every entry's DOS date is 1980-01-01; the zip unpacks (`yauzl`) to the same bytes. Fails: module missing. Add `itch-zip.ts`.
- [x] **4. `prepareItch`.** `prepare-itch.test.ts`: writes `<id>-<version>-itch.zip` next to `dist`; a wrong tag, a root-absolute path, a missing `index.html`, a case mismatch and `ruken.toml` each stop it with their own error and no zip, in the spec's order. Fails: module missing. Add `prepare-itch.ts`. (The walk moved to `build-files.ts` in step 2, which the checks test needed; `root-absolute.test.ts` stayed green.)
- [x] **5. `publishToItch`.** `publish-to-itch.test.ts` with the fake `ProcessRunner`:
  - exact argv `butler push <dist> mcthaydt/emberwick:html5 --userversion 1.2.0 --if-changed`, the key in `env`, never in argv, `echo: true`;
  - no `itch` section, no key, no butler: `ItchSettingMissing` naming how to get it, and zero runs;
  - a non-zero exit: `ButlerFailed` with butler's exit code, no retry (one run);
  - `For channel \`html5\`: pushing first build`in the output:`firstPush: true` and the §6 checklist.

  `find-executable.test.ts`: finds an executable on a given `PATH`, not a plain file, not a missing one. Fails: modules missing. Add both.

- [x] **6. CLI.** `cli-args.test.ts`: `--target itch` on prepare and publish; `--target` absent leaves the old shape; `--target steam` and `publish --target itch --activate` are usage errors; `deploy-dev --target itch` is a usage error. Fails on the missing option. Add it, then wire `cli.ts` (butler's exit code becomes the CLI's; the checklist is printed on a first push).
- [x] **7. Gates.** Changeset; `pnpm format`; `pnpm check`. Record counts below.

## First-push detection

butler prints ``For channel `<channel>`: pushing first build`` when the channel has no parent build, and `last build is N` otherwise (`itchio/butler` `cmd/push/push.go`, master, read 2026-10-16). `publishToItch` looks for the first line in butler's stdout and stderr. If butler stops printing it, the checklist is not printed; the docs (PUB.5) carry it too.

## Execution log

| Date | Step | Commits | Notes |
| ---- | ---- | ------- | ----- |
| 2026-10-16 | Plan | `6596a97` | — |
| 2026-10-16 | 1–3 | `6719812` | Each test file failed first on its missing module. Step 2's test needed `buildFiles`, so the walk moved to `build-files.ts` here, not in step 4; `root-absolute.test.ts` (16 tests) stayed green. Zip checked with `unzip -t`/`zipinfo` too: 1980-01-01 00:00, `-rw-r--r--`, deflate only where smaller. |
| 2026-10-16 | 4 | `3206b0c` | Red on the missing module and on `ItchBuildInvalid is not a constructor`. `prepareItch` needs no `Files` service (all reads are synchronous `node:fs` inside `Effect.try`). |
| 2026-10-16 | 5 | `25578bd` | Red on the missing modules. `butlerPath` (found on PATH by `findExecutable`) replaces the plan's `butlerFound`, so butler runs from the path that was checked. |
| 2026-10-16 | 6 | `231ee57` | Red: 3 of 8 `cli-args` tests. No `--target` gives `target: undefined` (not `'ruken'`) so the existing `toEqual` tests pass unedited. CLI smoke against a temp build and a fake `butler` on PATH: prepare wrote the zip with the same sha256 twice; missing key and missing butler exit 2 before butler runs; the push printed the exact argv and the checklist; butler exit 7 became ship's exit 7; Ruken `prepare` still wrote `ruken.toml`. Built `dist/cli.js` gave the same zip hash. |
| 2026-10-16 | 7 | this commit | `pnpm format` clean; `pnpm check` exit 0: lint 0 errors (warnings all pre-existing, none in new files), typecheck 26/26, boundaries 62 files 0 findings, style 185 files 0 findings, test:unit 22/22 tasks (ship 24 files, 232 tests). Parity and E2E omitted: no runtime, rendering, UI, host or game code changed. |
| 2026-10-24 | 8 | this commit | Catch-up with `main`: conflicts resolved (see the 02 execution record). Red first (2 tests): `prepareItch` did not scan the build for secrets, so a key in an itch build would have been zipped and pushed; QB.2's scan now runs after the root-absolute check, with `gameDir`'s `.env*` values, and `publishToItch` and the CLI pass `gameDir`. |
