# M6.8b: `narrative` lints, coverage, screenplay, help and audit, through `automata pipe narrative` (TDD plan)

- **Spec:** the framework's M6 spec (`docs/superpowers/specs/2026-10-16-m6-gameplay-extensions-design.md`): §4.7
  (tools: "lint (line length, speaker, banned words from canon), dialogue lint (reachability, dead ends, every choice's
  effect in bounds), coverage (every beat, clue and hint reachable), screenplay and help docs, all through
  `automata pipe narrative <command>`"), §9, §13 NR-c ("A dialogue graph with a dead end fails `narrative lint`").
- **Row:** M6.8b in the framework's `docs/02-master-delivery-plan.md`. Prerequisites M6.8a (automata-plus#27, merged
  `f64e0c4`) and M3.8a (the Pipelines platform, merged). Size L.
- **Branch:** `claude/plus-M6.8b-narrative-tools`, from main `f64e0c4`; one PR, one commit per part.
- **Source (read-only):** the adventure source at `92e67047a33161c5cfb1c5f9d8b981e91e1c55b9`: `src/narrative/lint.ts`
  (119), `dialogue-lint.ts` (287), `coverage.ts` (158), `screenplay.ts` (207), `help.ts` (92), the help and beat types
  in `src/game/contracts/narrative.ts`, `scripts/pipeline/narrative.ts` (378), `narrative-coverage.ts` (108),
  `narrative-play.ts` (262), and their tests. Provenance goes in the framework's `docs/provenance/sources.md` only.
- **Status:** plan drafted.

## Scope

In:
- **Content:** a `beats` kind (`Beat`: id, the lines that deliver it, `after`) and a `help` kind (`SceneHelp`: hint
  ladders of three lines per puzzle, deductions with their clues), each a Zod schema checked at its path, registered by
  `narrativeExtension`.
- **`narrative/tools`** (a build-time entry, not a sim entry): pure functions over content and the locale text:
  - `lintNarrative`: facts, canon times, proper nouns against the canon and glossary, the canon's banned words, no
    exclamation marks, duplicates, beats, unused lines; line length through an injected `measure` (no canvas
    dependency: the pipeline passes none, so length is checked only when a game supplies one);
  - `lintDialogues`: reachability, dead ends (NR-c), every choice's stance within the canon's bounds, speakers, unknown
    lines; the endings and motifs checks parameterised by the canon (the source's fixed `ENDINGS` and Nurse lines are
    the game's);
  - `lintDeck`: the storylet deck's checks (unknown lines, a trigger that cannot fire, a condition that never holds);
  - `beatCoverage` and `hintCheck` over traces; `lintHelp` and `currentHint`;
  - `screenplay`: the act screenplay as Markdown from traces, byte-identical for the same traces, with the dialogue
    pages (`dialogueScreenplay`) and the storylets appendix.
- **Traces:** played by puzzle's solver routes (M6.6b) in the sim with puzzle and narrative loaded (the talk game's
  shape), every conversation walked on each path; a trace is the play-ordered narrative and puzzle events.
- **`automata pipe narrative`** (`tooling/pipelines/src/narrative.pipeline.ts`, registered): stages `lint` (lint, dialogue
  lint, deck lint), `coverage` (beats and hints), `screenplay` and `help` (the docs, written to the target folder), and
  `check` (fails on any error finding: NR-c). The audit is the platform's generic audit over the run's findings, as
  M6.6b's puzzle audit.
- NR-c; the SB-D6 hooks (automata-plus#28) are already in the bins, so the stages may import `narrative/tools` lazily
  as the other pipelines do.

Out:
- The cutscene audit (`audit.ts`: cameras, frames, props in frame) and the conversation audit (staging, rigs, poses):
  they need cutscenes and 3D staging, so they go with M6.9a/M6.9b (NR-D9).
- Delivery, portraits, the panel (M6.8c); the source's `readingTime` caption checks need cutscene timings (M6.9a).

## Decisions for the Owner's veto

- **NR-D7:** line length is checked only with a game's `measure`; the pipeline ships none (no `@napi-rs/canvas`).
- **NR-D8:** the source's fixed endings, Nurse lines and choice-box geometry become canon or options; nothing names
  the adventure's people in `narrative/tools`.
- **NR-D9:** "audit" in this row is the platform's generic audit of the narrative run; the cutscene and conversation
  audits move to M6.9 (they read cutscenes and staging).
- **NR-D10:** the text the lints read is the locale fixture's (NR-D1: a line's `text` is a key); a key with no locale
  text is an error finding.

## Steps

Each step: write the test, see it fail for the stated reason, write the minimum, see it pass.

1. `beats` and `help` content kinds; the converter adds the four scenes' beats and help. Fails: no schemas.
   - [x] 1
2. `lintNarrative` (the source's lint cases, re-pointed at locale text). Fails: no module.
   - [ ] 2
3. `lintDialogues` with NR-c (a dead end fails), and `lintDeck`. Fails: no module.
   - [ ] 3
4. `lintHelp`, `currentHint`. Fails: no module.
   - [ ] 4
5. Traces from solver routes; `beatCoverage`, `hintCheck`. Fails: no module.
   - [ ] 5
6. `screenplay` (byte-identical twice; the clinic's matches a committed fixture). Fails: no module.
   - [ ] 6
7. `automata pipe narrative` through the router and from the bin; `check` fails on NR-c's graph. Fails: not registered.
   - [ ] 7
8. Gates, provenance row (an AF docs PR), ready line.
   - [ ] 8

## Gates

- `pnpm format`, Plus `pnpm check`; `test:parity` for narrative (its golden must not move); pipelines' tests.
- No changeset (private).

## Follow-ups

- **Framework request (TR-D3, automata-plus#28):** build core's private `sector-format` to `dist` like the published
  packages, so a Plus bin need not strip its sources under `node_modules`.

## Execution log

- 2026-10-31: plan written from the M6 spec at framework main, Plus main `f64e0c4` and the adventure source at
  `92e6704`.
