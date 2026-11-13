# The evidence step and the release tags (2026-11-13)

Branch `claude/evidence-tags`, from `origin/main` 28d72fb54. Code: `tooling/evidence/src/release-tags.ts`, `cli.ts`.

## The failure

On every push to `main`, the parity job's `pnpm evidence` step ends in
`Error: this checkout has no git tags; fetch the release tags first` (`collect.ts:106`), after the goldens pass.

## What the tags are for

`evidence.json` has one fact from tags: `packages[].released`, true when Changesets' release tag
`<name>@<version>` exists for the version in the package's manifest. The tool also refuses an empty tag list, because a
shallow clone has no tags and would report every package unreleased.

## How it broke

- `3055edb88` (2026-10-16) wrote the call as `git tag --list '@mcthaydt/*'`, a literal scope, and e6c44fbab
  (2026-11-07, "publish under the project's npm scope") rewrote it to `@automata/*` with the rest of the scope rename.
- The packages are now `@automata/*`, but nothing was ever released under that name. The 52 tags in the repository
  are all `@mcthaydt/automata-*@x` (plus `parked/*`). So the filtered list is empty, and the "no tags at all" refusal
  fired although the checkout has all its tags.
- The step passed on main run 42304357280 (2026-11-06, before the rename). Runs after it failed first at
  `@mcthaydt/automata-testing#test:evidence`, then, once the golden tests passed (#668, c0f321cf5), at this line.
  So it has not passed on main since the rename.
- Reproduced here before the fix: `git tag --list '@automata/*'` is empty, `git tag --list` has 52, and
  `packagesFromManifests` throws at `collect.ts:106`.

## The fix

`packagesFromManifests` already decides by `<name>@<version>` being in the tag set, so it needed no change. The
mistake was the CLI pre-filtering the tags by a scope written in the tool. `releaseTags(root)` now lists every tag, and
the package names decide which are theirs. No scope is written in the tool, so the scope codemod
(`tooling/codemods/src/rename-scope-cli.ts` on `claude/scope-rename`, which rewrites `@automata` followed by anything
but a letter, digit or `-`) has nothing here to miss, and the next rename needs no edit.

| State | Tags | `released` | Result |
| --- | --- | --- | --- |
| today: `@automata/*` names, only `@mcthaydt/automata-*` tags | 52, none of these names | all `false` | written; the CLI says "no release tag for any of these names yet" |
| after the codemod: `@automataframework/*` names | same 52 | all `false` | same |
| after the first public release: tags of the current names | `<name>@<version>` present | `true` for those versions | written |
| a shallow checkout (no tags at all) | none | not written | fails: no git tags, fetch them |

The old `@mcthaydt` tags are never used as a release of a package under another name: the lookup needs the exact
`<name>@<version>`. `released: false` is also true per package (a version bumped since its last tag), so the schema
(version 1, which the website validates) did not change.

## Evidence

- Tests first: `tests/unit/release-tags.test.ts` builds real git repositories in each state (red: the module did not
  exist; the same inputs through the old CLI expression threw at `collect.ts:106`). `collect.test.ts` pins the pure
  function in each state. The older scope's tags are spelled `@retired/...` in the fixtures, because the scope check
  forbids writing the retired scope outside the history.
- `pnpm evidence` locally, in all four engines (Chromium, Firefox and WebKit installed into the container with
  `playwright install --with-deps`): all four goldens tasks passed, and the CLI printed
  `evidence.json: 28d72fb (dirty), local run; 6 goldens (6 agree in all four engines), 13 packages (no release tag for any of these names yet)`.
- `evidence.json` and `evidence.schema.json` are in `.gitignore` (generated, uploaded as the `evidence` artifact), so
  nothing generated is committed.

## For the tracker

| Row | Cause | Evidence |
| --- | --- | --- |
| The parity job's `pnpm evidence` step is red on every push to main | The tag list was pre-filtered with a literal scope that the scope rename changed to `@automata/*`; no tag has that scope, and the "no tags at all" refusal fired on a checkout that had 52. | main run 42304357280 green before the rename; `collect.ts:106` reproduced locally; fixed by `releaseTags`, which lists all tags. |
| The evidence file says nothing is released | True: nothing is released under the `@automata` names; the tool now says so instead of failing. | Local `pnpm evidence`, 13 packages, none released. |
| Still open (Owner) | The first public release creates tags of the current names; after it, `released` turns true for them. Nothing in the tool changes at the scope rename or at the release. | `release-tags.test.ts`, the three states. |
