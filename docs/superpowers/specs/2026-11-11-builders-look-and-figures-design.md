# The builders' look and figures in the framework: design

**Date:** 2026-11-11. **Status:** in force; the Owner said yes to taking this over as a workstream. The calls at the
end are the coordinator's and open to correction. **Stage:** 1 (spec). **Tracker:** [`../progress.md`](../progress.md),
workstream 4.

## Why

FigureBuilder and EnvironmentBuilder were long spikes to give The Last Light better figures and better scenes. They
are to be replaced by the framework and its suites (the Owner, 2026-11-11). Work to bring their look into the
framework was started by other coordinators and then stopped: every session behind it is archived, part of it is on
`main`, and part sits in draft pull requests nobody is driving. The reference game's first slice
([spec](2026-11-11-last-light-on-the-framework-design.md)) has a step "dress it with the builders' figures and look",
which assumes that look exists in the framework. Today it only partly does. On 2026-11-11 the Owner looked at
screenshots of the 19 3D examples from `main`: two drew almost nothing (`world-level-room`, a lit room that came out
black, and `look-pixel-art`), which suggests the lit-room path on `main` is not healthy.

This workstream finishes that work, so the prologue can look right, and so the builders hold nothing the framework
lacks.

## What exists (to be verified by the survey, not trusted)

