# PUB.4: release CI and UI label TDD plan

- **Spec:** [PUB spec](../specs/2026-10-16-publish-targets-design.md) §3, §3.1 (`exit`), §5 flow 4, §8, §11 PUB.4; [ADR 0005](../../adr/0005-publish-targets.md).
- **Status:** drafted 2026-10-16 (PUB.0 Owner-approved 2026-10-16 with every recommended default); steps 1–5 implemented and locally verified 2026-10-16. Owner review pending.
- **Split (2026-10-24):** the Owner's standing rule is that no workflow file changes without their words, so the `itch` job (step 1, `.github/workflows/game-release.yml`, its pins in `workflows.test.ts` and the PUB spec §5 flow 4 text) moved to **PUB.4b**, a separate held PR. This PR (PUB.4a) is steps 2 to 5 without the workflow file: the label, the view model, the panel, `failureHost` and the docs. PUB.4a also brought in PUB.1 and PUB.2: `failureHost` now reads `Hosting.hostName`.
- **Lanes:** ship (release job, now PUB.4b) and ui (label). **Branch:** `claude/clever-pasteur-ujmu6e-pub4`, stacked on PUB.2 (`claude/clever-pasteur-ujmu6e-pub2`, PR #41).

## Global constraints

- **Strict TDD** in `packages/` and `examples/`: write the failing test, run it, confirm the failure reason, make the minimal change, confirm green.
- **The itch job never pushes from a pull request**, and never runs unless the caller opts in. Opted in without `BUTLER_API_KEY`, it **fails closed** with a message that names the secret; it never skips silently. The Owner adds the secret with PUB.5's first real push. No agent runs a real itch.io push.
- **The job builds its own target.** It runs the game's itch build (`pnpm build:itch` by default) from the tagged commit, then `automata-ship publish --target itch --tag "$TAG"`, which prepares (checks, zip) and pushes. It does not reuse the Ruken `release-dist`: a Ruken `prepare` writes `ruken.toml`, which the itch `ruken-toml` check rejects by design (PUB.2 follow-up in 02).
- **butler is pinned.** 15.32.0 from `broth.itch.zone`, checked against a SHA-256 for `linux-amd64` and `darwin-arm64` (downloaded and hashed 2026-10-16); any other runner stops with an error.
- **`hostName` seam.** `Hosting.hostName` is PUB.1's (PR #40), not on this base. ui takes the host's name and whether `exit` is granted as **props**; ui never imports host. On this base the runtime derives them in one small function (`failureHost`): `granted.has('exit')` from the existing contract, and the name `'Ruken'` for a `ruken` session, `'this page'` otherwise. When PUB.1 merges, that function reads `hosting.hostName` and absorbs PUB.1's `failureHostKind` (recorded in 02 and the PR). The label is never copied into `host`.
- **Behavior on Ruken does not change.** Ruken always grants `exit` (sdk-host `ALWAYS_GRANTED`), so its panel still says "Back to Ruken". A session without `exit` (the SDK's standalone session, the web adapter) never shows the button.
- **No visual change expected.** No fixture or golden draws the exit button; goldens are never updated to hide a change. Visual approval stays with the Owner.

## Files

- **Modify:**
  - `.github/workflows/game-release.yml` (the `itch` job, the `itch` and `itch-build-command` inputs, the `BUTLER_API_KEY` secret, the header)
  - `packages/ship/src/workflows.test.ts` (pin the job's shape)
  - `packages/ui/src/status/boot-failure.ts`, `boot-failure.test.ts` (`canExit`, `{host}` in the exit copy, `withHostName`)
  - `packages/ui/src/status/BootFailurePanel.svelte`, `boot-failure-panel.test.ts` (`hostName`, `canExit` props)
  - `packages/ui/src/index.ts`, `index.test.ts` (export `withHostName`)
  - `packages/ui/src/testing/StatusFixture.svelte`, `examples/ui/primitives/src/Frame.svelte` (pass the new props)
  - `packages/runtime/src/boot/run-game.ts`, `run-game.test.ts`, `page-layers.test.ts`, `boot-error.test.ts`
  - Docs: the M1 ui spec (`bootFailureView`, panel props, the two exit rows), M1 shared contracts §3 rows 3 and 6, PUB spec §5 flow 4 (opt-in input, fail closed).
- **Create:**
  - `packages/runtime/src/boot/failure-host.ts`, `failure-host.test.ts`
  - `.changeset/pub4-host-label.md` (patch: ui; runtime is private)

## Interfaces

- **Consumed:** `Hosting.kind`, `Hosting.granted` (`Capability` `'exit'`), `Hosting.exit`; `automata-ship publish --target itch` (PUB.2); `ITCH_FIRST_PUSH_CHECKLIST` printed by ship.
- **Produced:**
  - `game-release.yml` inputs `itch: boolean` (default `false`) and `itch-build-command` (default `pnpm build:itch`); secret `BUTLER_API_KEY` (not required at the call; required by the job).
  - ui: `bootFailureView(failure, hostKind, canExit)`; `BOOT_FAILURE_COPY_EN.exit = 'Back to {host}'`; `withHostName(text, hostName)`; `BootFailurePanel` props `hostName: string`, `canExit: boolean`.
  - runtime: `failureHost(hosting): { hostKind, hostName, canExit }`.

## Steps

- [ ] **1. Release job shape. (Moved to PUB.4b, held for the Owner's word on `game-release.yml`; the commits are `77a48a5` and its follow-ups on this branch's earlier history.)** `workflows.test.ts`, a new `describe('game-release.yml itch job (PUB spec §5)')`:
  - the job exists, is gated on `inputs.itch` and on the event not being `pull_request` or `pull_request_target`;
  - `itch` (boolean, default false) and `itch-build-command` (default `pnpm build:itch`) are inputs; `BUTLER_API_KEY` is a secret, not required at the call;
  - its first step checks `BUTLER_API_KEY` and `exit 1`s with `::error::` naming it (no `exit 0`, no `::notice::` skip);
  - it builds with `$ITCH_BUILD_COMMAND`, installs butler 15.32.0 with a `sha256sum` check, and runs `pnpm exec automata-ship publish --target itch --tag "$TAG"` with the key in `env`;
  - it does not download `release-dist` and does not run the Ruken `prepare`.

  Fails: no `itch` job. Add the job; the existing every-workflow and reusable-workflow tests stay green.

- [x] **2. View model.** `boot-failure.test.ts`: the existing table gains `canExit`; new rows: Ruken without `exit` gives a final `progress` and `unsupported` panel; `withHostName('Back to {host}', 'itch.io')` is `Back to itch.io`; the exit copy holds `{host}`. Fails: `bootFailureView` ignores `canExit`, `withHostName` missing. Add both.
- [x] **3. Panel (DOM behavior).** `boot-failure-panel.test.ts`: "Back to Ruken" calls `onExit` with `hostName: 'Ruken'`; with `hostName: 'itch.io'` the button reads "Back to itch.io"; with `canExit: false` no "Back to" button exists and a renderer failure is a final panel; a game's own `exit` copy with `{host}` is filled; Continue still works standalone. Fails: props ignored, label is the raw template. Add the props; update `StatusFixture.svelte`, `Frame.svelte`, the index export.
- [x] **4. Runtime.** `failure-host.test.ts`: no Hosting gives `standalone`, `this page`, no exit; a `ruken` session with `exit` granted gives `Ruken` and `canExit`; a session without `exit` gives no exit. `run-game.test.ts`: the existing Back to Ruken test stays green; under the SDK's standalone session (no `exit`), a renderer failure draws no button. Fails: module missing; the panel lacks the props. Add `failure-host.ts`, wire `run-game.ts`, update `page-layers.test.ts` and `boot-error.test.ts`.
- [x] **5. Docs and gates.** Spec text (ui spec, shared contracts §3, PUB spec §5); changeset; `pnpm format`; `pnpm check`; `pnpm test:parity`; `pnpm test:e2e` (`AF_E2E_SERVER_PORT=4740`, `AF_E2E_PREVIEW_PORT=4840`, `CI=1`). `actionlint` if available (`pnpm lint:actions` needs docker).

## Execution log

| Date       | Step | Commits     | Notes |
| ---------- | ---- | ----------- | ----- |
| 2026-10-16 | Plan | `52e6369` | — |
| 2026-10-16 | 1 | `77a48a5` | Red: 6 new tests (no `itch` job). Green: 86/86 in `workflows.test.ts`. The job's key check and butler install were extracted from the YAML and run: missing key exit 1 with the `::error::`; Linux X64 install verified the hash and `butler -V` printed 15.32.0; a tampered hash and `Windows-X64` exit 1. macOS uses `shasum -a 256` when `sha256sum` is missing. Deviation from spec §5 flow 4 ("when `ship.config.ts` has `itch` and the secret exists"): the job is gated by an `itch` input, because a workflow condition cannot read `ship.config.ts` and the coordinator's rule is to fail closed, not skip; spec §5 updated. |
| 2026-10-16 | 2–3 | `9680556` | Red: 6 view-model tests (`canExit` ignored, `withHostName` missing, copy `Back to Ruken`), 3 panel tests (labels), 1 index export. The panel's hide-without-exit tests passed before the props were wired (an undefined `canExit` already filters `exit`); the label tests were the red ones. `StatusFixture.svelte` and the primitives `Frame.svelte` pass the new props; no fixture draws the exit button, so no golden changed. |
| 2026-10-16 | 4 | `bb573b3` | Red: `failure-host.ts` missing; the existing "Back to Ruken" run-game test went red after step 3 (no `canExit`). The new standalone no-exit run-game test is a guard (green before wiring, for the same reason as step 3). Runtime boot tests 43/43; runtime typecheck 0 errors. |
| 2026-10-16 | 5 | `72568b9`, this commit | `pnpm format` clean; `pnpm check` exit 0: lint, typecheck 26/26, boundaries 0 findings, style 186 files 0 findings, test:unit 22/22 (ship 238, ui 301, runtime 153 tests). `pnpm test:parity` 9/9 tasks (ui 303 tests). `pnpm test:e2e` 46 passed, `CI=1`, ports 4740/4840. actionlint 1.7.12 (release binary, since the docker daemon is absent) on every workflow: exit 0, without shellcheck. |
| 2026-10-24 | Split and catch-up | this commit | PUB.1 and PUB.2 merged in (with `main`). Red first: `failureHost` ignored `Hosting.hostName` and drew a `web` session as `web` (1 red test); now it reads the name and maps `web` to standalone, and PUB.1's stopgap `failureHostKind` (and its test) is gone. Step 1 and `game-release.yml` moved to PUB.4b. |
