# QB.1: framework repo hygiene TDD plan

- **Spec:** [`docs/superpowers/specs/2026-10-16-quality-bar-design.md`](../specs/2026-10-16-quality-bar-design.md) §3 F-7, §4.1, §7 QB.1, acceptance QB-a (§9). QB.0 approved by the Owner 2026-10-16 with every recommended default.
- **Lane:** ship. **Branch:** `claude/clever-pasteur-ujmu6e-qb1`.
- **Progress:** 9 of 9 steps.

## Global constraints

- **Strict TDD** in `tooling/` and `packages/`: write the failing test, run it and confirm the failure reason, make the minimal change, confirm it passes.
- **QB-a:** every new check fails on a planted fixture and passes on `main`. A fixture never trips the repository's own scans (fixtures are excluded by path in `.gitleaks.toml`, `knip.jsonc` and `renovate.json`).
- **Workflows:** every action stays pinned to a 40-character SHA; `permissions:` stays `contents: read` at the top level. `packages/ship/src/workflows.test.ts` pins the new shape.
- **Pins:** a new devDependency (`knip`) gets its row in `docs/versions.md` (`tooling/versions` fails otherwise). Ruken-matched pins are never updated by Renovate.
- **Gates for the PR:** `pnpm format`, `pnpm check`, `pnpm audit:deps`, `pnpm secrets`, `pnpm knip`. No runtime, rendering, UI, host or game change, so `test:parity` and `test:e2e` are not selected. `pnpm lint:actions` needs a Docker daemon.
- **Process:** Conventional Commits; no changeset (nothing published changes: tooling packages are private, workflows and docs are not published). Tick each step here when its checks pass.

## Files

- **Create:**
  - `README.md`, `SECURITY.md`, `.github/CODEOWNERS`, `docs/runbook.md`;
  - `renovate.json`, `.gitleaks.toml`, `knip.jsonc`;
  - `tooling/repo-hygiene/` (`@mcthaydt/repo-hygiene`, private): `package.json`, `tsconfig.json`, `turbo.json`, `src/gitleaks.ts`, `src/gitleaks.test.ts`, `src/secrets.ts` (CLI), `src/audit.ts`, `src/audit.test.ts`, `src/audit-cli.ts` (CLI), `src/new-deps.ts`, `src/new-deps.test.ts`, `src/new-deps-cli.ts` (CLI), `src/knip.test.ts`, `src/repo-files.test.ts`, `fixtures/secrets/`, `fixtures/audit/`, `fixtures/knip/`;
  - `tooling/consumer-smoke/src/readme.ts`, `src/readme.test.ts`, `fixtures/readme/README.md`;
  - `tooling/versions/src/renovate.ts`, `src/renovate.test.ts`.
- **Modify:**
  - `tooling/check-style/src/style.ts`, `src/style.test.ts` (the `file-length` rule);
  - `tooling/consumer-smoke/src/run.ts` (a "README commands resolve" step), `tooling/consumer-smoke/README.md`, `tooling/consumer-smoke/turbo.json` (new, inputs);
  - `tooling/versions/turbo.json` (inputs: `renovate.json`);
  - root `package.json` (`knip`, `audit:deps`, `secrets`, `deps:new` scripts; `knip` in `check` and `ci:local`; audit and secrets in `ci:local`), `docs/versions.md` (`knip` row);
  - `.github/workflows/ci.yml` (audit, secrets, knip, new-dependency report), `.github/workflows/release-packages.yml` (`environment: release`), `packages/ship/src/workflows.test.ts`.

## Interfaces

