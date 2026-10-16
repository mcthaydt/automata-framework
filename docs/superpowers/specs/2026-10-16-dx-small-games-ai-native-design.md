# DX: small games, agent-native, claims made true

> **Status:** draft, 2026-10-16. Milestone spec for task **DX.0**; Owner review pending. Nothing in this milestone is implemented until this spec is reviewed (01 Decomposition §5, 04 How we build).
>
> **Why now (Owner, 2026-10-16):** the framework is not optimized for what the website sells. Small changes take too much code, and the agent story is weaker than the site's pitch. The website's restoration ledger lists every claim the 14 October redesign cut. This milestone makes the cuttable-but-wanted ones true, then restores them with their proof.

## 0. Sources

| Source | Revision | Used for |
|---|---|---|
| Website restoration ledger, `docs/2026-10-14-cut-claims.md` | `mcthaydt/automata_website` `bfeaf91` (`main`) | Every cut claim and its restoration gate (§2) |
| Website audit, `docs/2026-10-14-site-audit.md` | same | Which claims were wrong, which were unverified |
| Website pitch, `src/routes/+page.svelte`, `src/data/ai-guidance.ts`, `src/data/agent-setup.ts`, `src/data/audience.ts` | same | What the site sells today: "Make browser games with your coding agent" |
| AF `main` | `365f115` | Current packages, examples and CLI (§1) |

## 1. The problem, measured

Line counts are non-test `.ts` files at AF `365f115`. They are the baseline for the exit criteria in §12.

| What | Lines | Where the code goes |
|---|---|---|
| `examples/base-2d` (Emberwick, a character in a room) | 3,457 | Sim 365, art 393, content 96. Plumbing (boot, loop, flow, failure, rounds, play-room, renderer, input, screens): **1,939**. |
| `examples/runtime/boot-and-flow` (a tick counter with three screens) | ~330 in `src/` | Hand-written compiled flow JSON and content hash, `GameDefinition`, ~60 lines of DOM per screen, four sim files for one counter. |
| `create-game` output | 11 files | The game prints "<title> running". No renderer, no runtime, no Ruken handshake, no tests. Dependencies are `workspace:*`, so it can't install outside this repo. |

Three causes:
1. **Nothing composes the core packages.** `runtime`, `render-pixi`, `host` and `ui` each work, but a game wires them by hand. Emberwick doesn't use `runGame` or `createPixiRenderer` at all; it carries its own loop, renderer, flow and boot.
2. **No defaults.** `runGame` requires compiled content with a hash, explicit screens, a renderer factory and hosting options, even for a game with one screen.
3. **The agent layer is prose.** AF ships no skill, plugin, hook or machine-readable API. The site tells people to install third-party skill packs (Superpowers, PixiJS skills) and copy prompts. Nothing an agent runs checks its work against AF's rules except the repo's own `pnpm check`, which a game repo doesn't have.

## 1.1 Goal and boundaries

**Goal.** A small change is a small diff. An agent working on an AF game loads AF's rules from AF, finds the real API, and gets a pass or fail from AF's checks. Every restored website claim links to the artifact that proves it.

**Deliverables:** §3 contracts, the tasks in §10, and website restorations (§11) once each task's evidence exists.

**Out of scope:**
- The universal guarantees the ledger retired permanently. They stay cut: "eliminate hallucinations", "guarantee zero-eval CSP compliance", "100% compliant with strict CSP", "zero untrapped crashes", "eliminating memory leaks", "complete determinism", "most engines rely on eval" and "run identically" across web and desktop. Each has a bounded replacement in §2.
- 3D (M3, M9), desktop or Tauri (M7), and networking (M7).
- Input beyond the minimal map in §3.3. M4 owns complete input paths.
- Renaming real APIs to match old marketing code. The ledger's "API examples that were incorrect" section stands: `runApp`, `createApp`, `defineTrait`, free `step`/`hash` and the rest are not added. The new short API in §3.1 is designed from Emberwick's needs, not from the old snippet.

## 2. Ledger disposition

Every ledger row gets one disposition:
- **Build:** a task makes it true.
- **Evidence:** it may already be true, and a task generates the proof.
- **Owner:** it needs an Owner decision first (§13).
- **Retired:** it stays cut, and the bounded replacement is published instead.

