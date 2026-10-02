# AutomataFramework: Agent Rules

Read `docs/superpowers/specs/2026-10-01-automata-framework-overview-design.md` first, then the spec for the phase you are working on.

- **Strict TDD** in `packages/`, `tooling/` and `examples/`: write a failing test first, then make the minimal change. `spikes/` is exempt (A0+A1 spec §2).
- **The seven laws** (overview spec §2): only the sim changes gameplay state; the sim has no I/O, no wall clock and no `Math.random`; the host is a port.
- **Naming:** role suffixes (`*.component.ts`, `*.system.ts`, `*.command.ts`, `*.event.ts`, `*.resource.ts`, `*.plugin.ts`, `*.manager.ts`, `*.schema.ts`, `*.migration.ts`, `*.test.ts`). Folders group by feature.
- **Determinism is cross-engine:** goldens must match bit-for-bit in Node, Chromium, WebKit and Firefox. Never accept a hash mismatch as "flaky".
- Run `pnpm format` before committing. Use Conventional Commits.
- Packages publish as `@mcthaydt/automata-<name>` (GitHub Packages, `mcthaydt/automata-framework`).
- **Before committing:** `pnpm check` runs lint, typecheck, `boundaries`, `style` and unit tests (CI runs the same, plus the cross-engine parity suites in Chromium, WebKit and Firefox).
- **`pnpm boundaries`** (packages/sim): no DOM/host globals, no `Date`/timers/`console`, only `Math.{sqrt,fround,round,floor,ceil,trunc,abs,min,max,sign,imul}` (use `@mcthaydt/automata-sim/math` for the rest), no `**`, no `Object.keys/values/entries`/`for…in` (use `sortedKeys`/`sortedEntries`), imports only from `koota`, `zod`, Rapier deterministic-compat, or relative paths.
- **`pnpm style`**: kebab-case files; `define*` results live in a file with the matching role suffix (`*.component.ts` exports `defineComponent` results, and so on); `testing/` folders and tests are exempt.
- Heavy GPU, visual and E2E suites run on the Linux GPU runner (from A3), not on the developer's Mac.
