# QB.1f: repack the vendored Ruken tarballs from RukenApp main and drop the zod override, TDD plan

- **Spec:** [QB spec](../specs/2026-10-16-quality-bar-design.md) §2 (the dependency audit); vendoring rule D-6 (master spec §12) and D-8 ([M2 build and publish spec](../specs/2026-10-11-m2-build-and-publish-design.md) §3.4: the published packages that bundle Ruken code). No spec change.
- **Task:** 02 row "Follow-up (found in QB.1e): Drop the zod override when the vendored Ruken tarballs are repacked". Lane ship. Follows [QB.1e](2026-10-23-qb1e-zod-4-6-6.md), which added the override.
- **Status:** drafted 2026-10-30, based on `main` (`b7ef19d`).
- **Progress:** 3 of 6 steps.

## What is wrong

`pnpm-workspace.yaml` overrides `zod` to 4.6.6 for the whole workspace because the vendored `@ruken/cli` and `@ruken/sdk-host` tarballs (packed from RukenApp `b30d31b` on 2026-10-11) declare `zod` 4.6.5 exactly, which GHSA-mrhx-c7xc-m3w5 covers. RukenApp `main` now pins 4.6.6 in every one of the four packages AF vendors (checked at `d0fa2fe766d532a293c3723d5ba3102d1e602d63`, 2026-10-28 09:31 -05:00: `packages/sdk`, `packages/sdk-host`, `packages/manifest`, `tooling/ruken-cli`). Repacking from there lets the override go.

## What changed in Ruken between `b30d31b` and `d0fa2fe` that AF consumes

Read from `git diff b30d31b d0fa2fe` in a scratch clone (1577 commits) and from a diff of the old and new tarballs' `dist/`. The SDK's runtime changes are small and additive:

