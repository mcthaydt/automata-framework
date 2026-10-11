# ADR 0003: Effect for everything outside the sim

- Status: Accepted by Owner direction (2026-10-11); written-spec review pending
- Date: 2026-10-11
- Supersedes: "Effect: Skip" in the [2026-10-01 master spec](../superpowers/specs/2026-10-01-automata-framework-overview-design.md) §8

## Context
The 2026-10-01 design skipped Effect: a second paradigm for game developers, overlap with Zod, and hot-loop overhead. The Owner directed on 2026-10-11 to "use Effect and the Koota ECS". The runtime has many concerns Effect handles well and that FloorFifty and The Last Light handle by hand: ordered boot with failure states, retries and timeouts (handshake, loading stalls, exit grace, save flush), resource disposal on screen exit and on game restart, injected clocks, and typed errors that must each map to a UI state.

## Decision
- **The sim does not use Effect.** `packages/sim` stays plain synchronous TypeScript on Koota (ADR 0001) and Rapier. `check-boundaries` rejects `effect` and `@effect/*` imports there through its existing import allowlist, pinned by the `import-effect.ts` fixture. Laws 5 and 6 and the hot loop are the reasons.
- **Everything else does:** host adapters, runtime managers as services (`Context.Tag` + `Layer`), the boot program, `Scope`-based disposal (replacing FloorFifty's `DisposeBag`), `Clock`/`TestClock` as the injected clock, `Schedule` for retries, and `@effect/platform-node` in the content compiler, CLI, `ship` and `pipelines`.
- **Zod stays the schema language.** Ruken's protocol and manifest use Zod 4.6.5 and the sim's command payloads use Zod. Effect Schema is not adopted, so there is one schema language across Ruken and AF.
- **The frame loop does not allocate an Effect per frame.** It is plain code driven by `requestAnimationFrame` inside a runtime fiber.
- Game code meets Effect only at registration points (`defineExtension` layers, custom services). Sim systems, components and commands remain Effect-free.

## Consequences
- New spike **S8** before the M1 runtime plan: bundle size and cold-boot time with Effect on the S20 and iPhone 13 profiles, under Ruken's CSP, and a frame-loop overhead check.
- Extension authors need Effect only for runtime services; gameplay authoring is unchanged.
- The `Hosting` service's errors become a closed union of typed errors, each with a named UI state in `ui`.
