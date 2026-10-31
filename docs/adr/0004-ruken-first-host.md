# ADR 0004: Ruken first

- Status: Accepted by Owner direction (2026-10-11); written-spec review pending
- Superseded in part by [ADR 0006](0006-distribution-targets.md) (2026-10-31): Ruken is one of four peer targets and AF owns the host contract.
- Date: 2026-10-11
- Refined by: [ADR 0005](0005-publish-targets.md) (proposed 2026-10-16): Ruken is the reference host, and itch.io is a supported publish target
- Refines: law 7 and §7 of the [2026-10-01 master spec](../superpowers/specs/2026-10-01-automata-framework-overview-design.md); the S6 verdict

## Context
The 2026-10-01 design treated Ruken, standalone web and Tauri as equal adapters, and planned to build a Ruken adapter against an AF-owned stub of the P01 spec because Ruken's SDK existed only on paper. That has changed: Ruken M1 (hosting FloorFifty) was Owner-accepted on 2026-10-09; `@ruken/sdk`, `@ruken/sdk-host` (with a fake host for tests), `@ruken/manifest`, Ruken's build validation and the `ruken` CLI all exist in `mcthaydt/RukenApp`, and FloorFifty already runs through them. The Owner directed on 2026-10-11 that "AF needs to be Ruken first".

## Decision
- Ruken is the reference host. `Hosting` follows Ruken's catalog, capabilities, limits and failure codes; other adapters match Ruken's behavior where Ruken defines it.
- AF consumes Ruken's packages instead of re-deriving them: `@ruken/sdk` in the host adapter, `@ruken/sdk-host`'s fake host in tests and `cli dev`, `@ruken/manifest` to check generated `ruken.toml` and compile CSP headers, and `ruken publish`, which packs, validates and uploads. The SDK's own standalone session and handshake fallback are used as they are; AF reports a fallback but does not override it. AF never copies a Ruken limit. Until Ruken publishes them, AF vendors tarballs with their Ruken commit recorded (FloorFifty's `vendor/ruken/` pattern) and re-vendors after F1 (planned 2026-10-16) and after each additive change.
- The S6 stub is retired; its contract cases and Ruken's answers move into the adapter's test suite.
- AF's delivery process follows Ruken's: numbered docs `00`–`04`, milestones with a spec frozen at the milestone's start, the same gate vocabulary, and version pins aligned with Ruken's `docs/versions.md`.
- Standalone web remains a supported second adapter with the same limits. Tauri moves to the `host-tauri` extension.

## Consequences
- Any AF need that Ruken's contract does not cover goes to Ruken as a change request; AF does not extend the protocol on its own.
- Ruken features that do not exist yet (for example the `[store]` manifest section) block the matching AF extension rather than being worked around.
- AF CI runs Ruken's fake-host journeys, so a Ruken contract change shows up as an AF failure on re-vendor.
