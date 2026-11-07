# automata-skills plan audit (stage 3)

- **Pipeline:** "Bring automata-skills up to date", stage 3 of 6. Audits the [spec](2026-11-07-skills-spec.md) and the
  [plan](2026-11-07-skills-plan.md) against the [audit](2026-11-07-skills-audit.md), the checkout and the audited 3D
  slice plan.
- **Read at:** `claude/project-thread-wd20yh` `8ee84442` (this PR, #446), stacked on #444 `64c27c91`; the 3D plan as
  audited in #445 (`claude/project-thread-72073y`, `ff683ef0`).
- **How:** with the superpowers plugin (`superpowers:writing-plans`' self-review as the checklist), natively, no
  subagents. Every path, name, line and command in the plan was opened or run; `pnpm install` on Node 24.
- **Result:** 15 findings, all fixed in place in the spec and the plan. One new task (3.5, audit M5), so the build is
  5 parts and 17 tasks. Accepted under "Reminder that everything is auto approved and accepted, do not wait on me to
  do any approvals" (the Owner, 2026-10-31).

## Findings

| # | Severity | Where | Finding (evidence) | Fix |
|---|---|---|---|---|
| 1 | high | 4.1, spec 5 | The install suite edits `src/features/square/square.system.ts`, which a new game does not have: `template-game.ts` writes `move.command.ts`, `move.system.ts`, `square.component.ts`, `square.plugin.ts`, `square.view.ts`. | The clean edit is `move.system.ts`; `seeded.system.ts` is a new file. |
| 2 | high | 5.1 | The site test imports the install suite's `CLAUDE_VERSION` (a module-private `const` in a test file of another workspace) and `readAgentPackage` (tooling code with zod). | Both read the one pin in the root `plugin:validate` script; the skill list is the folders under `agents/automata/skills`. The install suite reads the same pin. |
| 3 | high | spec 3, new 3.5 | M5 fits this plan: the skills and the hook tell agents to run `automata check`, and its test step cannot run on Emberwick. Reproduced: `automata check --sim-only .` in `games/emberwick` → `ERR_MODULE_NOT_FOUND … packages/content/src/features/vite/index`, "0 findings, 1 step could not run". `vitest run --configLoader runner --project unit` there → 15 files, 109 tests passed. `testStep` (`check-steps.ts:78-87`) passes no `--configLoader`; Emberwick's scripts do. | New task 3.5 adds `--configLoader runner`; test in `run-check.test.ts:126`; the stranger's game is proven by the consumer smoke's `pnpm check`. Spec 6.5. |
| 4 | medium | 2.1 | `signatureIn` was to read `## <pkg>` / `### <name>`. The reference is `` ## `<package>` ``, `` ### `import { … } from '<entry>'` ``, `` #### `<name>` (<kind>) ``, then one ` ```ts ` block. The "no body" test decided nothing. | The helper's shape is written down; the body test is "no line starts with whitespace and `return `" (7 today, `api.md` lines 2497 to 2675, all six definers). |
| 5 | medium | 3.2 | "Import `IMPORT_ALLOWED`, or parse it; prefer the import" left a choice that has no good branch: `@automata/tools` exports only `.`, `./internal`, `./e2e`, none with `IMPORT_ALLOWED`. | Read the `Set([...])` literal as text, the way `checkRuleIds` reads the `Rule` union. No new dependency. |
| 6 | medium | 3.1 | `USAGE` in `editor-command.ts` is not exported. | Read the file as text and take the template literal. |
| 7 | medium | Global Constraints | `pnpm cheatsheet` does not exist (root scripts); `api-index --write` writes the cheatsheet, `api.md` and the plugin version; `agent-skills` has no `--write`. The changeset line named task 4.2, which has none; 3.3 has one. | Rewritten; tasks 3.3 and 3.5 take the two `patch` changesets. |
| 8 | medium | 1.1, Review Focus | The mirror's README and marketplace description are public text written inside `mirror.ts`, which `pnpm source-names` never scans. | Test `the mirror names no source project` over every mirror file (`SOURCE_NAMES`, relative import as the repo does for `tooling/release`). Review Focus 6. |
| 9 | medium | spec 7, 2.3, 2.4 | The audited 3D plan (#445) did not fold in spec 7: its 13.2 still writes "the agent package's 3D skills and API reference", and its 10.1 adds the second builder's name and `findSourceNames(root, options?)` on its own. The notes went to the 3D build thread. If 13.2 lands first, task 2.3's test fails. | 2.3 and 2.4 say what to do when the 3D build's version lands first (take 3D text out under D2 A and tell that thread; keep one pattern and 10.1's signature). Spec 7 records it. |
| 10 | medium | Global Constraints | `pnpm style` reads every comment under `tooling/*` and `packages/tools`, and the prose of workflow YAML, for plan ids (`plan-comments.ts`, `docs.ts`); the plan cites ids everywhere. | Constraint: comments say what and why, never a finding or task id. |
| 11 | low | 1.1 | `plugin:validate` runs the CLI right after `rm -rf .mirror`, but the generator only accepted an existing empty folder. | `writeMirror` creates `out`; test `creates the out folder when it does not exist`. Its README version source (the plugin manifest) is named. |
| 12 | low | 1.1 (copy) | Drunk grandma: "Skills and hooks", "generated by the framework's release". | Plain words; "Please don't edit this repository" with the reason. |
| 13 | low | 3.4 (copy) | `automata ship publish` takes `--target` too (`publish-to-itch.ts:9`); "the strictest one" is a claim nothing measures. | The bullet names both commands with `--target`; the CSP line says what `automata check --csp` does. Spec 6.2 row C6 matches. |
| 14 | low | 5.1 (copy) | `SKILL_PREFLIGHT` says "If either collection is missing"; with the Automata skills it names three. | "If any of them is missing"; the card's words are written down. |
| 15 | low | 1.2, 4.2 | `pnpm dlx` of the CLI may be refused in a session (the audit installed it in the scratchpad instead). The install suite's config comment still names Emberwick and browsers. `release-checks` has a 40 minute budget the suite adds to. | The scratchpad route is a Global Constraint; 4.2 updates the comment and raises the budget only if the first run passes 30 minutes. |

## Checked and right

- Lines and names: `declarationExports` at `extract.ts:192-205`, `indexRows` in `rows.ts`, `entryPoints` and
  `publishablePackages`; the `skills` job at `release-packages.yml:197-244` (no Node step, `cp -R` at 233);
  `release-checks.yml`'s order (`api-index`, `agent-skills`, `plugin:validate`, the consumer smoke at 74);
  `SOURCE_NAMES` (five entries) and `markdownBelow` in `source-names.ts`; `@ruken/sdk-host`'s hint is `FakeHosting`
  and the export is `fakeHosting`; `DIST_TARGETS = ['web', 'itch', 'ruken', 'tauri']`; the four publish guides;
  `strangerFolder`, `packOverrides`, `overridesYaml` and `packAll`; the site's `agent-setup.ts` and its test.
- The published packages are `framework`, `content`, `sim` and `tools`, and the agent package names only those today
  (12, 12, 20 and 5 mentions), so task 2.3's second test passes on today's tree.
- `readAgentPackage` on a tree whose marketplace source is `./` reads the tree itself as the plugin, so task 1.1's
  first test works as written; `.mirror/` is ignored by Biome and knip through `.gitignore`.
- The plugin version that the README prints follows the release: `release:version` runs `pnpm api-index --write`.
- The ten repository-only rules of task 3.3 are all in the `Rule` union, and `automata check` runs boundaries with
  `--game src` only (`check-steps.ts:66`).