### 2.1 Distribution and integrations

| Cut claim | Disposition | Task | Restored wording (once its proof exists) |
|---|---|---|---|
| `npx automata create-game my-game`, "Scaffold a complete game in seconds" | Build + Owner (registry, D-DX-1) | DX.5, DX.10 | The exact install command for the chosen registry, then: "Scaffolds a playable game with tests and agent rules. Measured: N s on a clean machine (DX.10 run)." |
| The advertised generated project tree | Build | DX.5 | The tree DX.5 actually generates, captured from a run, not hand-written |
| `npx skills add mcthaydt/automata` | Build + Owner (public skills repo, D-DX-2) | DX.7 | `npx skills add <public repo>`, tested with the agents listed in DX.7's install log |
| `claude /plugin marketplace add mcthaydt/automata` | Build + Owner (D-DX-2) | DX.7 | The two documented commands (`/plugin marketplace add <repo>`, then `/plugin install automata@<marketplace>`), tested on a named Claude Code version |
| `agy skill install mcthaydt/automata` | Owner | — | Restored only if the Owner names a supported Antigravity workflow; otherwise covered by the Agent Skills standard row |
| `curl … automata.dev/llms.txt >> .cursorrules` / `.windsurfrules` | Build | DX.5, DX.7 | Generated projects carry `AGENTS.md` and Agent Skills folders, which these tools read. The `automata.dev` host is retired; the origin is `automata.ruken.com` once deployed (D-DX-5). |
| "Official AI & LLM integration", "automatically enforces" | Build (bounded) | DX.6, DX.7 | "The Automata plugin loads AF's rules and runs `automata check` after edits. The check fails sim code that breaks the boundaries, and builds that contain `eval`." This scope is enforcement by a checker, not by instructions. |
| Discord invite | Owner | — | Only once the Owner confirms an owned invite |
| `v0.0.2` / `v0.1` badges | Evidence | DX.9 | Version labels read from the published release in the evidence file |

### 2.2 Promises narrowed, not guaranteed

| Cut wording | Disposition | Task | Bounded replacement |
|---|---|---|---|
| "Eliminate hallucinations" | Retired | DX.8 | "Agents get AF's generated API index and run AF's checks. In DX.8's evaluation, N of M tasks passed on <model, version, date>." |
| "Guarantee zero-eval CSP compliance", "100% compliant" | Retired | DX.6 | "`automata check` fails a build that contains dynamic evaluation, and the CSP smoke test runs it under Ruken's `compileHeaders` policy." Name the policy and link the run. |
| "Tested prompt patterns … on the first attempt" | Build (bounded) | DX.8 | The measured pass rate for each prompt, with model, version, task and acceptance test |
| "Zero untrapped crashes", "all failures are typed and handled" | Retired | — | Keep the existing docs on the typed `BootError` states and their tested recovery |
| "Eliminating memory leaks" | Retired | — | Explain scope ownership; cite the runtime's finalizer tests |
| "Complete determinism", "100% Match" | Evidence | DX.9 | "Same code, content, seed and commands give the same hash in Node, Chromium, WebKit and Firefox", linked to the generated parity report |
| Desktop and web "run identically" | Retired until M7 | — | — |
| "Silky smooth" high refresh rates, "mobile-first from day one" | Evidence | DX.9 | Interpolation described as built; frame-time numbers only with device, browser and refresh rate |
| "Most game engines rely on eval" | Retired | — | — |

### 2.3 Product scope, release and proof

