# DX.10a: restore the evidence-backed claims TDD plan

- **Row:** framework `docs/02-master-delivery-plan.md`, DX.10a (DX.10 slice 1). Prerequisites DX.9w (merged, website #4) and WEB.S1 (`framework.ref` is `f8023a9`).
- **Spec:** framework DX spec `docs/superpowers/specs/2026-10-16-dx-small-games-ai-native-design.md` §3.10 and §11 (restoration rules); the site's ledger `docs/2026-10-14-cut-claims.md`.
- **Status:** drafted 2026-10-31. **Progress:** 0 of 9 steps.
- **Branch:** `claude/website-DX.10a-restore-claims`.

## Rules every step follows

1. A claim comes back only with its proof link, and in bounded wording (the ledger's "Supported direction"). Universal guarantees stay retired.
2. Each restored row moves from its table to a new **Restored** section in `docs/2026-10-14-cut-claims.md`, with: the new wording, where it appears on the site, the proof (file, revision, run), and the test that pins it.
3. Each restored sentence is pinned in `tests/audit-regressions.test.ts` (a new `describe('Restored claims (DX.10a)')`): the test reads the rendered page or generated file and asserts the exact bounded wording **and** its proof link. Red first: the test is written before the copy and fails because the copy is absent.
4. Numbers (hashes, run ids, revisions, engine versions) are never typed into `src/`: they come from `src/data/evidence.json` or a synced framework file. The DX.9w hash guard stays green.
5. Proof is pinned to the site's `framework.ref` (`f8023a9`) unless the row names another revision. If the evidence file is re-synced (DX.9w's open step, blocked 2026-10-31: no successful AF `main` run since run 39113372614 at `c2cca72`), the pinned tests read the new values with no copy change.

## Findings that shape the design

- `/proof` (DX.9w) already renders the evidence file: six goldens, engine hashes, agreement, seed, ticks, run and revision. Determinism and parity copy links there instead of repeating numbers.
- AF's `tooling/api-index` (`pnpm api-index`) writes `api.json`, `api.md`, `llms-api.txt`, `llms-full.txt` and `cheatsheet.md` to `tooling/api-index/dist/`. The site's `static/llms-full.txt` is still hand-assembled in `scripts/sync-docs.ts` from `CHEATSHEET_MODULES`.
- AF exports the typed boot errors from `packages/runtime/src/boot/boot-error.ts` (`LoadStalled`, `AssetLoadFailed`, `RendererUnavailable`, …) with doc comments; the docs can be generated from the api-index rows instead of retyped.
- `compileHeaders` lives in AF's `packages/ship` (`deploy/bin/render-headers.ts`) and the CLI's CSP probe (`packages/cli/src/check/csp-probe-live.ts`); the site's own QB.4a headers are its evidence for the site, not for games.
- M4.10's input matrix (`examples/e2e/input-matrix.e2e.ts`, 17 cells, 22 journeys, three engines, merged in AF #90 at `c2cca72`) is DOM/fake-host evidence. Real-device acceptance is still the Owner's (M4 spec §13), so the copy keeps the two apart.
- The playground (WEB.PLAY.7 and .8) shows live updates, diagnostics and restart on the site itself; that is the site's evidence for the hot-reload and restart journeys, bounded to the playground's scope.

## Interfaces

- **Consumed:** `src/data/evidence.ts` (`EVIDENCE`); AF at `framework.ref`: `tooling/api-index/dist/{api.json,llms-full.txt}` (run `pnpm api-index` in the AF checkout), `packages/runtime/src/boot/boot-error.ts`, `packages/ship/deploy/bin/render-headers.ts`, `examples/e2e/input-matrix.e2e.ts`.
- **Produced:** `scripts/sync-api-index.ts` (`syncApiIndex(frameworkDir, outDir)`: copies `llms-full.txt` byte for byte and writes `src/data/api-index.json` from `api.json`, refusing a file whose recorded revision is not `framework.ref`); `pnpm sync` runs it; the Restored section of the ledger.

## Files

- **Create:** `scripts/sync-api-index.ts`, `tests/sync-api-index.test.ts`, `tests/fixtures/api-index.sample.json`, `src/data/api-index.json` (synced), `tests/restored-claims.test.ts` only if `audit-regressions.test.ts` would pass 600 lines (otherwise the describe lives there, as the row asks).
- **Modify:** `docs/2026-10-14-cut-claims.md`, `tests/audit-regressions.test.ts`, `scripts/sync-docs.ts` (stop writing `llms-full.txt`), `package.json` (`sync`), `static/llms-full.txt` (synced), `src/routes/+page.svelte`, `src/routes/ai/+page.svelte`, `src/routes/inside/+page.svelte`, `src/routes/proof/+page.svelte` (anchors the copy links to), the docs that name boot errors and CSP (`scripts/sync-docs.ts` sources).

## Steps

- [ ] **1. Ledger skeleton.** Add the empty Restored section and its column set (wording, where, proof, test) to the ledger. No copy change.
- [ ] **2. Determinism wording and generated hashes.** Test first: the homepage and `/inside` say determinism holds for the same code, content, seed, initial state and commands, and link `/proof`; no "complete" or "100%"; the hashes shown are only the evidence file's (existing guard). Then the copy.
- [ ] **3. The parity run, revision and scenario.** Test first: `/proof` names the CI workflow and job, the run link, the revision and each golden's scenario and tick count, all read from `EVIDENCE`; the copy says "on each push to `main`" only if AF's `ci.yml` at `framework.ref` runs parity on push (check the file and quote its line in the ledger), otherwise "in the parity job of the linked run".
- [ ] **4. Bounded AI-integration and CSP wording naming `compileHeaders`.** Test first: `/ai` says instructions are context, not enforcement, and names `compileHeaders` as the function that renders a game's headers, with a link to its source at `framework.ref`; no "guarantee" or "100% compliant".
- [ ] **5. Typed `BootError` docs.** Test first: the boot-errors doc lists exactly the tagged errors api-index reports for `@mcthaydt/automata-runtime` (read from `src/data/api-index.json`), each with its doc comment; no "zero untrapped crashes".
- [ ] **6. The 780×270 input journeys (M4.10).** Test first: the copy says the keyboard, touch and gamepad journeys run at 780×270 in Chromium, WebKit and Firefox under the fake host, links the matrix spec at `framework.ref`, and says real-device acceptance is separate and open.
- [ ] **7. Hot-reload journey and diagnostics; the restart journey.** Test first: the copy describes the playground's live update, its file/line/column diagnostics and its Restart, bounded to the playground, linking the example page; the content hash is not called the sim hash.
- [ ] **8. `llms-full.txt` and the API reference from api-index.** Test first (`tests/sync-api-index.test.ts`): a valid sample copies byte for byte; a revision other than `framework.ref` writes nothing; a missing file is named. Then `scripts/sync-api-index.ts`, wire it into `pnpm sync`, drop the hand-written `llms-full.txt` from `sync-docs.ts`, and retire "Complete plain-text documentation" / "Exhaustive" only to the extent the generated corpus supports (the label says what the corpus is).
- [ ] **9. Gates.** `pnpm check`, `pnpm test`, `pnpm build` (restore `src/data/first-change-proof.json` after), `pnpm check:site`, the QB.3 browser gates on the changed pages in Chromium and WebKit, Lighthouse on the changed pages within the existing budgets, and owner-visual images under `docs/evidence/owner-visual/2026-10-31-dx-10a/` with a README.

## Owner gate

Acceptance of the restored copy (row DX.10a). Never ticked by an agent.

## Execution log

- 2026-10-31: plan drafted at website `a7cc68e`, framework reference `f8023a9` (AF clone read at `1590f03`). DX.9w's evidence re-sync is blocked (every AF `main` push run checked from 2026-10-30 13:27Z to 2026-10-31 03:43Z is cancelled; the run at `f8023a9`, 41091073745, has no `evidence` artifact), so steps 2 and 3 render the current evidence file (run 39113372614 at `c2cca72`) and must not describe it as the `f8023a9` run.
