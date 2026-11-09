---
name: automata-verify
description: How to run automata check, read its --json report, and fix each rule it reports (boundaries, typecheck, tests, boards, orientation, inputs, levels, no-eval, data URLs, CSP). Use when automata check or the Automata hook reports findings.
---

# Running and reading `automata check`

`automata check` runs the game's own tools in order and reports every problem in one shape. Run it from the game
folder (or pass the folder): `automata check [dir] [--json] [--sim-only] [--csp] [--fail-fast] [--only <step>]`.

| Step | Runs | Skipped when |
|---|---|---|
| `boundaries` | `automata-check-boundaries --game src` (the sim files: every file with a sim suffix, and what they import) | never |
| `typecheck` | `tsc -p . --noEmit` | never |
| `test` | `vitest run` | never |
| `boards` | the leaderboards the sources name, against `ship.config.ts`'s `leaderboards` | `--sim-only` |
| `orientation` | the `orientation` each `defineGame` plays in, against `ship.config.ts`'s `runtime.orientation` | `--sim-only` |
| `inputs` | the devices the sources' `keys()` calls bind, against `ship.config.ts`'s `runtime.inputs` | `--sim-only` |
| `levels` | each level project the editor list's `exports` rows name, exported again and compared with the game files on disk | `--sim-only`, or a game with no such row |
| `no-eval` | `vite build`, then a scan of `dist/**/*.js` | `--sim-only` |
| `data-urls` | a scan of the `dist/**/*.js` that `no-eval` built for assets Vite inlined as `data:` URLs | `--sim-only` |
| `csp` | serves `dist/` with Ruken's Content-Security-Policy and loads it in Chromium until the game is ready | unless `--csp` |

Every step runs even after one fails, so one run shows everything; `--fail-fast` stops at the first failing step, and
`--only <step>` runs just the one named.

## Reading `--json`

```json
{ "ok": false, "steps": [{ "name": "boundaries", "ok": false, "ms": 41,
  "findings": [{ "file": "src/features/jump/jump.system.ts", "line": 3, "col": 1, "rule": "import",
                 "message": "import of \"effect\" is not allowed in the sim" }] }] }
```

- `ok` is true only when every step that ran passed. Only the steps that ran are listed.
- Each finding has a `file` (relative to the game, empty when the problem has no file), `line`, `col`, `rule` and
  `message`. Fix findings at their location; the `rule` says which kind of fix, below.
- **Exit codes:** 0 pass; 1 findings to fix in the code; 2 a tool could not run (fix the setup it names, not the code).
  A missing tool is never a pass.

The Automata plugin runs `automata check --sim-only --json` after each edit to a sim file, and `automata check --json`
when the turn would end. Its message is this JSON. Fix every finding, then let the check run again; never
delete or skip a test, loosen a rule or re-record a golden to get past it.

## Rules and fixes

### `boundaries` (the sim's determinism rules, and koota's CSP rule)

