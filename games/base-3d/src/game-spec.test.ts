import { cameraHeadingPlugin } from '@mcthaydt/automata-render-pixi3d/sim'
import { describe, expect, it } from 'vitest'
import { base3d } from '../game.ts'
import { BASE3D_SIM, base3dPlugin } from './state.ts'

// Node only: the game module's imports include Node-side code the browsers project does not load.
describe('the defined game', () => {
  it('takes the heading from render3dExtension, not from the game’s own list (RT.EXT1)', () => {
    expect(BASE3D_SIM.plugins).toEqual([base3dPlugin])
    expect(base3d.sim.plugins).toEqual([base3dPlugin, cameraHeadingPlugin])
  })
})
