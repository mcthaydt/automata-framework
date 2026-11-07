# automata-skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task,
> with superpowers:test-driven-development for every code change and superpowers:verification-before-completion before
> ticking a box. The plugin's default, subagent-driven-development, is not used: the Owner allows no subagents, ever
> (no Task-tool delegation, no workflows), and the user's rule wins over the skill. Steps use checkbox (`- [ ]`)
> syntax. Tick a step only when its check has passed, in the same session.

**Goal:** The first release writes a public `mcthaydt/automata-skills` that installs as a Claude Code plugin and as
Agent Skills, carries a README and the MIT licence, teaches only what is published, and shows declarations, not source.

**Architecture:** One mirror generator in `tooling/agent-skills` writes the whole public tree; the release job, the
unit tests, `plugin:validate` and the install suite all call it, so what is tested is what ships. The API index maps
published packages to their built `.d.ts`. Skill facts are read from the code by tests.

**Tech Stack:** pnpm 10 + turbo 2.11, Node 24 (`/opt/node24/bin`), TypeScript 6 API, Vitest 5, Zod 4.6.6, Biome,
Claude Code 2.1.301 (pinned), `skills@1.7.0` (Agent Skills installer), GitHub Actions on the Owner's runners.

**Spec:** [2026-11-07-skills-spec.md](2026-11-07-skills-spec.md) (section numbers below are the spec's). The facts:
the [audit](2026-11-07-skills-audit.md) (finding ids M, C, T, D, V, P).

## Global Constraints

- Every change lands in `mcthaydt/automata-framework`; nothing is written in `automata-skills` by hand (D1 A).
- Anything the mirror copies is public: no source-project names, no plan ids, nothing about closed betas
  (`pnpm source-names` passes).
- The agent package names only published packages (`publishablePackages`); no 3D skill text before the 3D slice's
  phase 20 (D2 A).
- Claude Code is pinned at `2.1.301`; the Agent Skills installer at `skills@1.7.0`.
- `tooling/agent-skills/src/mirror.ts` and `mirror-cli.ts` import only `node:` built-ins and `./skill-tree.ts` (the job
  runs them without `pnpm install`).
- One PR per part, stacked on this plan's PR (`claude/project-thread-wd20yh`), opened ready, merged by hand with a
  merge commit once every check on the head is green.
- Strict TDD in `tooling/` and `packages/`: the failing test first, its failure reason confirmed, then the minimal change.
- After changing an export or a doc comment of a published package: `pnpm api-report --update`, `pnpm api-index
  --write`, `pnpm agent-skills`, and `pnpm cheatsheet` when `api-index` says so. Changesets `patch` only, published
  packages only (task 4.2 is the one that needs one).
- `pnpm format`, then `pnpm check`, before every commit; Conventional Commits; the session's attribution lines.
- Copy a person reads (README, skills, site) passes the drunk grandma test: could a drunk grandma tell what it is and
  how to use it? New site strings go in `docs/refactor/copy.md` ("Skills").
- Workflow edits are covered by "everything is auto approved and accepted" (Owner, 2026-10-31); quote it in the PR.
- Sessions refresh after 90 minutes: tick the steps, update `skills-progress.md`, push, add a line to the execution log.

## Review Focus

1. **The mirror clone holds files from an older push** (a file `agents/automata` no longer has): the job empties the
   clone except `.git` before writing, and the generator refuses a folder with anything else in it. Test in task 1.1:
   `refuses an out folder that holds anything but .git`.
2. **A skill folder gains a file the README or marketplace does not list** (a new reference file): the mirror still
   matches `agents/automata` byte for byte. Test in task 1.1: `copies every plugin file byte for byte`.
3. **A re-export of a re-export** (`@automata/framework` → `@automata/sim` → its own chunk): the index still prints
   the declaration. Test in task 2.1: `a re-exported re-export reads the declaration`.
4. **A package name inside a code fence or the worked example** (`import … from '@automata/3d'` in a `.ts` file): the
   published-only test reads `.ts` and `.mjs` too. Test in task 2.3: `finds a package named in the example's .ts`.
5. **The site shows an install line that does not work yet:** part 5's PR merges only after a real install from
   `mcthaydt/automata-skills`; the site test pins the tested version string. Test in task 5.1.

---

## Part 1: The mirror (PR `claude/skills-mirror`; M1, M2; spec 4)

### Task 1.1: The mirror generator

**Files:**
- Create: `tooling/agent-skills/src/mirror.ts`, `tooling/agent-skills/src/mirror-cli.ts`
- Test: `tooling/agent-skills/tests/unit/mirror.test.ts`

**Interfaces:**
- Consumes: `diffSkillTrees(a, b)` (`skill-tree.ts`); `readAgentPackage(root)` (`layout.ts`, in the test only).
- Produces:
  - `MIRROR_MARKETPLACE = 'automata-skills'`
  - `interface MirrorOptions { readonly repo: string; readonly out: string }`
  - `class MirrorError extends Error`
  - `writeMirror(options: MirrorOptions): string[]` (paths written, sorted, slash-separated)
  - `mirrorMarketplace(): { name: string; description: string; owner: { name: string }; plugins: [{ name: 'automata'; source: './' }] }`
  - `mirrorReadme(version: string): string`
  - CLI: `node tooling/agent-skills/src/mirror-cli.ts --out <dir> [--repo <dir>]`; exit 0 written, 1 `MirrorError`,
    2 `agents/automata` missing.

- [ ] **Step 1: Write the failing tests**

```ts
it('writes a tree Claude Code reads as a marketplace with the automata plugin', () => {
  writeMirror({ repo: REPO, out })
  const pkg = readAgentPackage(out)
  expect(pkg.problems).toEqual([])
  expect(pkg.marketplace?.name).toBe('automata-skills')
  expect(pkg.marketplace?.plugins).toEqual([{ name: 'automata', source: './' }])
  expect(pkg.skills.map((s) => s.name)).toEqual(readAgentPackage(REPO).skills.map((s) => s.name))
  expect(Object.keys(pkg.hooks?.hooks ?? {}).sort()).toEqual(['PostToolUse', 'Stop'])
})
it('copies every plugin file byte for byte', () => {
  for (const folder of ['skills', 'hooks', 'scripts', '.claude-plugin/plugin.json'])
    expect(diffSkillTrees(join(REPO, 'agents/automata'), out).filter((d) => d.startsWith(folder))).toEqual([])
})
it('adds the README with the three install lines and the version', () => {
  const readme = readFileSync(join(out, 'README.md'), 'utf8')
  for (const line of ['/plugin marketplace add mcthaydt/automata-skills', '/plugin install automata@automata-skills',
    'npx skills add mcthaydt/automata-skills']) expect(readme).toContain(line)
  expect(readme).toContain(pluginVersion) // agents/automata/.claude-plugin/plugin.json's version
})
it('copies the framework LICENSE byte for byte', () => {
  expect(readFileSync(join(out, 'LICENSE'))).toEqual(readFileSync(join(REPO, 'LICENSE')))
})
it('writes nothing else', () => {
  expect(diffSkillTrees(join(REPO, 'agents/automata'), out).filter((d) => d.endsWith('only in b')).sort())
    .toEqual(['.claude-plugin/marketplace.json: only in b', 'LICENSE: only in b', 'README.md: only in b'])
})
it('refuses an out folder that holds anything but .git', () => {
  writeFileSync(join(out, 'stale.md'), 'old\n')
  expect(() => writeMirror({ repo: REPO, out })).toThrow(MirrorError)
})
it('accepts an out folder holding only .git', () => { mkdirSync(join(out, '.git')); expect(writeMirror({ repo: REPO, out })).toContain('README.md') })
it('the CLI exits 1 on a non-empty folder and 2 without the agent package', () => { /* spawnSync node mirror-cli.ts */ })
```

`out` is a fresh `mkdtempSync` per test. `diffSkillTrees` walks `.git` too, so the `.git` case checks the returned list
only.

- [ ] **Step 2: Run** `pnpm --filter @automata/agent-skills test tests/unit/mirror.test.ts`. Expected: FAIL, "Cannot find
  module '#src/mirror.ts'".
- [ ] **Step 3: Implement** `writeMirror` with `cpSync(join(repo, 'agents/automata'), out, { recursive: true })`, then
  writes `.claude-plugin/marketplace.json` (`JSON.stringify(…, null, 2) + '\n'`), `README.md` and `LICENSE`. The README
  (exact words, public): heading `# Automata skills`; one sentence "Skills and hooks that teach a coding agent to build
  games with the Automata Framework: its rules, test-first features, the exact API, and what `automata check` reports.";
  "## Install" with the two Claude Code lines in one fenced block and "Other agents (Codex, Cursor and more):" before the
  `npx skills add` line; "Version <version>."; "## About this repository": "This repository is generated by the
  framework's release. Change the agent package in the framework, not here." The marketplace description: "The
  Automata Framework's agent package: skills and hooks for building Automata games."
- [ ] **Step 4: Run** the same command. Expected: PASS (8 tests).
- [ ] **Step 5: Commit** `feat(agent-skills): generate the public mirror tree`

### Task 1.2: The release job and the release checks use the generator

**Files:**
- Modify: `.github/workflows/release-packages.yml` (`skills` job, lines 197 to 244), `.github/workflows/release-checks.yml`
  (after `pnpm plugin:validate`), root `package.json` (`plugin:validate`), `.gitignore` (`/.mirror/`), `.claude-plugin/marketplace.json`
  (description: "…Public installs: /plugin marketplace add mcthaydt/automata-skills.")
- Test: `tooling/agent-skills/tests/unit/ci.test.ts`, `tooling/repo-hygiene/tests/unit/workflow-invariants.test.ts`

**Interfaces:**
- Consumes: the CLI from task 1.1.
- Produces: `plugin:validate` also validates `.mirror/automata-skills`.

- [ ] **Step 1: Write the failing tests** in `ci.test.ts`:
  - `the skills job writes the mirror with the generator`: the job's text contains
    `node tooling/agent-skills/src/mirror-cli.ts --out "$mirror"` and `actions/setup-node`, and not `cp -R agents/automata`.
  - `the skills job still empties the clone but .git first`: `find "$mirror" -mindepth 1 -maxdepth 1 ! -name .git` comes
    before the generator line.
  - `plugin:validate checks the mirror tree`: the script contains `node tooling/agent-skills/src/mirror-cli.ts --out
    .mirror/automata-skills` and `plugin validate .mirror/automata-skills --strict`.
- [ ] **Step 2: Run** `pnpm --filter @automata/agent-skills test tests/unit/ci.test.ts`. Expected: FAIL on all three.
- [ ] **Step 3: Implement.** The job gains `actions/setup-node` (the pinned SHA the other jobs use, `node-version-file:
  .nvmrc`) after checkout, both under `if: steps.token.outputs.present == 'true'`; `cp -R …` becomes the generator line.
  `plugin:validate` becomes `rm -rf .mirror && node tooling/agent-skills/src/mirror-cli.ts --out .mirror/automata-skills
  && <the two existing validates> && pnpm dlx @anthropic-ai/claude-code@2.1.301 plugin validate .mirror/automata-skills
  --strict`. Update the job's comment ("The mirror is the generator's tree: the plugin, its marketplace file, a README
  and the licence").
- [ ] **Step 4: Run** the agent-skills unit tests and `pnpm --filter @automata/repo-hygiene test` (workflow invariants:
  the fork guard, pinned actions, no secret in a URL). Expected: PASS. Then `pnpm plugin:validate`. Expected: three
  "Validation passed". Record the output in the PR. (The cloud session runs it; the audit ran the same CLI there.)
- [ ] **Step 5: Re-enact the job on a clone** of `automata-skills` in the scratchpad: empty it but `.git`, run the CLI,
  then with a throwaway `CLAUDE_CONFIG_DIR`: `claude plugin marketplace add <clone>`, `plugin install
  automata@automata-skills`, `plugin details automata@automata-skills` → "Skills (5)", "Hooks (2) PostToolUse, Stop".
  Record it in the PR. No push.
- [ ] **Step 6: Commit** `ci(release): the skills job writes the mirror with its marketplace, README and licence`

### Task 1.3: Part 1's close

- [ ] **Step 1:** `pnpm format`, `pnpm check` pass. Open the PR ready, base `claude/project-thread-wd20yh`; its body
  quotes "Reminder that everything is auto approved and accepted, do not wait on me to do any approvals" for the
  workflow change and lists Step 4 and 5's output. Update `skills-progress.md`.

---

## Part 2: The reference and the names (PR `claude/skills-reference`; C1, C2, T3, D2 A; spec 6.1, 6.3, 6.4)

### Task 2.1: Declarations only (C1)

**Files:**
- Modify: `tooling/api-report/src/extract.ts:192-205` (`declarationExports`), `tooling/api-index/src/rows.ts:27-29`
- Create: `tooling/api-index/fixtures/reexport/packages/{base,umbrella,chain}/` (each a `package.json`, `src/index.ts`,
  `types/index.d.ts`)
- Test: `tooling/api-index/tests/unit/rows.test.ts`, `tooling/agent-skills/tests/unit/reference.test.ts` (create)
- Regenerate: `agents/automata/skills/automata-api/reference/api.md`, `docs/cheatsheet.md` if stale

**Interfaces:**
- Produces: `declarationExports(files: readonly string[], paths?: Readonly<Record<string, readonly string[]>>): ExportsOf`
  (the extra option is `paths`; nothing else changes); `indexRows(entries)` builds `paths` from `entries`
  (`'.'` → the package name, `./x` → `<package>/x`, each to `[typesFile]`).

- [ ] **Step 1: Write the failing tests.** Fixture: `@fx/base` (`exports["."]` = `./src/index.ts` with
  `export function defineThing(id: string): string { return check(id) }`; `publishConfig.exports["."].types` =
  `./types/index.d.ts` with `export declare function defineThing(id: string): string;`), `@fx/umbrella`
  (`types/index.d.ts`: `export { defineThing } from '@fx/base'`), `@fx/chain` (re-exports `@fx/umbrella`). The test copies
  the fixture to a temp folder and links `node_modules/@fx/<name>` → `packages/<name>` (as pnpm does), then:

```ts
it('a re-export of another published package reads its declaration, not its source', () => {
  const rows = indexRows(entryPoints(temp)).filter((r) => r.name === 'defineThing')
  expect(rows.map((r) => [r.package, r.signature])).toEqual([
    ['@fx/base', 'function defineThing(id: string): string;'],
    ['@fx/chain', 'function defineThing(id: string): string;'],
    ['@fx/umbrella', 'function defineThing(id: string): string;'],
  ])
})
it('a re-exported re-export reads the declaration') // the @fx/chain row above, asserted on its own
```

  And `reference.test.ts` (reads the committed `api.md`):

```ts
it.each(['defineCommand', 'defineComponent', 'defineEvent', 'definePlugin', 'defineResource', 'defineSystem'])(
  '%s reads the same in @automata/framework as in @automata/sim', (name) => {
    expect(signatureIn(reference, '@automata/framework', name)).toBe(signatureIn(reference, '@automata/sim', name))
  })
it('no function signature in the reference has a body', () => { /* no fenced `function` block contains `{\n` followed by a statement line ending in `;` inside braces */ })
```

  `signatureIn(markdown, pkg, name)` is a test helper reading the code block under the package's `## <pkg>` and the
  export's `### <name>` headings (check `render.ts` for the exact heading shape before writing it).
- [ ] **Step 2: Run** `pnpm --filter @automata/api-index test tests/unit/rows.test.ts` and the agent-skills reference
  test. Expected: FAIL, the umbrella's signature holds `{ return check(id) }`, and `defineSystem`'s framework signature
  differs.
- [ ] **Step 3: Implement** the `paths` option (passed straight into `ts.createProgram`'s options) and its map in
  `indexRows`.
- [ ] **Step 4: Run** `pnpm build` (the four published packages, `turbo build --filter`), `pnpm api-index --write`,
  `pnpm agent-skills`, then both tests. Expected: PASS; the `api.md` diff removes bodies only (lines near 2489 to 2680 at
  the audit's head); `pnpm api-index` reports "0 undocumented". `pnpm --filter @automata/site test` (its API pages read
  `api.json`). Expected: PASS.
- [ ] **Step 5: Commit** `fix(api-index): re-exported packages read their built declarations`

### Task 2.2: What the reference leaves out (C2)

**Files:** Modify `agents/automata/skills/automata-api/SKILL.md`. Test `tooling/agent-skills/tests/unit/skill-content.test.ts`.

- [ ] **Step 1: Write the failing test** `names the entry points the reference leaves out`: for every published
  package's `publishConfig.exports` key without a `types` target (read with `publishablePackages`), the skill contains
  `` `<package><key without ./>` `` (today `@automata/framework/target` and `@automata/framework/theme.css`).
  **Step 2:** FAIL. **Step 3:** one line: "Two entry points are not in it: `@automata/framework/target`, which the build
  picks for the target and a game never imports, and `@automata/framework/theme.css`, a stylesheet." **Step 4:** PASS.
  **Step 5: Commit** `docs(skills): say what the API reference leaves out`

### Task 2.3: Only published packages (D2 A, T1)

**Files:** Create `tooling/agent-skills/src/package-names.ts`; test `tooling/agent-skills/tests/unit/published-only.test.ts`.

**Interfaces:**
- Produces: `packageNamesIn(dir: string): Map<string, string[]>` (each `@automata/<name>` → the files naming it, read
  from `.md`, `.ts`, `.mjs`, `.json` below `dir`; a subpath `@automata/sim/math` counts as `@automata/sim`).
- Consumes: `publishablePackages(root)` (`tooling/release/src/publishable-packages.ts`).

- [ ] **Step 1: Write the failing tests**

```ts
it('finds a package named in the example .ts', () => {
  // temp dir with skills/x/example/src/a.ts: import { a } from '@automata/3d/sim'
  expect(packageNamesIn(temp).get('@automata/3d')).toEqual(['skills/x/example/src/a.ts'])
})
it('the agent package names only published packages', () => {
  const published = new Set(publishablePackages(REPO).map((p) => p.manifest.name))
  const unpublished = [...packageNamesIn(join(REPO, 'agents/automata'))].filter(([name]) => !published.has(name))
  expect(unpublished).toEqual([])
})
```

  **Step 2:** FAIL (no module). **Step 3:** implement with a regex `/@automata\/[a-z0-9-]+/g` over the files, sorted.
  **Step 4:** PASS. If the second test fails on today's tree, fix the skill text, not the test. **Step 5: Commit**
  `test(agent-skills): the agent package names only published packages`

### Task 2.4: Both builder names, every agent file (T3)

**Files:** Modify `tooling/repo-hygiene/src/source-names.ts:13-19` and `publishedSurfaces` (lines 41-54). Test
`tooling/repo-hygiene/tests/unit/source-names.test.ts`.

- [ ] **Step 1: Write the failing tests**: `stops the second builder's name` (plants `EnvironmentBuilder` in
  `agents/automata/skills/api/SKILL.md`; one finding, entry 6); `reads .ts, .mjs and .json under agents/` (plants the
  first sample in `agents/automata/scripts/check.mjs`, `…/example/src/a.ts` and `…/plugin.json`; three findings);
  `still skips agents/**/node_modules`. **Step 2:** FAIL. **Step 3:** add
  `{ pattern: /environment[\s_-]?builder/i, sample: 'EnvironmentBuilder' }` last (entry numbers stay), and a
  `filesBelow(dir, extensions)` replacing `markdownBelow` for `agents/`. **Step 4:** PASS; `pnpm source-names` → 0
  findings. **Step 5: Commit** `fix(source-names): both builder names, in every file the mirror copies`

### Task 2.5: Part 2's close

- [ ] **Step 1:** `pnpm format`, `pnpm check`, `pnpm plugin:validate` pass. Open the PR ready on part 1's branch. Send
  the 3D plan audit the note that task 10.1's pattern now exists (spec 7). Update `skills-progress.md`.

---

## Part 3: The skill text (PR `claude/skills-text`; C3 to C8; spec 6.2)

All tests in `tooling/agent-skills/tests/unit/skill-content.test.ts` unless named; each reads the fact from code.

### Task 3.1: The editor skill (C3)

**Files:** Modify `agents/automata/skills/automata-editor/SKILL.md` (and its `description`: "open a game's levels and
the Tuner"). Test reads `packages/tools/src/features/editor/editor-command.ts`'s `USAGE`.

- [ ] **Step 1: Write the failing tests**: `documents every editor flag but 3d` (each `--[a-z-]+` in `USAGE` is in the
  skill; `2d|suite` is, `3d` is not); `explains the Tuner` (the skill contains `Tuner`, `pnpm dev`, `--game-url` and
  `http://localhost:5173`); `names the 2D editor's views` (`Map`, `Tiles`, `Add tiles`, `Characters`, checked against the
  folder names in `packages/editor/src/features/`); `has no unreachable symptom` (`listening beyond the loopback` absent).
  **Step 2:** FAIL. **Step 3:** the usage line `automata editor [folder] [--app 2d|suite] [--app-dir <build>] [--port <n>]
  [--lan] [--token <t>] [--game-url <address>]`; a "## The Tuner" paragraph ("`--app suite` opens the editors' page with
  the Tuner. It shows your game beside its settings, so start the game with `pnpm dev` first; if it is not on
  `http://localhost:5173`, give its address with `--game-url`."); one line on the 2D editor's Map, Tiles (Add tiles: pick an
  image and a tile size, saved in the game folder) and Characters; the token row removed; "Without it: only 2D level
  files (`*.af2d.json`)". **Step 4:** PASS. **Step 5: Commit** `docs(skills): the editor skill covers the Tuner and the flags`

### Task 3.2: One sim import list (C4)

**Files:** Modify `agents/automata/skills/automata/SKILL.md` ("Inside a sim file…"), `automata-verify/SKILL.md` (`import`
row). Test reads `IMPORT_ALLOWED` from `packages/tools/src/features/boundaries/sim-rules.ts` (import it; agent-skills
gains `@automata/tools: workspace:*` as a dev dependency, or the test parses the `Set([...])` literal; prefer the import).

- [ ] **Step 1: Write the failing tests**: `both skills list every import a sim file may make` (each `IMPORT_ALLOWED` name,
  with `@automata/sim/hash` and `/math` allowed as "`/hash`", "`/math`" beside `@automata/sim`, is in both; both say
  `simEntries`); `physics entry points` is added to `RETIRED` in `skills-text.test.ts`. **Step 2:** FAIL. **Step 3:** one
  sentence, the same in both: "A sim file may import only `koota`, `zod`, `@dimforge/rapier2d-deterministic-compat`,
  `@dimforge/rapier3d-deterministic-compat`, `@automata/sim` (and `/hash`, `/math`), the sim entries an installed extension
  declares in its `package.json` (`"automata": { "simEntries": […] }`), and relative files." **Step 4:** PASS. **Step 5:
  Commit** `docs(skills): one list of what a sim file may import, from the checker`

### Task 3.3: Game rules and repository rules apart (C5)

**Files:** Modify `automata-verify/SKILL.md`, `packages/tools/src/features/boundaries/platform-imports.ts:27`. Test
`skill-content.test.ts`, `packages/tools/tests/unit/boundaries/platform-imports.test.ts`.

**Interfaces:** `REPOSITORY_ONLY_RULES = ['feature-import', 'shared-import', 'app-import', 'entries-import',
'entries-logic', 'testing-import', 'alias-in-src', 'browser-import', 'forbidden-import', 'platform-import']` is the
test's table, checked against the `Rule` union (each must be in it) and against `check-steps.ts` (its boundaries call
passes only `--game`).

- [ ] **Step 1: Write the failing tests**: `lists the repository-only rules under their own heading` (each id appears
  after `## Only in the framework's own repository` and not before it); in `platform-imports.test.ts`, `suggests
  fakeHosting for @ruken/sdk-host` (message contains `@automata/framework/testing (fakeHosting)`). **Step 2:** FAIL.
  **Step 3:** move the ten rows; the heading's first line: "`automata check` never reports these on a game; they guard
  the framework's own packages." Fix the message. **Step 4:** PASS; `pnpm api-report` unchanged (a string, not an export).
  **Step 5:** changeset `patch` for `@automata/tools` ("The platform-import rule names fakeHosting."). **Commit**
  `docs(skills): the framework's own rules apart; fix the fakeHosting hint`

### Task 3.4: CSP wording, shipping, the description (C6, C7, C8)

**Files:** Modify `automata-verify/SKILL.md` (the `no-eval` heading, `csp`, `data-url`, `koota-soa`, `csp-violation`
rows), `automata/SKILL.md` ("Saving, publishing, the host" bullet), `agents/automata/.claude-plugin/plugin.json`
(description). Tests `skills-text.test.ts`, `skill-content.test.ts`, `layout.test.ts`.

- [ ] **Step 1: Write the failing tests**: `Ruken's CSP` and `Ruken's Content-Security-Policy` join `RETIRED`; `says how
  to ship` (the `automata` skill contains `automata build`, `automata ship prepare`, `automata ship publish` and every
  `DIST_TARGETS` value, and links `docs/guides/publish-to-`); `the plugin description names the editor`. **Step 2:**
  FAIL. **Step 3:** the reason becomes "web targets run without `eval`; the check loads the game under Ruken's policy,
  the strictest one"; the bullet: "**Shipping**: `automata build`, then `automata ship prepare --target <web|itch|ruken|tauri>`
  and `automata ship publish`; the framework's publish guides cover each target. Host access goes through `Hosting` and
  `ship.config.ts`, never browser storage."; the description: "Automata Framework skills (rules, test-first features,
  the exact API, the editor, check findings) and hooks that run automata check after sim edits and before a turn ends."
  **Step 4:** PASS; `pnpm agent-skills`; `pnpm api-index` still clean (the version field untouched). **Step 5: Commit**
  `docs(skills): every web target's CSP, how to ship, the editor in the description`

### Task 3.5: Part 3's close

- [ ] **Step 1:** `pnpm format`, `pnpm check`, `pnpm source-names`, `pnpm plugin:validate`. Read each changed skill
  with the drunk grandma test and note it in the PR. Open the PR ready on part 2's branch; update `skills-progress.md`.

---

## Part 4: The install suite (PR `claude/skills-install`; M5; spec 5)

### Task 4.1: Two sources and a stranger's game

**Files:**
- Modify: `tooling/agent-skills/tests/install/install.test.ts` (rewritten), `vitest.install.config.ts` (comment),
  `tooling/agent-skills/package.json` (dev dependency `@automata/consumer-smoke: workspace:*` if its helpers are not
  importable by path; prefer the relative import the repo already uses between tooling packages)
- Consumes: `writeMirror` (task 1.1); `strangerFolder`, `packOverrides`, `overridesYaml`
  (`tooling/consumer-smoke/src/stranger.ts`); `packAll(root, project)` (`commands.ts`); `readAgentPackage`.

- [ ] **Step 1: Rewrite the suite.** Its cases (names are the test names):
  - `runs on Claude Code 2.1.301`
  - `validates strictly: the plugin, the framework marketplace and the mirror`
  - for each source in `[{ name: 'automata-framework', dir: REPO }, { name: 'automata-skills', dir: mirror }]`:
    `installs from the <name> marketplace`, `loads <n> skills and both hooks` (`Skills (${skills.length})`, every name,
    `Hooks (2)\s+PostToolUse, Stop`), `installs the skills byte for byte`
  - `blocks a sim edit that imports effect, through the installed hook, in a new game`: `create-game` from the packs in
    a `strangerFolder()`, `pnpm install` with `overridesYaml(packOverrides(...))`; a clean edit of
    `src/features/square/square.system.ts` exits 0; `src/features/square/seeded.system.ts` importing `effect` exits 2
    with `"rule":"import"`
  - `installs the skills for Claude Code, Codex and Cursor with the Agent Skills installer, byte for byte` (from the
    mirror tree; `SKILL_NAMES` from `readAgentPackage`)
- [ ] **Step 2: Typecheck** `pnpm --filter @automata/agent-skills typecheck`. Expected: PASS. (The suite cannot run in a
  cloud session: it downloads npm code. Say so in the PR.)
- [ ] **Step 3: Commit** `test(agent-skills): the install suite installs from the mirror into a new game`

### Task 4.2: Run it before every publish

**Files:** Modify `.github/workflows/release-checks.yml` (after the consumer smoke), `tooling/agent-skills/tests/unit/ci.test.ts`.

- [ ] **Step 1: Write the failing test** `release checks run the install suite after the consumer smoke, with the
  pinned CLI`: the workflow has `npm install --prefix "$RUNNER_TEMP/claude-code" @anthropic-ai/claude-code@2.1.301`, adds
  `$RUNNER_TEMP/claude-code/node_modules/.bin` to `$GITHUB_PATH`, and `pnpm --filter @automata/agent-skills test:install`
  comes after `node tooling/consumer-smoke/src/run.ts --from packs`. **Step 2:** FAIL. **Step 3:** the two steps.
  **Step 4:** PASS; workflow invariants pass.
- [ ] **Step 5:** Ask the Owner (in the thread) to run `pnpm --filter @automata/agent-skills test:install` once on the
  runner, or dispatch `release checks` by hand on the part's branch; keep the first attempt's log in the PR whatever it
  shows. A red run blocks the merge until explained.
- [ ] **Step 6: Commit** `ci(release-checks): the install suite before every publish`; open the PR ready on part 3's
  branch; update `skills-progress.md`.

---

## Part 5: The site offers the plugin (PR `claude/skills-site`; M3, D3 A; spec 8.5)

### Task 5.1: Start lists the framework's plugin

**Files:** Modify `site/src/features/start/agent-setup.ts`, `AgentSetup.svelte`, `docs/refactor/copy.md` ("Skills").
Test `site/tests/unit/start/agent-setup.test.ts`.

**Interfaces:** Produces `AUTOMATA_INSTALL = { marketplace: '/plugin marketplace add mcthaydt/automata-skills',
plugin: '/plugin install automata@automata-skills', skills: 'npx skills add mcthaydt/automata-skills', testedOn:
'Claude Code 2.1.301' }`; `SKILL_PREFLIGHT` gains "Confirm the Automata skills are installed (automata, automata-api,
automata-editor, automata-feature, automata-verify)."

- [ ] **Step 1: Write the failing tests**: `offers the Automata plugin beside Superpowers and PixiJS` (the three lines);
  `says which Claude Code version the lines were tested on` (`testedOn` equals the install suite's `CLAUDE_VERSION`,
  imported); `the preflight lists every skill` (names from `readAgentPackage`). **Step 2:** FAIL. **Step 3:** the
  constants and one card in `AgentSetup.svelte`, in the site's look (`--edge-sm/md`, 44 px targets). **Step 4:** PASS; the
  site's Chromium suite for Start at 390 × 844 and 1440 × 900, screenshots opened.
- [ ] **Step 5:** Open the PR ready on part 4's branch with "Merges after the first mirror push, installed from
  mcthaydt/automata-skills on Claude Code 2.1.301" at the top. Merge only when that install's log is in the PR.
  **Commit** `feat(site): Start offers the Automata skills`

---

## Done

Spec section 1's criteria 1 to 8 and 10 pass with the commands in each part's close; 9 waits on the first mirror push
(the Owner's `SKILLS_TOKEN` and release). `skills-progress.md` says so, and the merge thread is asked to land part 1
before any release (spec 10).

## Self-review (writing-plans, 2026-11-07)

1. **Spec coverage:** 1.1 → 1.1, 1.2; 1.2 → 1.1; 1.3 → 4.1, 4.2; 1.4 → 2.1, 2.2; 1.5 → 3.1 to 3.4; 1.6 → 2.3; 1.7 →
   2.4; 1.8 → the cross-dependency note sent with this PR and again at 2.5; 1.9 → 5.1; 1.10 → this PR (audit copy,
   `skills-progress.md`). Section 4 → part 1; 5 → part 4; 6.1 → 2.1, 2.2; 6.2 → part 3; 6.3 → 2.3; 6.4 → 2.4; 7 → the
   note; 8 → the part PRs; 9 → 1.1 (names), 1.1 (the README line), 5.1 (gate), 3.3 (table).
2. **Step scan:** every code step names its file, signature and the spec's exact words; test steps carry assertions;
   no TBD. Task 2.1's `signatureIn` heading shape is to be read from `render.ts` before writing; that is a lookup, not
   a decision.
3. **Type consistency:** `writeMirror`, `MirrorOptions`, `MirrorError`, `mirrorReadme`, `mirrorMarketplace`,
   `packageNamesIn`, `declarationExports(files, paths)`, `AUTOMATA_INSTALL` are used with the same names throughout.
4. **Review Focus:** five lines, each with its test in the owning task.
5. **Proportion:** about twice the spec's length, mostly test names and the copy the spec fixes; no bodies beyond the
   README's words.

## Execution log

- 2026-11-07: plan written (stage 2), `claude/project-thread-wd20yh`.