| Cut claim | Disposition | Task |
|---|---|---|
| "PixiJS 2D & 3D rendering" | Retired until M3/M9 ships a public 3D package (D-1) | — |
| "WebGPU fallback" | Retired. The policy is WebGL2 by default, WebGPU opt-in (ADR 0002). M1.7's plan row still says "fallback"; DX.0 corrects it. | DX.0 |
| "M1 & M2 Foundation Live" | Evidence: replaced by the published release version | DX.9 |
| "Core / Stable" labels | Owner: needs a compatibility policy (D-DX-1) | — |
| "Every commit" cross-engine; "500-tick run" | Evidence: the parity report names the CI run, revision and scenario | DX.9 |
| `54bfb33a` / `31f50888ccb4cf0a` static hashes | Evidence: generated per revision | DX.9 |
| "60 fps" label | Build: a live counter labelled as live, in the demo runner | DX.9 |
| Touch/gamepad/keyboard parity; "verified at 780×270" | Evidence: link M1.6's layout contracts (DOM and real-browser) and the input journeys; real-device rows stay open | DX.9 |
| Hot reload, `file:line:col` errors, content hashes | Evidence: link the `content/hot-reload` journey and the compiler's diagnostics tests; name the sim hash separately from the full content hash | DX.9 |
| "Clean restart without reload" | Evidence: runtime's restart journey, named as such | DX.9 |
| "Complete plain-text documentation" | Build: `llms-full.txt` generated from a defined corpus (docs and the API index) | DX.4 |
| "Exhaustive API reference" | Build: generated from the published `.d.ts` files for one version | DX.4 |

### 2.4 Showcase

The showcase rows (FloorFifty, The Last Light) are about the reference projects' relationship to AF, not about AF features. They stay held until each project actually depends on published AF packages (M8 adoption slices). Emberwick's tags are restored only for capabilities DX.3's rebuilt starter actually has, verified by its own journeys.

## 3. Contracts

### 3.1 `@mcthaydt/automata-game`: one call to start a game

**New core package** `packages/game`, published as `@mcthaydt/automata-game`. It is the only package that imports `runtime`, `render-pixi`, `host`, `ui` and `sim` together. `runtime` can't own this composition, because `render-pixi` already imports `runtime`. It adds no new service; every default is an existing core contract with its options filled in. Extensions are passed through, never imported.

```ts
import '@mcthaydt/automata-game/no-eval' // re-exports render-pixi/no-eval; must be first
import { startGame, keys, rect } from '@mcthaydt/automata-game'
import { Body, Move, platformer } from './sim/platformer.plugin.ts'

startGame({
  id: 'my-game',                  // Ruken game id; hosting.gameId
  size: { width: 320, height: 180 },
  sim: { plugins: [platformer], seed: 1 },
  input: keys(Move, {             // keyboard + touch buttons -> one command per tick
    ArrowLeft: { x: -1 }, KeyA: { x: -1 },
    ArrowRight: { x: 1 }, KeyD: { x: 1 },
    Space: { jump: true },
  }),
  views: { [Body.id]: rect({ w: 8, h: 8, color: 0xf9c22b }) },
})
```

Contract:

```ts
export interface GameSpec<S = never> {
  readonly id: string
  readonly size: { readonly width: number; readonly height: number }   // logical pixels
  readonly sim: { readonly plugins: readonly PluginDef[]; readonly seed?: number; readonly setup?: (sim: Sim) => void }
  readonly input?: InputMap                      // §3.3; default: no commands
  readonly views?: Readonly<Record<string, EntityViewFactory>>  // component id -> view (§3.4)
  readonly content?: { readonly data: CompiledContentData; readonly hash: string; readonly sim?: unknown }
  readonly screens?: readonly ScreenDef[]        // default: title, play, paused (§7)
  readonly root?: HTMLElement                    // default: #game
  readonly hosting?: Partial<Omit<HostingOptions, 'gameId'>>
  readonly settings?: SettingsDef<S>
  readonly extensions?: readonly ExtensionDef[]
  readonly renderer?: PixiRendererOptions        // merged over the defaults below
  readonly copy?: GameDefinition['copy']
  readonly seams?: RuntimeSeams                  // tests only
}
export function startGame<S>(spec: GameSpec<S>): RuntimeHandle
export function defineGame<S>(spec: GameSpec<S>): GameDefinition<S>   // pure; startGame = runGame(defineGame(spec))
```

**Defaults, each traceable to an existing owner:**

