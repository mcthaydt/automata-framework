// `lintDialogues`, from the original's dialogue lint cases on toy graphs: a dead branch, a graph that
// does not reconverge, a stance out of range. The voice rules and the choice box are the game's, so each case
// passes them as options.
import { describe, expect, it } from 'vitest'
import type { Canon, DialogueGraph, DialogueNode } from '#src/entries/sim.ts'
import { type DialogueRules, lintDialogues } from '#src/features/tools/dialogue-lint.ts'
import { fixture, SCENES } from '#src/testing/converted-narrative.ts'
import { CANON, RECORDS, rec, TALK, TEXT, withLines } from '#src/testing/toy-dialogue.ts'

const RULES: DialogueRules = {
  player: 'ada',
  quiet: ['ada'],
  only: { nurse: ['nurse.power', 'nurse.last'] },
  maxStep: 2,
}
const lint = (graphs: DialogueGraph[], lines = { records: RECORDS, text: TEXT }, rules = RULES) =>
  lintDialogues({ canon: CANON, graphs, ...lines, rules })
const errors = (graphs: DialogueGraph[], lines = { records: RECORDS, text: TEXT }, rules = RULES) =>
  lint(graphs, lines, rules)
    .filter((f) => f.level === 'error')
    .map((f) => `${f.rule} ${f.id}`)

describe('the converted scenes', () => {
  it('have no dialogue lint error', () => {
    const canon = fixture('canon.toml') as unknown as Canon
    for (const scene of SCENES) {
      const graphs = (fixture(`${scene}.dialogue.toml`) as { graphs: DialogueGraph[] }).graphs
      const records = (fixture(`${scene}.lines.toml`) as { lines: typeof RECORDS }).lines
      const text = fixture(`${scene}.locale.toml`) as Record<string, string>
      const found = lintDialogues({ canon, graphs, records, text, rules: { player: 'ada', quiet: ['ada'] } })
      expect(
        found.filter((f) => f.level === 'error'),
        scene,
      ).toEqual([])
    }
  })
})

