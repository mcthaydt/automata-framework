# Site read-through, 2026-11-13

The Owner reads the built site from `main` and reports what is wrong, one finding at a time. Each finding is one commit on
`claude/site-readthrough`. Pictures are Chromium against the built site, reduced motion (a still frame), at phone 390×844
and desktop 1280×800, 2× scale; the "before" pictures are `origin/main` at `a234a3a20`.

## Finding 1: "the code does not match the demo"

**Where:** Home, "Built for agents" ("Made for Claude Code, Cursor and Codex.").

**The Owner's words:** "the code does not match the demo".

**Cause.** Two separate defects.

1. The code was a sixteen-line excerpt of `examples/2d/shapes/shapes-rects.ts` written by hand into `home-content.ts`: one
   component (`Block`), a `move` that only moves blocks, and a `defineGame` with one view and no `setup`. The picture under it
   draws the whole example: four blocks, a sliding bar and a spinner. So the code named one of three things and, as written,
   would have drawn nothing (no `setup`, so no entity). The old test only asked that each excerpt line be somewhere in the file.
2. The picture is a hand-written canvas drawing (`ShapesPreview.svelte`) that re-implements the example's rules, so nothing
   but a comment kept the two together. Its only test compared hex colours.

**Fix.**

- The code beside the picture is now the file itself, whole: `shapes-rects.ts` minus its header comment, read at build time by
  `src/shared/framework/home-example.ts` and served as `virtual:framework/home-example`. Nothing of it is written in the
  site. It starts at the `import` line, so it runs as written.
- It is a declared scroll region (`role=region`, `tabindex=0`, named "The example's code, whole") with a set height (22 rem on
  desktop, 16 rem on a phone). No line is cut.
- The build now checks it: `check:site` fails when Home's built code is not the file's code byte for byte
  (`checkHomeExample`).
- Preview: **kept as a drawing, now held to the real sim.** The drawing's numbers moved to `shapes-model.ts`; a test runs the
  example's own sim headless for 2,500 ticks and compares every block, the bar and the spinner with `stateAt(tick)` at every
  tick (positions exactly; the angle within 0.01 rad, because the sim keeps it in 32 bits and adds 0.05 each tick), and holds
  the sizes, colours, anchor, world size and spawn points to the example's text. The test fails if either side moves.
- Why not run the framework on Home: Home's preloaded script budget is 48,000 bytes and had 54 bytes of room, and the
  runtime that plays an example (`build/playground/runtime/assets`, measured) is 1.48 MB of script, 426 kB gzipped; running
  it would have meant loading that on the first screen of the site for a picture below the fold. Home already has the real game (the Emberwick demo, on Play) and the
  Examples pages run the real example.
