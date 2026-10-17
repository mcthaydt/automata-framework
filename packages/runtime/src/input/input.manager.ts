// The Input service (M4 spec §4.2): keyboard, standard-pad buttons and touch, each kept apart, sampled as one union
// once per fixed step. From FloorFifty `apps/client/src/managers/input.ts` at `ac72660` (lines 42–60): one shared
// set let a keyup on the keyboard release a direction the controller still held, so each device keeps its own
// sources and an action is held while any source on any device drives it. Edges ("pressed") never reach the sim:
// `onPress` serves menus and the pause screen, and gameplay compares this tick's command with the last one's.
import { Context, Effect, type Scope, SubscriptionRef } from 'effect'
import type { PresentationBus } from '../presentation/presentation-bus.manager.js'
import { actionsForKey, actionsForPadButton, type InputProfile } from './input-profile.schema.js'
import { isMenuActionLive, MENU_BINDINGS, type MenuAction } from './menu-actions.js'

export type InputDevice = 'keyboard' | 'gamepad' | 'touch'
export type InputContextNow = 'play' | 'menu'

export interface Input {
  /** The actions held now, the union over devices, in first-press order. Read once per fixed step; never copied. */
  held(): ReadonlySet<string>
  /** A stick's quantized vector; centred until M4.2 reads sticks. */
  stick(side: 'left' | 'right'): { readonly x: number; readonly y: number }
  /** Menu and pause edges, never sent to the sim. Returns the unsubscribe. */
  onPress(action: MenuAction, listener: () => void): () => void
  /** Reads the pads; the loop calls it once per fixed step, before `held()`. */
  poll(): void
  /** A touch button held or let go, by action. */
  hold(action: string): void
  release(action: string): void
  /** `play` during gameplay, `menu` while a screen pauses the sim or a modal is open. Releases what is held. */
  setContext(context: InputContextNow): void
  readonly device: SubscriptionRef.SubscriptionRef<InputDevice>
  readonly profile: SubscriptionRef.SubscriptionRef<InputProfile>
}

export const Input: Context.Tag<Input, Input> = Context.GenericTag<Input>('@mcthaydt/automata-runtime/Input')

export interface InputOptions {
  readonly target: Window
  readonly profile: InputProfile
  readonly bus: PresentationBus
}

const CENTRED = { x: 0, y: 0 } as const

/** Builds the Input over `target` for the scope's life: closing the scope removes every listener. */
export function makeInput(options: InputOptions): Effect.Effect<Input, never, Scope.Scope> {
  return Effect.gen(function* () {
    const { target, profile, bus } = options
    const device = yield* SubscriptionRef.make<InputDevice>(
      target.matchMedia?.('(pointer: coarse)').matches === true ? 'touch' : 'keyboard',
    )
    const profileRef = yield* SubscriptionRef.make(profile)
    let context: InputContextNow = 'play'

    // Each pressed source (`key:<code>`, `pad:<pad>:<button>`, `touch:<action>`) and the actions it drives;
    // `count` is how many sources hold each action, and `held` the actions with a count, in first-press order.
    const sources = new Map<string, readonly string[]>()
    const count = new Map<string, number>()
    const held = new Set<string>()
    const listeners = new Map<MenuAction, Set<() => void>>()

    const isLive = (action: string): boolean => {
      const where = profile.bindings[action]?.context ?? 'play'
      return where === 'any' || where === context
    }
    const menuActionsFor = (
      matches: (binding: (typeof MENU_BINDINGS)[MenuAction]) => boolean,
    ): MenuAction[] =>
      (Object.keys(MENU_BINDINGS) as MenuAction[]).filter((action) => matches(MENU_BINDINGS[action]))

    let current: InputDevice = yield* SubscriptionRef.get(device)
    const use = (next: InputDevice): void => {
      if (next === current) return
      const previous = current
      current = next
      Effect.runSync(SubscriptionRef.set(device, next))
      bus.publish('input.device.changed', { device: next, previous })
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
    }
    const onVisibility = (): void => {
      if (target.document.visibilityState === 'hidden') liftWhere(undefined)
    }
    target.addEventListener('keydown', onKeyDown)
    target.addEventListener('keyup', onKeyUp)
    target.addEventListener('blur', onBlur)
    target.document.addEventListener('visibilitychange', onVisibility)
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        target.removeEventListener('keydown', onKeyDown)
        target.removeEventListener('keyup', onKeyUp)
        target.removeEventListener('blur', onBlur)
        target.document.removeEventListener('visibilitychange', onVisibility)
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
    const padMenu = new Map(
      watched.map((button) => [button, menuActionsFor((binding) => binding.pad.includes(button))]),
    )

    return {
      held: () => held,
      stick: () => CENTRED,
      onPress(action, listener) {
        const set = listeners.get(action) ?? new Set()
        listeners.set(action, set)
        set.add(listener)
        return () => void set.delete(listener)
      },
      poll() {
        const pads = target.navigator.getGamepads?.() ?? []
        for (const pad of pads) {
          // Only the standard mapping is bound (DX spec §3.3); another layout is M4.2's to report.
          if (pad === null || pad.mapping !== 'standard') continue
          for (const button of watched) {
            const source = `pad:${pad.index}:${button}`
            if (pad.buttons[button]?.pressed === true)
              press('gamepad', source, padActions.get(button) ?? [], padMenu.get(button) ?? [])
            else lift(source)
          }
        }
      },
      hold(action) {
        press('touch', `touch:${action}`, profile.bindings[action] === undefined ? [] : [action], [])
      },
      release(action) {
        lift(`touch:${action}`)
      },
      setContext(next) {
        if (next === context) return
        context = next
        liftWhere(undefined)
      },
      device,
      profile: profileRef,
    }
  })
}
