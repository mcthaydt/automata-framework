# QB.3k: website CI on the Owner's Mac TDD plan

- **Spec:** the Owner's rule (project chat, 2026-10-23 14:18Z, message `cmsg_01VQPgZzjNxjPkiB5eeQRiaYEn5HAgQtqKq5jgEupKmMEU`): CI runs on the Owner's own devices, never on GitHub's hosted runners. The framework's `ci.yml` already runs on the Mac (label `af-mac`). Relayed by the merge thread with the setup-request `automata/outbox/2026-10-23-1425-setup-request-website-self-hosted-runner.md` (runner `af-mac-web`, label `af-mac`).
- **Status:** drafted and implemented 2026-10-23; all three jobs passed on the Mac in run 39969896925 (head `45d1e4f`, runner `af-mac-web`); the baseline re-record and the merge are open.
- **Progress:** 2 of 4 steps.
- **Branch:** `claude/project-thread-onilcu-selfhosted`, based on `main` (`c4b5901`).

## Findings that shape the design

- **macOS runners cannot run containers.** The `browsers` and `lighthouse` jobs ran in `mcr.microsoft.com/playwright:v1.63.0-noble`. On the Mac they run on the host and fetch the pinned browsers into the runner's cache (`pnpm exec playwright install ...`, a no-op when cached), exactly as the framework's parity job does.
- **The runners share one home folder**, so each job gives pnpm its own folder (`dest: ${{ runner.temp }}/setup-pnpm`), which QB.3i had removed.
- **The Lighthouse baseline was recorded on GitHub's runner** (Chromium 153, 2 vCPU Ubuntu). The Mac will measure differently, so the numbers have to come from the Mac's first run before the budget relies on them.
- **One label, `af-mac`, for all three jobs.** The hub's pattern was `vars.AF_LINUX_RUNNER || 'af-linux'` for Linux jobs and `af-mac` for the Mac. No Linux runner is registered to this repository, so a Linux label would queue forever; the setup-request registers a Mac one. Decided 14:30Z, reversible.
- **A fork's pull request must not run on the Owner's machine**, hence the guard on every job. No job holds a write, publish or deploy token, so none stays hosted.
- **No hosted label may remain.** A test reads every workflow file and fails on a `runs-on` that names ubuntu, macos, windows or "github-hosted".

## Files

- **Modify:** `.github/workflows/ci.yml`, `tests/workflows.test.ts`, `docs/2026-10-14-site-redesign-results.md` (a section after "CI runner change"), this plan.
- **Consumed:** the runner `af-mac-web` (label `af-mac`) registered to `mcthaydt/automata_website`; `AF_FRAMEWORK_DEPLOY_KEY`.

## Steps

- [x] **1. Tests, then the workflow.** `tests/workflows.test.ts` failed (7 tests) against the hosted workflow; `ci.yml` now has `runs-on: af-mac` on all three jobs, no containers, the pnpm folder, the Playwright installs before the suite and before Chromium is located, and a medians step that names the runner. Every job also has the fork guard (a pull request runs only when its head is in this repository; hub 2026-10-23 1425), and a test pins that the one secret is the read-only framework key with `contents: read`. 30 tests pass; twelve planted changes are caught (job on `ubuntu-24.04`, container back, pnpm folder dropped, browsers fetched after the suite, Chromium located before it is fetched, `cache: pnpm`, "GitHub-hosted" in the medians label, a second workflow on `ubuntu-latest`, the guard dropped from one job, the guard without its event check, a second secret, `contents: write`).
- [x] **2. The runner exists and the first run passes.** Runner `af-mac-web` was registered at about 15:00Z (hub 1455) and run 39969896925 picked it up unprompted: `checks` 5 min 30 s, `lighthouse` 8 min 31 s (budget passed), `browsers` 12 min 49 s (451 passed, 1 skipped, macOS WebKit). No Mac-specific failure. Numbers are in the results doc.
- [ ] **3. Lighthouse baseline from the Mac.** On `main`'s code the Mac's medians agree with the hosted record within 6 percent (results doc), so nothing moves in this PR. PR #10 changes the code, so the medians its first Mac run prints are copied into `lighthouse-baseline.json` (the machine label comes from the log); nothing is tightened or loosened unless the ratchet tests agree, and say in the results doc why the baseline moved machine. If the budget fails on the Mac, the reason is recorded before any line moves.
- [ ] **4. Bookkeeping.** The framework's `docs/02` and `docs/03` rows (QB.3i is superseded by this change); PR #10 takes `main` in, so its browser proof runs on the Mac.
