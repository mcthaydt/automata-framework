// The Input service (M4 spec §4.2): keyboard, standard-pad buttons and touch, each kept apart, sampled as one union
// once per fixed step. From FloorFifty `apps/client/src/managers/input.ts` at `ac72660` (lines 42–60): one shared
// set let a keyup on the keyboard release a direction the controller still held, so each device keeps its own
// sources and an action is held while any source on any device drives it. Edges ("pressed") never reach the sim:
// `onPress` serves menus and the pause screen, and gameplay compares this tick's command with the last one's.
import { Context, Effect, type Scope, SubscriptionRef } from 'effect'
import type { PresentationBus } from '../presentation/presentation-bus.manager.js'
import { type GlyphFamily, glyphFamily } from './gamepad/glyph-family.js'
import { HandoverMask } from './gamepad/handover-mask.js'
import { NavRepeat } from './gamepad/nav-repeat.js'
import { type PadDirection, type PadLike, quantizeStick, readPad } from './gamepad/read-pad.js'
import type { GestureSink } from './gestures/swipe-tracker.js'
import {
  actionsForGesture,
  actionsForKey,
  actionsForPadButton,
  type GestureName,
  type InputProfile,
  type StickDirection,
} from './input-profile.schema.js'
import { isMenuActionLive, MENU_BINDINGS, type MenuAction } from './menu-actions.js'

export type InputDevice = 'keyboard' | 'gamepad' | 'touch'
/** The device of the last real input, and the button labels of the active pad (`generic` before any pad). */
export interface ActiveDevice {
  readonly device: InputDevice
  readonly glyphs: GlyphFamily
}
/** A connected pad. Only `standard` pads drive bindings (DX spec §3.3). */
export interface PadInfo {
  readonly index: number
  readonly id: string
  readonly standard: boolean
}
export type InputContextNow = 'play' | 'menu'

export interface Input {
  /** The actions held now, the union over devices, in first-press order. Read once per fixed step; never copied. */
  held(): ReadonlySet<string>
  /** The active pad's stick, each axis an integer in −127..127, centred inside the deadzone (M4-D2). */
  stick(side: 'left' | 'right'): { readonly x: number; readonly y: number }
  /** Menu and pause edges, never sent to the sim. Returns the unsubscribe. */
  onPress(action: MenuAction, listener: () => void): () => void
  /**
   * Reads the pads; the loop calls it once per fixed step, before `held()`. `nowMs` (the frame or step time)
   * paces the held-direction repeat in menus.
   */
  poll(nowMs?: number): void
  /** A touch button held or let go, by action. */
  hold(action: string): void
  release(action: string): void
  /**
   * Gestures from a `SwipeTracker` (M4.3), as touch: a held gesture holds its actions until released, and a pulse
   * (a flick or a tap) holds them for exactly one sample.
   */
  readonly gesture: GestureSink
  /** `play` during gameplay, `menu` while a screen pauses the sim or a modal is open. Releases what is held. */
  setContext(context: InputContextNow): void
  readonly device: SubscriptionRef.SubscriptionRef<ActiveDevice>
  readonly profile: SubscriptionRef.SubscriptionRef<InputProfile>
  /** The pads connected since this Input started, in connection order. */
  readonly pads: SubscriptionRef.SubscriptionRef<readonly PadInfo[]>
}

export const Input: Context.Tag<Input, Input> = Context.GenericTag<Input>('@mcthaydt/automata-runtime/Input')

export interface InputOptions {
  readonly target: Window
  readonly profile: InputProfile
  readonly bus: PresentationBus
}

const CENTRED = { x: 0, y: 0 } as const
const NO_DIRECTIONS: ReadonlySet<PadDirection> = new Set()
const NAV: Readonly<Record<PadDirection, MenuAction>> = {
  up: 'nav-up',
  down: 'nav-down',
  left: 'nav-left',
  right: 'nav-right',
}
const isNav = (action: MenuAction): boolean => action.startsWith('nav-')

