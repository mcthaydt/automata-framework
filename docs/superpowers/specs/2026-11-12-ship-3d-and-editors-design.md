# 3D and every editor reach a stranger

Workstream 8, the 3D lane of the launch. The Owner, 2026-11-12: "We get the automata framework to ship ready before going
to the next game", then, to the audit's advice to launch 2D first: "We ship with 3D, Editors, and Desktop Apps too". His
answers the same day to the audit's open decisions: "both" (desktop: games as desktop apps, and the paid app), "publish
the painter", "port to 0.1.0", and "yes, move to the public pixi3d package and lift the deploy rule".

The evidence for everything below is the ship audit,
[`audits/2026-11-12-ship-readiness.md`](../audits/2026-11-12-ship-readiness.md) (on `claude/ship-readiness-audit` until
it merges), Part 2. This spec covers its ship-list items 8, 9, 10 and 11. Items 1 to 7 and 12 to 18 are other lanes; the
last section says how this one meets them.

## Why

A stranger can make, check, build and play a 2D game from packed packages in 52 seconds. A stranger cannot make a 3D game
at all:

- `@automata/3d` is private and ships raw TypeScript (`exports` point at `src/*.ts`, no `build` script). A 3D game's
  `vite.config.ts` cannot load it from `node_modules`
  (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`), so the 3D stranger's journey fails at "check it: test" and every step
  after. The journey is skipped unless `AF_BETA_3D=1`, which is why nobody saw it.
- Sixteen packages a 3D game, the 3D editor or the content editors import are private, unbuilt and source-only.
- From published tools, `automata editor` in a 3D game prints "Error: The 3D editors are not in this release yet."
  (`packages/tools/src/features/editor/editor-command.ts:94`). The content editors (Feel, Audio, Writer, Sequence,
  Schematic) have no way to reach a stranger at all.
- AF is ported to `@pixi/3d` 0.1.0-beta.3; `latest` on npm is 0.1.0, and 60 runtime files differ.

## What done means

A stranger, with nothing but npm and the public docs:

1. runs `create-game --template 3d`, installs with no token and no vendored file, and the game checks, tests, builds for
   `web` and `itch`, and plays;
2. runs `automata editor` in that game and gets Levels 3D and Characters; in any game, gets Feel, Audio, Writer, Sequence
   and Schematic;
3. can add any kit the templates, the examples or the editors use, by name, from npm.

And the repository proves it on every pull request: the 3D stranger's journey runs with no gate, beside the 2D one.

## The parts

### Part A: `@automata/3d` is a built, published package (ship list 8)

- A `tsdown` config and `build` script like `@automata/framework`'s. `exports` with `types` and `import` pointing at
  `dist` for every entry it has today (`.`, `/sim`, `/level`, `/figures`, `/figures-kit`, `/world-content`,
  `/camera-view` and the rest: the plan lists them from `package.json`). No entry is dropped or renamed.
- A README written for a stranger. `"private"` removed, a 0.x version, in the fixed group of `.changeset/config.json`.
- An API report and API-index entries; every export has a doc comment (`pnpm api-index` fails on an undocumented one).
- The six publishing guards change to the new truth, each test first: the `boundaries --forbid` list,
  `closed-beta-guard.test.ts`, `release-list.test.ts`'s "not publishable", `copy-editor.ts`, the `AF_BETA_3D` gate in
  `create-game`, and the playground's unpublished-extension filter. A guard is removed only where its reason is gone; a
  guard that still protects something keeps protecting it.
- `create-game --template 3d` is offered without a gate and listed in help. Its pins (`PIXI_3D_SPEC`, `pixi.js`) match
  what the framework itself uses.
- The 3D stranger's journey (`tooling/consumer-smoke/tests/e2e/stranger-3d.test.ts`) runs ungated, from packs, to its
  last step ("walk Wick").

### Part B: the kits and tools a 3D game or an editor needs (ship list 9)

Each becomes a built, documented, API-reported package in the fixed group: `world-kit`, `character-kit`, `figures`,
`lcd-panel`, `retro-crisp`, `sectors`, `places`, `nav`, `interact`, `cutscenes`, `narrative`, `systems`, `hud`,
`level-2d`, `pipelines`. The plan confirms the list from the import graph of the templates, the examples, the 3D editor
and the content editors: a package nothing public imports stays private, and the plan says which.

- **The painter publishes** (the Owner: "publish the painter"). `@automata/figures` loses `private`, and the guard text
  "the figure builder is a private repository: nothing published may bundle either" goes. The character kit keeps its
  one door onto it (`automata-check-boundaries --confine`); publishing does not widen who may import the painter.
  Before it publishes, the plan checks what the painter's history and files carry: no brand, character or content
  material that the fold's spec excluded, licences of every bundled asset recorded, and a `LICENSE` consistent with the
  framework's.
- Order follows the dependency graph (for example `systems` needs `nav`, `places`, `puzzle`, `sectors`; `pipelines`
  needs the editor). The plan splits the set between sessions by folder so two never own the same package.
- No behaviour changes. A kit's recorded pictures, hashes and goldens do not move from being built: if one does, the
  build is wrong.

### Part C: the editors reach a stranger (ship list 10)

- `automata editor` opens Levels 3D and Characters in a 3D game, and Feel, Audio, Writer, Sequence and Schematic where
  they apply, from published packages. The refusal at `editor-command.ts:94` goes.
- **Packaging: the editors ship as their own package** (the coordinator's ruling on the audit's D4, open to the Owner's
  correction). `@automata/tools` packs to 2,513 kB against a 3 MB budget, and the 3D suite adds about 2.5 MB. The
  budget exists so that every maker's install stays small, so it is kept, and the editor suites move to a package that
  `automata editor` resolves and that a game depends on only if it uses the editors (`create-game` adds it). The plan
  decides the name and whether the 2D suite moves with them or stays in `-tools` for the smallest 2D install; it
  measures both.
- `@automata/editors` gets a README. The site's hosted editor (`/editor/app`) offers what the page says it offers.
- Two journeys from packs: a 3D one (open the 3D editor on a fresh 3D game, change the level, play the change) and a
  content one (change a word in Writer or a feel value, play the change).
- A maker who runs `automata editor` on a fresh game before `pnpm dev` reaches Play (the fix is on
  `claude/editor-journeys-green`; this part builds on it and does not redo it).

### Part D: `@pixi/3d` 0.1.0 (ship list 11)

- A pixel-reviewed port like beta.3's, after `claude/pixi-3d-public` has merged. `pixi.js` moves to the version 0.1.0
  peers (`^8.23.0`) in core and in every template.
- The changed runtime areas are lighting, shadows, batching, the render graph, the background, copy-opaque and output
  passes and the glTF loaders: the areas AF's goldens and its fog conversion pin. Every recorded picture or hash that
  moves is listed with before and after, and moves only with the Owner seeing them.
- Cross-engine parity for 3D runs in Chromium, WebKit and Firefox on the Owner's runners before it merges.

## Rules

1. **Building is not changing.** Parts A to C move no golden, recorded picture, md5 or hash. Part D may, and only as its
   last section says.
2. **One owner per package per session.** The plan names the folders each task owns. Shared files
   (`.changeset/config.json`, the release list, the boundaries config, `pnpm-lock.yaml`) are changed by one task at a
   time, in the order the plan gives.
3. **The laws hold in what publishes.** The sim imports no Effect and does no I/O; only a target's adapter imports a
   platform's packages; PixiJS only for rendering; Zod the only schema language. A published kit never imports a
   private package.
4. **Every published export is documented**, and its package has a README a stranger can follow.
5. **Proof is from packs, outside the workspace.** A thing is reachable when the stranger's journey reaches it, not when
   the workspace can import it.
6. **Sizes are budgets.** The plan measures each new package's packed size and sets a budget test beside the existing
   ones; `-tools` stays under 3 MB.
7. **No publish, no deploy.** This lane makes packages publishable and proves them from packs. Publishing, the npm
   token, release approvals and the site deploy are the Owner's.

## How it meets the other lanes

- **The scope rename (ship list 1).** `@automata` is another account's scope on npm. The rename to the Owner's new
  organisation touches every file here. If the organisation exists when execution starts, the rename runs first and
  alone; if not, this lane proceeds under the current names and the rename runs later, alone, on a quiet tree. The plan
  writes no name in a way a codemod cannot follow (`tooling/codemods` `rename-scope` exists).
- **`claude/pixi-3d-public` (ship list 7)** merges first: Part A starts from a `main` that installs `@pixi/3d` from
  npm.
- **The editor journeys (ship list 6)**: `claude/editor-journeys-green` merges before Part C.
- **Desktop.** Games as desktop apps (`claude/desktop-games`) and the paid app (its own plan, being re-audited) use
  what this lane publishes; neither is in this spec.
- **The first release (ship list 17)** widens the fixed group to everything Parts A to C make public.

## Stages

Plan (Fable 5.2, medium, writing-plans), plan audit (Opus, medium), execution (Sonnet, high, executing-plans; several
sessions in the order A, then B and C by folder, then D), implementation audit (Opus, medium), fixes (Sonnet, high), the
Owner's review. Each in its own session and branch; no subagents; handoff through committed documents.

## Not in this spec

The npm organisation, the domain, the publish job, the site's copy, CI's health, opening the repository, the token, the
release and the deploy (ship list 1 to 6 and 13 to 18); games as desktop apps (12); the paid app.

## Amendment, 2026-11-12: the measured figures, the three private kits, and what the plan audit found

From the survey ([`audits/2026-11-12-ship-3d-survey.md`](../audits/2026-11-12-ship-3d-survey.md)) and the plan audit
([`audits/2026-11-12-ship-3d-plan-audit.md`](../audits/2026-11-12-ship-3d-plan-audit.md)). Where this spec and those
measurements differ, the measurements stand; the text above is left as written.

- **Part B publishes 12 kits, not 15.** `interact`, `hud` and `pipelines` stay private: no template, example, editor or
  site source imports them. A test fails if a published package imports any private one
  (`tooling/release/tests/unit/published-imports.test.ts`, plan task A5), and `release-list.test.ts` names the three.
  "Sixteen packages" in "Why" reads: 13 must publish (`@automata/3d` and the twelve), 3 stay private, and the editors'
  pages ship as one built page in `@automata/editors`.
- **Sizes:** `@automata/tools` packs to 2,577,117 bytes (not 2,513 kB). The 3D suite is 2,600 kB on disk, 902,933 bytes
  gzipped, and it is the full suite (2D and 3D). The twelve kits pack to 533,977 bytes together; `@automata/3d` to
  307,640 bytes before its testing fixtures ship.
- **`pixi.js`:** core already pins 8.23.0 after the beta.3 port; Part D checks the templates and `docs/versions.md`.
  Published packages take caret ranges of their outside peers (`^8.23.0`), as the release test requires.
- **"Like `@automata/framework`'s"** also means written export types in five packages (213: the painter 174,
  world-kit 17, character-kit 16, retro-crisp 4, lcd-panel 2) and `vitest` as an optional peer of `@automata/3d`. The
  two kits with Svelte files build as `@automata/debug` does (`svelte-package`), not with tsdown.
- **"API-reported" (Part B):** the kits join the API index, with every export documented. The API report covers
  `packages/*` only, by design, as for the extensions already published; `@automata/3d` is already in it.
- **"No entry is dropped"** holds for `@automata/3d` (all 13 publish; `./testing` is fixed to work from a pack). For
  the kits, the workspace keeps every entry, and eleven test or tool entries do not publish, as `@automata/puzzle`'s
  `./testing/*` entries do not: their files are read by path or are wildcard fixture folders (plan task A5 lists them).
- **Rule 1's proof** is a check against the branch's merge base on `main`, over 108 recorded files (goldens, replays,
  the games' generated content and its hashes), run at the end of every task of Parts A to C.
- **Part C:** the page with every editor is built once, by the editors v2 landing (the Owner: "yes v2 is the look");
  Part C packages it and starts after that plan's tasks 2 to 4 and 6. The site's hosted editor serves it after that
  plan's task 7.
- **The painter's declarations step** (`types/`, `tsconfig.types.json`) stays until the strict flags are on
  (`claude/builders-fold-strict`): without it, the character kit's typecheck fails with 1,440 errors.
- **DUEL:** the palette's author and terms gate the first release of `@automata/content` (which already ships its
  colours), `@automata/3d` and the painter alike; recorded once, in `docs/art/palettes/duel.md`.
- **The 3D stranger's journey** passes without a GPU (SwiftShader, 35 s) once the package lists its built side-effect
  files and the journey turns the phone to the template's landscape; it is a gate every session can run.
