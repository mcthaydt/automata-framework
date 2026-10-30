import { describe, expect, it } from 'vitest'
import { checkProject } from '../../profiles/level-project/project-checks'
import { platformerTemplate } from '../../profiles/level-project/templates/platformer'
import type { PatternCell, Rule, RuleGroup } from '../../tiles/autotile/rule.schema'
import { ruleSchema } from '../../tiles/autotile/rule.schema'
import { counterIds } from '../ids'
import type { Project } from '../project-types'
import {
  addRule,
  addRuleGroup,
  deleteRule,
  deleteRuleGroup,
  editRule,
  editRuleGroup,
  newRule,
  nextPatternCell,
  reorderRuleGroups,
  reorderRules,
  resizeRule,
  setPatternCell,
} from './rule-edits'

const platformer = (): Project => platformerTemplate.create(counterIds())
const groupsOf = (p: Project): readonly RuleGroup[] => {
  const ground = p.defs.layers.find((def) => def.id === 'ground')
  return ground?.kind === 'auto' ? ground.groups : []
}
const hazards = (p: Project): readonly Rule[] =>
  groupsOf(p).find((group) => group.id === 'hazards')?.rules ?? []
const ruleOf = (p: Project, id: string): Rule | undefined =>
  groupsOf(p)
    .flatMap((group) => group.rules)
    .find((rule) => rule.id === id)
const diagnostics = (p: Project): string[] =>
  checkProject(p, {})
    .filter((d) => d.severity !== 'info')
    .map((d) => d.code)

describe('nextPatternCell', () => {
  it('cycles any, empty, filled, is and not with the selected value', () => {
    const seen: PatternCell[] = []
    let cell: PatternCell = 'any'
    for (let i = 0; i < 5; i++) {
      cell = nextPatternCell(cell, 3)
      seen.push(cell)
    }
    expect(seen).toEqual(['empty', 'filled', { is: 3 }, { not: 3 }, 'any'])
  })

  it('turns an is into a not of the selected value, and any not back into any', () => {
    expect(nextPatternCell({ is: 1 }, 4)).toEqual({ not: 4 })
    expect(nextPatternCell({ not: 2 }, 4)).toBe('any')
  })
})

describe('newRule', () => {
  it('is a valid 3 × 3 rule with a filled centre, no output and the template defaults', () => {
    const rule = newRule('r1')
    expect(ruleSchema.safeParse(rule).success).toBe(true)
    expect(rule.pattern.filter((cell) => cell !== 'any')).toEqual(['filled'])
    expect(rule.pattern[4]).toBe('filled')
    expect(rule).toMatchObject({
      size: 3,
      tiles: [],
      chance: 1,
      breakOnMatch: true,
      outside: 'same',
      active: true,
    })
  })
})

describe('rule groups', () => {
  it('adds an active, empty group at the end', () => {
    const project = platformer()
    const next = addRuleGroup(project, 'ground', { id: 'extra', label: 'Extra' })
    expect(groupsOf(next).at(-1)).toEqual({ id: 'extra', label: 'Extra', active: true, rules: [] })
    expect(next.levels).toBe(project.levels)
  })

  it('refuses a group id the layer has, a bad id and a layer that is not an auto layer', () => {
    expect(() => addRuleGroup(platformer(), 'ground', { id: 'hazards', label: 'x' })).toThrow(/already/)
    expect(() => addRuleGroup(platformer(), 'ground', { id: 'Bad Id', label: 'x' })).toThrow(RangeError)
    expect(() => addRuleGroup(platformer(), 'collision', { id: 'x', label: 'x' })).toThrow(
      /not an auto layer/,
    )
    expect(() => addRuleGroup(platformer(), 'nothing', { id: 'x', label: 'x' })).toThrow(
      /no layer definition/,
    )
  })

  it('edits the label and switches a group off, and an edit to the same values is the same project', () => {
    const next = editRuleGroup(platformer(), 'ground', 'hazards', { label: 'Danger', active: false })
    expect(groupsOf(next)[1]).toMatchObject({ label: 'Danger', active: false })
    const project = platformer()
    expect(editRuleGroup(project, 'ground', 'hazards', { label: 'Hazards and water', active: true })).toBe(
      project,
    )
    expect(() => editRuleGroup(project, 'ground', 'nope', {})).toThrow(/no rule group "nope"/)
  })

  it('reorders and deletes groups', () => {
    const swapped = reorderRuleGroups(platformer(), 'ground', 1, 0)
    expect(groupsOf(swapped).map((group) => group.id)).toEqual(['hazards', 'terrain'])
    const project = platformer()
    expect(reorderRuleGroups(project, 'ground', 0, 0)).toBe(project)
    expect(() => reorderRuleGroups(project, 'ground', 0, 2)).toThrow(RangeError)
    const deleted = deleteRuleGroup(platformer(), 'ground', 'hazards')
    expect(groupsOf(deleted).map((group) => group.id)).toEqual(['terrain'])
    expect(() => deleteRuleGroup(project, 'ground', 'nope')).toThrow(RangeError)
  })
})

