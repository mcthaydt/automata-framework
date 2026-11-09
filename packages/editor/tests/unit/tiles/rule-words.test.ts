import { describe, expect, it } from 'vitest'
import { cellWords, ruleTitle } from '#src/features/tiles/rule-words.ts'

// Build audit G2: a rule is named in words, never `ground-n-e`, and a pattern cell says what it needs in words.
describe('ruleTitle', () => {
  it('reads a template rule as the ground and where it joins', () => {
    expect(ruleTitle('ground-n-e')).toBe('Ground, joined above and to the right')
    expect(ruleTitle('ground-n-e-s-w-ne')).toBe(
      'Ground, joined above, to the right, below, to the left and above right',
    )
    expect(ruleTitle('wall-s')).toBe('Wall, joined below')
    expect(ruleTitle('ground-alone')).toBe('Ground, on its own')
  })

  it('shows a rule the person made as its words', () => {
    expect(ruleTitle('spike')).toBe('Spike')
    expect(ruleTitle('top-edge-grass')).toBe('Top edge grass')
  })
})

describe('cellWords', () => {
  it('says each kind of cell in plain words', () => {
    expect(cellWords('any')).toBe('anything')
    expect(cellWords('empty')).toBe('nothing')
    expect(cellWords('filled')).toBe('something')
    expect(cellWords('is', 'solid')).toBe('only solid')
    expect(cellWords('not', 'water')).toBe('anything but water')
  })
})
