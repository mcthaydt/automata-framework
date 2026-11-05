// The Input service (M4 spec §4.2): keyboard, standard-pad buttons and touch, each kept apart, sampled as one union
// once per fixed step. From FloorFifty `apps/client/src/managers/input.ts` at `ac72660` (lines 42–60): one shared
// set let a keyup on the keyboard release a direction the controller still held, so each device keeps its own
// sources and an action is held while any source on any device drives it. Edges ("pressed") never reach the sim:
// `onPress` serves menus and the pause screen, and gameplay compares this tick's command with the last one's.

import { Context, Duration, Effect, Either, type Scope, Stream, SubscriptionRef } from 'effect'
import type { Hosting } from '../../shared/host/hosting.ts'
import type { PresentationBus } from '../../shared/runtime/presentation/presentation-bus.manager.js'
import type { SettingsStore } from '../settings/settings.manager.js'
import { makeAnalogInput, type TouchStickSink } from './analog/analog-input.js'
import { type InputSettings, inputSettingsSchema } from './bindings/input-settings.schema.js'
import {
  applyOverrides,
  type Capture,
  RebindCancelled,
  type RebindError,
  RebindTimedOut,
  rebindProfile,
} from './bindings/rebind.js'
import { type GlyphFamily, glyphFamily } from './gamepad/glyph-family.js'
import { HandoverMask } from './gamepad/handover-mask.js'
import { NavRepeat } from './gamepad/nav-repeat.js'
import { type PadDirection, type PadLike, readPad } from './gamepad/read-pad.js'
import type { DragSink } from './gestures/camera-drag-tracker.js'
import type { GestureSink } from './gestures/swipe-tracker.js'
import type { ActiveDevice, InputContextNow, InputDevice, PadInfo } from './input-device.js'
import {
  actionsForGesture,
  actionsForKey,
  actionsForPadButton,
  type GestureName,
  type InputProfile,
  type StickDirection,
} from './input-profile.schema.js'
import { isMenuActionLive, MENU_BINDINGS, type MenuAction } from './menu-actions.js'

/**
 * The input service (M4 spec §4.2): held actions from keys, pads, touch buttons and gestures under the game's
 * profile and the player's overrides, menu edges, the active device and pads, and rebinding.
 */
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
  /** The overlay's move stick (M4.12): while held it is `stick('left')` and drives the `left-*` directions. */
  readonly touchStick: TouchStickSink
  /** Where a `CameraDragTracker` sends its pixels (M4.12). */
  readonly drag: DragSink
  /** CSS px dragged to the right between the previous two `poll()`s; 0 unless a live action binds `camera-drag`. */
  cameraDrag(): number
  /** `play` during gameplay, `menu` while a screen pauses the sim or a modal is open. Releases what is held. */
  setContext(context: InputContextNow): void
  readonly device: SubscriptionRef.SubscriptionRef<ActiveDevice>
  readonly profile: SubscriptionRef.SubscriptionRef<InputProfile>
  /** The pads connected since this Input started, in connection order. */
  readonly pads: SubscriptionRef.SubscriptionRef<readonly PadInfo[]>
  /**
   * Binds the captured key or pad button to `action` on `device` (M4 spec §4.5, M4-D4), saved in the settings'
   * `input` when the Input has settings; refused, with nothing changed, by `RebindError`.
   */
  rebind(action: string, device: 'keyboard' | 'gamepad', capture: Capture): Effect.Effect<void, RebindError>
  /** Every binding back to the game's profile. */
  readonly resetBindings: Effect.Effect<void>
  /**
   * The next key (`keyboard`) or pad button (`gamepad`) pressed, for `rebind`. Escape or pad B cancels; nothing
   * for `REBIND_TIMEOUT_MS` on Effect's Clock times out. While it waits, every key it sees goes no further, and the
   * pads drive nothing else.
   */
  capture(device: 'keyboard' | 'gamepad'): Effect.Effect<Capture, RebindCancelled | RebindTimedOut>
}

/** How long `capture` waits for a press (M4 spec §4.2, §6). */
export const REBIND_TIMEOUT_MS = 10_000
/** Pad B, which backs out of a menu, cancels a capture. */
const CANCEL_BUTTON = 1

export const Input: Context.Tag<Input, Input> = Context.GenericTag<Input>('@mcthaydt/automata-runtime/Input')

/**
 * What the input service listens to: the window, the game's profile, the bus, and optionally the settings and
 * the host's input mode.
 */
export interface InputOptions {
  readonly target: Window
  /** The game's bindings, before the player's overrides. */
  readonly profile: InputProfile
  readonly bus: PresentationBus
  /**
   * The game's settings, whose `input` field (`inputSettingsSchema`) holds the player's overrides: they apply at
   * once and on every change, and `rebind` writes them. Without settings a rebind lasts for this Input only.
   */
  readonly settings?: SettingsStore<unknown> | undefined
  /** Under a host, its input mode (`Hosting.input`): where the active device starts, and a pad it reports. */
  readonly hostInput?: Hosting['input'] | undefined
}

