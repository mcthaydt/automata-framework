import { describe, expect, it } from 'vitest'
import { DEVICE_RUN_HASH, runOn } from '#src/input/testing/device-run.ts'

// I-a (M4 spec §13), Node half: the same script by keyboard, pad and touch sends the same commands and ends on the
// same hash. The browsers half is keys.parity.test.ts, which must end on this same pinned hash.
describe('one action on three devices (I-a)', () => {
  it('sends the same command stream from the keyboard, a standard pad and touch, ending on the pinned hash', async () => {
    const keyboard = await runOn('keyboard', window)
    const gamepad = await runOn('gamepad', window)
    const touch = await runOn('touch', window)
    expect(keyboard.commands).toHaveLength(120)
    expect(gamepad.commands).toEqual(keyboard.commands)
    expect(touch.commands).toEqual(keyboard.commands)
    expect([keyboard.hash, gamepad.hash, touch.hash]).toEqual([
      DEVICE_RUN_HASH,
      DEVICE_RUN_HASH,
      DEVICE_RUN_HASH,
    ])
  })
})
