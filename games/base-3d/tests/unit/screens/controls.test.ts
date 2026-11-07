// The controls: G3-F5 (what reaches the sim), G3-aa (the camera settings), and the touch layout's data (the required
// `end` Roll button, the stick, the drag) over the page's own input map.
import type { AnalogReading } from '@automata/framework'
import { MAX_TURN_UNITS_PER_STEP } from '@automata/framework'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@automata/framework', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@automata/framework')>()),
  startGame: () => {},
}))
const { input } = await import('../../../main.ts')
const { STICK_TURN_UNITS, cameraTurnUnits, moveFromStick } = await import('#src/features/screens/controls.ts')

const reading = (
  over: { left?: [number, number]; right?: number; drag?: number; speed?: number; invert?: boolean } = {},
): AnalogReading => ({
  stick: (side) =>
    side === 'left' ? { x: over.left?.[0] ?? 0, y: over.left?.[1] ?? 0 } : { x: over.right ?? 0, y: 0 },
  cameraDrag: () => over.drag ?? 0,
  camera: { degPerPixel: over.speed ?? 0.25, invert: over.invert ?? false },
})

describe('G3-F5: what the camera turn sends the sim', () => {
  it('the right stick turns at 180° a second: 546 units a tick at full push', () => {
    expect(STICK_TURN_UNITS).toBe(546)
    expect(cameraTurnUnits(reading({ right: 127 }), { units: 0 })).toEqual({ units: 546 })
    expect(cameraTurnUnits(reading({ right: -127 }), { units: 0 })).toEqual({ units: -546 })
  })

  it('adds the keys, the stick and the drag, and clamps to ±8,192', () => {
    expect(cameraTurnUnits(reading({ right: 127, drag: 40 }), { units: 364 }).units).toBe(364 + 546 + 1820)
    expect(cameraTurnUnits(reading({ drag: 100_000 }), { units: 0 }).units).toBe(MAX_TURN_UNITS_PER_STEP)
    expect(cameraTurnUnits(reading({ drag: -100_000 }), { units: 0 }).units).toBe(-MAX_TURN_UNITS_PER_STEP)
  })

  it('never lets NaN reach the sim: the command carries the keys’ units alone', () => {
    const sent = (r: AnalogReading, held: string[]) =>
      input.toCommand(held, 0, r).find((command) => command.type === 'camera-turn')?.payload
    expect(sent(reading({ drag: Number.NaN }), [])).toEqual({ units: 0 })
    expect(Number.isNaN(cameraTurnUnits(reading({ drag: Number.NaN }), { units: 0 }).units)).toBe(false)
  })
})

describe('G3-aa: the camera settings', () => {
  it('half the speed halves the units of the same drag, double doubles them', () => {
    const at = (speed: number) => cameraTurnUnits(reading({ drag: 50, speed }), { units: 0 }).units
    expect(at(0.25)).toBe(2276)
    expect(at(0.5)).toBe(4551)
    expect(at(0.125)).toBe(1138)
  })

  it('invert negates the drag', () => {
    expect(cameraTurnUnits(reading({ drag: 50, invert: true }), { units: 0 }).units).toBe(-2276)
  })
})

describe('the left stick', () => {
  it('is move at the stick’s own integers; centred, it leaves the keys alone', () => {
    expect(moveFromStick(reading({ left: [64, -127] }))).toEqual({ x: 64, y: -127 })
    expect(moveFromStick(reading())).toEqual({})
    const sent = input.toCommand([], 0, reading({ left: [64, -127] })).find((c) => c.type === 'move')
    expect(sent?.payload).toEqual({ x: 64, y: -127 })
  })
})

describe('the touch layout', () => {
  it('has the one Roll button, in the end group, required', () => {
    expect(input.touch).toBe(true)
    expect(input.touchButtons.map((button) => [button.label, button.side, button.required])).toEqual([
      ['Roll', 'end', true],
    ])
  })

  it('asks for the touch stick and binds the camera drag, and stays in touch mode buttons', () => {
    expect(input.touchStick).toBe(true)
    expect(input.touchMode).toBe('buttons')
    expect(
      Object.values(input.profile.bindings).some((binding) => binding.gesture?.includes('camera-drag')),
    ).toBe(true)
  })
})
