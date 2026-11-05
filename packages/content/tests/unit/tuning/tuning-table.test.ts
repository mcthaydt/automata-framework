import { describe, expect, it } from 'vitest'
import { checkTuning } from '#src/features/tuning/check-tuning.ts'
import { renderTuningTable, withTuningTable } from '#src/features/tuning/tuning-table.ts'
import { TUNABLE_DEFAULTS, TUNABLES } from '#src/testing/fixture-game.ts'

// Ported from FloorFifty tests/content/compiler.test.ts "the author guide" (122a220).
const meta = checkTuning(TUNABLE_DEFAULTS, { tunables: TUNABLES }).meta

describe('renderTuningTable', () => {
  it('renders each tunable once in sorted order', () => {
    const table = renderTuningTable(meta)
    expect(table.match(/COURSE_FLOOR_COUNT/g)).toHaveLength(1)
    expect(table.indexOf('BOUNCE_VELOCITY')).toBeLessThan(table.indexOf('COURSE_FLOOR_COUNT'))
    expect(table).toContain('| `GRAVITY` | float | -1200 to -100 | -275 |')
  })

  it('marks a tunable without a range', () => {
    expect(renderTuningTable({ LABEL: { type: 'string', value: 'x' } })).toContain(
      '| `LABEL` | string | none | x |',
    )
  })
})

describe('withTuningTable', () => {
  const guide = 'intro\n<!-- BEGIN GENERATED TUNABLES -->\nold\n<!-- END GENERATED TUNABLES -->\noutro\n'

  it('replaces only the text between the markers', () => {
    const next = withTuningTable(guide, meta)
    expect(next?.startsWith('intro\n<!-- BEGIN GENERATED TUNABLES -->\n\n| Name |')).toBe(true)
    expect(next?.endsWith('|\n\n<!-- END GENERATED TUNABLES -->\noutro\n')).toBe(true)
    expect(withTuningTable(next ?? '', meta)).toBe(next)
  })

  it('reports a guide without markers', () => {
    expect(withTuningTable('no markers', meta)).toBeUndefined()
  })
})
