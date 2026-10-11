import { expect, test } from 'vitest'
import manifest from '../../package.json' with { type: 'json' }
import * as testing from './index'

// The layout contract, for a game's own screens (M1.6 spec §7): the same checks the primitives
// pass, published as `@mcthaydt/automata-ui/testing` so a screen's `data-way-out` is checked too.
test.each(['checkLayout', 'publishConditions', 'byTestId', 'settleLayout'])('exports %s', (name) => {
  expect(testing).toHaveProperty(name)
})

test('is published as @mcthaydt/automata-ui/testing', () => {
  expect(manifest.exports['./testing']).toEqual({ default: './src/testing/index.ts' })
})
