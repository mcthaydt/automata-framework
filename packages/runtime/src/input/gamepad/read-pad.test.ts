import { describe, expect, it } from 'vitest'
import { DEADZONE, quantizeAxis, readPad } from './read-pad.js'
import { fakePad } from './testing/fake-pad.js'

// readPad (M4 spec §4.3), ported from FloorFifty `tests/client/managers/gamepad-source.test.ts` at `ac72660`
// ("reading a pad", "stick drift and the deadzone", "d-pad and stick parity"). The race intents stay in FloorFifty.
const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315].map((degrees) => (degrees * Math.PI) / 180)

describe('readPad', () => {
  it('ignores a stick inside the 0.25 radial deadzone, and moves just past it (I-c)', () => {
    expect(DEADZONE).toBe(0.25)
    const still = readPad(fakePad().stick(0.15, 0.15))
    expect([...still.sticks]).toEqual([])
    expect([...still.nav]).toEqual([])
    expect([...readPad(fakePad().stick(0.2, 0.2)).sticks].sort()).toEqual(['left-down', 'left-right'])
  })

  it('drift just inside the deadzone, in every direction, reads as nothing', () => {
    for (const angle of ANGLES) {
      const pad = fakePad().stick(0.24 * Math.cos(angle), 0.24 * Math.sin(angle))
      expect(readPad(pad).sticks.size + readPad(pad).nav.size).toBe(0)
    }
  })

  it('just outside the deadzone, each direction is one nav', () => {
    expect([...readPad(fakePad().stick(0, -0.3)).nav]).toEqual(['up'])
    expect([...readPad(fakePad().stick(0, 0.3)).nav]).toEqual(['down'])
    expect([...readPad(fakePad().stick(-0.3, 0)).nav]).toEqual(['left'])
    expect([...readPad(fakePad().stick(0.3, 0)).nav]).toEqual(['right'])
  })

  it('a diagonal push is one nav along its stronger axis, not two', () => {
    expect([...readPad(fakePad().stick(0.5, 0.8)).nav]).toEqual(['down'])
    expect([...readPad(fakePad().stick(-0.8, 0.5)).nav]).toEqual(['left'])
  })

  it('the d-pad and a held stick give the same nav', () => {
    const pairs: [number, [number, number]][] = [
      [12, [0, -0.9]],
      [13, [0, 0.9]],
      [14, [-0.9, 0]],
      [15, [0.9, 0]],
    ]
    for (const [button, [x, y]] of pairs)
      expect([...readPad(fakePad().press(button)).nav]).toEqual([...readPad(fakePad().stick(x, y)).nav])
  })

  it('reads the right stick on axes 2 and 3, and never as nav', () => {
    const reading = readPad(fakePad().stick(0.9, 0, 'right'))
    expect([...reading.sticks]).toEqual(['right-right'])
    expect([...reading.nav]).toEqual([])
  })

  it('counts a button pressed, and a trigger from 0.5', () => {
    expect([...readPad(fakePad().press(0)).buttons]).toEqual([0])
    expect([...readPad(fakePad().press(7, 0.49)).buttons]).toEqual([])
    expect([...readPad(fakePad().press(7, 0.5)).buttons]).toEqual([7])
  })
})

describe('quantizeAxis (M4-D2)', () => {
  it('is 0 inside the deadzone and an integer in −127..127 outside it', () => {
    expect(quantizeAxis(0.2)).toBe(0)
    expect(quantizeAxis(-0.5)).toBe(-64)
    expect(quantizeAxis(0.5)).toBe(64)
    expect(quantizeAxis(-1)).toBe(-127)
    expect(quantizeAxis(1.2)).toBe(127)
  })
})
