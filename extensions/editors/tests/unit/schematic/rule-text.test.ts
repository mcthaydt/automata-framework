import { type SystemsDef, systemsDefShape } from '@automata/systems/sim'
import { parse as strictParse } from 'smol-toml'
import { describe, expect, it } from 'vitest'
import { changeRuleText, ruleTables } from '#src/features/schematic/rule-text.ts'
import { newAgent, newSystemsFile, systemsFileText } from '#src/features/schematic/starter.ts'
import { fixture, fixtureText } from '../../fixtures/systems-fixtures.ts'

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