describe('addRule', () => {
  const lava: Rule = { ...newRule('lava'), size: 1, pattern: [{ is: 3 }], tiles: [52] }

  it('adds a rule at the end of a group, or at an index', () => {
    const atEnd = addRule(platformer(), 'ground', 'hazards', lava)
    expect(hazards(atEnd).map((rule) => rule.id)).toEqual(['spike', 'water', 'ladder', 'one-way', 'lava'])
    const first = addRule(platformer(), 'ground', 'hazards', lava, 0)
    expect(hazards(first)[0]?.id).toBe('lava')
    expect(diagnostics(atEnd)).toEqual(diagnostics(platformer()))
  })

  it('refuses a rule id used anywhere in the layer', () => {
    expect(() => addRule(platformer(), 'ground', 'hazards', { ...lava, id: 'ground-alone' })).toThrow(
      /already/,
    )
  })

  it('refuses a tile beyond the tileset and values the source layer does not define', () => {
    expect(() => addRule(platformer(), 'ground', 'hazards', { ...lava, tiles: [64] })).toThrow(/tile 64/)
    expect(() => addRule(platformer(), 'ground', 'hazards', { ...lava, pattern: [{ is: 9 }] })).toThrow(
      /value 9/,
    )
    expect(() => addRule(platformer(), 'ground', 'hazards', { ...lava, pattern: [{ not: 9 }] })).toThrow(
      /value 9/,
    )
    expect(() => addRule(platformer(), 'ground', 'hazards', { ...lava, outside: 9 })).toThrow(/value 9/)
    expect(addRule(platformer(), 'ground', 'hazards', { ...lava, outside: 0 })).not.toBe(platformer())
  })

  it('refuses a shape the rule schema refuses and an index outside the group', () => {
    expect(() => addRule(platformer(), 'ground', 'hazards', { ...lava, size: 3 })).toThrow(/pattern/)
    expect(() => addRule(platformer(), 'ground', 'hazards', { ...lava, chance: 2 })).toThrow(RangeError)
    expect(() => addRule(platformer(), 'ground', 'hazards', lava, 5)).toThrow(RangeError)
    expect(() => addRule(platformer(), 'ground', 'nope', lava)).toThrow(/no rule group/)
  })
})

describe('editRule', () => {
  it('changes the outputs, chance, flips, break, outside and whether it is on', () => {
    const next = editRule(platformer(), 'ground', 'spike', {
      tiles: [47, 52],
      chance: 0.5,
      flipX: true,
      flipY: true,
      breakOnMatch: true,
      outside: 'same',
      active: false,
    })
    expect(ruleOf(next, 'spike')).toMatchObject({
      tiles: [47, 52],
      chance: 0.5,
      flipX: true,
      flipY: true,
      breakOnMatch: true,
      outside: 'same',
      active: false,
    })
    expect(ruleOf(next, 'spike')?.pattern).toEqual([{ is: 3 }])
  })

  it('changes a rule whose one flip alone differs', () => {
    const project = platformer()
    expect(ruleOf(editRule(project, 'ground', 'spike', { flipY: true }), 'spike')?.flipY).toBe(true)
    expect(ruleOf(editRule(project, 'ground', 'spike', { flipX: true }), 'spike')?.flipX).toBe(true)
  })

  it('returns the same project for the values the rule has', () => {
    const project = platformer()
    expect(editRule(project, 'ground', 'spike', { tiles: [47], chance: 1, outside: 0 })).toBe(project)
    expect(editRule(project, 'ground', 'spike', {})).toBe(project)
  })

  it('refuses a chance outside 0 to 1, a tile beyond the tileset and an unknown rule', () => {
    expect(() => editRule(platformer(), 'ground', 'spike', { chance: -0.1 })).toThrow(RangeError)
    expect(() => editRule(platformer(), 'ground', 'spike', { tiles: [99] })).toThrow(/tile 99/)
    expect(() => editRule(platformer(), 'ground', 'spike', { outside: 7 })).toThrow(/value 7/)
    expect(() => editRule(platformer(), 'ground', 'nope', { chance: 1 })).toThrow(/no rule "nope"/)
  })
})