- **Consumed:** `pnpm audit`, gitleaks 8.30.1 (release binary, SHA-256 pinned), knip 6.39.0, the npm registry (`registry.npmjs.org/<name>`, `api.npmjs.org/downloads/point/last-week/<name>`), `git show origin/main:<path>`.
- **Produced (all private tooling):**
  - `checkFile` gains the `file-length` rule and `MAX_SOURCE_LINES = 600`;
  - `readmeCommands(markdown): string[]` and `unresolvedCommands(commands, workspace): string[]`;
  - `unfrozenRukenPins(versionsDoc, renovateConfig): string[]`;
  - `gitleaksAsset(platform, arch)`, `ensureGitleaks({ cacheDir, fetch })`;
  - `auditVerdict({ exitCode, output }): 'clean' | 'advisories' | 'error'`;
  - `newDependencies(base, head)`, `describeDependencies(deps, fetch)`, `formatReport(rows)`.

## Steps

- [x] **1. 600-line ceiling.** In `style.test.ts`: a 601-line non-test file gives one `file-length` finding naming 601 and 600; a 600-line file gives none; the rule also applies to `index.ts`. Run `pnpm --filter @mcthaydt/check-style test` and confirm it fails (no such rule). Add the rule to `checkFile`, confirm it passes, and that `pnpm style` passes on `main`'s tree (largest file 574 lines).
- [x] **2. README commands.** In `readme.test.ts`: `readmeCommands` reads every line of the `sh` blocks (comments dropped, `&&` split); a fixture README with an unknown root script, an unknown `--filter` package, a missing script on a real package and a missing `node` file gives one problem each; the root `README.md` gives none. Confirm it fails (no module, then no README). Implement `readme.ts`, write `README.md` (clone, `corepack enable`, `pnpm install`, `pnpm --filter <Emberwick> dev`, the checks, the consumer smoke command), confirm it passes. Add the step to `run.ts`.
- [x] **3. Renovate.** In `renovate.test.ts`: a versions doc whose "Same as Ruken" row is missing from the disabled rule fails with that name; the real `docs/versions.md` against `renovate.json` passes. Confirm it fails, implement `renovate.ts`, write `renovate.json` (monthly, npm and GitHub Actions, digests pinned, Ruken-matched pins and the pins that follow them disabled, fixtures and `vendor/` ignored), confirm it passes.
- [x] **4. Audit.** In `audit.test.ts`: `auditVerdict` reads pnpm's "N vulnerabilities found" output as `advisories`, exit 0 as `clean`, and a registry error as `error`. Confirm it fails, implement. `audit-cli.ts` first audits `fixtures/audit` (minimist 1.2.5, a critical advisory) and requires `advisories`, then audits the workspace with `pnpm audit --prod --audit-level=high` and requires `clean`. Run `pnpm audit:deps` and record the result.
- [x] **5. Secrets.** In `gitleaks.test.ts`: the asset name and SHA-256 for linux/darwin x64/arm64; an unsupported platform throws; a download whose bytes do not match the pinned SHA-256 is rejected (injected fetch). Confirm it fails, implement `gitleaks.ts`. `secrets.ts` copies `fixtures/secrets/` into a temporary repository, commits it and requires gitleaks to find the planted key; then it scans this repository's full history with `.gitleaks.toml` (which allowlists the fixture folder) and requires no finding. Run `pnpm secrets`.
- [x] **6. New-dependency report.** In `new-deps.test.ts`: a dependency absent from every base manifest is reported with its manifest, version and registry (`workspace:` and `file:` are not); a version change is not "new"; with an injected fetch, an npm package gets its publisher and weekly downloads, and a 404 marks it missing; `formatReport` prints a Markdown table and the CLI exits 1 on a missing package. Confirm it fails, implement.
- [x] **7. knip.** In `knip.test.ts`: knip on `fixtures/knip` (an unused export) exits 1 and names the export. Confirm it fails (no fixture), add the fixture, confirm. Configure `knip.jsonc` for the monorepo; `pnpm knip` passes on `main`. Real findings go to 02 as follow-ups.
- [x] **8. Repository files and workflows.** In `repo-files.test.ts`: `SECURITY.md` names a contact and a response window, `.github/CODEOWNERS` assigns `*` to `@mcthaydt`, the README links `SECURITY.md` and `docs/runbook.md`, and the runbook has the "Lost credentials" and "Rebuild from Git" sections. In `workflows.test.ts`: the release job uses `environment: release`; `ci.yml` runs `pnpm audit:deps`, `pnpm secrets` and `pnpm knip`, and the new-dependency report on pull requests only; `ci:local` runs the same checks. Confirm they fail, then write the files and workflow steps.
- [x] **9. Gates and bookkeeping.** `pnpm format`, `pnpm check`, `pnpm audit:deps`, `pnpm secrets`, `pnpm knip`, `pnpm deps:new`. Record results here, in 02 and in 03.

