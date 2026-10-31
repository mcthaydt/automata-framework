import { cameraHeadingPlugin } from '@mcthaydt/automata-render-pixi3d/sim'
import { describe, expect, it, vi } from 'vitest'
import { FIRST_SLICE } from './content/first-slice.ts'
import { base3dPlugin, base3dSim } from './state/index.ts'
import { compileWorld } from './systems/index.ts'

// `startGame` spied on, so importing the page entry shows whether it starts the game (GL spec §4.6).
const started = vi.hoisted(() => ({ calls: 0 }))
vi.mock('@mcthaydt/automata-game', async (original) => ({
  ...(await original<typeof import('@mcthaydt/automata-game')>()),
  startGame: () => {
    started.calls++
  },
}))
const { base3d, input } = await import('./main.ts')

// Node only: the game module's imports include Node-side code the browsers project does not load.
describe('the defined game', () => {
  it('takes the heading from render3dExtension, not from the game’s own list (RT.EXT1)', () => {
    expect(base3dSim(compileWorld([FIRST_SLICE])).plugins).toEqual([base3dPlugin])
    expect(base3d.sim.plugins).toEqual([base3dPlugin, cameraHeadingPlugin])
  })
  it('is defined, not started, when a test imports the page entry', () => {
    expect(base3d.id).toBe('base-3d')
    expect(started.calls).toBe(0)
  })
})

describe('the key map (M3.7b part 3)', () => {
  /** This tick's commands with `codes` held, by command id. */
  const held = (...codes: string[]) => {
    const actions = Object.entries(input.profile.bindings)
      .filter(([, binding]) => binding.keys.some((code) => codes.includes(code)))
      .map(([id]) => id)
    return Object.fromEntries(input.toCommand(actions, 4).map((command) => [command.type, command.payload]))
  }

  it('sends the move, the camera turn, the lock and the action buttons every tick, idle with nothing held', () => {
    expect(held()).toEqual({
      move: { x: 0, y: 0 },
      'camera-turn': { units: 0 },
      // The player's saved Lock mode, Toggle until play reads the settings (screens/lock-input.ts).
      lock: { down: false, mode: 'toggle' },
      act: { slash: false, guard: false, point: false, pickup: false },
    })
  })

  it('maps WASD and the arrows to the stick’s edge, Q and E to a 120° a second turn, Shift to lock', () => {
    expect(held('KeyW', 'KeyD')).toMatchObject({ move: { x: 127, y: -127 } })
    expect(held('ArrowDown')).toMatchObject({ move: { x: 0, y: 127 } })
    expect(held('KeyQ')).toMatchObject({ 'camera-turn': { units: -364 } })
    expect(held('KeyE')).toMatchObject({ 'camera-turn': { units: 364 } })
    expect(held('ShiftRight')).toMatchObject({ lock: { down: true, mode: 'toggle' } })
  })

  it('sends the saved Lock mode, and a lock-cycle on Q’s and E’s first tick (GAME-3D.1b part 2)', () => {
    input.mode = 'hold'
    expect(held('ShiftLeft')).toMatchObject({ lock: { down: true, mode: 'hold' } })
    input.mode = 'toggle'
    expect(held('KeyQ')).toMatchObject({ 'lock-cycle': { dir: -1 }, 'camera-turn': { units: -364 } })
    expect(held('KeyQ')['lock-cycle']).toBeUndefined()
    expect(held('KeyE')).toMatchObject({ 'lock-cycle': { dir: 1 } })
  })

  it('maps J, K, L and F to slash, guard, point and pick up', () => {
    expect(held('KeyJ', 'KeyK').act).toEqual({ slash: true, guard: true, point: false, pickup: false })
    expect(held('KeyL', 'KeyF').act).toEqual({ slash: false, guard: false, point: true, pickup: true })
  })
})
