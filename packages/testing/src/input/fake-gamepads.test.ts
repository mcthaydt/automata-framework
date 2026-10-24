import { describe, expect, it } from 'vitest'
import { fakeGamepads } from './fake-gamepads'

// The unit-test fake gamepad (M4 spec §4.14): `navigator.getGamepads` as a game's unit tests drive it.
describe('fakeGamepads', () => {
  it('starts with four empty slots, and connect puts a standard pad at rest in one', () => {
    const pads = fakeGamepads()
    expect(pads.getGamepads()).toEqual([null, null, null, null])
    pads.connect()
    const [pad] = pads.getGamepads()
    expect(pad).toMatchObject({ index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0] })
    expect(pad?.buttons).toHaveLength(17)
    expect(pad?.buttons.every((button) => !button.pressed && button.value === 0)).toBe(true)
  })

  it('shows presses, releases and the stick in the next read, and a read is a snapshot', () => {
    const pads = fakeGamepads()
    pads.connect()
    const before = pads.getGamepads()[0]
    pads.press(0)
    pads.stick(0.5, -0.25)
    const after = pads.getGamepads()[0]
    expect(after?.buttons[0]).toMatchObject({ pressed: true, value: 1 })
    expect(after?.axes.slice(0, 2)).toEqual([0.5, -0.25])
    expect(before?.buttons[0]?.pressed).toBe(false)
    pads.release(0)
    expect(pads.getGamepads()[0]?.buttons[0]?.pressed).toBe(false)
  })

  it('counts a trigger pressed from half travel, as a browser does', () => {
    const pads = fakeGamepads()
    pads.connect()
    pads.press(7, 0.4)
    expect(pads.getGamepads()[0]?.buttons[7]).toMatchObject({ pressed: false, value: 0.4 })
    pads.press(7, 0.6)
    expect(pads.getGamepads()[0]?.buttons[7]).toMatchObject({ pressed: true, value: 0.6 })
  })

  it('connects a non-standard pad on request, and unplug empties the slot', () => {
    const pads = fakeGamepads()
    pads.connect(1, { mapping: '', id: 'Odd Pad' })
    expect(pads.getGamepads()[1]).toMatchObject({ index: 1, mapping: '', id: 'Odd Pad' })
    pads.unplug(1)
    expect(pads.getGamepads()[1]).toBeNull()
  })

  it('dispatches gamepadconnected and gamepaddisconnected on the target it is given', () => {
    const target = new EventTarget()
    const seen: string[] = []
    for (const type of ['gamepadconnected', 'gamepaddisconnected'])
      target.addEventListener(type, (event) =>
        seen.push(`${event.type} ${(event as GamepadEvent).gamepad.index}`),
      )
    const pads = fakeGamepads({ target })
    pads.connect(2)
    pads.unplug(2)
    expect(seen).toEqual(['gamepadconnected 2', 'gamepaddisconnected 2'])
  })
})
