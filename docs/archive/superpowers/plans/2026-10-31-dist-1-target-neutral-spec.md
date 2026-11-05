# DIST.1 plan: the target-neutral host contract spec (docs only)

> Row: DIST.1 in [02](../../02-master-delivery-plan.md). Spec:
> [2026-10-31-dist-target-neutral-design.md](../specs/2026-10-31-dist-target-neutral-design.md). Decision record:
> [ADR 0006](../../adr/0006-distribution-targets.md). Docs only: no TDD steps (no code changes).

## Files

- Create `docs/superpowers/specs/2026-10-31-dist-target-neutral-design.md`.
- Create this plan.
- Not touched: `docs/00` to `docs/03`, `AGENTS.md` (the coordinator's); proposed row text is in the spec's §14.

## Steps

- [x] Read ADR 0006, ADR 0005, the PUB spec, the M1 shared contracts §1 and docs/01 §5.
- [x] Measure the coupling: `grep "from '@ruken/"` over non-test sources in `packages/` (spec §1), the vendored SDK's
  `CAPABILITIES` and `ERROR_CODES`, `./target`'s conditions, the packages' dependencies.
- [x] Draft the spec at docs/01 §5 detail: scope, ownership, contract, boundary, tauri target, fake host, flows, rows,
  tests, migration, veto defaults, acceptance.
- [x] `pnpm format` on the new files.
- [ ] Coordinator review; apply its findings here and in the spec's log.
- [ ] Accepted under the Owner's 2026-10-31 "everything is auto approved and accepted"; the status line updated.

## Gates

- Selected: `pnpm format` (Biome; it leaves Markdown alone, so a clean tree). Docs-only, so `pnpm check` is not affected by
  the change; run once before the push as a smoke.
- Omitted: build, api-report, parity, E2E (no code).

## Execution log

- 2026-10-31: drafted on `main` `bb0b330c`. Measured 26 non-test `@ruken/*` import sites across eight packages.
