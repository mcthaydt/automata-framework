import { type SystemsDef, systemsDefShape } from '@automata/systems/sim'
import { parse as strictParse } from 'smol-toml'
import { describe, expect, it } from 'vitest'
import { newAgent, newSystemsFile, systemsFileText } from '#src/features/schematic/starter.ts'
import { changeRuleText, changeTableListText, ruleTables } from '#src/features/schematic/table-list-text.ts'
import { fixture, fixtureText, puzzleFixture, puzzleText } from '../../fixtures/systems-fixtures.ts'

type Rule = SystemsDef['rules'][number]

const alarm: Rule = {
  id: 'alarm',
  text: 'The alarm rings.',
  every: 2,
  when: [{ fact: 'power', is: false }, { not: { fact: 'muted', is: true } }],
  then: [{ noise: { at: { x: 0, z: -6 }, loudness: 12, kind: 'alarm' } }, { set: 'rang', to: true }],
}

const empty = (): SystemsDef => newSystemsFile('hall', newAgent('guard'))

/** The file as the game reads it, after checking both readers agree on it. */
function strict(text: string): SystemsDef {
  const value = strictParse(text)
  expect(systemsDefShape.safeParse(value).success).toBe(true)
  return value as unknown as SystemsDef
}

describe('a world rule changed as text', () => {
  it('adds the first rule to a file with none, and the game reads it', () => {
    const text = systemsFileText(empty())
    const result = changeRuleText('hall.toml', text, { kind: 'add', next: alarm })
    if ('refused' in result) throw new Error(result.refused)
    expect(result.text).not.toMatch(/^rules = \[\]/m)
    expect(strict(result.text).rules).toEqual([alarm])
    expect(result.text.startsWith('# How this scene')).toBe(true)
  })

  it('adds another after the last, leaving every byte before it', () => {
    const text = fixtureText('prologue')
    const before = fixture('prologue').rules.length
    const result = changeRuleText('prologue.toml', text, { kind: 'add', next: alarm })
    if ('refused' in result) throw new Error(result.refused)
    const rules = strict(result.text).rules
    expect(rules).toHaveLength(before + 1)
    expect(rules[before]).toEqual(alarm)
    // Only the new rule's lines are new: take them out and the file is the one it was.
    expect(result.text.replace(`\n${ruleTables(alarm).join('\n')}`, '').replace(/\n\n\n+/g, '\n\n')).toBe(
      text.replace(/\n\n\n+/g, '\n\n'),
    )
  })

  it('takes a condition and an action out of a rule, keeping every other rule byte for byte', () => {
    const text = fixtureText('prologue')
    const def = fixture('prologue')
    const index = def.rules.findIndex((r) => r.id === 'lightsOut')
    const rule = def.rules[index] as Rule
    const next: Rule = { ...rule, when: rule.when.slice(1), then: rule.then.slice(1) }
    const result = changeRuleText('prologue.toml', text, { kind: 'replace', index, next })
    if ('refused' in result) throw new Error(result.refused)
    expect(strict(result.text).rules[index]).toEqual(next)
    const lines = text.split('\n')
    const lost = lines.length - result.text.split('\n').length
    expect(lost).toBeGreaterThan(0)
    expect(strict(result.text).rules.filter((_, i) => i !== index)).toEqual(
      def.rules.filter((_, i) => i !== index),
    )
  })

  it('writes a rule with nothing in it as empty lists the game accepts', () => {
    const text = fixtureText('prologue')
    const def = fixture('prologue')
    const index = def.rules.findIndex((r) => r.id === 'lightsOut')
    const rule = def.rules[index] as Rule
    const next: Rule = { ...rule, when: [], then: [] }
    const result = changeRuleText('prologue.toml', text, { kind: 'replace', index, next })
    if ('refused' in result) throw new Error(result.refused)
    expect(strict(result.text).rules[index]).toEqual(next)
  })

  it('removes a rule and the blank line that set it apart', () => {
    const text = fixtureText('prologue')
    const def = fixture('prologue')
    const result = changeRuleText('prologue.toml', text, { kind: 'remove', index: 0 })
    if ('refused' in result) throw new Error(result.refused)
    expect(strict(result.text).rules).toEqual(def.rules.slice(1))
    expect(result.text).not.toMatch(/\n\n\n\n/)
  })

  it('puts the empty list back when the last rule goes, so the file keeps its key', () => {
    const added = changeRuleText('hall.toml', systemsFileText(empty()), { kind: 'add', next: alarm })
    if ('refused' in added) throw new Error(added.refused)
    const result = changeRuleText('hall.toml', added.text, { kind: 'remove', index: 0 })
    if ('refused' in result) throw new Error(result.refused)
    expect(strict(result.text).rules).toEqual([])
    expect(result.text).toMatch(/^rules = \[\]/m)
  })

  it('refuses a rule that is not in the file, and writes nothing', () => {
    const text = systemsFileText(empty())
    expect(changeRuleText('hall.toml', text, { kind: 'remove', index: 3 })).toEqual({
      refused: 'That part of the file could not be found, so nothing was changed.',
    })
    expect(changeRuleText('hall.toml', text, { kind: 'replace', index: 0, next: alarm })).toHaveProperty(
      'refused',
    )
  })

  it('refuses a file that already has a mistake', () => {
    expect(changeRuleText('hall.toml', 'rules = [', { kind: 'add', next: alarm })).toEqual({
      refused: 'This file has a mistake, so it is read only until the mistake is fixed.',
    })
  })
})

