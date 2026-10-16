# PUB.4: release CI and UI label TDD plan

- **Spec:** [PUB spec](../specs/2026-10-16-publish-targets-design.md) §3, §3.1 (`exit`), §5 flow 4, §8, §11 PUB.4; [ADR 0005](../../adr/0005-publish-targets.md).
- **Status:** drafted 2026-10-16 (PUB.0 Owner-approved 2026-10-16 with every recommended default). Owner review pending.
- **Lanes:** ship (release job) and ui (label). **Branch:** `claude/clever-pasteur-ujmu6e-pub4`, stacked on PUB.2 (`claude/clever-pasteur-ujmu6e-pub2`, PR #41).

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

- [x] **1. Release job shape.** `workflows.test.ts`, a new `describe('game-release.yml itch job (PUB spec §5)')`:
  - the job exists, is gated on `inputs.itch` and on the event not being `pull_request` or `pull_request_target`;
  - `itch` (boolean, default false) and `itch-build-command` (default `pnpm build:itch`) are inputs; `BUTLER_API_KEY` is a secret, not required at the call;
  - its first step checks `BUTLER_API_KEY` and `exit 1`s with `::error::` naming it (no `exit 0`, no `::notice::` skip);
  - it builds with `$ITCH_BUILD_COMMAND`, installs butler 15.32.0 with a `sha256sum` check, and runs `pnpm exec automata-ship publish --target itch --tag "$TAG"` with the key in `env`;
  - it does not download `release-dist` and does not run the Ruken `prepare`.

  Fails: no `itch` job. Add the job; the existing every-workflow and reusable-workflow tests stay green.

- [x] **2. View model.** `boot-failure.test.ts`: the existing table gains `canExit`; new rows: Ruken without `exit` gives a final `progress` and `unsupported` panel; `withHostName('Back to {host}', 'itch.io')` is `Back to itch.io`; the exit copy holds `{host}`. Fails: `bootFailureView` ignores `canExit`, `withHostName` missing. Add both.
- [x] **3. Panel (DOM behavior).** `boot-failure-panel.test.ts`: "Back to Ruken" calls `onExit` with `hostName: 'Ruken'`; with `hostName: 'itch.io'` the button reads "Back to itch.io"; with `canExit: false` no "Back to" button exists and a renderer failure is a final panel; a game's own `exit` copy with `{host}` is filled; Continue still works standalone. Fails: props ignored, label is the raw template. Add the props; update `StatusFixture.svelte`, `Frame.svelte`, the index export.
- [x] **4. Runtime.** `failure-host.test.ts`: no Hosting gives `standalone`, `this page`, no exit; a `ruken` session with `exit` granted gives `Ruken` and `canExit`; a session without `exit` gives no exit. `run-game.test.ts`: the existing Back to Ruken test stays green; under the SDK's standalone session (no `exit`), a renderer failure draws no button. Fails: module missing; the panel lacks the props. Add `failure-host.ts`, wire `run-game.ts`, update `page-layers.test.ts` and `boot-error.test.ts`.
- [ ] **5. Docs and gates.** Spec text (ui spec, shared contracts §3, PUB spec §5); changeset; `pnpm format`; `pnpm check`; `pnpm test:parity`; `pnpm test:e2e` (`AF_E2E_SERVER_PORT=4740`, `AF_E2E_PREVIEW_PORT=4840`, `CI=1`). `actionlint` if available (`pnpm lint:actions` needs docker).

## Execution log

| Date       | Step | Commits     | Notes |
| ---------- | ---- | ----------- | ----- |
| 2026-10-16 | Plan | this commit | —     |
