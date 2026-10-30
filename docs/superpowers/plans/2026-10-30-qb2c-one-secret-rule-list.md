# QB.2c: one secret rule list for gitleaks and the bundle scan, TDD plan

- **Spec:** [QB spec](../specs/2026-10-16-quality-bar-design.md) §1 (a gate is a check that fails, with a failing fixture), §2 and §4.3 (QB-b, the bundle secret scan); [QB.1 plan](2026-10-16-qb1-repo-hygiene.md) (the pinned gitleaks); [QB.2 plan](2026-10-16-qb2-game-build-gates.md) (`KEY_RULES`, "with gitleaks' rule IDs"). No spec change.
- **Task:** 02 row QB.2c, the first QB.2 follow-up ("QB.1 and QB.2 converge on one secret rule list"). Lane ship, size S.
- **Status:** drafted 2026-10-30, based on `main` (`30e9606`, after QB.1g #223).
- **Progress:** 1 of 6 steps.

## What is wrong

`packages/ship/src/prepare/secret-scan.ts` reports each known key format under a `KEY_RULES` ID that its doc comment calls "a gitleaks rule ID" (`SecretFound.rule`), and `tooling/repo-hygiene/src/gitleaks.ts` pins the gitleaks release whose default rules `.gitleaks.toml` extends (`useDefault = true`). Nothing ties the two. Probing the pinned 8.30.1 binary (`gitleaks stdin --config .gitleaks.toml --enable-rule <id>`, which exits 1 with "Requested rule <id> not found in rules" for an ID the loaded rule set lacks) shows 12 of the 13 IDs exist and one does not: **`slack-token`**. gitleaks 8.30.1 splits Slack tokens by prefix: `slack-bot-token` (`xoxb-`), `slack-user-token` (`xox[pe]-`), `slack-legacy-token` (`xox[os]-`), `slack-legacy-workspace-token` (`xox[ar]-`), plus `slack-app-token` (`xapp-`), `slack-legacy-bot-token`, `slack-config-*` and `slack-webhook-url`.

## Decisions

- **The pinned gitleaks binary is the one owner of the rule IDs; `KEY_RULES` consumes them, and a test ties them.** Of the two paths in 02's QB.2 follow-up, generating the repository scan's config from `KEY_RULES` would shrink `pnpm secrets` from gitleaks' 222 default rules to 13, so the test path is taken. The test asks the pinned binary itself, through its own `--enable-rule` flag and the repository's `.gitleaks.toml` (exactly the rule set `pnpm secrets` runs), rather than parsing the binary's embedded config or vendoring a copy of gitleaks' `config/gitleaks.toml`: there is no copy to drift from `GITLEAKS_VERSION`, and nothing to record or refresh on a version bump. The binary comes from `ensureGitleaks` (the cache, or the SHA-256-verified release download `pnpm secrets` already makes), so the test needs no other network.
- **The test lives in `tooling/repo-hygiene`**, beside the pin, and reads `KEY_RULES` from ship's source by relative path, as `tooling/examples-runner` and `tooling/frame-budget` read ship's port helpers. `KEY_RULES` (and its `KeyRule` type) gain a module `export` in `secret-scan.ts` only; ship's `index.ts`, so its public API and API report, is unchanged. ship's own tests stay network-free.
- **Where the pinned binary is cached has one owner too:** `ensureRepoGitleaks(root)` in `gitleaks.ts` (`<root>/node_modules/.cache/gitleaks`), called by `secrets.ts`, by QB.1g's `secret-scan.test.ts` (which spelled the same options out again) and by the new test, so all three run the same cached binary.
- **Fix `slack-token` by splitting the rule by prefix into gitleaks' IDs**, keeping the matched strings exactly as before (`\bxox[baprs]-[0-9A-Za-z-]{10,}` is the union of the four new, disjoint patterns): `xoxb-` is `slack-bot-token`, `xoxp-` is `slack-user-token`, `xoxs-` is `slack-legacy-token`, `xoxa-` and `xoxr-` are `slack-legacy-workspace-token`. Every finding still reads "a Slack token". Only the `rule` field of a Slack finding changes, so ship gets a patch changeset.
- **The test proves it can fail**, as QB.1's gates do: a permanent case asks the binary for `not-a-gitleaks-rule` and expects exit 1 naming it.
- **repo-hygiene's turbo inputs gain `$TURBO_ROOT$/packages/ship/src/prepare/secret-scan.ts` and `$TURBO_ROOT$/.gitleaks.toml`**, the two files outside the workspace the test reads, or turbo would replay a cached pass after a `KEY_RULES` change (QB.1g's `secret-scan.test.ts` already reads `.gitleaks.toml` without it being an input). A test in the same file pins them, as `tooling/release/src/turbo.test.ts` pins `build`'s inputs.

