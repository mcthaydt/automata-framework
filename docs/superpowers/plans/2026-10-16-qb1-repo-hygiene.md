# QB.1: framework repo hygiene TDD plan

- **Spec:** [`docs/superpowers/specs/2026-10-16-quality-bar-design.md`](../specs/2026-10-16-quality-bar-design.md) §3 F-7, §4.1, §7 QB.1, acceptance QB-a (§9). QB.0 approved by the Owner 2026-10-16 with every recommended default.
- **Lane:** ship. **Branch:** `claude/clever-pasteur-ujmu6e-qb1`.
- **Progress:** 4 of 9 steps.

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
- [ ] **5. Secrets.** In `gitleaks.test.ts`: the asset name and SHA-256 for linux/darwin x64/arm64; an unsupported platform throws; a download whose bytes do not match the pinned SHA-256 is rejected (injected fetch). Confirm it fails, implement `gitleaks.ts`. `secrets.ts` copies `fixtures/secrets/` into a temporary repository, commits it and requires gitleaks to find the planted key; then it scans this repository's full history with `.gitleaks.toml` (which allowlists the fixture folder) and requires no finding. Run `pnpm secrets`.
- [ ] **6. New-dependency report.** In `new-deps.test.ts`: a dependency absent from every base manifest is reported with its manifest, version and registry (`workspace:` and `file:` are not); a version change is not "new"; with an injected fetch, an npm package gets its publisher and weekly downloads, and a 404 marks it missing; `formatReport` prints a Markdown table and the CLI exits 1 on a missing package. Confirm it fails, implement.
- [ ] **7. knip.** In `knip.test.ts`: knip on `fixtures/knip` (an unused export) exits 1 and names the export. Confirm it fails (no fixture), add the fixture, confirm. Configure `knip.jsonc` for the monorepo; `pnpm knip` passes on `main`. Real findings go to 02 as follow-ups.
- [ ] **8. Repository files and workflows.** In `repo-files.test.ts`: `SECURITY.md` names a contact and a response window, `.github/CODEOWNERS` assigns `*` to `@mcthaydt`, the README links `SECURITY.md` and `docs/runbook.md`, and the runbook has the "Lost credentials" and "Rebuild from Git" sections. In `workflows.test.ts`: the release job uses `environment: release`; `ci.yml` runs `pnpm audit:deps`, `pnpm secrets` and `pnpm knip`, and the new-dependency report on pull requests only; `ci:local` runs the same checks. Confirm they fail, then write the files and workflow steps.
- [ ] **9. Gates and bookkeeping.** `pnpm format`, `pnpm check`, `pnpm audit:deps`, `pnpm secrets`, `pnpm knip`, `pnpm deps:new`. Record results here, in 02 and in 03.

## Owner actions (not agent work)

- Create the `release` environment (Settings → Environments) with the Owner as required reviewer, and allow only `main`.
- Install the Renovate GitHub App on the repository.
- Turn on private vulnerability reporting (Settings → Security) so `SECURITY.md`'s first channel works.

## Execution log

| Step | Result | Evidence |
|---|---|---|
