# ADR 0003: Effect for everything outside the sim

- Status: Accepted by Owner direction (2026-10-11); amended 2026-11-05 (below): Effect is for Node tooling only
- Date: 2026-10-11
- Supersedes: "Effect: Skip" in the [2026-10-01 master spec](../archive/superpowers/specs/2026-10-01-automata-framework-overview-design.md) §8

## Context
The 2026-10-01 design skipped Effect: a second paradigm for game developers, overlap with Zod, and hot-loop overhead. The Owner directed on 2026-10-11 to "use Effect and the Koota ECS". The runtime has many concerns Effect handles well and that FloorFifty and The Last Light handle by hand: ordered boot with failure states, retries and timeouts (handshake, loading stalls, exit grace, save flush), resource disposal on screen exit and on game restart, injected clocks, and typed errors that must each map to a UI state.

## Decision
- **The sim does not use Effect.** `packages/sim` stays plain synchronous TypeScript on Koota (ADR 0001) and Rapier. `check-boundaries` rejects `effect` and `@effect/*` imports there through its existing import allowlist, pinned by the `import-effect.ts` fixture. Laws 5 and 6 and the hot loop are the reasons.
- **Everything else does:** host adapters, runtime managers as services (`Context.Tag` + `Layer`), the boot program, `Scope`-based disposal (replacing FloorFifty's `DisposeBag`), `Clock`/`TestClock` as the injected clock, `Schedule` for retries, and, in the content compiler, CLI, `ship` and `pipelines`, `node:fs` and `node:child_process` inside `Effect.try` behind the small shared `Files` and `ProcessRunner` services in `packages/node`. (Amended 2026-10-11: `@effect/platform-node` 0.108 needs the `@effect/cluster`, `rpc`, `sql` and `workflow` peers and native build scripts, so it is not used.)
- **Zod stays the schema language.** Ruken's protocol and manifest use Zod 4.6.5 and the sim's command payloads use Zod. Effect Schema is not adopted, so there is one schema language across Ruken and AF.
- **The frame loop does not allocate an Effect per frame.** It is plain code driven by `requestAnimationFrame` inside a runtime fiber.
- Game code meets Effect only at registration points (`defineExtension` layers, custom services). Sim systems, components and commands remain Effect-free.

## Consequences
- New spike **S8** in M1.1, on the placeholder page: bundle size and cold-boot time with Effect on the S20 and iPhone 13 profiles, under Ruken's CSP. Effect is adopted by Owner direction whatever S8 measures; S8 sets the budgets and the mitigations if they are exceeded (fewer modules, lazy layers). The frame-loop overhead check runs in M1.5.
- Extension authors need Effect only for runtime services; gameplay authoring is unchanged.
- The `Hosting` service's errors become a closed union of typed errors, each with a named UI state in `ui`.

## Amendment (2026-11-05): Effect leaves the browser

The Owner took decision D2 of the [core and 2D audit](../refactor/2026-11-05-core-and-2d-audit.md) ("go with your recs"). Effect stays in Node tooling (`@mcthaydt/automata-tools`, the content compiler) and leaves everything that runs in the browser: `@mcthaydt/automata` is plain TypeScript. Why: Effect was 16% of Emberwick's gzip (57.6 kB of 360 kB, measured with `tooling/bundle-report`, a one-off tool since removed), a second paradigm for every extension author, and its tags, layers and scopes were doing work that a factory function and a list of "undo" functions do in a few lines. The [refactor spec, section 4](../refactor/2026-11-05-core-and-2d-spec.md) has the five replacements:

| Effect | Plain TypeScript (`packages/automata/src/shared/lib/`) |
|---|---|
| `Context.Tag` and `Layer` | `create<Thing>(deps)` factories; `app/` builds them in order |
| `Clock` and `TestClock` | `Clock` (`now`, `setTimeout`, `clearTimeout`) passed in; `fakeClock()` in tests |
| `Scope` and finalizers | `disposables()`: `add(undo)`, `dispose()` runs them last-in first-out, once |
| tagged errors and `Effect.fail` | a host refusal is a value, `{ ok: false, reason }` (`Result`); a bug throws an `Error` |
| `Stream`, `SubscriptionRef`, `Subscribable` | `Subscribable` (`get`, `subscribe`) and `Listenable`/`emitter` |

The first two bullets of "Decision" above still hold for the sim (no Effect) and for Zod. The "Everything else does" bullet now reads "everything in Node tooling". What changed so far: the host contract and the three target adapters (web, Ruken, Tauri) are plain; the runtime still uses Effect until task 5.4 converts it, through a temporary bridge (`shared/host/effect-bridge.ts`) that task 5.4 deletes.