/** Builds the Input over `target` for the scope's life: closing the scope removes every listener. */
export function makeInput(options: InputOptions): Effect.Effect<Input, never, Scope.Scope> {
  return Effect.gen(function* () {
    const { target, profile, bus } = options
    const device = yield* SubscriptionRef.make<ActiveDevice>({
      device: target.matchMedia?.('(pointer: coarse)').matches === true ? 'touch' : 'keyboard',
      glyphs: 'generic',
    })
    const pads = yield* SubscriptionRef.make<readonly PadInfo[]>([])
    const profileRef = yield* SubscriptionRef.make(profile)
    let context: InputContextNow = 'play'

    // Each pressed source (`key:<code>`, `pad:<pad>:<button>`, `touch:<action>`, `gesture:<name>`, and
    // `gesture:<name>:pulse`) and the actions it drives;
    // `count` is how many sources hold each action, and `held` the actions with a count, in first-press order.
    const sources = new Map<string, readonly string[]>()
    const count = new Map<string, number>()
    const held = new Set<string>()
    const listeners = new Map<MenuAction, Set<() => void>>()
    // The pulse latch (FloorFifty's InputManager latch): a pulse is pressed at once, seen by the next sample
    // (`poll()` then `held()`), and lifted by the poll after that, so a pulse between two steps is never lost. A
    // pulse again before it is lifted keeps it one more sample.
    let pulsed = new Set<string>()
    let sampled = new Set<string>()

    const isLive = (action: string): boolean => {
      const where = profile.bindings[action]?.context ?? 'play'
      return where === 'any' || where === context
    }
    const menuActionsFor = (
      matches: (binding: (typeof MENU_BINDINGS)[MenuAction]) => boolean,
    ): MenuAction[] =>
      (Object.keys(MENU_BINDINGS) as MenuAction[]).filter((action) => matches(MENU_BINDINGS[action]))

    let current: ActiveDevice = yield* SubscriptionRef.get(device)
    const become = (next: InputDevice, glyphs: GlyphFamily = current.glyphs): void => {
      if (next === current.device && glyphs === current.glyphs) return
      const previous = current.device
      current = { device: next, glyphs }
      Effect.runSync(SubscriptionRef.set(device, current))
      bus.publish('input.device.changed', { device: next, glyphs, previous })
    }
    const use = (next: InputDevice): void => become(next)

    const fire = (menu: readonly MenuAction[]): void => {
      for (const action of menu) {
        if (!isMenuActionLive(action, context)) continue
        for (const listener of listeners.get(action) ?? []) listener()
      }
    }

    /** A source went down: its live actions are held, its live menu actions fire once. A repeat changes nothing. */
    const press = (
      from: InputDevice,
      source: string,
      actions: readonly string[],
      menu: readonly MenuAction[],
    ) => {
      if (sources.has(source)) return
      use(from)
      const live = actions.filter(isLive)
      sources.set(source, live)
      for (const action of live) {
        const n = count.get(action) ?? 0
        count.set(action, n + 1)
        if (n === 0) held.add(action)
      }
      fire(menu)
    }
    const lift = (source: string): void => {
      const actions = sources.get(source)
      if (actions === undefined) return
      sources.delete(source)
      for (const action of actions) {
        const n = (count.get(action) ?? 1) - 1
        if (n > 0) count.set(action, n)
        else {
          count.delete(action)
          held.delete(action)
        }
      }
    }
    const liftWhere = (prefix: string | undefined): void => {
      for (const source of [...sources.keys()])
        if (prefix === undefined || source.startsWith(prefix)) lift(source)
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      const actions = actionsForKey(profile, event.code)
      // Keep Space and the arrows from scrolling the page while they drive the game.
      if (actions.some(isLive)) event.preventDefault()
      if (event.repeat) return
      press(
        'keyboard',
        `key:${event.code}`,
        actions,
        menuActionsFor((binding) => binding.keys.includes(event.code)),
      )
    }
    const onKeyUp = (event: KeyboardEvent): void => lift(`key:${event.code}`)
    // A key let go while another window has focus never sends its keyup. The pad keeps what it physically holds,
    // and its next poll re-asserts it (FloorFifty).
    const onBlur = (): void => {
      liftWhere('key:')
      liftWhere('touch:')
      liftWhere('gesture:')
    }
    // A bare event target (a replay's fake window) has no document, and so no visibility to follow.
    const page: Document | undefined = (target as Partial<Window>).document
    const onVisibility = (): void => {
      if (page?.visibilityState === 'hidden') liftWhere(undefined)
    }
    target.addEventListener('keydown', onKeyDown)
    target.addEventListener('keyup', onKeyUp)
    target.addEventListener('blur', onBlur)
    page?.addEventListener('visibilitychange', onVisibility)
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        target.removeEventListener('keydown', onKeyDown)
        target.removeEventListener('keyup', onKeyUp)
        target.removeEventListener('blur', onBlur)
        page?.removeEventListener('visibilitychange', onVisibility)
        liftWhere(undefined)
        listeners.clear()
      }),
    )

    // The buttons worth reading, fixed for the profile: the game's and the menu's.
    const watched = [
      ...new Set([
        ...Object.values(profile.bindings).flatMap((binding) => binding.pad),
        ...Object.values(MENU_BINDINGS).flatMap((binding) => binding.pad),
      ]),
    ].sort((a, b) => a - b)
    const padActions = new Map(watched.map((button) => [button, actionsForPadButton(profile, button)]))
    // Menu directions from a pad come through the repeat below, from the D-pad and the left stick alike.
    const padMenu = new Map(
      watched.map((button) => [
        button,
        menuActionsFor((binding) => binding.pad.includes(button)).filter((action) => !isNav(action)),
      ]),
    )
    const stickActions = new Map<StickDirection, string[]>()
    for (const [action, binding] of Object.entries(profile.bindings))
      for (const direction of binding.stick ?? [])
        stickActions.set(direction, [...(stickActions.get(direction) ?? []), action])

    // Per pad: what it read last (for the handover), its mask, and whether it was in use. The active pad is the
    // newest to start being used (FloorFifty `activeIndex`); its sticks and menu directions are the ones read.
    const lastRead = new Map<number, PadLike>()
    const masks = new Map<number, HandoverMask>()
    const inUse = new Map<number, boolean>()
    let activeIndex: number | undefined
    let activeAxes: readonly number[] = []
    const repeat = new NavRepeat()
    const maskFor = (index: number): HandoverMask => {
      const existing = masks.get(index)
      if (existing !== undefined) return existing
      const made = new HandoverMask()
      masks.set(index, made)
      return made
    }

    const readOnePad = (pad: PadLike): ReturnType<typeof readPad> => {
      lastRead.set(pad.index, pad)
      const raw = readPad(pad)
      const busy = raw.buttons.size > 0 || raw.sticks.size > 0
      if (busy && inUse.get(pad.index) !== true) {
        activeIndex = pad.index
        become('gamepad', glyphFamily(pad.id))
      }
      inUse.set(pad.index, busy)
      const seen = maskFor(pad.index).apply(pad)
      const reading = readPad(seen)
      for (const button of watched) {
        const source = `pad:${pad.index}:${button}`
        if (reading.buttons.has(button))
          press('gamepad', source, padActions.get(button) ?? [], padMenu.get(button) ?? [])
        else lift(source)
      }
      for (const [direction, actions] of stickActions) {
        const source = `pad:${pad.index}:stick:${direction}`
        if (reading.sticks.has(direction)) press('gamepad', source, actions, [])
        else lift(source)
      }
      if (pad.index === activeIndex) activeAxes = seen.axes
      return reading
    }

    const infoOf = (pad: PadLike): PadInfo => ({
      index: pad.index,
      id: pad.id,
      standard: pad.mapping === 'standard',
    })
    const onConnect = (event: Event): void => {
      const pad = (event as GamepadEvent).gamepad
      const info = infoOf(pad)
      Effect.runSync(
        SubscriptionRef.update(pads, (list) => [...list.filter((known) => known.index !== info.index), info]),
      )
      bus.publish('input.pad.connected', info)
    }
    // An unplugged pad lets go of everything it held at once; the next pad to be used becomes active.
    const onDisconnect = (event: Event): void => {
      const pad = (event as GamepadEvent).gamepad
      liftWhere(`pad:${pad.index}:`)
      lastRead.delete(pad.index)
      masks.delete(pad.index)
      inUse.delete(pad.index)
      const wasActive = activeIndex === pad.index
      if (wasActive) {
        activeIndex = undefined
        activeAxes = []
        repeat.clear()
      }
      Effect.runSync(
        SubscriptionRef.update(pads, (list) => list.filter((known) => known.index !== pad.index)),
      )
      bus.publish('input.pad.disconnected', { ...infoOf(pad), wasActive })
    }
    target.addEventListener('gamepadconnected', onConnect)
    target.addEventListener('gamepaddisconnected', onDisconnect)
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        target.removeEventListener('gamepadconnected', onConnect)
        target.removeEventListener('gamepaddisconnected', onDisconnect)
      }),
    )

    return {
      held: () => held,
      stick(side) {
        const first = side === 'left' ? 0 : 2
        const x = activeAxes[first] ?? 0
        const y = activeAxes[first + 1] ?? 0
        return x === 0 && y === 0 ? CENTRED : quantizeStick(x, y)
      },
      onPress(action, listener) {
        const set = listeners.get(action) ?? new Set()
        listeners.set(action, set)
        set.add(listener)
        return () => void set.delete(listener)
      },
      poll(nowMs = 0) {
        for (const source of sampled) if (!pulsed.has(source)) lift(source)
        const seen = sampled
        sampled = pulsed
        pulsed = seen
        pulsed.clear()
        let nav = NO_DIRECTIONS
        let activeSeen = false
        for (const pad of target.navigator.getGamepads?.() ?? []) {
          // Only the standard mapping is bound (DX spec §3.3).
          if (pad === null || !pad.connected || pad.mapping !== 'standard') continue
          const reading = readOnePad(pad)
          if (pad.index === activeIndex) {
            nav = reading.nav
            activeSeen = true
          }
        }
        if (!activeSeen) activeAxes = []
        fire(repeat.update(nav, nowMs).map((direction) => NAV[direction]))
      },
      hold(action) {
        press('touch', `touch:${action}`, profile.bindings[action] === undefined ? [] : [action], [])
      },
      release(action) {
        lift(`touch:${action}`)
      },
      gesture: {
        hold: (name: GestureName) => press('touch', `gesture:${name}`, actionsForGesture(profile, name), []),
        release: (name: GestureName) => lift(`gesture:${name}`),
        pulse(name: GestureName) {
          const source = `gesture:${name}:pulse`
          press('touch', source, actionsForGesture(profile, name), [])
          pulsed.add(source)
        },
      },
      setContext(next) {
        if (next === context) return
        context = next
        liftWhere(undefined)
        // What a pad holds as the context changes stays masked on the new side until let go (the handover).
        for (const [index, pad] of lastRead) maskFor(index).capture(pad)
        repeat.clear()
      },
      device,
      profile: profileRef,
      pads,
    }
  })
}
