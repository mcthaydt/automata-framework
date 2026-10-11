# M1 ship lane: toolchain, CI and the ship skeleton (M1.1, M1.2)

- **Status:** Implemented and locally verified 2026-10-11 (S0–S7 local evidence in PR #6); hosted CI, the staging dev host and Owner review are open. Originally drafted for Owner review (lane **ship**, [04 How we build](../../04-how-we-build.md#lanes-2026-10-11)). Stacks on PR #4.
- **Tasks:** M1.1 Toolchain, versions and CI lanes; M1.2 Ship skeleton ([02 Master delivery plan](../../02-master-delivery-plan.md)).
- **Consumes:** [M1 shared contracts](./2026-10-11-m1-shared-contracts-design.md) §2 (`manifest` contributions from extensions feed `ShipConfig`; the determinism check runs in `game-ci.yml`); `vendor/ruken/` (owned by the integration lane, D-6).
- **Parents:** [Ruken-first master spec](./2026-10-11-automata-framework-ruken-first-design.md) §3 (stack), §4 (`ship` row), §10 (CI/CD and deployment), §12 D-4 and D-5; [extraction map](./2026-10-11-core-and-extensions-extraction-map.md) (`ship` row).

## 1. Goal and boundaries

**Observable result.** From a clean clone on Node 24.21.0:

1. `pnpm install --frozen-lockfile && pnpm check` passes, and `pnpm check` now also runs the version-pin test.
2. `ship prepare` (run in `examples/placeholder`) builds the page, writes a generated `ruken.toml` into `dist/` and checks it with `@ruken/manifest`'s `parseManifest`, after the version/tag and root-absolute checks. It does not zip or validate: `ruken publish` already packs a folder deterministically and runs Ruken's own build checks before it uploads (Ruken `tooling/ruken-cli/src/publish.ts`, `checkLocally`), and AF does not duplicate them.
3. `ship publish` runs `ship prepare`, then Ruken's `ruken publish dist/` against Ruken's local stack (`RUKEN_API=http://localhost:5173`), and prints the served build URL. Ruken's TEST environment does not exist yet, so the local stack is the only Ruken target in M1.
4. `ship deploy-dev` installs the same build at `https://<dev host>/builds/<buildId>/` without changing what `/` serves; `ship deploy-dev --activate` also points `/` at it.
5. The placeholder page, loaded inside `@ruken/sdk-host`'s fake host, completes the Ruken handshake (`hello` → `welcome` → `ready`) and renders nothing before `ready`.
6. A game repository's CI is a few lines calling `game-ci.yml`; its release is a few lines calling `game-release.yml`.

**Deliverables.**

| Area | Files |
|---|---|
| Versions (M1.1) | `docs/versions.md`; `tooling/versions/` (`pins.ts`, `pins.test.ts`, `versions.test.ts`) |
| Root toolchain (M1.1) | `.nvmrc`, root `package.json` (`packageManager`, scripts), `pnpm-workspace.yaml` (`useNodeVersion`, `saveExact`, `engineStrict`), `turbo.json`, `biome.json`, `lefthook.yml` |
| Effect (M1.1) | `effect` 3.22.2 (coordinator decision 2026-10-11: Effect 3 repo-wide; 4.0 is ten days old and renames the Context API); pinned in `docs/versions.md`. `@effect/platform-node` is not used (its 0.108 line requires the `@effect/cluster`, `rpc`, `sql` and `workflow` peers and native build scripts; ADR 0003 as amended) |
| Node services (M1.1) | `packages/node` (`@mcthaydt/automata-node`): the `Files` and `ProcessRunner` Effect services over `node:fs` and `node:child_process`, shared with content and the CLI (§3.8) |
| Spike S8 (M1.1) | `docs/spikes/s8-effect.md`: Effect's bundle bytes and cold boot on the S20 and iPhone 13 profiles, measured on `examples/placeholder`; sets budgets and mitigations, not whether Effect is used (ADR 0003) |
| CI lanes (M1.1) | `.github/workflows/ci.yml` (AF's own), `game-ci.yml` (reusable, `workflow_call`) |
| Feedback tools (M1.1) | `packages/ship/src/ports/` (per-checkout ports), `packages/ship/src/remote/` (focused `test:remote`), an ignored `evidence/` folder (promotion and `worktree-gc` move to a later dev-tools extension, coordinator 2026-10-11) |
| Ship skeleton (M1.2) | `packages/ship/src/{config,manifest,prepare,publish,deploy}/`, `packages/ship/src/cli.ts`, `packages/ship/deploy/` (Caddyfile, host scripts), `.github/workflows/game-release.yml` |
| Ruken packages (M1.2) | Consumed from `vendor/ruken/` (integration lane): `ruken-manifest-0.0.0.tgz` |
| Proof (M1.2) | `examples/placeholder/` |

**Exclusions.** No runtime, renderer, content compiler or host adapter (lanes runtime, content, host). No `create-game` or `cli` package (integration lane, M1.8; it will wrap `ship`). No Changesets or package publishing (M2.4). No production host; the dev host is the only standalone target in M1. No GPU-runner wiring until the Owner's runners are attached (D-5); until then every job is also run locally.

**Prerequisites.** PR #4 (branch base). RukenApp `main` for the tarballs and the CLI. For the live publish gate only: a running Ruken local stack and a developer token.

## 2. Ownership

| State or artifact | Owner | Writers |
|---|---|---|
| Exact versions of every external dependency | `docs/versions.md` (ship lane) | Any lane adding a dependency appends its row in the same PR (additive exception agreed 2026-10-11); the pin test enforces it |
| Root config and workflows | ship lane | ship lane only |
| `ShipConfig` (game id, title, version, network, runtime, content fields) | the game's `ship.config.ts` | the game; `content` contributes `[content]`, `[analytics]` and `[loading]` fields later (M1.3), through `ShipConfig` inputs, not by writing the TOML |
| Generated `ruken.toml` | `packages/ship` | generated into `dist/` at prepare time, never committed |
| Build ID | `packages/ship` | derived from the commit (§3.5); never typed |
| Dev host layout `/srv/<game>/builds/<buildId>/`, `/srv/<game>/live.caddy` | the host's `deploy` script | only `deploy` (via the locked `deploy` user) |
| `evidence/` | the run that produced it | ignored by git; `promote` copies Owner-approved files into committed baselines |

## 3. Contracts

All build-time code runs on Effect (`ADR 0003`). Errors are tagged classes (`Data.TaggedError`) so the CLI prints one line per problem.

### 3.1 Versions

- `pinsFromManifests(manifests): Pin[]` and `pinsFromVersionsDoc(markdown): Pin[]`, ported from Ruken `tooling/versions/pins.ts`.
- `versions.test.ts`: every exact pin in any workspace `package.json` has a row with the same version; no row is unused; no range specifiers (`^`, `~`, `*`) outside `workspace:` and `file:`.
- **Aligned with Ruken** (`RukenApp/docs/versions.md`): Node 24.21.0, pnpm 10.34.6, `turbo` 2.11.6, `vitest` 5.0.3, `playwright` 1.63.0, `zod` 4.6.5, `@types/node` 24.19.1, `yazl` 3.3.1, `yauzl` 3.4.0, `smol-toml` 1.9.0.
- **Deliberate divergence:** `typescript` stays 7.0.2. Ruken holds 6.0.3 only for svelte-check, typescript-eslint, SvelteKit and Prisma, none of which AF uses. AF packages ship `.d.ts` that TS 6 consumers can read; this is checked when M2.4 adds builds.

### 3.2 `ShipConfig` and the manifest

```ts
import type { Manifest } from '@ruken/manifest'

/** Ruken's own parsed-manifest shape, minus what ship fills in. Keys keep Ruken's snake_case. */
type ShipConfig = {
  readonly game: Manifest['game']
  readonly runtime: Omit<Manifest['runtime'], 'allow_eval'>   // allow_eval is always false
  readonly network: Manifest['network']
  readonly content: Manifest['content']
  readonly analytics?: Manifest['analytics']
  readonly loading?: NonNullable<Manifest['loading']>
  readonly leaderboards?: Manifest['leaderboards']
}
const defineShipConfig: (config: ShipConfig) => ShipConfig
const rukenToml: (config: ShipConfig) => string               // pure; table order fixed; header says "generated"
const checkManifest: (toml: string) => Effect<Manifest, ManifestInvalid>   // @ruken/manifest parseManifest
```

Field names, types and allowed values are Ruken's, imported from `@ruken/manifest` (`packages/manifest/src/types.ts`, `parse.ts`); AF adds none and copies none. Extensions' `manifest` contributions (shared contracts §2) merge into this config in M1.5; ship only reads the merged result. `allow_eval` is always `false`.

### 3.3 Prepare

```ts
const prepareBuild: (input: { distDir: string; config: ShipConfig; tag?: string })
  => Effect<{ manifestPath: string }, VersionMismatch | RootAbsoluteReference | ManifestInvalid | FileError>;
```

Order (each step stops before anything is written when it fails):

1. `checkVersion(config.game.version, tag)`: a tag must be `v<version>` (FloorFifty `ruken-pack.ts`).
2. `findRootAbsoluteReferences(distDir)`: a `/`-rooted path to the game's own files 404s under Ruken's `/b/<buildId>/` (FloorFifty `root-absolute.ts`). Ruken's checks do not catch this; it is the one build check AF adds.
3. `rukenToml` → `checkManifest`; write `dist/ruken.toml`.

Zipping, archive safety, size and file-type limits are Ruken's (`packages/validation/src/size.ts` and siblings) and run inside `ruken publish`. AF quotes no limit of its own.

### 3.4 Publish

```ts
const publishToRuken: (input: { distDir: string; cliPath: string; api: string; token: string; activate: boolean; game?: string })
  => Effect<{ url: string }, PublishRejected | PublishUsage | PublishAuth | PublishTimeout | FileError>;
```

Runs Ruken's own CLI, vendored as `vendor/ruken/ruken-cli-0.0.0.tgz` (built at RukenApp `b30d31b` with `@ruken/*` bundled; integration lane, D-6): `node <@ruken/cli>/dist/cli.js publish <distDir> [--activate] [--game <id>]` with `RUKEN_API` and `RUKEN_TOKEN` in its environment (never the token on the command line), in the game's folder so `.ruken/project.json` lands there. It streams the CLI's output, takes the URL from its `Ready:`/`Active:` line, and maps its exit codes (0 done, 1 rejected, 2 usage, 3 auth, 4 timeout, anything else `PublishFailed`; Ruken `run.ts`). There is no dry run (Ruken has none).

### 3.5 Build ID and dev deploy

- `buildIdFor(commit: { time: Date; sha: string }): string` → `YYYYMMDDHHMM-<sha7>` (UTC commit time to the minute, then the short sha, so IDs sort as commits do; FloorFifty `deploy/bin/build-tag`, same pattern so the two hosts read alike).
- `ship deploy-dev [--activate]`: tars `dist/` (as `client/`) with a `build.json` (`buildId`, commit, tag, branch, version) and a `headers.json` (`compileHeaders` output and the entry page), and streams it over `ssh deploy@$DEV_HOST deploy [--activate]`; the key's forced command (`deploy/bin/ssh-deploy`) allows only those two commands and runs `deploy -` on stdin. `deploy` installs into `/srv/<game>/builds/<buildId>/`, refuses to overwrite an existing ID, rewrites `/srv/<game>/builds/index.json` (ten newest), and with `--activate` rewrites `live.caddy` to redirect `/` to the new build. The host is reached only through this step (D-4), so a later provider swap changes `deploy`, not games.
- Headers: each build is served with `@ruken/manifest`'s `compileHeaders(manifest, { hostOrigins: [devHostOrigin] })` (the same CSP Ruken serves, so a build that breaks under Ruken's CSP breaks on the dev host too) and `cacheControlFor` (entry no-cache, the rest immutable). The host renders `headers.json` into the build's `headers.caddy` snippet itself (`deploy/bin/render-headers.ts`), matched on `/builds/<id>/*`, refusing any header name or value that could break out of a header line; so an upload can set headers on its own path and nothing else. No hand-written CSP.
- Caddyfile: imports every build's `headers.caddy`; `/builds/<id>/` serves that build; `/` redirects to the active build (`live.caddy`, rewritten on `--activate`), so the live build keeps its own headers; no access log, and `remote_ip` stripped from error logs (FloorFifty `deploy/caddy/`). `deploy` runs `caddy validate` before `caddy reload`, and a failed validate removes the new build.

### 3.6 Feedback tools

- `portsFor(checkoutPath): { server: number; preview: number }`: a stable hash of the absolute checkout path into a private range, so worktrees never test each other's servers (FloorFifty `playwright.config.ts`). The `testing` package re-exports it when the ui lane adds Playwright helpers.
- `test-remote [spec] [--project=<p>] [--nightly]`: pushes the branch, dispatches `ci.yml` with the spec and project as inputs, waits, and downloads the Playwright report into `playwright-report-remote/` on failure (FloorFifty `tools/test-remote`). Without hosted runners it reports "no runner picked the job up" instead of waiting forever.
- `evidence/` and `playwright-report-remote/` are git-ignored; specs write screenshots under `evidence/`. Promotion to baselines is a later dev-tools extension.

### 3.7 Workflows

- `ci.yml` (AF): `checks` (lint, typecheck, boundaries, style, unit incl. pins) and `parity` (Chromium, WebKit, Firefox in the pinned Playwright container) on push and PR; `workflow_dispatch` inputs `spec` and `project` for focused remote runs, routed to the GPU runner label once D-5 wires it.
- **Runners (D-5, 2026-10-11):** hosted jobs get no runner on this account, so every `ci.yml` job runs on `${{ vars.AF_LINUX_RUNNER || 'af-linux' }}`: a self-hosted WSL2 runner registered to `mcthaydt/automata-framework` with the label `af-linux`, set up like Ruken's `ruken-linux` (Docker for the parity container). There is no `ubuntu-latest` fallback, so with no runner online a job queues instead of failing at once; setting `AF_LINUX_RUNNER` (e.g. `ubuntu-latest`) moves every job. `game-ci.yml` and `game-release.yml` take a `runner` input (default `ubuntu-latest`; release jobs hold publish secrets and stay off shared runners). Setup-node's cache is saved only on hosted runners, and pnpm installs into a per-job folder. Parity runs `pnpm test:parity`, which runs every package's browsers vitest project.
- `game-ci.yml` (`workflow_call`): inputs `node-version-file`, `working-directory`, `sim-roots` (the game's sim-plugin source folders) and `browsers` (default `chromium`); runs install, `check`, `check-boundaries` on `sim-roots` (shared contracts §2), `ship prepare`, and uploads `dist/` as an artifact. A game's `ci.yml` is `uses: mcthaydt/automata-framework/.github/workflows/game-ci.yml@v0`.
- `game-release.yml` (`workflow_call`, on a published release): prepare with the tag, then publish to Ruken when `RUKEN_TOKEN` is set and deploy to the dev host when `DEV_HOST` is set; each target is a separate job so one failing does not hide the other.

### 3.8 Node services (`@mcthaydt/automata-node`)

```ts
class Files extends Context.Tag('Files')<Files, {
  readText(path: string): Effect<string, FileError>
  writeText(path: string, text: string): Effect<void, FileError>   // creates parent folders
  exists(path: string): Effect<boolean>
  listFiles(dir: string): Effect<readonly string[], FileError>     // every file below dir, '/'-separated, sorted
  remove(path: string): Effect<void, FileError>                    // recursive, missing is fine
}>() {}
const FilesLive: Layer<Files>

class ProcessRunner extends Context.Tag('ProcessRunner')<ProcessRunner, {
  run(command: string, args: readonly string[], options?: { cwd?: string; env?: Record<string, string>;
      stdin?: Uint8Array; echo?: boolean }): Effect<{ exitCode: number; stdout: string; stderr: string }, ProcessError>
}>() {}
const ProcessRunnerLive: Layer<ProcessRunner>
```

A non-zero exit is a result, not an error, so callers map Ruken's exit codes themselves; `ProcessError` means the program could not be started. `echo` copies output to the parent's stdout/stderr as it arrives (long Ruken waits stay visible). Tests use real temp folders for `Files` and a recorded fake `ProcessRunner`.

## 4. Data and lifecycle flow

Prepare: config load → version/tag check → root-absolute scan → generate and parse manifest → write. Publish: prepare → Ruken CLI (packs, validates, uploads, waits) → print URL. Deploy: prepare → build ID → tar → ship → host installs → index → optional activate. Each run uses a fresh temp folder (Effect `Scope`), deleted on success and failure.

## 5. Failure policy

| Case | Behavior |
|---|---|
| Pin missing, different or unused | `versions.test.ts` fails naming the package and both versions |
| Tag/version mismatch, root-absolute path, manifest invalid | Pack stops before writing; one line per problem with the field path or `file: reference` |
| Ruken CLI missing or exits non-zero | Mapped error with Ruken's message; no retry (Ruken's CLI already polls) |
| Dev host unreachable, ID already installed | Deploy fails; `/` is unchanged |
| No hosted runner for `test-remote` | Reported after the queue timeout with the run URL; the local command is printed |
| Interrupted run | Temp folder removed by the scope finalizer; nothing partially installed on the host (install is to a temp dir then `mv`) |

## 6. UI inventory and responsive behavior

The only page is `examples/placeholder`: one line of text shown after `ready`, nothing before it. It has no input and fits any size, including 780×270. Mobile UI belongs to the ui lane.

## 7. Test allocation

| Layer | What |
|---|---|
| Unit (Vitest, Node) | pins parsing and the versions check; `rukenToml` output and its acceptance by `parseManifest` for valid and invalid configs; version check; root-absolute scan on fixture folders; `prepareBuild` writes nothing on any failure; `buildIdFor`; `portsFor` stable and distinct; publish exit-code mapping with an injected process runner; evidence diff and promote on a temp folder; `deploy` script against a temp `/srv` root |
| Workflow lint | `actionlint` on every workflow file (pinned) |
| DOM / fake host | placeholder under `@ruken/sdk-host`'s fake host: handshake completes, nothing in the DOM before `ready` |
| Integration (local, gated) | publish to Ruken's local stack; dev deploy to a local Caddy |
| Real browser (local, Chromium) | S8: bundle bytes from the placeholder build; cold boot to `ready` under the S20 and iPhone 13 emulation profiles with CPU throttling |
| Owner gate | review of this spec; first real dev-host URL |

## 8. Feedback workflow

Focused `pnpm vitest run <file>` first; `pnpm check` and the three-browser parity run locally before calling the PR green (D-5, hosted runners unavailable); results posted on the PR with commit and Node version.

## 9. Ruken alignment

`@ruken/manifest` (`packages/manifest/src/parse.ts`) for every manifest field; `tooling/ruken-cli/src/publish.ts` (packs, runs `@ruken/validation`, uploads) and `run.ts` for exit codes; `tooling/versions/pins.ts` and `docs/versions.md` for pins. Request to Ruken: publish `@ruken/cli` so the vendored tarball can become a pinned npm dependency, and consider a `--dry-run` (check without uploading) for CI.

## 10. Exit criteria

- **Success:** S0 S8 verdict written with measured bytes and boot times and the budgets they set; S1 `pnpm check` green locally on Node 24.21.0 with the pin test; S2 parity green in three browsers locally; S3 `ship prepare` writes a `ruken.toml` that `parseManifest` accepts and `ruken publish`'s local check passes; S4 handshake test green; S5 `ship publish` returns a URL from Ruken's local stack; S6 the build is served at `/builds/<buildId>/` on a dev host while `/` is unchanged; S7 `actionlint` clean.
- **Failure cases proved by tests:** F1 unpinned dependency; F2 invalid manifest field; F3 tag mismatch; F4 root-absolute reference; F5 Ruken CLI rejects (exit 1); F6 Ruken CLI auth failure; F7 duplicate build ID on the host.
- **External dependencies:** S5 needs Ruken's local stack (Docker) and a token; S6 needs a host and its `deploy` key. Where the container cannot run them, the gate stays open and the PR says so.
- **Open questions for the Owner:**
- **Decided (2026-10-11):** TypeScript stays 7.0.2; the dev host is a second Caddy site on the FloorFifty staging VM; the placeholder uses `@ruken/sdk` and `@ruken/sdk-host` from `vendor/ruken/`, as `packages/host` does, until `Hosting` exists (then the placeholder moves onto it).

## Audit round 1 (2026-10-11)

Changes from the audit thread's review of PR #6, now part of this spec:

- **Dev host (§3.5):** `deploy` sources `/etc/floor-fifty/caddy.env` itself, because sudo drops the deploy user's environment and Caddy refuses an empty `{$AF_DEV_SITE}`. One deploy runs at a time per game (`flock`, exit 5 after 120 s).
- **test-remote (§3.6):** it polls the run; no job started after 10 minutes cancels it as "no runner", 60 minutes in all cancels it as "timeout". `pnpm ci:local` is the local command it prints, and a workflow test keeps it equal to ci.yml's checks and parity steps plus the placeholder build and prepare.
- **Browser journeys (§3.7):** Playwright runs from the root config; each example adds a project and its servers. A run that selects no test fails. The placeholder's journeys cover standalone boot under `compileHeaders` and the handshake inside Ruken's fake host frame on another origin.
- **Reusable workflows (§3.7):** a game outside AF is blocked until M2.4 publishes AF's packages; then it needs `AF_READ_TOKEN` (AF is private) and AF's Actions access set to the owner's repositories. `game-release` publishes to its `game` input (or a committed `.ruken/project.json`) and otherwise fails. The deploy key never touches `~/.ssh`.
- **prepare (§3.3):** the root-absolute check also covers `srcset`, unquoted attributes and JSON assets.
- **S8:** budgets E1 and E3 run on every CI run, E2, E4 and E5 nightly (`examples/placeholder/s8/budgets.ts`).

## Audit round 2 (2026-10-11)

- **Dev host (§3.5):** a build tarball is untrusted. It may hold only regular files and folders inside the build; anything else is refused before extraction (exit 2), and its owners and modes are ignored. A failed reload rolls back to the previous live build (exit 6). `caddy.env` and `dev-host.env` must agree on `SHIP_ROOT` (exit 7). The Caddyfile imports `live.caddy` through a glob, so the shared Caddy never depends on AF's files existing.
- **test-remote (§3.6):** "no runner" is decided only from successful looks at the run, including a run where one job finished and the next was never picked up. Failed looks are retried; five in a row stop as `gh-unavailable` and leave the run alone.
- **prepare (§3.3):** the root-absolute check reads syntax, not text: scripts through oxc, pages through a tag reader that skips comments and prose, stylesheets without comments, and srcsets split as the HTML spec does.
- **Browser journeys (§3.7):** the game is served from `/b/<buildId>/` on its origin, as Ruken serves it, and nothing is served at the root, so a root-absolute URL fails the journey.