- **On `main`, by the record** (`docs/refactor/progress.md`; `docs/refactor/eb-look/gap.md` and its work packages WP0
  to WP10): The Last Light's gameplay camera as the default; haze; the sky pass; the dresser's placements; albedo as
  palette indices and photo tiles; the painted figures in the character kit (#577).
- **In draft pull requests:** #589 glow (27 commits), #590 effects (60), #607 `c8-lit`, figures lit as sprites (28),
  #603 its spec, #588 render extensions for The Last Light (25). In FigureBuilder: #29 `c9-wardrobe`.
- **Superseded by the Owner, references only:** the clinic drafts #575, #596 and #606.
- **The builders themselves:** FigureBuilder and EnvironmentBuilder at their `main`, each with its base set (the base
  pair; the base interior and exterior, bare and dressed) and its goldens. The framework consumes FigureBuilder as a
  private git submodule (`vendor/FigureBuilder`), imported only by `@automata/character-kit`.

## Goals

1. The framework draws the builders' base scenes with the base pair in them as the builders do: stepped light with
   sun, key and fill, haze, sky, glow, photo-textured surfaces, figures lit as sprites with their rim and exposure.
   "As the builders do" is judged on side-by-side sheets of the builder's frame and the framework's, and by a stated
   measure, not by eye alone.
2. Every taken-over pull request ends in one of three states, each recorded with its reason: merged, finished and
   merged, or closed as superseded. None is left open.
3. The lit-room path on `main` is healthy: a level's room, lit by its lamps and time of day, draws as intended in
   WebGL, with a browser test that would have caught the black room.
4. The prologue's dressing tasks can start: Ada and the Night Nurse as painted figures, the clinic's rooms lit and
   textured.
5. The builders hold nothing the framework lacks, so they can be retired.

## Non-goals

- The Last Light's content (workstream 2), the shared shell (workstream 1), a UI editor (workstream 3).
- WebGPU parity on a real GPU, and WebKit and Firefox: reported as not run until a runner exists; the Owner plans
  Ubicloud runners for this repository.
- New looks. This is the builders' look, finished; not a redesign.
- The old 3D examples. They are cut with Ember Hall and recreated after the prologue.

## Anti-goals

- A tolerance, a filter or a post pass that hides a mismatch (EnvironmentBuilder's own rule: fix it in the pipeline).
- A golden or hash re-recorded to get green without a commit that names why.
- Work merged from a draft pull request without being read and checked against `main` as it is now.
- A piece of the look in core that only a horror game would want.

## Constraints

- The framework's `AGENTS.md`: the seven laws, feature folders and `pnpm boundaries`, tests first and in `tests/`,
  look at the real expected, actual and diff images before accepting a visual change and explain each one.
- **Where a piece goes** (the Owner's rule, in workstream 2's spec): core only if any 3D game could use it; an
  extension if generic within a genre or a library of ready-made things; otherwise the game. The 2026-11-07 scope trim
  (`docs/refactor/2026-11-07-3d-scope-trim.md`) already rules most of the look: the low-resolution target, DUEL snap,
  ramp light, outline, sprite light, fog and sky are core; stars, rain, bloom, photo tiles and ready-made things are
  the world kit's; clothes and hairstyles are the character kit's.
- The private FigureBuilder submodule is empty in a fresh clone. A session that runs typecheck or tests attaches
  `mcthaydt/FigureBuilder` read-only and places it at the pinned commit, committing nothing from it.
- No subagents. Each stage in its own session and branch.

## Approaches

- **A. Survey, then finish in dependency order** (chosen). First a survey that measures, with screenshots, what of the
  builders' look `main` draws today, reads each draft pull request against `main`, and rules it merge, finish or
  close. Then the work in the order the prologue needs it: the lit room healthy, then light (sun, key, fill, steps),
  then figures lit as sprites, then glow and effects.
- **B. Merge the drafts as they are, then fix.** Fastest to green, but the drafts are days of unreviewed commits
  from sessions that stopped mid-task, and `main` has moved under them.
- **C. Start over from the builders.** Clean, but throws away work the record says is done and measured.

## The design

### Survey first

One document, `docs/superpowers/audits/<date>-builders-look-survey.md`, with:
- the builders' base frames beside the framework's on `main`, for the four base scenes in the diorama and first
  person and for the gameplay camera, each difference named (the method of `docs/refactor/eb-look/gap.md`, redone on
  today's `main`);
- for the black `world-level-room` and the near-black `look-pixel-art`: the cause;
- for each work package WP0 to WP10 and each figure piece (sprite light, rim, exposure, depth per texel, faces,
  wardrobe): on `main` and working, on `main` and broken, in a draft pull request, or not started;
- for each draft pull request: what it holds, whether it merges cleanly with `main`, whether its checks pass, and the
  ruling: merge, finish, or close as superseded, with the reason.

### Finish, in the order the prologue needs

1. **The lit room is healthy.** Whatever the survey finds behind the black room is fixed, with the browser test that
   would have caught it.
2. **Light.** The base term (ambient, key, fill faded by height, the sun with its shadow), stepped, as in
   EnvironmentBuilder's `docs/lighting.md`; meshes cut fine enough for a lamp's pool to show.
3. **Figures lit as sprites** (`c8-lit`): a flat light at the chest, a one-step form and a rim, exposed toward their
   ring, writing depth per texel so walls and figures hide each other.
4. **Glow and windows; the remaining passes** (#589, #590), each behind its switch.
5. **What the reference game's figures need from the wardrobe** (`c9-wardrobe`): a ward nurse's uniform, street
   clothes, the Night Nurse, as character-kit library entries, not per-character code.

Each step ends with the side-by-side sheet for the base scenes it changed, the measure, and the images explained.

### Retiring the builders

When the survey's table has no row left "not in the framework", the builders are done as sources. What the framework
still takes from them by reference (the FigureBuilder submodule) is then either folded in or kept; see the calls.

## Left to the builder

- The measure for "as the builders do" per part (EnvironmentBuilder's GPU harness measures albedo by palette index;
  light and figures need their own).
- The order inside each step, and how the draft pull requests' commits are brought in (merge, cherry-pick or rewrite).

## Done means

- Every row of the survey's table reads "on `main` and working", with its test, or "not wanted", with the Owner's word.
- The side-by-side sheets for the four base scenes and the base pair are committed, and each remaining difference is
  named and accepted or fixed.
- The taken-over pull requests are all merged or closed, each with its reason on the pull request.
- `pnpm check` and the 3D browser suites pass in Chromium; what did not run is listed.

## The coordinator's calls, for the Owner to check

1. This workstream takes over #588, #589, #590, #603 and #607 in the framework, and reads FigureBuilder's #29; the
   coordinators who opened them are told.
2. It runs ahead of the prologue's dressing tasks; the prologue's framework tasks (interact, HUD and the rest) do not
   wait for it.
3. **FigureBuilder as a submodule.** The framework's character kit imports FigureBuilder's code through a private git
   submodule. If the builders are to be replaced, that code should end up inside the framework (in the character kit),
   so the framework builds from its own repository and can go public. Default: fold it in as the last step of this
   workstream. The alternative is to keep the submodule and make FigureBuilder public. This is the Owner's to decide
   before that step.
4. EnvironmentBuilder's CPU painter is not ported (the 2026-11-07 trim cut the reference painters); its frames are the
   comparison, drawn by EnvironmentBuilder itself.
