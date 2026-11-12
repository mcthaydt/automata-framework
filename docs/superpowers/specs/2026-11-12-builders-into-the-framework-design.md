# The builders move into the framework

Workstream 6. The Owner, 2026-11-12, asked which repository the wardrobe work needs and was given two options: fold
FigureBuilder's source into the framework, or keep it apart and grant push access. The answer: "Do 1 and do the same for
environment builder."

## Why

The two builders were spikes, meant to be replaced by the framework and its editors (the Owner, at the start of this
work). Today the framework borrows FigureBuilder as a private git submodule and never changes it, so every change to how
a figure is painted needs a second repository, a pin move and a session with other access. That blocked the wardrobe, the
lamp in a figure's hand and the cutscene poses. EnvironmentBuilder is not a build-time dependency: the world kit already
ports its look, and what the port left behind is unknown until it is surveyed.

## What moves

### FigureBuilder (first)

- At `23f889c8` (its `main`, and the framework's pin): about 7,500 lines of source in 36 files, about 4,000 lines of
  tests, eight library JSON files, 228 PNGs, five pixel goldens that fail on one texel, a viewer and thin scripts. Its
  dependencies are `pixi.js` and `@pixi/3d` (vendored there, beta.2).
- Its source becomes a private package in the framework's workspace. The plan names the home; `AGENTS.md` already names
  "figures" as a private package. The character kit keeps its one door to it.
- Its unmerged branch `claude/c9-wardrobe` (six of ten tasks built: sheer cloth, the shod foot, the head's form, front
  hair, hair that rests on the trunk, a fringe and three styles) comes across after the base, as its own commits.
- The submodule, `vendor/figure-builder`, the type-generation step every session runs by hand and the workflows'
  submodule checkout all go.

### EnvironmentBuilder (second)

- At `f7c5356`: about 9,100 lines of source in 68 files, about 4,500 lines of tests, eight library JSON files, 42 PNGs
  (CC0 photos with recorded sources), three goldens, a GPU harness.
- The plan starts with a survey: each of its features against the world kit and the 3D package, marked already ported,
  to move, or not wanted. The photo pipeline, the dresser and its kits, the map generators, the structure and
  readability checks and the GPU harness are the known candidates.
- What moves goes to the home the framework's rule gives it; nothing is copied that the world kit already does.

## Rules

1. **Nothing changes how a figure or a scene draws.** FigureBuilder's five goldens and EnvironmentBuilder's three come
   across as recorded and pass unmoved in their new home. The character kit's and the world kit's own goldens do not
   move. A golden that would move stops the work.
2. **The framework's rules apply to what arrives:** feature folders, `pnpm boundaries` (the builders' own layer rules
   are restated in the framework's form, not dropped), tests in `tests/` importing `#src/…`, kebab-case names, files of
   at most 600 lines, Zod as the only schema language, PixiJS only for rendering, comments that say why. Where a file
   must change to meet a rule, the change is separate from the move and shows no pixel difference.
3. **Where a piece goes** is the standing rule: core only if any game could use it and it imports no extension; an
   extension if generic within a genre; otherwise not in the framework. Neither builder is core. Brand or game content
   in either repository does not come.
4. **History is kept.** The move preserves each repository's commit history where the tooling allows, or records the
   source commit and a file-by-file checksum where it does not.
5. **Private until Pixi 3D is public.** The packages are private like the editors. Photos keep their source, licence and
   credit records.
6. **One upgrade at a time.** The `@pixi/3d` beta.3 upgrade (`claude/pixi-3d-beta-3`) is in flight. FigureBuilder's view
   code runs on beta.2; the plan says which lands first and what the other then has to redo.
7. **No paid stage and no model call.** Both builders are free to run and stay so.

## Done means

- A fresh clone of the framework builds, checks and tests with no submodule, no second repository and no manual step.
- The character kit and the world kit draw exactly what they drew before, proven by their goldens and by the builders'
  own goldens in their new home.
- The wardrobe tasks of workstream 4 (its tasks 13 to 16) are framework tasks, with no session needing other access.
- A figure change (a held item, a cutscene pose) can be made, tested and merged in the framework alone.
- `docs/superpowers/progress.md` records what moved, what did not and why, and the two repositories carry a note that
  they are retired. Archiving them is the Owner's.

## Not in this work

- New figure or scene features (the wardrobe's remaining tasks, held items, poses, meshes replacing blockouts): they
  follow, in their own workstreams.
- Publishing either package.
- EnvironmentBuilder's and FigureBuilder's forks, if any exist elsewhere.

## Stages

The Owner's staged workflow: plan (with the two surveys), plan audit, execution in two groups (FigureBuilder, then
EnvironmentBuilder), implementation audit, fixes, review. FigureBuilder's group may merge before EnvironmentBuilder's
starts.
