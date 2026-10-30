import { cameraHeadingPlugin } from '@mcthaydt/automata-render-pixi3d/sim'
import { describe, expect, it, vi } from 'vitest'
import { FIRST_SLICE } from './content/first-slice.ts'
import { base3dPlugin, base3dSim } from './state.ts'
import { compileArea } from './systems.ts'

// `startGame` spied on, so importing the page entry shows whether it starts the game (GL spec §4.6).
const started = vi.hoisted(() => ({ calls: 0 }))
vi.mock('@mcthaydt/automata-game', async (original) => ({
  ...(await original<typeof import('@mcthaydt/automata-game')>()),
  startGame: () => {
    started.calls++
  },
}))
const { base3d } = await import('./main.ts')

// Node only: the game module's imports include Node-side code the browsers project does not load.
describe('the defined game', () => {
  it('takes the heading from render3dExtension, not from the game’s own list (RT.EXT1)', () => {
    expect(base3dSim(compileArea(FIRST_SLICE)).plugins).toEqual([base3dPlugin])
    expect(base3d.sim.plugins).toEqual([base3dPlugin, cameraHeadingPlugin])
  })
  it('is defined, not started, when a test imports the page entry', () => {
    expect(base3d.id).toBe('base-3d')
    expect(started.calls).toBe(0)
  })
})