| Field | Default | Owner of the default's contract |
|---|---|---|
| `content` | A generated minimal flow (`title → play ⇄ paused`) and its hash, computed with `@mcthaydt/automata-sim/hash` exactly as the content compiler would. A game with `content/` passes the compiler's virtual module instead. | content (M1.3), runtime boot's hash check |
| `screens` | `titleScreen`, `playScreen`, `pausedScreen` built from `ui` primitives (§7). The play screen creates the sim, runs `AppLoop` with the input map's commands, and feeds `StepResult` to the renderer. | runtime `ScreenDef`, ui primitives |
| `renderer` | `createPixiRenderer({ logicalWidth, logicalHeight, pixelArt: true, entityViews })`; WebGL2 default, WebGPU opt-in | render-pixi (M1.7) |
| `hosting` | `{ gameId: id, wants: [], pauseBehavior: 'pause' }` | host (M1.4) |
| `root` | `document.getElementById('game')`, else `BootDefect` | runtime |

The game package must not change any sim behavior. A game written with `startGame` steps exactly the commands its input map produced, so its goldens are what they would be under hand-written wiring. DX.3 proves this with Emberwick's unchanged golden.

### 3.2 Sim conveniences (additive, `packages/sim`)

The sim API is already short; most of the cost is wiring. Two small additions, both additive (no schema-hash change for existing plugins):
- `definePlugin({ name, defs: [...] })` takes one flat list of components, commands, events, resources and systems, sorted by `kind`. The existing keyed fields stay; mixing both is allowed. Duplicates are an error (same rule as today).
- `defineSystem(name, run)` and `defineSystem(name, phase, run)` overloads, with `phase` defaulting to `'gameplay'`.

Contract test: a plugin defined both ways yields byte-identical `schemaHash` and the same golden.

### 3.3 `InputMap` (`packages/game`, extracted from Emberwick)

`keys(command, bindings, options?)` builds one command per tick from held keys, merging object payloads (later keys win per field) and validating them through the command's Zod schema. On-screen touch buttons are generated from the same bindings by `ui` (`ActionBar`) unless `options.touch === false`. Gamepad buttons map via `options.pad` (standard mapping only). It is extracted from `examples/base-2d/src/input/` (keys and devices, 128 lines with tests), which already produces Emberwick's `move` command.

Edge-triggered fields such as "jump pressed" stay a sim concern: the sim compares this tick's command with last tick's, as Emberwick's `player.input` system does. The input map never sends "pressed" edges, so replays stay a pure function of the command stream.

M4 later extends the same `InputMap` with remapping, display policy and its E2E matrix. It doesn't replace it.

### 3.4 Entity views (`packages/render-pixi`)

Two view factories for `entityViews`, both interpolating `x`/`y` (and `angle`, shortest arc) between the previous and current tick with the frame's `alpha`. `RenderDeltaConsumer` already supplies both values.
- `rect({ w, h, color, anchor? })`
- `sprite(texture | url, { anchor?, frames? })`

Components without a view draw nothing. A full resync after restore rebuilds views from the snapshot (existing consumer behavior).

### 3.5 `create-game` makes a real game

`packages/cli` generates a game that boots on `startGame`, completes the Ruken handshake (standalone in `vite dev`, fake host in tests), draws a moving body and has:

- `src/main.ts` with the `startGame` call (§3.1), and `src/sim/` with one plugin.
- `src/sim/game.golden.test.ts`, which records a golden through `@mcthaydt/automata-testing/sim`.
- `AGENTS.md` (the game's rules and checks), and `CLAUDE.md` containing `@AGENTS.md`.
- The Automata skills (§3.7), copied into `.claude/skills/` and `.agents/skills/` from the same source as the plugin, so a clone works in Claude Code and in any Agent Skills tool without a separate install.
- `package.json` scripts `dev`, `build`, `test`, `check` (`automata check`, §3.6) and `prepare-ruken`.
- Dependency ranges at the CLI's own published version, never `workspace:*`. Inside this repo, a test rewrites them to the workspace for its integration run.

Command: `automata create-game <dir> [--id <id>] [--title <title>]`. Installing it from the registry is D-DX-1.

### 3.6 `automata check`: what enforces the rules

`automata check [--json] [--sim-only]` runs in a game folder. Steps, in order, stopping at the first failure only if `--fail-fast`:

| Step | What it runs | Fails when |
|---|---|---|
| `boundaries` | `@mcthaydt/automata-check-boundaries` on `src/sim/` (the same checker as `pnpm boundaries`) | Sim code imports DOM, Effect, timers, `Math.random`, etc. |
| `typecheck` | `tsc -p . --noEmit` | Type errors |
| `test` | `vitest run` | A test or golden fails |
| `no-eval` (skipped with `--sim-only`) | Builds, then scans `dist/**/*.js` for `eval(`, `new Function(`, `Function(` string-call forms and `setTimeout`/`setInterval` with a string argument | Any match outside an allowlisted, documented vendor location |
| `csp` (opt-in `--csp`) | Serves `dist/` with Ruken's `compileHeaders` CSP, then loads it in Playwright Chromium until the game reports ready | A CSP violation report or no ready signal within 20 s |

`--json` prints `{ ok, steps: [{ name, ok, ms, findings: [{ file, line, col, rule, message }] }] }`, the shape the plugin hook (§3.7) feeds back to the agent. Exit codes: 0 pass, 1 findings, 2 tool error.

### 3.7 The Automata agent package

One source folder in AF, `agents/automata/`, is the single owner of every agent-facing file. It follows the open Agent Skills layout (`skills/<name>/SKILL.md`):

| Skill | What it gives the agent |
|---|---|
| `automata` | The seven laws as rules for game code, which layer owns what, where each kind of change goes, and the order to verify in. It routes to the skills below. |
| `automata-feature` | A test-first flow for a gameplay change: command → system → golden test → view. It has a worked example (double jump) whose code is typechecked in CI. |
| `automata-api` | `reference/api.md`, generated by DX.4 from the published `.d.ts` files for exactly this version. It states the version. |
| `automata-verify` | How to run and read `automata check --json`, and what each rule means and how to fix it. |

It is delivered three ways from that one source:
1. **Claude Code plugin.** `.claude-plugin/marketplace.json` at the repo root (or the public repo of D-DX-2) lists plugin `automata` from `agents/automata/`. The plugin adds the skills and two hooks: `PostToolUse` on `Edit|Write` under `src/sim/` runs `automata check --sim-only --json`, and `Stop` runs `automata check --json`. Findings go back to the model through the hook's blocking feedback. A hook never edits files.
2. **Agent Skills install** (`npx skills add <repo>`) for Cursor, Codex, Windsurf and other tools that read the standard.
3. **Copied into generated games** by `create-game` (§3.5).

A CI test keeps the three byte-identical and validates the plugin manifest. DX.7 records the exact current syntax and the versions it was tested on in this spec's §3.7 "As built" before any website copy names a command.

**Install mechanics (Claude Code and Agent Skills docs, checked 2026-10-16; DX.7 re-checks them):**
- **Layout.** The marketplace is `.claude-plugin/marketplace.json` at the repo root, with the required `name`, `owner.name` and `plugins`. It holds one entry, `{ "name": "automata", "source": "./agents/automata" }`; a relative source must start with `./`. The plugin root `agents/automata/` holds `.claude-plugin/plugin.json` (`name` only), `skills/<name>/SKILL.md` and `hooks/hooks.json`. The event map must sit under a top-level `"hooks"` key, or the file doesn't load. Hook commands run `"${CLAUDE_PLUGIN_ROOT}"/scripts/check.sh`, which calls the project's own `automata check` from `${CLAUDE_PROJECT_DIR}`.
- **Feedback.** A hook that finds problems exits 2 with the JSON findings on stderr. For `PostToolUse`, Claude sees the findings after the edit; for `Stop`, Claude keeps working instead of ending the turn. Exit 0 says nothing. A plugin `CLAUDE.md` isn't loaded, so every instruction lives in a skill.
- **Commands.** `claude plugin marketplace add <owner/repo>`, then `claude plugin install automata@<marketplace>`; in a session, `/plugin marketplace add` and `/plugin install`. `claude plugin validate <path> --strict` runs in CI on both the plugin and the marketplace. A local install from a path (`claude plugin marketplace add ./`) is DX.7's container test.
- **Private repo.** Claude Code clones a marketplace with the machine's own git credentials (SSH, or an HTTPS credential helper such as `gh auth setup-git`). Today, only people who can already read the private AF repo can install it. That's why a public install command needs D-DX-2.
- **Skill format.** Each `SKILL.md` sets both `name` (matching its folder, lowercase and hyphens) and `description`. The open standard requires both; Claude Code only recommends `description`.
- **`npx skills add <owner/repo>`** finds a repo's `skills/` folder and installs into `.claude/skills/` for Claude Code, `.agents/skills/` for Cursor, Codex and others, and `.windsurf/skills/` for Windsurf. DX.7 pins the agents it actually tested.
- **Generated games.** They get `CLAUDE.md` containing `@AGENTS.md`. Claude Code reads `AGENTS.md` alone only when no `CLAUDE.md` exists, so the import is the form that works in every session.

### 3.8 Generated API index (`tooling/api-index`)

Built after `pnpm build`. Reads each published package's emitted `.d.ts` and writes `api.json` (package, entry point, export name, kind, signature, doc comment, version) plus `api.md` (for the skill) and `llms-api.txt` (for the website). It covers every export of every published entry point, so "complete" means exactly that set for one version. A test fails if an export has no doc comment, so new exports arrive documented.

### 3.9 Agent evaluation (`tooling/agent-evals`)

Makes "tested prompts" a measured claim:
- **Tasks:** the website's prompts (double jump, collectible, dash, jump feedback), each with hidden acceptance tests and `automata check`.
- **Runner:** on a fresh `create-game` project, runs a named agent headless (Claude Code `claude -p` with the plugin installed) N times per task.
- **Report** (`agent-evals.json`): agent, model, versions, task, trials, passes, median time and cost. Logs are kept.

A run costs money, so it runs only on the Owner's word with a set budget (D-DX-3). It never runs in `pnpm check` or CI.

### 3.10 Evidence file (`tooling/evidence`)

On every push to `main` (the af-linux `parity` job), writes `evidence.json`: AF revision, CI run URL, each golden's scenario, seed, ticks, and per-engine hash with engine and browser versions, published package versions, and `automata check` results for the `create-game` output. The website's sync reads it at build time and renders proof from it. A hard-coded hash on the site becomes a website test failure (the website's `audit-regressions.test.ts`).

## 4. Ownership

| State or artifact | Owner | Writers | Consumers |
|---|---|---|---|
| `GameSpec`, `startGame`, default screens, `InputMap` | `packages/game` | game lane | create-game output, Emberwick, skills |
| `definePlugin({ defs })`, `defineSystem` overloads | `packages/sim` | sim lane (additive only) | everyone |
| `rect`, `sprite` views | `packages/render-pixi` | runtime lane | game |
| `create-game` template, `automata check` | `packages/cli` | integration | games, plugin hooks, evals |
| Agent skills, plugin manifest, marketplace | `agents/automata/`, `.claude-plugin/` | integration | Claude Code, Agent Skills tools, create-game |
| API index | `tooling/api-index` | ship lane | skills, website |
| Evidence file | `tooling/evidence` | ship lane | website |
| Eval tasks and reports | `tooling/agent-evals` | integration | website |
| Website copy restorations | `automata_website` | website | — |

Sim versus presentation is unchanged: `packages/game` never writes sim state except through commands, and views read only `RenderDelta`.

## 5. Flows

**`startGame` boot**, in order. Steps 2–7 are the existing `runGame` program, unchanged.
1. `defineGame(spec)` validates the spec: `id` against Ruken's id rule (from `@ruken/manifest`, not copied), `size` as positive integers, and view keys against the plugins' render components. It fills the defaults and returns a `GameDefinition`; any failure is a `BootDefect` before anything renders.
2. `runGame`: Hosting init and ready (M1.4). Nothing is created before ready.
3. Content hash check.
4. Renderer init (WebGL2, then the opt-in path).
5. Flow enters `title`.
6. `play` creates the sim with `seed` and `plugins` and calls `setup(sim)`. Then `AppLoop` runs: each tick, the input map's command goes to `sim.step`, and its `StepResult` goes to the renderer, which interpolates by `alpha` each frame.
7. Pause, host menu or blur → `paused`, with the sim paused (`pausesSim`).
8. Shutdown: the runtime scope closes the sim, renderer, input listeners and screens in reverse order.

**Agent edit loop (plugin):** the agent edits `src/sim/x.system.ts` → `PostToolUse` → `automata check --sim-only --json` (boundaries, typecheck, tests) → on findings, blocking feedback with the JSON lines → the agent fixes → the `Stop` hook runs the full check before the turn ends.

## 6. Failure policy

| Case | Behavior |
|---|---|
| Invalid `GameSpec` | `BootDefect` with the field path; the boot failure screen shows it. |
| No `#game` and no `root` | `BootDefect` |
| Unknown component id in `views` | `BootDefect` at `defineGame`, not a silent no-draw |
| Input binding payload fails the command schema | Thrown at `keys()` construction (developer error), not per tick |
| Renderer, content, hosting and assets failures | The existing `BootError` states, unchanged |
| A host capability is denied | Same as `Hosting`: no silent device fallback |
| `automata check` tool missing (no `vitest`, no Playwright for `--csp`) | Exit 2 with what to install; never reported as a pass |
| Plugin hook fails to run | The hook reports the tool error to the agent and doesn't block; it never claims the code passed. |
| Eval budget reached | The run stops; the report marks unfinished trials as not run, not as failed or passed. |

## 7. UI inventory (default screens)

Built only from `ui` primitives and its geometry owner. No new layout code.

| Screen | Components | States | Input |
|---|---|---|---|
| Title | `ScreenFrame`, game title, `ActionBar` with Play (primary, 48 px) | ready, loading (LoaderOverlay) | Enter or Space = Play; tap; gamepad A |
| Play | Pixi stage, `CornerControls` (pause), touch `ActionBar` from the input map when touch is detected | running, paused-by-host | the game's input map; Escape or P = pause |
| Paused | `ScreenFrame`, Resume (primary), Quit to title | — | Escape = resume |
| Boot failure | The existing `BootFailure` states from `ui` | per `BootError` tag | existing |

Responsive behavior is inherited: container and usable height from the geometry owner, safe areas, `hostReserved`, the keyboard inset and 44/48 px targets. The touch buttons live in the action bar's declared region and never shrink below 44 px. DX.2's fixtures run at all 25 reference sizes, including 780×270.

## 8. Test allocation

| Layer | What |
|---|---|
| Unit (Node) | `defineGame` defaults and validation; `keys()` merging and schema checks; `defs` sorting and the hash-equality test (§3.2); `rect`/`sprite` interpolation math; `automata check` step parsing and `--json` shape; the no-eval scanner on fixtures with and without matches; API index extraction; skill-copy identity |
| DOM | Default screens' states and focus order |
| Real-browser layout | Default screens at every reference size and variant (M1.6's contract) |
| Parity | A `startGame` game's golden in Node, Chromium, WebKit and Firefox; Emberwick's golden unchanged after DX.3 |
| Fake-host E2E | A `create-game` output: boots under the fake host, plays, pauses, resumes; a CSP smoke test under `compileHeaders` |
| Plugin | `claude plugin validate` (or the documented equivalent) on the manifest; a scripted local install from a path, in a container |
| Evals | Only on the Owner's word (D-DX-3) |
| Owner | Look at the default screens; accept the restored website copy |

## 9. Ruken alignment

- Hosting goes through `@mcthaydt/automata-host` over `@ruken/sdk`; `startGame` adds nothing to the protocol.
- The id rule and manifest fields come from `@ruken/manifest`; `create-game`'s `ruken.toml` still goes through `parseManifest` (M1.8 test).
- The CSP step uses Ruken's `compileHeaders`, not a copy.
- Nothing here needs a new Ruken capability.

## 10. Tasks

Lanes as in 04 How we build. Each task gets its TDD plan before code.

| ID | Task | Lane | Depends on | Deliverable |
|---|---|---|---|---|
| DX.0 | This spec, reviewed | integration | — | Owner review; D-DX-1 to D-DX-5 answered |
| DX.1 | Sim conveniences | sim | DX.0 | §3.2 with the hash-equality test |
| DX.2 | `packages/game`: `startGame`, defaults, `InputMap`, default screens | game (new) | DX.0, DX.1 | §3.1, §3.3, §7; demo `examples/game/hello` (≤ 40 lines of non-test TS) |
| DX.2b | `rect` and `sprite` views | runtime | DX.0 | §3.4 |
| DX.3 | Emberwick on `startGame` | integration | DX.2, DX.2b | Plumbing from 1,939 lines to ≤ 400, golden unchanged, every base-2d journey green |
| DX.4 | API index and generated `llms-full.txt` corpus | ship | DX.0 | §3.8 |
| DX.5 | `create-game` makes a real game | integration | DX.2, DX.6, DX.7 | §3.5 |
| DX.6 | `automata check` | integration | DX.0 | §3.6 |
| DX.7 | Agent skills, Claude Code plugin, Agent Skills install | integration | DX.4, DX.6 | §3.7, with install logs |
| DX.8 | Agent evals | integration | DX.5, DX.7, D-DX-3 | §3.9 and the first report |
| DX.9 | Evidence file and website proof | ship + website | DX.0 | §3.10 |
| DX.10 | Website restorations | website | Each row's task | §11 |

Order: DX.1, DX.2b, DX.4, DX.6 and DX.9 can run in parallel. DX.2 needs DX.1. DX.3 and DX.5 come after DX.2. DX.7 comes after DX.4 and DX.6. DX.8 comes last.

## 11. Website restoration rules

In the website repo, per restored row: update `docs/2026-10-14-cut-claims.md` (move the row to a "Restored" section with the proof link), change the copy, and add a test in `tests/audit-regressions.test.ts` that pins the wording to the evidence (a version, report or command that exists). A claim whose proof is missing on a later build fails that test instead of shipping.

## 12. Exit criteria

**Success:**
- `examples/game/hello` is ≤ 40 lines of non-test TS, boots under the fake host and passes its golden in four engines.
- Emberwick's plumbing is ≤ 400 lines (measured by a script in DX.3, replacing §1's table). Its golden is unchanged, and all its journeys are green.
- The double-jump change from the website's task is a diff of ≤ 60 lines of non-test code on the rebuilt Emberwick. It's measured once by hand in DX.3 and again by DX.8 for agents.
- The `create-game` output passes `automata check --csp` in a clean container from published packages (or packs, until D-DX-1).
- The plugin installs from its marketplace on a named Claude Code version, its skills load, and its hook blocks a sim edit that imports `effect`.
- `npx skills add` installs the skills into at least one other named agent.
- `evidence.json` is produced by af-linux CI on `main`, and the website renders it.
- DX.8 has published one report, if D-DX-3 allows.

**Failure (not acceptable as done):**
- Any restored claim without a linked artifact.
- Emberwick's golden changing.
- A skill file that differs between the plugin, the skills repo and generated games.
- An install command published before its install log exists.

**Owner acceptance:** default screens, the restored website copy and the first eval report.

## 13. Owner decisions

| ID | Decision | Why it blocks | Recommended default |
|---|---|---|---|
| D-DX-1 | **License and registry.** The site says "The framework code is MIT licensed"; every package says `"license": "UNLICENSED"`; the repo is private; packages target GitHub Packages, which needs a classic PAT even to read. | No public install command (`npm create`, `npx`) can be true until this is decided. The site's MIT claim is false today. | Decide the license (D-7) now. If MIT: publish to npm as `@mcthaydt/automata-*` plus `create-automata-game`. Until then, the site's FAQ must say the license is not yet granted. |
| D-DX-2 | **Public agent repo.** Plugin marketplaces and `npx skills add` clone a Git repo with the user's own credentials, and the AF repo is private. | Install commands for anyone without access to the AF repo | A public `mcthaydt/automata-skills` repo, generated from `agents/automata/` at each release by the release workflow |
| D-DX-3 | **Eval budget.** A model and an API key for the runs, plus a spend cap | DX.8 | Claude Code headless on one named model, 10 trials × 4 tasks per release, with a cap set by the Owner |
| D-DX-4 | **Antigravity and Discord.** Keep or drop these | Their ledger rows | Drop both until the Owner names a supported workflow or an owned invite |
| D-DX-5 | **Site origin.** Is `automata.ruken.com` deployed? | The endpoint in agent instructions | Restore URL-based instructions only after the deploy is verified |
