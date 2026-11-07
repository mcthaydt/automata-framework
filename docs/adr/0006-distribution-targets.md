# ADR 0006: Distribution targets are peers (Ruken, itch.io, Tauri, web)

- Status: Accepted (Owner, 2026-10-31; see Context for the words)
- Date: 2026-10-31
- Supersedes: [ADR 0004](0004-ruken-first-host.md) (Ruken first) where it makes Ruken's contracts win across AF
- Refines: [ADR 0005](0005-publish-targets.md) (publish targets); law 7 (the host is a port)

## Context
The Owner, 2026-10-31: "Let's not couple the automata framework so tightly to Ruken - that's just one of the many places
we can distribute content to easily; we have tauri export, Ruken export, and itch export". Also 2026-10-31: "Reminder
that everything is auto approved and accepted, do not wait on me to do any approvals".

ADR 0005 already lets a game choose `ruken`, `itch` or `web` at build time, but Ruken still owns AF's vocabulary:
- `Hosting`'s capability names, payloads and error codes are `@ruken/sdk` types, and `game`, `runtime`, `ui` and
  `testing` import `@ruken/sdk` directly besides `host`.
- The tests' fake host is `@ruken/sdk-host`, so every game's journey is tested as a Ruken game.
- AGENTS.md says "Ruken's contracts win" and requires every game to meet Ruken's limits.
- The desktop build (`host-tauri`, M7.11) is a deferred Plus extension, though selling on itch.io needs one.

## Decision
- **Four distribution targets, all peers, all core and free:** `web` (any static host), `itch` (HTML5, and Downloadable
  through the `tauri` build), `ruken`, and `tauri` (desktop: Windows, macOS, Linux). A game declares its target at build
  time (ADR 0005, unchanged); no target is the default reference.
- **AF owns the host contract.** `@mcthaydt/automata-host` defines `Hosting`'s capability names, payloads and error codes
  in its own Zod schemas. Each target's adapter maps AF's contract to its platform; the Ruken adapter is the only code
  that imports `@ruken/sdk`, and a `pnpm boundaries` rule enforces it. Ruken's names are kept where they already fit, so
  the change is a move of ownership, not a rename.
- **AF tests with its own fake host.** `@mcthaydt/automata-testing` ships a fake host that implements AF's contract for
  every target. `@ruken/sdk-host` stays only in the Ruken adapter's contract tests.
- **Each target owns its facts and checks.** Ruken's limits and manifest come from `@ruken/manifest` and `ruken publish`,
  applied only when the target is `ruken`. itch.io's limits stay in their single cited file (ADR 0005). Tauri's bundle
  checks live in the `tauri` target. A game is held to the limits of the targets it builds for, not to Ruken's.
- **`tauri` moves into core** (`automata-ship build --target tauri`), superseding M7.11's deferred Plus extension. CI
  builds unsigned bundles; code signing and notarization use the Owner's credentials.
- **Unchanged:** the seven laws, the host-authority rule inside each target (a denied capability never silently falls
  back to device storage), the no-`eval` rule for every web build, and Ruken as a fully supported target.

## Consequences
- **A breaking change to published host types.** The packages are 0.x, so it is a minor bump with changesets and a
  migration note; consumers that imported `@ruken/sdk` types through AF switch to `@mcthaydt/automata-host`'s.
- **Four adapters at parity.** The host contract suite runs against every adapter; a pinned test records each
  difference.
- **Docs and copy.** AGENTS.md's "Ruken first" rules become "target-neutral core"; the website and `create-game` present
  the four targets equally. The master specs' Ruken-first sections are read through this ADR until they are revised.
- **Rows:** DIST.0 to DIST.6 in `docs/archive/02-master-delivery-plan.md`.
