# The npm scope is `@automataframework` (2026-11-12)

The Owner, 2026-11-12: "go with automataframework for the npm org". The `@automata` scope on npmjs.org belongs to
another account (`registry.npmjs.org/-/org/automata/package` lists `noflo-webaudio`, `zeh` and 13 more), so nothing of
ours could publish under it (the ship-readiness audit, M1). Every package `@automata/<name>` is now
`@automataframework/<name>`, made by one command that anyone can run again.

## The one command

```sh
node tooling/codemods/src/rename-scope-cli.ts      # --dry-run to count without writing
pnpm install --force                               # rewrites pnpm-lock.yaml from the package.json files
```

`--force` matters on a machine that installed before the rename: a plain `pnpm install` rewrites the lockfile and the
packages' own links but leaves pnpm's hidden hoist folder (`node_modules/.pnpm/node_modules/@automata`) under the old
name, and `cutscenes`' tests read narrative's fixtures through it (`Cannot find module
'@automataframework/narrative/testing/fixtures/…'`). A fresh install (CI) is not affected.

The codemod (`tooling/codemods/src/rename-scope.ts`) has two rules:

| Old | New | Where it is written |
|---|---|---|
| `@automata` as a whole word (`(?![a-z0-9-])` after it) | `@automataframework` | imports, `package.json` names and keys, `--filter`s, Markdown, YAML, changesets, regular expressions with an escaped slash (`@automata\/`), the bare scope (`node_modules/@automata`, `'@automata'`, `scope: "@automata"`) |
| `automata-<name>-<version>.tgz` | `automataframework-<name>-<version>.tgz` | `npm pack` file names and patterns for them (`/automata-tools-.*\.tgz$/`) |

It reads tracked text files only (`git grep`), in sorted order, so `node_modules`, `dist` and build output are never
touched; it formats the files it changed with Biome, as `pnpm format` would (a longer name pushes 75 import lines past
the line width); and it is idempotent: neither rule matches its own output, so a second run prints `changed 0 files,
0 names` (tested in `tooling/codemods/tests/unit/rename-scope.test.ts`). The lockfile is never edited by hand: after
`pnpm install`, the new `pnpm-lock.yaml` is byte for byte the old one with `@automata` rewritten (268 lines, checked by
diffing it against a `sed` rename of the old one).

## To perform the rename on a newer `main`

Other branches merge first, so the rename that lands is the same command re-run on the `main` of that day; the rename
commit on `claude/scope-rename` is its rehearsal and proof. On a branch from the then-current `main` that already has
the codemod (it can merge early, below):

1. `git fetch origin main && git checkout -B claude/scope-rename-apply origin/main && pnpm install --frozen-lockfile`.
2. `node tooling/codemods/src/rename-scope-cli.ts --dry-run`: expect roughly 2,100 to 2,600 files and 4,800 to 6,000
   names (2,191 and 4,967 on `d401ec4d`); a count far outside that means the keep-list or the tree changed, so look.
3. Line budgets first: the rename lengthens names by 9 characters, and Biome re-wraps imports past 110 columns. Run the
   codemod, then `pnpm style` and `pnpm --filter @automataframework/examples-runner test:unit`; a file pushed over 600
   lines or an example over 100 code lines gets a behaviour-free prep commit on the branch **before** the rename commit
   (as `536f9c45` and `3f4dfeab` did), and the codemod is run again from a clean tree.
4. `node tooling/codemods/src/rename-scope-cli.ts` (rewrites and formats), then run it again: `changed 0 files, 0 names`.
5. `pnpm install --force`; check the lockfile's diff is renames only:
   `git show HEAD:pnpm-lock.yaml | sed -E 's/@automata([^a-z0-9-])/@automataframework\1/g' | diff - pnpm-lock.yaml`
   prints nothing.
