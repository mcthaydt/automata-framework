// The panel's screen filter on a real WebGL2 renderer (the scene and the check are screen-support.ts's).
import { describe, expect, it } from 'vitest'
import { expectLinesOnTexelBorders, shot, start } from './screen-support.ts'

describe('the panel as a screen filter', () => {
  it('puts every mesh line and scanline on a texel border under WebGL2', async () => {
    const renderer = await start('webgl')
    expect(renderer.stage.screenFilters.ids).toEqual(['lcd-panel-screen'])
    shot(renderer)
    expectLinesOnTexelBorders(shot(renderer))
  })
})
