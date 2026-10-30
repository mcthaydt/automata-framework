# WEB.PLAY: a live playground on the examples pages (design spec)

> **Date:** 2026-10-30
> **Status:** Approved by the Owner on 2026-10-30, who asked for it to be built. Two decisions changed in review: PLAY-D1 (an example runs as soon as its page opens) and PLAY-D16 (approved: Ruken's `sdk`, `sdk-host`, `manifest` and `cli` are MIT since RukenApp PR #396). The other decisions in §18 run on their recommended defaults.
> **Why (Owner, 2026-10-30):** "Did I mention I want the code editor thing that pixi has for the website? That click a button to see changes crap is useless."
> **Repos:** `mcthaydt/automata-website` (this spec, the page, the editor, the compile step) and `mcthaydt/automata-framework` (the playground runtime, frame pages and harness, owned by the integration lane under the [EX spec](https://github.com/mcthaydt/automata-framework/blob/main/docs/superpowers/specs/2026-10-16-examples-one-file-design.md) §8).
> **Measured against:** website `main` at `5cd8fd4`; framework `origin/main` at `b7ef19d9` (built in a throwaway worktree, since removed); the site's `framework.ref` is still `5ad4a842`.
> **Spec level:** the framework's `docs/01-decomposition.md` §5.

---

## 1. Goal

A reader opens an example and it is already running. They change its code in the page, and the running example updates on its own a moment after they stop typing. No Run button, no rebuild, no setup. If the change does not compile, the last working version keeps running and the error shows at its line. Reset puts the original back, and the page's URL carries the edit so it can be shared.

**Observable behaviour, in one journey.** On a phone, the reader opens `/examples/shapes-rects` and sees the blocks moving. They tap the line `color: 0x00cdf9`, change it to `0xff0000`, and lift their thumb. About a second later the preview shows red blocks. They type a stray `+` at the end of a line: the gutter marks that line, the status line says what is wrong, and the red blocks keep moving. They delete the `+` and the preview restarts with their code. They press Copy link and send it; the friend who opens it sees the same edited code running.

**Today** `/examples` shows seven prebuilt folder demos (`DemoRunner.svelte`: an iframe with Play, Restart and Fullscreen) beside read-only source (`SourceExplorer.svelte`). To see a change, a reader has to clone the framework, edit locally and rebuild.

## 2. Boundaries

### 2.1 In scope

- `/examples` becomes an index of the framework's one-file example catalog (17 core examples on framework `main`), and each example gets its own prerendered page, `/examples/<id>`, with the editor and a live preview (PLAY-D9).
- The editor (CodeMirror 6), the compile step (Babel's parser for errors and checks, sucrase to strip the types, a loop guard; in a worker), the sandboxed preview, the share link, Reset, the error display and the determinism row.
- The framework's playground runtime: one prebuilt ESM build of `@mcthaydt/automata`, `zod`, the in-memory fake host and a small harness, with one generated frame page per example.
- The site's sync, rebuilt around the framework's `readCatalog`, and the `/playground/` response headers in `scripts/serve-static.ts`, the Vite dev server and the production header set.

### 2.2 Out of scope

- Type checking and AF API completions in the editor (PLAY-D2). Syntax errors, disallowed imports and runtime errors are reported; type errors are not.
- More than one file, npm packages other than `@mcthaydt/automata` and `zod`, and relative imports (the catalog rejects them already).
- A blank `/playground` page. Every example is a starting point; `core-basic-window` (15 lines) is the blank one.
- Hot-patching a running game. Every change restarts the example from tick 0 with its seed (PLAY-D7).
- A console panel. Desktop readers have the browser's devtools; the sim cannot log anyway (`pnpm boundaries`).
- Plus examples (`automata-plus`, physics) until D-7 settles how Plus is shown (PLAY-D12).
- 3D examples: the catalog has none, and `render-pixi3d` stays unpublished (D-1). They join when the catalog has them.
- `/` and `/start`. Both keep `DemoRunner`: the home page shows Emberwick, a full game, and `/start` teaches the local edit loop (PLAY-D10).
- Saving drafts in browser storage or on a server (PLAY-D8).

### 2.3 Prerequisites found while measuring

| Fact | Where | What it means here |
| --- | --- | --- |
| The site is 736 commits behind: `framework.ref` is `5ad4a842`, framework `main` is `b7ef19d9`. | `framework.ref` | The playground needs a re-sync to a framework commit that has the playground build (WEB.PLAY.4). |
| `pnpm sync` fails against framework `main`: `renderer-2d`, `boot-and-flow` and `lifecycle-and-saves` were ported or deleted by EX.4, so `syncDemos` throws "Missing demo source". | `scripts/sync-demos.ts` (`RAW_DEMOS`, `prepareDemoHosting`) | WEB.PLAY.4 rebuilds the sync; the folder demos leave `/examples` (PLAY-D10). |
| The 17 one-file examples are not on the site. | `tooling/examples-runner/src/catalog.ts` (`readCatalog`) | The site's example data comes from the catalog, not from `RAW_DEMOS`. |
| `packages/automata` is private and exports TypeScript source that pulls in `.svelte` screens; there is no `dist`. | `packages/automata/package.json` | The runtime has to be built by the framework with Vite and the Svelte plugin. |
| `GameSpec.seams` is documented "Tests only.", and `defineGame` results are tracked in a WeakSet, so a copy with seams added fails `startGame`. | `packages/game/src/define-game.ts:116` | Running an example against the fake host needs `runGame` from the runtime, or a new API. That call belongs to the game and integration lanes (PLAY-D11). |
| Ruken's CSP has `script-src 'self' 'wasm-unsafe-eval'` and no `blob:` or inline scripts. | vendored `@ruken/manifest` `dist/index.js`, `contentSecurityPolicy` | The preview cannot run under Ruken's exact policy. It gets its own (§11.2); the framework's examples smoke tests under Ruken's headers stay the proof of Ruken compatibility. |
| The site sends no CSP and no security headers; `serve-static.ts` sends `cache-control: no-store` for every file. | `src/hooks.server.ts`, `scripts/serve-static.ts:59` | The preview's policy travels in its own page (§5.3). `/playground/` needs CORS, CORP and cache headers (§11.3). |
| The production host and its header set are undecided. | DX.12, QB.4 | The `/playground/` rules are a requirement on QB.4 (R-7). |
| The framework's master delivery plan says of the M10.0 website spec: "nothing is built before this spec". | framework `docs/02-master-delivery-plan.md`, M10.0 row | This spec is narrower than M10.0 and follows a later Owner direction; PLAY-D13 asks the Owner to confirm it may go first. |

## 3. How pixijs.com does it, and what AF takes

Read from the pixijs.com source on GitHub (the pages are client-rendered, so a fetch of the site returns navigation only). Sources are in §20.

| pixijs.com | AF playground | Why AF differs |
| --- | --- | --- |
| Monaco (`@monaco-editor/react` ^4.7.0), loaded lazily with `loader.init()` and no custom `paths`, so most likely from a CDN | CodeMirror 6, self-hosted, loaded on the reader's first tap or focus | Monaco 0.52.2 is 3.77 MB of `editor.main.js` (953 kB gzip) plus 5.75 MB of `tsWorker.js` (1.28 MB gzip), and its README says mobile browsers are not supported. CodeMirror 6 handles touch, and with its basic setup and TypeScript highlighting it is 503 kB (169 kB gzip). A CDN load fails the site's no-third-party gate. |
| Sandpack (`@codesandbox/sandpack-react` ^2.20.0, Apache-2.0) with CodeSandbox's hosted bundler; `bundlerURL` is not set | No bundler. Babel's parser checks the code, sucrase strips the types, an import map points `@mcthaydt/automata` and `zod` at prebuilt framework bundles | An example is one file with two bare imports, so a bundler has nothing to resolve. A hosted bundler is a runtime dependency on another company and a third-party origin; the privacy page says every demo is served from this site. |
| `recompileDelay: 500`; Monaco's `onChange` writes straight into Sandpack's state; no Run button | A 300 ms quiet period after the last change, then compile and restart (PLAY-D6) | Same idea. AF's compile is a few milliseconds, so it can afford a shorter wait. |
| No error UI of its own (Sandpack's defaults) | Syntax and runtime errors at their line, with the last working preview kept | The Owner asked for live editing; an edit that breaks the code must not blank the preview. |
| URL state: `btoa(JSON.stringify({state}))` written on every change, history pushed on the first edit | The URL fragment, `#code=1.<base64url of deflate-raw>`, replaced after each successful compile | Compressed, so a 100-line example fits a short link; a fragment never reaches the server. |
| Narrow screens: a `ToggleGroup` shows the editor or the preview; a code comment plans to stack the panes on small screens | Phone portrait: preview above the editor, with a Preview toggle; side by side from 700 px (PLAY-D14) | AF designs at phone sizes first. |
| Types for completions fetched from jsDelivr at runtime and cached in `localStorage` | None in v1 (PLAY-D2) | No third-party requests and no browser storage. |

## 4. Architecture and ownership

```
 site page /examples/<id>  (site origin)                     sandboxed frame (opaque origin)
 ┌──────────────────────────────────────────────┐            ┌──────────────────────────────────────┐
 │ static code (prerendered)                    │            │ /playground/examples/<module>/<name>/ │
 │   └─ first tap/focus → CodeMirror (lazy)     │            │   meta CSP (§11.2), import map       │
 │ edit → 300 ms quiet → compile worker (lazy)  │  run       │   frame.js: no-eval first, harness   │
 │   parse, imports check, loop guard, strip    │ ─────────► │   import(blob: module)               │
 │   + import.meta.url rewrite                  │  booted,   │   runExample → runGame + fake host   │
 │ frame orchestrator: candidate frame, swap,   │  running,  │   determinism: replay / hash         │
 │   timeouts, origin + source + schema checks  │ ◄───────── │                                      │
 │ status line, diagnostics, determinism row    │  failed,   │ loads only /playground/** from the   │
 │ share link (#code=), Reset                   │  determ.   │ site (CORS: Origin: null)            │
 └──────────────────────────────────────────────┘            └──────────────────────────────────────┘
```

| Artifact or state | Owner | Writers | Consumers |
| --- | --- | --- | --- |
| The example sources, headers, goldens, resources (`examples/**`) | each example's lane (EX spec §8) | that lane | the playground build, through the catalog |
| The playground runtime build, frame pages, harness, protocol and manifest (`tooling/examples-runner`, new `build:playground`) | framework, integration lane; the game lane reviews the harness's use of `runGame` (PLAY-D11) | integration lane | the site's sync |
| The protocol module (`playground-protocol.ts`): message schemas, the loop-guard name, the example module URL rule | framework, integration lane | integration lane only | the frame (framework) and the parent (site, a verbatim copy made by the sync) |
| `static/playground/**`, `src/data/examples.json`, `src/lib/playground/protocol.ts` | the sync (`scripts/sync-playground.ts`) | the sync only; never edited by hand | the site |
| The editor document, compile results, run ids, the preview's frames, the status line | the `Playground` component, in the page | the reader's edits; the orchestrator | the page |
| The edit in the URL | the share-link module | the orchestrator, after a successful compile | a reader who opens the link |
| Sim state inside a run | the example's sim, in the frame | the sim only | the frame's renderer and harness |

Nothing the frame says is written into the page as HTML. The parent shows frame messages as text after validating them.

## 5. Contracts

### 5.1 The protocol (framework-owned, copied to the site)

`tooling/examples-runner/src/playground/playground-protocol.ts` defines the messages with Zod, the only schema language. The sync copies it unchanged to `src/lib/playground/protocol.ts` with a first line naming the framework commit; `tests/playground-protocol.test.ts` fails if the copy differs from the framework file at `framework.ref`. Every message has `v: 1`.

| Direction | `type` | Fields | When |
| --- | --- | --- | --- |
| frame → parent | `booted` | `framework` (40-hex commit of the build) | The runtime modules have loaded and no-eval has run; the frame waits for `run`. |
| parent → frame | `run` | `runId` (integer ≥ 1); `code` (compiled module text, at most 262,144 characters); `determinism?`: `{ ticks, replay? }` (`replay` is a site path, present only when the code is the unedited original) | Once per frame, after `booted`. |
| frame → parent | `running` | `runId` | The runtime set `data-state="ready"` and the next animation frame has run, or `RUNNING_FRAME_WAIT_MS` has passed without one. Browsers stop animation frames in a cross-origin frame that is off screen, and on a phone the preview is often scrolled away while the reader types, so `running` cannot wait for a frame that may never come. |
| frame → parent | `failed` | `runId`; `phase`: `import`, `boot` or `run`; `message` (at most 2,000 characters); `line?`, `column?` (1-based, in the reader's source); `hung?: true` | Any error the frame catches: the module import, the default-export check, `runExample`, a `window` `error` or `unhandledrejection`, the runtime's `data-state="failed"`, or a loop-guard stop. |
| frame → parent | `determinism` | `runId`; `ticks`; `hash` (16 hex digits); `golden`: `pass`, `diverged` or `none`; `tick?` (where it diverged) | After `running`, when `run` asked for it. |

Checks on both sides (AGENTS.md: a window-message handler validates both source and origin):

- **The frame** accepts a message only when `event.source === window.parent`, `event.origin === location.origin` (the frame's document URL is on the site; its own origin is opaque, so `location.origin` is the site's), and the message parses. It accepts one `run`, ever. Anything else is dropped.
- **The parent** accepts a message only when `event.source` is the `contentWindow` of a frame it created and still holds, `event.origin === 'null'`, the message parses, and its `runId` is the one that frame was given. Anything else is dropped without a console error (the e2e gate fails on console errors).
- **Sending.** The parent posts to the `contentWindow` it created with target origin `'*'`, because an opaque origin cannot be named; the code it sends is the reader's own and not a secret. The frame posts to `window.parent` with target origin `location.origin`.

### 5.2 The compile step (site-owned, runs in a worker)

`src/lib/playground/compile.ts` is a pure function, unit-tested in Node; `src/lib/playground/compile.worker.ts` wraps it for the browser.

```ts
compileExample(source: string, example: { id: string; moduleUrl: string }): CompileResult
type CompileResult =
  | { ok: true; code: string }
  | { ok: false; diagnostics: { line: number; column: number; message: string }[] }
```

In order:

1. **Parse the TypeScript** with `@babel/parser` (`sourceType: 'module'`, `plugins: ['typescript']`). A syntax error is a `SyntaxError` with `loc: { line, column }` (column 0-based); that becomes the diagnostic, shown 1-based. Babel is used for this, and not sucrase's own parser, because sucrase misplaces errors inside arrow functions passed as arguments, which is where most example code lives. Measured on `shapes-rects.ts` with `const broken = 1 +;` inserted inside the `move` system on line 21: sucrase reports `17:41` (the system's `=>`), Babel `21:18`. A missing closing bracket is reported at the next token, which can be the next line, as TypeScript itself reports it.
2. **Check the imports** on that tree: every `ImportDeclaration` and every `ExportNamedDeclaration` or `ExportAllDeclaration` with a source must name `@mcthaydt/automata` or `zod`, the catalog's rule for core examples. Anything else is a diagnostic at that line: "The playground can import only @mcthaydt/automata and zod." A dynamic `import()` is left to the frame's CSP.
3. **Guard every loop**: the first statement of each `for`, `for…of`, `for…in`, `while` and `do…while` body becomes `__afLoop(<line>);` (a body that is not a block is wrapped in `{ … }`). The insertions are plain JavaScript placed by the tree's offsets, and none adds a newline. The name `__afLoop` comes from the protocol module; the frame defines it (§7.3).
4. **Rewrite `import.meta.url`** to a string literal: `example.moduleUrl`, which is `<site origin>/playground/examples/<module>/<module>-<name>.ts`. In a Blob module `import.meta.url` is a `blob:` URL and `new URL('../resources/…', import.meta.url)` throws; with the rewrite, `textures-sprite` and `audio-sound` resolve to `/playground/examples/resources/…`, where the sync publishes `examples/resources/`. Only the exact member expression `import.meta.url` is rewritten.
5. **Strip the types** with sucrase: `transform(code, { transforms: ['typescript'], disableESTransforms: true, filePath })`. sucrase keeps every line where it was (measured: `shapes-rects.ts` 53 lines in, 53 out, every line aligned), so runtime line numbers are the reader's. If sucrase rejects code Babel accepted, its message and location are the diagnostic.
6. Append `//# sourceURL=examples/<module>/<module>-<name>.ts` so stack frames name the file.

The worker answers `{ seq, result }` for each `{ seq, source }`; the parent drops any answer whose `seq` is not the latest it sent.

### 5.3 The frame page (framework-owned, one per example)

`playgroundFramePage(entry, runtime)` joins `examplePage` and `pendingPage` in `tooling/examples-runner/src/page-template.ts`. It is served at `/playground/examples/<module>/<name>/`, the same `/<module>/<name>/` shape as the runner's `entry.url`, so `textures-atlas`'s page-relative `'wick-0.json'` resolves to that example's public folder beside it.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="(§11.2)" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>shapes-rects: preview</title>
    <style>/* the runner's page STYLE */</style>
    <script type="importmap">{"imports":{"@mcthaydt/automata":"/playground/runtime/automata-<hash>.js","zod":"/playground/runtime/zod-<hash>.js"}}</script>
    <link rel="stylesheet" href="/playground/runtime/automata-<hash>.css" crossorigin="anonymous" />
  </head>
  <body>
    <main id="game"></main>
    <script type="module" src="/playground/runtime/frame-<hash>.js"></script>
  </body>
</html>
```

`frame.js` imports `@mcthaydt/automata/no-eval` before anything else, then the harness, then posts `booted`. A pending example (`Pending:` header) gets `pendingPage` instead and never boots.

### 5.4 The harness (framework-owned)

Exported from the playground build for `frame.js` only:

| Function | Does | Built on |
| --- | --- | --- |
| `runExample(game, { root, host })` | Starts a `defineGame` result against an in-memory fake host configured from the example's `Host:` header (`grant`, `saves`, `offline`); returns the `RuntimeHandle` | `runGame` from the runtime with `seams.sdkEnv` set to the fake host's `gameEnv` (`createFakeHost` from `@ruken/sdk-host/testing`, in-memory mode, as `packages/host/src/testing/hosting-test.ts` uses it), subject to PLAY-D11 |
| `checkGolden(game, replayBytes)` | Replays the golden in this browser: `{ golden: 'pass', ticks, hash }` or `{ golden: 'diverged', tick }` | `unpackReplay` (with a `deflate-raw` `DecompressionStream`) and `createReplayStepper` from `@mcthaydt/automata-sim/replay`, the path `replayGolden` uses in the parity suite |
| `hashRun(game, ticks)` | Runs the sim headless for `ticks` steps with no input and returns `sim.hash()` | `createSim({ seed, plugins, setup })` and `step([])`, as `examples.parity.test.ts` drives it |
| `isDefinedGame(value)` | Whether the default export is a `defineGame` result | the game package's own check |

With the in-memory fake host there is no Ruken welcome to wait for (a Ruken-target build in a non-Ruken frame waits up to 10 s, `packages/host/src/hosting-live.ts`), and `core-saves`, `core-leaderboard` and `core-host-lifecycle` behave as they do under the framework's fake host. Saves live in that frame's memory and end with it.

### 5.5 Catalog data and the published tree

The playground build writes `dist-playground/`; the sync copies it to `static/playground/` and writes `src/data/examples.json` from its catalog file.

```
static/playground/
  manifest.json                     framework commit, every file with bytes and sha256, bundled packages with versions and licences
  catalog.json                      readCatalog entries: id, module, name, title, shows, controls, packages, difficulty, tier,
                                    golden ticks, host settings, pending, source path and text, code lines, frame page URL
  runtime/                          one Vite build, content-hashed names: automata, zod, frame, harness and fake-host chunks, CSS
  examples/<module>/<name>/         the frame page and that example's examples/public/<module>/<name>/ files
  examples/resources/               examples/resources/ (72 KB, including the 26.5 KB chime.wav)
  goldens/<id>.replay               examples/__goldens__/ (10 files, 1.8 to 3.9 kB each, 26 kB in all)
  compiled/<id>.js                  written by the site's sync, not the framework: each original through compileExample (§5.2), so the
                                    arrival run (F1) needs neither the editor nor the worker; a unit test checks each file equals a fresh compile
```

The hashes stay in the `.replay` files and in `manifest.json` under `static/`; `tests/audit-regressions.test.ts` keeps any 16-hex-digit hash out of `src/`.

### 5.6 The share link

`/examples/<id>#code=1.<payload>`: `1` is the format; the payload is the UTF-8 source, compressed with `CompressionStream('deflate-raw')`, in base64url. Decoding stops at 65,536 decompressed bytes and refuses a fragment longer than 32,768 characters. The fragment is written with SvelteKit's shallow `replaceState` after each successful compile and removed by Reset. A fragment never reaches the server, and nothing is stored in the browser beyond its history.

### 5.7 Named constants

| Name | Value | Where |
| --- | --- | --- |
| `EDIT_QUIET_MS` | 300 | the orchestrator: the compile waits this long after the last change (PLAY-D6) |
| `FIRST_BOOT_TIMEOUT_MS` | 20,000 | the first frame of a page visit, which downloads the runtime (`DemoRunner` waits as long) |
| `BOOT_TIMEOUT_MS` | 10,000 | later frames, from creation to `running` |
| `RUNNING_FRAME_WAIT_MS` | 250 | the frame: how long `running` waits for an animation frame after the runtime is ready |
| `LOOP_GUARD_MS` | 1,000 | the frame: loops in one stretch of synchronous work that has run this long are stopped (PLAY-D15) |
| `ANNOUNCE_AFTER_MS` | 1,000 | an error is announced to screen readers only after it has stood this long |
| `MAX_SHARED_SOURCE_BYTES` | 65,536 | the share link |
| `MAX_FRAGMENT_CHARS` | 32,768 | the share link |

All timers take an injected clock in tests.

## 6. Ordered flows

**F1. Open an example.** The prerendered page has the example list, the header fields (Shows, Controls, Difficulty, Packages), the code as plain highlighted text in a box the same size as the editor will be (§9.3), and the preview's poster: the example's approved screenshot when the catalog has one, otherwise a panel with the title. The page hydrates after the first paint (`hydrateAfterFirstPaint`). Then, unless reduced motion is set (§7.4), the original starts at once (PLAY-D1): once the page's `load` event has fired and the preview's box is within one viewport of the screen (an `IntersectionObserver`), the orchestrator runs F4 with the original's precompiled module (`/playground/compiled/<id>.js`, §5.5), so neither the editor nor the compile worker is needed for the first run. The status line says "Starting the preview…", then "Running. Edit the code and the preview updates as you type." Waiting for `load` keeps the frame's downloads behind the page's own (R-9). With reduced motion the poster stays, with Play, and the status line says "Press Play to start the example. Once it runs, edits update it live." Before the first run nothing under `/playground/`, no editor and no compiler is requested.

**F2. Start editing.** The first `pointerdown` or `focusin` on the code box imports the editor chunk and starts the compile worker. The status line says "Loading the editor…". When the editor mounts, it holds the same text, in the same box, with the caret where the reader tapped (the tap's line and column are worked out from the static text's metrics before the swap). Focus stays in the code. The running preview is untouched.

**F3. Edit, wait, compile.** Every change restarts the `EDIT_QUIET_MS` timer; changes during IME composition start it only when composition ends. When the timer fires, the parent sends the source to the worker with the next `seq`. Results with an older `seq` are dropped.

**F4. Start or replace the preview.** On a successful compile:

1. If a candidate frame is still booting, remove it.
2. Create a candidate `<iframe sandbox="allow-scripts" allow="fullscreen; autoplay; gamepad" referrerpolicy="no-referrer">` on the example's frame page, under the current frame (or under the poster, for the first run), at the same size, `inert` and `aria-hidden="true"`.
3. On `booted`, post `run` with the next `runId`, the compiled code and the determinism request.
4. On `running`, swap: the candidate moves on top, loses `inert` and `aria-hidden`, gets the title "Preview: <title>"; the old frame is removed, which ends its document and its WebGL context. The status line says "Preview updated."
5. Write the share fragment (F8).

At most two frames exist at any moment. The first run of a page visit starts on arrival (F1), or on Play under reduced motion (PLAY-D1). An edit made before the first run has reached `running` replaces it as any later edit does.

**F5. Syntax error.** The worker returns diagnostics. The editor marks the line (a gutter marker and an underline, through `@codemirror/lint`), the status line says "Line 21: Unexpected token. The preview is still running your last working version.", and nothing happens to the frames. If the error is still there after `ANNOUNCE_AFTER_MS`, the polite live region announces it once. The next successful compile clears it.

**F6. Determinism.** After `running`, when the example has a `Golden:` header, the frame runs `checkGolden` (unedited code) or `hashRun` (edited code) during idle time and posts `determinism`. The row under the preview shows it (§13).

**F7. Reset.** Shown only while the code differs from the original. Pressing it replaces the editor's text with the original in one undoable transaction (Mod-Z brings the edit back), removes the fragment, and runs F3 at once without the quiet period.

**F8. Share.** After each successful compile the fragment holds the current code. Copy link copies `location.href` and says "Link copied" (or "Copying is blocked by this browser" when the clipboard is denied, the existing `CopyButton` rule).

**F9. Open a share link.** The page decodes the fragment after hydration. A good payload loads the editor at once with the shared code and, unless reduced motion is set, runs it in place of the original (PLAY-D1); the shared code goes through the worker, so the original's precompiled module is not used. A bad or oversized payload leaves the original code and says "This link's code could not be read, so the original example is shown." The decoded text is only ever put in the editor and sent to the frame.

**F10. Switch example or leave.** Following a link to another example removes both frames, cancels the worker's pending job and the timers, and loads the new source; the editor stays mounted if it was. The new example starts at once, as on arrival; under reduced motion it starts at once only if the reader pressed Play on this visit. Leaving the page removes the frames and terminates the worker.

**F11. Restart and Fullscreen.** Restart runs the current code again from tick 0 in a fresh frame (F4 without a compile). Fullscreen behaves as in `DemoRunner`: the parent puts the preview container in fullscreen and says so when the browser refuses or does not answer.

## 7. Lifecycle, failure and recovery

### 7.1 States

| State | Values | Owner |
| --- | --- | --- |
| Code | `static` → `loading` → `ready`, or `unavailable` | `CodePanel` |
| Compile | `original`, `compiling`, `ok`, `syntax-error` | orchestrator |
| Preview | `poster` (before the first run; under reduced motion, until Play), `starting`, `running`, `failed` | orchestrator |
| Candidate | `none`, `booting(runId)` | orchestrator |
| Determinism | `none`, `checking`, `pass`, `diverged(tick)`, `edited(hash)` | orchestrator |

The playground root carries `data-code`, `data-preview` and `data-run-id` attributes, the semantic readiness signals tests wait on.

### 7.2 Failures

| Case | Detected by | What the reader sees | What is kept | Recovery |
| --- | --- | --- | --- | --- |
| Syntax error | the worker (Babel's `SyntaxError.loc`) | the line marked; the status line names it | the running preview, untouched | the next good edit |
| Import other than `@mcthaydt/automata` or `zod` | the worker (Babel's tree) | the import's line marked | the running preview | the next good edit |
| Module fails to import, or the default export is not `defineGame(...)` | the frame, `failed` (`import`) | "Line N: …" or "The example's default export must be defineGame(...)" | the running preview; the candidate is removed | the next good edit |
| Throws before its first frame (`setup`, a view, `runExample`) | the frame, `failed` (`boot`) | the message with its line when the stack has a frame in the example | the running preview; the candidate is removed | the next good edit |
| Throws while running (a system on tick 300) | the frame, `failed` (`run`) | the preview stays on its last picture with "Stopped: line N: …" over it; the line marked | the code | the next good edit or Restart |
| A loop that never ends | the loop guard (§7.3), `failed` with `hung: true` | "Line N: this loop ran for over a second without a break, so the preview stopped it." | as the two rows above, by phase | the next good edit |
| Never reaches `running` | `BOOT_TIMEOUT_MS` (`FIRST_BOOT_TIMEOUT_MS` for the first) | "The preview did not start within 10 seconds." | the running preview; the candidate is removed | the next good edit or Restart |
| A blocked request or eval inside the frame | the frame's CSP; in tests, the frame's `securitypolicyviolation` listener (A-17) and the e2e console gate | the error it causes, if any, as above | — | a framework fix; never by loosening the CSP |
| The editor chunk fails to load | the dynamic import rejects | "The editor couldn't load. The code is shown read-only, and Play still runs the original." | static code; Play | reload |
| The worker fails to start or crashes | its `error` event | "Live updates are unavailable in this browser. Play still runs the original." | static code; Play | reload |
| The runtime fails to download (offline) | the first frame never posts `booted`; `FIRST_BOOT_TIMEOUT_MS` | "The preview couldn't load. Check the connection and press Retry." with Retry | the editor and the edit | Retry |
| A message with the wrong source, origin, shape or run id | the parent's checks (§5.1) | nothing | everything | — |

The line for a runtime error comes from the first stack frame in the example's file (`examples/<module>/<module>-<name>.ts` through `sourceURL`, or the Blob URL), parsed in both the V8 (`at f (url:line:col)`) and JavaScriptCore (`f@url:line:col`) shapes. An error with no such frame is shown without a line.

### 7.3 The loop guard

The frame defines `__afLoop(line)`. It counts its calls and, every 1,024 calls, reads `performance.now()`. The first such reading in a stretch of synchronous work records the stretch's start and posts a message to itself on a `MessageChannel`; that message is delivered only when the stretch ends and the event loop gets a turn, and it clears the start. A later reading more than `LOOP_GUARD_MS` after the start throws an error naming `line`. A `MessageChannel` is used, and not animation frames or timers, because a browser stops animation frames and may slow timers in an off-screen frame, which would make an idle preview look hung. The guard reads the clock and touches nothing else, so a run that never trips it has the same sim hash as the unguarded code.

The guard covers loops. A single long statement with no loop in it (a huge `Array.prototype.fill`, say) is not caught; in a browser that runs the frame in the page's own process the whole tab then stalls until the browser offers to stop it (R-4).

### 7.4 Reduced motion

With `prefers-reduced-motion: reduce`, the page shows the example's still poster and a Play control, and nothing runs until the reader presses Play, including on an edit and on a share link. Once they have pressed Play on this visit, edits update the preview live as for everyone else. The orchestrator reads the media query when it decides to start and listens for changes: turning reduced motion on while a preview runs does not stop it, but an example opened afterwards waits for Play.

## 8. UI inventory

### 8.1 Components

| Component | File | Responsibility |
| --- | --- | --- |
| `ExamplesIndex` | `src/routes/examples/+page.svelte` | The catalog grouped by module, each with its title, Shows line and difficulty. |
| Example page | `src/routes/examples/[id]/+page.svelte`, `+page.ts` (prerendered with an `entries` list from `examples.json`) | The sidebar list (current example marked), the header fields, the `Playground`. |
| `Playground` | `src/lib/playground/Playground.svelte` | Layout, toolbars, status line, and the orchestrator's state. |
| `CodePanel` | `src/lib/playground/CodePanel.svelte` | The static code, the upgrade to the editor, diagnostics. |
| `PreviewPanel` | `src/lib/playground/PreviewPanel.svelte` | The poster, Play, the frames, the stopped overlay, Retry. |
| `DeterminismRow` | `src/lib/playground/DeterminismRow.svelte` | §13. |
| Editor setup | `src/lib/playground/editor.ts` (dynamic import) | CodeMirror extensions, theme, keymaps, the accessible name. |
| Orchestrator | `src/lib/playground/orchestrator.ts` | F3 to F11 with an injected clock and frame factory, so it is unit-testable. |
| Compile | `src/lib/playground/compile.ts`, `compile.worker.ts` | §5.2. |
| Share link | `src/lib/playground/share-link.ts` | §5.6. |
| Protocol | `src/lib/playground/protocol.ts` (synced copy) | §5.1. |

### 8.2 Controls

| Control | Where | Shown when | Does | Size |
| --- | --- | --- | --- | --- |
| Play | preview, on the poster | under reduced motion before the first run, and after a failure with no running preview | starts the original or current code | 48 px high (primary) |
| Restart | preview toolbar | a run exists | F11 | 44 px |
| Fullscreen | preview toolbar | always | F11 | 44 px |
| Retry | preview, after a download failure | then | a fresh first frame | 44 px |
| Copy code | code header | always | copies the editor's text | 44 px |
| Copy link | code header | always | F8 | 44 px |
| Reset | code header | the code differs from the original | F7 | 44 px |
| Preview (toggle, `aria-pressed`) | code header | playground narrower than 700 px | hides or shows the preview without resizing it (§9.1) | 44 px |
| A diagnostic in the status line | under the editor | there is one | moves the caret to its line and focuses the editor | 44 px |

The existing `DemoRunner` toolbar buttons are 36 px and the copy buttons 32 px; the playground does not reuse those sizes. Fixing them on `/` and `/start` is a separate follow-up.

### 8.3 Status line texts

"Starting the preview…" · "Running. Edit the code and the preview updates as you type." · "Press Play to start the example. Once it runs, edits update it live." · "Loading the editor…" · "Preview updated." · "Line N: <message>. The preview is still running your last working version." · "Stopped: line N: <message>." · "The preview did not start within 10 seconds." · "The preview couldn't load. Check the connection and press Retry." · "The editor couldn't load. The code is shown read-only, and Play still runs the original." · "This link's code could not be read, so the original example is shown."

The status line is visible text, not a tooltip, because touch has no hover. It is the editor's `aria-describedby`.

## 9. Responsive and input inventory

### 9.1 Layout

Layout follows the playground's container width and the small viewport height (`svh`), which the soft keyboard does not change. The preview's size follows its width, so opening the keyboard neither resizes nor reloads the game.

| Container | Example viewport | Layout | Preview size | Editor size |
| --- | --- | --- | --- | --- |
| < 700 px | phone portrait 375×667 | One column: preview, then the code. The Preview toggle hides the preview (clipped to zero height and made `inert` inside a wrapper that keeps the frame's own box, so the game is neither resized nor reloaded) and shows it again. While the preview is hidden or scrolled away the browser stops drawing it and the game waits; edits still replace it (§5.1, `running`). | full width, 16:10 | grows with the code (page scroll), lines wrap |
| ≥ 700 px, height ≥ 500 px | tablet 768×1024, desktop 1280×800 | Two columns: code left (about 55 %), preview right and sticky at the top while the code scrolls. | column width at 16:10, at most `100svh` minus the header and toolbar | grows with the code |
| ≥ 700 px, height < 500 px | landscape phone 780×270 | Two columns, as above; the preview's height is capped by the usable height and the game letterboxes inside. | `min(16:10 of the column, 100svh − toolbar)` | grows with the code |

No layout scrolls the page sideways: long lines wrap in the editor (`EditorView.lineWrapping`, as pixijs.com does), and the diagnostics wrap with `overflow-wrap: anywhere`. Text zoom to 200 % keeps every control reachable.

### 9.2 Input

| Input | Behaviour |
| --- | --- |
| Touch | A tap on the code starts editing with the caret at the tap. Selection handles and the native context menu are the browser's. The editor's text is 16 px (1 rem), so iOS Safari does not zoom the page when it gains focus. |
| IME and Android keyboards | CodeMirror handles composition; the quiet timer waits for composition to end. `autocorrect`, `autocapitalize` and `spellcheck` are off on the editor. |
| Hardware keyboard | CodeMirror's default, history and search keymaps. Tab is not bound (no `indentWithTab`), so Tab and Shift+Tab leave the editor and the keyboard gate finds no trap. The site's "/" shortcut leaves typing alone (`isEditing` already covers `contenteditable`). |
| Mouse | As touch, plus hover tooltips on diagnostics; the status line still carries the text. |
| Screen readers | The editor's accessible name is "Code for <title>. Changes update the preview." The status line is its description; errors reach the live region once, after `ANNOUNCE_AFTER_MS`. The preview frame is titled "Preview: <title>". |
| Focus | The editor shows the site's focus ring on `.cm-editor.cm-focused`. A swap never moves focus. |
| Game input | Keys, touch and gamepad reach the game only when the reader taps or clicks the preview; the frame has `allow="gamepad"`. Tab order runs through the frame's own controls and back out, as the browser does for any frame. |
| Audio | The frame has `allow="autoplay"`; the runtime's own unlock-on-first-input rule decides when sound starts. |

### 9.3 No layout shift when the editor arrives

The static code and the editor use the same font (Geist Mono, 16 px, line height 1.5), the same padding, the same line-number gutter (wide enough for three digits) and the same wrapping, so the code box keeps its size when the editor replaces it. A real-browser test measures the box before and after. The editor's colours come from the same theme tokens as the static code's highlighting; the tokens differ a little (Lezer against TextMate grammars), which is a colour change, not a shift.

## 10. Performance budgets

### 10.1 Bytes

| What | Loaded | Measured | Budget |
| --- | --- | --- | --- |
| Scripts modulepreloaded by an example page | arrival | not built yet; today's heaviest page has 35 KB | ≤ 48,000 B (`MAX_PRELOADED_SCRIPT_BYTES`, `check:site`), entry and node modules only |
| Editor chunk: `codemirror` 6.0.2 basic setup with `@codemirror/lang-javascript` 6.2.4 | first tap or focus on the code | 503 kB raw, 169 kB gzip, 143 kB brotli | ≤ 175 kB gzip |
| Compile worker: `@babel/parser` 8.0.10 and sucrase 3.35.1 | with the editor | 496,557 B raw, 119,666 B gzip, 98,517 B brotli (the parser alone 290,106 / 72,484 / 59,760; sucrase alone 206,034 / 47,445 / 40,176) | ≤ 125 kB gzip |
| Playground runtime: `automata.js` and the 14 files it loads | first run | 1,155,285 B raw, 354.6 kB gzip, 307.6 kB brotli | — |
| Playground runtime, all 20 JS files (adds the zod facade, fake host and harness) | first run | 1,512,762 B raw, 443 kB gzip, 381 kB brotli | ≤ 460 kB gzip, a framework build test |
| The default screens' CSS | first run | 28.6 kB raw | — |
| Example resources and public files | when an example uses them | 92 KB in all (resources 72 KB, public 20 KB) | — |
| Goldens | the determinism row | 1.8 to 3.9 kB each | — |

Where the numbers come from: the editor, runtime, CSS and resource figures were measured on 2026-10-30 from a Vite 8 build of framework `b7ef19d9` (`automata.js` alone is 660.5 kB raw; its closure includes Pixi, a 138 kB shared Zod core chunk and a 63 kB sim chunk; the `zod` facade is 256 kB because `export *` cannot be tree-shaken; the fake host 39 kB; the harness 4.2 kB). The compile worker figures were measured the same day with esbuild 0.25.12 `--minify` and Node's zlib (gzip level 9, brotli quality 11). The runtime must be one build: that gives one Zod, so no-eval's `config({ jitless: true })` also covers the example's own schemas, and one sim and koota.

### 10.2 Time

"A mid phone" in CI is Chromium with 4× CPU slowdown (Lighthouse's mobile setting) on the site's `af-mac` runner; WebKit runs the same journeys unthrottled as a functional check; the Owner's own phone is the acceptance check.

| Measure | Condition | Budget |
| --- | --- | --- |
| Lighthouse (mobile, median of 3) on `/examples` and on `/examples/core-basic-window` | `lighthouserc.json` | performance ≥ 0.9, LCP ≤ 2,500 ms, CLS ≤ 0.1, TBT ≤ 200 ms (`/examples` today: TBT 19.5 ms, LCP 1,504 ms) |
| First tap on the code to an editor that takes input | 4× CPU, runtime and editor not cached, unthrottled network | ≤ 800 ms |
| Last keystroke to the new run's first frame (warm) | 4× CPU, median of 10 single-character edits | ≤ 1,000 ms, `EDIT_QUIET_MS` included |
| The same, desktop | unthrottled | ≤ 500 ms |
| First edit to the first frame of a visit (cold) | Lighthouse's simulated slow 4G and 4× CPU | ≤ 4,000 ms |
| One compile of a 100-line example | 4× CPU, warm worker | ≤ 50 ms (Node on the measuring machine: Babel's parse and sucrase together 4.85 ms warm on the 102-line `core-camera-2d.ts`; cold, Babel 19.5 ms and sucrase 12 to 14 ms on `shapes-rects.ts`) |
| Frames alive | 50 edits in a row | never more than 2; exactly 1 once settled |

`tests/examples-gallery.test.ts`'s "does not start the demo until Play is pressed" exists because a demo that started on arrival cost `/examples` 8.8 s of TBT (QB.3h). The Owner's PLAY-D1 now starts the example on arrival, so the lesson is kept differently: the index page `/examples` runs nothing; an example page starts its frame only after `load` and only when the preview is near the screen, so the frame's work falls after the page's own; the editor chunk and the worker still wait for a tap or focus on the code or a share link; and Lighthouse runs on `/examples/core-basic-window` and on the heaviest example page, `/examples/shapes-rects`, with the budgets above (R-9). Its replacement test pins: no request under `/playground/` before `load`; none at all under reduced motion until Play; no editor chunk and no worker until a tap, focus or share link.

## 11. Security

### 11.1 What the preview may and may not do

Code in the preview is untrusted: the reader typed it, or someone put it in a link. It runs only in `<iframe sandbox="allow-scripts">` on the site's own origin, which makes its origin opaque. So it:

- cannot reach the page around it (`parent.document` throws), the site's storage or cookies (the site sets none, and an opaque origin has no `localStorage`, `sessionStorage` or IndexedDB);
- cannot navigate the top window, open pop-ups, submit forms, or lock the pointer and orientation (none of those sandbox flags are given);
- can load only the site's own files and make requests only to the site (§11.2), with `Origin: null` and no credentials;
- cannot use `eval` or `new Function` (no `'unsafe-eval'`), so an eval regression in the framework shows up here as a CSP error instead of passing quietly.

A Blob module URL is not eval: CSP treats it as a script load (`blob:` in `script-src`), and transpiling only produces a string.

What remains: the code can burn CPU and memory until the guard or the timeouts stop it (§7), and it can draw anything inside the preview's box. It can send GET requests to the site's own URLs; the site serves static files only, so that reaches nothing but the host's request log.

A separate preview origin (a subdomain or another host) would add process isolation in more browsers, but it is a third-party origin to the site's e2e gate and contradicts the privacy page; a same-origin frame (`allow-same-origin`, or a `srcdoc` frame that keeps the site's origin) would run a shared link's code as the site. Both are rejected (PLAY-D4).

### 11.2 The frame's policy

Written by the framework into each frame page's `<meta http-equiv="Content-Security-Policy">` (a meta policy cannot carry `frame-ancestors`). It is Ruken's policy with two additions to `script-src` (`blob:` and the import map's hash) and without `manifest-src` and `frame-ancestors`:

```
default-src 'none'; script-src 'self' blob: 'wasm-unsafe-eval' 'sha256-<import map>'; style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:; worker-src 'self' blob:; connect-src 'self';
frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'
```

`'self'` must mean the site's origin inside an opaque-origin document; CSP3's policy self-origin says so, and WEB.PLAY.1 proves it in Chromium and WebKit before anything depends on it (R-2). The import map's hash is computed by the build from the exact text it writes.

### 11.3 Headers for `/playground/`

Because the frame's origin is opaque, every module, stylesheet, texture, sound and golden it loads is a cross-origin request from the site's point of view. Every response under `/playground/` carries:

| Header | Value | Why |
| --- | --- | --- |
| `Access-Control-Allow-Origin` | `*` | module scripts, `fetch` and fonts are CORS requests from `Origin: null` |
| `Cross-Origin-Resource-Policy` | `cross-origin` | so a future site-wide `same-origin` CORP (QB.4) does not block them |
| `Cache-Control` | `public, max-age=31536000, immutable` under `/playground/runtime/` (content-hashed names); `no-cache` elsewhere | every run makes a fresh frame; without caching each run downloads the runtime again (R-1) |

They are public static files, so `*` exposes nothing. `scripts/serve-static.ts` (used by Playwright and Lighthouse), the Vite dev server (a small plugin; Vite's default `server.cors` does not allow the `null` origin) and the production header set (QB.4) all send them. Nothing outside `/playground/` changes.

### 11.4 The parent

The parent never evaluates code, never inserts frame text as HTML, and validates every message (§5.1). The share fragment is decoded with size limits and treated as text. The playground adds no cookies and no storage keys, so the e2e suite's "no cookies, no storage" check stays as it is.

The privacy page stays true ("every page, font, image and demo is served from this site"; "the site itself stores nothing in your browser"). Its storage paragraph gains one sentence, in WEB.PLAY.9: the playground's preview cannot use browser storage, and an edit lives only in the page's address.

## 12. Dependencies

Exact versions, pinned in the owning repo's `package.json` and lockfile. A newer version needs the size budgets and the browser journeys run again.

| Package | Version | Licence | Repo, where | Role |
| --- | --- | --- | --- | --- |
| `codemirror` | 6.0.2 | MIT | site, editor chunk | basic setup |
| `@codemirror/lang-javascript` | 6.2.4 | MIT | site, editor chunk | TypeScript highlighting and indentation |
| `@codemirror/lint` | 6.9.7 | MIT | site, editor chunk | diagnostics |
| `@codemirror/state` | 6.7.6 | MIT | site, editor chunk | transactions (Reset), compartments |
| `@codemirror/view` | 6.43.15 | MIT | site, editor chunk | the view, line wrapping, content attributes |
| `sucrase` | 3.35.1 | MIT | site, compile worker | strips types, keeping lines; its browser bundle also carries `ts-interface-checker` 0.1.13 (Apache-2.0), `lines-and-columns` 1.2.4 (MIT) and `@jridgewell/*` (MIT) |
| `@babel/parser` | 8.0.10 | MIT | site, compile worker | parses the TypeScript for accurate syntax errors, the import check, the loop guard and the `import.meta.url` rewrite; its bundle carries `@babel/types` 8.0.10 (MIT) |
| `pixi.js` | 8.21.0 | MIT | framework, playground runtime | the umbrella's peer |
| `svelte` | 5.57.1 | MIT | framework, playground runtime | the default screens |
| `zod` | 4.6.6 | MIT | framework, playground runtime | the examples' import and the runtime's schemas |
| `effect` | 3.22.2 | MIT | framework, playground runtime | the runtime (ADR 0003) |
| `koota` | 0.6.6 | ISC | framework, playground runtime | the sim's ECS (ADR 0001) |
| `@ruken/sdk-host` | vendored `0.0.0` | MIT since RukenApp PR #396 (2026-10-30), once `vendor/ruken` is repacked (PLAY-D16) | framework, playground runtime | the in-memory fake host |

Versions and licences are as published on npm on 2026-10-30, and for the framework's packages as pinned in its `docs/versions.md`. The playground build's `manifest.json` lists every bundled package with the version and licence read from its installed `package.json`, so the site never types a licence by hand. The site's own `zod` (4.6.5, for its data schemas) is a separate copy in a separate document and never meets the runtime's.

Not chosen: Monaco and `@monaco-editor/react` (size, and mobile is unsupported); Sandpack and its hosted bundler (a third-party runtime service); `esbuild-wasm`, `@babel/standalone` and TypeScript's own transpiler (a full compiler is many times sucrase's size for a job that is only stripping types); lz-string (`CompressionStream` is built in).

## 13. Determinism stays visible

Ten of the 17 examples declare `Golden: <ticks>` (120 ticks: `core-input-gamepad`, `core-input-keys`, `core-input-rebind`, `core-saves`, `shapes-draw-hud`, `shapes-rects`, `textures-atlas`, `textures-sprite`; 180: `audio-sound`; 240: `core-leaderboard`). The framework's parity suite replays each in Node, Chromium, WebKit and Firefox and requires the hashes to match bit for bit.

The row under the preview says only what this browser checked:

| Code | Row |
| --- | --- |
| Unedited, golden passes | "Determinism: these 120 ticks replay in this browser to the golden recorded in the framework (`examples/__goldens__/shapes-rects.replay`, framework `<short ref>`). Hash `<hash>`." |
| Unedited, diverges | "Determinism: this browser diverged from the golden at tick N." shown as an alert. A divergence is a cross-engine bug to report, never something to re-record. |
| Edited | "Your edit: 120 ticks hash to `<hash>` in this browser. The golden belongs to the original code; agreement across engines is checked in the framework's CI." |
| No `Golden:` header | no row |

The hash is computed at runtime from the shipped `.replay` file or the run itself; none is written into the site's sources. The site does not claim the parity suite passed at `framework.ref` until the framework's evidence file records the example goldens (`evidence.json`, from the CI run of 2026-10-18, has none for the one-file examples); that is a request to the DX.9 evidence task, not part of this spec.

## 14. Tests and feedback

### 14.1 Allocation

| Layer | Where | Covers |
| --- | --- | --- |
| Unit (Vitest, Node) | site `tests/playground/*.test.ts` | `compileExample` (types stripped with lines kept; syntax diagnostic position; import rule; loop guard on every loop form, including a body that is not a block; `import.meta.url` rewrite and nothing else); share link (round trip, size limits, malformed input); orchestrator with a fake clock and fake frames (quiet period, latest `seq` wins, swap only on `running`, last good kept on every failure, both timeouts, wrong source, origin, shape or run id dropped, at most two frames); stack-line parsing in V8 and JavaScriptCore shapes |
| Unit (Vitest) | framework `tooling/examples-runner` | the protocol schemas; `Host:` settings to fake-host options; `playgroundFramePage` (CSP string, import map, hash matches the map's text); the manifest (every file listed with the right bytes and sha256) |
| DOM (Vitest, jsdom, Testing Library) | site | the example page shows the exact synced source (`tests/api-contract.test.ts` extended); no editor import before a tap, focus, Play or a share link; Reset only when edited; the toggle; status texts; reduced motion (`matchMedia` stub) blocks auto-run; accessible names |
| Real browser (Playwright, Chromium and WebKit, `af-mac`) | site `tests/e2e/playground.e2e.ts` | the journeys in §16: live update, syntax error, runtime error, hang, reset, share link, reduced motion, arrival requests, keyboard, layout at the four viewports, the code box size before and after the editor arrives, 44/48 px targets, preview size unchanged when only the viewport height changes, 50-edit soak |
| Real browser (Playwright, Chromium, WebKit and Firefox) | framework, a `playground` project serving `dist-playground` with the §11.3 headers | WEB.PLAY.1's feasibility checks; every catalog example reaches `running` in its frame with no CSP violation; `checkGolden` passes for all ten goldens in each engine |
| The existing gates | site | `pnpm check:site`, `tests/e2e/site.e2e.ts` (each new page joins the sitemap, so it gets the overflow, axe, cookie, storage, third-party, keyboard and dead-button gates), Lighthouse |
| Owner | — | visual acceptance of the example page at 375×667 and 1280×800 from the actual screenshots; on the Owner's phone, a typed change shows up with no button |

The site's e2e suite runs Chromium and WebKit, not Firefox; Firefox coverage of the frame comes from the framework's `playground` project.

### 14.2 Feedback workflow

- Each task starts with its smallest failing test (named in the task) and runs it alone first: `pnpm vitest run tests/playground/<file>` or `pnpm playwright test tests/e2e/playground.e2e.ts -g "<case>" --project=chromium`.
- Browser tests wait on `data-preview`, `data-run-id` and `data-code`, never on sleeps.
- A Playwright run reuses a built site only when its `static/playground/manifest.json` commit equals `framework.ref` and the build is newer than the last source change; otherwise rebuild.
- The latency budgets are recorded in the task's plan with the commit, browser version, throttling and the ten raw values; the median is computed from them, not typed.
- Full gates before merging any site task: `pnpm check`, `pnpm test`, `pnpm build`, `pnpm check:site`, `pnpm test:e2e`, `pnpm lighthouse`, on the `af-mac` CI. Framework tasks: `pnpm check` plus the `playground` Playwright project and the parity suites.

## 15. Ruken alignment

| Behaviour | Ruken contract |
| --- | --- |
| The frame's policy | `contentSecurityPolicy` in `@ruken/manifest` (vendored in the framework), with exactly the additions in §11.2; nothing redefines a Ruken directive |
| The host inside the frame | `createFakeHost` from `@ruken/sdk-host/testing`, Ruken's reference fake host, in its in-memory mode; capabilities, saves and denials follow its rules, so a denied capability stays denied (no silent switch to device storage) |
| Ruken compatibility of the examples | unchanged: the framework's `examples` and `examples-compact` Playwright projects serve each example under `compileHeaders` from `@ruken/manifest` |
| Messages | the playground protocol is AF's own and carries no Ruken message; the frame never talks to the SDK bridge through `postMessage` |

Nothing here needs a change in Ruken.

## 16. Acceptance cases

Each case passes in Chromium and in WebKit unless it says otherwise.

| ID | Success | Failure |
| --- | --- | --- |
| A-1 Live update | In `shapes-rects`, changing `0x00cdf9` to `0xff0000` puts red pixels (more than 100 within tolerance) into a screenshot of the preview within 1,000 ms of the last keystroke, median of 10, Chromium at 4× CPU; within 500 ms unthrottled. No button is pressed. | Any edit after the first run that needs a button to show; a slower median. |
| A-2 Runs on arrival | On a fresh page, with no input, the original reaches `running` and draws within 4,000 ms of navigation on simulated slow 4G and 4× CPU; the first edit then updates it live. | The preview stays on its poster without a press (except under reduced motion); a request under `/playground/` before `load`. |
| A-3 Syntax error | Adding the line `const broken = 1 +;` inside a system marks that line and names it in the status line within 400 ms; `data-run-id` does not change and the frame is not replaced; fixing it runs the fix. | The preview blanks, restarts or freezes; the wrong line is marked. |
| A-4 Import rule | `import _ from 'lodash'` marks that line with the import message; the preview keeps running. | A request for `lodash`; the preview changes. |
| A-5 Runtime errors | `throw new Error('x')` in `setup` shows "Line N: x" and keeps the running preview. A throw on a later tick shows "Stopped: line N: x" over the stopped preview; the next good edit runs. | A blank preview; a lost error; no line when the stack has one. |
| A-6 Hang | `while (true) {}` in a system: within 2 s the frame reports the loop and its line, the editor takes typing again, and the next good edit runs. | The tab stays frozen past 2 s; the loop runs on. |
| A-7 Boot timeout | A frame that never reports `running` is removed after 10 s with the timeout message; the running preview stays. | A spinner forever; the running preview removed. |
| A-8 Reset | Reset makes the editor's text equal the synced framework file byte for byte, removes the fragment and runs the original; Mod-Z brings the edit back. | Any difference from the synced file; Reset shown with no edit. |
| A-9 Share link | After an edit, opening `location.href` in a new browser context shows the edited code and runs it. A corrupted payload shows the original and the "could not be read" message; an oversized one is refused the same way. | A different text; an uncaught error; the decoded text treated as anything but text. |
| A-10 Determinism | Unedited `shapes-rects` shows "replay … to the golden"; edited shows "Your edit: … in this browser"; `core-basic-window` shows no row. | A pass claimed for edited code; a hash in `src/`. |
| A-11 Arrival | Loading `/examples` requests nothing under `/playground/`. An example page requests nothing under `/playground/` before `load`, and no editor chunk and no worker until a tap, focus or share link. Lighthouse and `check:site` pass on `/examples`, `/examples/core-basic-window` and `/examples/shapes-rects`. | Any of those requests early; a budget missed. |
| A-12 Sandbox | Inside the frame: `fetch('https://example.com/')` is blocked; `eval('1')` throws; `localStorage` throws; `parent.document` throws; setting `top.location` is blocked. The parent drops a message with the wrong source, origin, shape or run id. No cookies or storage keys after a session. | Any of those succeeds. |
| A-13 Reduced motion | With `reducedMotion: 'reduce'`, the poster and Play show, nothing under `/playground/` is requested, and an edit does not start the preview; after Play, the next edit updates it live. | A run or a `/playground/` request before Play. |
| A-14 Layout | 375×667: one column with the Preview toggle; 768×1024 and 1280×800: side by side with the preview sticky; 780×270: side by side within the height. No horizontal overflow; every control at least 44 px and Play 48 px; the code box the same size before and after the editor arrives; at phone width, changing only the viewport height leaves the preview's box and `data-run-id` as they were. | Overflow; a smaller target; a shift; a reload or resize of the game. |
| A-15 Keyboard and screen readers | Tab enters and leaves the editor with a visible ring and no trap; "/" types a slash in the editor; the editor and frame have their accessible names; axe has no violations at 375 and 1280. | A trap, a missing ring or name, an axe violation. |
| A-16 Soak | Fifty edits in a row never leave more than two frames and settle at one; no console errors. | A third frame; a leaked frame; a console error. |
| A-17 Every example | Each of the 17 catalog examples runs in the playground with no CSP violation in Chromium, WebKit and Firefox (framework `playground` project). | Any example that fails or needs a looser policy. |
| A-18 Owner | The Owner accepts the page at phone and desktop sizes from the actual screenshots, and on their own phone sees a typed change appear with no button. | — |

## 17. Tasks

PR-sized, each test-first: the named failing test is written and seen to fail for the stated reason before the change. Framework tasks follow the framework's process (TDD in `tooling/`, its changesets rule, its master delivery plan); the integration lane owns them. When this spec is approved, these rows join the framework's `docs/02-master-delivery-plan.md`, the only task list.

| ID | Repo, lane | Delivers | First failing test | Depends on |
| --- | --- | --- | --- | --- |
| WEB.PLAY.0 | site | This spec, reviewed | — | — |
| WEB.PLAY.1 | framework, integration | Feasibility proof in a `playground` Playwright project (Chromium, WebKit, Firefox): a test frame page under the §11.2 policy in a `sandbox="allow-scripts"` frame loads site modules (`'self'` resolves to the site), the import map resolves bare imports inside a Blob module, `eval` and another-origin `fetch` are refused, the §11.3 headers are needed and sufficient, and whether a second fresh frame reuses the HTTP cache (the R-1 measurement, recorded with its numbers) | "a Blob module in an opaque-origin frame imports `zod` through the import map", failing because no frame page exists | WEB.PLAY.0 |
| WEB.PLAY.2 | framework, integration (game lane reviews `runGame` use) | The protocol module, `frame.js`, the harness (`runExample`, `checkGolden`, `hashRun`, `isDefinedGame`), the loop guard, error capture with lines, `playgroundFramePage` | "`shapes-rects` posts `running` in its frame", then one test per message and per failure in §7.2 | WEB.PLAY.1, PLAY-D11 |
| WEB.PLAY.3 | framework, integration | `build:playground`: one Vite build to `dist-playground/` (§5.5) with the catalog file, manifest (sha256, bytes, licences, commit), the import map and policy hash; a size test at 460 kB gzip; all 17 examples pass A-17 | "the manifest lists every file in `dist-playground` with its sha256", failing because the build does not exist | WEB.PLAY.2, PLAY-D16 |
| WEB.PLAY.4 | site | `scripts/sync-playground.ts` and a sync that works against framework `main`: `RAW_DEMOS` cut to the bundles still used (`base-2d`, the workshop), `prepareDemoHosting`'s `boot-and-flow` copy removed, `framework.ref` moved to a commit with WEB.PLAY.3, the protocol copy and its identity test, `compileExample` (§5.2, the pure function; the worker comes in WEB.PLAY.7) and the precompiled originals in `static/playground/compiled/`, the §11.3 headers in `serve-static.ts` and the Vite dev server; `builtPages`, `readFontFaces` and the sitemap leave `playground/` out, as they leave `demos/` out (frame pages are not site pages) | "`static/playground/manifest.json` names the commit in `framework.ref`", and "`serve-static` answers `/playground/runtime/x.js` with `access-control-allow-origin: *`" | WEB.PLAY.3 |
| WEB.PLAY.5 | site | `/examples` index and the prerendered `/examples/<id>` pages from `examples.json`; static code (exact source); the preview running the precompiled original on arrival (PLAY-D1), the reduced-motion poster with Play, the orchestrator's frame handling, timeouts and message checks; the old gallery tests (`examples.test.ts`, `examples-gallery.test.ts`, `source-explorer.test.ts`, `demo-navigation.test.ts`) rewritten for the new pages; old `?demo=` links land on the index; Lighthouse gains `/examples/core-basic-window` and `/examples/shapes-rects` | "an example page starts the original after `load` with no input", "with reduced motion an example page requests nothing under `/playground/` before Play" and "the orchestrator drops a message whose origin is not `null`" | WEB.PLAY.4 |
| WEB.PLAY.6 | site | The editor: CodeMirror on first tap or focus, caret at the tap, the same box (§9.3), accessible name, focus ring, no Tab binding, 16 px text, line wrapping; the editor-load failure state; the bytes budget in `check:site` (editor chunk never preloaded, at most 175 kB gzip) | "the code box keeps its size when the editor replaces the static code" (real browser) | WEB.PLAY.5 |
| WEB.PLAY.7 | site | Live updates: the compile worker (§5.2) around WEB.PLAY.4's `compileExample`, the quiet period, latest-wins, the double-buffered swap, syntax and import diagnostics at their lines with the last good preview kept, an edit before the first run replacing it, the reduced-motion rule | A-1's journey, failing because an edit changes nothing | WEB.PLAY.6 |
| WEB.PLAY.8 | site | Failure and recovery: runtime errors at boot and while running with their lines, the hang message, the boot timeouts, the worker-failure and offline states with Retry | one test per row of §7.2 not covered by WEB.PLAY.7, starting with A-6 | WEB.PLAY.7 |
| WEB.PLAY.9 | site | Reset (undoable), the share link (§5.6) with Copy link, opening a link (F9), the privacy page sentence | A-9's round trip, failing because the URL carries nothing | WEB.PLAY.7 |
| WEB.PLAY.10 | site | The determinism row (§13) | A-10, failing because no row exists | WEB.PLAY.7 |
| WEB.PLAY.11 | site | The responsive and input pass, measured evidence and acceptance: the four layouts and the toggle, 44/48 px checks, compact height, the 50-edit soak, the latency table on `af-mac`, the Lighthouse run, then the Owner's visual and phone checks | A-14's "changing only the viewport height leaves the preview as it was" at 375 px | WEB.PLAY.8, .9, .10 |

WEB.PLAY.8, .9 and .10 can run in parallel after WEB.PLAY.7. WEB.PLAY.6's editor work can start against a fixture page while the framework tasks run, but merges after WEB.PLAY.5.

## 18. Decisions (recommended defaults, for the Owner's veto)

| ID | Question | Recommended default | Alternatives |
| --- | --- | --- | --- |
| PLAY-D1 | When does the first run start? | **Owner, 2026-10-30:** an example runs as soon as its page opens and updates live on every edit (300 ms quiet period); with reduced motion a still poster shows and a Play control starts it. The frame starts after `load` and when the preview is near the screen (F1, R-9). | (The draft's default, superseded: on the first edit or on Play, never on arrival.) Run on first focus (spins up WebGL for a reader who only tabbed through). |
| PLAY-D2 | Which editor, and how smart? | CodeMirror 6, self-hosted, syntax highlighting and diagnostics, no type checking or AF completions in v1. Completions from the framework's generated API index can be a follow-up. | Monaco with TypeScript as pixijs.com has (≈ 2.2 MB gzip with its worker, mobile unsupported). |
| PLAY-D3 | How is code compiled? | In a worker: Babel's parser for errors and the checks, sucrase to strip the types; an import map to the framework's prebuilt bundles; no bundler. | Sandpack with its hosted bundler; esbuild-wasm; sucrase alone (72 kB gzip lighter, but it puts an error inside a system at the system's first line). |
| PLAY-D4 | Where does the code run? | An opaque-origin sandbox (`allow-scripts` only) on the site's own origin, one generated frame page per example, the §11.2 policy, the §11.3 headers. | A same-origin frame (a shared link would run as the site); a separate preview origin (a third-party origin to the gates and the privacy page). |
| PLAY-D5 | How does a change replace the running example? | A fresh frame per run, booted under the current one and swapped in when it draws, if WEB.PLAY.1 shows warm frames meet the 1,000 ms budget. If they do not (R-1), one frame per visit that shuts the previous run down and starts the next. | Always reuse one frame (faster, but anything a shutdown leaves behind accumulates over a session). |
| PLAY-D6 | How long after typing stops? | 300 ms. | 500 ms, as pixijs.com. |
| PLAY-D7 | Keep game state across edits? | No: every change restarts from tick 0 with the seed, which keeps runs deterministic and the golden comparison meaningful. | Hot-swap systems into a running sim (new framework work, and state that no longer matches its code). |
| PLAY-D8 | Where does an edit live? | Only in the URL fragment, compressed; nothing in browser storage, nothing on a server. The privacy page stays true. | `localStorage` drafts (needs the privacy page changed and breaks the e2e storage gate); a paste service (a server and a privacy change). |
| PLAY-D9 | Page shape? | `/examples` is an index of the catalog; each example is a prerendered `/examples/<id>` page with the list beside it, as pixijs.com does. The code is in the HTML, so it reads without JavaScript and every example has its own address. | One `/examples?example=<id>` page as today. |
| PLAY-D10 | Which pages get the playground? | The example pages only. The folder demos leave `/examples` as EX.4 retires them; Emberwick stays on `/` and `/showcase` with `DemoRunner`; `/start` keeps teaching the local loop. | The home page hero as a playground too. |
| PLAY-D11 | How does the harness give the example a fake host? | Inside `tooling/examples-runner` (unpublished), call the runtime's `runGame` with `seams.sdkEnv`, as the framework's own tests do; no public API change. The game lane reviews it in WEB.PLAY.2. | A public `startGame(game, { host })` option (a new published API, Owner review). |
| PLAY-D12 | Plus examples? | Not in the playground until D-7 decides how Plus is shown. | Show them read-only now. |
| PLAY-D13 | Order against M10.0? | Build it now, under this direction; the M10.0 website spec takes this spec as its examples section. | Wait for M10.0. |
| PLAY-D14 | Phone portrait layout? | Preview above the code, a Preview toggle to hide and show it without resizing the game; side by side from 700 px. | Editor or preview, one at a time, as pixijs.com does. |
| PLAY-D15 | When does the loop guard stop a loop? | When one stretch of synchronous work has been running loops for 1,000 ms without returning to the event loop. | 500 ms (stops slow but legitimate setup on a slow phone); none (an infinite loop freezes the tab). |
| PLAY-D16 | May the public site serve Ruken's fake host? | **Approved (Owner, 2026-10-30).** The playground bundles `createFakeHost` from the vendored `@ruken/sdk-host` (39 kB built). The Owner made Ruken's `sdk`, `sdk-host`, `manifest` and `cli` MIT on 2026-10-30 (RukenApp PR #396), and the framework's coordinator repacks `vendor/ruken` from that release; WEB.PLAY.3's manifest reads the licence from the repacked `package.json`. | A small host written in the framework instead (it would redefine Ruken behaviour, against "Ruken first"); no host (`core-saves`, `core-leaderboard` and `core-host-lifecycle` lose their saves and scores in the playground). |

## 19. Risks

| ID | Risk | Check | If it bites |
| --- | --- | --- | --- |
| R-1 | A browser does not reuse its HTTP cache for an opaque-origin frame, so every fresh frame downloads and compiles the runtime again. | WEB.PLAY.1 measures a second frame's requests and time in Chromium and WebKit with the §11.3 cache headers. | PLAY-D5's fallback: one frame per visit with in-frame restarts, plus a fresh frame on Reset, on switching examples and after a failure. |
| R-2 | `'self'` in a meta policy does not match the site inside an opaque-origin document in one engine. | WEB.PLAY.1, first test. | The frame page's policy names the origin explicitly: written by the framework build from the site's origin, with the test server's origin in a test-only build. |
| R-3 | WebKit refuses `import()` of a Blob URL created in an opaque origin. | WEB.PLAY.1. | A `data:` module URL (`script-src data:` in the frame policy only), with the same `import.meta.url` rewrite. |
| R-4 | The frame shares the page's main thread, so a hang the guard cannot see (no loop) freezes the editor too. | WEB.PLAY.8 records which engines run the frame in its own process. | Accepted for v1; the boot timeout and the guard cover the common cases. |
| R-5 | A new WebGL context per run on a phone; Safari limits live contexts. | The A-16 soak in WebKit. | At most two contexts live by design; the R-1 fallback reuses one. |
| R-6 | A `new Function` path in the full `zod` facade that nobody has traced yet surfaces under the no-eval policy. | A-17 in all three engines. | A framework fix (as no-eval did for Pixi and Zod's JIT); never `'unsafe-eval'` in the frame. |
| R-7 | The production host is undecided and may not send the §11.3 headers. | QB.4's header set lists them; DX.12's deploy check requests one `/playground/runtime/` file with `Origin: null`. | The playground cannot ship to production until it does. |
| R-8 | The re-sync to framework `main` changes more of the site than the examples (docs, stack page, evidence, the Emberwick bundle). | WEB.PLAY.4 runs `pnpm sync` as a whole and reviews the diff. | Split a plain re-sync PR out of WEB.PLAY.4, as QB.3g did. |
| R-9 | Running on arrival (PLAY-D1) adds the runtime's download and WebGL start to every example page, which can cost TBT and LCP on a mid phone, as the folder demos did (QB.3h, 8.8 s of TBT). The frame shares the page's process in some engines. | Lighthouse on `/examples/core-basic-window` and `/examples/shapes-rects` in WEB.PLAY.5, with the frame running. | Start the frame on the first idle callback after `load` as well, and keep the poster as the LCP element; if the budget still fails, the evidence goes to the Owner with the measured numbers before any budget changes. |

## 20. Sources

**PixiJS** (read 2026-10-30 from the `main` branch of `pixijs/pixijs.com` on GitHub):
`package.json`; `src/components/Editor/Editor.tsx`, `Sandpack/Layout.tsx`, `Monaco/MonacoView.tsx`, `Monaco/usePixiDefinitions.ts`, `PlaygroundEditor.tsx`, `ExampleEditor.tsx`, `EmbeddedEditor.tsx`; `src/components/Playground/PixiPlayground/index.tsx`, `useSandpackConfiguration.ts`, `useEditorCode.ts`, `usePlaygroundURLState.ts`, `usePixiVersions.ts`, `MonacoEditor.tsx`; `src/pages/examples/index.tsx`; Sandpack's `LICENSE` (Apache-2.0) and its guide to hosting the bundler (`sandpack.codesandbox.io/docs/guides/hosting-the-bundler`). The pixijs.com repository states no licence of its own. Not verified there: Sandpack's default options, its error overlay, bundle sizes, and where `@monaco-editor/react` loads Monaco from.

**AF website** (`5cd8fd4`): `src/routes/examples/+page.svelte`, `+page.ts`; `src/lib/components/DemoRunner.svelte`, `SourceExplorer.svelte`, `CodeBlock.svelte`; `src/lib/utils/demo-status.ts`, `keyboard.ts`; `src/lib/hydration.ts`, `preloads.ts`; `scripts/site-checks.ts`, `sync-demos.ts`, `framework-source.ts`, `serve-static.ts`; `lighthouserc.json`; `src/app.css`; `src/routes/privacy/+page.svelte`; `tests/e2e/site.e2e.ts`, `gates.ts`; `tests/examples-gallery.test.ts`, `api-contract.test.ts`, `audit-regressions.test.ts`.

**AF framework** (`b7ef19d9`): `tooling/examples-runner/src/catalog.ts`, `header.ts`, `page-template.ts`, `examples.parity.test.ts`, `host/preview-headers.ts`; `examples/**` (the 17 examples, `__goldens__`, `resources`, `public`); `packages/automata/package.json`; `packages/game/src/define-game.ts`; `packages/runtime/src/boot/boot-program.ts`, `page-layers.svelte.ts`; `packages/testing/src/sim/replay-golden.ts`; `vendor/ruken/ruken-manifest-0.0.0.tgz` (`contentSecurityPolicy`, `compileHeaders`); `docs/versions.md`; the EX spec; `docs/01-decomposition.md` §5; `docs/02-master-delivery-plan.md` (M10.0, EX rows).

**Measurements:** the 2026-10-30 Vite 8 build of the framework's playground runtime and the editor comparison (CodeMirror, sucrase, Monaco 0.52.2), whose config is kept outside both repos; the sucrase and `@babel/parser` sizes, sucrase's line preservation, both parsers' error locations and the timings in this spec, measured the same day with esbuild 0.25.12 and Node 24.21.0 (acorn 8.19.0 was measured too, 34,476 B gzip, and dropped once Babel was needed for the error lines); npm registry metadata for every version and licence in §12.
