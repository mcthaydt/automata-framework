---
"@mcthaydt/automata-host": patch
---

AF owns the host contract (DIST.2, ADR 0006). `@mcthaydt/automata-host` now defines the capability names, error codes and
payloads in its own Zod schemas: `CAPABILITIES`, `ERROR_CODES`, a `*Schema` per payload and their types. The names are
Ruken's, kept where they fit, and a test holds them to the vendored SDK. `Hosting.kind` adds `'tauri'`. The web adapter's
`saves.flush` answers `{ persisted: 'device' }`.

BREAKING: the root entry no longer exports an adapter. `HostingLive` and `makeHosting` come from
`@mcthaydt/automata-host/target` only, and `toHostError` is internal to the Ruken adapter. `ErrorCode`, `Hosting`,
`HostingLeaderboards` and `HostingSaves` are typed by AF's own contract (the same names and shapes as Ruken's;
`Hosting.kind` adds `'tauri'`, `SavesFlushRes.persisted` adds `'device'`, the leaderboard `meta` and `query` are
`LeaderboardSubmitMeta` and `LeaderboardQuery`). `./target` resolves to the web adapter by default: a Ruken build adds
the `automata-ruken` condition, `resolve: { conditions: ['automata-ruken', ...defaultClientConditions] }`. The
`automata-web` condition is unchanged.

Migration:

| Before | After |
| --- | --- |
| `import type { Capability, LifecyclePayload, … } from '@ruken/sdk'` | `from '@mcthaydt/automata-host'` (same names) |
| `RukenError['code']` | `ErrorCode` from `@mcthaydt/automata-host` |
| `Parameters<LeaderboardsApi['submit']>[2]`, `Parameters<LeaderboardsApi['get']>[1]` | `LeaderboardSubmitMeta`, `LeaderboardQuery` |
| `import { HostingLive, makeHosting } from '@mcthaydt/automata-host'` | `from '@mcthaydt/automata-host/target'` |
| A Ruken build or test with no condition | add the `automata-ruken` condition |
| `flush` answering `host-outbox` on the web adapter | `device` |
