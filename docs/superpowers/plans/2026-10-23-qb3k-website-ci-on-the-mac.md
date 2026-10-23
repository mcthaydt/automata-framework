# QB.3k: website CI on the Owner's Mac TDD plan

- **Spec:** the Owner's rule (project chat, 2026-10-23 14:18Z, message `cmsg_01VQPgZzjNxjPkiB5eeQRiaYEn5HAgQtqKq5jgEupKmMEU`): CI runs on the Owner's own devices, never on GitHub's hosted runners. The framework's `ci.yml` already runs on the Mac (label `af-mac`). Relayed by the merge thread with the setup-request `automata/outbox/2026-10-23-1425-setup-request-website-self-hosted-runner.md` (runner `af-mac-web`, label `af-mac`).
- **Status:** drafted and implemented 2026-10-23; the workflow's own jobs have not run (no runner is registered to this repository yet).
- **Progress:** 1 of 4 steps.
- **Branch:** `claude/project-thread-onilcu-selfhosted`, based on `main` (`c4b5901`).

## Findings that shape the design

- **macOS runners cannot run containers.** The `browsers` and `lighthouse` jobs ran in `mcr.microsoft.com/playwright:v1.63.0-noble`. On the Mac they run on the host and fetch the pinned browsers into the runner's cache (`pnpm exec playwright install ...`, a no-op when cached), exactly as the framework's parity job does.
- **The runners share one home folder**, so each job gives pnpm its own folder (`dest: ${{ runner.temp }}/setup-pnpm`), which QB.3i had removed.
- **The Lighthouse baseline was recorded on GitHub's runner** (Chromium 153, 2 vCPU Ubuntu). The Mac will measure differently, so the numbers have to come from the Mac's first run before the budget relies on them.
- **No hosted label may remain.** A test reads every workflow file and fails on a `runs-on` that names ubuntu, macos, windows or "github-hosted".

## Files

- **Modify:** `.github/workflows/ci.yml`, `tests/workflows.test.ts`, `docs/2026-10-14-site-redesign-results.md` (a section after "CI runner change"), this plan.
- **Consumed:** the runner `af-mac-web` (label `af-mac`) registered to `mcthaydt/automata_website`; `AF_FRAMEWORK_DEPLOY_KEY`.

## Steps

- [x] **1. Tests, then the workflow.** `tests/workflows.test.ts` failed (7 tests) against the hosted workflow; `ci.yml` now has `runs-on: af-mac` on all three jobs, no containers, the pnpm folder, the Playwright installs before the suite and before Chromium is located, and a medians step that names the runner. 28 tests pass; eight planted changes are caught (job on `ubuntu-24.04`, container back, pnpm folder dropped, browsers fetched after the suite, Chromium located before it is fetched, `cache: pnpm`, "GitHub-hosted" in the medians label, a second workflow on `ubuntu-latest`).
- [ ] **2. The runner exists and the first run passes.** The setup-request is done when `af-mac-web` is online; then this PR's own run is the proof. If `checks`, `browsers` or `lighthouse` fails on the Mac for a Mac-specific reason (case-insensitive file system, BSD tools, `bash` 3.2, macOS WebKit, load from the framework's jobs), diagnose it as a product, runner or setup failure, fix what is the workflow's or the tests', and record the first attempt.
- [ ] **3. Lighthouse on the Mac.** Copy the medians the job prints into `lighthouse-baseline.json` (the machine label comes from the log), tighten or loosen nothing without the ratchet tests agreeing, and say in the results doc why the baseline moved machine. If the budget fails on the Mac, the reason is recorded before any line moves.
- [ ] **4. Bookkeeping.** The framework's `docs/02` and `docs/03` rows (QB.3i is superseded by this change); PR #10 takes `main` in, so its browser proof runs on the Mac.
