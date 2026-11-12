# `@pixi/3d` from the public registry, and the deploy rule lifted

Branch `claude/pixi-3d-public`, one session, no subagents, started 2026-11-12 from `claude/pixi-3d-beta-3` at `b25ec539`
(the beta.3 port; `origin/main` did not contain it when this started, so the branch builds on it, not on `main`).

**The Owner's ruling, 2026-11-12:** "pixi3d is now in public beta", and, asked whether that means moving to the public npm
package and lifting the rule against deploying 3D builds: "yes, move to the public pixi3d package and lift the deploy rule".

## Tracking

| Step | What | State | Evidence |
| --- | --- | --- | --- |
| 0 | Verify the premise: is `@pixi/3d` on npmjs.org without a token, and is it the vendored package | done 2026-11-12 | [§0](#0-the-premise) |
| 1 | Inventory of everything the closed beta shaped | done 2026-11-12 | [§1](#1-inventory) |
| 2 | The move: registry dependency, tarballs gone, rules lifted, docs updated | done 2026-11-12 | [§2](#2-the-move) |
| 3 | Proof: format, uncached check, build, 3D suites and journeys, the stranger's install, secrets, API report and index | done 2026-11-12 (Chromium only) | [§3](#3-proof) |
| 5 | Brought up to main (`origin/main` `d401ec4d` merged, the proof taken again on the merged tree) | done 2026-11-12 (Chromium only) | [§5](#5-brought-up-to-main) |

Progress: 5 of 5 steps (100%). What is left is the Owner's: [§4](#4-for-the-owner).

## 0. The premise

`npm view @pixi/3d versions dist-tags license repository --json --registry=https://registry.npmjs.org/
--userconfig=<an empty file>` (so no token can be read), 2026-11-12:

```json
{
  "versions": ["0.1.0-beta.1", "0.1.0-beta.2", "0.1.0-beta.3", "0.1.0"],
  "dist-tags": { "beta": "0.1.0-beta.3", "latest": "0.1.0" },
  "license": "MIT",
  "repository": { "url": "git+https://github.com/pixijs/3d.git", "type": "git" }
}
```

- **Public:** yes, installable from npmjs.org with no token.
- **Version:** AF is ported to 0.1.0-beta.3, which is published (dist-tag `beta`), so AF stays on it. `0.1.0` (`latest`) is newer
  and is a follow-up for the Owner (same peer `pixi.js` `^8.23.0`, same dependency `meshoptimizer` `^1.2.0`; not examined
  further here).
- **The public beta.3 against the vendored one.** `npm pack @pixi/3d@0.1.0-beta.3` from the registry (`dist.shasum`
  `36808db48c00f8e0adbbb1cb9b1cf4a4a1229f4a`, `dist.integrity` `sha512-2k34FOL9…qV7g==`). The two `.tgz` files differ as bytes
  (SHA-256 `ba1eadc13b68a7fb31f91d4d12b6ad0bc0f23f1d909119ca260ae85f4cf0dd4f` public, `5eb4c18e…0ad` vendored). Unpacked into two
  empty folders outside the repository and compared file by file (SHA-256 of every file): **the same 2,567 paths; 2,565 files are
  byte-identical, among them every file under `dist/` and `skills/`, and `LICENSE`.** Two differ:
  - `package.json`: `homepage`, `bugs.url` and `repository.url` say `pixijs/3d` where the vendored one says `pixijs/pixi-3d`.
    Nothing else (version, exports, `peerDependencies`, `dependencies`, `files`, `sideEffects` are the same).
  - `README.md`: the public one lacks the vendored one's first 18 lines, the closed-beta banner ("This is a read-only mirror of the
    private `@pixi/3d` repo… install it from the tarball… Please keep the code and the builds themselves inside the beta").
    So the code AF runs is the same; no golden, recorded picture or hash should move.
- **Licence:** MIT (the same `LICENSE` text, "Copyright (c) 2026 PixiJS"). It allows use, change and redistribution, built games
  and commercial use included; the one duty is to keep the copyright and permission notice with copies of the software. The
  closed beta's "keep the builds inside the beta" was the release page's request, not the licence, and the public README no
  longer carries it.

## 1. Inventory

Found with `git grep` for `vendor/pixi-3d`, `pixi-3d-0.1.0`, `file:`, `closed beta`, `closed-beta`, `private build`, `AF_BETA_3D`,
`D-1`, `Pixi3dInPublicBuild`, `audience`, `--private`, `until Pixi 3D`, `goes public`, `terms allow`, across the tree (history
under `docs/archive/`, `docs/refactor/` and earlier `docs/superpowers/` audits, plans and specs is listed once, not changed).
"How I know" is the comment or document that names the beta as the reason.

### A. Install plumbing

| Where | What | Why it exists | Change |
| --- | --- | --- | --- |
| `vendor/pixi-3d/pixi-3d-0.1.0-beta.3.tgz` | the tarball 8 packages install | the beta was not on npm (`vendor/pixi-3d/README.md`) | delete |
| `vendor/pixi-3d/pixi-3d-0.1.0-beta.2.tgz` | used by nothing (the README says so) | kept as the beta.3 port's reference | delete |
| `vendor/pixi-3d/README.md`, `LICENSE` | the tarballs' record; the licence text is in the npm package | same | delete |
| `vendor/pixi-3d/release-notes-0.1.0-beta.3.txt` | beta.3's notes, the port's authority | saved from the invite-only release page | move beside this record (history cites the old path) |
| `packages/3d`, `packages/editor-3d`, `games/base-3d`, `extensions/character-kit`, `figures`, `world-kit`, `lcd-panel`, `retro-crisp` (`package.json`) | `"@pixi/3d": "file:../../vendor/pixi-3d/pixi-3d-0.1.0-beta.3.tgz"` | the tarball | `"0.1.0-beta.3"` from the registry |
| `pnpm-lock.yaml` | 8 importers and 2 package entries name `file:vendor/pixi-3d/…` | the tarball | `pnpm install`; only `@pixi/3d` entries may move |
| `packages/tools/src/shared/create-game/template-3d.ts` | a game made inside the workspace (`linkWorkspace`) gets the tarball; outside, `PIXI_3D_SPEC` (`0.1.0-beta.3`) | the tarball | always `PIXI_3D_SPEC`; its comment loses "the closed beta" |
| `tooling/consumer-smoke/src/commands.ts` (`pack3d`) | the 3D stranger's game overrides `@pixi/3d` to the vendored tarball | the tarball | no override: the game installs `@pixi/3d` from npmjs.org |
| `tooling/repo-hygiene/tests/unit/workflow-invariants.test.ts:121` | pins `vendor/pixi-3d/**` in `3d.yml`'s path filter | the folder | drop the entry (test first), with the workflow line |
| `.github/workflows/3d.yml:22` | `- "vendor/pixi-3d/**"` in the pull-request paths | the folder | remove the line (its own commit) |
| `.npmrc`, `pnpm-workspace.yaml`, root overrides, patches | none of them names `@pixi/3d` |  | none |
| secrets allowlists (`tooling/repo-hygiene/src/secrets.ts` and its config) | none names the tarballs |  | none |

### B. Packages private because of `@pixi/3d`

Not changed here (the Owner's launch decision). Listed in §4 with what publishing each would need.

| Package | How I know |
| --- | --- |
| `@automata/3d` (`packages/3d`) | `package.json` description "Private until Pixi 3D is public"; README; `src/entries/index.ts` ("Private while D-1 stands"); `tooling/release/tests/unit/release-list.test.ts` (`@automata/3d` (D-1)); `examples-runner/src/catalog.ts` (`UNPUBLISHED_EXTENSIONS`) |
| `@automata/editor-3d` | depends on `@pixi/3d` and `@automata/3d`; the guard on `packages/editor` (`--forbid packages/editor:@pixi/3d,@automata/editor-3d,@automata/3d`) keeps it out of the published 2D editor |
| `@automata/cutscenes`, `character-kit`, `world-kit`, `lcd-panel`, `retro-crisp` | `examples-runner/src/catalog.ts`: "build on `@automata/3d`, so they wait for it" |
| `@automata/figures` | `extensions/figures/README.md` ("closed beta… keep it, and every build of the viewer, private"); `closed-beta-guard.test.ts` names it with `@pixi/3d` |
| `@af-games/base-3d` | a game (never published as a package); its _builds_ were private, see C |

### C. Rules that refuse or skip a build that carries `@pixi/3d` (the deploy rule)

| Where | Rule | Change |
| --- | --- | --- |
| `packages/tools/src/shared/ship/prepare/build-scans.ts` (`scanBuild`) | a `public` build that carries `@pixi/3d` fails with `Pixi3dInPublicBuild` (X-b); used by Ruken, itch.io, web and desktop | lift: no build is refused for `@pixi/3d`; the `./extras` refusal (no-eval CSP, S7-g) stays |
| `packages/tools/src/shared/ship/errors.ts` | `Pixi3dInPublicBuild`; `PrivatePublishNotLocal`'s message gives the beta as the reason | remove the first; reword the second (a private build is one the author keeps local) |
| `packages/tools/src/shared/ship/prepare/pixi3d-markers.ts` | header: "the closed-beta guard… when Pixi 3D is public, the core markers' check goes" | the core markers stay (the published-package guard and the bundle test use them); header says what they are for now |
| `prepare-build.ts`, `publish-build.ts`, `cli-args.ts`, `config/ship-config.ts`, `targets/{itch,web,tauri}/prepare-*.ts`, `app/ship-cli.ts` | doc comments and error unions name the closed beta | drop `Pixi3dInPublicBuild` from the unions; reword. `audience` and `publish --private` stay as a choice an author makes (kept off the store), no longer forced by `@pixi/3d` |
| `games/base-3d/ship.config.ts` | `audience: 'private'` "the scene carries @pixi/3d, a closed beta (D-1)": CI's `prepare` writes no `ruken.toml` | remove: base-3d prepares as any game |
| `site/scripts/scan-closed-beta.ts` (last step of the site's `build`) | refuses any page carrying `@pixi/3d` or its extras | keep only the extras check (the CSP reason); rename to `scan-pixi3d-extras.ts` |
| `site/scripts/check-launch.ts` (`pixiPublicProblems`) | the site's deploy waits until `@pixi/3d` is on npmjs.org | remove (it is, and the reason, "its terms allow no public deployment", is gone) |
| tests that encode the above | `prepare-build.test.ts` ("stops a public build that contains @pixi/3d"), `build-scans.test.ts`, `prepare-itch.test.ts`, `prepare-web.test.ts`, `prepare-tauri` tests, `publish-build.test.ts`, `site/tests/unit/scripts/scan-closed-beta.test.ts`, `build-script.test.ts`, `check-launch` tests | inverted first: a public build that carries `@pixi/3d` is prepared; one with its extras is still refused |

### D. Rules about _published packages_ (kept; the Owner's launch decision)

These keep `@pixi/3d` out of what AF publishes to npm, not out of games. They stay until the Owner decides which 3D packages ship;
their wording loses "closed beta".

| Where | Rule |
| --- | --- |
| root `package.json` `boundaries` | `--forbid <every published package>:@pixi/3d,@automata/figures`; `--forbid packages/editor:@pixi/3d,@automata/editor-3d,@automata/3d` |
| `tooling/release/tests/unit/closed-beta-guard.test.ts` | every publishable package is in that `--forbid` list |
| `tooling/release/tests/unit/release-list.test.ts` | `@automata/3d` is not publishable (D-1) |
| `packages/tools/scripts/copy-editor.ts` (+ test) | `-tools`' build refuses to copy an editor build that carries `@pixi/3d` ("the private Pixi 3D beta… cannot be published") |
| `packages/tools/src/shared/create-game/three-d-gate.ts` (+ test), `stranger-3d.test.ts` | `create-game --template 3d` is behind `AF_BETA_3D=1` outside the workspace because `@automata/3d` is not on npm |
| `site/playground/build.ts`, `site/playground/src/playground-catalog.ts` | the playground leaves out unpublished extensions' examples and The Last Light's models |

### E. Words that say 3D is private, cannot be deployed or needs the tarball

| Where | Change |
| --- | --- |
| `docs/guides/3d.md` (banner, "Publishing") | 3D builds publish like 2D ones; `@automata/3d` is not on npm yet, so the template is behind `AF_BETA_3D=1` |
| `docs/guides/publish-to-web.md:18` | drop "the private Pixi 3D beta" from what the scan refuses |
| `docs/README.md:16` | `packages/3d` "not published yet" in place of "private until Pixi 3D is public" |
| `docs/runbook.md` (step 6, the `check:launch` list) | Pixi 3D is public; the step is done |
| `docs/versions.md` (`@pixi/3d`, `pixi.js` rows), `docs/stack.md` (`pnpm docs:stack`) | from npmjs.org, not the vendored tarball |
| `docs/adr/0002-pixi-for-2d-and-3d.md:20` | an amendment line: public on npm, MIT, the deploy rule lifted |
| `docs/adr/0007-3d-look.md:98` | history; left |
| `packages/3d/README.md`, `packages/3d/package.json` (description), `src/entries/index.ts`, `src/entries/camera-view.ts` | not published yet; no "closed beta" or "vendored" |
| `extensions/figures/README.md:12` | from npm; the package stays private (the Owner's) |
| `tooling/examples-runner/src/catalog.ts` (+ test comment), `tooling/consumer-smoke/src/commands.ts`, `stranger-3d.test.ts` comments | "not published yet", not "until Pixi 3D is public" |
| `agents/automata/skills/automata-api/reference/api.md` | generated (`pnpm api-index --write`) from the doc comments above |
| `docs/superpowers/progress.md:284` | the refusal is lifted |
| `docs/provenance/sources.md:647` | history of where The Last Light's copy came from; left |

### F. Workflows (read only; changed only where named)

| File:line | Now | Change |
| --- | --- | --- |
| `.github/workflows/3d.yml:22` | `- "vendor/pixi-3d/**"` | remove (the folder is gone) |
| `.github/workflows/site.yml:9-10` | comment: `check:launch` refuses "Pixi 3D not public" | drop that clause |
| `.github/workflows/site.yml:59-60` | comment: "The build ends with the closed-beta scan… a Pixi 3D that is not public" | "the Pixi 3D extras scan"; drop the Pixi clause |
| `.github/workflows/game-ci.yml:57` | `automata ship prepare --target ruken` | none: with base-3d's `audience` gone it writes `ruken.toml` |
| none fetches a tarball or uses a private-registry token |  |  |

Size: 9 install sites (8 manifests and the lockfile) plus the template and the smoke; 2 tarballs; 1 build rule in `ship`
(four targets), 1 game config, 2 site gates; 6 package-publishing guards kept; 16 texts; 3 workflow lines (one path, two comments).

Surprising: the deploy restriction was never in the licence (MIT, the same text then and now); it was the release page's
banner, which the public README drops. `check:launch` already passes on its own (it asks npmjs.org whether `@pixi/3d` exists),
while the site's scan and `ship`'s scan read the built bytes, so they would have refused 3D forever without a code change.

## 2. The move

Every change quotes the Owner's second sentence in its commit.

| Commit | What |
| --- | --- |
| `545226cd` | The eight manifests pin `"@pixi/3d": "0.1.0-beta.3"` from the registry. `pnpm install`: the lockfile diff is `@pixi/3d` alone (8 importers' `specifier`/`version`, its package entry now `resolution: {integrity: sha512-2k34FOL9…qV7g==}` — the registry's — and its snapshot; `meshoptimizer` and `pixi.js` unchanged). `vendor/pixi-3d/` deleted (both tarballs, `README.md`, `LICENSE`); beta.3's release notes moved here (`release-notes-0.1.0-beta.3.txt`). `create-game --template 3d` pins `PIXI_3D_SPEC` inside the workspace too (test first: it failed on the `file:` spec). The 3D stranger's journey no longer overrides `@pixi/3d`, and asserts from the game's lockfile that it came from the registry |
| `7d18c2a3` | Workflow: `3d.yml` loses `- "vendor/pixi-3d/**"`. Its invariant test no longer pins the path, and a new case fails on any path filter naming a missing folder (it failed on `vendor/pixi-3d/` first) |
| `a0e77233` | The deploy rule: `scanBuild` no longer refuses `@pixi/3d`; `Pixi3dInPublicBuild` is gone from `errors.ts` and every target's error union. `@pixi/3d/extras` is still refused (no-eval). Tests inverted first (five failed on `Pixi3dInPublicBuild`): a public Ruken prepare writes `ruken.toml`, itch.io zips, the web passes, a public publish uploads. The dead `audience` field left the scan and prepare inputs; `ShipConfig.audience` and `publish --private` stay as an author's choice, worded without Pixi 3D. `games/base-3d` drops `audience: 'private'` (its ship-config test failed first). `copy-editor` kept, reworded. Changeset `ship-pixi-3d-public.md` (`@automata/tools`, patch) |
| `e8b177fd` | The site: `scan-closed-beta.ts` → `scan-pixi3d-extras.ts` (refuses only the extras; the site's CSP forbids eval, QB.4); `check:launch` no longer asks for Pixi 3D. Tests first (missing module, old build step) |
| `d098771f` | Workflow: `site.yml`'s two comments (no step changes) |
| `f68edecc` | The texts of §1 E: guides, READMEs, ADR 0002 (an amendment line), runbook, versions, comments. History left |
| `308458d9` | `pnpm api-index --write`: the agent API reference follows `ShipConfig.audience`'s doc comment |

The workflow diffs, in full:

```diff
--- a/.github/workflows/3d.yml
+++ b/.github/workflows/3d.yml
@@ -19,7 +19,6 @@ on:
       - "games/base-3d/**"
       - "examples/3d/**"
-      - "vendor/pixi-3d/**"
       - "agents/**"
--- a/.github/workflows/site.yml
+++ b/.github/workflows/site.yml
-# `check:launch` (a personal address, Pixi 3D not public, a private repository and a domain with no mail all refuse the
-# deploy), uploads `site/build/` with wrangler, and asks the live host for the headers the site means to send.
+# `check:launch` (a personal address, a private repository and a domain with no mail all refuse the deploy), uploads
+# `site/build/` with wrangler, and asks the live host for the headers the site means to send.
-      # The build ends with the closed-beta scan; check:site holds every page and the headers file to the site's rules;
-      # check:launch refuses a personal mailbox, a missing mail record, a private repository and a Pixi 3D that is not public.
+      # The build ends with the Pixi 3D extras scan; check:site holds every page and the headers file to the site's rules;
+      # check:launch refuses a personal mailbox, a missing mail record and a private repository.
```

## 3. Proof

Node 24.22 (`/opt/node24/bin` first), four CPUs, Chromium only. No golden, recorded picture or hash moved: `git status` was clean
after every suite below, and no test needed re-recording.

| Gate | Result |
| --- | --- |
| `pnpm format` (Biome) | clean |
| `TURBO_FORCE=true pnpm check` | first run: `pnpm style` found a plan ID in the new site scan's comment (fixed, `be6db992`). Second run: **exit 0**, 56 of 56 static tasks and 66 of 66 unit tasks, 0 cached, 79 changesets, 0 problems, 16 m 58 s |
| pre-commit hooks | every commit's affected unit tests passed (66 of 66 tasks for the lockfile, ship and docs commits) |
| `pnpm build` | 16 of 16 tasks, 0 cached, exit 0 |
| `pnpm api-report` | 6 core packages, 0 API breaks, 0 undeclared; `--update` wrote nothing |
| `pnpm api-index` | stale on `ShipConfig.audience`'s doc comment; `--write`, committed (`308458d9`); 1,300 exports, 0 undocumented |
| `@automata/3d` browser suites, Chromium (`browser` + `webgpu`, `AF_WEBGPU=software`) | 21 files, 83 passed, 2 skipped |
| `games/base-3d` built, then `automata ship prepare` for `web`, `itch`, `ruken` | build exit 0; web: "checked 25 files in dist"; itch: wrote `base-3d-0.1.0-itch.zip`; ruken: wrote `dist/ruken.toml`. The build carries `@pixi/3d` (its markers are in `assets/index-*.js` and `assets/View3DGlobalData-*.js`) |
| `games/base-3d` journeys (`base-3d`, `base-3d-dev`) | 14 passed (1.5 m) |
| `examples/3d` journeys (`examples-3d`) | 22 passed (2.2 m) |
| A stranger outside the workspace: an empty folder in the scratch directory, `npm install @pixi/3d@0.1.0-beta.3 pixi.js@8.23.0 --registry=https://registry.npmjs.org/ --userconfig=<empty file>` with `NPM_TOKEN` and `NODE_AUTH_TOKEN` empty | 14 packages; `node_modules/@pixi/3d` is 0.1.0-beta.3, MIT, `pixijs/3d`; `package-lock.json` resolves it from `https://registry.npmjs.org/@pixi/3d/-/3d-0.1.0-beta.3.tgz`, integrity `sha512-2k34FOL9…qV7g==`. No token, no vendored file |
| The 3D stranger's journey (`AF_BETA_3D=1`, `stranger-chromium`) | the game is made and installs, and the new assertion (its lockfile resolves `@pixi/3d` by registry integrity, no `file:`, no `vendor/pixi-3d`) passes; it then stops where it always has: `pnpm check` cannot load `vite.config.ts` because the packed `@automata/3d` ships TypeScript under `node_modules` (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`). Not caused here; it goes when `@automata/3d` builds to `dist/` for publishing |
| `pnpm secrets` | fails on the history, not on this branch: 16 `generic-api-key` findings, all in two commits already on `main` before this branch (`e074227f`, `docs/provenance/figures-manifest.json`; `24bc0049`, `games/emberwick/words-sources.json`, 15). None in this branch's commits. Needed `git fetch --unshallow` first |

Not run: WebKit and Firefox (parity, journeys, the iPad and `-webkit` projects), a real GPU, WebGPU on hardware, the editor-3d,
character-kit, world-kit and figures browser suites, `examples/3d-story` (its web server does not start on this base, as before),
the packed-install smoke for 2D (`consumer-smoke --from packs`), `release-checks.yml` as a whole.

## 4. For the Owner

**Merge.** Done in a later session, on the Owner's instruction through the coordinator: [§5](#5-brought-up-to-main).

**Packages that could now be published** (none was flipped; each is `"private": true`):

| Package | What publishing it needs |
| --- | --- |
| `@automata/3d` | `private` off; a build to `dist/` with `publishConfig.exports` (it ships TypeScript sources today, which is what stops the 3D stranger); `@pixi/3d` and `pixi.js` as `peerDependencies` (a published package should not pin its own copy); leave the `--forbid … @pixi/3d` guard for it and update `closed-beta-guard.test.ts` and `release-list.test.ts` (both name it as unpublishable); join the changesets `fixed` group; a README for npm (it has one); it already has an API report (`3d.api.md`) |
| `@automata/editor-3d` | the same, plus a decision on how `automata editor` serves it (the build of `-tools` copies only the 2D page and refuses one with Pixi 3D, `copy-editor.ts`) |
| `@automata/cutscenes`, `character-kit`, `world-kit`, `lcd-panel`, `retro-crisp` | wait for `@automata/3d`; then `private` off, a build to `dist/`, peers on `@automata/3d` and `@pixi/3d`, a changeset and a README each; `examples-runner`'s `UNPUBLISHED_EXTENSIONS` and the playground filter follow |
| `@automata/figures` | the same, and the boundaries guard names it beside `@pixi/3d` in every published package: lift that only when it is published |
| `create-game --template 3d` | open without `AF_BETA_3D=1` once `@automata/3d` is on npm (`three-d-gate.ts`), and turn the 3D stranger's journey on for every run |

**Follow-ups.**

- **`@pixi/3d` 0.1.0** (`latest`) is out; AF stays on beta.3. Read only, from the two public tarballs: 0.1.0 is ESM-only (the CJS
  `.js`, `.d.cts` and their maps, 1,272 files, are gone; `exports` lose the `require` branch; `main` and `module` are gone); the
  standalone bundles are renamed `pixi-3d*.mjs` → `pixijs-3d*.mjs`; 60 runtime `.mjs` modules changed (maths shapes, vectors and
  matrices; the glTF loaders; `CameraData`, `GlobalUniformGroup`, `LightDataList`, `LightTiles`; the lighting, material and shadow
  systems for WebGL and WebGPU; `RenderGraph`; the background, copy-opaque and colour-output passes; `BaseMaterial3D`,
  `FullscreenPass`, `View3D`, `Sprite3D`, `OrbitCamera`, `ParticleContainer3D`, events); one new module, `core/lightLimits`; peer
  `pixi.js` still `^8.23.0`. An upgrade is its own audited branch, like beta.3's.
- **The MIT notice.** The licence asks that its notice go with copies of the software. A built game (base-3d's `dist/`) carries no
  licence text for `@pixi/3d` (nor for `pixi.js`). Shipping a third-party notices file with every build is a framework decision.
- **`audience`/`publish --private`** now exist only as an author's choice; if no one wants that, removing them is an API change to
  `@automata/tools`.
- **Pre-existing:** `pnpm secrets` fails on two `main` commits (§3); `examples/3d-story`'s journeys do not start.

## 5. Brought up to main

A fixes session, 2026-11-12, one session, no subagents, Node 24.22, four CPUs, Chromium only. The branch was at `dc719877`;
`origin/main` at `d401ec4d`; merge base `4a505e86`. **Merge commit `b828e7dd`** (`git merge origin/main`, no rebase, no
force-push; its body says what each side changed in each conflicted file). Its pre-commit hook ran Biome and the affected unit
tests (618 s) and passed.

### The conflicts

Three files, no more. Each was resolved after reading both sides' commits since the merge base.

| File | Main's side | This branch's side | The join |
| --- | --- | --- | --- |
| `extensions/figures/src/features/view/cell-sprite.ts` | `14e7c3ee`: only the first-line `biome-ignore-all` text, which no longer names the builders-fold plan | `c53b096a`, `ef75483b`: the painter's view ported to beta.3. The texel snap and its `texSize` binding are gone; `CellMaterial` takes `BaseMaterial3DOptions`, switches the engine's fog off and adds `cellFogBit`; `CellSprite` builds one `Sprite3D` from a material | the branch's imports, class and constructor, under main's reworded first line. No other line differs from the branch |
| `extensions/figures/tests/unit/view/template.test.ts` | `6461a541`, `14e7c3ee`: the header says "The painter's" and "four edits"; the same first-line text | `c53b096a`: "The painter's" and "three edits" (the texel-snap edit is gone); the bind-group and undo-the-edits assertions rewritten for beta.3 | the branch's "three edits" and assertions, under main's first line; git merged the rest |
| `docs/superpowers/progress.md` | row 6 with group 1's merge, audit and fixes, and a new section "The coordinator's state, 2026-11-12 evening" with its own short beta.3 bullet | row 7 (this work); the fifth session's longer beta.3 bullet | main's row 6 and everything after it as it is; row 7 straight after row 6; both beta.3 bullets kept, main's first. No line re-wrapped. Of the branch's side only the row 6 it had is replaced by main's newer row 6; of main's side only the two sentences saying the refusal stands are gone, because this branch lifts it |

Main's builders-fold conform work on the painter (the layout moves, the lint rules, the strict headers, the view check as two
Vitest browser projects) reached the merged tree through git's own merge of the rest of `extensions/figures/`. The beta.3 port
needed nothing else from main; the browser projects below are the proof.

### The things this branch changed, on the merged tree

- **No `file:` or tarball spec for `@pixi/3d`.** `git grep` finds none in any `package.json`, the lockfile or a workflow. Eight
  manifests pin `"@pixi/3d": "0.1.0-beta.3"` (character-kit, figures, lcd-panel, retro-crisp, world-kit, base-3d, `packages/3d`,
  editor-3d). Main added no importer that names `@pixi/3d`.
- **`vendor/pixi-3d/` is gone** and nothing outside history (`docs/archive/`, the 2026-10 and 2026-11 audits, plans and specs)
  names it; the one code hit is the 3D stranger's assertion that the lockfile does _not_ contain it.
- **The lockfile.** `pnpm install --frozen-lockfile` and plain `pnpm install` leave it unchanged. Against `origin/main` the diff is
  only what the branch and its beta.3 base intend: 8 importers `file:…beta.2.tgz` to `0.1.0-beta.3` (integrity `sha512-2k34FOL9…qV7g==`,
  the registry's), `pixi.js` 8.22.0 to 8.23.0 in 18 importers (and `colord`, which `pixi.js` 8.23 pulls in); against this branch
  before the merge, only main's `typescript` entry for one importer.
- **The inverted tests pass** inside the uncached check: ship's `build-scans.test.ts` (9) and `prepare-build.test.ts` (25), the
  site's `scan-pixi3d-extras.test.ts` (3), `workflow-invariants.test.ts` (11, including the path filter that names a missing
  folder), `template.test.ts` of the painter (3) and the tools' `template.test.ts` (21).

### The proof

| Gate | Result |
| --- | --- |
| `pnpm format` | clean |
| `TURBO_FORCE=true pnpm check` | **exit 0**, 56 of 56 static tasks (2 m 28 s) and 66 of 66 unit tasks, 0 cached (14 m 04 s); `changeset status` and `check:changesets`: 81 changesets, 0 problems |
| `pnpm build` | 16 of 16, 0 cached, exit 0 |
| `pnpm api-report` | 6 core packages, 0 API breaks, 0 undeclared; nothing to update |
| `pnpm api-index` | 1,300 exports from 49 entry points, 0 undocumented; the generated files match (no diff), nothing to write |
| `pnpm secrets` (after `git fetch --unshallow`) | **clean: 3,805 commits scanned, no leaks.** The 16 findings of the earlier session are gone (main carries the scan's allowlist); no entry was added here |
| `@automata/figures` unit (goldens, then `AF_UNIT_FULL=1`) | 54 files, 730 tests, both runs |
| `@automata/figures` `browser` + `webgpu` (`AF_WEBGPU=software`, Chromium) | **231 passed**: 122 + 105 = **227 view results** (`view-check.test.ts` 122 on WebGL, `view-webgpu.test.ts` 105) and the 4 fog cases (`view-fog` and `view-fog-webgpu`, 2 each): the beta.3 audit's 231 (227 and the 4 fog cases), same names |
| `@automata/character-kit` | unit 233; `browser` + `webgpu` 58 passed, 3 skipped (the baseline's 58 and 3) |
| `@automata/3d` `browser` + `webgpu` | 21 files, 83 passed, 2 skipped (the pixi-3d-public audit's 83 and 2) |
| world-kit, lcd-panel, retro-crisp, editor-3d layout, base-3d (layout + sim) | 36, 10, 11, 285 passed with 3 skipped, 36 passed |
| `games/base-3d` built, then `automata ship prepare` | build exit 0; `web`: "checked 25 files in dist"; `itch`: wrote `base-3d-0.1.0-itch.zip` (removed after); `ruken`: wrote `dist/ruken.toml`. The build carries `@pixi/3d` |
| Journeys, Chromium | base-3d (`base-3d`, `base-3d-dev`) 14 passed; examples-3d 22 passed; **3d-story (`story-3d-phone`, `story-3d-ipad`) 14 passed**: its web server starts now (main's `ci-green` fixed it; it did not before); editor-3d (3 files) 16 passed |
| Consumer smoke, 2D stranger, `--from packs` | passed: 16 steps (install, readme commands, node entries and a sim hash `cc4c2faade195f90`, content hash `b7c28787fa08e930`, ship help, packed editor, size 2,517 kB, boundaries, TypeScript 7 and 6, no eval, two bundles, a Ruken game boots in Chromium under the CSP) |

Unit counts on the merged tree: `@automata/3d` 1,543 (145 files), `@automata/framework` 2,143 (218), `@automata/tools` 932 and 1 skipped
(96), `@automata/editor-3d` 2,279 (160), `@automata/character-kit` 233, `@automata/world-kit` 271, `@automata/lcd-panel` 20, `@automata/retro-crisp` 39,
`@af-games/base-3d` 111, `@af-games/emberwick` 136, `@af-examples/wardrobe-3d` 95, `@automata/site` 516, `@automata/repo-hygiene` 160, `@automata/figures` 730.

**Nothing moved.** `git status` was clean after every suite; no golden, recorded cell, md5 or hash was touched or re-recorded.
The only file this section changed is this README; the tracker rows are under [For the tracker](#for-the-tracker).

Not run: WebKit and Firefox (parity, the `-webkit` and iPad projects; neither browser is installed here), a real GPU (WebGPU ran
on SwiftShader), `release-checks.yml` as a whole, the 3D stranger's journey (it still stops at the packed `@automata/3d`'s
TypeScript, as in §3), Emberwick's and the 2D journeys (they draw nothing with `@pixi/3d`). Ready to be named for merge on this
evidence; the cross-engine and real-GPU runs remain the Owner's.

## For the tracker

Everything this branch adds or changes in `docs/superpowers/progress.md` relative to `origin/main` (`7b6ce6ac` when this was
written), verbatim, for the coordinator to paste. It changes nothing in `docs/refactor/progress.md`. The branch itself carries
neither file's edits (the commit "docs: the tracker rows move to the audit README"), so it no longer collides with the other
branches' tracker edits.

**1. A new row 7 in the stage table, straight after row 6 (the builders fold):**

~~~markdown
| 7 | `@pixi/3d` from npmjs.org and the deploy rule lifted (the Owner, 2026-11-12: "yes, move to the public pixi3d package and lift the deploy rule") | Done 2026-11-12 on `claude/pixi-3d-public` (from `claude/pixi-3d-beta-3` `b25ec539`), one session, no subagents: public without a token, beta.3's code byte-identical to the vendored tarball, MIT; the tarballs gone, 8 manifests on the registry, `ship` and the site no longer refuse a build with Pixi 3D (its extras still refused), base-3d public; uncached `pnpm check` exit 0, base-3d web/itch/Ruken prepared, 3D journeys in Chromium pass, no golden moved. Not run: WebKit, Firefox, a real GPU. **Brought up to main 2026-11-12** (`origin/main` `d401ec4d` merged as `b828e7dd`; three conflicts joined, the beta.3 port and main's conform work both kept; the whole uncached `pnpm check` exit 0, build, API checks, the painter's 231 browser cases (227 view results and 4 fog), the 3D suites, base-3d web/itch/Ruken prepared, the 3D journeys, the 2D consumer smoke from packs and `pnpm secrets` all pass in Chromium, no golden or hash moved). Open for the Owner: which 3D packages to publish, `@pixi/3d` 0.1.0, cross-engine parity and a real GPU | 100% (5 of 5 steps) | [audit](audits/2026-11-12-pixi-3d-public/README.md) |
~~~

**2. In the section that lists the framework's open items (the one that opens "Rows 8 to 11 are the reference game's own"),
this bullet is replaced.** Main's text is:

~~~markdown
- The framework refuses to publish a 3D game to a public host while Pixi 3D is in beta. Private builds are allowed, so
  the port is not blocked; an itch release is, and that is the Owner's.
~~~

and it becomes:

~~~markdown
- Lifted 2026-11-12: Pixi 3D is public on npm, and a 3D game now publishes to every host a 2D one does
  ([the move](audits/2026-11-12-pixi-3d-public/README.md)). An itch release is the Owner's.
~~~

**3. A bullet in the list that holds main's short "**beta.3:**" bullet** (the one that starts "fog and lit figures are conversions"),
straight after that bullet and before the section "The coordinator's state, 2026-11-12 evening":

~~~markdown
  - **beta.3 (`claude/pixi-3d-beta-3`, fifth session, 2026-11-12):** the builders fold is merged in (`main` `4a505e86`) and the painter's view is
    ported: `extensions/figures` takes beta.3 and `pixi.js` 8.23.0, its WGSL cell template is beta.3's own with three edits (the texel snap is gone:
    beta.3 samples each texture with its own style), and the cell material fogs in display space as beta.2 fogged an unlit colour. The painter's
    browser suite is 231 of 231 on WebGL and WebGPU (software), byte for byte with the CPU's `compose`, the character kit's three painted WebGPU
    cases pass, no golden moved. Night room with fog, beta.2 against beta.3: painted figures 32.94 to 33.05 luma, 1.23% of pixels differ (the figures
    were 67,300 of 80,084 differing pixels before). The 3D suites, journeys, lcd-panel, retro-crisp and Emberwick's language journeys pass in
    Chromium. What is left before it can merge: the Owner answers the grouped list (recommended answers in the audit) and runs cross-engine parity
    and a real GPU (commands in the audit). One choice for the Owner, not a condition: beta.2 drew three things darker than their content colours
    (unlit and sky fog, lit figures, embers) and the conversion keeps that.
~~~