describe('resizeRule', () => {
  it('grows a pattern around its centre and shrinks it back', () => {
    const grown = resizeRule(platformer(), 'ground', 'spike', 3)
    expect(ruleOf(grown, 'spike')?.size).toBe(3)
    expect(ruleOf(grown, 'spike')?.pattern).toEqual([
      'any',
      'any',
      'any',
      'any',
      { is: 3 },
      'any',
      'any',
      'any',
      'any',
    ])
    const five = resizeRule(grown, 'ground', 'spike', 5)
    expect(ruleOf(five, 'spike')?.pattern[12]).toEqual({ is: 3 })
    expect(ruleOf(five, 'spike')?.pattern.filter((cell) => cell !== 'any')).toHaveLength(1)
    const back = resizeRule(five, 'ground', 'spike', 1)
    expect(ruleOf(back, 'spike')).toEqual(ruleOf(platformer(), 'spike'))
  })

  it('drops the outer ring and keeps each cell in its place relative to the centre', () => {
    const grown = resizeRule(platformer(), 'ground', 'spike', 5)
    let edited = grown
    // The cell right of the centre in 5 × 5 (row 2, column 3) and a corner (row 0, column 0).
    edited = setPatternCell(edited, 'ground', 'spike', 13, 'empty')
    edited = setPatternCell(edited, 'ground', 'spike', 0, 'filled')
    const three = resizeRule(edited, 'ground', 'spike', 3)
    expect(ruleOf(three, 'spike')?.pattern).toEqual([
      'any',
      'any',
      'any',
      'any',
      { is: 3 },
      'empty',
      'any',
      'any',
      'any',
    ])
  })

  it('returns the same project for the size the rule has', () => {
    const project = platformer()
    expect(resizeRule(project, 'ground', 'spike', 1)).toBe(project)
  })
})

describe('setPatternCell', () => {
  it('sets one cell, row-major from the top left', () => {
    const grown = resizeRule(platformer(), 'ground', 'spike', 3)
    const next = setPatternCell(grown, 'ground', 'spike', 1, { not: 1 })
    expect(ruleOf(next, 'spike')?.pattern.slice(0, 3)).toEqual(['any', { not: 1 }, 'any'])
    expect(diagnostics(next)).toEqual(diagnostics(platformer()))
  })

  it('returns the same project for the cell it holds', () => {
    const project = platformer()
    expect(setPatternCell(project, 'ground', 'spike', 0, { is: 3 })).toBe(project)
    const empty = setPatternCell(project, 'ground', 'spike', 0, 'empty')
    expect(setPatternCell(empty, 'ground', 'spike', 0, 'empty')).toBe(empty)
    const not = setPatternCell(project, 'ground', 'spike', 0, { not: 3 })
    expect(setPatternCell(not, 'ground', 'spike', 0, { not: 3 })).toBe(not)
    expect(setPatternCell(not, 'ground', 'spike', 0, { not: 1 })).not.toBe(not)
    expect(setPatternCell(project, 'ground', 'spike', 0, { not: 3 })).not.toBe(project)
  })

  it('refuses an index outside the pattern and a value the source layer does not define', () => {
    expect(() => setPatternCell(platformer(), 'ground', 'spike', 1, 'any')).toThrow(RangeError)
    expect(() => setPatternCell(platformer(), 'ground', 'spike', 0, { is: 6 })).toThrow(/value 6/)
  })
})

describe('reorderRules and deleteRule', () => {
  it('moves a rule within its group', () => {
    const next = reorderRules(platformer(), 'ground', 'hazards', 3, 0)
    expect(hazards(next).map((rule) => rule.id)).toEqual(['one-way', 'spike', 'water', 'ladder'])
    const project = platformer()
    expect(reorderRules(project, 'ground', 'hazards', 1, 1)).toBe(project)
    expect(() => reorderRules(project, 'ground', 'hazards', 4, 0)).toThrow(RangeError)
  })

  it('deletes a rule and throws for one that does not exist', () => {
    const next = deleteRule(platformer(), 'ground', 'water')
    expect(hazards(next).map((rule) => rule.id)).toEqual(['spike', 'ladder', 'one-way'])
    expect(() => deleteRule(platformer(), 'ground', 'water-2')).toThrow(/no rule/)
  })

  it('leaves the other groups and the other layers as they were', () => {
    const project = platformer()
    const next = deleteRule(project, 'ground', 'water')
    expect(groupsOf(next)[0]).toBe(groupsOf(project)[0])
    expect(next.defs.layers[3]).toBe(project.defs.layers[3])
    expect(next.levels).toBe(project.levels)
  })
})
