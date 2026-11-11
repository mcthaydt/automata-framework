# The Last Light on the framework, slice 1: the prologue. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:executing-plans to implement this plan task by task, in
> one session per repository, with **no subagents** (the Owner's rule). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Last Light's prologue plays from its first cutscene to its end on the framework, opens and saves in six
of the suite's editors, and runs under the framework's shell in six languages, with the old game untouched beside it.

**Architecture:** The framework gains what the prologue needs and any adventure game would (using a hotspot, a play
HUD drawn from a data file, peeking, line delivery, a 3D cutscene stage, footsteps by floor, nine props, Sequence over
a 3D level, a way to pack itself for an outside game), each tested there with invented content. The game's repository
gains a new package beside the old code, a converter that runs once, the converted content, five small sim features
of its own, and three proofs: it plays, it edits, the shell holds.

**Tech stack:** TypeScript 7, Koota behind `@automata/sim`, PixiJS 8 with `@pixi/3d` (vendored beta), Svelte 5 for
HUD pieces, Zod 4, smol-toml, Vitest and Playwright (Chromium), pnpm.

**Spec:** [`../specs/2026-11-11-last-light-on-the-framework-design.md`](../specs/2026-11-11-last-light-on-the-framework-design.md).
**Survey (read it first; this plan argues from it):**
[`../audits/2026-11-11-last-light-prologue-survey.md`](../audits/2026-11-11-last-light-prologue-survey.md).
Row numbers below ("survey 16") are the survey's.

## Repositories, branches and the order they merge

| Part | Repository | Branch | Tasks |
|---|---|---|---|
| A. The framework's additions | `mcthaydt/automata-framework` | `claude/last-light-prologue-build`, from `main`, one draft pull request | 1 to 10 |
| B. The game on the framework | `mcthaydt/PixiJS3D_Experiment_001` | `claude/prologue-on-framework`, from `main`, one draft pull request | 11 to 20 |

Order:

1. Workstream 1's build (`claude/shared-polish-build`) merges to the framework's `main`. Tasks 1 to 9 do not need it
   and may start before; tasks 10, 19 and 20 do.
2. Part A's branch merges `main` in, passes task 10, and merges to `main`. That merge commit is **the pin**.
3. Part B starts at task 11 from the pin. If a game task finds a fault in the framework, it stops, the fault is fixed
   on a new framework branch with its test first, merged, and the pin moves (task 11's command is run again). The game
   never carries a private fix.
4. Part B's pull request is the Owner's to merge (the game's `AGENTS.md`: the lead verifies and merges).

Part A and Part B are separate sessions. Part B's session needs the game's repository with push access and the
framework's read only.

## Tracking

Progress: **0 of 20 tasks (0%)**. Tick a task only when its checks pass; write what ran beside it.

| # | Task | Repo | State | Evidence |
|---|---|---|---|---|
| 1 | `@automata/interact`: use a hotspot | framework | todo | |
| 2 | `@automata/hud`: the `hud` file, the objective line and the prompt | framework | todo | |
| 3 | `@automata/hud`: inventory, examine box, keypad | framework | todo | |
| 4 | `@automata/systems`: peeking, hide from a system, a re-route on a clock | framework | todo | |
| 5 | `@automata/narrative`: delivery on a line, typed out; Writer's field | framework | todo | |
| 6 | `@automata/cutscenes`: a camera key at an anchor, a 3D stage | framework | todo | |
| 7 | `@automata/audio-synth`: footsteps by floor | framework | todo | |
| 8 | Sequence: the preview over a 3D level | framework | todo | |
| 9 | `@automata/world-kit`: nine prop generators | framework | todo | |
| 10 | Pack for an outside game; `examples/3d-story` uses interact and the HUD; gates | framework | todo | |
| 11 | The game package, the pin, a blank room that boots | game | todo | |
| 12 | The converter | game | todo | |
| 13 | Convert once; the content checks; the puzzle can be finished | game | todo | |
| 14 | The game's own sim features; the bot finishes the scene in Node, twice, same hash | game | todo | |
| 15 | Dress it: props, lamps, Ada and the figure, poses | game | todo | |
| 16 | Draw it: renderer, cutscenes, HUD, sound, feel | game | todo | |
| 17 | Prove it plays (Chromium) | game | todo | |
| 18 | Prove it edits (six editors) | game | todo | |
| 19 | Prove the shell: languages, first run, gamepad, touch at phone size | game | todo | |
| 20 | The old game still builds and plays; records; final report | game | todo | |

## Global constraints

From the spec, the tracker and both repositories' `AGENTS.md`. Every task includes them.

- **No subagents.** No pull request is opened by the executing session unless the coordinator says so.
- **Nothing of the game in the framework's repository:** no line, name, room, prop list or picture of The Last Light
  in framework code, tests, fixtures or examples. Framework tests use invented content (a "pantry", a "lantern", a
  "watchman"). The framework's `pnpm source-names` check must pass.
- **Nothing copied wholesale** from the old game or from the superseded clinic branches (#575, #596, #606, #588). They
  are read to learn behaviour; code is written new.
- **A line changes only on the Owner's word.** The converter copies every line's words byte for byte, and task 13 has a
  test that proves it.
- **The old game stays untouched:** nothing under the game's `src/`, `editor/`, `scripts/`, `tests/`, `tools/`,
  `docs/art/` changes. The one exception is named in call 3.
- **No paid pipeline stage.** No call to any paid API. `automata words` is run by the Owner (call 7).
- **The framework's laws:** only the sim changes gameplay state; no I/O, wall clock or `Math.random` in sim files; the
  same seed, content and inputs give the same hash; Zod only; PixiJS only; the no-eval entry first.
- **Tests first,** in `tests/` beside `src/`, importing `#src/…`; one suffix, `.test.ts`; injected clocks and fixed
  seeds; browser tests wait on readiness, never on a sleep.
- **Feature folders:** `src/app`, `src/features/<x>`, `src/shared`, `src/entries`, `src/testing`; a feature imports
  only itself and `shared/`; a source file has at most 600 lines; kebab-case names with role suffixes.
- **Phone first:** every HUD piece is designed and tested at 390 by 844 and 844 by 390; touch targets at least 44 px,
  primary actions 48 px; copy passes the grandma test.
- **Each HUD screen keeps its layout and words as data** (the Owner): a piece reads its place, size and word keys from
  `content/hud/*.toml`, never from code.
- **Gates in the framework:** `pnpm format` before each commit, Conventional Commits, `pnpm check` green before a task
  is ticked. New extensions are private (`"private": true`), so they get no changeset; a changed published package
  gets a `patch` changeset. A changed export of a published package means `pnpm build`, `pnpm api-report --update` and
  `pnpm api-index --write`, committed.
- **Gates in the game:** in the new package, `pnpm typecheck`, `pnpm test`, `pnpm exec automata check`. The old game's
  own gates are run at task 11 (the baseline) and task 20 (compared with it); see call 4.
- **Report what ran.** Chromium only here; WebKit, Firefox and real devices are the Owner's and are said to be so.

## The calls this plan makes

1. **The game package** is the folder `last-light/` at the root of the game's repository, package name
   `the-last-light`, private, with its own `package.json`, `pnpm-lock.yaml` and `pnpm-workspace.yaml`. It never imports
   from `../src`.
2. **The pin** is a folder of tarballs, `last-light/vendor/automata/`, written by the framework's new
   `pnpm pack:game` (task 10) at one commit, with a `pin.json` naming the commit. The game installs them by `file:`
   paths. Tarballs are committed: the game must build with no network beyond the npm registry.
3. **One line changes in the old game's configuration:** `vite.config.ts` gains `last-light/**` in `test.exclude`
   (or the equivalent in whichever file holds the old Vitest settings), because the old `npx vitest run` would
   otherwise collect the new package's tests and fail to resolve them. Nothing else outside `last-light/` and
   `docs/superpowers/` changes.
4. **The old game's gates are compared, not required green.** The game's `STATUS.md` records six failing tests and
   stale audits on `main`. Task 11 records `npx tsc --noEmit`, `npx vitest run` and `npm run build` as they are; task
   20 runs them again and the result must be the same list. `guard_check`, the pixel baseline and the old playthroughs
   need the old pipelines and a GPU; they are run if the container can, and reported as not run if it cannot.
5. **The converter** is `last-light/tools/convert/`, a Node script the game keeps as a record. It reads the old scene
   by importing its TypeScript modules (they are data and pure functions) and `docs/art/blockout-prologue/blockout.json`.
   It runs once, in task 13. After that the content files are the source and a test fails if anyone re-runs it over
   edited content without `--force`.
6. **Three cutscenes put Ada on a mark** (`opening`, `lightsOut`, `rest`); `found` follows where she was caught
   (task 6's camera key at an anchor). Survey, open question 3.
7. **The story's translations** are written by `automata words` on the Owner's machine. The executing session proves
   the pipeline with one invented test line in a scratch catalog, commits English only, and leaves
   `content/messages/{ja,ko,es-419,pt-BR,zh-Hans}.json` to that one run. Until it happens, slice 1's "its story lines
   are in the six languages" is **open**, and task 19 says so. Survey, open question 2.
8. **Props are placed again, not converted.** Each of the old scene's furniture models becomes a world-kit or core
   generator at the same place and footprint. The old models, textures and sprites never enter the new package.
9. **`@automata/interact` and `@automata/hud` are extensions, not core:** Emberwick needs neither.
10. **Checkpoints stay in the game** for this slice (survey 24): one sim snapshot kept in the game's feature, restored
    on a practice catch. It moves to an extension when a second scene needs it.
11. **The framework's old fixtures of the game's content are not touched** (survey, "Game content already in the
    framework"). No task reads them as a source.

## Review focus

The five things the spec implies, no "Done means" line states, and a player or an editor would hit first. Each has
its test in the task named.

1. **A hotspot that cannot be reached** (a locked door between): the walk stops, a line says so, and the pending use is
   dropped; it must not fire later when the door opens. Task 1.
2. **The lamp runs dry in the supply room,** and the paraffin is in the ward: the scene must still be finishable (the
   drawer always has one more bottle). The bot's second route, task 14.
3. **A catch during a cutscene or with the inventory open:** the practice catch must not fire while a cutscene holds
   input, and an open HUD piece closes. Tasks 3 and 14.
4. **A translated line longer than the box at phone size** (Japanese has no spaces; Portuguese runs long): the examine
   box and the objective line wrap inside their declared region and never push a control under 44 px. Tasks 2 and 3.
5. **An edit that breaks the scene:** a hotspot deleted in Levels 3D that the puzzle still names must fail
   `automata check` with a sentence naming both, not at play. Task 13.

## File structure

**Framework (Part A).** New packages follow `extensions/nav`'s shape (`package.json` with `"private": true`,
`"imports": { "#src/*": "./src/*" }`, `automata.simEntries`, `tsconfig.json`, `vitest.config.ts`, `README.md`).

```
extensions/interact/            @automata/interact (new)
  src/app/interact.extension.ts
  src/shared/sim/{interact.command,interact.event,interact.resource,interact.system,interact.plugin}.ts
  src/shared/sim/{hotspot.schema,hotspots-of}.ts
  src/shared/use-commands.ts    the two commands a tap sends
  src/entries/{index,sim}.ts    src/testing/pantry.ts
  tests/unit/shared/…
extensions/hud/                 @automata/hud (new)
  src/shared/{hud.schema,hud.content,objective,hud-model}.ts
  src/features/layout/{HudRoot.svelte,place.ts}
  src/features/{objective,prompt,inventory,examine,keypad}/<Piece>.svelte (+ a .ts model each)
  src/app/hud.extension.ts      src/entries/{index,content}.ts
  tests/{unit,browser}/…
extensions/systems/src/shared/sim/peek.ts (new), pursuit.ts, systems.plugin.ts, systems.schema.ts (modified)
extensions/narrative/src/shared/sim/lines.schema.ts (modified), src/shared/delivery.ts (new),
  src/features/box/{DialogueBox.svelte,dialogue-box.ts,typing.ts} (modified, new)
extensions/editors/src/features/writer/… (delivery field), …/sequence/plan-view.ts (3D walls)
extensions/cutscenes/src/shared/sim/{cutscene.schema,anchors}.ts (modified),
  src/features/stage-3d/cutscene-stage-3d.ts (new), src/entries/stage-3d.ts (new)
extensions/audio-synth/src/features/synth/… (a `steps` table), src/features/steps/step-sounds.ts (new)
extensions/world-kit/src/features/props/ward.ts (new), register-props.ts (modified)
extensions/puzzle/src/shared/sim/puzzle.system.ts (export `applyVerb`), src/entries/sim.ts
tooling/release/src/pack-game.ts (new), package.json script `pack:game`
examples/3d-story/…             uses interact and the HUD with its own invented hall
```

**Game (Part B),** all under `last-light/`:

```
package.json  pnpm-workspace.yaml  tsconfig.json  vite.config.ts  ship.config.ts  index.html  fonts.toml
vendor/automata/*.tgz  vendor/automata/pin.json
tools/convert/{convert.ts,read-scene.ts,level.ts,nav.ts,puzzle.ts,systems.ts,lines.ts,cutscenes.ts,story.ts,report.ts}
content/levels/prologue.af-sector.json      content/nav/prologue.toml
content/puzzles/prologue.toml               content/systems/prologue.toml
content/lines/prologue.toml                 content/dialogue/prologue.toml
content/storylets/prologue.toml  content/beats/prologue.toml  content/help/prologue.toml  content/canon/canon.toml
content/cutscenes/prologue.toml             content/hud/play.toml
content/audio/audio.toml  content/feel/feel.toml  content/tuning.toml  content/credits.toml
content/figures/{ada,figure}.toml  content/figure-*/…   content/world-props/…  content/world-swatches/…
content/states/prologue.toml                which fact shows which lamp level, door and prop state
content/editors.toml  content/messages/     (the five translated catalogs, written by `automata words`)
docs/convert-report.md                      what the converter could not express
src/main.ts  src/app/{game.ts,scene.plugin.ts,content.ts,controls.ts,flow.ts}
src/features/ada/      walker: component, move command, walk system, view
src/features/lamp/     lamp.component.ts, lamp.command.ts, lamp.system.ts, lamp-view.ts
src/features/night/    vigil.system.ts, night.hooks.ts (wake, vigil, leave, resetFor), steps.system.ts
src/features/catch/    checkpoint.resource.ts, catch.system.ts
src/features/room/     room-view.ts, states.ts (content/states → piece states)
src/features/figure/   figure-view.ts
src/shared/{constants.ts,puzzle-facts.ts,puzzle-calls.ts}
src/testing/{bot.ts,route.ts,solver-model.ts}
tests/unit/…  tests/e2e/…
```

---

# Part A: the framework

Work in `mcthaydt/automata-framework` on `claude/last-light-prologue-build`. Before task 1: `pnpm install`, then
`pnpm check` once to learn the baseline; write its result in the tracker's Part A row.

### Task 1: `@automata/interact`: use a hotspot

Survey 16, 21, 35. A game says "use this"; the sim walks there and acts on arrival.

**Files:**
- Create: `extensions/interact/` as in "File structure"; add it to `pnpm-workspace.yaml` only if extensions are listed
  one by one there (they are globbed today).
- Modify: `extensions/puzzle/src/shared/sim/puzzle.system.ts`, `extensions/puzzle/src/entries/sim.ts` (export
  `applyVerb`); `knip.jsonc` and the root `boundaries` and `style` scripts only if they list extensions by name.
- Test: `extensions/interact/tests/unit/shared/{interact,hotspots-of,use-commands}.test.ts`,
  `extensions/puzzle/tests/unit/shared/apply-verb.test.ts`

**Interfaces:**
- Consumes: `WalkTo`, `NavArrived`, `NavUnreachable` (`@automata/nav/sim`); `VerbCommand`'s `VerbPayload`, `holds`,
  `Reader`, `Cond` (`@automata/puzzle/sim`); `AfSector2`, `AfEntity` (`@automata/3d/level`); `defineExtension`
  (`@automata/framework/extension`).
- Produces:

```ts
// @automata/puzzle/sim (new export): what the puzzle system already does for one `puzzle.verb`, callable by a system.
export function applyVerb(ctx: SimContext, verb: VerbPayload): void

// @automata/interact/sim
export interface Hotspot { readonly id: string; readonly x: number; readonly z: number; readonly reach: number
  readonly name: string            // a message key
  readonly hide?: boolean | undefined
  readonly when?: readonly Cond[] | undefined }     // usable only while every condition holds
export const hotspotSchema: z.ZodType<Hotspot>
/** The level's entities of definition `def` as hotspots; a problem for each one that is not a valid hotspot. */
export function hotspotsOf(level: AfSector2, def?: string /* 'hotspot' */):
  { readonly hotspots: readonly Hotspot[]; readonly problems: readonly string[] }
export const Use: CommandDef       // 'interact.use'     { at: string, held?: string }
export const Combine: CommandDef   // 'interact.combine' { a: string, b: string }
export const EnterCode: CommandDef // 'interact.code'    { code: string }
export const Cancel: CommandDef    // 'interact.cancel'  {}
export const InteractPending: EventDef  // 'interact.pending' { at }
export const InteractRefused: EventDef  // 'interact.refused' { at, reason: 'unknown' | 'unavailable' | 'unreachable' }
export const InteractUsed: EventDef     // 'interact.used'    { at, held?: string, hid: boolean }
export interface InteractOptions {
  /** The player's entity and where it stands, each tick. */
  readonly player: (ctx: SimContext) => { readonly entity: number; readonly x: number; readonly z: number } | undefined
  /** The reader the hotspots' `when` is asked of: the same facts the puzzle reads. */
  readonly reader: (ctx: SimContext) => Reader
  /** Called for a hiding place in place of a verb; the game passes `systems.hide` (task 4). */
  readonly hide?: (ctx: SimContext, spot: string) => void
}
export interface Interact { readonly plugin: PluginDef
  readonly load: (ctx: SimContext, hotspots: readonly Hotspot[]) => void
  /** Hotspots within reach of the player now, nearest first: what the prompt shows. */
  readonly inReach: (ctx: SimContext) => readonly Hotspot[] }
export function createInteract(options: InteractOptions): Interact
// @automata/interact
export function interactExtension(options: InteractOptions): Interact & { readonly extension: ExtensionDef<'interact'> }
/** What a tap on a hotspot sends in one tick: the walk and the use. */
export function useCommands(entity: number, hotspot: Hotspot, held?: string):
  readonly [walk: { entity: number; to: { x: number; z: number } }, use: { at: string; held?: string }]
```

Behaviour: `Use` on an unknown id or one whose `when` fails emits `InteractRefused` and keeps nothing. Otherwise the
use is pending (one at a time; a new `Use`, a `Cancel`, a `NavUnreachable` for the player or the hotspot's `when`
turning false drops it). Each tick, a pending use whose player is within `reach` fires: `options.hide(ctx, id)` when
the hotspot hides and nothing is held, else `applyVerb(ctx, { at, held })`; then `InteractUsed`. `Combine` and
`EnterCode` call `applyVerb` at once with `{ at: 'combine', pair }` and `{ at: 'code', code }`. The extension
`requires: [places provider, 'nav', 'puzzle']`.

- [ ] **Step 1: Write the failing tests** on an invented scene in `src/testing/pantry.ts` (two rooms, a door, a
  `jar` hotspot with reach 1.2, a `cupboard` that hides, a `shelf` with `when = [{ fact: 'doorOpen', is: true }]`):

```ts
it('walks, then acts on arrival', () => {            // Use{at:'jar'} + WalkTo; step until NavArrived
  expect(events(InteractUsed)).toEqual([{ at: 'jar', hid: false }]); expect(saidLines()).toEqual(['jar']) })
it('acts at once when already in reach', …)          // one tick, no walk
it('uses a held item', …)                            // applyVerb got { at: 'jar', held: 'spoon' }
it('refuses a hotspot whose condition fails', () => expect(events(InteractRefused)).toEqual([{ at: 'shelf', reason: 'unavailable' }]))
it('drops a pending use it cannot reach, and never fires it later', …)  // Review focus 1: open the door after; step 200 ticks; no InteractUsed
it('a second Use replaces the first', …)
it('hides at a hiding place, and sends no verb', …)
it('gives the same hash for the same commands', …)   // two runs, stateHash equal
it('hotspotsOf reports an entity with no reach', …)
it('useCommands walks to the hotspot and uses it', …)
```

- [ ] **Step 2: Run them and see them fail.** `pnpm --filter @automata/interact test:unit` → fails: no such module.
- [ ] **Step 3: Export `applyVerb` from puzzle** (its test first: a verb applied by a system gives the same
  `puzzle.said` as the same verb as a command), then **implement interact** to the interfaces above.
- [ ] **Step 4: Run.** `pnpm --filter @automata/interact test:unit && pnpm --filter @automata/puzzle test:unit` → pass.
  `pnpm boundaries && pnpm style` → pass.
- [ ] **Step 5: README** (what it is in one paragraph, "Turn it on", "What you get", in the other extensions' voice),
  `pnpm format`, commit: `feat(interact): use a hotspot: walk into reach, then act`

### Task 2: `@automata/hud`: the `hud` file, the objective line and the prompt

Survey 25, 30. The file is the hand-over to the coming UI editor: it holds where each piece sits, how big it may be
and which words it shows.

**Files:**
- Create: `extensions/hud/` (`hud.schema.ts`, `hud.content.ts`, `objective.ts`, `hud-model.ts`,
  `features/layout/{HudRoot.svelte,place.ts}`, `features/objective/Objective.svelte`, `features/prompt/Prompt.svelte`,
  `app/hud.extension.ts`, `entries/{index,content}.ts`, `README.md`)
- Test: `extensions/hud/tests/unit/shared/{hud-schema,objective,place}.test.ts`,
  `tests/unit/features/{objective,prompt}.test.ts` (DOM), `tests/browser/layout/hud-phone.test.ts`

**Interfaces:**
- Consumes: `Cond`, `holds`, `Reader` (`@automata/puzzle/sim`); `UiComponent` (`@automata/framework/extension`);
  `defineContentSchema` (`@automata/content`).
- Produces:

```ts
export type HudAnchor = 'top-left' | 'top' | 'top-right' | 'left' | 'centre' | 'right' | 'bottom-left' | 'bottom' | 'bottom-right'
export type HudPieceKind = 'objective' | 'prompt' | 'inventory' | 'examine' | 'keypad'
export interface HudPiece { readonly kind: HudPieceKind; readonly anchor: HudAnchor
  readonly width?: number | undefined      // the most it may take, CSS px; the screen's safe width caps it
  readonly words?: Readonly<Record<string, string>> | undefined }   // slot name → message key
export interface ObjectiveRow { readonly when: readonly Cond[]; readonly line: string; readonly target?: string | undefined }
export interface HudFile { readonly pieces: readonly HudPiece[]; readonly objective?: readonly ObjectiveRow[] | undefined }
export const hudSchema: z.ZodType<HudFile>           // a kind may appear once; refused otherwise, in words
export const hudContent: ContentSchemaDef<'hud'>     // folder 'hud', not sim content
/** The first row whose conditions all hold. */
export function chooseObjective(rows: readonly ObjectiveRow[], reader: Reader): ObjectiveRow | undefined
export interface HudModel { readonly objective: string | undefined            // a message key
  readonly prompt: { readonly at: string; readonly name: string } | undefined // name: a message key
  readonly items: readonly { readonly id: string; readonly name: string; readonly text: string }[]
  readonly held: string | undefined
  readonly examine: { readonly title: string | undefined; readonly line: string } | undefined
  readonly keypad: { readonly open: boolean; readonly digits: number }
  readonly locked: boolean }                           // a cutscene holds input: every piece but examine is hidden
export interface HudActions { use(at: string): void; hold(item: string | undefined): void; examineItem(item: string): void
  combine(a: string, b: string): void; code(code: string): void; dismiss(): void }
export interface HudOptions { readonly file: HudFile; readonly words: (key: string) => string | undefined
  readonly model: () => HudModel; readonly actions: HudActions }
/** The whole play HUD as one `hud.overlay` component. */
export function hudSlot(options: HudOptions): UiComponent
```

`place.ts` turns an anchor into the framework's safe-area CSS (it reads core's layout variables; it invents no
breakpoints). The Prompt is a 48 px button showing the nearest hotspot's name; pressing it calls `actions.use`.

- [ ] **Step 1: Failing tests:** the schema refuses two `objective` pieces and an unknown anchor, each in a sentence;
  `chooseObjective` takes the first matching row and returns `undefined` when none match; `Objective` shows the words
  for `model().objective`, shows nothing when it is `undefined` or `locked`, and updates when the model changes;
  `Prompt` is absent with no hotspot in reach and calls `use('jar')` on press, on Enter and on a pad's confirm; the
  browser test mounts both at 390×844 and 844×390 with a 140-character line (Review focus 4) and asserts the line wraps
  inside its piece, the prompt is at least 48 px high, and nothing overlaps the safe area.
- [ ] **Step 2: Run, see them fail.** `pnpm --filter @automata/hud test:unit`
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** unit and `pnpm --filter @automata/hud test:browser` (Chromium) → pass.
- [ ] **Step 5: Commit:** `feat(hud): a play HUD drawn from a file: the objective line and the prompt`

### Task 3: `@automata/hud`: inventory, examine box, keypad

Survey 18, 30. Review focus 3 and 4.

**Files:**
- Create: `extensions/hud/src/features/inventory/{Inventory.svelte,inventory.ts}`,
  `features/examine/Examine.svelte`, `features/keypad/{Keypad.svelte,keypad.ts}`
- Test: `tests/unit/features/{inventory,examine,keypad}.test.ts`, extend `tests/browser/layout/hud-phone.test.ts`

**Interfaces:** consumes task 2's `HudModel`, `HudActions`; `dialogueBoxSlot`'s box from
`@automata/narrative` for the examine box's text (task 5 gives it typing). Produces no new exports; `hudSlot` now
draws all five kinds.

Behaviour, each piece keyboard, pad and touch:
- **Inventory:** a row of item buttons (44 px), the held one marked. Press an item: a small sheet with its name, its
  text and three actions: Hold (48 px, primary), Combine (then pick the second item; calls `combine(a, b)`), Close.
  Words for the three actions and the empty state come from the piece's `words` (`hold`, `combine`, `close`, `empty`).
- **Examine:** shows `model().examine`; any press calls `dismiss()`. It is the one piece shown while `locked`.
- **Keypad:** opens when `model().keypad.open`; ten digit buttons (48 px), Delete, Enter; `digits` long; Enter calls
  `code(...)`; Escape and Close call `dismiss()`. Typing digits on a keyboard works.
- When `model().locked` becomes true, an open inventory sheet or keypad closes (Review focus 3).

- [ ] **Step 1: Failing tests** for each bullet above, plus: focus returns to the item after its sheet closes; rotating
  (the browser test resizes 390×844 → 844×390) keeps the sheet open and its focus; every button's box is at least
  44 px, the primary 48 px; a 20-item inventory scrolls inside the piece and nowhere else.
- [ ] **Step 2 to 4:** run, implement, run (unit and browser).
- [ ] **Step 5: Commit:** `feat(hud): inventory, examine box and keypad`

### Task 4: `@automata/systems`: peeking, hide from a system, a re-route on a clock

Survey 34, 35, 36.

**Files:**
- Create: `extensions/systems/src/shared/sim/peek.ts`
- Modify: `systems.plugin.ts` (the `Systems` object), `pursuit.ts`, `systems.resource.ts`, `systems.schema.ts`,
  `systems.event.ts`, `systems-checks.ts`, `entries/sim.ts`, `README.md`
- Test: `extensions/systems/tests/unit/shared/{peek,hide-from-system,goto-every}.test.ts`

**Interfaces (produced):**

```ts
export interface Systems { /* as today, plus: */
  readonly hide: (ctx: SimContext, spot: string) => void     // what the `systems.hide` command does
  readonly unhide: (ctx: SimContext) => void }
// systems file: an optional block; absent means no peeking
export interface PeekDef { readonly reach: number   // how near the doorway's middle (m); the old game: 1.4
  readonly dwell: number                             // seconds still and facing it; 0.6
  readonly arc: number                               // the most her facing may be off it, degrees; 50
  readonly lean: number                              // the offset's full length (m); 1.2
  readonly ease: number }                            // seconds to reach it; 0.4
// in the pursuit resource, so snapshots and replays carry it
export interface PeekState { readonly portal: string; readonly into: string; readonly t: number; readonly x: number; readonly z: number }
export const SystemsPeek: EventDef   // 'systems.peek' { portal, into, on: boolean }
/** The player's peek now, or undefined. The view gives `x, z` to the play camera's `clampPeek`. */
export function peekOf(ctx: SimContext): PeekState | undefined
// effect: `{ goTo: place, every?: number }`: with `every`, the route is made again each `every` seconds while the mode holds
```

Rules, from the old game's behaviour (read `src/game/peek.ts` in the game for the cases, write new): a peek starts
when the player is not moving, within `reach` of the middle of a doorway from her room into a room with a different
`zone`, facing it within `arc`, for `dwell` seconds; a doorway whose nav door is shut cannot be peeked; moving, turning
away, hiding or any verb (`puzzle.said`) ends it; the offset grows from 0 to `lean` over `ease` and points across the
doorway. `env` gains `facing` (radians) beside the player's point so the rule can read it; the game sets it each step.

- [ ] **Step 1: Failing tests** on the extension's toy ward (`src/testing/ward-scene.ts`): stands still facing the
  doorway for 0.6 s → `SystemsPeek { on: true }` and `peekOf(ctx).x/z` reach length 1.2 after 0.4 s more; moving ends
  it with `on: false`; facing 60° off never starts; a shut door never starts; a snapshot taken mid-peek restores the
  same `t`; `systems.hide(ctx, 'cupboard')` from a system equals the `Hide` command (same hash); an agent with
  `goTo = "player", every = 0.4` follows a player who moves after the first route, and one without `every` walks to
  where she was; `systems-checks` reports a `peek` block with a negative number, in words.
- [ ] **Step 2 to 4:** run (`pnpm --filter @automata/systems test:unit`), implement, run. The extension's golden hash
  for existing scenes must not move (no existing scene has a `peek` block or `every`); if it moves, stop and find why.
- [ ] **Step 5: Commit:** `feat(systems): peeking through a doorway, hide from a system, a route made again on a clock`

### Task 5: `@automata/narrative`: delivery on a line, typed out; Writer's field

Survey 41; the game's ledger, gap 72.

**Files:**
- Create: `extensions/narrative/src/shared/delivery.ts`, `src/features/box/typing.ts`
- Modify: `src/shared/sim/lines.schema.ts`, `src/features/box/{DialogueBox.svelte,dialogue-box.ts}`,
  `src/entries/{index,content}.ts`, `README.md`; `extensions/cutscenes/src/features/caption/{Caption.svelte,caption.ts}`
  (captions type the same way); `extensions/editors/src/features/writer/{WriterLines.svelte,writer-model.ts}`
- Test: `extensions/narrative/tests/unit/shared/delivery.test.ts`, `tests/unit/features/typing.test.ts`,
  `extensions/editors/tests/unit/writer/delivery-field.test.ts`

**Interfaces (produced):**

```ts
// on a line record, optional; absent means said plainly
export interface Delivery { readonly how?: string | undefined     // a direction for the writer; never shown
  readonly pace?: number | undefined                               // 1 is normal; above is faster
  readonly beats?: readonly Beat[] | undefined }                   // pauses and emphasis, by sentence, not by character
export interface Beat { readonly after: number                     // the sentence it follows, counted from 1
  readonly pause: number }                                          // in beats: 1 is short, 2 long
/** Sentences of `words`, split the same way for every language: on `.`, `!`, `?`, `。`, `！`, `？` and line breaks. */
export function sentences(words: string): readonly string[]
/** What to show `seconds` into a line: how many characters, and whether it is done. `rate` is characters a second. */
export function typed(words: string, delivery: Delivery | undefined, seconds: number, rate: number):
  { readonly shown: number; readonly done: boolean }
```

Why by sentence: the old game marks pauses inside the English words (`{.}`), which a translation would have to carry.
Counting sentences keeps the translated words plain text, so `automata words` and its placeholder check need nothing
new. A pause the old game put inside a sentence moves to the sentence's end; the converter reports each one (task 12).
The box types at `rate × pace`, stops for `pause × 0.35 s` after a marked sentence, shows everything at once under
reduced motion, and a press completes the line before it dismisses it. The clock is injected.

- [ ] **Step 1: Failing tests:** `sentences` on English, Japanese (`。`) and a two-line note; `typed` reaches the end
  of sentence 1 and holds for the pause, then goes on; `pace = 2` halves the time; reduced motion shows all at 0 s; a
  delivery whose `after` is past the last sentence is a content problem naming the line; Writer shows How, Pace and the
  pauses for the chosen line, and an edit writes `delivery` into the lines file as one undo step.
- [ ] **Step 2 to 4:** run (`pnpm --filter @automata/narrative test:unit`, `--filter @automata/cutscenes`,
  `--filter @automata/editors`), implement, run.
- [ ] **Step 5: Commit:** `feat(narrative): how a line is said, typed out in the box and the caption; Writer edits it`

### Task 6: `@automata/cutscenes`: a camera key at an anchor, a 3D stage

Survey 45, 46.

**Files:**
- Create: `extensions/cutscenes/src/features/stage-3d/cutscene-stage-3d.ts`, `src/entries/stage-3d.ts`
- Modify: `src/shared/sim/{cutscene.schema,anchors}.ts`, `src/shared/lint.ts`, `package.json` (`exports`), `README.md`;
  `examples/3d/cutscenes/cutscenes-door-and-lamp.ts` (use the stage in place of its hand wiring)
- Test: `extensions/cutscenes/tests/unit/shared/camera-anchor.test.ts`, `tests/browser/stage-3d.test.ts`

**Interfaces (produced):**

```ts
// CameraKey gains: the key's `pos` and `look` are offsets from this anchor's point on the floor
readonly about?: string | undefined
// placeScript resolves camera anchors as it does actors'; `anchorsOf` lists both. PlacedScript's camera has no `about`.
// @automata/cutscenes/stage-3d
export interface CutsceneStage3dOptions {
  readonly camera: { set(pose: { pos: V3; look: V3; lens: number }): void; release(): void }   // the game's play camera hands over
  readonly pieces: (states: PieceStates) => void          // doors, props and lamp levels: `updatePieces` and the light
  readonly actor: (who: string) => ActorView | undefined  // 'player', an agent's id
  readonly fade: (value: number) => void                  // 0 clear, 1 black
  readonly sound?: (kind: string) => void }
export interface ActorView { place(at: { x: number; z: number; y?: number }, facing: number): void
  pose(name: string | undefined, moving: boolean): void; alpha(value: number): void }
export interface CutsceneStage3d { start(script: PlacedScript): void; draw(seconds: number): void; end(): void; readonly playing: boolean }
export function cutsceneStage3d(options: CutsceneStage3dOptions): CutsceneStage3d
```

The stage asks `createDirector(script).stateAt(seconds)` and hands each part to the option that owns it. It holds no
time of its own: the caller passes the sim's cutscene clock, so a replay draws the same frames. `end()` releases the
camera and restores the piece states the scene had at the start, less what the script's last keys set.

- [ ] **Step 1: Failing tests:** a camera key `about = "player"` with `pos = [1, 2, 0]` resolves to the player's
  point plus the offset; an unknown camera anchor makes `placeScript` answer `{ ok: false, missing }`; the lint names a
  camera anchor the scene cannot resolve; a stage given fakes calls `camera.set` with the director's pose at 0, 3 and 6
  s, sets the lamp level and the door, places an actor and plays a sound key once even when `draw` is called twice in
  the same tick; `end()` calls `camera.release()`; the browser test runs the door-and-lamp example for its 6 s with an
  injected clock and reads the door open and the lamp at level 1 from the scene.
- [ ] **Step 2 to 4:** run (`pnpm --filter @automata/cutscenes test:unit`, the example's journey in
  `examples/3d/tests/e2e`), implement, run. The four converted-scene tests in this extension must still pass unchanged.
- [ ] **Step 5: Commit:** `feat(cutscenes): a camera key at an anchor, and a 3D stage that draws a script`

### Task 7: `@automata/audio-synth`: footsteps by floor

Survey 50.

**Files:**
- Create: `extensions/audio-synth/src/features/steps/step-sounds.ts`
- Modify: the audio schema file under `src/features/synth/` (an optional `steps` table), `src/entries/index.ts`,
  `README.md`; `extensions/editors/src/features/audio/` only if the Audio editor refuses an unknown table (then it
  shows `steps` as rows of floor → cue)
- Test: `extensions/audio-synth/tests/unit/features/step-sounds.test.ts`

**Interfaces (produced):**

```ts
// audio.toml:  [steps]  default = "step"   [steps.floors]  tile = "stepTile"   carpet = "stepSoft"
export interface StepsTable { readonly default: string; readonly floors?: Readonly<Record<string, string>> | undefined }
/** The cue for a step on `floor` (a sector's `floorTexture`); the default when the table has no row for it. */
export function stepCue(table: StepsTable | undefined, floor: string | undefined): string | undefined
```

The game's view plays `stepCue(...)` when it hears its own step event; the synth and the sim are unchanged.

- [ ] **Step 1: Failing tests:** a floor with a row gives its cue; one without gives the default; no table gives
  `undefined`; a `steps` cue the file does not define is a content problem naming the floor and the cue.
- [ ] **Step 2 to 4:** run, implement, run. `pnpm build`, `pnpm api-report --update`, `pnpm api-index --write`
  (published package), and a `patch` changeset.
- [ ] **Step 5: Commit:** `feat(audio-synth): a step sound chosen by the floor`

### Task 8: Sequence: the preview over a 3D level

Survey, editors table; the game's ledger, gap 36.

**Files:**
- Modify: `extensions/editors/src/features/sequence/{plan-view.ts,sequence-session.svelte.ts,sequence-names.ts}`
- Test: `extensions/editors/tests/unit/sequence/plan-view-3d.test.ts`, extend the Sequence journey in
  `extensions/editors/tests/` that opens a level

**Interfaces:** consumes `readLevel`, `AfSector2` (`@automata/3d/level`). Produces:

```ts
/** The walls of a level file as plan segments, in metres: a 2D level's solid cells, or a 3D level's sector edges that are not portals. */
export function levelWalls(text: string, path: string): { readonly walls: readonly Segment[] } | { readonly problem: string }
/** Names a 3D level offers a script: its lamps, doors, props and hotspot things, for the key fields' pickers. */
```

`sequence-names.ts` reads lamps, sector doors, props and things from an `af-sector/2` file so the Light, Doors, Props
and Actor-at pickers offer the level's own names. `@automata/editors` may import `@automata/3d/level` (Zod only, a sim
entry); if `pnpm boundaries` refuses the import, stop and report rather than copying the reader.

- [ ] **Step 1: Failing tests:** a three-room `af-sector/2` (the invented hall of `examples/3d-story`) gives one
  segment per solid wall and none across a portal; a wall with a door gives two segments either side of it; an
  `af2d` level gives what it gives today (the existing test, unchanged); a file that is neither says so in a sentence;
  the names include the level's lamp and door ids.
- [ ] **Step 2 to 4:** run (`pnpm --filter @automata/editors test:unit`), implement, run, and the editors' browser
  suite for Sequence.
- [ ] **Step 5: Commit:** `feat(editors): Sequence previews a cutscene over a 3D level`

### Task 9: `@automata/world-kit`: nine prop generators

Survey 11. Generic ward and workplace furniture; nothing here names the game.

**Files:**
- Create: `extensions/world-kit/src/features/props/ward.ts`
- Modify: `register-props.ts`, the kit's preset library and swatches where a new kind needs a default, `README.md`
- Test: `extensions/world-kit/tests/unit/props/ward.test.ts`; the kit's existing reads and golden tests

**Interfaces (produced):** nine generator kinds registered with `registerPropGenerator`, each taking `with` parameters
with defaults and returning the kit's part meshes: `sink` (`width`), `trolley` (`shelves`), `wheelchair`, `gurney`
(`length`), `monitorCart` (`on: boolean`, a lit screen when on), `wallClock` (`hour`, `minute`), `keyCabinet`
(`open: boolean`, a keypad face), `locker` (`doors`, `open: boolean`), `dripStand`. Each has a footprint the level's
collider reads, as the kit's other furniture does.

- [ ] **Step 1: Failing tests,** one block per kind: it is registered; the same parameters give the same mesh
  (vertex count and bounds equal across two calls); its bounds are within 5% of its documented size; `open: true`
  changes the mesh for `keyCabinet` and `locker`; the clock's hands differ between 8:00 and 4:17; the kit's reads check
  (`check-reads.ts`) passes for each in the base interior.
- [ ] **Step 2 to 4:** run (`pnpm --filter @automata/world-kit test:unit`), implement, run. **Look at each prop:**
  render the nine in the base interior with the kit's own example harness (`examples/3d/worldkit/`), open the picture
  and say in the commit body what each looks like and what is weak. A picture is evidence of shape only.
- [ ] **Step 5:** changeset (`patch`) if `@automata/world-kit` is published; `pnpm build`, API report and index.
  Commit: `feat(world-kit): a sink, trolley, wheelchair, gurney, monitor cart, wall clock, key cabinet, locker and drip stand`

### Task 10: Pack for an outside game; `examples/3d-story` uses interact and the HUD; gates

Spec: "It consumes the framework at a pinned commit, built and packed". This task also proves tasks 1 to 3 on a game
with no content of The Last Light's, and closes Part A. **It needs workstream 1 merged** (merge `main` in first).

**Files:**
- Create: `tooling/release/src/pack-game.ts`, `tooling/release/tests/unit/pack-game.test.ts`
- Modify: root `package.json` (`"pack:game": "node tooling/release/src/pack-game.ts"`); `tooling/consumer-smoke/src/pack.ts`
  only to export what `pack-game` reuses; `examples/3d-story/` (`src/app/game.ts`, `src/app/scene.plugin.ts`, a new
  `content/hud/play.toml`, hotspot things in `content/levels/hall.af-sector.json`, two actions in
  `content/puzzles/hall.toml`, `content/editors.toml`, `tests/e2e/use-a-hotspot.test.ts`);
  `docs/guides/` (a short guide, "Things to use: hotspots and the play HUD"); `docs/refactor/progress.md` is **not**
  this work's record: update `docs/superpowers/progress.md`
- Test: as listed

**Interfaces (produced):**

```ts
// pnpm pack:game --out <dir> [--packages a,b,…]
/** Builds, then packs every workspace package a 3D story game installs (private ones too), with the vendored
 *  `@pixi/3d` tarball, into `out`, and writes `out/pin.json`. Exit 1, naming the package, if a packed manifest still
 *  holds a `workspace:` range or a `file:` path that leaves `out`. */
export interface Pin { readonly commit: string; readonly dirty: boolean; readonly packedAt: string   // from `git`, and a clock passed in
  readonly packages: readonly { readonly name: string; readonly version: string; readonly file: string }[] }
export function packGame(options: { readonly out: string; readonly packages?: readonly string[]; readonly now: () => Date }): Pin
```

The default list: `@automata/framework`, `sim`, `content`, `tools`, `3d`, `editor`, `editor-3d`, and the extensions
`sectors`, `nav`, `places`, `puzzle`, `systems`, `narrative`, `cutscenes`, `interact`, `hud`, `feel`, `audio-synth`,
`debug`, `ui-screens`, `character-kit`, `world-kit`, `editors`. A dirty tree is packed but marked `dirty: true`, and
the game's task 11 refuses a dirty pin.

- [ ] **Step 1: Failing tests:** `packGame` on a fixture workspace of two packages writes two tarballs and a `pin.json`
  with the commit; a manifest left with `workspace:*` fails naming it; `dirty` is true with an uncommitted file.
  The example's journey: tap a crate → Wick walks to it → the examine box shows the crate's line → the objective line
  changes; on a phone-size page the prompt button is 48 px.
- [ ] **Step 2 to 4:** run, implement, run. Then **install the packs outside the workspace**: `pnpm pack:game --out
  /tmp/pin`, make a scratch project with `automata create-game --template 3d`, point its dependencies at `/tmp/pin`,
  `pnpm install && pnpm build`. If a private package cannot be installed from its pack (a missing `files`, a source
  entry with no build), fix the package here, with the consumer-smoke pattern as the guide. Record the install's
  result in the tracker.
- [ ] **Step 5: Gates for Part A:** `pnpm format`; `pnpm check`; `pnpm test:browser:2d`; the 3D browser suites and
  journeys that changed (`pnpm --filter @af-examples/examples-3d test:e2e`, `--filter @af-examples/3d-story test:e2e`,
  `--filter @automata/editors test:browser`); `pnpm build`, `pnpm api-report`, `pnpm api-index`. Grep proves nothing
  of the game came in: `git diff main --stat` lists no file under `extensions/*/src/testing/fixtures/` named for a
  scene, and `git diff main | grep -iE "ada|agnes|bed 04|paraffin|night nurse"` prints nothing. Write in the tracker
  what ran, what did not (WebKit, Firefox, real devices) and why.
- [ ] **Step 6: Commit:** `feat(release): pack the framework at a commit for a game outside the workspace`, then
  `docs(superpowers): slice 1, part A: what ran`. Push. Report to the coordinator; the merge is not this session's.

---

# Part B: the game

Work in `mcthaydt/PixiJS3D_Experiment_001` on `claude/prologue-on-framework`. Read the game's `AGENTS.md` first. The
framework's repository is read only here, checked out at the pin.

### Task 11: The game package, the pin, a blank room that boots

Spec: "Where the game lives". Calls 1 to 4.

**Files:**
- Create: `last-light/{package.json,pnpm-workspace.yaml,tsconfig.json,vite.config.ts,ship.config.ts,index.html,.gitignore}`,
  `last-light/vendor/automata/` (the pin), `last-light/src/main.ts`, `src/app/game.ts`, `content/editors.toml`,
  `content/levels/blank.af-sector.json` (one square room, removed in task 13), `tests/unit/app/boots.test.ts`,
  `last-light/README.md` (how to move the pin: the one command, and that a dirty pin is refused),
  `docs/superpowers/old-game-baseline.md`
- Modify: the old `vite.config.ts` (`test.exclude` gains `last-light/**`; call 3)

**Interfaces:**
- Consumes: the framework's `pnpm pack:game` (task 10); `automata create-game --template 3d` as the pattern for the
  package's files (read what it writes; do not run it into this folder).
- Produces: `pnpm --dir last-light dev`, `build`, `typecheck`, `test`, `test:e2e`; `game` exported from
  `src/app/game.ts` (a `defineGame` with `id: 'the-last-light'`, `orientation: 'landscape'`,
  `size: targetSize({ width: 844, height: 390 }, DEFAULT_LOOK.pixel.short)`, the no-eval entry imported first in
  `main.ts`).

- [ ] **Step 1: Record the old game's baseline.** At the branch's first commit, run `npx tsc --noEmit`,
  `npx vitest run` and `npm run build` at the repository's root; write the pass and fail counts and the names of the
  failing tests in `docs/superpowers/old-game-baseline.md`. Run `guard_check`, the clinic pixel diff and
  `scripts/verify/playthrough.mjs` if the container can; write "not run: <why>" for each that cannot.
- [ ] **Step 2: Make the pin.** In the framework at the pin commit: `pnpm install && pnpm pack:game --out
  <game>/last-light/vendor/automata`. `pin.json` must say `dirty: false`.
- [ ] **Step 3: Write the failing test,** `tests/unit/app/boots.test.ts`:

```ts
it('the pin is clean and every @automata dependency comes from it', () => {
  expect(pin.dirty).toBe(false)
  for (const [name, range] of Object.entries(deps).filter(([n]) => n.startsWith('@automata/')))
    expect(range, name).toMatch(/^file:\.\/vendor\/automata\/.+\.tgz$/) })
it('the sim steps a blank room 60 ticks and gives the same hash twice', () => expect(run(60)).toBe(run(60)))
it('nothing in the package imports the old game', () => expect(importsOutside('last-light')).toEqual([]))
```

- [ ] **Step 4: Run it and see it fail** (`pnpm --dir last-light test`): no package yet.
- [ ] **Step 5: Write the package** to pass, with `render3dExtension`, `sectorsExtension` and the default screens.
  `pnpm --dir last-light install && pnpm --dir last-light test && pnpm --dir last-light build` → pass. Open the dev
  page in Chromium headless and check `data-state="ready"` with no page error.
- [ ] **Step 6: The old game is unchanged:** `git status --porcelain -- src editor scripts tests tools docs/art` is
  empty, and the three root commands give the baseline's counts.
- [ ] **Step 7: Commit:** `feat(last-light): the game package on the framework, pinned, with a blank room that boots`

### Task 12: The converter

Spec step 1. Call 5. Survey rows 1 to 13, 17 to 28, 40 to 47.

**Files:**
- Create: `last-light/tools/convert/` (one file per content kind, as in "File structure"), `last-light/tests/unit/convert/*.test.ts`
- The converter imports the old scene with `tsx` or Node's type stripping from `../../src/scenes/prologue/*`,
  `../../src/scenes/clinic/props.ts` and `../../docs/art/blockout-prologue/blockout.json`. This is the one place the
  new package reads the old code, and it is a tool, not the game (`boots.test.ts` checks `src/` only).

**Interfaces (produced):**

```ts
export interface Unexpressed { readonly kind: string        // 'wall-member' | 'lamp-kind' | 'prop' | 'cutscene' | 'delivery' | 'hook' | …
  readonly where: string; readonly what: string; readonly did: 'dropped' | 'approximated' | 'left-for-hand' }
export interface Converted { readonly files: Readonly<Record<string, string>>   // path under content/ → text
  readonly report: readonly Unexpressed[] }
export function convertLevel(blockout: unknown, props: readonly OldProp[]): Converted      // af-sector/2: sectors, masses, lamps, things, views, props
export function convertNav(level: OldLevel): Converted                                      // nodes, edges, the door on an edge
export function convertPuzzle(puzzle: OldPuzzle): Converted
export function convertSystems(systems: OldSystems, patrol: readonly string[]): Converted  // literals for every tuned number; chase → goTo player (every = replan); fleeGoal → flee light
export function convertStory(story: OldStory, delivery: OldDelivery, deck: OldDeck, beats: OldBeats, help: OldHelp): Converted
export function convertCutscenes(make: OldCutscenes, marks: Readonly<Record<string, Point>>): Converted
export function convertObjective(): Converted              // content/hud/play.toml's objective rows, from the nine ordered conditions
export function convert(root: string): Converted           // all of the above
// CLI: node tools/convert/convert.ts [--write] [--force]   without --write it prints the report and writes nothing
```

Rules the converter follows:
- **Words are bytes.** A line's `words` is the old record's text, unchanged. A delivery's pause inside a sentence
  moves to the sentence's end and is reported (`delivery`, `approximated`).
- **Message keys keep the old line ids** (`prologue.handover`), so the screenplay tools and the hints keep working.
- **Hotspots:** the three act-one ones the prologue hides (`scratches`, `scrawl`, `puddle`) are not written; `shelf`
  and `locker` get `when = [{ fact: 'closetOpen', is: true }]`; `locker` and `screen` get `hide = true`.
- **Props:** each old model maps to a generator by a table in `level.ts`; a model with no generator is reported
  (`prop`, `left-for-hand`) and written as a plain box of its size so the room is never missing a collider.
- **Cutscenes:** `opening`, `lightsOut` and `rest` are evaluated with Ada on a mark (the spawn, and the bedside
  mark the old `bedside()` clamps to) and written with the mark as the trigger; `found` is written with its first
  shot's camera `about = "player"`; anything computed that cannot be said is reported (`cutscene`, `approximated`).
- **Hooks:** `burnLight`, `footsteps`, `wake`, `vigil`, `leave`, `read`, `fill` stay as calls by name; the report
  lists them as the game's own (`hook`, `left-for-hand`), which task 14 writes.

- [ ] **Step 1: Failing tests,** each on a tiny hand-written old-shaped input in the test file (no game content in
  the assertions beyond ids): a two-sector map with a portal and a door becomes a level `readLevel` accepts; a wall's
  `hideFrom` is dropped and reported; a hotspot with `hide: true` becomes a thing with `hide = true`; a puzzle action
  with `when`, `then`, `use` and `seconds` round-trips through `puzzleSchema`; a tunable borrowed from another scene
  becomes a literal row; `{ call: 'chase' }` becomes `goTo = "player"`; a line's words are byte-equal; `{.}` inside a
  sentence is reported; a cutscene that reads the player's position is written from its mark; without `--write`
  nothing is written; with content already present and no `--force`, it refuses.
- [ ] **Step 2 to 4:** run (`pnpm --dir last-light test`), implement, run.
- [ ] **Step 5: Commit:** `feat(last-light): the converter from a scene package to framework content`

### Task 13: Convert once; the content checks; the puzzle can be finished

Spec step 1, and Review focus 5.

**Files:**
- Create: everything under `last-light/content/` that the converter writes; `last-light/docs/convert-report.md` (the
  report, as a table); `last-light/src/testing/solver-model.ts`; `tests/unit/content/{words,checks,solver,screenplay}.test.ts`
- Delete: `content/levels/blank.af-sector.json`
- Modify: `content/editors.toml` (a row per kind, as `examples/3d-story` and `examples/2d-story` have them:
  `levels-3d`, `studio`, `tuner`, `schematic` for systems, nav and puzzles, `writer` for lines and dialogue,
  `sequence` for cutscenes, `audio`, `feel`)

**Interfaces:** consumes `convert` (task 12); `@automata/puzzle/solver`; `@automata/narrative/tools` (lint,
screenplay); `@automata/cutscenes/tools` (lint); `automata check`.

- [ ] **Step 1: Failing tests:**

```ts
it('every line says exactly what the old record says', () => {      // imports the old story module in the test only
  for (const record of OLD.records) expect(wordsOf(record.id), record.id).toBe(record.text) })
it('the puzzle can be finished, by the route the old solver took', () => expect(solve(puzzle, MODEL).routes.length).toBeGreaterThan(0))
it('every hotspot the puzzle names is in the level, and the check says so when one is not', () => {
  expect(check(content)).toEqual([])
  expect(check(without(content, 'nightstand'))[0]).toMatch(/nightstand.*puzzle.*level/) })    // Review focus 5
it('the cutscenes pass the lint against the level', () => expect(lintAll()).toEqual([]))
it('the hints and beats pass the narrative lint', …)
it('the screenplay the tools write holds every line once', …)
```

- [ ] **Step 2: Run them, see them fail** (no content).
- [ ] **Step 3: Run the converter once:** `node tools/convert/convert.ts --write`. Commit its output unedited as one
  commit (`feat(last-light): the prologue converted once`), then fix by hand what the report marks `left-for-hand`
  in following commits, so the diff shows what a person changed.
- [ ] **Step 4: Run** the tests and `pnpm --dir last-light exec automata check`. A check the framework's content
  compiler fails on is read and fixed in the content, or, if the framework is wrong, stops the task (order rule 3).
- [ ] **Step 5: Write `docs/convert-report.md`:** every `Unexpressed` row, and what was done about it.
- [ ] **Step 6: Commit:** `docs(last-light): what the converter could not express, and what was done`

### Task 14: The game's own sim features; the bot finishes the scene in Node, twice, same hash

Spec steps 2 and 4. Survey 15, 19, 20, 24, 31 to 33, 37, 39. Review focus 2 and 3.

**Files:**
- Create: `last-light/src/features/{ada,lamp,night,catch}/…`, `src/shared/{puzzle-facts,puzzle-calls,constants}.ts`,
  `src/app/{scene.plugin.ts,content.ts}`, `src/testing/{bot.ts,route.ts}`, `tests/unit/{lamp,night,catch,ada}/*.test.ts`,
  `tests/unit/play/{route,second-route,fair}.test.ts`
- Modify: `src/app/game.ts` (the extensions, in order: `render3dExtension`, `sectorsExtension`, `navExtension`,
  `puzzleExtension({ extensions: ['systems', 'narrative'], calls, facts })`, `systems.extension`,
  `narrative.extension`, `cutscenes.extension`, `interact.extension`)

**Interfaces (produced, the game's):**

```ts
// lamp: the hand lamp. Fuel is whole ticks, so the hash is exact.
export const Lamp: ComponentDef            // { lit: boolean, fuelTicks: number }
export const ToggleLamp: CommandDef        // 'lamp.toggle' {}
export const LampDry: EventDef             // 'lamp.dry' {}          the lamp went out for want of fuel
export function fillLamp(ctx: SimContext): void          // the puzzle's `fill` call: + FILL seconds, at most 2 × FILL, and lit
// puzzle-facts: `lit` and `fuel` read from the Lamp; given to puzzle and to systems
export const puzzleFacts: PuzzleOptions['facts']
// night: the vigil and the three hooks the systems file names
export const nightHooks: SystemsOptions['hooks']         // wake, vigil, leave, burnLight (a no-op: the lamp system burns), footsteps
// catch: one checkpoint, and what a practice catch does
export const Checkpoint: ResourceDef       // the snapshot kept at `puzzle.checkpoint` and at lights out
export const Caught: EventDef              // 'catch.practice' {}
// testing
export interface BotResult { readonly finished: boolean; readonly ticks: number; readonly hash: string; readonly caught: number }
export function playRoute(route: readonly BotStep[], seed: number): BotResult
```

Rules: the lamp burns one tick of fuel each tick it is lit; at zero it goes out and `LampDry` fires; `ToggleLamp`
does nothing without the lamp item, and says the dry line (through `applyVerb`'s fallback path or a `systems.line`)
when dry. Each step the game gives systems `env.lights`: the lamp's pool at the tuned radius when lit, and the four
room lamps until lights out. A practice catch (`systems.caught` with cause `practice`) is ignored while a cutscene
holds input; otherwise it starts the `found` cutscene and, when that ends, restores `Checkpoint` and calls the
`resetFor` hook. The numbers (`FILL` = 40 s, the lamp radius, the walk speed) are in `content/tuning.toml`, read
through the content, so the Tuner edits them.

- [ ] **Step 1: Failing tests,** smallest first: the lamp lit for 40 s of ticks goes out and fires `LampDry` once;
  toggling with no lamp does nothing; `fillLamp` twice caps at 80 s; `puzzleFacts` reads `lit`; the vigil is over after
  its tuned seconds unless she hunts; a catch during a cutscene does nothing (Review focus 3); a catch in play restores
  the checkpoint's facts and items and puts her at the far node. Then the routes:

```ts
it('the bot finishes the prologue from its first cutscene to its end', () => {
  const run = playRoute(ROUTE, 1); expect(run.finished).toBe(true); expect(run.caught).toBe(0) })
it('twice, the same hash', () => expect(playRoute(ROUTE, 1).hash).toBe(playRoute(ROUTE, 1).hash))
it('letting the lamp run dry in the supply room can still be finished', …)     // Review focus 2: SECOND_ROUTE burns it out, fetches the extra bottle
it('a cautious bot is never caught in 20 seeds; the fairness targets of the systems file hold', …)
```

`ROUTE` is the old solver's order: the note, its back, the lamp, the paraffin, fill, the register, the cabinet and the
code `2000`, the supply door, the shelf, the bed with the sheets, hide behind the screen until she has gone, the bed.
The bot sends the same commands a player's input does (`useCommands`, `Combine`, `EnterCode`, `ToggleLamp`,
`CutsceneSkip`), never a private door into the sim.

- [ ] **Step 2 to 4:** run (`pnpm --dir last-light test`), implement, run. A hash that differs between two runs is a
  bug to find, never to re-record.
- [ ] **Step 5: Commit:** `feat(last-light): the lamp, the vigil and the practice catch; a bot finishes the prologue`

### Task 15: Dress it: props, lamps, Ada and the figure, poses

Spec step 3. Survey 5, 6, 11 to 14, 47. No paid stage; no old art.

**Files:**
- Create: `last-light/content/figures/{ada,figure}.toml`, `content/figure-swatches/*`, `content/figure-gaits/*`,
  `content/figure-actions/{read,flinch,pulse}.toml`, a `figure-seat` for sitting on the bed and one for lying,
  `content/world-props/*`, `content/world-swatches/*`, `content/states/prologue.toml`,
  `src/features/room/{room-view.ts,states.ts}`, `src/features/figure/figure-view.ts`, `tests/unit/room/states.test.ts`,
  `docs/dress-notes.md`
- Modify: `content/levels/prologue.af-sector.json` (props' `use` and `with`, lamp kinds, lettering), by hand or in
  Levels 3D

**Interfaces (produced):**

```ts
// content/states/prologue.toml: rows "while these conditions hold, this piece is in this state"
export interface StateRow { readonly when: readonly Cond[]; readonly lamp?: string; readonly level?: number
  readonly door?: string; readonly open?: number; readonly prop?: string; readonly state?: string }
/** The piece states for the world as it is now: later rows win. */
export function statesFor(rows: readonly StateRow[], reader: Reader): PieceStates
```

What to build, by eye and by the script (the game's rule: the script wins, so a thing a line names must be there):
- **Ada** in her own street clothes (the prologue is 1979, before the uniform) and **the figure** as a tall dark
  nurse's silhouette, both from the framework's figure builder and character kit as merged at the pin, made in the
  Studio. Tone: worn, not grimy; no gore.
- **The ward** furnished from the converter's prop table and task 9's generators; the two dead bulbs, the lamps that
  go at lights out and the bed made up are rows in `content/states/prologue.toml`.
- **The five cutscene poses** as figure actions and seats.

- [ ] **Step 1: Failing test:** `statesFor` gives the corridor lamp level 0.12 before lights out and every room lamp
  0 after; the supply door open follows `closetOpen`; the bed shows `made` once `bedMade`.
- [ ] **Step 2 to 4:** run, implement, run; `automata check` passes.
- [ ] **Step 5: Look at it.** Take a picture of each of the three rooms and of each figure from the play camera and
  the Studio. Open every picture and write in `docs/dress-notes.md`, room by room: what reads, what does not, and what
  waits for the builders' look (the survey's "What slice 1 waits for"). Pictures prove composition only.
- [ ] **Step 6: Commit:** `feat(last-light): the ward furnished, lit by state, with Ada and the figure`

### Task 16: Draw it: renderer, cutscenes, HUD, sound, feel

Spec steps 2 and 3. Survey 9, 25 to 27, 30, 45 to 52.

**Files:**
- Create: `last-light/content/hud/play.toml` (pieces: objective top-left, prompt bottom, inventory bottom-right,
  examine bottom, keypad centre; the nine objective rows from the converter), `content/audio/audio.toml` (cues written
  new for the synth: pick up, keypad buzz and chime, the sting, lamps out, lamp lit, steps by floor),
  `content/feel/feel.toml`, `src/features/lamp/lamp-view.ts`, `src/app/{controls.ts,flow.ts}`,
  `tests/unit/app/{hud-model,controls}.test.ts`
- Modify: `src/app/game.ts` (`createRenderer` with the play camera following Ada through the level's views and
  `peekOf`; `cutsceneStage3d` wired to the camera, the room's piece states, the two figure views and the fade;
  `hudSlot` in `hud.overlay` with the caption slot; `createAudioSynth`, `createFeel`; `input`)

**Interfaces (produced):**

```ts
/** The HUD's model from what the sim reported this step. Pure. */
export function hudModel(state: PlayState, file: HudFile): HudModel
// controls: move (WASD, arrows, the left stick, the touch stick), turn the camera (Q/E, the right stick, drag),
// use the nearest hotspot (Space, Enter, the pad's confirm, the prompt button), the lamp (F, the pad's north),
// inventory (I, Tab, the pad's west), skip a cutscene (Escape held, the pad's start)
```

- [ ] **Step 1: Failing tests:** `hudModel` shows the first objective row at the start and the `hide` row after
  lights out; `prompt` is the nearest hotspot in reach and absent in a cutscene; `locked` is true while
  `cutscenes.locked`; the examine title is the hotspot's name key; every control has a keyboard, a pad and a touch
  way (a table test over `controls.ts`).
- [ ] **Step 2 to 4:** run, implement, run. Then play it by hand in Chromium headless with the debug overlay and
  fix what is wrong.
- [ ] **Step 5: Commit:** `feat(last-light): the prologue drawn: camera, cutscenes, HUD, sound and feel`

### Task 17: Prove it plays (Chromium)

Spec step 4; "Done means": the prologue plays from its first cutscene to its end under a bot, twice with the same
hash, in Chromium. This replaces `scripts/verify/playthrough.mjs` for this scene; the old script is not changed.

**Files:**
- Create: `last-light/playwright.config.ts`, `tests/e2e/playthrough.test.ts`, `tests/e2e/driver.ts`

**Interfaces:** consumes `@automata/debug`'s driver in a debug build, and the sim's replay log and hash. Produces
`pnpm --dir last-light test:e2e`.

- [ ] **Step 1: The failing journey:**

```ts
test('the prologue plays to its end, twice, with the same hash', async ({ page }) => {
  const first = await play(page, ROUTE, { seed: 1 })     // waits on sim state through the driver, never on a sleep
  const second = await play(page, ROUTE, { seed: 1 })
  expect(first.pageErrors).toEqual([]); expect(first.ended).toBe('rest')        // the last cutscene ran to its end
  expect(first.hash).toBe(second.hash); expect(first.hash).toBe(NODE_HASH) })   // and equals task 14's hash in Node
```

`play` starts from the title's Play, lets the opening cutscene run (not skipped) and skips the others, sends the
route's commands through the page's input as a player would where a control exists (the prompt button, the inventory,
the keypad) and through the driver only to wait.

- [ ] **Step 2 to 4:** run, fix, run. `NODE_HASH` is read from task 14's run at test time, not typed in.
- [ ] **Step 5: Commit:** `test(last-light): a bot plays the prologue to its end in Chromium, twice, same hash`

### Task 18: Prove it edits (six editors)

Spec step 5; "Done means": it opens in Levels 3D, Writer, Sequence, Schematic, the Studio and the Tuner; one edit in
each shows in play. The pattern is `examples/3d-story/tests/e2e/schematic-in-play-3d.test.ts`.

**Files:**
- Create: `last-light/tests/e2e/edits/{levels,writer,sequence,schematic,studio,tuner}.test.ts`, `tests/e2e/edits/suite.ts`

Each journey opens the suite on the game (`automata editor`), makes one edit through the editor's own controls, saves,
plays, and reads the change from the sim or the page. Every journey works on a copy of `content/` in a temp folder, so
the committed content never changes.

| Editor | The edit | What play shows |
|---|---|---|
| Levels 3D | Move the `nightstand` hotspot 0.5 m | The prompt appears at the new place and not the old |
| Writer | Add one invented line and point the `trolley` action's line at it | The examine box shows the invented words. No real line's words change, in the copy or anywhere |
| Sequence | Move the `keypad` cutscene's caption 0.5 s later | The caption appears at the new time under an injected clock |
| Schematic | Halve the vigil | The figure leaves in half the ticks |
| Studio | Change one of Ada's swatches | The figure view's texture hash differs from before |
| Tuner | Raise the lamp's fill from 40 to 60 s | One fill lasts 60 s of ticks |

- [ ] **Step 1: Write the six journeys;** run them and see each fail for its own reason (or pass where the editor
  already works; a pass with no code change is a result, written down).
- [ ] **Step 2: Fix what fails.** A fault in an editor is the framework's: stop, fix it there with its test, move the
  pin (order rule 3). A fault in the game's wiring is fixed here.
- [ ] **Step 3: Commit:** `test(last-light): one edit in each of six editors shows in play`

### Task 19: Prove the shell: languages, first run, gamepad, touch at phone size

Spec step 6; "Done means": it runs under the framework's shell with a gamepad and with touch at phone size, and its
menus and its story lines are in the six languages. **Needs workstream 1 at the pin.** Call 7.

**Files:**
- Create: `last-light/fonts.toml` (workstream 1's font set, cut to the characters the game shows),
  `content/credits.toml`, `messages/ui/{en,ja,ko,es-419,pt-BR,zh-Hans}.json` (the game's few interface words: the HUD's
  action words and room names), `content/messages/context.json` (notes for the translator: the year is 1979; Ada
  speaks plainly and wryly; "Bed 04", "St. Agnes" and the code 2000 are never translated), `tests/e2e/shell/*.test.ts`,
  `docs/translation-run.md` (the one command for the Owner and what it writes)
- Modify: `src/app/game.ts` (`firstRunLanguage`, `photosensitivity` on with the feel switches, `opening` with the
  Splash, `uiSounds`), `src/app/flow.ts` (Credits from the title), `ship.config.ts` (`content.languages`)

- [ ] **Step 1: Failing journeys,** each at 390×844 and 844×390 in Chromium:
  - a first run shows the language screen, then the flashing warning, then the splash, then the title; a second run
    goes straight to the title;
  - with a gamepad only (Playwright's pad emulation, as the framework's journeys do it): title → Play → skip the
    cutscene → walk → use a hotspot → open the inventory → hold an item → pause → settings → back;
  - with touch only: the same path with the touch stick, the prompt button and the inventory;
  - every HUD piece and menu control is at least 44 px (primary 48 px) in each of the six languages, with the longest
    line of that language in the examine box (Review focus 4);
  - the title, pause and settings are in the chosen language; changing the language in Settings changes the HUD's
    action words at once;
  - none of the old game's shell is present: no element with the old ids (`#begin`, `#dialogue`), no import of
    `../src` (task 11's test still passes).
- [ ] **Step 2 to 4:** run, implement, run. The interface words in `messages/ui/` are written by the session in the
  five languages and recorded with `automata words --mark`, as workstream 1 does for menus. **The story lines are
  not:** run `automata words` once against an invented line in a scratch catalog with the tools' fake model to prove
  the path, write `docs/translation-run.md`, and leave the five story catalogs to the Owner's run. `automata check`
  will say the story's translations are missing; that is the true state, and the tracker says so. If the Owner has
  answered the survey's question 2 the other way, follow the answer.
- [ ] **Step 5: Commit:** `feat(last-light): the framework's shell around the prologue; six languages for its menus`

### Task 20: The old game still builds and plays; records; final report

"Done means": the old game still builds and plays, untouched; nothing of the game's story or art is in the
framework's repository.

**Files:**
- Modify: the game's `docs/superpowers/STATUS.md` (a section for the remake: where it lives, how to run it, what is
  proven, what is open), `last-light/README.md`; in the framework, `docs/superpowers/progress.md` (by the coordinator
  or a follow-up commit there, not from this repository)

- [ ] **Step 1: The old game.** `git diff main --stat -- src editor scripts tests tools docs/art public` is empty.
  Run the three root commands again and compare with `docs/superpowers/old-game-baseline.md`: the same counts and the
  same failing names. Run what else task 11 could run. Write the comparison under the baseline.
- [ ] **Step 2: The new game.** `pnpm --dir last-light typecheck && pnpm --dir last-light test && pnpm --dir last-light
  exec automata check && pnpm --dir last-light build && pnpm --dir last-light test:e2e`. Write each result.
- [ ] **Step 3: Nothing of the game in the framework.** In the framework at the pin: `git log --since=<Part A's first
  commit> --name-only` lists no content of the game, and the grep of task 10 step 5 is run again on `main`.
- [ ] **Step 4: "Done means", line by line,** in `STATUS.md`: each of the spec's five lines with the test that proves
  it or the word **open** and why. Expected open at the end of this plan: the story's five translations (the Owner's
  `automata words` run), WebKit and Firefox parity, real devices, and whatever `docs/dress-notes.md` says waits for
  the builders' look.
- [ ] **Step 5: Commit:** `docs(last-light): slice 1's record: what is proven and what is open`. Push. Report to the
  coordinator with the final commit of each repository.

---

## Self-review, done when this plan was written

- **Spec coverage.** Step 1 (convert once): tasks 12, 13. Step 2 (close the gaps): tasks 1 to 9 in the framework, 14
  in the game. Step 3 (dress): tasks 9, 15, 16. Step 4 (plays): tasks 14, 17. Step 5 (edits): tasks 5, 8, 18. Step 6
  (shell): task 19. "Where the game lives" and the pin: tasks 10, 11. "Done means": plays, tasks 14 and 17; opens in
  six editors, task 18; shell, gamepad, touch and languages, task 19 (story translations open by call 7); framework
  additions tested and `pnpm check`, task 10; nothing of the game in the framework, tasks 10 and 20; the old game
  untouched, tasks 11 and 20. HUD layout and words as data: tasks 2, 3, 16.
- **Not covered, on purpose:** Writer for storylets, beats and help; a camera-eye preview in Sequence; scenarios in
  Schematic; the framework's old fixtures. They are in the survey as suite work or the Owner's.
- **Names checked across tasks:** `applyVerb`, `useCommands`, `Hotspot`, `hudSlot`, `HudModel`, `HudActions`,
  `chooseObjective`, `Systems.hide`, `peekOf`, `PeekDef`, `Delivery`, `typed`, `cutsceneStage3d`, `stepCue`,
  `levelWalls`, `packGame`, `Pin`, `statesFor`, `playRoute` are spelled the same wherever they appear.
- **What this plan could not check:** nothing was run. Three "to check" items in the survey may change a task: if the
  occluders do not hide rooms as the game needs, task 15 stops for a framework fix; if the lamp kit lacks a kind, task
  15 maps it by hand; if `goTo` already re-routes each step, task 4's `every` is dropped and said so in the log.

## Log

| Date | Session | What |
|---|---|---|
| 2026-11-11 | Stage 2 (plan), `claude/last-light-prologue-plan` | The survey and this plan written. No product code, no test run |
