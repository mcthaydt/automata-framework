# STANDALONE.1: the website is target-neutral and standalone TDD plan

- **Row:** framework `docs/02-master-delivery-plan.md` STANDALONE.1 (AF #311). Size M.
- **Direction:** Owner, 2026-10-31: "Let's not couple the automata framework so tightly to Ruken - that's just one of the many places we can distribute content to easily; we have tauri export, Ruken export, and itch export"; "But especially the website, the website makes it seem like it's specifically for Ruken"; "Let's also cut references to Last Light and Floor Fifty, automata framework is standalone". ADR 0006 (AF #311): `web`, `itch`, `ruken` and `tauri` are peer targets.
- **Status:** drafted 2026-10-31. **Progress:** 7 of 7 steps.
- **Branch:** `claude/website-STANDALONE.1-target-neutral`, stacked on DX.10a (`claude/website-DX.10a-restore-claims`, website#28, head `82e0a87`), whose `/ai#csp` copy this task also changes.

## What is true today (framework.ref `f8023a9`)

- `automata-ship` publishes to `ruken` and `itch` (`packages/ship/src/cli-args.ts`: `ShipTarget = 'ruken' | 'itch'`); a `web` build goes on any static host (ADR 0005). The desktop build (Tauri) is not built yet: ADR 0006 moves it into core (rows DIST.0 to DIST.6). So the copy names all four targets as peers and says the desktop one is planned. It claims no desktop export. It also does not say there is no default target: at `f8023a9` `automata-ship` publishes to Ruken when `--target` is left out (`cli-args.ts`, `shipTarget(undefined)`), so the copy says only that a game chooses its target when it is built.
- ADR 0006's move of the host contract into AF (DIST rows) has not landed either, so copy that describes `Hosting` says what it is (one interface behind every target), not who owns its types.

## The check (test first)

`scripts/site-checks.ts` gains `checkStandalone`, run by `checkSite` on every built page's text, title and description, and on the published plain-text files (`llms.txt`, `llms-guides.txt`, `llms-full.txt`, `llms-api.txt`):

1. **Names.** `FloorFifty`, `Floor Fifty`, `The Last Light`, `Last Light` and the reference repos' names fail.
2. **Ruken-only framing.** A short list of phrases that cast Ruken as AF's own host fails: "reference (gaming) host", "Ruken, the reference", "web browsers and (the) Ruken", "the Ruken (gaming) platform" as AF's subject, "Ruken first", "the Ruken SDK owns". Naming Ruken as one target, or a Ruken-only fact scoped to that target ("On Ruken, …"), passes.
3. **The four targets.** The homepage, `/docs/capabilities` and `llms.txt` each name web, itch.io, Ruken and desktop (Tauri).
4. **Framework text.** Text the site shows verbatim from the framework is exempt: `/inside` (`docs/stack.md`), the example source viewers (`projects.json`, `examples.json`, `demos.json`) and `llms-full.txt`/`llms-api.txt`. These copies are held byte for byte to the framework by their own tests, so the names leave them when AF's STANDALONE.2 removes them and the site re-syncs. Each exempt surface is marked (`data-framework-copy` on the element that holds it), and a test fails once an exempt copy no longer contains a name, so the exemption is removed with the re-sync, not left behind.

## Steps

- [x] **1. The check, red.** `tests/site-checks.test.ts`: each name and each framing phrase fails a built page and a plain-text file; scoped wording ("On Ruken, a game's headers …", "Publish to itch.io or Ruken") passes; a page missing a target fails the targets check; text inside `[data-framework-copy]` is exempt. Then `checkStandalone`. Running `pnpm check:site` on the current build fails, listing the pages to fix.
- [x] **2. Showcase.** FloorFifty and The Last Light go from `src/data/showcase.ts`, the showcase page and `tests/showcase.test.ts` (Emberwick stays); the ledger's showcase rows are reworded without the names.
- [x] **3. Docs and plain text.** `scripts/sync-docs.ts`: the overview, the security doc (renamed "Zero-eval CSP and host security", target by target), the capabilities doc (the four targets), the FAQ ("Where can I publish?" in place of "What is Ruken?"), `llms.txt` and `llms-guides.txt` intros. Then `pnpm sync` for `docs.json` and the text files.
- [x] **4. Pages.** The homepage (a distribution item naming the four targets; the Boot guide without "the Ruken handshake"), `/ai` (the hosting rule and the verify steps target by target; `#csp` scoped "On Ruken"), the cheatsheet's Hosting module description, and any other page step 1 lists.
- [x] **5. Framework copies marked.** `data-framework-copy` on `/inside`'s article and the source viewers' code panes; the stale-exemption test.
- [x] **6. Gates.** `pnpm check`, `pnpm test`, `pnpm build` (restore `src/data/first-change-proof.json`), `pnpm check:site`, `site.e2e` in Chromium and WebKit, `pnpm lighthouse`.
- [x] **7. Review images** of every changed page at 1280x800 and 390x844, Chromium and WebKit, under `docs/evidence/owner-visual/2026-10-31-standalone-1/` with a README.

## Decisions for the Owner's veto (defaults taken; Owner approvals are auto-accepted, 2026-10-31)

- The site's origin stays `automata.ruken.com` (decision 11, the Owner's hosting choice); it is a domain, not framing.
- Desktop (Tauri) is named as a planned target until the framework ships it.
- Framework text shown verbatim keeps its words until STANDALONE.2 changes them upstream; the site never edits a verbatim copy.

## Execution log

- 2026-10-31: plan drafted on the DX.10a head `82e0a87`.
- 2026-10-31, steps 1–5.
  - The four-targets check is its own `checkTargets(root)`, run by `pnpm check:site`. It isn't part of `checkSite`, because many existing site-check fixtures replace `index.html` with a body of their own.
  - The targets sentence lives in one place, `src/data/targets.ts` (`DISTRIBUTION_TARGETS`), read by the homepage ("Publish where your players are"), the overview, capabilities ("Where a game goes"), the FAQ ("Where can a game be published?", which replaces "What is Ruken?"), `llms.txt` and `llms-guides.txt`.
  - Ruken-only facts stay, scoped to Ruken: `/ai#csp` ("Each target serves a game with its own headers. On Ruken, …"); the security doc ("Test the built game under the headers its target serves. On Ruken, …"; retitled "Zero-Eval CSP & Host Security"); the cheatsheet's `gameId`, `defineShipConfig` and publish notes; the release prompt and verify commands (the prepare step per target). The 780×270 copy now says "a fake host".
  - The showcase keeps Emberwick. The reference-projects section, the two entries and their meta text are gone. In the ledger, their rows become one retired row.
  - Framework copies are marked `data-framework-copy`: `/inside`, the source viewer, and the playground's static code and editor. `tests/standalone-exemption.test.ts` fails once none of them names a reference project.
  - Red first: the 13 new site-check cases and the showcase test failed before their changes.
  - Tests changed with the copy, each assertion kept: `tests/docs.test.ts` (the security doc's title) and three DX.10a pins in `tests/audit-regressions.test.ts` (the `/ai#csp`, security-doc and 780×270 sentences).
- 2026-10-31, steps 6–7 (head e5778bf, plus the images):
  - `pnpm check` 0 errors; `pnpm test` 67 files, 468 passed, 1 expected fail.
  - `pnpm build`; `pnpm check:site` 46 pages pass. A planted name and a planted framing phrase in a built page both fail it.
  - `site.e2e`: Chromium 344 passed; WebKit 342 passed, 2 skipped.
  - `pnpm lighthouse`: 0 assertion failures (performance 98–100).
  - Remaining names in the build: only `/inside` and `llms-full.txt`/`llms-api.txt`, all framework copies.
  - Images: 10 regions × 2 sizes × 2 browsers, 0 px overflow, no name in any page's text.