6. `pnpm build`, `pnpm api-report --update`, `pnpm api-index --write`, `pnpm agent-skills`: they should change nothing
   further (`git status` lists only the codemod's files and the lockfile).
7. Commit everything as one commit, "refactor: the npm scope is @automataframework", its body the Owner's sentence, the
   commands, the counts and the non-changes (copy `ac1f1de3`'s). Tag its parent `pre-scope-rename` and it
   `scope-rename` when it merges (a merge commit, not squash or rebase).
8. Gates: `TURBO_FORCE=true pnpm check` (the guard switches on by itself), `pnpm build`,
   `pnpm --filter @automataframework/release test:dist`, `pnpm api-report`, `pnpm api-index`,
   `node tooling/consumer-smoke/src/run.ts --from packs`, the stranger's journey
   (`pnpm --filter @automataframework/consumer-smoke test:e2e`), `pnpm secrets`, the site's build and `check:site`.

**What can merge early, before the rename:** the codemod and its tests (`fee482b5`) and the guard
(`tooling/codemods/tests/unit/scope-hygiene.test.ts`, its switch below) touch nothing else and pass on the old names.
The two prep commits can too. The consumer smoke's tools-pack fix in the follow-up commit is written in the new names;
on the old tree it is the same change with `@automata/tools`.

## The commits

| Commit | What |
|---|---|
| `fee482b5` | The codemod and its tests (`@automata` → `@automataframework`, pack names, formatting, idempotence) |
| `536f9c45` | Prep: Schematic's scene naming moves to `schematic-scenes.ts` (the re-wrapped imports would take `schematic-session.svelte.ts` from 598 to 603 lines, over the 600-line limit) |
| `3f4dfeab` | Prep: `figures-clips` types a key's ease from its clip (the re-wrapped import would take it from 100 to 107 code lines, over the catalog's budget). **This is the rename's parent: tag it `pre-scope-rename`** |
| `ac1f1de3` | The rename: exactly the command's output and the regenerated lockfile. **Tag it `scope-rename`** |
| the next | This guard, this README, `check-launch.ts`'s comment and the runbook's step 4 |

The merge session pushes the two tags when this branch merges, and merges it with a merge commit (not squash or rebase),
so both commits stay on `main` for branches to find.

## The counts

On `main` `d401ec4d` plus the two prep commits: **2,191 files, 4,967 names** rewritten (5,399 lines added and 5,057
removed after formatting), plus `pnpm-lock.yaml` (268 lines). The generators wrote nothing more: after `pnpm build`,
`pnpm api-report --update`, `pnpm api-index --write` and `pnpm agent-skills`, the tree was the codemod's output exactly
(the API reports, `docs/cheatsheet.md`, the agent package's `reference/api.md` and its skills are text the codemod had
already rewritten the same way). No recorded hash, golden or picture embeds a package name: the whole uncached
`pnpm check` passed with none moved.

## What stays, on purpose

**History keeps the old name.** The dated records state what was true when they were written ("`@automata` belongs to
another account"), and rewriting them would make them false:

- `docs/archive/`, `docs/refactor/`, `docs/superpowers/` (specs, plans, audits, briefs and the progress record);
- every `CHANGELOG.md`;
- `pnpm-lock.yaml` (regenerated by `pnpm install`, not by the codemod);
- the codemod and its own tests, which must name what they replace.

**Look-alikes that are not the npm scope** are not matched by either rule and did not change:

- the `automata` command and the bins `automata-check-boundaries`, `automata-content`, `automata-server`,
  `automata-pipe`, `automata-pipe-mcp`, `automata-world-textures`, `automata-examples`;
- the product name AutomataFramework, the root package `automata-framework`, the extension manifest key `"automata"` in
  `package.json`, the net room name `automata`, the `virtual:automata/*` modules;
- the repositories `mcthaydt/automata-framework` and `mcthaydt/automata-skills`, and the agent plugin
  `automata@automata-framework`;
- `@af-games/*` and `@af-examples/*`;
- the domain `automataframework.com`, its mailbox and the Cloudflare Pages project `automataframework`;
- the `Hosting` contract's message names;
- `@mcthaydt/*` in `first-public-release.md`'s sentence about what was published before (the earlier rename's
  `@mcthaydt` rules were dropped from the codemod, since re-running them would rewrite that sentence).

**Two lines written by hand afterwards:** the runbook's launch step 4 now names this branch and recipe, and `site/scripts/check-launch.ts`'s comment said "the `@automata` scope belongs to
another account until the rename lands"; the rename made it read "`@automataframework` … belongs to another account",
which is false, so it was rewritten in the follow-up commit.

## The guard

`tooling/codemods/tests/unit/scope-hygiene.test.ts` (part of `pnpm test:unit`, so of `pnpm check`) fails on any tracked
file outside the kept history that the codemod would still change. It uses the codemod's own rules and keep-list, so the
check and the fix cannot disagree: when it fails, run the command above. **Its switch:** it reads the framework
package's name; while that is still `@automata/framework` the strict check is skipped and a second test holds that the
old name is still there, so the guard can reach `main` before the rename and turns itself on with it. Before the
rename it failed on all 2,191 files; after, it passes, and it caught one old pack name in a new test fixture during this
session.

**The consumer smoke's tools pack.** `tooling/consumer-smoke/src/run.ts` found the tools pack by a hand-written
pattern, `/automata-tools-.*\.tgz$/`, and returned "not measured" when nothing matched, so a rename that missed it would
have skipped the size budget in silence. The codemod rewrote that pattern (its test has the exact line), and the
follow-up commit replaces it: `toolsPack` in `pack.ts` derives the file name from the package name the way `npm pack`
does and throws when a `packs` folder has no tools pack; only a registry run (no `packs` folder) measures nothing.

## Catching up an in-flight branch

Measured on two in-flight branches (scratch copies, never pushed; full history; conflicted files counted with
`git merge-tree`):

| Branch | Merge main, no catch-up | A: codemod on the branch, then merge the rename | B: merge `pre-scope-rename`, codemod, merge `scope-rename` |
|---|---|---|---|
| `claude/builders-fold-scenes` | 1 (`docs/provenance/sources.md`) | 2 (`sources.md`, `figures-clips.ts`) | 0, then 1 (`sources.md`) |
| `claude/artifacts-on-failure` | 0 | 1 (`figures-clips.ts`) | 0, then 0 |

Order B is better: merging the rename's parent first brings the two prep commits in before the codemod runs, so the
branch's codemod output matches `main`'s byte for byte. The `sources.md` conflict is not the rename's: the branch rewrote
rows that `main` renamed, and the branch's rows hold no old names, so take the branch's side for them. After order B on
`claude/artifacts-on-failure`, the codemod's dry run on the merged tree changes 0 files. (Merging the rename commit
itself, not `main`'s tip, matters too: `check-launch.ts`'s comment changed again after the rename, and only a branch
whose merge base is already `scope-rename` takes that change without a conflict.)

