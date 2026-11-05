import { describe, expect, it } from 'vitest'
import { DEVICE_RUN_HASH, runOn } from '#src/input/testing/device-run.ts'

// I-a (M4 spec §13), browsers half: Chromium, WebKit and Firefox play the same script by keyboard, pad and touch
// and must end on the hash the Node run pinned, bit for bit.
describe('one action on three devices, cross-engine (I-a)', () => {
  it('ends on the pinned hash from every device', async () => {
    const keyboard = await runOn('keyboard', window)
    const gamepad = await runOn('gamepad', window)
    const touch = await runOn('touch', window)
    expect(gamepad.commands).toEqual(keyboard.commands)
    expect(touch.commands).toEqual(keyboard.commands)
    expect([keyboard.hash, gamepad.hash, touch.hash]).toEqual([
      DEVICE_RUN_HASH,
      DEVICE_RUN_HASH,
      DEVICE_RUN_HASH,
    ])
  })
})
