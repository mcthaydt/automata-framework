# M6.8a: `narrative`, the dialogue sim, its content and storylets (TDD plan)

- **Spec:** the framework's M6 spec (`docs/superpowers/specs/2026-10-16-m6-gameplay-extensions-design.md`): §4.7, §4.9,
  §4.13 (storylets into `narrative`, M6-D16), §6, §9, §13 NR-a.
- **Row:** M6.8a in the framework's `docs/02-master-delivery-plan.md`: "`DialogueGraph`, `LineRecord` with locale keys
  and a canon schema with stance bounds; the dialogue-state resource and the choose command; conditions use puzzle's
  `Cond`; NR-a … plus storylets". Prerequisites M6.6a and M6.3 (both merged). Size M. LegacyV2's narrative note
  (layered storylets, one shared state of facts) is design input only.
- **Branch:** `claude/plus-M6.8a-narrative`, from main; one PR for the milestone.
- **Source (read-only):** the adventure source at `92e67047a33161c5cfb1c5f9d8b981e91e1c55b9`: `src/narrative/dialogue.ts`
  (134 lines), `lines.ts` (52), `canon.ts` (104, its shape only), `storylets.ts` (347), `src/game/contracts/narrative.ts`
  (133), the scenes' `dialogues.ts`, `story.ts` and `storylets.ts`, and the tests `tests/dialogue.test.ts` (its runtime
  and in-game cases), `storylets.test.ts` (19) and `clinic-dialogues.test.ts` (2). Provenance goes in the framework's
  `docs/provenance/sources.md` only.
- **Status:** implemented and locally checked (steps 1 to 8); the framework's provenance row is a follow-up AF docs PR.

## Scope

