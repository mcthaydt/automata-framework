# PRODUCT.4: stack page TDD plan

- **Spec:** [PRODUCT spec](../specs/2026-10-16-product-core-and-plus-design.md) §8 (the library table and the Planck → Rapier note) and §9 (`docs/stack.md` is owned by the ship lane and generated).
- **Status:** drafted 2026-10-16. PRODUCT.0 is Owner-approved (2026-10-16).
- **Progress:** 3 of 5 steps.

## Global constraints

- **Strict TDD** in `tooling/`: write the failing test, run it, confirm the failure reason, make the minimal change, confirm it passes.
- **Facts come from evidence.** Versions come from the pins (`docs/versions.md`'s npm table, which `tooling/versions/src/versions.test.ts` already holds equal to every `package.json`; for the `file:` Ruken tarballs, the installed `package.json` and the commit in `vendor/ruken/README.md`). Licenses come from the installed package's `package.json` `license` field, never from memory. A library that is not installed is rendered as "not yet installed; planned for <task>".
- **One source for prose.** Every card's text lives in `tooling/versions/src/stack-cards.ts`; `docs/stack.md` is only ever written by the generator.
- **Gates:** `pnpm format`, `pnpm check`. Parity and E2E are omitted: no runtime, rendering, UI, host or game code changes. No changeset: `tooling/versions` is private and nothing published changes.

## Files

- **Create:**
  - `tooling/versions/src/stack-cards.ts`: the card data (library, tier, packages, planned task, what it does, why, what AF adds) and the Planck → Rapier note;
  - `tooling/versions/src/stack.ts`: `collectStackFacts`, `renderStackPage`;
  - `tooling/versions/src/stack.test.ts`: unit tests over a temporary fixture workspace;
  - `tooling/versions/src/stack-page.test.ts`: the freshness check against the real repo;
  - `tooling/versions/src/write-stack.ts`: writes `docs/stack.md`;
  - `docs/stack.md` (generated).
- **Modify:**
  - the root `package.json` (`docs:stack` script);
  - `tooling/versions/turbo.json` (`docs/stack.md`, `vendor/ruken/README.md` and `pnpm-lock.yaml` become inputs of `test:unit` and `test`, so a cached pass is never replayed over a stale page).

## Interfaces

- **Consumed:** `pinsFromVersionsDoc` and `Manifest` from `tooling/versions/src/pins.ts`.
- **Produced:**
  - `StackCard` (`library`, `tier: 'Core' | 'Plus'`, `packages`, optional `planned: { packages, task }`, `does`, `why`, `adds`);
  - `collectStackFacts(root, cards): Map<string, PackageFacts>` where `PackageFacts = { name, versions, license, source }`. It throws, naming the package, when a package has no pin, is not installed, is installed at a version other than its pin, or when a "planned" package is now in a `package.json`;
  - `renderStackPage(cards, facts, note): string`, pure;
  - `pnpm docs:stack` regenerates the page; `pnpm check` (through `test:unit`) fails when the page is stale.

## Steps

- [x] **1. Render a card.** In `stack.test.ts`, `renderStackPage` over one installed card and one planned card gives: the generated-file banner; a summary row per library; a card with a `Package | Version | License` table and the tier, does, why and adds lines; and "not yet installed; planned for PRODUCT.L" for the planned card, with no version or license. Run `pnpm --filter @mcthaydt/versions test:unit` and confirm it fails because `stack.ts` does not exist. Implement `renderStackPage`; confirm it passes.
- [x] **2. Collect facts from a fixture workspace.** In `stack.test.ts`, a temporary root with `docs/versions.md`, a `package.json` per workspace folder and `node_modules/<name>/package.json` gives each package's pinned version and installed `license`; a `file:` tarball gives the installed version and the vendored commit; a package with no `license` field reads "not declared in the installed package". Failure cases, each naming the package: no pin; not installed; installed version differs from the pin; a planned package now in a `package.json`. Confirm they fail on the missing function; implement `collectStackFacts`; confirm they pass.
- [x] **3. The real cards.** Write `stack-cards.ts` with one card per §8 row (PixiJS, Koota, Effect, Zod, Svelte, Paraglide, smol-toml, Ruken SDK, Vite/Vitest/Playwright, Rapier, Colyseus) and the Planck → Rapier note. Prose is sourced from ADRs 0001–0004, the master spec §3 and §4, the PRODUCT spec and `docs/versions.md`.
- [ ] **4. Freshness check.** Write `stack-page.test.ts`: `docs/stack.md` equals `renderStackPage(STACK_CARDS, collectStackFacts(root, STACK_CARDS), …)`, with the message "docs/stack.md is out of date; run `pnpm docs:stack`". Confirm it fails because `docs/stack.md` does not exist. Write `write-stack.ts`, add `docs:stack`, run it; confirm it passes. Confirm the check fails again when the page is edited by hand (one changed version), then regenerate. Add the turbo inputs.
- [ ] **5. Gates and bookkeeping.** `pnpm format`, `pnpm check`. Record the evidence in 02 (row and execution record), 03 and this plan's log. Add the website `/inside` page as a follow-up row if 02 has none.

## Execution log

| Date | Step | Evidence |
|---|---|---|