## Files

- **Create:** `tooling/repo-hygiene/src/gitleaks-rules.test.ts`; `.changeset/qb2c-slack-rule-ids.md`.
- **Modify:** `packages/ship/src/prepare/secret-scan.ts` (export `KEY_RULES`, split the Slack rule, header comment), `packages/ship/src/prepare/secret-scan.test.ts` (Slack cases by gitleaks ID), `tooling/repo-hygiene/src/gitleaks.ts` (`ensureRepoGitleaks`), `tooling/repo-hygiene/src/secrets.ts` and `tooling/repo-hygiene/src/secret-scan.test.ts` (use it), `tooling/repo-hygiene/turbo.json`; this plan.

## Interfaces

- Consumed: gitleaks 8.30.1's default rule set (through the pinned binary and `.gitleaks.toml`); `ensureGitleaks` and `GITLEAKS_VERSION` (`tooling/repo-hygiene/src/gitleaks.ts`).
- Produced: `export const KEY_RULES: readonly KeyRule[]` and `export interface KeyRule` from `packages/ship/src/prepare/secret-scan.ts` (module only, not ship's public entry); `export function ensureRepoGitleaks(root: string): Promise<string>` from `tooling/repo-hygiene/src/gitleaks.ts` (private tooling). ship's published API is unchanged; a Slack finding's `rule` becomes one of the four gitleaks IDs above.

## Steps

- [x] **1. Plan.** This file.
- [ ] **2. Red: every `KEY_RULES` ID is a gitleaks rule.** `tooling/repo-hygiene/src/gitleaks-rules.test.ts`: `beforeAll` gets the binary with `ensureRepoGitleaks`; `it.each` over `KEY_RULES` IDs runs `gitleaks stdin --no-banner --config <root>/.gitleaks.toml --enable-rule <id>` on empty input and expects exit 0; a self-test expects `not-a-gitleaks-rule` to exit 1 with "Requested rule not-a-gitleaks-rule not found in rules"; a turbo test expects both inputs. Minimal code for the test to load: `export` on `KEY_RULES` and `KeyRule`, and `ensureRepoGitleaks`. Run `pnpm --filter @mcthaydt/repo-hygiene exec vitest run src/gitleaks-rules.test.ts`. Expected: `slack-token` fails (exit 1, "Requested rule slack-token not found in rules") and the turbo test fails (inputs missing); the other 12 IDs and the self-test pass. Also plant `{ id: 'planted-not-gitleaks', … }` in `KEY_RULES` for one run (not committed): its case fails the same way.
- [ ] **3. Red: ship reports Slack tokens under gitleaks' IDs.** `secret-scan.test.ts`'s `KEYS`: the `xoxb-` case expects `slack-bot-token`, and new `xoxp-`, `xoxs-`, `xoxa-` and `xoxr-` cases expect `slack-user-token`, `slack-legacy-token` and `slack-legacy-workspace-token` (fake keys built from pieces, as the file's others are, so gitleaks never sees a whole one). Run `pnpm --filter @mcthaydt/automata-ship exec vitest run src/prepare/secret-scan.test.ts`. Expected: the five Slack cases fail with `slack-token` received.
- [ ] **4. Green.** Split the Slack rule into the four prefix rules; add the two turbo inputs; `secrets.ts` and `secret-scan.test.ts` call `ensureRepoGitleaks`. Expected: both focused files pass.
- [ ] **5. Gates.** The changeset; then the gates below.
- [ ] **6. Hand off.** Draft PR with the gates and the decisions for the Owner's veto.

## Gates

- Selected: the two focused files (steps 2 to 4); `pnpm format`, then `TURBO_FORCE=true pnpm check`; `pnpm secrets` (`secrets.ts` changed, and the new fake Slack keys must not be reported); `pnpm build`, `pnpm api-report`, `pnpm api-index`, `pnpm agent-skills` (ship's source and doc comments changed; its public entry should not); `pnpm changeset status --since=origin/main` and `node tooling/release/src/check-changesets.ts`.
- Omitted: parity (ship has no `test:parity`, and no sim, renderer, ui or golden changes); the consumer smoke (no build-config change); `pnpm deps:new` (no dependency added); examples, demos and e2e (none touched).
- Pending: the Mac's CI on the PR.

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
| 2026-10-30 | 1 | | Plan. The probe in "What is wrong" ran the 8.30.1 binary cached in the main checkout (`gitleaks version` 8.30.1; its tarball's SHA-256 `551f6fc8…70eb` is `RELEASE_SHA256.linux_x64`): `--enable-rule slack-token` exits 1, "Requested rule slack-token not found in rules"; `slack-bot-token` exits 0, "no leaks found". The binary embeds 222 rule IDs (`grep -a '^id = "'`), 9 of them `slack-*`. |