In: `packages/narrative` (`@mcthaydt/automata-narrative`, private like the other M6 packages):
- content kinds, each a Zod schema checked at its path: `canon` (the shape only: people, places, times, numbers, facts,
  tone, glossary, motifs and the stance bounds; the text is the game's), `lines` (a scene's `LineRecord`s: id, kind,
  speaker, a locale key for the text, facts, beat, hints, motifs), `dialogue` (a scene's `DialogueGraph`s) and
  `storylets` (a scene's deck);
- the dialogue sim: a `narrative.dialogue` resource (the graph under way, its node and line, `stance` within the
  canon's bounds, the facts choices set), the `narrative.start`, `narrative.advance` and `narrative.choose` commands, and
  the `narrative.line`, `narrative.choices` and `narrative.ended` events. Gating and settling as in the source; nothing
  advances on a timer. Conditions are puzzle's `Cond`, read through stance, the dialogue's facts, then puzzle's state;
- the storylet sim: salience (most conditions, then priority, then deck order), `once` and `max`, the triggers
  `inspect:<hotspot>`, `enter:<sector or zone>`, `dwell:<sector or zone>:<s>` and `system:<event>`, a play queued after
  an action's own line, and a `narrative.storylet` event carrying the line key; what has played lives in a
  `narrative.storylets` resource;
- puzzle's two new optional hooks: `dialogue` (a `{ dialogue }` effect starts the graph on the verb's step) and `verb`
  (the verb system tells a listener which verb it took, for `inspect` storylets). Both additive; puzzle's golden must
  not move;
- a one-off converter for the four scenes' lines, graphs and decks; a four-engine golden; NR-a.

Out:
- lints, coverage, the screenplay, help and the audit (M6.8b);
- the DialoguePanel, captions, delivery and portraits (M6.8c);
- beats (`Beat`): coverage's concern, with M6.8b;
- the source's `radio` trigger and its facility `phase`: the adventure game's own (a deck may still carry a `phase`
  label, which the sim ignores).

## What maps to what

| Adventure source | Here |
|---|---|
| `LineRecord.text` (the text itself) | `LineRecord.text` is a locale key (PRODUCT.L); the string exists only on screen |
| `STANCE = CANON.stance` (a module constant from the game's canon, the leak M6.3 named) | the bounds from the loaded canon content, in the `narrative.dialogue` resource |
| `world.dialogue` (stance and facts in the world) | the `narrative.dialogue` resource |
| `converse(graph, read)` (a closure the panel drives) | the commands; the resource holds where the conversation is |
| `emit.message(..., 'storylet:<id>')` | the `narrative.storylet` event |
| `withStorylets(rules, deck)` (wraps the game's rules) | the storylets system, told of verbs by puzzle's `verb` hook and of rooms by sectors' `InSector` |
| `readingTime(line)` (from the text's length) | a fixed `AFTER` delay (the text is not in the sim, NR-D4) |
| `fireSystem(w, event)` | `fireSystem(ctx, event)`, a sim function the game's systems or hooks call |

## Interfaces

Produced (`@mcthaydt/automata-narrative/sim` unless marked):

```ts
export interface LineRecord { id: string; kind: LineKind; speaker?: string | null; text: string; facts?: string[]; beat?: string; hints?: string[]; motifs?: string[] }
export interface Canon { people; places; times; numbers; facts; tone; glossary; motifs?; stance?: { min: number; max: number } }
export interface DialogueGraph { id: string; speaker: string; start: string; nodes: Record<string, DialogueNode> }
export interface Storylet { id: string; trigger: string; phase?: string; when?: Cond[]; lines: string[]; once?: boolean; max?: number; priority?: number; hints?: string[] }
export function createNarrative(options?: NarrativeOptions): { plugin: PluginDef; startDialogue(ctx, id): void; heardVerb(ctx, verb, action): void; fireSystem(ctx, event): void; load(ctx, scene): void }
// commands: narrative.start { graph }, narrative.advance, narrative.choose { index }
// resources: narrative.scene (the loaded canon bounds, graphs, deck), narrative.dialogue, narrative.storylets, narrative.env (the player's entity)
// events: narrative.line { graph, id }, narrative.choices { graph, choices: { index, line }[] }, narrative.ended { graph }, narrative.storylet { id, line }
export const narrativeExtension(options?): …   // `.` entry, with the four content kinds
```

## Files

Create, under `packages/narrative/`: `package.json`, `tsconfig.json`, `vitest.config.ts`; `src/sim/{lines,canon,dialogue,storylet}.schema.ts`, `src/sim/dialogue.ts` (gating, settling, choosing, pure), `src/sim/storylets.ts` (salience, pure), `src/sim/narrative.{command,event,resource,system,plugin}.ts`, `src/sim/load-narrative.ts`, `src/sim/index.ts`; `src/narrative.content.ts`, `src/narrative.extension.ts`, `src/index.ts`; `scripts/convert-adventure-narrative.ts` with the `.ts` resolve hook; `src/testing/fixtures/*.{lines,dialogue,storylets}.toml`, `src/testing/converted-narrative.ts`, `src/testing/talk-game.ts`, `src/testing/talk-script.ts` (golden).
Tests: `schema.test.ts`, `dialogue.test.ts`, `storylets.test.ts`, `narrative.plugin.test.ts`, `narrative.parity.test.ts`, `narrative.extension.test.ts`.
Modify: `packages/puzzle` (the `dialogue` and `verb` options, tests first), the root `package.json` (`boundaries` adds `packages/narrative/src/sim`), `pnpm-lock.yaml`.

## Steps

Each step: write the test, see it fail for the stated reason, write the minimum, see it pass.

1. Skeleton and extension test; `pnpm boundaries` covers `packages/narrative/src/sim`. Fails: no module.
   - [x] 1
2. Converter run: the four scenes' lines (text to locale keys), graphs and decks; the commit it read goes in the log.
   - [x] 2
3. Schemas: the converted content parses; a dialogue choice to an unknown node, a line record with no kind, a storylet
   with an unknown trigger and a canon with min above max each fail at their path. Fails: no schemas.
   - [x] 3
4. The dialogue runtime (the source's four cases, pure): each line on an advance, the choices with the last line, never
   moving on its own; reading stance, dialogue facts, puzzle facts and items; NR-a, stance clamped to the canon's bounds
   with earlier facts kept; a choice whose target is gated shut is hidden. Fails: no runtime.
   - [x] 4
5. Storylets (the source's salience, once and max, inspect, enter, dwell, system and state cases, re-pointed): the most
   conditions win, then priority, then deck order; a once storylet plays once and a max one that many times, each play
   the next line; an inspect plays after the action's line, at once when the action says nothing, not on a use with an
   item, and a new action drops what is queued; enter fires once per entry; dwell counts standing still and moving
   resets it; `fireSystem`; an empty deck leaves the state as it was. Fails: no storylets.
   - [x] 5
6. Plugin and puzzle hooks: puzzle's `dialogue` and `verb` options (tests first, puzzle's golden unchanged); a `{
   dialogue }` effect starts the graph on the verb's step; `start`, `advance` and `choose` through commands, with every
   event's payload; the source's "the simulation applies and records a choice, and a replay repeats it" as a restore
   mid-conversation giving the same events and hash. Fails: no plugin.
   - [x] 6
7. Golden: a scripted conversation and storylets on the clinic's converted content for 600 steps, restored at 300;
   recorded in Node, confirmed in Chromium, WebKit and Firefox.
   - [x] 7
8. Gates, provenance row, ready line.
   - [x] 8

Source tests not ported: `dialogue.test.ts`'s lint, endings, motifs and screenplay cases (M6.8b) and its session-phase
case (the source game's session); `storylets.test.ts`'s deck checks and screenplay appendix (M6.8b), the `radio` case
and the scenes' decks played in the source's rules (the game's); `clinic-dialogues.test.ts`'s register pages (the
game's Files UI).

## Gates

- `pnpm exec biome check --write <changed>`, Plus `pnpm check`.
- `pnpm --filter @mcthaydt/automata-narrative test:parity` and `pnpm --filter @mcthaydt/automata-puzzle test:parity`.
- No changeset (private).

## Decisions for the Owner's veto

- **NR-D1:** a line record's `text` is a locale key, and the converter writes the source's strings to a locale fixture
  keyed the same way; the sim never holds a string a player reads.
- **NR-D2:** the stance bounds come from the loaded canon (the default −4..4 only when a canon gives none, as the source).
- **NR-D3:** puzzle gains two optional hooks (`dialogue`, `verb`), the same pattern as SY-D2's `noise`: a system cannot
  read another's events on the step they are emitted.
- **NR-D4:** a storylet queued after an action plays `AFTER` seconds later (2 s, the source's minimum) instead of the
  action line's reading time, since the text is not in the sim.
- **NR-D5:** rooms are sectors (by sector id or zone), from sectors' `InSector`; the player is named by its StableId in
  `narrative.env`.
- **NR-D6:** `narrative` is private, like the other M6 packages.

## Follow-ups

- The bin's TypeScript resolve hook (M6.7b's SB-D6).
- M6.8b (lints, coverage, screenplay, help, audit) and M6.8c (the panel, delivery, portraits).

## As built

- `narrative.line` and `narrative.choices` carry the graph, and the choices carry the index `narrative.choose` takes
  (the plan had `{ id }` and `{ lines }`): a presentation that hears a line can tell which conversation said it, and
  a choice hidden by its gate leaves a gap in the indices.
- Puzzle's `verb` hook reports `{ at, held, action, said, away }` (`VerbReport`), once a verb has run, taken or not;
  `away` is a cutscene, dialogue, keypad or exit effect, as the source's `interact` watched.
- `createNarrative` returns `env` too (the `narrative.env` resource, where the game names the player). `narrative.env`
  keeps the player's plan position from the last step: moving is that position changing (the source read
  `player.moving` from its input), so dwell needs nothing from the game.
- The storylets read `read.<hotspot>` as "an action at this hotspot has been taken" (puzzle's `seen`), and
  `played.<id>`; the source's dotted world paths, `hidden` and `room` are the game's, through `NarrativeOptions.facts`.
- The sim reads the player's sector as of the last step's membership (sectors' membership runs in `cleanup`).
- A scene load clears the conversation and the deck's plays, and keeps stance (clamped to the new bounds) and the
  dialogue's facts.
- An unknown graph named by `narrative.start` or a `{ dialogue }` effect does nothing in the sim: M6.8b's lints refuse
  it in content.
- `biome.jsonc`'s `noThenProperty` override adds `packages/narrative` (the test puzzles' actions have `then`).

## Execution log

- 2026-10-31: plan written from the M6 spec at framework main, plus main (`aff68d6`: puzzle, sectors, systems) and the
  adventure source at `92e6704`.
- 2026-10-31, step 1: the skeleton; the extension test failed on the missing `narrativeExtension`. `pnpm boundaries`
  covers `packages/narrative/src/sim` (110 files, 0 findings; it caught an `Object.keys` in the dialogue schema, now
  `sortedKeys`).
- Step 2: the converter read the adventure source at `92e67047a33161c5cfb1c5f9d8b981e91e1c55b9`: prologue 74 lines, 0
  graphs, 3 storylets; clinic 142, 3, 9; clinic-dawn 123, 2, 13; bay 191, 4, 4 (1 radio storylet left out).
- Steps 3 and 4: `schema.test.ts` (5) and `dialogue.test.ts` (4, NR-a included) failed on the missing modules, then
  passed.
- Step 5: `storylets.test.ts` (11) failed on the missing exports, then passed.
- Step 6: puzzle's two new tests failed (`expected [] to deeply equal …`), then passed; puzzle's golden unchanged
  (`cd73a8d0b545c212`, parity 3/3 browsers). `narrative.plugin.test.ts` (7) failed on `createNarrative` missing, then
  passed (the toy puzzle needed a goal: an empty goal holds at once).
- Step 7: the golden, recorded in Node 24: hash `f07b6a56c0f4182b`, events `50cfecbe4dd669d4`, 94 events, 9 storylets,
  straight equal to restored at 300; `test:parity` 3/3 (Chromium, WebKit, Firefox).
- Step 8: `pnpm format`; `pnpm check` exit 0 (lint, typecheck, boundaries 0 findings, root 172 tests, every package's
  unit tests: narrative 29, puzzle 23, systems 59, nav 20, sectors 34, pipelines 144 and the rest green); parity for
  narrative and puzzle 3/3 each. No changeset (private).