- Budget: showing the whole file added 1.3 kB to Home's page chunk (47,946 → 49,260 bytes preloaded, over the 48,000
  budget). The drawing is below the first screen, so its code is now its own chunk, fetched after the page is live. Preloaded
  script is now 47,991 bytes (9 bytes of room: the next addition to Home's chunk has to make room the same way).

**Tests (written first, watched fail for the right reason):**
`tests/unit/home/home.test.ts` ("shows the example's whole code…"), `tests/unit/home/shapes-parity.test.ts` (new; mutation
checked: changing the bar's speed or the spinner's step fails it), `tests/unit/scripts/site-checks.test.ts`
(`checkHomeExample`), `tests/e2e/site.e2e.ts` ("the shapes example on Home…", phone and desktop: the region is focusable and
tall, End reaches the last line, the canvas shows the example's blue, green and red, no sideways scroll).
`tests/unit/home/shapes.test.ts` (colours only) is deleted: the parity test holds the same colours and everything else.

**Pictures:** before `f1-before-phone.png`, `f1-before-desktop.png`; after `f1-after-phone.png`, `f1-after-desktop.png`.
(The desktop element pictures show the sticky header over the top of the panel; it is the capture, not the page.)

**Open for the Owner:** on a phone only the first eleven or so lines show at once and long lines scroll sideways. There is no
printed hint that the code scrolls; the cut-off line at the bottom is the cue. Say if you want a visible hint.

### Same class of defect, everywhere on Home and the Docs landing

Checked each place that shows code beside a picture, a number beside a claim, or a command beside its output. (Filled in as
each is judged; a mismatch becomes its own finding below.)

## Finding 3: `check:launch` crashes before it checks anything

**Where:** `pnpm --filter @automata/site check:launch` (the deploy job runs it under plain Node).

**Cause.** `site/src/features/home/home-content.ts` imported `'../../shared/content/agent-prompt'` without `.ts`. Vite and
Vitest add the extension, plain Node does not, so the script died with `ERR_MODULE_NOT_FOUND`; the gate's unit tests import
its functions under Vite and never ran the script.

**Fix.** The import now says `.ts`. Every other script under `site/scripts` was checked for the same fault by walking the
import graph each one reaches (relative imports and `#src/`): this was the only one.

**Tests (watched fail first):** `tests/unit/scripts/node-imports.test.ts`: the import graph of every `scripts/*.ts` resolves
under plain Node, and `node scripts/check-launch.ts` run as a child process exits non-zero with its own refusals (the
repository is private) and no `ERR_MODULE_NOT_FOUND`. No workflow file changed.

## Finding 2: the site for a 2D-only launch

The Owner: "our goal is to make 2D perfect and ship with just that; we'll address 3D after." Read from the built site
(`site/build`, main plus these fixes, 53 pages) as text, links and sentences, plus a real Chromium load of `/editor/app/`, the
four `llms*.txt` files and the agent prompt (`shared/content/agent-prompt.ts`). **No copy has been rewritten.** The proposed
words are for the Owner to accept, change or refuse. "True today" is checked against the repository and, where it says so,
against npmjs.org (HEAD requests from this machine on 2026-11-13).

The pages that promise nothing 3D: Start, Examples (all 21 are 2D), every example page, Privacy, Terms, the agent prompt (it
already says "a 2D browser game"), the try-it editor at `/editor/app/` (Tuner and Levels only, for a sample game), Docs "How it
works", "Languages", "Extensions", "Publish to itch.io" and "Publish to Ruken" (no 3D words).

### A. Promises 3D, a 3D editor or Pixi 3D

| # | Page | The exact words | What is true today | Proposed replacement |
|---|------|-----------------|--------------------|----------------------|
| A1 | Home, Pricing (`home-content.ts` `PRICING_SECTION.free.items`) | "Every editor, for 2D and 3D games" | The 3D editors (`@automata/editor-3d`) are private and nothing public opens them. In the browser the free editor is the sample-game editor: Tuner and Levels. | "The level editor and the tuner" |
| A2 | /app (Pricing), "Free in your browser" (`features/app/app-offer.ts` `web[0]`) | "All the editors, for 2D and 3D games: Levels, Characters, Add tiles, the Tuner, Feel, Audio, Schematic and more" | The try-it editor shows Tuner and Levels (see A1). Add tiles is inside Levels. Characters, Feel, Audio and Schematic are not in the browser editor. | "The level editor and the tuner, for 2D games" |
| A3 | Docs, "Draw levels in the editor" (`docs/guides/editor.md`; also `llms-guides.txt` line 227, `llms-full.txt`) | "Levels and the Tuner for a 2D game, and the 3D editors too for a game whose list names them." | A published game can only name the 2D editors; the 3D ones are private. | Cut the clause after "2D game": "Your game's `content/editors.toml` decides which editors open: Levels and the Tuner." |
| A4 | Docs, "Publish to the web" (`docs/guides/publish-to-web.md`; the `automata ship` help text, `packages/tools` `cli-args.ts`; `llms-guides.txt` line 354) | "… code that needs `eval`, the private Pixi 3D beta and paths that start with /." | There is no public Pixi 3D for a maker to carry; the refusal exists for a private game. | "… code that needs `eval`, and paths that start with /." |
| A5 | /api/0.0.5/physics (and `llms-api.txt`, `llms-full.txt`, site search) | A whole section `@automata/physics/3d`: 13 exports (`physics3d`, `body3d`, `collider3d`, `Collider3D`, `Transform3D`, `RigidBody3D`, `CollisionStarted3D`, …); 39 mentions of 3D on the page | `@automata/physics` is published and its `/3d` subpath ships, but nothing public draws a 3D body. Generated from the published type declarations. | Not site copy: either the published package stops exporting `/3d` until 3D ships, or the reference hides that subpath. Owner decides which. |
| A6 | /api/0.0.5/framework (and `llms-api.txt`) | Doc comments: "a game without `content/` lists its 3D models here"; "Needs the default screens … and a 2D game: a 3D game draws its rooms itself"; "an extension's renderer, such as a 3D extension's `(options) => createPixi3dRenderer({ ...options, views })`"; "`ModelInvalid` class: A 3D model file could not be read…" | The hooks exist and are 2D-safe, but the words point at a renderer a stranger cannot install. 7 mentions. | Reword the doc comments in `packages/automata` to speak of "an extension's renderer" and "model files" without "3D" (a framework change, then `pnpm build`, `api-report --update`, `api-index --write`). |
| A7 | /api/0.0.5/content, /feel, /tools | content: "At most one instance per scope the editor names (2D: per level; 3D: per map)". feel: "Whole pixels (2D) or screen pixels (3D)". tools: "`private` is a game that carries `@pixi/3d`, a closed beta (D-1), until Pixi 3D's public release…" | Same as A6. | Same as A6; the `tools` sentence should stop naming `@pixi/3d`. |
| A8 | /changelog (7 entries; Home shows only the latest four, none about 3D today) | "automata create-game takes --template 2d\|3d, 2d by default" (2026-11-07); "automata editor opens a 3D room (.af-sector.json) as well as a 2D level" (2026-11-07); "A game made with create-game --template 3d plays its room in the time of day the level file names…" (2026-11-08); "The 3D game template's camera comment now describes the new default gameplay camera…" (2026-11-11); "Doc comments that named the three 3D packages…" (2026-11-07); "a game called base-3d opens…" (2026-11-07) | History. `create-game --template 3d` exists but refuses with "3D games need a package that is not public yet. For now, make a 2D game" (`three-d-gate.ts`), so it fails honestly. | Leave the history, or filter changelog entries that name 3D out of the page until 3D ships. Owner decides. |
| A9 | Footer / search | Searching the site for "3d" returns the physics and framework reference entries of A5 to A7. | Follows from A5 to A7. | Follows from A5 to A7. |

### B. Promises a desktop app, the paid app, sync or sign-in, or MCP

| # | Page | The exact words | What is true today | Proposed replacement |
|---|------|-----------------|--------------------|----------------------|
| B1 | Home, Pricing, free card (`PRICING_SECTION.free.items`); /app `web[1]`; /app meta description | "Sign in with GitHub to keep your games in sync" / "Your games on every device: sign in with GitHub and they stay in sync" / "…and so is syncing your games with GitHub." | Nothing implements it: no sign-in or sync code exists in the repository; /privacy says "There are no accounts and no forms." (so the site contradicts itself). | Cut the line. If a promise is wanted: "Your game is files in your own folder; keep them in your own git." |
| B2 | Home, Pricing, app card (`PRICING_SECTION.app`); the "Pay once for the app" title and sub; /app headline, both price cards ($19.99 phone and tablet, $39.99 computer) | "The app, paid once · $19.99 phone and tablet · $39.99 computer · Installs in one step, with nothing else to set up · The editors on your phone, tablet or computer" | No app exists or is on sale; /app itself says "Coming soon" three times. A stranger cannot buy it. | Remove the paid-app card from Home; make /app say what is true: "Free to make. Every editor is free. MIT licensed. No credits, ever." and drop the prices, or keep /app as a one-line "An app is planned" page. |
| B3 | /app | "iPhone, iPad and Android · App Store: Coming soon · Google Play: Coming soon · Mac, Windows and Linux · Buy for your computer: Coming soon" | Same as B2. | Same as B2. |
| B4 | /app | "Your coding agent can use the editors too, through MCP (coming later)" | There is no MCP server. A promise of a feature. | Cut the line. |
| B5 | /app | "What you pay for is the ready-made app, which installs in one step and keeps itself up to date." | Same as B2. | Cut with B2. |
| B6 | Home, hero announcement (`ANNOUNCEMENT`) | "Free · Every editor is free in your browser" | Only the sample-game editor runs in the browser (A1). | "Free · The level editor runs in your browser" |
| B7 | Home, Publish row (`TARGETS[2]`) and the facts row ("4 targets … the web, itch.io, desktop and Ruken") | "A desktop app: A download for Windows, macOS and Linux, built with Tauri and put on itch.io for you. `automata ship publish --target itch --from tauri`" | The `tauri` target is implemented and its guide says the bundles are unsigned and need Rust installed; no real-device test of it has been run (real-device tests are the Owner's). It works from published packages only once those are on npm (see C1). | Keep with the caveat ("A desktop build for Windows, macOS and Linux. Unsigned; needs Rust to build."), or take it off Home for the launch. The number in the facts row follows `TARGETS.length`. |
| B8 | Docs: "Publish to desktop" guide, its entry in every docs sidebar, the search, "How it works" ("…the open web, itch.io, Ruken and a desktop app made with Tauri"), Start ("Other places to put it: itch.io, A desktop app, Ruken."), `llms.txt` and `llms-guides.txt` ("…or as a desktop app (Tauri) for Windows, macOS and Linux") | as quoted | Same as B7. | Decide with B7. If the desktop target stays out of the launch, these all go in one change (the guide is `docs/guides/publish-to-desktop.md`). |

### C. Does not work for a stranger today for another reason (not 3D)

| # | Page | The exact words | What is true today | Proposed replacement |
|---|------|-----------------|--------------------|----------------------|
| C1 | Home hero, Home closing band, Start step 1, the prompt the "Copy the prompt for your agent" button copies | `npx @automata/tools create-game my-game` | `registry.npmjs.org` answers 404 for `@automata/tools` and `@automata/framework` (checked 2026-11-13), so the first command a visitor copies fetches nothing. `check:launch` refuses for the same reason. | No copy change: this is the publish. Until then the site cannot launch. |
| C2 | Home, "Landing in the first release" (the four newest changelog entries) | "automata-check-boundaries --browser refuses @anthropic-ai/sdk (a Node-only library) in a browser package's entries, as…" / "automata-check-boundaries --confine <package>:<folder> <root>..." / "A credits name is held to every language's font." / "The workspace's source entries of @automata/content (and the @automata/sim modules they reach) load under plain Node:…" | These are repository-tooling notes, cut mid-sentence with "…", on the page a maker lands on. A drunk grandma cannot tell what they are. | Show only entries written for makers, or give each changeset a one-line maker-facing summary. Owner decides. |
| C3 | Home, Built in, "Languages" | "Menus in six languages from the first run." | True (`DEFAULT_LOCALES` has six) but typed as a literal; a test checks the word, not the count. | No copy change; the number should be read from `DEFAULT_LOCALES` (a plain defect I can fix as its own finding). |
| C4 | Home, Checks table | "Same result" for Node, Chromium, WebKit and Firefox, "checked on every change" | The engines are read from the workspace and the parity job runs on pull requests; "Same result" is a fixed phrase, not a measured outcome per engine. | No copy change needed; say if the Owner wants it to be measured. |

Nothing in this table was fixed. Items marked "plain defect" (C3) wait for the Owner's go as their own finding.

## Room in Home's script budget (a change the next findings need)

Home's preloaded script had 9 bytes of room after Finding 1 (47,991 of 48,000). The next fixes add words, so room was made
first, without touching the budget: `DemoRunner.svelte` only asks whether the address it was given is a demo's build, but it
imported the whole demos catalogue, so each demo's header paragraph (about 700 bytes of prose) rode in the page script. It
now imports `virtual:framework/demo-urls`, the addresses only. Preloaded script: 47,991 → 46,255 bytes (1,745 bytes of
room). Test: `tests/unit/home/demos.test.ts` (the runner imports only the addresses). Demo journeys (`visitor.e2e.ts`, 6) pass.

Gate record: `TURBO_FORCE=true pnpm check` passed on `31e23b4f0` (66 tasks, exit 0, 13 m 40 s).

## Finding 4 (the coordinator's C3): "six languages" was typed

**Where:** Home, Built in, "Languages".

**Cause.** The card said "Menus in six languages" as a literal. A test checked that the word "six" was there, not that six is
how many languages a new game ships.

**Fix.** `siteFacts()` gains `languages`, the length of `DEFAULT_LOCALES` (`@automata/content/locale`, now a site dev
dependency); the card's words carry `{languages}` and Home fills in the number as a word. A second test file mocks the facts
to say three and requires Home to say "three languages"; the facts test pins `languages` to `DEFAULT_LOCALES.length`; and the
"Home does not type a number" guard now also forbids "<number word> languages" in Home's source.

**Tests:** `tests/unit/home/home-languages.test.ts` (new, failed first), `tests/unit/framework/facts.test.ts`,
`tests/unit/home/home.test.ts`. Words on the page are unchanged ("Menus in six languages from the first run…").

## Finding 5 (the coordinator's C4): the Checks table's "Same result" was not measured

**Where:** Home, "Checks" ("Your agent can't quietly break your game.").

**Cause.** Every engine row said "Same result" with a green tick, and the panel said "checked on every change". Only the
engine list was read from the workspace; the outcome was a fixed phrase, true only while the last CI run was green, and on
this page it is no run's.

**What artifact exists.** `evidence.json` (`tooling/evidence`) is the file made for this: each golden's hash as Node, Chromium,
WebKit and Firefox computed it. It is a GitHub Actions artifact made on pushes to `main` (90 days), not a committed file, and
the step that makes it has failed on `main` since the scope rename (fixed in #670, not yet run on `main`). The site's build
cannot read it without a workflow change, which this session may not make, so I did not use it and invented nothing.

**What I chose.** The table now says plainly what it is: the rule, not a result. The committed golden
`examples/2d/__goldens__/shapes-rects.replay` is read at build time (`goldenFact` in `shared/framework/facts.ts`: inflate,
`decodeReplay`) for its name, its 120 ticks and its final hash `4b19e5aabfac26f3`. The table's columns are Engine, "Has to end
at" (that hash, on every row) and "Checked by" (unit tests, parity job: the existing facts); the tick count replaces
"checked on every change"; the ticks and "Same result" are gone. When the evidence artifact can be read at build time, the
hash column can become each engine's own measured hash.

**Tests (watched fail first):** `tests/unit/framework/facts.test.ts` (golden = the replay's ticks and final hash, decoded
independently), `tests/unit/home/home.test.ts` (rows are the engines, each cell is the golden's hash, no "same result"),
`tests/unit/home/shapes-parity.test.ts` (the real sim, stepped the golden's ticks, ends at exactly that hash: so the number on
Home is the sim's own).

**Pictures:** before `f5-before-{phone,desktop}.png`, after `f5-after-{phone,desktop}.png`. (Pre-existing, unchanged: the
cells sit at the top of their 48 px rows, so Node's row looks taller.)

Home's preloaded script: 46,597 bytes of 48,000.
