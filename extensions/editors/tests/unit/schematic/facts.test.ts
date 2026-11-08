import type { SysEffect } from '@automata/systems/sim'
import { describe, expect, it } from 'vitest'
import { sceneNames } from '#src/features/schematic/names.ts'
import { ACTIONS } from '#src/features/schematic/pieces/actions.ts'
import { CONDITION_MENU, CONDITIONS } from '#src/features/schematic/pieces/conditions.ts'
import { NEW_FACT, NO_NAMES } from '#src/features/schematic/pieces/piece.ts'
import { fixture } from '../../fixtures/systems-fixtures.ts'

// A fact is what the puzzle and the characters agree on. A character can only react to the puzzle's `lamp` if the
// switch offers it, and can only make up a fact of its own through "a new fact…".

const def = fixture('prologue')
const session = (puzzleFacts: string[]) =>
  ({
    def,
    places: undefined,
    puzzleDef: { facts: Object.fromEntries(puzzleFacts.map((f) => [f, false])) },
  }) as never

describe('the facts a switch can choose from', () => {
  it("are the puzzle's first, then the file's, once each", () => {
    const names = sceneNames(session(['lamp', 'alarm']), 0)
    expect(names?.facts.slice(0, 2)).toEqual(['lamp', 'alarm'])
    expect(new Set(names?.facts).size).toBe(names?.facts.length)
  })

  it('are the file’s alone when the scene has no puzzle', () => {
    const names = sceneNames({ def, places: undefined, puzzleDef: undefined } as never, 0)
    expect(names?.facts).not.toContain('lamp')
  })
})

describe('the doorways a follow can use', () => {
  it('are the ones the file already follows, besides the one just used', () => {
    const withFollow = {
      ...def,
      agents: [
        {
          ...def.agents[0],
          transitions: [
            {
              from: 'a',
              to: 'b',
              when: [],
              priority: 1,
              do: [{ followThrough: { portal: 'hall>yard', delay: 1, then: 'hunt' } }],
            },
            {
              from: 'b',
              to: 'a',
              when: [],
              priority: 1,
              do: [{ followThrough: { portal: 'crossed', delay: 1, then: 'hunt' } }],
            },
          ],
        },
        ...def.agents.slice(1),
      ],
    }
    expect(
      sceneNames({ def: withFollow, places: undefined, puzzleDef: undefined } as never, 0)?.doorways,
    ).toEqual(['hall>yard'])
  })
})

describe('the condition menu', () => {
  it('has no "not …" kind: Not is the button on each condition', () => {
    expect(CONDITION_MENU.map((piece) => piece.kind)).not.toContain('not')
    expect(CONDITION_MENU.length).toBe(CONDITIONS.length - 1)
  })
})

describe('"a new fact…"', () => {
  const fact = CONDITIONS.find((piece) => piece.kind === 'fact') as (typeof CONDITIONS)[number]
  const names = { ...NO_NAMES, facts: ['lamp'] }

  it('is the last choice of a condition, and picking it adds a fact that waits for a name', () => {
    const value = { fact: 'lamp', is: true }
    const [choice] = fact.fields(value as never, names)
    expect(choice?.kind === 'choice' && choice.options.at(-1)).toEqual({
      value: NEW_FACT,
      label: 'a new fact…',
    })
    const next = fact.write(value as never, 'fact', NEW_FACT) as { fact: string }
    expect(next.fact).toBe('new-fact')
    expect(fact.fields(next as never, names).map((f) => f.label)).toContain('Name it')
  })

  it('takes the name the person types, and then asks no more', () => {
    const named = fact.write({ fact: 'new-fact', is: true } as never, 'fact.name', ' door open ')
    expect((named as { fact: string }).fact).toBe('door open')
    expect(fact.fields(named, names).map((f) => f.label)).not.toContain('Name it')
  })

  it('is also the last choice of an action', () => {
    const set = ACTIONS.find((piece) => piece.kind === 'set') as (typeof ACTIONS)[number]
    const value: SysEffect = { set: 'lamp', to: true }
    const [choice] = set.fields(value, names)
    expect(choice?.kind === 'choice' && choice.options.at(-1)?.value).toBe(NEW_FACT)
    expect((set.write(value, 'set', NEW_FACT) as { set: string }).set).toBe('new-fact')
  })
})
