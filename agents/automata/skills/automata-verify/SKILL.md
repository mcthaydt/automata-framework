---
name: automata-verify
description: How to run automata check, read its --json report, and fix each rule it reports (boundaries, typecheck, tests, boards, orientation, inputs, no-eval, data URLs, CSP). Use when automata check or the Automata hook reports findings.
---

# Running and reading `automata check`

`automata check` runs the game's own tools in order and reports every problem in one shape. Run it from the game
folder (or pass the folder): `automata check [dir] [--json] [--sim-only] [--csp] [--fail-fast]`.

| Step | Runs | Skipped when |
|---|---|---|
| `boundaries` | `automata-check-boundaries src/sim` | never |
| `typecheck` | `tsc -p . --noEmit` | never |
| `test` | `vitest run` | never |
| `boards` | the leaderboards the sources name, against `ship.config.ts`'s `leaderboards` | `--sim-only` |
| `orientation` | the `orientation` each `defineGame` plays in, against `ship.config.ts`'s `runtime.orientation` | `--sim-only` |
| `inputs` | the devices the sources' `keys()` calls bind, against `ship.config.ts`'s `runtime.inputs` | `--sim-only` |
| `no-eval` | `vite build`, then a scan of `dist/**/*.js` | `--sim-only` |
| `data-urls` | a scan of the `dist/**/*.js` that `no-eval` built for assets Vite inlined as `data:` URLs | `--sim-only` |
| `csp` | serves `dist/` with Ruken's Content-Security-Policy and loads it in Chromium until the game is ready | unless `--csp` |

Every step runs even after one fails, so one run shows everything; `--fail-fast` stops at the first failing step.

## Reading `--json`

```json
{ "ok": false, "steps": [{ "name": "boundaries", "ok": false, "ms": 41,
  "findings": [{ "file": "src/sim/jump.system.ts", "line": 3, "col": 1, "rule": "import",
                 "message": "import of \"effect\" is not allowed in the sim" }] }] }
```

- `ok` is true only when every step that ran passed. Only the steps that ran are listed.
- Each finding has a `file` (relative to the game, empty when the problem has no file), `line`, `col`, `rule` and
  `message`. Fix findings at their location; the `rule` says which kind of fix, below.
- **Exit codes:** 0 pass; 1 findings to fix in the code; 2 a tool could not run (fix the setup it names, not the code).
  A missing tool is never a pass.

The Automata plugin runs `automata check --sim-only --json` after each edit under `src/sim/`, and `automata check
--json` when the turn would end. Its message is this JSON. Fix every finding, then let the check run again; never
delete or skip a test, loosen a rule or re-record a golden to get past it.

## Rules and fixes

### `boundaries` (the sim's determinism rules)

| Rule | Means | Fix |
|---|---|---|
| `import` | The sim imports something outside its allowlist (Effect, DOM libraries, Node modules, another layer of the game) | Import only `@mcthaydt/automata-sim` (and `/math`, `/hash`), `zod`, the physics entry points, or relative sim files. Move I/O or Effect code out of `src/sim/` and pass results in as commands or content |
| `banned-global` | A host or clock global such as `Date`, `setTimeout`, `console`, `window`, `fetch`, `crypto`, `performance`, `Intl` | Time is `ctx.tick`; randomness is the sim's seeded RNG; logging and I/O belong outside the sim |
| `banned-member` | `.constructor` on a value, which reaches `Function` | Don't build code from strings; call the function directly |
| `math-member` | A `Math` member outside `sqrt`, `fround`, `round`, `floor`, `ceil`, `trunc`, `abs`, `min`, `max`, `sign`, `imul` (including `Math.random`) | Use `@mcthaydt/automata-sim/math` for the rest, and the sim's RNG for random numbers |
| `pow-operator` | `**`, which is not bit-exact across engines | Multiply, or use the sim math module |
| `key-enumeration` | `Object.keys`/`values`/`entries`, `for…in`, or a computed member on them, whose order can differ | `sortedKeys` / `sortedEntries` from `@mcthaydt/automata-sim` |
| `locale` | `localeCompare`, `toLocaleString` and similar, which depend on the engine's locale data | Compare and format explicitly |
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

### `no-eval` (Ruken's CSP has no `unsafe-eval`)

| Rule | Means | Fix |
|---|---|---|
| `eval` | `eval(…)` in the built bundle | Remove it; find the dependency that does it if it isn't yours |
| `function-constructor` | `Function(…)` or `new Function(…)` compiling code at runtime | Import `@mcthaydt/automata-render-pixi/no-eval` first in the entry; replace other code generators |
| `string-timer` | `setTimeout`/`setInterval` given a string | Pass a function |
| `build` | `vite build` failed, so nothing could be scanned | Fix the build error in the message |
| `parse-error` | A built file could not be scanned | Report it; the build produced something the scanner can't read |

### `data-urls` (assets ship as files)

| Rule | Means | Fix |
|---|---|---|
| `data-url` | Vite inlined an asset under `build.assetsInlineLimit` (4 kB by default) as a `data:` URL for a `new URL('./file', import.meta.url)`. Ruken's CSP has no `data:` in `connect-src` or `media-src`, so the loader's fetch is refused and the asset never loads | Set `build.assetsInlineLimit: 0` in `vite.config.ts` (the content Vite plugin and `create-game` set it), so the asset ships as a file from the game's own origin |
| `build` | `vite build` failed, so nothing was scanned | Fix the build error `no-eval` reports |

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