| Area | Change at `d0fa2fe` | Does AF rely on it? |
|---|---|---|
| Saves | SDK unchanged. `@ruken/sdk-host` adds `HostBridge.retrySync()` (the host's "Try syncing again") | No: AF is the game side; the fake host's saves behave as before |
| Leaderboards | `LeaderboardsApi.get` and the `leaderboard.get` schemas are `@deprecated`: Ruken's host now answers with the player's own entry only (Ruken M4.2, achievements). The call and its shape are unchanged; the fake host's leaderboard adapter is unchanged | Yes, `Hosting.leaderboards.get` relays it. Its doc comment says "the top entries or those around the player", which is no longer what Ruken answers: corrected (step 4). AF keeps the call (decision below) |
| Locale | Unchanged | |
| Lifecycle | Unchanged | |
| Handshake | `welcome` may carry an optional `ads: { rewarded }` (Ruken M7.2); the SDK's welcome guard accepts it, and `RukenSession.ads.rewarded()` is new (resolves `unavailable` unless the host announced rewarded ads) | No: AF reads no `ads` field and exposes no ads API. A follow-up for M7 |
| Host origins | The SDK's `isAllowedHostOrigin` now also trusts Ruken's private beta sites, `https://ruken-beta.netlify.app` and `https://ruken-beta-admin.netlify.app`, as exact strings | Yes: AF trusts the host the SDK trusts (never its own allowlist). Pinned by a new host test (step 2) |
| Manifest | `MANIFEST_ERROR_CODES` loses `STORE_NOT_AVAILABLE` and gains achievement, stream, store and leaderboard-title codes; optional `[achievements]`, `[streams]` and `[store]` tables; `private`'s `frame-ancestors` adds the two beta sites; `hostOriginsFor` takes extras for `test` too | AF writes none of the new tables and names no error code; `compileHeaders` is called with `local` or explicit `hostOrigins`, never `private`. The full suites prove it |
| CLI | `ruken publish --studio`, clearer refusals (`AGREEMENT_REQUIRED`, `UPLOADS_NOT_OPEN`), new `card-video`, `profile` and `drop` commands; the validation it bundles knows the server's new `sdk_handshake` and `headless_boot` checks but skips them locally (no `--boot` yet). Same exit codes (0, 1, 2, 3, 4) and the same four runtime dependencies (`smol-toml` 1.9.0, `yauzl` 3.4.0, `yazl` 3.3.1, `zod` 4.6.6) | `ship publish` spawns `ruken publish <dir>` and maps the exit codes: unchanged |

## Decisions

- **Repack in a scratch clone**, never in `/home/user/rukenapp`: `git clone --depth=1 https://github.com/mcthaydt/rukenapp` into the session scratchpad, `pnpm install --frozen-lockfile`, then `vendor/ruken/README.md`'s recipe (each package's own `pnpm run build`, then `pnpm pack`). Ruken's `turbo run build` still needs a database for `@ruken/db#db:generate`, and these four packages do not.
- **Drop the override and its comment** from `pnpm-workspace.yaml`. `docs/versions.md`'s `zod` row never named the override (QB.1e changed only its version); the stale cross-reference was the override's own comment, which goes with it.
- **Pin the new trusted host origins in a host test**, as `saves.test.ts` pins the SDK's ungranted-write behaviour: a re-vendor that changes which hosts the SDK trusts shows up in AF. The origins are written in the test (a fixture), not exported or redefined by AF.
- **Keep `Hosting.leaderboards.get`, undeprecated,** and correct its doc comment to say what Ruken answers now. Moving AF's board screens to Ruken's achievements is product work for its own milestone (follow-up).
- **Re-check every comment that cites the vendored SDK at `b30d31b`** in `packages/host` and `packages/ship` (`sdk-markers.ts` asks for it) and move the commit to `d0fa2fe` where the claim still holds; provenance notes of code ported from Ruken at `b30d31b` stay as they are (history).
- **One patch changeset** for the published packages whose `dist/` carries Ruken code (`content`, `host`, `ship`, `testing` bundle it, `ui` vendors the SDK's types). `cli` bundles `@ruken/manifest` too but is private, so it is not named.

## Files

- **Modify:** `vendor/ruken/ruken-{sdk,sdk-host,manifest,cli}-0.0.0.tgz` (repacked), `vendor/ruken/README.md`, `pnpm-workspace.yaml`, `pnpm-lock.yaml` (by `pnpm install`, never by hand), `packages/host/src/test-host-origin.test.ts`, `packages/host/src/hosting.ts` (doc comment), `packages/host/src/sdk-markers.ts`, `packages/host/src/menu.ts`, `packages/host/src/hosting-web.ts`, `packages/host/src/saves.test.ts`, `packages/host/src/requests.test.ts` (comments), `packages/ship/src/publish/publish-to-ruken.ts` (comment), `docs/stack.md` (by `pnpm docs:stack`), and whatever `pnpm api-report --update`, `pnpm agent-skills --write` and `pnpm cheatsheet` write; this plan.
- **Create:** `.changeset/qb1f-ruken-d0fa2fe.md`.

## Interfaces

None of AF's change. Consumed: `@ruken/sdk`, `@ruken/sdk-host`, `@ruken/manifest` and `@ruken/cli` at RukenApp `d0fa2fe` (additive changes listed above). Produced: the same AF APIs; `HostingLeaderboards.get`'s doc comment only.

## Steps

- [x] **1. Plan.** This file.
- [x] **2. Red.** (a) With the `b30d31b` tarballs, remove the override and run `pnpm install`: `pnpm audit:deps` exits 1 on GHSA-mrhx-c7xc-m3w5 through `@ruken/sdk-host>zod` (put the override back before going on). (b) A new test in `packages/host/src/test-host-origin.test.ts`: a welcome from `https://ruken-beta.netlify.app` makes the game hosted with no `testHostOrigins`, and one from another `*.netlify.app` site leaves it standalone. Run `pnpm --filter @mcthaydt/automata-host exec vitest run src/test-host-origin.test.ts`: the first case fails (`standalone`, expected `ruken`).
- [x] **3. Green.** Repack the four tarballs from `d0fa2fe` into `vendor/ruken/`; update the README (source commit, date, SHA-256s, the CLI's runtime dependencies, no override note); drop the override; `pnpm install`. Expected: the lockfile holds no `zod@4.6.5` and no `overrides`; `pnpm audit:deps` exits 0; the step 2 test passes; the host contract suite (`hosting-web.test.ts`) and every host test pass; `vendor.test.ts` still completes the handshake.
- [ ] **4. Prove what moved.** Re-check the `b30d31b` claims (step 4 decision) and update them; correct `HostingLeaderboards.get`'s comment; `pnpm docs:stack`; the changeset; then the gates below, regenerating what `api-report`, `api-index`, `cheatsheet` and `agent-skills` ask for.
- [ ] **5. Check the CLI alone.** Extract the new `ruken-cli-0.0.0.tgz` into a scratch folder with only its four declared runtime dependencies installed: `node dist/cli.js` prints the usage (exit 2), as the README claims.
- [ ] **6. Hand off.** Draft PR listing every Ruken change AF consumes, the gates and the decisions.

## Gates

- Selected: `pnpm audit:deps`; the host contract suite and every host test (`pnpm --filter @mcthaydt/automata-host test`); `pnpm format`, then `TURBO_FORCE=true pnpm check`; parity for host, testing and ship (only `@mcthaydt/automata-testing` has a `test:parity` script; host and ship have none, which the log records); `pnpm build && node tooling/consumer-smoke/src/run.ts --from packs`; `pnpm api-report`, `pnpm api-index`, `pnpm agent-skills`; `pnpm changeset status --since=origin/main` and `node tooling/release/src/check-changesets.ts`; `pnpm --filter @mcthaydt/release test:dist`.
- Omitted, and why, are recorded in the execution log when the gates run.

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
| 2026-10-30 | 1 | | Plan. RukenApp `main` at `d0fa2fe766d532a293c3723d5ba3102d1e602d63` (the local shallow clone and `origin/main` agree); `b30d31b09ef4561327a68c62951b26dabe725b28` reached with `git fetch --depth=2000 origin main` in the scratch clone. |
| 2026-10-30 | 2 | | Node 24.21.0. (a) Override removed with the `b30d31b` tarballs, `pnpm install`: the lockfile gains `zod@4.6.5` again and `pnpm audit:deps` exits 1, "1 vulnerabilities found, Severity: 1 high", GHSA-mrhx-c7xc-m3w5, path `tooling__examples-runner>@ruken/sdk-host>zod`. Override and lockfile restored, `pnpm install --frozen-lockfile`. (b) `vitest run src/test-host-origin.test.ts`: 2 failed, 4 passed; both beta-site cases "expected 'standalone' to be 'ruken'" (the old SDK does not trust them); the other netlify.app site already standalone. |
| 2026-10-30 | 3 | | Scratch clone `git clone --depth=1 https://github.com/mcthaydt/rukenapp` at `d0fa2fe` (same as `/home/user/rukenapp`, untouched), `pnpm install --frozen-lockfile` (9.7 s), then the README's loop: all four `tsdown` builds pass and `pnpm pack` writes into `vendor/ruken/`. Packed twice (a staging folder, then `vendor/ruken/`): `ruken-manifest` has the same SHA-256 both times; `ruken-sdk`, `ruken-sdk-host` and `ruken-cli` differ only in the order of the `@ruken/*` dev dependencies `pnpm pack` writes into `package.json` (`diff -r` of the extracted `dist/` is empty), so the README says the hashes are of the files in the folder. Old and new `dist/` diffed: the changes in the table above, nothing else. Override and comment dropped; `pnpm install` changes only the four integrities and removes `overrides` from the lockfile; no `zod@4.6.5` left. `pnpm audit:deps` exit 0, "No known vulnerabilities found". `vitest run src/test-host-origin.test.ts` 6 of 6; `pnpm --filter @mcthaydt/automata-host test` 15 files, 138 tests pass (the contract suite in `hosting-web.test.ts` over the fake Ruken host and the web adapter, `vendor.test.ts`'s real-SDK handshake, `target.build.test.ts`'s SDK markers). |
