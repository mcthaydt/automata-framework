# QB.2: game build gates TDD plan

- **Spec:** [`docs/superpowers/specs/2026-10-16-quality-bar-design.md`](../specs/2026-10-16-quality-bar-design.md) §4.1 (input sanitization row), §4.3 (secrets in bundles, platform UI), §4.4, §7 QB.2, §9 QB-b. Owner-approved 2026-10-16.
- **Status:** drafted 2026-10-16. Stacks on DX.6 (`automata check`, PR #42), which is not merged yet.
- **Progress:** 0 of 3 tasks.

## Global constraints

- **Strict TDD** in `packages/` and `tooling/`: write the failing test, run it, confirm the failure reason, make the minimal change, confirm it passes.
- **No new network tool at build time.** The bundle scan is plain TypeScript in `ship`. QB.1 (PR #38) wraps gitleaks for the repository's history; this lane does not copy it. The known-key rules carry gitleaks' rule IDs so the two can converge once both merge (recorded as a follow-up in 02).
- **One scanner.** `ship` owns the scanner. `automata check` (`packages/cli`, which already depends on `ship`) imports it; it does not keep its own copy.
- **Never print a secret.** Findings name the file, the offset, the rule and the variable's name; a matched key is shown as its first four characters and its length.
- **Gates:** `pnpm format`, `pnpm check`, `pnpm --filter @af-examples/placeholder build && pnpm --filter @af-examples/placeholder prepare-ruken`, the same for `@af-examples/base-2d` (Emberwick until EX.2 moves it), and the cli's `check:example`. `pnpm test:parity` and `pnpm test:e2e` only if runtime, rendering, `ui` source, host or a game changes (this plan changes none of them: the `ui` rules are checks over `ui`, not changes to it).
- **Changeset:** `ship` is published, so a patch changeset. `cli` is private; `check-style` is private tooling.

## Task 1: bundle secret scan in `prepare-ruken` (QB-b)

### Files
- **Create:** `packages/ship/src/prepare/secret-scan.ts`, `packages/ship/src/prepare/secret-scan.test.ts`, `.changeset/qb2-bundle-secret-scan.md`.
- **Modify:** `packages/ship/src/prepare/prepare-build.ts` and its test, `packages/ship/src/errors.ts` (`SecretInBuild`), `packages/ship/src/index.ts`, `packages/ship/src/cli.ts` (passes the game folder).

### Interfaces
- **Produced:**
  - `scanTextForSecrets(file, text, envValues): SecretFound[]`. Pure. `text` is the file's bytes as latin1, so an offset is a byte offset.
  - `parseEnvFile(file, text): EnvValue[]`.
  - `readEnvValues(gameDir): EnvValue[]` reads every top-level `.env*` file.
  - `findSecretsInBuild(distDir, envValues): SecretFound[]`.
  - `PrepareInput.gameDir?`: when it is left out, no `.env` file is read. The CLI passes its working folder.
  - `SecretFound` is `{ file, offset, line, col, rule, detail }`.
- **Consumed:** nothing new.

### Rules
- **Known key formats** (with gitleaks' rule IDs): Stripe `sk_`/`rk_` `live|test|prod` keys; AWS access key IDs; GitHub tokens (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`, `github_pat_`), which are the Plus registry token's format on GitHub Packages; npm tokens (`npm_`); PEM private keys; Slack tokens; Google API keys; Anthropic and OpenAI keys. These rules read every file.
- **`.env*` values:** every variable in the game folder's top-level `.env*` files whose value is 8 characters or longer. Shorter values (`true`, `en`) would match by chance. These rules read every file.
- **High entropy:** a quoted string (`"`, `'` or backtick) in a text file (`.js`, `.mjs`, `.cjs`, `.css`, `.html`, `.htm`, `.svg`, `.json`, `.webmanifest`, `.map`, `.txt`, `.xml`, `.toml`) that matches all of the following:
  - its whole content is 24 to 200 characters of `[A-Za-z0-9+/=_-]`;
  - it has an upper-case letter, a lower-case letter and a digit;
  - its Shannon entropy is at least 4.25 bits per character.

  Tuned against today's placeholder and Emberwick builds, which have zero matches. Hashed asset names hold `.`, and GL constants have no lower case, so neither matches.

### Steps
- [x] **1. Scanner.** Write `secret-scan.test.ts`:
  - a planted `sk_live_` key in a script is found with its file, byte offset, line and column, and the message does not contain the key;
  - each known format is found;
  - a `.env` value is found and named by variable;
  - a short `.env` value is ignored;
  - `.env` parsing handles `export`, quotes and comments;
  - a random 32-character string in quotes is found;
  - GL constants, hashed asset paths, an SRI hash and a base64 data URI are not;
  - the high-entropy rule ignores binary files, while the key rule still reads them;
  - `findSecretsInBuild` walks folders.

  Run `pnpm --filter @mcthaydt/automata-ship exec vitest run src/prepare/secret-scan.test.ts`. Confirm it fails because `./secret-scan.ts` does not exist. Implement it and confirm it passes.
- [x] **2. `prepareBuild` gate.** In `prepare-build.test.ts`:
  - a build with a planted `sk_live_` key fails with `SecretInBuild`, the message names `assets/main.js` and the offset, and no `ruken.toml` is written;
  - a `.env` value copied into the bundle fails the same way, naming the variable;
  - the clean build still passes.

  Confirm it fails because prepare writes `ruken.toml`. Add the check after the root-absolute check, then confirm it passes. Pass `gameDir: cwd` from `cli.ts`.
- [x] **3. Real builds.** Run the following and confirm both pass (QB-b's clean builds):

  ```
  pnpm --filter @af-examples/placeholder build && pnpm --filter @af-examples/placeholder prepare-ruken
  pnpm --filter @af-examples/base-2d build && pnpm --filter @af-examples/base-2d prepare-ruken
  ```

  Then plant `sk_live_…` in a copy of the placeholder's `dist/` and confirm `automata-ship prepare` exits 1 naming the file and offset.

  Done: both clean builds wrote `ruken.toml`. A planted key gave exit 1 with `assets/index-CB5OYeBD.js:15:66042 (byte 142511): stripe-access-token`. A value from a `.env.qb2-test` in the placeholder folder, appended to `index.html`, gave exit 1 with `env-value: the value of QB2_PLANTED`.

  Deviation: `gameDir` has no default. When it is left out, no `.env` file is read, because defaulting to the parent of `dist` would read `/tmp` in tests. The CLI always passes its working folder.

## Task 2: `secrets` step in `automata check`

### Files
- **Modify:**
  - `packages/cli/src/check/check-report.ts`: add `'secrets'` to `StepName`;
  - `packages/cli/src/check/check-steps.ts`: `secretsStep`;
  - `packages/cli/src/check/run-check.ts`;
  - `packages/cli/src/check/run-check.test.ts`;
  - the DX spec §3.6 table (the `secrets` row).

### Interfaces
- **Consumed:** `scanTextForSecrets` and `readEnvValues` from `@mcthaydt/automata-ship`.
- **Produced:** a step named `secrets` after `no-eval`, skipped with `--sim-only`. Each finding is `{ file: 'dist/<path>', line, col, rule: 'secret-<rule>', message }`.

### Steps
- [x] **4. Step.** In `run-check.test.ts`:
  - the clean game's step order is `boundaries, typecheck, test, no-eval, secrets`;
  - `--sim-only` skips `secrets`;
  - a planted `sk_live_` key in the fake `dist/assets/index.js` is a `secrets` finding with file, line and column, and the run exits 1.

  Confirm they fail on the missing step. Implement it: dist files come through `Files`, so the fake works, and the step reads the game's `.env*` files with `readEnvValues`. Then confirm they pass.
- [x] **5. Real run.** Run `pnpm --filter @mcthaydt/automata-cli check:example` on Emberwick and confirm that `secrets` passes.

  Done: all six steps passed, `secrets` in 11 ms.

  Deviation: when `no-eval` reports a failed build, `secrets` reports "not scanned: the build failed (see no-eval)" rather than reading a stale `dist/`. The `csp` test now reads step index 5, because `secrets` comes before it.

## Task 3: `ui` rules: no `{@html}`, no platform chrome in kits

### Files
- **Create:**
  - `tooling/check-style/src/svelte.ts` and `svelte.test.ts`;
  - `tooling/check-style/src/cli.test.ts`;
  - fixtures in `tooling/check-style/src/testing/kit-fixtures/`: `clean-screen.svelte`, `login-mimic.svelte`, `payment-mimic.svelte`, `host-name-mimic.svelte` and `html-tag.svelte`.
- **Modify:**
  - `tooling/check-style/src/cli.ts`: reads `.svelte` files, except `*.test.svelte` and `testing/`;
  - `tooling/check-style/package.json`: `svelte`, at the version `ui` pins;
  - the `ui` spec (`docs/superpowers/specs/2026-10-11-m1-ui-design.md`): a new section with the kit rules.

### Interfaces
- **Produced:** `checkSvelte(file, code): StyleFinding[]`, with the rules `no-html` and `platform-chrome`.
  - The check parses with `svelte/compiler`. Comments are never read.
  - `no-html` is any `{@html}` tag.
  - `platform-chrome` matches any of the following:
    - an `<input type="password">`;
    - an `autocomplete` of `current-password`, `new-password`, `one-time-code` or `cc-*`;
    - the host's name ("Ruken") in markup text, an attribute or a string. A label such as "Back to …" takes `hostName` from the host (PUB.4) and never hard-codes it;
    - sign-in or payment wording: "sign in", "log in", "sign up", "create account", "password", "card number", "CVV", "CVC", "billing" or "checkout".

### Steps
- [ ] **6. Rules.** Write `svelte.test.ts` over the fixtures:
  - `clean-screen.svelte` passes;
  - each mimic fixture fails with `platform-chrome` and its line;
  - `html-tag.svelte` fails with `no-html`;
  - a mention of Ruken in a comment passes.

  Confirm it fails because `./svelte.ts` does not exist. Implement it and confirm it passes.
- [ ] **7. CLI.** Write `cli.test.ts`:
  - a temporary `src/` with a planted `{@html}` makes `cli.ts` exit 1, naming the file and `no-html`;
  - a clean one exits 0;
  - `*.test.svelte` files and `testing/` folders are skipped.

  Confirm it fails because `.svelte` files are not read. Extend `cli.ts`, then confirm it passes. Run `pnpm style` and confirm it passes on today's `packages/ui`. If it finds an existing use, report it and stop.
- [ ] **8. Spec.** Record the kit rule in the `ui` spec, covering what counts as platform chrome, where the check runs, and that kits (PRODUCT.6, in Automata Plus) run `check-style` over their sources. No kit exists in core yet, so the rule is proven on fixtures.

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
