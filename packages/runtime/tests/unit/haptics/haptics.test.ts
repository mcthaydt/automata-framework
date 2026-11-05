import { describe, expect, it, vi } from 'vitest'
import { createHaptics, type HapticPulse } from '#src/haptics/haptics.manager.ts'

// Haptics (Owner, 2026-10-18; FloorFifty `systems/haptics.ts` and `tests/client/systems/haptics.test.ts` at a28dc44,
// generalised: a game says what a pulse is, rather than FloorFifty's race kinds). A pad with an actuator rumbles;
// else a touch phone buzzes; else nothing, and nothing throws. The player's setting turns it all off, and `supported`
// says whether this device can do either, so Settings shows the toggle only where it means something.

interface FakePad {
  connected: boolean
  index: number
  vibrationActuator?: { playEffect: ReturnType<typeof vi.fn> }
}

const SLAM: HapticPulse = { duration: 90, strong: 0.6, weak: 0.4, phone: 18 }
const LAND: HapticPulse = { duration: 24, strong: 0, weak: 0.16 }
const WIN: HapticPulse = { duration: 420, strong: 1, weak: 0.8, phone: [40, 60, 90] }

function rig(options: { pads?: FakePad[]; touch?: boolean; vibrate?: boolean } = {}) {
  const vibrate = vi.fn(() => true)
  const haptics = createHaptics({
    // The fakes carry vi.fn actuators; the service reads only what a pad has.
    getGamepads: () => (options.pads ?? []) as never,
    ...(options.vibrate === false ? {} : { vibrate }),
    touch: () => options.touch ?? false,
  })
  return { haptics, vibrate }
}

const pad = (index = 0): FakePad => ({
  connected: true,
  index,
  vibrationActuator: { playEffect: vi.fn(async () => 'complete') },
})

describe('where a pulse goes', () => {
  it('rumbles a connected pad with the pulse’s dual-rumble, and leaves the phone still', () => {
    const one = pad()
    const { haptics, vibrate } = rig({ pads: [one], touch: true })
    haptics.pulse(SLAM)
    expect(one.vibrationActuator?.playEffect).toHaveBeenCalledWith('dual-rumble', {
      duration: 90,
      strongMagnitude: 0.6,
      weakMagnitude: 0.4,
      startDelay: 0,
    })
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('rumbles the first pad that can when several are connected', () => {
    const bare: FakePad = { connected: true, index: 0 }
    const second = pad(1)
    const third = pad(2)
    rig({ pads: [bare, second, third] }).haptics.pulse(SLAM)
    expect(second.vibrationActuator?.playEffect).toHaveBeenCalled()
    expect(third.vibrationActuator?.playEffect).not.toHaveBeenCalled()
  })

  it('buzzes a touch phone with no pad, only for a pulse that has a phone pattern', () => {
    const { haptics, vibrate } = rig({ touch: true })
    haptics.pulse(LAND)
    expect(vibrate).not.toHaveBeenCalled()
    haptics.pulse(WIN)
    expect(vibrate).toHaveBeenCalledWith([40, 60, 90])
  })

  it('is silent off a touch screen with no pad, with the setting off, or with nothing to vibrate', () => {
    const off = rig({ touch: true, pads: [pad()] })
    off.haptics.setEnabled(false)
    for (const { haptics, vibrate } of [rig({ touch: false }), off, rig({ touch: true, vibrate: false })]) {
      expect(() => haptics.pulse(SLAM)).not.toThrow()
      expect(vibrate).not.toHaveBeenCalled()
    }
  })

  it('never throws: an actuator without playEffect, one that throws at once, one whose effect rejects', () => {
    const legacy = { connected: true, index: 0, vibrationActuator: {} } as unknown as FakePad
    const throwing: FakePad = {
      connected: true,
      index: 0,
      vibrationActuator: {
        playEffect: vi.fn(() => {
          throw new Error('unsupported')
        }),
      },
    }
    const rejecting: FakePad = {
      connected: true,
      index: 1,
      vibrationActuator: { playEffect: vi.fn(() => Promise.reject(new Error('no'))) },
    }
    for (const pads of [[legacy], [throwing], [{ connected: true, index: 0 }, rejecting]])
      expect(() => rig({ pads }).haptics.pulse(SLAM)).not.toThrow()
  })
})

describe('supported', () => {
  it('is true with a pad that can rumble, or on a touch screen that can buzz; false otherwise', () => {
    expect(rig({ pads: [pad()] }).haptics.supported).toBe(true)
    expect(rig({ touch: true }).haptics.supported).toBe(true)
    expect(rig({ touch: false }).haptics.supported).toBe(false)
    expect(rig({ touch: true, vibrate: false }).haptics.supported).toBe(false)
    expect(rig({ pads: [{ connected: true, index: 0 }] }).haptics.supported).toBe(false)
  })
})
