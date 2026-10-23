# QB.3f: website CI and Lighthouse budget TDD plan

- **Spec:** framework repo `docs/superpowers/specs/2026-10-16-quality-bar-design.md` §4.2 (the Lighthouse row), §7 QB.3, and the QB.3f row of `docs/02-master-delivery-plan.md`: "A CI workflow for `automata_website` (none exists); the Lighthouse budget from the first quiet-machine run (with QB.4/DX.12). The website's `api-contract` test fails on `main` because the framework ships no LICENSE; it resolves with DX.11."
- **Status:** drafted 2026-10-23; implemented and verified locally 2026-10-23 (the workflow's own jobs have not run: no runner and no `AF_FRAMEWORK_TOKEN` yet); stacked on QB.3 (PR #2).
- **Progress:** 7 of 7 steps.
- **Branch:** `claude/project-thread-onilcu`, based on `claude/clever-pasteur-ujmu6e-qb3`.

## Findings that shape the design

- **The site reads the framework's sources, and the framework moved.** `tests/`, `workshop/` and `scripts/sync-*.ts` import from the sibling checkout `../automata-framework` (`examples/base-2d/...`). Framework `main` no longer has `examples/base-2d` (EX.2 moved it to `games/emberwick` on 2026-10-16), so against today's `main` the site's `pnpm check` has 16 errors, `verify:workshop` (and so `pnpm build`) fails, and 6 test files fail. This is not caused by QB.3; it means a CI that follows `main` would be red for a reason unrelated to the change under test.
- **So CI pins the framework.** The commit whose files match the site's committed copies is `365f115` (M1 exit): at it, QB.3's recorded results reproduce exactly (check 0 errors, build, `check:site` 26 pages, `pnpm test` 102 passed, 1 expected fail, 1 failed). The 1 failure is the LICENSE one below. `framework.ref` holds the commit; moving it is a deliberate change (sync the site, then edit the file).
- **The one real failure is F-1.** `api-contract` "publishes the exact current project files" fails on `LICENSE`, `LICENSE-SCOPE.md` and the `license` field of `package.json`: the site's copies carry MIT and the framework does not ship it until DX.11. The same F-1 pattern as `license-claim.test.ts` applies: those three files alone may differ, and a second, `it.fails` test keeps the difference visible and goes red when DX.11 lands.
- **The framework repository is private.** The checkout needs a read token (`AF_FRAMEWORK_TOKEN`, an Owner action) and the runner label `af-linux` must be registered to this repository. *(Superseded 2026-10-23: the jobs run on GitHub-hosted `ubuntu-24.04`; see the results doc, "CI runner change".)*
- **Lighthouse needs production-like transfer sizes.** `scripts/serve-static.ts` serves files uncompressed. Its new `--compressed` flag serves the `.br`/`.gz` siblings adapter-static already writes, as the host will.

## Interfaces

- **Produced:** `.github/workflows/ci.yml` (jobs `checks`, `browsers`, `lighthouse`); `framework.ref`; `.nvmrc`; `lighthouserc.json`; `pnpm lighthouse`; `serve-static.ts --compressed`.
- **Consumed:** the framework at `framework.ref`; the repository secret `AF_FRAMEWORK_TOKEN`; ~~the runner label `af-linux` (`vars.AF_LINUX_RUNNER`)~~ (superseded, see above); Playwright 1.63.0's image `mcr.microsoft.com/playwright:v1.63.0-noble`.

## Files

- **Create:** `.github/workflows/ci.yml`, `framework.ref`, `.nvmrc`, `lighthouserc.json`, `tests/workflows.test.ts`, `tests/lighthouse-budget.test.ts`, `tests/serve-static.test.ts`.
- **Modify:** `scripts/serve-static.ts`, `tests/api-contract.test.ts`, `package.json` (`lighthouse`; `@lhci/cli` 0.15.1 and `yaml` devDependencies), `pnpm-lock.yaml`, `vite.config.ts` (test timeout), `.gitignore` (`.lighthouseci/`, `test-results/`), `docs/2026-10-14-site-redesign-results.md`.

## Steps

- [x] **1. Workflow shape.** `tests/workflows.test.ts` fails because `ci.yml` does not exist; write `ci.yml`; it passes. Pins: triggers, read-only permissions, three jobs, the runner label with no hosted fallback, SHA-pinned actions, no event text in shell, no persisted checkout token, the framework checkout at `framework.ref` with the token and a clear failure when it is missing, the Playwright image tag equal to the installed version, reports kept on failure.
- [x] **2. `api-contract` license guard, and a flaky test.** Run `pnpm test` against the framework at `365f115` and confirm the one failure is the three license files. Rewrite the test so those files alone may differ and an `it.fails` test holds the difference; confirm green. The full suite then failed 2 of 3 runs in `source-explorer` (`createLoop` appears in two highlighted tokens); the assertion now asks for all of them, and four full runs pass.
- [x] **3. `serve-static --compressed`.** `tests/serve-static.test.ts` fails (no flag); implement; passes: brotli when accepted, gzip otherwise, plain without a sibling, `Vary`, 404 unchanged, default mode unchanged.
- [x] **4. Lighthouse budget.** `tests/lighthouse-budget.test.ts` fails (no config); write `lighthouserc.json` (four pages, three runs, median, mobile, `error` level) and `pnpm lighthouse`; passes.
- [x] **5. Baseline run.** `pnpm lighthouse` on the build; `scripts/record-lighthouse-baseline.ts` writes `lighthouse-baseline.json` (medians, machine, browser, Lighthouse version). The first run put three pages under the spec's 0.9 (0.62, 0.66, 0.62), so the spec's rule applies ("thresholds come from the first recorded run"): per-page budgets at the baseline with room for noise, and the test refuses anything looser than that, or than the spec where a page meets it. Step 4's test was rewritten for this after the first run showed the single global budget would fail.
- [x] **6. Unit-test timeout.** Under load three tests missed the 5 s default (QB.3 results). Set `testTimeout` to 30 s in `vite.config.ts`.
- [x] **7. Gates and bookkeeping.** `pnpm check`, `pnpm build`, `pnpm check:site`, `pnpm test` against `365f115`; the Chromium browser suite; WebKit goes to a bus test-request. Results doc written; the framework's 02 and 03 rows are a separate docs PR.

## Execution log

See the results doc, "CI and Lighthouse (QB.3f, 2026-10-23)": the verification list, the Lighthouse baseline and the red-first evidence.
