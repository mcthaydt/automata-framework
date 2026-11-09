import { describe, expect, it } from 'vitest'
import { HandoverMask } from '#src/features/input/gamepad/handover-mask.ts'
import { readPad } from '#src/features/input/gamepad/read-pad.ts'
import { fakePad } from '#src/features/input/gamepad/testing/fake-pad.ts'

// The handover mask (M4 spec §4.3):
// what the pad held when it changed hands reads as released until let go.
const buttonsOf = (mask: HandoverMask, pad: ReturnType<typeof fakePad>) => [
  ...readPad(mask.apply(pad)).buttons,
]

describe('HandoverMask', () => {
  it('masks an A held across the handover until it is released and pressed again', () => {
    const mask = new HandoverMask()
    mask.capture(fakePad().press(0))
    expect(buttonsOf(mask, fakePad().press(0))).toEqual([])
    expect(buttonsOf(mask, fakePad())).toEqual([])
    expect(buttonsOf(mask, fakePad().press(0))).toEqual([0])
  })

  it('masks only what was held: a fresh input still acts', () => {
    const mask = new HandoverMask()
    mask.capture(fakePad().press(0))
    expect(buttonsOf(mask, fakePad().press(0).press(14))).toEqual([14])
  })

  it('masks a held stick until it comes back inside the deadzone', () => {
    const mask = new HandoverMask()
    mask.capture(fakePad().stick(0, 0.9))
    expect([...readPad(mask.apply(fakePad().stick(0, 0.4))).nav]).toEqual([])
    expect([...readPad(mask.apply(fakePad().stick(0, 0.1))).nav]).toEqual([])
    expect([...readPad(mask.apply(fakePad().stick(0, 0.9))).nav]).toEqual(['down'])
  })

  it('lets another pad through untouched', () => {
    const mask = new HandoverMask()
    mask.capture(fakePad().press(0))
    expect(buttonsOf(mask, fakePad({ index: 1 }).press(0))).toEqual([0])
  })
})
