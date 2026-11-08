import { checkSystems, type SystemsDef } from '@automata/systems/sim'
import { describe, expect, it } from 'vitest'
import { namesOf } from '#src/features/schematic/names.ts'
import { ruleActions, ruleConditions } from '#src/features/schematic/rule-menu.ts'
import { fixture } from '../../fixtures/systems-fixtures.ts'

const def: SystemsDef = fixture('prologue')
const names = { ...namesOf(def, -1), modes: [...new Set(def.agents.flatMap((a) => a.modes))] }

/** What the game's own checks say about a world rule holding just this one piece. */
function ruleProblems(piece: { when?: unknown[]; then?: unknown[] }): string[] {
  const found: string[] = []
  const rule = { id: 'probe', text: 'probe', when: piece.when ?? [], then: piece.then ?? [] }
  const probe = { ...def, rules: [rule] } as unknown as SystemsDef
  checkSystems(probe, { hooks: [] }, (path, message) => {
    if (path[0] === 'rules') found.push(message)
  })
  return found
}

describe('what a world rule may use', () => {
  it('offers no condition that needs a character to ask it, and every one it offers passes the game’s checks', () => {
    const kinds = ruleConditions(def, names).map((piece) => piece.kind)
    expect(kinds).not.toContain('sees')
    expect(kinds).not.toContain('idle')
    expect(kinds).not.toContain('blocked')
    expect(kinds).not.toContain('own')
    expect(kinds).toContain('fact')
    for (const piece of ruleConditions(def, names)) {
      expect(ruleProblems({ when: [piece.fresh(names)] }), piece.kind).toEqual([])
    }
  })

  it('offers no action that moves a character, and every one it offers passes the game’s checks', () => {
    const kinds = ruleActions(def, names).map((piece) => piece.kind)
    expect(kinds).not.toContain('goTo')
    expect(kinds).not.toContain('flee')
    expect(kinds).not.toContain('followThrough')
    expect(kinds).toContain('noise')
    expect(kinds).toContain('set')
    for (const piece of ruleActions(def, names)) {
      expect(ruleProblems({ then: [piece.fresh(names)] }), piece.kind).toEqual([])
    }
  })

  it('names whose mode a world rule means, so “is in a mode” and “switch to a mode” stay on the menu', () => {
    const kinds = ruleConditions(def, names).map((piece) => piece.kind)
    expect(kinds).toContain('mode')
    expect(ruleActions(def, names).map((piece) => piece.kind)).toContain('setMode')
  })
})