describe('a puzzle’s lists changed as text', () => {
  const read = (text: string): ReturnType<typeof puzzleFixture> => {
    const value = strictParse(text)
    return value as unknown as ReturnType<typeof puzzleFixture>
  }

  it('gives an action a condition and an effect, and leaves every other action as it was', () => {
    const text = puzzleText('prologue')
    const def = puzzleFixture('prologue')
    const index = def.actions.findIndex((a) => (a.when ?? []).length > 0 && a.then.length > 0)
    const action = def.actions[index] as (typeof def.actions)[number]
    const next = {
      ...action,
      when: [...(action.when ?? []), { has: 'torch' }],
      then: [...action.then, { give: 'torch' }],
    }
    const result = changeTableListText('prologue.puzzle.toml', text, 'actions', {
      kind: 'replace',
      index,
      next,
    })
    if ('refused' in result) throw new Error(result.refused)
    const after = read(result.text)
    expect(after.actions[index]).toEqual(next)
    expect(after.actions.filter((_, i) => i !== index)).toEqual(def.actions.filter((_, i) => i !== index))
    expect(after.goal).toEqual(def.goal)
  })

  it('takes an action out and adds one at the end', () => {
    const text = puzzleText('prologue')
    const def = puzzleFixture('prologue')
    const removed = changeTableListText('p.toml', text, 'actions', { kind: 'remove', index: 0 })
    if ('refused' in removed) throw new Error(removed.refused)
    expect(read(removed.text).actions).toEqual(def.actions.slice(1))
    const added = changeTableListText('p.toml', removed.text, 'actions', {
      kind: 'add',
      next: { id: 'wave', at: 'floor', then: [{ set: 'waved', to: true }], say: 'You wave.' },
    })
    if ('refused' in added) throw new Error(added.refused)
    expect(read(added.text).actions.at(-1)?.id).toBe('wave')
    expect(read(added.text).actions).toHaveLength(def.actions.length)
  })

  it('changes the goal, a list of conditions some of which hold others', () => {
    const text = puzzleText('prologue')
    const def = puzzleFixture('prologue')
    const next = [...def.goal, { not: { fact: 'caught', is: true } }]
    let current = text
    for (const [i, cond] of next.entries()) {
      if (i < def.goal.length) continue
      const result = changeTableListText('p.toml', current, 'goal', { kind: 'add', next: cond })
      if ('refused' in result) throw new Error(result.refused)
      current = result.text
    }
    expect(read(current).goal).toEqual(next)
  })
})
