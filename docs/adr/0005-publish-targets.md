# ADR 0005: Publish targets (Ruken is the reference, itch.io is a peer)

- Status: Accepted (Owner, 2026-10-16, with the PUB.0 spec)
- Refined by [ADR 0006](0006-distribution-targets.md) (2026-10-31): Ruken is no longer the reference host; `tauri` joins `web`, `itch` and `ruken` as a core target.
- Date: 2026-10-16
- Refines: [ADR 0004](0004-ruken-first-host.md) (Ruken first); law 7 (the host is a port)
- Spec: [publish targets](../superpowers/specs/2026-10-16-publish-targets-design.md)

## Context
The Owner asked on 2026-10-16 to "loosen the Ruken coupling … so you can publish to Ruken or itch.io easily". ADR 0004 already keeps standalone web as a supported second adapter, but in practice everything assumes Ruken:
- `makeHosting` always calls `Ruken.init`. Inside any frame that is not Ruken's, the SDK waits `HANDSHAKE_TIMEOUT_MS = 1e4` before falling back (vendored `@ruken/sdk` at `b30d31b`). itch.io serves every HTML5 game inside an iframe, so an AF game there boots after a 10-second blank wait and logs a failed handshake.
- `automata-ship` prepares and publishes for Ruken only (`ruken.toml`, `ruken publish`).
- The boot-failure panel's exit button says "Back to Ruken".

## Decision
- **A game declares its publish target at build time** (`ruken` or `itch`, with `web` for any static host). AF does not sniff the page at run time. Each target bundles exactly one `Hosting` adapter, so an itch build contains no `@ruken/sdk` code and never waits for a handshake. A declared target is not a silent fallback: the AGENTS.md rule against switching to device storage when a hosted capability is denied still holds inside each target.
- **Ruken stays the reference host.** `Hosting` keeps Ruken's vocabulary: capability names, payload types and error codes are imported from `@ruken/sdk` as types only. The web adapter implements the same contract. It reports what it cannot do with Ruken's own codes (`UNSUPPORTED`, `DENIED`), and the game handles those the same way on either host.
- **Each target owns its facts in one place.** Ruken's limits come from `@ruken/manifest` (unchanged). itch.io publishes no package, so its documented limits live in a single AF file that cites the itch.io page and the date it was read.
- **Publishing to any target is core and free.** Other web portals with their own SDKs (Poki, CrazyGames, Newgrounds) can later be Plus extensions on the same seam. None is planned now.

## Consequences
- **Two adapters to keep at parity.** The web adapter gets the same contract suite as the Ruken adapter. Where the behavior differs, a test pins the difference.
- **Ruken's role in the rules.** "Ruken first" still decides contracts and process. It no longer means "Ruken only" for where games ship.
- **Selling on itch.** itch.io HTML5 projects can only take donations; to sell, a project must be "Downloadable". Selling games on itch therefore needs a desktop build (the planned `host-tauri` extension), which is outside this ADR.
