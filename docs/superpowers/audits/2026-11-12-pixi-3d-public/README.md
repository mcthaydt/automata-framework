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

Progress: 4 of 4 steps (100%). What is left is the Owner's: [§4](#4-for-the-owner).

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

**Merge.** The coordinator asked (by message, after step 2) for `origin/main` to be merged into this branch, since
`claude/pixi-3d-beta-3` now conflicts with `main` in `docs/superpowers/progress.md`,
`extensions/figures/src/features/view/cell-sprite.ts` and `extensions/figures/tests/unit/view/template.test.ts`. Not done here:
a peer session's message is not the user's instruction. It is the next step if the user confirms it.

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
