/**
 * A painted figure in a fogged view, under WebGL in Chromium (the same checks run under WebGPU in ../webgpu/): the cell is mixed toward
 * the fog's colour as beta.2 mixed an unlit colour, in display values (see ../../fixtures/view-fog.ts), whether the quad writes a
 * depth per texel (`StageView`) or not (`FigureSprite`).
 */
import { describe, it } from 'vitest'
import { expectSpriteFogged, expectStageFogged } from '../../fixtures/view-fog.ts'

describe('a painted figure in fog, under WebGL', () => {
  it('a stage quad is mixed toward the fog in display values', () => expectStageFogged('webgl'))
  it('a figure sprite is mixed toward the fog in display values', () => expectSpriteFogged('webgl'))
})