describe('lintDialogues', () => {
  it('passes a graph that reconverges', () => {
    expect(lint([TALK])).toEqual([])
  })
  it('fails a dead branch: a node that cannot reach the exit', () => {
    const open = TALK.nodes.open as DialogueNode
    const g: DialogueGraph = {
      ...TALK,
      nodes: {
        ...TALK.nodes,
        open: {
          ...open,
          choices: [...(open.choices ?? []).slice(0, 2), { line: 'toy.yours', next: 'loop' }],
        },
        loop: {
          say: ['toy.warm'],
          choices: [
            { line: 'toy.duty', next: 'loop' },
            { line: 'toy.unsure', next: 'loop' },
          ],
        },
      },
    }
    expect(errors([g])).toEqual(['reconverge meet/loop'])
    expect(lint([g]).find((f) => f.rule === 'reconverge')?.detail).toContain('dead end')
  })
  it('fails a graph with no exit: the conversation never ends', () => {
    const g: DialogueGraph = {
      id: 'g',
      speaker: 'porter',
      start: 'a',
      nodes: { a: { say: ['toy.ask'], next: 'b' }, b: { say: ['toy.hello'], next: 'a' } },
    }
    expect(errors([g])).toEqual(['exit g'])
  })
  it('fails a graph that does not reconverge: two exits', () => {
    const open = TALK.nodes.open as DialogueNode
    const g: DialogueGraph = {
      ...TALK,
      nodes: {
        ...TALK.nodes,
        open: {
          ...open,
          choices: [...(open.choices ?? []).slice(0, 2), { line: 'toy.yours', next: 'away' }],
        },
        away: { say: ['toy.ask'] },
      },
    }
    expect(errors([g])).toEqual(['exit meet'])
  })
  it('finds unreachable nodes, unknown lines, and a gated node with nowhere to pass over to', () => {
    const g: DialogueGraph = {
      id: 'g',
      speaker: 'porter',
      start: 'a',
      nodes: {
        a: { say: ['toy.nope'], next: 'b' },
        b: { say: ['toy.bye'], when: [{ fact: 'x' }] },
        orphan: { say: ['toy.hello'], next: 'b' },
      },
    }
    expect(errors([g]).sort()).toEqual(['gate g/b', 'line g/a', 'unreachable g/orphan'])
    expect(
      errors([{ id: 'h', speaker: 'porter', start: 'a', nodes: { a: { say: [], next: 'zz' } } }]),
    ).toContain('node h/a')
  })
  it('fails a graph id used twice', () => {
    expect(errors([TALK, TALK])).toEqual(['graph meet'])
  })
  it('finds a stance out of bounds or not whole, too many or too few choices, and stance set as a fact', () => {
    const g: DialogueGraph = {
      id: 'g',
      speaker: 'porter',
      start: 'a',
      nodes: {
        a: {
          say: ['toy.ask'],
          choices: [
            { line: 'toy.duty', stance: -3, next: 'b' },
            { line: 'toy.unsure', stance: 0.5, next: 'b' },
            { line: 'toy.yours', set: { stance: 4 }, next: 'b' },
            { line: 'toy.yours', next: 'b' },
          ],
        },
        b: { say: ['toy.hello'], choices: [{ line: 'toy.duty', next: 'c' }] },
        c: { say: ['toy.bye'] },
      },
    }
    expect(errors([g])).toEqual([
      'choices g/a',
      'stance g/a:toy.duty',
      'stance g/a:toy.unsure',
      'stance g/a:toy.yours',
      'choices g/b',
    ])
  })
  it('bounds a choice by the canon’s stance axis when the game sets no step', () => {
    const g: DialogueGraph = {
      ...TALK,
      nodes: {
        ...TALK.nodes,
        open: {
          say: ['toy.ask'],
          choices: [
            { line: 'toy.duty', stance: 9, next: 'join' },
            { line: 'toy.unsure', stance: -4, next: 'join' },
          ],
        },
      },
    }
    expect(errors([g], undefined, { player: 'ada' })).toEqual(['stance meet/open:toy.duty'])
  })
  it('keeps the voices: choices are the player’s, no exclamation marks, a restricted speaker says only her lines', () => {
    const lines = withLines(
      rec('toy.shout', 'ada', 'Wait!'),
      rec('toy.nurse.power', 'nurse', 'If you go, who sits up with her?'),
      rec('toy.nurse.extra', 'nurse', 'Back to sleep.'),
    )
    const g: DialogueGraph = {
      id: 'g',
      speaker: 'porter',
      start: 'a',
      nodes: {
        a: {
          say: ['toy.shout'],
          choices: [
            { line: 'toy.hello', next: 'b' },
            { line: 'toy.duty', next: 'b' },
          ],
        },
        b: { say: ['toy.bye'] },
      },
    }
    expect(errors([g], lines).sort()).toEqual(['voice toy.hello', 'voice toy.nurse.extra', 'voice toy.shout'])
  })
  it('fits a choice in the game’s choice box, with a measure', () => {
    const long = rec(
      'toy.long',
      'ada',
      'I was on duty, and I was asleep, and I do not remember which of the two it was that night at the desk.',
    )
    const g: DialogueGraph = {
      id: 'g',
      speaker: 'porter',
      start: 'a',
      nodes: {
        a: {
          say: ['toy.ask'],
          choices: [
            { line: 'toy.long', next: 'b' },
            { line: 'toy.duty', next: 'b' },
          ],
        },
        b: { say: ['toy.bye'] },
      },
    }
    const rules: DialogueRules = {
      ...RULES,
      choiceBox: { width: 200, font: '8px Kit', lines: 2, prefix: '◆ 3. ' },
    }
    const measure = (text: string) => text.length * 5
    const found = lintDialogues({ canon: CANON, graphs: [g], ...withLines(long), rules, measure })
    expect(found.filter((f) => f.rule === 'length').map((f) => f.id)).toEqual(['toy.long'])
    // Without a measure the length is not checked.
    expect(lintDialogues({ canon: CANON, graphs: [g], ...withLines(long), rules })).toEqual([])
  })
  it('warns about a graph no puzzle action starts', () => {
    const found = lintDialogues({
      canon: CANON,
      graphs: [TALK],
      records: RECORDS,
      text: TEXT,
      started: new Set(),
    })
    expect(found.map((f) => `${f.level} ${f.rule}`)).toEqual(['warning started'])
  })
})
