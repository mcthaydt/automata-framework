// Touch, Pencil and mouse input for the editors' iPad journeys.
// Each helper sends the `PointerEvent`s an iPad sends for that gesture to one element, a frame apart, so the kit's own
// recogniser sees a finger, a Pencil with pressure and tilt, or a palm (a wide touch) as a person makes them. Points are
// in the target's own pixels; the events carry page coordinates. Every new contact gets its own pointer id. `down`
// hands back an open contact for the cases that act mid-gesture (a palm while the Pencil is down, a rotation mid-drag).
// What real iPad hardware does with these stays the Owner's device pass.

export interface Point {
  readonly x: number
  readonly y: number
}

export type PointerKind = 'touch' | 'pen' | 'mouse'

/** What a helper needs of its element (an `HTMLElement` is one). */
export interface PointerTarget {
  getBoundingClientRect(): { readonly left: number; readonly top: number }
  dispatchEvent(event: Event): boolean
}

export interface ContactExtras {
  /** While pressed; a finger and a mouse press at 0.5, the Pencil at what it is given (0.5 by default). */
  readonly pressure?: number
  readonly tiltX?: number
  readonly tiltY?: number
  /** The contact's size in CSS pixels: 1 for a fingertip or a Pencil, 40 for a palm. */
  readonly size?: number
  readonly button?: number
}

export interface Contact {
  readonly id: number
  move(to: Point, extras?: ContactExtras): Promise<void>
  /** Lifts the contact where it last was. */
  release(): Promise<void>
  /** Ends it with `pointercancel`, as the system does when it takes the touch away. */
  cancel(): Promise<void>
}

export interface PointersOptions {
  /** Makes an event; `new PointerEvent(type, init)` by default. */
  readonly makeEvent?: (type: string, init: PointerEventInit) => Event
  /** Waits for the next frame between steps; the browser's next animation frame by default. */
  readonly frame?: () => Promise<void>
  /** Waits real time (a long press); `setTimeout` by default. */
  readonly wait?: (ms: number) => Promise<void>
}

interface Gesture {
  readonly kind?: PointerKind
}

export interface Pointers {
  down(kind: PointerKind, at: Point, extras?: ContactExtras): Promise<Contact>
  tap(at: Point, options?: Gesture): Promise<void>
  longPress(at: Point, options?: Gesture & { readonly holdMs?: number }): Promise<void>
  drag(path: readonly Point[], options?: Gesture & ContactExtras): Promise<void>
  pinch(
    centre: Point,
    scale: number,
    options?: { readonly distance?: number; readonly steps?: number },
  ): Promise<void>
  twist(
    centre: Point,
    radians: number,
    options?: { readonly distance?: number; readonly steps?: number },
  ): Promise<void>
  pencilHover(path: readonly Point[]): Promise<void>
  pencilStroke(path: readonly Point[], extras?: ContactExtras): Promise<void>
  /** A palm resting on the glass: a wide touch, left down until the journey lifts it. */
  palm(at: Point): Promise<Contact>
}

/** The long press the kit's recogniser waits for is 500 ms; a journey holds a little longer. */
const LONG_PRESS_MS = 600
const PALM_SIZE = 40

