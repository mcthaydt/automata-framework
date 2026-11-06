# DX.9w: the site renders the evidence file TDD plan

- **Spec:** framework repo `docs/superpowers/specs/2026-10-16-dx-small-games-ai-native-design.md` §3.10 (the evidence file; "the website's sync reads it at build time and renders proof from it. A hard-coded hash on the site becomes a website test failure") and §11 (restoration rules); the DX.9w row of `docs/02-master-delivery-plan.md`. AF side: framework plan `2026-10-16-dx9-evidence-file.md`.
- **Status:** drafted 2026-10-23; implemented and locally verified 2026-10-23, including the real data (synced on the Mac, committed unchanged in `9210a3c`; the sync was red by design until then). Based on `main` now that QB.3, QB.3f and PRODUCT.4w are merged.
- **Progress:** 7 of 7 steps.
- **Branch:** `claude/project-thread-onilcu-dx9w`.

## Findings that shape the design

- **The artifact cannot be fetched from where this was built.** `api.github.com` and the artifact blob host are blocked, and the container's `gh` token is invalid. The framework's `evidence` artifact exists (run 39113372614 at `c2cca72`, 2,279 bytes, expires 2027-01-16), but only a machine with `gh auth login` can download it. So the sync is a script a person runs (`pnpm sync:evidence`), the tests use clearly marked samples, and nothing in this PR is typed from the framework's plan notes. The numbers on the site will be the artifact's, byte for byte.
- **Validate with the framework's schema.** The artifact carries `evidence.schema.json` (`z.toJSONSchema(EvidenceSchema)`). The site validates with it through zod's `z.fromJSONSchema`, so there is one schema owner, and adds only policy: CI runs only, clean tree only, `enginesAgree` recomputed from the hashes, each engine once per golden.
- **A hash typed by hand is the failure to catch.** A sim hash is 16 hex digits. `tests/audit-regressions.test.ts` scans every file under `src/` and fails on one, except in the evidence pair and in `projects.json` (the framework's own source files, shown verbatim and held to the framework by `api-contract`). Long numbers with no letter in them are not hashes.

## Interfaces

- **Produced:** `parseEvidence(evidence, schema): Evidence` and `EvidenceError` (`src/lib/evidence.ts`); `EVIDENCE: Evidence | undefined` (`src/data/evidence.ts`, from `src/data/evidence.json` and `evidence.schema.json`); `ProofReport.svelte`; the `/proof` page and its footer link; `pnpm sync:evidence [--from <folder>]` (`scripts/sync-evidence.ts`: `candidateRuns`, `assertFromRun`, `installEvidence`); `findHardCodedHashes` (`tests/helpers`).
- **Consumed:** the framework's artifact `evidence` (`evidence.json`, `evidence.schema.json`) from the latest successful `ci.yml` push run on `main`; the GitHub CLI.

## Files

- **Create:** `src/lib/evidence.ts`, `src/data/evidence.ts`, `src/lib/components/ProofReport.svelte`, `src/routes/proof/+page.svelte`, `scripts/sync-evidence.ts`, `tests/evidence.test.ts`, `tests/proof-page.test.ts`, `tests/sync-evidence.test.ts`, `tests/helpers/hard-coded-hashes.ts`, `tests/fixtures/evidence.sample.json`, `tests/fixtures/evidence.schema.sample.json`.
- **Modify:** `src/lib/components/Footer.svelte`, `src/app.css`, `package.json` (`sync:evidence`), `tests/audit-regressions.test.ts`, `docs/2026-10-14-site-redesign-results.md`.
- **Not created here:** `src/data/evidence.json` and `src/data/evidence.schema.json` (step 7).

## Steps

- [x] **1. Validation.** `tests/evidence.test.ts` fails on the missing module; write `src/lib/evidence.ts`; 14 cases pass (a fitting document; nine malformed ones; a local run; a dirty tree; `enginesAgree` lying both ways; an engine listed twice).
- [x] **2. Sync.** `tests/sync-evidence.test.ts` (candidate runs; a valid artifact copied byte for byte; an invalid one writes nothing; a missing file named; an artifact from another revision refused), then `scripts/sync-evidence.ts`.
- [x] **3. Report.** `tests/proof-page.test.ts` (every hash shown and no other; engines in order with versions; agreement stated both ways; seed, ticks, sources; CI run link and revision; packages and release state; the automata check shown as pending, never as passed), then `ProofReport.svelte`.
- [x] **4. Page and link.** The `/proof` route (with a plain "no evidence yet" state that claims nothing), the footer link, the styles. `pnpm build` and `check:site` pass with 27 pages; the QB.3 browser gates (375, 768, 1280 and 780×270, axe, keyboard, buttons) pass on `/proof` with the sample data loaded.
- [x] **5. The hard-coded-hash guard.** In `tests/audit-regressions.test.ts`: the real scan is green, a planted `31f50888ccb4cf0a` in `src/lib/site.js` turned it red, the scanner catches a hash in a page and a data file, allows the evidence pair and `projects.json`, and ignores long numbers.
- [x] **6. Red-first evidence.** Each test failed on a planted defect: a hash typed into a source file, a sync that copies before validating, a sync that skips validation, `dirty` and `kind` checks removed, the disagreement verdict replaced.
- [x] **7. Sync the real file.** The Mac ran `pnpm sync:evidence` (a bus test-request, run 39113372614 at `c2cca72`); the two files were committed unchanged (`9210a3c`, sha256 checked). `pnpm check`, `pnpm test` (202 passed, 1 expected fail), `pnpm build`, `pnpm check:site` (28 pages) and the Chromium suite (226 passed) pass with `main` merged in. The framework's 02 row records the revision and run.

## Not in this task

DX.10 restores each cut claim with its own wording pinned to this evidence (`docs/2026-10-14-cut-claims.md`); DX.9a adds the `automata check` results to the evidence shape when DX.5 and DX.6 land (the site shows "Not proved yet" until then).
