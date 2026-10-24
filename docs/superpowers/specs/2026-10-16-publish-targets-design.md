# PUB: publish to Ruken or itch.io

- **Status:** reviewed. Drafted 2026-10-16 (PUB.0); **approved by the Owner on 2026-10-16** with the recommended defaults PUB-D1 to PUB-D4 (§10), which are now decisions.
- **Owner direction (2026-10-16):** "loosen the Ruken coupling … make it where you can publish to Ruken or itch.io easily".
- **Decision record:** [ADR 0005](../../adr/0005-publish-targets.md) (accepted 2026-10-16), which refines [ADR 0004](../../adr/0004-ruken-first-host.md).

## 0. Sources

| Source | Revision or date | Used for |
|---|---|---|
| This repo | `cc2ee8c` | The coupling inventory (§1) |
| Vendored `@ruken/sdk` (`vendor/ruken/ruken-sdk-0.0.0.tgz`) | RukenApp `b30d31b` | Handshake timeout, standalone saves, error codes, `SavesStatus` (§1, §4) |
| [itch.io: Uploading HTML5 games](https://itch.io/docs/creators/html5) | Read 2026-10-16 | ZIP and `index.html` rules, limits, embed options, compression, donations-only |
| [butler: Pushing builds](https://itch.io/docs/butler/pushing.html) and [Logging in](https://itch.io/docs/butler/login.html) | Read 2026-10-16 | `butler push`, `--userversion`, `--if-changed`, `BUTLER_API_KEY`; HTML tagging is manual after the first push |
| itch.io forum threads ([1](https://itch.io/t/1158456/html5-local-storage-seems-to-be-shared-between-multiple-games), [2](https://itch.io/t/2661408/local-storage-is-shared-between-games)) | Read 2026-10-16 | All HTML5 games share the `html.itch.zone` / `html-classic.itch.zone` origins, so they share `localStorage` and its quota. Blocking third-party storage can deny it. These are developer reports plus a staff reply, not a formal itch.io guarantee, so PUB.3 tests the behavior instead of trusting it |

## 1. The coupling today (measured)

| Where | What ties it to Ruken | Effect on an itch.io upload today |
|---|---|---|
| `packages/host/src/hosting-live.ts` `makeHosting` | Always calls `Ruken.init`. Inside any frame that is not Ruken's, the SDK waits `HANDSHAKE_TIMEOUT_MS = 1e4` before returning its standalone session | itch.io runs every HTML5 game in an iframe, so the game shows nothing for **10 s** on every load, then logs "Ruken handshake failed inside a frame" |
| The SDK's standalone saves | `localStorage` under `ruken:<gameId>:`, or **memory** when storage is unavailable (`saves-local.ts`) | Where itch.io's frame is denied storage, progress silently lasts only for the session |
| `packages/host/src/hosting.ts` | `kind: 'ruken' \| 'standalone'`. Types come from `@ruken/sdk` | Fine as a vocabulary (§3); `kind` cannot name another host |
| `packages/ship` (`cli.ts`, `prepare-build.ts`, `publish-to-ruken.ts`) | `prepare` writes `ruken.toml`; `publish` runs `ruken publish` | No way to package or push for itch.io |
| `packages/ship/src/config/ship-config.ts` | `ShipConfig` is Ruken's `Manifest` shape | No place for itch.io settings |
| `packages/ui/src/status/boot-failure.ts` | The exit button says "Back to Ruken" | Wrong label off Ruken |
| `packages/content/src/game/ruken-check.ts` | Checks content fields with Ruken's parser | Right for Ruken builds; unnecessary for itch-only games |
| `packages/cli/src/create-game.ts` | Generates `prepare-ruken`, a `@ruken/sdk` dependency and `ship.config.ts` | No itch.io path |

Already target-neutral: `packages/ship/src/prepare/root-absolute.ts` rejects root-absolute paths. itch.io serves each game from a subdirectory and requires relative paths, so that check applies unchanged. The sim, content, render and UI layout code do not depend on the host.

## 2. Scope

**In:**
- `ruken` and `itch` targets, chosen at build time;
- a `web` adapter that also serves any static host;
- `automata-ship prepare` and `publish --target itch`;
- an itch-like test harness;
- release CI for both targets;
- `create-game` and docs.

**Out:**
- Selling on itch.io. HTML5 projects there can only take donations; selling needs a "Downloadable" desktop build, which is the planned `host-tauri` extension.
- Portal SDKs (Poki, CrazyGames, Newgrounds, ads). The seam allows them as later Plus extensions; none is planned (PUB-D2).
- Setting the itch.io page's embed options through an API. butler cannot set them, so §6 makes them a one-time manual checklist.

## 3. The target model

- **One target per build.** `automata build --target ruken|itch|web` (and `pnpm build:itch` in a generated game) selects the target. Default: `ruken`, so existing games and CI do not change.
- **How the adapter is chosen, without run-time sniffing.**
  - `@mcthaydt/automata-host` gains a `./target` export with export conditions:
    - `automata-web` resolves to the web adapter;
    - `default` resolves to the Ruken adapter.
  - The build adds `resolve.conditions: ['automata-web']` for `itch` and `web`.
  - The runtime imports `makeHosting` from `./target`, so each bundle holds exactly one adapter. An itch bundle contains no `@ruken/sdk` code.
  - PUB.1 adds a bundle check that fails on the SDK's string literals that survive minification (`ruken:__probe__`, `needs the Ruken host`) in an `itch` build. The web adapter's own storage probe uses a different key.
- **Ruken stays the vocabulary.** `Hosting` keeps every type from `@ruken/sdk`, imported as types only. The web adapter answers in Ruken's terms:
  - It **mirrors the SDK's standalone session** wherever the SDK defines one (§3.1).
  - It **adds** what a page outside Ruken can observe (visibility, input mode, viewport, fullscreen).
  - It **never falls back to memory** for saves.
- **`kind` names the target.** `Hosting.kind` becomes `'ruken' | 'standalone' | 'web'`, and a new `hosting.hostName` gives a label for UI (`'Ruken'`, `'itch.io'` or `'this page'`). This is a contract change to [M1 shared contracts](./2026-10-11-m1-shared-contracts-design.md) §1, owned by the host lane. `runtime` (boot) and `ui` (boot failure) consume it.

### 3.1 Web adapter behavior (`packages/host/src/hosting-web.ts`)

| `Hosting` member | Web adapter | The SDK's standalone session (`standalone.ts` at `b30d31b`) |
|---|---|---|
| `ready` | Resolves at once; there is no handshake | The same |
| `player` | `{ id: 'standalone', displayName: '' }` | The same |
| `locale` | `navigator.language`, else `en` | The same |
| `granted` | `lifecycle`, `input`, `display`, `audio`, and `saves` only when the storage probe succeeds | An empty set, with saves working anyway |
| `lifecycle` | Page Visibility and window focus become `active` or `background` with reasons, so the game pauses in a background tab | Always `active` |
| `input` | Pointer, keyboard and gamepad mode, from real events | Always `keyboard-mouse` |
| `display` | `visualViewport` metrics and orientation | Fixed landscape metrics |
| `saves` | `localStorage` under `ruken:<gameId>:` (the SDK's prefix). A failed probe: `saves` is not granted and every call fails `HostError{code:'DENIED'}`. A full quota: `QUOTA_EXCEEDED` (itch.io games share one origin's quota) | The same prefix, but memory when storage is unavailable |
| `savesStatus`, `flush` | `saved`; `{ persisted: 'host-outbox' }` | The same |
| `setFullscreen` | Element Fullscreen API on the game root; `support` reports what the browser allows. itch.io's frame allows fullscreen | `{ fullscreen: false, support: 'none' }` |
| `round`, `track` | No-ops (`track` never fails, by contract) | The same |
| `exit` | Fails `UNSUPPORTED`; the UI hides "Back to …" when `exit` is not granted | Does nothing |
| `onMenuRequest`, `onExiting` | Registered but never called | The same |
| Leaderboards, entitlements, store, ads | Not granted; calls fail `UNSUPPORTED` | The same |

The web adapter therefore keeps every behavior the SDK defines for standalone, and adds real lifecycle, input, display and fullscreen. The one deliberate difference is storage: it reports blocked storage instead of keeping saves in memory.

**No silent fallback (AGENTS.md "Honor host authority").** On the `itch` target, device storage *is* the host's storage, declared at build time. That is not a fallback. When the browser blocks it, the game is told (`saves` is not granted, and calls fail `DENIED`), and the UI shows "Progress won't be saved in this browser". A Ruken build never uses the web adapter.

## 4. Ship: `--target itch`

**`ShipConfig` gains an optional `itch` section beside Ruken's manifest fields, which are unchanged:**
```ts
export default defineShipConfig({
  game: { id: 'emberwick', version: '1.2.0', entry: 'index.html', /* Ruken's fields */ },
  // ...runtime, network, content: unchanged
  itch: { project: 'mcthaydt/emberwick', channel: 'html5' },
})
```
`project` is `user/game`, lower-case, as butler requires. `channel` defaults to `html5`.

**`automata-ship prepare --target itch`** checks, in this order, before writing anything:
1. The tag matches `game.version` (existing check).
2. No root-absolute paths (the existing `root-absolute.ts`).
3. No secret in the build: the scan Ruken's `prepare` runs (QB.2, `secret-scan.ts`), because a page on itch.io is public. The error names the file and place, never the secret. (Added when main's QB.2 merged into PUB.2, 2026-10-24.)
4. `index.html` exists at the build root. itch.io requires that name, so a different `game.entry` is an error that says so.
5. itch.io's documented limits: at most 1,000 files; paths of at most 240 characters; no file over 200 MB; at most 500 MB in total. These live in one file, `packages/ship/src/targets/itch-limits.ts`, with the source URL and the date read.
6. Every relative reference matches a file's exact case. itch.io is case-sensitive; a Mac's disk usually is not.
7. No `ruken.toml` in the output.

It then writes `<id>-<version>-itch.zip` with sorted entries and fixed timestamps, so the same build gives the same bytes. The zip is for a manual upload; butler does not need it.

**`automata-ship publish --target itch`** runs `prepare`, then:
```
butler push <dist> <project>:<channel> --userversion <game.version> --if-changed
```
It needs `BUTLER_API_KEY`, and fails early, with how to get one, when the key or the `butler` binary is missing. butler's output and exit status are relayed unchanged. The Ruken path (`prepare`, `publish`, `deploy-dev` without `--target`) does not change.

## 5. Flows

1. **Develop:** `pnpm dev` runs under the fake Ruken host, as today. `pnpm dev --target itch` serves the game in the itch-like frame (§7).
2. **Build:** `pnpm build` gives a Ruken build; `pnpm build:itch` gives an itch build. Both come from the same commit, and the sim golden is identical for both (the sim does not know the target).
3. **Publish by hand:**
   - `pnpm publish:ruken` needs `RUKEN_API` and `RUKEN_TOKEN`.
   - `pnpm publish:itch` needs `BUTLER_API_KEY` and butler.
4. **Publish from CI:** `game-release.yml` runs the existing Ruken job. It adds an `itch` job when the caller passes `itch: true` (a workflow condition cannot read `ship.config.ts`; ship then fails without an `itch` section). The job never runs for a pull request. Opted in without the `BUTLER_API_KEY` secret, it fails, naming the secret, instead of skipping (PUB.4). Each job builds its own target from the tagged commit: the itch job runs the `itch-build-command` input (`pnpm build:itch`), installs a pinned, checksum-verified butler, and runs `automata-ship publish --target itch`.
5. **First itch.io push only:** the Owner sets the project's options by hand (§6). `publish --target itch` prints that checklist when butler reports a new channel.

## 6. First-push checklist for itch.io (printed by ship, and in the docs)

1. Set "Kind of project" to **HTML**. The default is "Downloadable".
2. On the uploaded `html5` build, tick **This file will be played in the browser**.
3. Embed options:
   - **Embed in page**: viewport = the game's `size`, scaled to fit the page, or **Click to launch in fullscreen**. AF's `ui` geometry already adapts to any size.
   - **Mobile friendly**: on, with the orientation the game supports.
   - **Fullscreen button**: on.
   - **Automatically start on page load**: off, so audio can start on a click.

## 7. Tests

| Layer | What | Where |
|---|---|---|
| Unit (Node, `TestClock`) | The web adapter's contract suite: the same cases as the Ruken adapter, where they apply. Pinned differences: `exit`, a blocked storage probe, `QUOTA_EXCEEDED`, no handshake wait | `packages/host/src/hosting-web.test.ts` |
| Unit | Each `prepare --target itch` check fails on its own fixture: no `index.html`, 1,001 files, a 241-character path, a case mismatch, a root-absolute path. The zip is byte-identical when built twice | `packages/ship/src/targets/*.test.ts` |
| Unit | `publish --target itch` passes the exact butler arguments through a fake `ProcessRunner`. A missing key or binary fails before any process starts | `packages/ship/src/publish/publish-to-itch.test.ts` |
| Build | An `itch` build of the placeholder contains no Ruken SDK marker; a `ruken` build still does | `packages/ship` |
| Browser (Playwright: Chromium, WebKit; Pixel 7 and desktop) | The itch-like harness serves the build from origin B under a subdirectory, inside an iframe on origin A, with `allowfullscreen`. It asserts: <br>• ready within 2 s (today: 10 s) <br>• no console errors <br>• a save survives a reload <br>• with storage blocked, saves are not granted and the notice shows <br>• fullscreen toggles <br>• "Back to …" is hidden | `tooling/itch-harness`, run by `games/placeholder` and `games/emberwick` E2E |
| Parity | The golden replay hash is identical for the `ruken` and `itch` builds | Existing parity suite, with a second build |

## 8. Ownership and failure policy

**Ownership:**
- `hosting-web.ts` and `./target`: the **host** lane.
- `targets/`, `publish-to-itch.ts` and the harness: **ship**.
- The `hostName` label in `boot-failure.ts`: **ui**.
- `create-game`: integration.
- Ruken's adapter is unchanged and still follows every Ruken rule.

**Failures:**
- A missing `itch` config, key or butler binary stops `publish --target itch` before any upload, naming the missing piece.
- A failed limit check names the file and the limit.
- A butler failure is relayed with its exit status, and nothing is retried silently.
- A blocked-storage player is told, and the game runs on.

## 9. Requests to Ruken (the Owner files them; links are recorded here)

1. A supported way to start a standalone session without the handshake wait (for example `init({ standalone: true })`). Today only the test-only `env` seam does it, so AF writes its own web adapter. With this option, the web adapter could reuse the SDK.
2. Standalone saves should report when they fall back to memory, instead of granting `saves` silently.
3. A `SavesFlushRes.persisted` value for device storage (for example `'device'`). Until then, the web adapter answers `'host-outbox'`, as the SDK's standalone session does.

## 10. Owner decisions (approved as recommended, 2026-10-16)

| ID | Question | Recommended default | Why |
|---|---|---|---|
| PUB-D1 | How does a game know its host? | **At build time** (`--target`) | No 10-second wait, smaller bundles, and no guessing. Detecting at run time would still have to wait for a handshake that never comes on itch.io |
| PUB-D2 | Free or Plus? | **itch.io and web targets are core (free).** Portal SDKs (Poki, CrazyGames) would be Plus extensions later | Publishing anywhere is part of the foundation; a raylib-spirited framework doesn't charge to ship |
| PUB-D3 | What does `create-game` set up? | **Both targets**: `build`/`publish:ruken` and `build:itch`/`publish:itch`, with `itch.project` left for the developer to fill in | "Publish to Ruken or itch.io easily" from the first commit |
| PUB-D4 | AGENTS.md wording | "Ruken first" stays for contracts and process; **Ruken is the reference host, and itch.io is a supported target** (ADR 0005) | It loosens where games ship without forking the contract |

## 11. Tasks

| ID | Task | Owner | Depends on | Deliverable and acceptance |
|---|---|---|---|---|
| PUB.0 | This spec and ADR 0005, reviewed | integration | — | Owner review; PUB-D1 to PUB-D4 confirmed or changed |
| PUB.1 | Web adapter and `./target` | host | PUB.0 | §3, §3.1. The contract suite green on both adapters (PUB-a). The bundle marker check. The `kind`/`hostName` change in shared contracts §1 |
| PUB.2 | `ship --target itch` | ship | PUB.0 | §4: the checks, the deterministic zip, butler publish (PUB-b) |
| PUB.3 | itch-like harness and E2E | ship + testing | PUB.1, PUB.2 | §7 browser rows on `games/placeholder`, then Emberwick. Two-build golden parity (PUB-c) |
| PUB.4 | Release CI and UI label | ship + ui | PUB.2 | The `itch` job in `game-release.yml`; "Back to …" driven by `hostName` and hidden without `exit` |
| PUB.5 | `create-game` and docs | integration | PUB.3, DX.5 | Both targets in a generated game; a "Publish to itch.io" guide with §6; a website row for DX.10 once PUB.3 is green (PUB-d) |

## 12. Acceptance

- **PUB-a:** the same contract cases pass on the Ruken and web adapters. Each intended difference is pinned by a test named after it.
- **PUB-b:** each itch check fails on its fixture with the file and limit named. Two builds give byte-identical zips. butler gets the exact arguments, and nothing runs without the key.
- **PUB-c:** in the itch-like harness, the placeholder and Emberwick are ready within 2 s on Pixel 7 and desktop in Chromium and WebKit, with no console errors. A save survives a reload. Blocked storage shows the notice. The golden hash matches the Ruken build's.
- **PUB-d:** a freshly generated game runs `pnpm build:itch` green with no edits. The Owner pushes one game to a real itch.io page and records the URL, device and date. That last step is the Owner's acceptance; an agent never ticks it.