## Owner actions (not agent work)

- Create the `release` environment (Settings → Environments) with the Owner as required reviewer, and allow only `main`. Until then GitHub creates it on first use with no protection, so the release job runs unapproved.
- Install the Renovate GitHub App on the repository.
- Turn on private vulnerability reporting (Settings → Security) so `SECURITY.md`'s first channel works.

## Execution log

| Step | Result | Evidence |
|---|---|---|
| 1 | Done (`0cd26b0`) | 2 tests failed on the missing rule, then 32/32; `pnpm style`: 177 files, 0 findings (largest 574 lines) |
| 2 | Done (`bbd5262`) | Failed on the missing module, then on the missing README; then 9/9 in consumer-smoke; `pnpm --filter @af-examples/base-2d dev` served Emberwick's page locally |
| 3 | Done (`fc22a84`) | Failed on the missing module and `renovate.json`, then 3/3; `renovate-config-validator` (Renovate 44.164.7 and 41): valid |
| 4 | Done (`1fba916`) | Failed on the missing module, then 3/3; `pnpm audit:deps`: fixture reports minimist 1.2.5 (critical), workspace "No known vulnerabilities found" |
| 5 | Done (`e9dcf28`) | Failed on the missing module, then 9/9. This worktree is a shallow clone, so `pnpm secrets` stops there by design; in a full clone of the branch it found the planted key in the self-test and scanned 388 commits with no leaks. Without `.gitleaks.toml` the same scan reports the fixture file, so the allowlist is what keeps it clean |
| 6 | Done (`6b01f80`) | Failed on the missing module, then 7/7; the CLI exited 1 on a planted nonexistent package and reported `knip` as found (publisher `webpro`) |
| 7 | Done (`171efae`) | Failed with no knip binary, then passed on the fixture; `pnpm knip` clean on the branch; a planted export in `tooling/check-style` made it fail. Real findings baselined in `knip.jsonc` and listed as QB.1a in 02 |
| 8 | Done (`171efae`) | `repo-files.test.ts` failed on the missing `SECURITY.md`, then 25/25 in repo-hygiene; 5 new workflow tests failed, then 86/86 in `workflows.test.ts`; actionlint 1.7.12 (release binary, SHA-256 checked; no Docker daemon here, no shellcheck installed): no findings |
| 9 | Done | See below |

**Gates (2026-10-16, branch head before bookkeeping `0b89080`):**
- `pnpm format`: no fixes. `pnpm check`: lint, typecheck (27/27), boundaries, style (177 files, 0 findings) and knip passed; its unit step's first attempt failed on timeouts in `packages/content` (`render-types.test.ts`, 65 s over a 60 s limit) at load average 33–46 from other lanes, and a rerun of `pnpm test:unit` then timed out in `packages/runtime` (15 s). Both packages are untouched here and pass alone. `turbo run test:unit --concurrency=1 -- --testTimeout=30000`: 23/23 tasks, 1,698 tests passed, 4 skipped.
- `pnpm audit:deps`, `pnpm knip`, `pnpm deps:new` (reports `knip`, found): pass. `pnpm secrets`: pass in a full clone (above).
- `pnpm build && node tooling/consumer-smoke/src/run.ts --from packs`: passed, every step, including "12 commands resolve".
- `pnpm changeset status --since=origin/main` and `check-changesets.ts` (3 changesets, 0 problems): pass with an empty changeset.
- Not selected: `pnpm test:parity` and `pnpm test:e2e` (no runtime, rendering, UI, host or game change). Pending: CI on af-linux.
