# Levels 3D opens real 3D rooms: plan audit

- **What this is:** the plan audit of [the spec](2026-11-08-levels-3d-sector-2-spec.md) and
  [the plan](2026-11-08-levels-3d-sector-2-plan.md) (tasks 15.5, 16.1b to 16.1e), with the superpowers plugin
  (`writing-plans`' review checklist), natively, no subagents, on 2026-11-08.
- **Checked against:** this branch (`claude/project-thread-n9tc3p`, head `0ecd1c98`, on #476's `399d0558`), the code
  each task names, and the real thing end to end (below).
- **Result:** 17 findings: 6 high, 6 medium, 5 low. All are fixed in place in the spec and the plan; nothing is left for
  the Owner. The plan keeps its five tasks and the 3D plan its 59.

## The real thing, end to end

Copied `games/base-3d` to a scratch folder, built `@automata/tools` and the 3D suite (`pnpm turbo run build`), ran
`automata editor <copy>` and opened it in Chromium at 1194 × 834 and 390 × 844 (Playwright).

- **Home** shows Tuning, Room and Wick. **The rail** shows Tuner, Levels, Levels 3D and Studio, though Ember Hall's
  editor list names only `levels-3d`, `studio` and `tuner`: the 2D editor's "Levels" opens nothing.
- **Room** opens to a dark stage with "room.af-sector.json can’t be opened as a af-sector level." and "af-sector/2 is not
  a version this editor reads (af-sector/1)". Measured colours: the heading `rgb(17, 21, 28)` and the text
  `rgb(67, 77, 85)` on the stage's `rgb(22, 25, 30)`: about 1.1:1 and 2:1. A person cannot read it, and if they could,
  it names a file, a format and a version.
- The status line shows the path `content/levels/room.af-sector.json` (18.1's copy pass, not this plan).
- editor-3d's unit suite at this head: 2127 tests in 149 files, all passing (the plan's count is right).

So the brief's failure is real, and every word of the spec's section 1 matches what a person sees. What follows is what
the plan, as written, would still have left broken when a person tries to edit the room, play it and see the edits.

## Findings

### High

**A1. Ember Hall's things would not open.** Its `entityDefs` are `{ "id": "ember" }`, `{ "id": "goal" }`,
`{ "id": "spawn" }`. The editor reads a definition with `thingDefSchema`, which requires `shape` and `fields`
(`shared/things/thing-def.schema.ts`; the depot fixture writes both). So after 16.1c every definition is refused, every
one of the seven entities is "of definition …, which is not defined", the Plan draws none of them and the checks open
with ten problems in words no person reads. `create-game --template 3d` writes `entityDefs: [{ id: 'spawn' }]` too.
**Fix (16.1c):** the `/2` profile reads a definition without `shape` as a point and without `fields` as having none,
for reading only; nothing is written for them, and a definition edit writes only the member it changes. Tests:
`Ember Hall opens with its seven things and no problems`, `a bare definition is drawn as a point and written back
untouched`.

**A2. The journey could not play the edited room.** `runGame` is `runGame(gameDir, contentRoot, port)` and returns
`{ url, stop }` (no page, no `testing` option); base-3d imports its room from source
(`src/features/room/room.ts`: `import file from '../../../content/levels/room.af-sector.json'`) and its content
plugin's root is fixed, so a game served from the checkout plays the committed room, never the copy the editor wrote.
The flag `showRoom` waits for is `VITE_AF_JOURNEYS`, a build flag the dev server only sees from its environment.
**Fix (16.1e):** base-3d's `vite.config.ts` reads the content, the room's JSON included, from `AF_E2E_CONTENT_ROOT`
when it is set (as Emberwick's does), with a unit test of the resolution; `runGame` takes an optional `env` (the
journey passes `VITE_AF_JOURNEYS=1`); the journey is rewritten on the real harness (`runGame(BASE_3D, game.dir, port)`,
a new page on its `url`). The game fixture gets a `source` option so a test file can copy base-3d.

**A3. The upgrade's base text was not said.** The session patches from `base = { text, model }` and `patchJson`
refuses unless `model` equals `JSON.parse(text)`. If `ReadOutcome.text` stays the `/1` text and `value` is the `/2`
model, the first step is refused; if the file is written on open, a person who only looks has changed their file.
**Fix (16.1c):** `ReadOutcome.parsed.text` is the upgraded text and `original` the file's own; the Levels 3D session
and the standalone document path (still compiled: `document-controller.ts`, `patched-document.ts`) both start from the
upgraded text and write nothing until a step. Undo then needs no new code: the suite's write path records the bytes it
replaced (the `/1` text) and puts them back, and the session's base becomes the upgraded text again, so the next step
writes the upgrade with it. The test says so.

**A4. Props, characters and lamps are not entities.** The plan said a prop is written back with `mergeMembers` and
read like an entity. But `mergeMembers` writes `x` and `z` members, and a place is `at: [x, z]` or `[x, z, height]`;
and the entity reader drops a thing with a member that is not a field value, which BASE_SCENES' pendant lamp
(`with: { height, ceiling }`) has. A generator place (`kind` with no `use`) had no definition at all. **Fix (16.1d):**
`af-placed.ts` reads and writes its own lists, not through `readEntityKit` or `mergeMembers`: `x`, `z` and `y` come from
`at` (a two-value `at` stays two values unless a height is set), `angle` is the one value a person changes (the turn),
every other member (`with`, `kind`, `layer`, `pose`, `to`, a lamp's light) rides as written. Definitions are
`prop:<use>`, `kind:<kind>` (a generator place, named by its kind), `cast:<who>`, `lamp:<kind>`. `takenIds` spans
`entities`, `props`, `cast` and `lamps`. Member orders for the three lists join the codec (16.1c). Test:
`the pendant lamp's parameters stay as written when it is moved`.

**A5. The missing-name check would have been a second rule.** Core already says when a prop's preset or kind or a
swatch is missing (`resolveProp`'s faults in `place-props.ts`, `hasSwatch` in `build.ts`), and accepts a seeded swatch
name (`rust#2`), which a plain lookup in the game's folder flags as missing. **Fix (16.1d):** the check uses core's
rules (`resolveProp`, `isFault`, `hasSwatch`); none of them is exported today (only `buildWorld`, from `@automata/3d`'s
root entry, which carries Pixi), so 16.1b exports them from `@automata/3d/world-content` (Pixi-free, beside the content
kinds). The cast's
`who` against the game's figures is the editor's own (core does not check it). Test: `a seeded swatch name is not
missing`.

**A6. The label rule was only the rail's.** Home's cards take `installed.label` (`home-model.ts`), so on Ember Hall the
rail would say "Levels" and the card "Levels 3D". **Fix (15.5):** one `editorLabel(id, listed)` beside `suiteEntries`;
the rail, Home's cards and the folded Editors menu all use it. Test: Home's card on a 3D game says "Levels".

### Medium

**A7. Where the library comes from was left open.** `SuiteWorkspace.files()` lists only what a row of the editor list
matches (its doc comment), and base-3d's list has no row for `world-props` or `world-swatches`; every `ProjectStore`
already has `list(prefix)`, and the editor server answers `/api/list?prefix=`. **Fix (16.1d):** decided now:
`SuiteWorkspace.list?(folder)` over the store's `list`, each adapter tested; the records are TOML, parsed with
`smol-toml` (editor-3d already depends on it) and checked with `worldPropContent` and `worldSwatchContent`'s schemas.
Step 1 is no longer a check.

**A8. The swatch check's words and the material picker.** The spec's check said "swatch" and "Pick another in the
room's Floor"; the inspector says "Floor" for the height and "Change materials" for the picker, and a person does not
know "swatch". The picker's `Material` needs a `category`, which a swatch does not have. And Ember Hall has no
`materials` table, so today the picker refuses outright. **Fix (spec 5, 16.1d):** "The room uses a material called
"rust", but the game has none. Choose another with Change materials."; the game's swatches are one category,
"Materials", each named by `fileTitle` with its DUEL colour.

**A9. The journey named a field that is not there.** The room card's stepper is "Floor" (metres), not "Floor height";
`openLevel` and `game` were not harness helpers; `openRoom` waits for the 2D canvas. **Fix (16.1e):** `openLevels3d(page,
editor, 'Room')` in the fixtures waits for `[data-testid=plan-canvas]`; the journey sets "Floor".

**A10. Fixtures that are not in this repository.** "The five converted builder maps" come from the world-kit's
converter, which is not here. **Fix (spec 9, 16.1b, 16.1c):** the `/2` fixtures are Ember Hall, BASE_SCENES' two
levels, the `create-game --template 3d` room, the upgraded depot, toy and sample hall, and the three new small ones
(`SLOPED`, `PLACED`, `GRID`).

**A11. A wall's view would carry a surface where an edit expects heights.** `/2`'s wall `trim` may be a surface
(`'trimWhite'`), and `EditWall.trim` is `PartialTrim`; an edit or the Plan that reads it as heights breaks. **Fix
(spec 5, 16.1c):** a view has `trim` only when it is heights; a surface trim rides under the written values with the
wall's `surface`. Test: `a wall whose trim is a surface keeps it through a split`.

**A12. The try-it sample has nothing to place.** The site's 3D sample (`app/suite/sample-3d/`) has no furniture, no
swatches and no things, so after 16.1d its Furniture group is empty and Change materials refuses; it is the first 3D
room most people see. The plan's Furniture layout case also needs a workspace with a library. **Fix (16.1d):** the
sample gains base-3d's two props and six swatches (copies), and its hall names them; `suite-draw`'s Furniture case runs
on it.

### Low

**A13.** `levelSchemas(plane: z.ZodType<WrittenPlane | Plane>)` loses which plane each schema gives; it is generic
(`levelSchemas<P>(plane: z.ZodType<P>)`) over interfaces with a plane parameter that defaults to `Plane`, so
`AfSector2` is unchanged (16.1b).

**A14.** `EditSector` has no `pit` and says `view` is `/1` only; 16.1c adds `pit` and drops the note, so 16.1e's edits
are typed.

**A15.** `games/base-3d/tests/unit/testing/route.test.ts` does not exist: it is created (16.1e). There is no "Studio's
own top bar name" to change; the label is `studio-suite-editor.ts`'s and `home-model.ts`'s (15.5).

**A16.** The rail filter applies to every editor, so the editors on other branches (Feel, Writer, Schematic, Sequence,
Audio) show only in a game that lists them; said in 15.5 so their journeys list them.

**A17.** The member orders for `props`, `cast` and `lamps` (so a new `angle` lands after `at`, before `with`) were not
in the codec (16.1c).

## What was right

The format analysis holds: `patchJson` compares key order aside, so the file schema's reordering is harmless, and its
refusal of a model that is not the text's parse is exactly why `afSector2FileSchema` is needed. A slope runs from the
room's first corner (`heightAt` in `world/sectors.ts`), as the spec says. Object spread copies a symbol-keyed member,
so written values riding under a symbol survive every edit that spreads a room or a wall. The suite's one-write,
one-Undo rule and the refusal card's words were checked against the session and the page. The 3D plan's amendments
(16.2, 16.3, 17.1, 18.2, 7.1's log) and progress's 59 are consistent.

## Not run

No code changed, so no gate ran beyond the measurements above. WebKit and Firefox: not runnable here.
