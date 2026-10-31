# STANDALONE.1: the website is target-neutral and standalone TDD plan

- **Row:** framework `docs/02-master-delivery-plan.md` STANDALONE.1 (AF #311). Size M.
- **Direction:** Owner, 2026-10-31: "Let's not couple the automata framework so tightly to Ruken - that's just one of the many places we can distribute content to easily; we have tauri export, Ruken export, and itch export"; "But especially the website, the website makes it seem like it's specifically for Ruken"; "Let's also cut references to Last Light and Floor Fifty, automata framework is standalone". ADR 0006 (AF #311): `web`, `itch`, `ruken` and `tauri` are peer targets.
- **Status:** drafted 2026-10-31. **Progress:** 0 of 7 steps.
- **Branch:** `claude/website-STANDALONE.1-target-neutral`, stacked on DX.10a (`claude/website-DX.10a-restore-claims`, website#28, head `82e0a87`), whose `/ai#csp` copy this task also changes.

## What is true today (framework.ref `f8023a9`)

- `automata-ship` publishes to `ruken` and `itch` (`packages/ship/src/cli-args.ts`: `ShipTarget = 'ruken' | 'itch'`); a `web` build goes on any static host (ADR 0005). The desktop build (Tauri) is not built yet: ADR 0006 moves it into core (rows DIST.0 to DIST.6). So the copy names all four targets as peers and says the desktop one is planned. It claims no desktop export.
- ADR 0006's move of the host contract into AF (DIST rows) has not landed either, so copy that describes `Hosting` says what it is (one interface behind every target), not who owns its types.

## The check (test first)

`scripts/site-checks.ts` gains `checkStandalone`, run by `checkSite` on every built page's text, title and description, and on the published plain-text files (`llms.txt`, `llms-guides.txt`, `llms-full.txt`, `llms-api.txt`):

1. **Names.** `FloorFifty`, `Floor Fifty`, `The Last Light`, `Last Light` and the reference repos' names fail.
2. **Ruken-only framing.** A short list of phrases that cast Ruken as AF's own host fails: "reference (gaming) host", "Ruken, the reference", "web browsers and (the) Ruken", "the Ruken (gaming) platform" as AF's subject, "Ruken first", "the Ruken SDK owns". Naming Ruken as one target, or a Ruken-only fact scoped to that target ("On Ruken, …"), passes.
3. **The four targets.** The homepage, `/docs/capabilities` and `llms.txt` each name web, itch.io, Ruken and desktop (Tauri).
4. **Framework text.** Text the site shows verbatim from the framework is exempt: `/inside` (`docs/stack.md`), the example source viewers (`projects.json`, `examples.json`, `demos.json`) and `llms-full.txt`/`llms-api.txt`. These copies are held byte for byte to the framework by their own tests, so the names leave them when AF's STANDALONE.2 removes them and the site re-syncs. Each exempt surface is marked (`data-framework-copy` on the element that holds it), and a test fails once an exempt copy no longer contains a name, so the exemption is removed with the re-sync, not left behind.

## Steps

- [ ] **1. The check, red.** `tests/site-checks.test.ts`: each name and each framing phrase fails a built page and a plain-text file; scoped wording ("On Ruken, a game's headers …", "Publish to itch.io or Ruken") passes; a page missing a target fails the targets check; text inside `[data-framework-copy]` is exempt. Then `checkStandalone`. Running `pnpm check:site` on the current build fails, listing the pages to fix.
- [ ] **2. Showcase.** FloorFifty and The Last Light go from `src/data/showcase.ts`, the showcase page and `tests/showcase.test.ts` (Emberwick stays); the ledger's showcase rows are reworded without the names.
- [ ] **3. Docs and plain text.** `scripts/sync-docs.ts`: the overview, the security doc (renamed "Zero-eval CSP and host security", target by target), the capabilities doc (the four targets), the FAQ ("Where can I publish?" in place of "What is Ruken?"), `llms.txt` and `llms-guides.txt` intros. Then `pnpm sync` for `docs.json` and the text files.
- [ ] **4. Pages.** The homepage (a distribution item naming the four targets; the Boot guide without "the Ruken handshake"), `/ai` (the hosting rule and the verify steps target by target; `#csp` scoped "On Ruken"), the cheatsheet's Hosting module description, and any other page step 1 lists.
- [ ] **5. Framework copies marked.** `data-framework-copy` on `/inside`'s article and the source viewers' code panes; the stale-exemption test.
- [ ] **6. Gates.** `pnpm check`, `pnpm test`, `pnpm build` (restore `src/data/first-change-proof.json`), `pnpm check:site`, `site.e2e` in Chromium and WebKit, `pnpm lighthouse`.
- [ ] **7. Review images** of every changed page at 1280x800 and 390x844, Chromium and WebKit, under `docs/evidence/owner-visual/2026-10-31-standalone-1/` with a README.

## Decisions for the Owner's veto (defaults taken; Owner approvals are auto-accepted, 2026-10-31)

- The site's origin stays `automata.ruken.com` (decision 11, the Owner's hosting choice); it is a domain, not framing.
- Desktop (Tauri) is named as a planned target until the framework ships it.
- Framework text shown verbatim keeps its words until STANDALONE.2 changes them upstream; the site never edits a verbatim copy.

## Execution log

- 2026-10-31: plan drafted on the DX.10a head `82e0a87`.