On a branch made before the rename reached `main`:

```sh
git fetch origin main --tags
git merge pre-scope-rename                 # 1. main just before the rename: resolve real conflicts here
git checkout scope-rename -- tooling/codemods/src/rename-scope.ts tooling/codemods/src/rename-scope-cli.ts \
  tooling/codemods/tests/unit/rename-scope.test.ts tooling/codemods/tests/unit/scope-hygiene.test.ts
node tooling/codemods/src/rename-scope-cli.ts   # 2. the same command, on the branch
pnpm install --force
# only if the branch changed a published package's exports or doc comments:
pnpm build && pnpm api-report --update && pnpm api-index --write && pnpm agent-skills
git add -A && git commit -m "refactor: the npm scope is @automataframework (catch-up)"
git merge scope-rename                     # 3. both sides made the same edits
git merge origin/main                      # 4. the rest of main
pnpm --filter @automataframework/codemods test -- scope-hygiene   # 5. the guard
```

Step 1's conflicts are the branch's own, not the rename's. If a step-3 conflict remains, it is a line the branch rewrote
that `main` renamed: keep the branch's text and run the codemod again over it. On a `pnpm-lock.yaml` conflict, take
`scope-rename`'s and run `pnpm install --force` again. The guard names every file a branch added with an old name; the
codemod fixes them.