| Rule | Means | Fix |
|---|---|---|
| `import` | The sim imports something outside its allowlist (Effect, DOM libraries, Node modules, another layer of the game) | Import only `@automata/sim` (and `/math`, `/hash`), `zod`, the physics entry points, or relative sim files. Move I/O or Effect code out of the sim files (and what they import) and pass results in as commands or content |
| `banned-global` | A host or clock global such as `Date`, `setTimeout`, `console`, `window`, `fetch`, `crypto`, `performance`, `Intl` | Time is `ctx.tick`; randomness is the sim's seeded RNG; logging and I/O belong outside the sim |
| `banned-member` | `.constructor` on a value, which reaches `Function` | Don't build code from strings; call the function directly |
| `math-member` | A `Math` member outside `sqrt`, `fround`, `round`, `floor`, `ceil`, `trunc`, `abs`, `min`, `max`, `sign`, `imul` (including `Math.random`) | Use `@automata/sim/math` for the rest, and the sim's RNG for random numbers |
| `pow-operator` | `**`, which is not bit-exact across engines | Multiply, or use the sim math module |
| `key-enumeration` | `Object.keys`/`values`/`entries`, `for…in`, or a computed member on them, whose order can differ | `sortedKeys` / `sortedEntries` from `@automata/sim` |
| `locale` | `localeCompare`, `toLocaleString` and similar, which depend on the engine's locale data | Compare and format explicitly |
| `koota-soa` | koota's `trait` or a `relation` store given an object schema (or one the checker cannot see), which koota compiles with `new Function`; Ruken's CSP refuses it | Use `defineComponent` from `@automata/sim`, or pass koota a factory: `trait(() => ({ x: 0 }))`, `relation({ store: () => ({ amount: 0 }) })` |
| `platform-import` | A distribution target's platform package (`@ruken/*`, `@tauri-apps/*`) imported outside a folder named for that target (`ruken/`, `tauri/`); run with `--platform-imports` | Use AF's own API instead (the message names it: `@automata/framework` for host types, `@automata/framework/testing` for a fake host, `@automata/content/game-config` for the game config), or move the file under the target's folder |
| `feature-import` | In a package laid out by feature (`src/features/<x>/`), a feature imports another feature; run with `--features` | Pass what it needs in from `app/`, or move the shared part to `shared/` |
| `shared-import` | A file in `shared/` imports a feature, `app/` or `entries/`; run with `--features` | Move what it needs into `shared/`, or move the file into the feature that owns it |
| `app-import` | A feature imports `app/`; run with `--features` | Only `entries/` and `testing/` import `app/`: pass the value in from `app/` instead |
| `entries-import` | A feature, `shared/` or `app/` file imports `entries/`, the published surface; run with `--features` | Import the module the entry re-exports |
| `entries-logic` | A file in `entries/` holds code instead of only re-exporting; run with `--features` | Move the code into `app/`, `features/` or `shared/` and re-export it |
| `testing-import` | Product code imports `testing/`, the published test helpers; run with `--features` | Only `entries/` re-exports `testing/`; keep test helpers out of product code |
| `shared-island` | A folder of `shared/` named with `--shared-island` (the editor's `kit`) imports a sibling folder of `shared/`; run with `--features` | Pass what it needs in as an argument, or move the file it imports into the island |
| `alias-in-src` | A `#src/…` import in `src/`, where only tests use the alias; run with `--features` | Import by relative path |
| `browser-import` | A file a browser entry reaches imports `effect`, a Node built-in or a Node-only library; run with `--browser` | Effect and Node's modules belong to the Node tooling package (ADR 0003); keep them out of browser code |
| `forbidden-import` | A source, test or Svelte file under a package imports a package it may not use (`--forbid <package-root>:<package>,…`; the editor package refuses 3D) | Take the import out, or pass the value in from a package that may use it |
| `parse-error` | The file could not be parsed | Fix the syntax error at the location |

### `typecheck`

Findings use the compiler's code as the rule (`TS2322`, `TS2304`, …) with its message. Fix the type error. A file-less
`TS5083`-style finding means `tsconfig.json` itself is missing or broken.

### `test`

| Rule | Means | Fix |
|---|---|---|
| `test` | A test failed; the message is the test name and the first line of its failure | Fix the code under test. If a golden hash changed, find which behavior changed it |
| `test-file` | A test file failed outside any test (often an import error) | Fix the import or the setup code the message names |

### `boards` (every leaderboard named must be declared)

| Rule | Means | Fix |
|---|---|---|
| `undeclared-board` | A `scores` entry, `submitScore` or `readBoard` names a board `ship.config.ts` does not declare under `leaderboards` | Declare the board (`order`, `min`, `max`), or fix the name's spelling |

### `orientation` (the game and the ship config must agree)

| Rule | Means | Fix |
|---|---|---|
| `orientation-mismatch` | A `defineGame` plays in an `orientation` other than `ship.config.ts`'s `runtime.orientation` (a `defineGame` that leaves it out plays `any`), so the rotate hint and Ruken's frame disagree | Make the two agree. Only string literals are read: write both as literals to have them checked |

### `inputs` (the manifest declares every device the game binds)

| Rule | Means | Fix |
|---|---|---|
| `inputs-mismatch` | `runtime.inputs` has no `gamepad` but a `keys()` call binds pad buttons, or declares `touch` while no `keys()` call makes a touch button or a gesture. The finding points at the `inputs` array and its message names the call | Add the device to `runtime.inputs`, or take the binding out. Only literals in a `keys(command, bindings, options)` call are read; a binding built elsewhere is left to the game's own test |

### `levels` (a level project and its game files must agree)

| Rule | Means | Fix |
|---|---|---|
| `levels` | A game file under a row's `exports` folder (`project.toml`, `world.toml`, `levels/<id>.toml`) is not what its level project exports, or is missing, or the project does not open | Open the level in the editor and press Save: it writes the project and every game file together. Never edit the generated TOML by hand |

### `no-eval` (Ruken's CSP has no `unsafe-eval`)

| Rule | Means | Fix |
|---|---|---|
| `eval` | `eval(…)` in the built bundle | Remove it; find the dependency that does it if it isn't yours |
| `function-constructor` | `Function(…)` or `new Function(…)` compiling code at runtime | Import `@automata/framework/no-eval` first in the entry; replace other code generators |
| `string-timer` | `setTimeout`/`setInterval` given a string | Pass a function |
| `build` | `vite build` failed, so nothing could be scanned | Fix the build error in the message |
| `parse-error` | A built file could not be scanned | Report it; the build produced something the scanner can't read |

### `data-urls` (assets ship as files)

| Rule | Means | Fix |
|---|---|---|
| `data-url` | Vite inlined an asset under `build.assetsInlineLimit` (4 kB by default) as a `data:` URL for a `new URL('./file', import.meta.url)`. Pixi's texture and JSON loaders and AF's audio fetch it, and Ruken's CSP has no `data:` in `connect-src` or `media-src`, so the fetch is refused and the asset never loads. An inlined font is not reported: Pixi loads it through `FontFace`, under `font-src`, which allows `data:` | Set `build.assetsInlineLimit: 0` in `vite.config.ts` (the content Vite plugin and `create-game` set it), so the asset ships as a file from the game's own origin |
| `build` | `vite build` failed, or `no-eval` could not run or read `dist/`, so nothing was scanned | Fix what `no-eval` reports |

### `csp` (with `--csp`)

| Rule | Means | Fix |
|---|---|---|
| `csp-violation` | The page did something Ruken's Content-Security-Policy blocks (eval, an inline script, a remote origin) | Remove what the message names; load assets from the game's own files |
| `boot-failed` | The game reached its failed state | Read the boot error the page shows and fix its cause |
| `not-ready` | The game never reported ready within 20 s | The boot hangs: check the entry point and the host handshake |

### Setup (exit 2)

| Rule | Means | Fix |
|---|---|---|
| `tool-missing` | A tool the step needs isn't installed in the game; the message says what to install | Install it as a dev dependency, then run again |
| `tool-error` | A tool ran but failed in a way that isn't a finding (crashed, bad config) | Read the tool output in the message and fix the setup |
