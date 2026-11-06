# Website: docs, API reference, releases, editors, community and the DX.10 register (plan)

> **Rows:** framework `docs/02-master-delivery-plan.md`: DX.12 (already a dry run, unchanged), M8.6w, M10.4, M10.6 (editors, releases, community, Ritmo content gaps 6 and 7), DX.10b to DX.10e (as a proof-gated register). Skipped: DX.10f and M10.5 (wait for M9.10 and the free base-3d). **Lane:** website, one wide PR (Owner, 2026-10-31: "make the PRs WIDE, like big feature"), parts as commits. **Branch:** `claude/website-wide-docs-editors-restore`.

## Decisions (defaults taken, open to veto)

- **W-D1 (DX.12):** the deploy job, `release.ts` and `check-deployed.ts` already exist as a dry run (`.github/workflows/deploy.yml`, plan `2026-10-30-dx-12-deploy-dry-run.md`). Nothing to build until the Owner supplies hosting, a credential and DNS, so this PR leaves them alone.
- **W-D2 (M8.6w):** `docs/guide` does not exist in the framework yet (M8.6b). `readGuides` returns nothing for a missing folder, so the sync is safe today and renders the guides the day the folder appears. Guides are the framework's files with front matter; `./x.md` links become `/docs/guide-x`.
- **W-D3 (M10.4):** the complete API reference is parsed from `llms-api.txt` into `src/data/api-reference/<version>.json` and a small search list; one page per package per version at `/api/<version>/<package>`; a new release adds a version and keeps the old ones. The ⌘K menu loads the search list on first open. Signatures are plain wrapped text, not code blocks with a control each: a package has hundreds of exports.
- **W-D4 (M10.6 releases):** `/releases` is the framework's package CHANGELOGs read with `git show` at `framework.ref`, unedited, with the "Updated dependencies" lines left out. `src/data/publication.ts` says nothing is on npmjs.org; the page says so.
- **W-D5 (M10.6 editors):** no try-it build (M10.0 is undecided; default: none). The page lists the nine editors from the EDS spec and says none is released.
- **W-D6 (M10.6 community):** GitHub issues and the showcase; no chat invite until DX.13 gives a read-back one.
- **W-D7 (DX.10b to e):** `src/data/restorations.ts` holds each cut claim, what it waits for, a pattern for its wording and the proof once it exists. `tests/restorations.test.ts` fails if wording appears without proof, and if proof is recorded without its copy on the site.
- **W-D8 (Ritmo gaps 6, 7):** two docs, "Services and failure" (ADR 0003) and "Saves and migrations" (M5 spec §4.2, §5, §6), each pinned to its source by `tests/deep-docs.test.ts`. Plus gets a docs section that says it is free and not yet installable.
- **W-D9:** the framework's own words on the new pages (doc comments, changelog entries) are marked `data-framework-copy`, as `/inside` does, so the standalone check leaves them to the framework. The sources at `f8023a9` still name the reference projects in places; they clear when `framework.ref` moves to a commit with clean comments.

## Steps (TDD, each a commit)

1. [x] `tests/guides-sync.test.ts` (failed first: no module `sync-guides`), then `readGuides` and its hook in `syncDocs`.
2. [x] `tests/deep-docs.test.ts` (failed first: no module), then the three docs; `docs-routing` no longer hard-codes 18.
3. [x] `tests/api-reference.test.ts`, `tests/api-pages.test.ts`, `tests/command-menu-api.test.ts` (each failed first), then the parser, the pages and the menu.
4. [x] `tests/releases.test.ts` (failed first), then `sync-releases`, `publication.ts` and `/releases`.
5. [x] `tests/editors-page.test.ts`, `tests/restorations.test.ts` (failed first), then `/editors`, `/community` and the register.
6. [x] Browser gates on the new routes (`site.e2e.ts`, Chromium): found the package pages overflowed at 375 px (long names, an unbroken formula) and that a control per export buried the keyboard path; fixed with wrapping and plain signatures, then 126 passed.

## Execution log (2026-10-31, this container: Node 22.23, framework sibling at `e1f82d7`, `framework.ref` `f8023a9`)

- `pnpm test`: 76 files pass; `tests/api-contract.test.ts` (2) and `tests/double-jump.test.ts` fail here only because the sibling framework checkout has no `node_modules` and is not at `framework.ref` (they resolve `@mcthaydt/automata-sim`, `pixi.js`, `effect`, `zod` from it). They run in CI against the checkout at `framework.ref`.
- `pnpm check` (svelte-check): the same sibling-resolution errors only; no error in this PR's files.
- `vite build`, `write-seo-files`, `pnpm check:site`: 64 pages, all rules pass.
- `playwright` (Chromium, `site.e2e.ts`, new routes): 126 passed. WebKit, Lighthouse and the full e2e run in CI.
- Not verified here: `pnpm build` end to end (its workshop step needs the framework's dependencies), WebKit, Lighthouse.
