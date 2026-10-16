# DX.6: `automata check` TDD plan

- **Spec:** [DX spec](../specs/2026-10-16-dx-small-games-ai-native-design.md) §3.6, §4 (owner: `packages/cli`, integration), §6 (tool missing → exit 2), §8 (unit layer); [PRODUCT spec](../specs/2026-10-16-product-core-and-plus-design.md) F3 (style step).
- **Status:** drafted 2026-10-16; DX.0 Owner-approved 2026-10-16.
- **Progress:** 6 of 8 steps.

## Global constraints

- **Strict TDD** in `packages/cli`: failing test first, confirm the reason, minimal change, green.
- **Effect outside the sim** (ADR 0003): processes through `ProcessRunner`, files through `Files` (`@mcthaydt/automata-node`), the browser probe through a `CspProbe` service; all three are injected with fakes in unit tests. Step time comes from Effect's `Clock`.
- **No new published package.** `packages/cli` is `private: true` (not in `tooling/release`'s list), so no changeset.
- **Fixtures are written by the tests** (strings, into temp folders), because `biome` would reject `eval` in a checked-in fixture file.
- **Example path in one place:** the integration run is the cli's `check:example` script. `examples/base-2d` is the game on `main` today; EX.2 moves it to `games/emberwick`, and only that script changes.

## Behavior (spec §3.6, made exact)

`automata check [dir] [--json] [--sim-only] [--csp] [--fail-fast]`, `dir` defaulting to the working folder.

| Step | Runs (the game's own tool, found in `node_modules/.bin` from `dir` upwards) | Finding source |
|---|---|---|
| `boundaries` | `automata-check-boundaries src/sim` | its `file:line:col  rule  message` lines |
| `typecheck` | `tsc -p . --noEmit --pretty false` | `file(line,col): error TSnnnn: message` lines |
| `test` | `vitest run --reporter=json --outputFile=node_modules/.cache/automata-check/vitest.json --includeTaskLocation` | failed assertions (with location) and failed files (import errors) from the JSON report |
| `no-eval` (not with `--sim-only`) | `vite build`, then an AST scan (oxc-parser) of `dist/**/*.js` | `eval(…)`, `(0, eval)(…)`, `window/globalThis/self.eval(…)`, `Function(…)`, `new Function(…)`, `setTimeout`/`setInterval` whose first argument is a string or template literal; a failed build is a `build` finding |
| `csp` (only with `--csp`) | serve `dist/` with `compileHeaders(manifest, 'local')` (manifest from the game's `ship.config.ts` through ship's `rukenToml` + `checkManifest`), open it in the game's Playwright Chromium | a `securitypolicyviolation`, `<html data-state="failed">`, or no `data-state="ready"` within 20 s |

- **Steps listed:** the JSON lists only the steps that ran (skipped by `--sim-only`, not asked for with `--csp`, or after a failure with `--fail-fast` are absent).
- **JSON:** exactly `{ ok, steps: [{ name, ok, ms, findings: [{ file, line, col, rule, message }] }] }`. A tool error is a step with `ok: false` and one finding whose rule is `tool-missing` (with what to install) or `tool-error` (with the tool's output).
- **Exit codes:** 2 if any step had a tool error; else 1 if any step has findings; else 0. A missing tool is never a pass.
- **No-eval allowlist** (`no-eval-allowlist.ts`): an entry matches a `Function(…)` call by its exact parameter-name literals and its body (an exact literal, or any expression for a generator); a probe must also sit inside a `try` block. Entries, measured on the `examples/base-2d` build at `71c3410` (the first scan found 8 calls there and 0 in the placeholder): Pixi's `unsafeEvalSupported` and Zod 4's `allowsEval` probes; Pixi's four code generators, which `pixi.js/unsafe-eval` (imported by `no-eval`) replaces; koota's SoA accessors, which AF's AoS components never reach. Known limits: an alias (`const F = Function; new F(…)`, as in Zod's `Doc.compile`) is not seen, and a game creating koota SoA traits directly passes the scan. The `csp` step is the runtime check for both.
- **Style (PRODUCT F3):** `tooling/check-style` is `private` with no bin, so a game cannot run it. No `style` step; the gap is recorded in 02 as a follow-up. DX §3.6 and PRODUCT F3 disagree until it is published.

## Files

- **Create** (`packages/cli/`):
  - `src/check/check-args.ts`, `check-args.test.ts`;
  - `src/check/check-report.ts`, `check-report.test.ts`;
  - `src/check/no-eval-scan.ts`, `no-eval-allowlist.ts`, `no-eval-scan.test.ts`;
  - `src/check/tool-output.ts`, `tool-output.test.ts`;
  - `src/check/check-steps.ts`, `src/check/run-check.ts`, `run-check.test.ts`;
  - `src/check/csp-probe.ts`, `csp-probe.test.ts` (headers, Node), `csp-probe.slow.test.ts` (Chromium);
  - `vitest.config.ts`, `vitest.slow.config.ts`.
- **Modify:**
  - `packages/cli/src/bin.ts`, `bin.test.ts` (the `check` subcommand);
  - `packages/cli/src/index.ts` (export `runCheck`);
  - `packages/cli/package.json` (`oxc-parser`, `@ruken/manifest` devDependency bundled as ship does, scripts `test:slow` and `check:example`);
  - `packages/cli/tsdown.config.ts` (`bundleRuken: ['@ruken/manifest']`).

## Interfaces

- **Consumed:**
  - `ProcessRunner`, `Files` (`@mcthaydt/automata-node`);
  - `rukenToml`, `checkManifest`, `ShipConfig` (`@mcthaydt/automata-ship`);
  - `compileHeaders` (`@ruken/manifest`);
  - `automata-check-boundaries` (bin);
  - the game's `tsc`, `vitest`, `vite`, `playwright`;
  - the runtime's `<html data-state>` ready signal.
- **Produced:**
  - `parseCheckArgs(args)`;
  - `scanForEval(file, code): Finding[]`;
  - `runCheck(options): Effect<CheckReport, never, ProcessRunner | Files | CspProbe>`;
  - `exitCodeFor(report)`, `toJson(report)`, `formatText(report)`;
  - `CspProbe` / `CspProbeLive`;
  - `automata check` on the CLI.

## Steps

- [x] **1. Args.** Write `check-args.test.ts`: the defaults, each flag, a `dir` positional, and an unknown flag rejected as a usage error. Run `pnpm --filter @mcthaydt/automata-cli test -- check-args`; it fails because the module is missing. Implement, then confirm green.
- [x] **2. Report.** Write `check-report.test.ts`:
  - `toJson` has exactly the spec's keys, and a tool error is a finding;
  - `exitCodeFor` gives 0 for all passing, 1 for findings, and 2 for a tool error even when another step has findings.

  Confirm it fails (missing module), implement, then confirm green.
- [x] **3. No-eval scanner.** Write `no-eval-scan.test.ts` over inline bundle fixtures:
  - `clean.js`, which has Effect-style `eval(e){}` methods, `x.eval(…)`, `"eval("` in a string, and `setTimeout(fn)`, gives no findings;
  - `dirty.js` gives one finding for each form, with line and col;
  - the Pixi and Zod probes inside `try` are allowed;
  - the same probe outside `try` is reported.

  Confirm it fails, implement, then confirm green.
- [x] **4. Tool output parsers.** Write `tool-output.test.ts`: boundaries lines, tsc lines (including a file-less `error TS5083`), and a vitest JSON with a failed assertion and a failed import. Confirm it fails, implement, then confirm green.
- [x] **5. Steps and orchestration.** Write `run-check.test.ts` with a fake `ProcessRunner`, a fake `Files` and a fake `CspProbe`:
  - the steps run in order;
  - `--sim-only` drops `no-eval`;
  - `csp` runs only with `--csp`;
  - findings don't stop later steps without `--fail-fast` and do with it;
  - a missing `vitest` bin gives exit 2 with `install vitest`;
  - a missing `src/sim` is a tool error;
  - a `vite build` failure is a `build` finding;
  - the CSP probe's violation is a finding, and a missing Playwright is exit 2.

  Confirm it fails, implement `check-steps.ts` and `run-check.ts`, then confirm green.
- [x] **6. CSP probe.**
  - `csp-probe.test.ts` (Node): `headersFor(config)` on an inline `ShipConfig` holds Ruken's `script-src 'self' 'wasm-unsafe-eval'`.
  - `csp-probe.slow.test.ts` (Chromium, run by `pnpm --filter @mcthaydt/automata-cli test:slow` with `PLAYWRIGHT_BROWSERS_PATH`): a ready fixture passes, an `eval` fixture reports a violation, a never-ready fixture times out (short timeout), and a `failed` fixture fails.

  Confirm both fail, implement `CspProbeLive` (a `node:http` static server on an ephemeral port, plus Playwright resolved from the game folder), then confirm green. The slow suite is not part of `pnpm check`: the hosted unit job has no browsers, and turbo does not pass `PLAYWRIGHT_BROWSERS_PATH` to `test:unit`.
- [ ] **7. CLI.** Extend `bin.test.ts`: `check` dispatches to `runCheck` (an injected runner), `--json` prints only the JSON, and the exit code passes through. Confirm it fails, wire it into `bin.ts`, then confirm green.
- [ ] **8. Integration and gates.**
  - Run `pnpm --filter @mcthaydt/automata-cli check:example` (`automata check --json --csp` in `examples/base-2d`) and `--sim-only`. Record each step's result and time.
  - Show a seeded failure (an `effect` import in the sim) giving exit 1, then revert it.
  - Gates: `pnpm format`, `pnpm check`. `test:parity` is omitted (no sim, runtime or render change). `test:e2e` is omitted (no Playwright project added; the CSP probe's own slow suite covers the browser path).

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
| — | — | — | — |
