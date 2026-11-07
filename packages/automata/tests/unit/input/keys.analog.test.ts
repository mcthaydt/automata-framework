import { defineCommand } from '@mcthaydt/automata-sim'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { inputs } from '#src/features/input/inputs.ts'
import { type AnalogReading, keys } from '#src/features/input/keys.ts'
import { CAMERA_SETTINGS_DEFAULT } from '../../../src/features/input/analog/camera-settings.schema.ts'

// keys({ analog }): the sticks and the camera drag added to the held keys' payload (M4 spec §17).
const Turn = defineCommand('camera-turn', z.object({ units: z.number().int().default(0) }))
const Move = defineCommand('move', z.object({ x: z.number().int().default(0) }))

const reading = (over: Partial<{ right: number; drag: number }> = {}): AnalogReading => ({
  stick: (side) => ({ x: side === 'right' ? (over.right ?? 0) : 0, y: 0 }),
  cameraDrag: () => over.drag ?? 0,
  camera: CAMERA_SETTINGS_DEFAULT,
})

const turn = (extra: Parameters<typeof keys<typeof Turn.schema>>[2] = {}) =>
  keys(
    Turn,
    { KeyE: { units: 100 } },
    {
      ...extra,
      analog: {
        drag: true,
        read: (r, held) => ({ units: held.units + r.stick('right').x * 2 + r.cameraDrag() }),
      },
    },
  )

describe('keys({ analog })', () => {
  it('adds the reading to the held payload, fresh every tick', () => {
    const map = turn()
    expect(map.toCommand(['camera-turn-0'], 0, reading({ right: 10, drag: 5 }))[0]?.payload).toEqual({
      units: 125,
    })
    expect(map.toCommand(['camera-turn-0'], 1, reading({ right: 0, drag: 0 }))[0]?.payload).toEqual({
      units: 100,
    })
    expect(map.toCommand([], 2, reading({ drag: 7 }))[0]?.payload).toEqual({ units: 7 })
  })

  it('sends the held payload alone when the reading fails the schema (a NaN, a float)', () => {
    const map = turn()
    expect(map.toCommand(['camera-turn-0'], 0, reading({ drag: Number.NaN }))[0]?.payload).toEqual({
      units: 100,
    })
    expect(map.toCommand(['camera-turn-0'], 1, reading({ drag: 0.5 }))[0]?.payload).toEqual({ units: 100 })
  })

  it('without a reading, or without analog, behaves as before', () => {
    expect(turn().toCommand(['camera-turn-0'], 0)[0]?.payload).toEqual({ units: 100 })
    expect(
      keys(Turn, { KeyE: { units: 100 } }).toCommand(['camera-turn-0'], 0, reading({ drag: 9 }))[0]?.payload,
    ).toEqual({ units: 100 })
  })

  it('binds the camera-drag gesture to its own action: no keys, no button, touch mode buttons', () => {
    const map = turn()
    expect(map.profile.bindings['camera-turn-drag']).toMatchObject({
      keys: [],
      pad: [],
      gesture: ['camera-drag'],
      touch: false,
    })
    expect(map.touchButtons.map((button) => button.id)).toEqual(['camera-turn-0'])
    expect(map.touchMode).toBe('buttons')
    expect(turn().touchStick).toBe(false)
  })

  it('touchStick: true is carried by inputs() when any map has it', () => {
    const left = keys(Move, {}, { analog: { touchStick: true, read: (r) => ({ x: r.stick('left').x }) } })
    expect(left.touchStick).toBe(true)
    expect(inputs(left, turn()).touchStick).toBe(true)
    expect(inputs(turn()).touchStick).toBe(false)
  })

  it('inputs() passes the reading to every map', () => {
    const left = keys(Move, {}, { analog: { read: () => ({ x: 7 }) } })
    const merged = inputs(left, turn())
    const payloads = merged.toCommand([], 3, reading({ drag: 4 })).map((command) => command.payload)
    expect(payloads).toEqual([{ x: 7 }, { units: 4 }])
  })
})
