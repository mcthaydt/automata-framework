import { describe, expect, it } from 'vitest'
import { createPointers, type PointerTarget } from './pointers'

// The journey helpers' event sequences (plan EDK.6b step 2), in Node: a target that records what it is sent, events
// made as plain records, and no waiting. In the journeys the same helpers make real `PointerEvent`s and wait a frame.

interface Sent {
  readonly type: string
  readonly init: PointerEventInit
}

function setup() {
  const sent: Sent[] = []
  const waits: number[] = []
  const target: PointerTarget = {
    getBoundingClientRect: () => ({ left: 100, top: 50 }),
    dispatchEvent: (event) => {
      sent.push(event as unknown as Sent)
      return true
    },
  }
  const pointers = createPointers(target, {
    makeEvent: (type, init) => ({ type, init }) as unknown as Event,
    frame: async () => {},
    wait: async (ms) => {
      waits.push(ms)
    },
  })
  const brief = () =>
    sent.map(
      ({ type, init }) => `${type} ${init.pointerType}#${init.pointerId} ${init.clientX},${init.clientY}`,
    )
  return { sent, waits, pointers, brief }
}

describe('createPointers', () => {
  it('taps with a finger at a point of the target, in page coordinates', async () => {
    const { pointers, brief, sent } = setup()
    await pointers.tap({ x: 10, y: 20 })
    expect(brief()).toEqual(['pointerdown touch#1 110,70', 'pointerup touch#1 110,70'])
    expect(sent[0]?.init).toMatchObject({
      bubbles: true,
      isPrimary: true,
      button: 0,
      buttons: 1,
      pressure: 0.5,
    })
    expect(sent[1]?.init).toMatchObject({ buttons: 0, pressure: 0 })
  })

  it('gives every new contact its own pointer id', async () => {
    const { pointers, brief } = setup()
    await pointers.tap({ x: 0, y: 0 })
    await pointers.tap({ x: 0, y: 0 }, { kind: 'mouse' })
    expect(brief().map((line) => line.split(' ')[1])).toEqual(['touch#1', 'touch#1', 'mouse#2', 'mouse#2'])
  })

  it('holds a long press for the given time', async () => {
    const { pointers, waits, brief } = setup()
    await pointers.longPress({ x: 1, y: 1 }, { holdMs: 650 })
    expect(waits).toEqual([650])
    expect(brief()).toEqual(['pointerdown touch#1 101,51', 'pointerup touch#1 101,51'])
  })

  it('drags along a path: down at the first point, a move to each next one, up at the last', async () => {
    const { pointers, brief } = setup()
    await pointers.drag([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 40, y: 0 },
    ])
    expect(brief()).toEqual([
      'pointerdown touch#1 100,50',
      'pointermove touch#1 120,50',
      'pointermove touch#1 140,50',
      'pointerup touch#1 140,50',
    ])
  })

  it('pinches two fingers apart about a centre by the scale', async () => {
    const { pointers, brief } = setup()
    await pointers.pinch({ x: 50, y: 50 }, 2, { distance: 40, steps: 2 })
    expect(brief()).toEqual([
      'pointerdown touch#1 130,100',
      'pointerdown touch#2 170,100',
      'pointermove touch#1 120,100',
      'pointermove touch#2 180,100',
      'pointermove touch#1 110,100',
      'pointermove touch#2 190,100',
      'pointerup touch#1 110,100',
      'pointerup touch#2 190,100',
    ])
  })

  it('twists two fingers about a centre', async () => {
    const { pointers, sent } = setup()
    await pointers.twist({ x: 0, y: 0 }, Math.PI / 2, { distance: 20, steps: 1 })
    const last = sent.filter((each) => each.type === 'pointermove').slice(-2)
    expect(
      last.map((each) => [Math.round(each.init.clientX ?? 0), Math.round(each.init.clientY ?? 0)]),
    ).toEqual([
      [100, 40],
      [100, 60],
    ])
  })

  it('strokes with the Pencil, with pressure and tilt, and hovers it without touching', async () => {
    const { pointers, sent } = setup()
    await pointers.pencilHover([{ x: 5, y: 5 }])
    await pointers.pencilStroke(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      { pressure: 0.8, tiltX: 30 },
    )
    expect(
      sent.map((each) => [each.type, each.init.pointerType, each.init.buttons, each.init.pressure]),
    ).toEqual([
      ['pointermove', 'pen', 0, 0],
      ['pointerdown', 'pen', 1, 0.8],
      ['pointermove', 'pen', 1, 0.8],
      ['pointerup', 'pen', 0, 0],
    ])
    expect(sent[1]?.init.tiltX).toBe(30)
  })

  it('lands a palm as a wide touch the journey moves and lifts, and leaves contacts open for mid-gesture cases', async () => {
    const { pointers, sent, brief } = setup()
    const pen = await pointers.down('pen', { x: 0, y: 0 })
    const palm = await pointers.palm({ x: 30, y: 30 })
    await palm.move({ x: 35, y: 30 })
    await palm.release()
    await pen.move({ x: 10, y: 0 })
    await pen.cancel()
    expect(brief()).toEqual([
      'pointerdown pen#1 100,50',
      'pointerdown touch#2 130,80',
      'pointermove touch#2 135,80',
      'pointerup touch#2 135,80',
      'pointermove pen#1 110,50',
      'pointercancel pen#1 110,50',
    ])
    // Pointer Events count primaries per kind: the first touch is primary even with the Pencil down.
    expect(sent[1]?.init).toMatchObject({ width: 40, height: 40, isPrimary: true })
  })
})