/** What the host says the player is using (Ruken's `InputModePayload`, through `Hosting.input`). */
export type HostInputMode = Effect.Effect.Success<Hosting['input']['get']>

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
    const { target, profile: defaults, bus, settings } = options
    const savedIn = (value: unknown): InputSettings =>
      inputSettingsSchema.parse(
        value !== null && typeof value === 'object' ? (value as Record<string, unknown>).input : undefined,
      )
    let saved = settings === undefined ? inputSettingsSchema.parse(undefined) : savedIn(settings.get())
    const first = applyOverrides(defaults, saved)
    if (first.dropped.length > 0)
      yield* Effect.logWarning(`input: saved bindings for ${first.dropped.join(', ')} were dropped`)
    let profile = first.profile
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

    // The host's input mode is a source of the active device too (M4 spec §4.2, §5 step 3): it sets the device the
    // session starts on, and a pad it reports later becomes active, with the layout's glyphs (Ruken names only
    // `xbox` and `other`, R-1). The last real input still wins.
    const HOST_DEVICE = { touch: 'touch', 'keyboard-mouse': 'keyboard', gamepad: 'gamepad' } as const
    const followHost = (payload: HostInputMode): void => {
      const layout = payload.gamepad?.layout
      become(
        HOST_DEVICE[payload.mode],
        layout === undefined ? current.glyphs : layout === 'xbox' ? 'xbox' : 'generic',
      )
    }
    if (options.hostInput !== undefined) {
      followHost(yield* options.hostInput.get)
      // `changes` starts with the value at subscription, so a change made before the fiber subscribes is not lost;
      // following the same value twice changes nothing.
      yield* Stream.runForEach(options.hostInput.changes, (payload) =>
        Effect.sync(() => {
          if (payload.mode === 'gamepad') followHost(payload)
        }),
      ).pipe(Effect.forkScoped)
    }

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

    const analog = makeAnalogInput({
      press: (from, source, actions) => press(from, source, actions, []),
      lift,
      use,
      stickActions: (direction) => tables.stickActions.get(direction) ?? [],
      dragLive: () => actionsForGesture(profile, 'camera-drag').some(isLive),
    })

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
      analog.release()
    }
    // A bare event target (a replay's fake window) has no document, and so no visibility to follow.
    const page: Document | undefined = (target as Partial<Window>).document
    const onVisibility = (): void => {
      if (page?.visibilityState !== 'hidden') return
      liftWhere(undefined)
      analog.release()
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

    // The buttons worth reading for the profile, the game's and the menu's, and what each drives. Rebuilt when the
    // bindings change (`setProfile`).
    const tablesFor = (bound: InputProfile) => {
      const watched = [
        ...new Set([
          ...Object.values(bound.bindings).flatMap((binding) => binding.pad),
          ...Object.values(MENU_BINDINGS).flatMap((binding) => binding.pad),
        ]),
      ].sort((a, b) => a - b)
      const padActions = new Map(watched.map((button) => [button, actionsForPadButton(bound, button)]))
      // Menu directions from a pad come through the repeat below, from the D-pad and the left stick alike.
      const padMenu = new Map(
        watched.map((button) => [
          button,
          menuActionsFor((binding) => binding.pad.includes(button)).filter((action) => !isNav(action)),
        ]),
      )
      const stickActions = new Map<StickDirection, string[]>()
      for (const [action, binding] of Object.entries(bound.bindings))
        for (const direction of binding.stick ?? [])
          stickActions.set(direction, [...(stickActions.get(direction) ?? []), action])
      return { watched, padActions, padMenu, stickActions }
    }
    let tables = tablesFor(profile)

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
      for (const button of tables.watched) {
        const source = `pad:${pad.index}:${button}`
        if (reading.buttons.has(button))
          press('gamepad', source, tables.padActions.get(button) ?? [], tables.padMenu.get(button) ?? [])
        else lift(source)
      }
      for (const [direction, actions] of tables.stickActions) {
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

    // A capture in progress: per pad, the buttons already down when it started (a confirm still held from opening
    // it), which never count until let go.
    let capturing:
      | {
          readonly device: 'keyboard' | 'gamepad'
          readonly downBefore: Map<number, Set<number>>
          finish(result: Capture | undefined): void
        }
      | undefined
    const pressedOn = (pad: PadLike): Set<number> => {
      const down = new Set<number>()
      pad.buttons.forEach((button, index) => {
        if (button.pressed) down.add(index)
      })
      return down
    }
    /** The pads during a capture: the first new press is the capture, or B cancels it. Nothing else is driven. */
    const pollCapture = (pads: readonly (PadLike | null)[]): void => {
      if (capturing === undefined) return
      for (const pad of pads) {
        if (pad === null || !pad.connected || pad.mapping !== 'standard') continue
        const down = pressedOn(pad)
        const before = capturing.downBefore.get(pad.index) ?? new Set(down)
        for (const button of before) if (!down.has(button)) before.delete(button)
        capturing.downBefore.set(pad.index, before)
        const fresh = [...down].filter((button) => !before.has(button))
        if (fresh.length === 0) continue
        if (fresh.includes(CANCEL_BUTTON)) {
          capturing.finish(undefined)
          return
        }
        if (capturing.device === 'gamepad') {
          capturing.finish({ button: fresh[0] as number })
          return
        }
      }
    }
    const onCaptureKey = (event: KeyboardEvent): void => {
      if (capturing === undefined) return
      event.preventDefault()
      event.stopImmediatePropagation()
      if (event.repeat) return
      if (event.code === 'Escape') capturing.finish(undefined)
      else if (capturing.device === 'keyboard') capturing.finish({ code: event.code })
    }

    /** New bindings: what is held is let go, so nothing stays held by an input that no longer drives it. */
    const setProfile = (next: InputProfile, action?: string): void => {
      profile = next
      tables = tablesFor(next)
      liftWhere(undefined)
      analog.release()
      Effect.runSync(SubscriptionRef.set(profileRef, next))
      bus.publish('input.bindings.changed', action === undefined ? {} : { action })
    }
    // Another Input on the same settings rebound (the Settings screen's, while play's waits): follow it.
    const savedKey = (value: InputSettings): string => JSON.stringify(value)
    let appliedKey = savedKey(saved)
    if (settings !== undefined) {
      const stop = settings.subscribe((value) => {
        const next = savedIn(value)
        const key = savedKey(next)
        if (key === appliedKey) return
        appliedKey = key
        saved = next
        setProfile(applyOverrides(defaults, next).profile)
      })
      yield* Effect.addFinalizer(() => Effect.sync(stop))
    }
    /** Saves `next` (memory first, then the host, as the settings store does) and applies it here at once. */
    const commit = (next: InputSettings, action?: string): void => {
      saved = next
      appliedKey = savedKey(next)
      setProfile(applyOverrides(defaults, next).profile, action)
      settings?.update((value) => ({
        ...(value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {}),
        input: next,
      }))
    }

    return {
      held: () => held,
      stick: (side) => analog.stick(side, activeAxes),
      onPress(action, listener) {
        const set = listeners.get(action) ?? new Set()
        listeners.set(action, set)
        set.add(listener)
        return () => void set.delete(listener)
      },
      poll(nowMs = 0) {
        if (capturing !== undefined) {
          pollCapture(target.navigator.getGamepads?.() ?? [])
          return
        }
        analog.sample()
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
      touchStick: analog.touchStick,
      drag: analog.drag,
      cameraDrag: analog.cameraDrag,
      setContext(next) {
        if (next === context) return
        context = next
        liftWhere(undefined)
        analog.release()
        // What a pad holds as the context changes stays masked on the new side until let go (the handover).
        for (const [index, pad] of lastRead) maskFor(index).capture(pad)
        repeat.clear()
      },
      device,
      profile: profileRef,
      pads,
      rebind: (action, rebound, capture) =>
        Effect.suspend(() => {
          const result = rebindProfile(defaults, profile, action, rebound, capture)
          if (Either.isLeft(result)) return Effect.fail(result.left)
          commit({ ...saved, profile: defaults.id, overrides: result.right }, action)
          return Effect.void
        }),
      resetBindings: Effect.sync(() => commit({ ...saved, profile: defaults.id, overrides: {} })),
      capture: (wanted) =>
        Effect.async<Capture, RebindCancelled>((resume) => {
          capturing?.finish(undefined)
          const downBefore = new Map<number, Set<number>>()
          for (const [index, pad] of lastRead) downBefore.set(index, pressedOn(pad))
          const stop = (): void => {
            capturing = undefined
            target.removeEventListener('keydown', onCaptureKey, { capture: true })
            // What a pad holds now stays masked until let go, so the captured press does not also confirm.
            for (const pad of target.navigator.getGamepads?.() ?? [])
              if (pad?.connected) {
                lastRead.set(pad.index, pad)
                maskFor(pad.index).capture(pad)
              }
          }
          capturing = {
            device: wanted,
            downBefore,
            finish(result) {
              stop()
              resume(
                result === undefined
                  ? Effect.fail(new RebindCancelled({ device: wanted }))
                  : Effect.succeed(result),
              )
            },
          }
          target.addEventListener('keydown', onCaptureKey, { capture: true })
          return Effect.sync(stop)
        }).pipe(
          Effect.timeoutFail({
            duration: Duration.millis(REBIND_TIMEOUT_MS),
            onTimeout: () => new RebindTimedOut({ device: wanted }),
          }),
        ),
    }
  })
}
