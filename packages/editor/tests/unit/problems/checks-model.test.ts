import { describe, expect, it } from 'vitest'
import { checkGroups, fixLabel, objectLabel } from '#src/features/problems/checks-model.ts'
import type { Diagnostic } from '#src/shared/level-2d/profiles/profile.ts'

const finding = (
  severity: Diagnostic['severity'],
  code: string,
  message = code,
  fix?: string,
): Diagnostic => ({
  severity,
  code,
  path: `levels[level-1].layers[${code}]`,
  message,
  fix,
})

describe('checkGroups', () => {
  it('groups the findings into Errors, Warnings and Info with counts, keeping the profile order inside each', () => {
    const found = [
      finding('error', 'a'),
      finding('warning', 'b'),
      finding('error', 'c'),
      finding('info', 'd'),
    ]
    expect(
      checkGroups(found).map(({ severity, label, rows }) => [severity, label, rows.map((row) => row.code)]),
    ).toEqual([
      ['error', 'Errors (2)', ['a', 'c']],
      ['warning', 'Warnings (1)', ['b']],
      ['info', 'Info (1)', ['d']],
    ])
  })

  it('leaves out a severity with no findings, and has no groups when nothing is found', () => {
    expect(checkGroups([finding('warning', 'b')]).map((group) => group.severity)).toEqual(['warning'])
    expect(checkGroups([])).toEqual([])
  })
})

describe('fixLabel', () => {
  it('counts what a removal clears from the message', () => {
    expect(
      fixLabel(finding('error', 'tileOutOfRange', '3 cells use tiles beyond the 64 tiles', 'remove')),
    ).toBe('Remove 3 stray tiles')
    expect(
      fixLabel(finding('error', 'tileOutOfRange', '1 cell uses tiles beyond the 64 tiles', 'remove')),
    ).toBe('Remove 1 stray tile')
    expect(fixLabel(finding('error', 'tileOutOfRange', '2 objects use tiles beyond', 'remove'))).toBe(
      'Remove 2 objects',
    )
    expect(fixLabel(finding('error', 'cellValueUnknown', '1 cell holds a value', 'remove'))).toBe(
      'Remove 1 cell',
    )
  })

  it('names the other repairs, and none when the finding has no fix', () => {
    expect(fixLabel(finding('warning', 'entityOutOfBounds', 'x', 'move-inside'))).toBe('Move inside')
    expect(fixLabel(finding('error', 'unknownEntityDef', 'x', 'delete'))).toBe('Delete anyway')
    expect(fixLabel(finding('error', 'brokenRef', 'x', 'choose-target'))).toBe('Choose target')
    expect(fixLabel(finding('error', 'layerOrder', 'x', 'reorder-layers'))).toBe('Reorder layers')
    expect(fixLabel(finding('error', 'noFix'))).toBeUndefined()
  })
})

describe('objectLabel', () => {
  it('names the object a path points at', () => {
    expect(objectLabel('levels[moss-steps].layers[entities].items[slime-2]')).toBe('slime-2 in moss-steps')
    expect(objectLabel('levels[level-1].layers[entities].items[door-1].fields.target')).toBe(
      'door-1 in level-1',
    )
    expect(objectLabel('levels[level-1].layers[decor]')).toBe('Layer decor in level-1')
    expect(objectLabel('levels[level-1]')).toBe('Level level-1')
    expect(objectLabel('defs.tilesets[terrain]')).toBe('Tileset terrain')
    expect(objectLabel('defs.entities[slime].fields[hp]')).toBe('Entity slime')
    expect(objectLabel('defs.layers[ground].groups[terrain].rules[a]')).toBe('Layer ground')
    expect(objectLabel('worlds[main].placements[ghost]')).toBe('World main')
    expect(objectLabel('theme.backdropAlias')).toBe('theme.backdropAlias')
  })
})
