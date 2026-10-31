---
"@mcthaydt/automata-testing": patch
"@mcthaydt/automata-host": patch
"@mcthaydt/automata-runtime": patch
---

AF's own fake host (DIST.4, DIST spec §7). `@mcthaydt/automata-testing/host` exports `FakeHosting` (a layer giving
`Hosting` and `FakeHostControl`) and `fakeHosting` (its control handle and a `make` for boot). They implement AF's host
contract in process for the `web`, `itch`, `ruken` and `tauri` targets: each target's kind, name, grants and error codes,
deferred readiness, schema-checked host changes, planned failures, held calls for timeouts, consent, menu and close.

`@mcthaydt/automata-host/contract-suite` publishes the `Hosting` contract's Vitest cases (`describeHostingContract`), which
every adapter and the fake pass; `vitest` is an optional peer of `host`.

The runtime takes `seams.hosting`: a function that builds the game's `Hosting` in place of the build target's adapter,
for example `fakeHosting().make`. A game's tests can boot on any target without Ruken's fake host.
