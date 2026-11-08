import { expect, test } from 'vitest'
import * as testing from '#src/testing/ui/index.ts'
import manifest from '../../../../package.json' with { type: 'json' }

// The layout contract, for a game's own screens (M1.6 spec §7): the same checks the primitives
// pass, published as `@mcthaydt/automata/testing` so a screen's `data-way-out` is checked too.
test.each(['checkLayout', 'publishConditions', 'TOUCH_TARGETS', 'byTestId', 'settleLayout'])(
  'exports %s',
  (name) => {
    expect(testing).toHaveProperty(name)
  },
)

test('is published as @mcthaydt/automata/testing', () => {
  expect(manifest.exports['./testing']).toBe('./src/entries/testing.ts')
})