const nextFrame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()))
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export function createPointers(target: PointerTarget, options: PointersOptions = {}): Pointers {
  const makeEvent = options.makeEvent ?? ((type, init) => new PointerEvent(type, init))
  const frame = options.frame ?? nextFrame
  const wait = options.wait ?? sleep
  let lastId = 0
  /** The contacts down now, per kind: the first of a kind is the primary pointer. */
  const down = new Map<PointerKind, Set<number>>()

  const page = (at: Point): Point => {
    const box = target.getBoundingClientRect()
    return { x: box.left + at.x, y: box.top + at.y }
  }

  function send(type: string, id: number, kind: PointerKind, at: Point, init: PointerEventInit): void {
    const where = page(at)
    target.dispatchEvent(
      makeEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        pointerId: id,
        pointerType: kind,
        clientX: where.x,
        clientY: where.y,
        ...init,
      }),
    )
  }

  async function open(kind: PointerKind, at: Point, extras: ContactExtras = {}): Promise<Contact> {
    lastId += 1
    const id = lastId
    const active = down.get(kind) ?? new Set<number>()
    down.set(kind, active)
    const isPrimary = active.size === 0
    active.add(id)
    const size = extras.size ?? 1
    const pressed = {
      isPrimary,
      width: size,
      height: size,
      tiltX: extras.tiltX ?? 0,
      tiltY: extras.tiltY ?? 0,
      pressure: extras.pressure ?? 0.5,
      buttons: 1,
    }
    let last = at
    send('pointerdown', id, kind, at, { ...pressed, button: extras.button ?? 0 })
    await frame()
    const end = async (type: 'pointerup' | 'pointercancel'): Promise<void> => {
      active.delete(id)
      send(type, id, kind, last, { ...pressed, button: extras.button ?? 0, buttons: 0, pressure: 0 })
      await frame()
    }
    return {
      id,
      async move(to, more = {}) {
        last = to
        send('pointermove', id, kind, to, {
          ...pressed,
          button: -1,
          ...(more.pressure === undefined ? {} : { pressure: more.pressure }),
          ...(more.tiltX === undefined ? {} : { tiltX: more.tiltX }),
          ...(more.tiltY === undefined ? {} : { tiltY: more.tiltY }),
        })
        await frame()
      },
      release: () => end('pointerup'),
      cancel: () => end('pointercancel'),
    }
  }

  /** Two fingers on either side of `centre`, moved step by step to where `place` puts them at the end. */
  async function twoFingers(
    centre: Point,
    distance: number,
    steps: number,
    place: (t: number, side: -1 | 1) => Point,
  ): Promise<void> {
    const first = await open('touch', { x: centre.x - distance / 2, y: centre.y })
    const second = await open('touch', { x: centre.x + distance / 2, y: centre.y })
    for (let step = 1; step <= steps; step += 1) {
      await first.move(place(step / steps, -1))
      await second.move(place(step / steps, 1))
    }
    await first.release()
    await second.release()
  }

  return {
    down: open,
    async tap(at, gesture = {}) {
      const contact = await open(gesture.kind ?? 'touch', at)
      await contact.release()
    },
    async longPress(at, gesture = {}) {
      const contact = await open(gesture.kind ?? 'touch', at)
      await wait(gesture.holdMs ?? LONG_PRESS_MS)
      await contact.release()
    },
    async drag(path, gesture = {}) {
      const [start, ...rest] = path
      if (start === undefined) return
      const contact = await open(gesture.kind ?? 'touch', start, gesture)
      for (const point of rest) await contact.move(point)
      await contact.release()
    },
    pinch(centre, scale, gesture = {}) {
      const distance = gesture.distance ?? 100
      const half = distance / 2
      return twoFingers(centre, distance, gesture.steps ?? 5, (t, side) => ({
        x: centre.x + side * half * (1 + (scale - 1) * t),
        y: centre.y,
      }))
    },
    twist(centre, radians, gesture = {}) {
      const half = (gesture.distance ?? 100) / 2
      return twoFingers(centre, half * 2, gesture.steps ?? 5, (t, side) => {
        const angle = (side === -1 ? Math.PI : 0) + radians * t
        return { x: centre.x + half * Math.cos(angle), y: centre.y + half * Math.sin(angle) }
      })
    },
    async pencilHover(path) {
      lastId += 1
      const id = lastId
      for (const point of path) {
        send('pointermove', id, 'pen', point, { isPrimary: true, buttons: 0, button: -1, pressure: 0 })
        await frame()
      }
    },
    async pencilStroke(path, extras = {}) {
      const [start, ...rest] = path
      if (start === undefined) return
      const pen = await open('pen', start, extras)
      for (const point of rest) await pen.move(point)
      await pen.release()
    },
    palm: (at) => open('touch', at, { size: PALM_SIZE }),
  }
}
