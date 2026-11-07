# automata-skills: build audit (stage 5)

- **Pipeline:** "Bring automata-skills up to date", stage 5 of 6 (build audit). The build is PRs #447 to #451, a stack
  on #446; the [spec](2026-11-07-skills-spec.md), the [plan](2026-11-07-skills-plan.md) and the rulings in
  [skills-progress.md](skills-progress.md) are what it was read against.
- **Written:** 2026-11-07 with the superpowers plugin (`superpowers:requesting-code-review`,
  `superpowers:verification-before-completion`), natively: no subagents (the Owner allows none, so the review the skill
  would hand to a subagent was done inline, from the diff and the code, not from the build thread's notes).
- **Audited head:** `af43ff67` (`claude/skills-site`), against `59ab1b53` (#446's head). Findings are not fixed here;
  stage 6 (Sonnet, high) fixes them.

## Verdict

The build does what the spec asks in all five parts, and every gate I could run here is green. The mirror generator is
small and right, the C1 fix is real (red when reverted), and the install suite passes end to end. Four Important
findings remain. Three are public text (the mirror's first push would carry them). One is a merge gate. None needs a
design change.

## What was run (fresh, this session, Node 24.22.1)

| Check | Result |
|---|---|
| `pnpm build` | exit 0 |
| `@automata/agent-skills` unit tests | 151 passed (10 files) |
| `@automata/repo-hygiene`, `@automata/api-index`, `@automata/api-report` | 93, 45, 45 passed |
| `packages/tools` `platform-imports.test.ts`, `run-check.test.ts` | 44 passed |
| `site` `agent-setup.test.ts` | 4 passed |
| typecheck: agent-skills, repo-hygiene, api-index, api-report, tools | clean |
| `pnpm style`, `pnpm boundaries`, `pnpm knip`, `pnpm source-names`, `pnpm check:changesets` | 0 findings each (knip exit 0) |
| `pnpm api-report` | 0 undeclared breaks |
| `pnpm api-index`, then diff with the committed files | `api.md` and `docs/cheatsheet.md` identical: the committed reference is fresh |
| `pnpm agent-skills` | 5 skills, no layout problems |
| Biome on the 28 changed files | 0 errors; 30 warnings, the same 30 as on #446's head (site CSS, one test) |
| **Install suite** (`pnpm --filter @automata/agent-skills test:install`, Claude Code 2.1.301 from the scratchpad on `PATH`) | **10 passed**: three trees validate `--strict`; both marketplaces install, `Skills (5)`, `Hooks (2) PostToolUse, Stop`, skills byte for byte; the mirror's hook passes `move.system.ts` and blocks `seeded.system.ts` (exit 2, rule `import`) in a `create-game` game from the packs; `npx skills@1.7.0 add` copies all five for Claude Code, Codex and Cursor |
| Red-green: `indexRows` without `paths` | `reexport.test.ts` fails 2 of 2; restored, passes |
| Red-green: the check without `--configLoader runner` | `run-check.test.ts` fails 1; restored, passes |
| Mirror tree written by `mirror-cli.ts`, scanned for the source projects' names | none |

Not run here: CI on the runner (every job on #447 was still queued at 12:33), Firefox and WebKit (not in sessions), the
stranger's journey (`pnpm check` on a new game, which is what proves `--configLoader runner` on a stranger's game: CI's
`stranger` job). Those stay pending gates, not passes.

## Findings

### Important

**I1. The skill says two entry points are left out of the reference; there are three, and the third is one the skills
tell agents to import.** `automata-api/SKILL.md` (part 2, C2): "two are not in it, `@automata/framework/target` … and
`@automata/framework/theme.css`". `@automata/framework/no-eval` is not in `reference/api.md` either: its declaration is
`import '../shared/lib/no-eval.js';`, a side-effect entry with no exports, so `indexRows` writes no section for it. The
same skill says "Not listed means it does not exist", while `automata-verify` tells an agent to "Import
`@automata/framework/no-eval` first in the entry" (`function-constructor`) and every game must. An agent that follows the
API skill strictly drops the import. *Fix:* name `no-eval` in the line (a side-effect import, with what it is for), and
have `skill-content.test.ts` derive the left-out list from the published `exports` map (entries with no `types`, or
whose declaration exports nothing) instead of two typed names, so a fourth one cannot slip by.

**I2. The public mirror carries plan ids, closed-beta text and unpublished package names, against the plan's Global
Constraint ("no plan ids, nothing about closed betas"), and no check reads for them.** In the mirror tree written at the
audited head:
- `skills/automata-api/reference/api.md:7656`: "`private` is a game that carries `@pixi/3d`, a closed beta (D-1), until
  Pixi 3D's public release" (from `@automata/tools`' `audience` doc comment).
- `api.md:2691` "(plan D-2)", `:2412` "(Owner, 2026-10-18)", `:2440` "(ADR 0002)", `:5633` "(ADR 0006)": internal
  record ids a stranger cannot look up.
- `api.md:3097`: "an extension's renderer, such as render-pixi3d's `(options) => createPixi3dRenderer(…)`", a package
  that is not published.
- `skills/automata-verify/SKILL.md:146` (the `forbidden-import` row, moved by part 3 into the new table): "the 2D editor
  and `@pixi/3d`" and "it belongs in the 3D package".

`pnpm source-names` checks only the source projects' names, and `published-only.test.ts` matches only
`@automata/<name>`, so `render-pixi3d` and `@pixi/3d` pass both. All of this predates the build, but this pipeline is
what makes it public on the first release. *Fix:* reword those doc comments in their packages (plain words, no ids; the
`audience` comment can say "a game that uses a 3D library that is not public yet"), then `pnpm build`, `pnpm api-report
--update`, `pnpm api-index --write`, `pnpm agent-skills`, with `patch` changesets for the published packages whose doc
comments change; reword the `forbidden-import` row without `@pixi/3d`. Add one test over the mirror tree (beside "the
mirror names no source project" in `mirror.test.ts`) that fails on `closed beta`, `\bD-\d+\b`, `plan D-`, `ADR \d{4}`,
`Owner, 20` and the folder names of private packages (`render-pixi3d`, `editor-3d`, `figures`, `sector-format`, read from
the workspace's `private: true` manifests, not typed).

**I3. The shipping bullet sends agents to files a stranger does not have.** `automata/SKILL.md` (part 3, C7): "each has
a publish guide in the framework's docs (`docs/guides/publish-to-web.md`, `publish-to-itch.md`, …)". Those are paths in
the framework's private repository; a game made by `create-game` has no `docs/guides/`, and its own README says "guides
for publishing to each target are in the Docs on the Automata Framework site". The site serves them at
`/docs/publish-to-web`, `/docs/publish-to-itch`, `/docs/publish-to-desktop` and `/docs/publish-to-ruken`
(`site/src/shared/framework/guides.ts`, `start-content.ts`). *Fix:* name the site's Docs pages the way the game's README
does, and extend the C7 test to forbid `docs/guides/` in skill text.

**I4. The stack's heads do not hold #446's head, so their secret scan will be red.** #446's branch gained
`59ab1b53` ("Merge the secret-scan allowlist (350f4e9c) up from #421") after part 1 branched from `5ac10fc9`; `git
merge-base --is-ancestor 59ab1b53 claude/project-thread-r6rbj0` is false. `ci.yml`'s gitleaks scan on #447 to #451 then
runs without the allowlist for the three website-history commits. Merging #447 into #446 would keep the allowlist (no
side touches `.gitleaks.toml`), so this is a gate, not lost code. *Fix:* merge #446's head into #447's branch and up
the chain, the merge commit only (the merge thread's rule from the actionlint fix: merging the child chain pulls extra
commits).

### Minor

**m1. Start's readiness checklist still has three boxes and no Automata box.** `AgentSetup.svelte` counts
`superpowers`, `pixijs` and `loaded` and says "3 of 3 ticked. Your agent is ready." while the preflight above it now
asks the agent to confirm three collections. Add "The Automata skills are installed" and count four (the `copy.md`
row and the test follow).

**m2. Start's Automata card ignores the agent picker.** It says "In Claude Code, type:" when Codex or Cursor is picked,
and the preflight's "follow its upstream installation instructions" has no upstream for the Automata skills (it is this
card). Lead with the line for the picked agent (Claude Code's two lines, otherwise `npx skills add`), and say "follow the
install steps on this page" for the Automata skills.

**m3. The mirror README undersells and oversells.** Its first paragraph lists the rules, features, API and check
findings but not the editor, which part 3 added to the plugin's description (C8). And it says the plugin "also runs
`automata check` for you after each change", then offers `npx skills add` "for other agents", which installs the skills
and no hooks. Say the checks run in Claude Code, and name the editor (the README's text is pinned in `mirror.test.ts`
and the plan's task 1.1 words).

**m4. The verify skill's `no-eval` section says one sentence twice, and its proof line is jargon.** The heading "(web
games may not use `eval` on any target)" is followed by "Web games may not use `eval` on any target." Then "`automata
check --csp` opens your build under Ruken's rules to prove it": a stranger building for itch.io does not know what
Ruken's rules are. Drop the repeat; say "opens your build in Chromium under a strict Content-Security-Policy (the headers
Ruken sends)", the wording the step table already uses.

**m5. The `skills` job's header comment is stale.** `release-packages.yml` still opens the job with "after a release,
`agents/automata` is copied to mcthaydt/automata-skills"; part 1 updated the step's comment but not this one. Say the
generator writes the mirror.

**m6. The plan's 36 steps are all unticked.** The plan's header and `AGENTS.md` ("Mark plan steps when their required
checks pass, in the same session") ask for ticks; the build recorded progress only in `skills-progress.md`, so the
plan reads as not started. Tick the steps the ledger records as done (5.1's merge step stays open).

**m7. The published-only test only sees scoped names.** It is what pins D2 A, but a private package named bare
(`render-pixi3d`, `editor-3d`) or a closed-beta library (`@pixi/3d`) passes it. I2's mirror test covers this; noted
separately so the fix thread does not widen `packageNamesIn` instead (its job is `@automata/*`).

### Agreed with the build's rulings

Each ruling in `skills-progress.md` was checked against the code and stands: 13 mirror tests instead of 10 (same
cases, finer); `mirror.ts` without `skill-tree.ts`; `release-checks.yml` not edited for the mirror's validation (it
already runs `pnpm plugin:validate`, which now builds and validates the mirror); the tests' new `reexport.test.ts`;
`paths` typed as TypeScript's; the shipping bullet's `pnpm build:<target>` and `publish` for `itch` and `ruken` only
(there is no `automata build`, `create-game-targets.ts` writes the scripts); the CSP wording; the repository-only rows
in a closing section; the site test's copy-button count. The two deferred minors stand as minors: the release job does
not validate the clone before it pushes (release-checks validates the same generator's tree), and `testedOn` is a
typed string a test keeps equal to the pin.

## Completeness against the spec's "What done looks like"

| # | Item | State at the audited head |
|---|---|---|
| 1 | Mirror installs as a marketplace on 2.1.301, proven before a release | Done (install suite, this session) |
| 2 | README, MIT licence, nothing stale | Done; README text m3 |
| 3 | Install suite on a stranger's game, both sources, in release-checks | Done; first runner run is the Owner's |
| 4 | Declarations only, six definers pinned; C2 line | C1 done; C2 line wrong (I1) |
| 5 | Skill text C3 to C8; `automata check` runs Emberwick's tests | Done; I3, m4. Emberwick's browser projects need Firefox/WebKit, so not provable in a session |
| 6 | Only published packages, by a test | Done for `@automata/*`; I2, m7 for the rest |
| 7 | Both builder names, every file under `agents/` | Done (`pnpm source-names` 0; mirror scan 0) |
| 8 | 3D cross-dependencies handed to the 3D plan | Handed off (progress hand-offs); not this stack's to land |
| 9 | Site offers the plugin after the first mirror push | Built (#451); waits for the push; m1, m2 |
| 10 | Pipeline docs in `docs/refactor/` | Done |

## For stage 6

Fix I1 to I3 and m1 to m7 on the branches they belong to (I1, I2 and m7 on part 2's; I3, m4 on part 3's; m3, m5 on
part 1's; m1, m2 on part 5's; m6 on the top), each test first. I4 is a merge, done before judging any head's checks.
Rerun `pnpm api-index --write` and `pnpm agent-skills` after I2, and the install suite once at the end.
