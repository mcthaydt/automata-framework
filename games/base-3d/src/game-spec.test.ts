import { cameraHeadingPlugin } from '@automataframework/automata-render-pixi3d/sim'
import { describe, expect, it, vi } from 'vitest'
import { ROOM } from './content/room.ts'
import { base3dPlugin, base3dSim } from './state/index.ts'
import { compileArea } from './systems/index.ts'

// `startGame` spied on, so importing the page entry shows whether it starts the game (GL spec §4.6).
const started = vi.hoisted(() => ({ calls: 0 }))
vi.mock('@automataframework/automata', async (original) => ({
  ...(await original<typeof import('@automataframework/automata')>()),
  startGame: () => {
    started.calls++
  },
}))
const { base3d, input } = await import('./main.ts')
const KEY_TURN_UNITS = 364

// Node only: the game module's imports include Node-side code the browsers project does not load.
describe('the defined game', () => {
  it('takes the heading from render3dExtension, not from the game’s own list (RT.EXT1)', () => {
    expect(base3dSim(compileArea(ROOM)).plugins).toEqual([base3dPlugin])
    expect(base3d.sim.plugins).toEqual([base3dPlugin, cameraHeadingPlugin])
  })
  it('is defined, not started, when a test imports the page entry', () => {
    expect(base3d.id).toBe('base-3d')
    expect(started.calls).toBe(0)
  })
})

describe('the key map', () => {
  /** This tick's commands with `codes` held, by command id. */
  const held = (...codes: string[]) => {
    const actions = Object.entries(input.profile.bindings)
      .filter(([, binding]) => binding.keys.some((code) => codes.includes(code)))
      .map(([id]) => id)
    return Object.fromEntries(input.toCommand(actions, 4).map((command) => [command.type, command.payload]))
  }

  it('sends the move, the camera turn and the roll button every tick, idle with nothing held', () => {
    expect(held()).toEqual({ move: { x: 0, y: 0 }, 'camera-turn': { units: 0 }, act: { roll: false } })
  })

  it('maps WASD and the arrows to the stick’s edge, Q and E to a 120° a second turn, Space and K to the roll', () => {
    expect(held('KeyW', 'KeyD')).toMatchObject({ move: { x: 127, y: -127 } })
    expect(held('ArrowDown')).toMatchObject({ move: { x: 0, y: 127 } })
    expect(held('KeyQ')).toMatchObject({ 'camera-turn': { units: -KEY_TURN_UNITS } })
    expect(held('KeyE')).toMatchObject({ 'camera-turn': { units: KEY_TURN_UNITS } })
    expect(held('Space')).toMatchObject({ act: { roll: true } })
    expect(held('KeyK')).toMatchObject({ act: { roll: true } })
  })
})
