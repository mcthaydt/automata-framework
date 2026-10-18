// The default Settings screen (M4 spec §4.5, §4.8, §5 "Rebind", M4-D8), reached from paused. Its menu Input has the
// game's bindings and its settings, so a rebind saves through the settings store (memory first, then
// `Hosting.saves`) and the next play session's Input reads it. The view's state is a `$state` object the screen
// changes in place: a rebind, a pad connecting, a device switch or a capture's countdown never remount it.
import {
  displaySettingsSchema,
  Flow,
  type InputProfile,
  inputSettingsSchema,
  makeInput,
  PresentationBus,
  REBIND_TIMEOUT_MS,
  type ScreenDef,
  Settings,
  type TouchMode,
  touchModesFor,
} from '@mcthaydt/automata-runtime'
import { resolveExtensions } from '@mcthaydt/automata-runtime/extension'
import {
  type ControlsRow,
  type ControlsState,
  type DisplayQuality,
  type RebindDevice,
  readKeyboardLayout,
  reducedMotion,
  sendBack,
} from '@mcthaydt/automata-ui'
import { Effect, Either, Fiber, Runtime, Schedule, SubscriptionRef } from 'effect'
import type { ScreensGame } from './default-screens.ts'
import SettingsView from './SettingsView.svelte'
import { backGesture, driveMenu, hostInput, listen, NO_BINDINGS, show, windowOf } from './screen-kit.ts'
import type { SettingsViewState } from './settings-view.ts'

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {}

/** One row per action, in the profile's order, named by the input map's labels. */
function rowsOf(profile: InputProfile, labels: Readonly<Record<string, string>>): ControlsRow[] {
  return Object.entries(profile.bindings).map(([id, binding]) => ({
    id,
    label: labels[id] ?? id,
    binding: { keys: binding.keys, pad: binding.pad, touch: binding.touch },
  }))
}

/** A pad with the standard mapping is connected now (the Settings Input has seen no `gamepadconnected` yet). */
const padConnected = (target: Window): boolean =>
  [...(target.navigator.getGamepads?.() ?? [])].some(
    (pad) => pad?.connected === true && pad.mapping === 'standard',
  )

export function settingsScreen(game: ScreensGame): ScreenDef {
  return {
    id: 'settings',
    pausesSim: true,
    enter: ({ layer }) =>
      Effect.gen(function* () {
        const flow = yield* Flow
        const bus = yield* PresentationBus
        const { store } = yield* Settings
        const runtime = yield* Effect.runtime<never>()
        const target = windowOf(layer)
        const map = game.input

        const input = yield* makeInput({
          target,
          profile: map?.profile ?? NO_BINDINGS,
          bus,
          settings: store,
          hostInput: yield* hostInput,
        })
        input.setContext('menu')
        const savedInput = () => inputSettingsSchema.parse(asRecord(store?.get()).input)
        const savedQuality = (): DisplayQuality =>
          displaySettingsSchema
            .catch(() => ({ quality: 'high' as const }))
            .parse(asRecord(store?.get()).display).quality

        const view: SettingsViewState = $state({
          rows:
            map === undefined
              ? undefined
              : rowsOf(Effect.runSync(SubscriptionRef.get(input.profile)), map.labels),
          devices: padConnected(target) ? ['keyboard', 'gamepad'] : ['keyboard'],
          glyphs: Effect.runSync(SubscriptionRef.get(input.device)).glyphs,
          controls: { kind: 'list' },
          layout: undefined,
          touchModes: map === undefined ? [] : touchModesFor(map.profile),
          touchMode: savedInput().touchMode ?? map?.touchMode ?? 'buttons',
          quality: savedQuality(),
          reducedMotion: reducedMotion(target),
        })
        void readKeyboardLayout(target.navigator).then((layout) => {
          view.layout = layout
        })
        const stops = [
          bus.subscribe('input.bindings.changed', () => {
            if (map !== undefined)
              view.rows = rowsOf(Effect.runSync(SubscriptionRef.get(input.profile)), map.labels)
          }),
          bus.subscribe('input.pad.connected', (pad) => {
            if (pad.standard && !view.devices.includes('gamepad')) view.devices = ['keyboard', 'gamepad']
          }),
          bus.subscribe('input.device.changed', ({ glyphs }) => {
            view.glyphs = glyphs
          }),
        ]
        yield* Effect.addFinalizer(() =>
          Effect.sync(() => {
            for (const stop of stops) stop()
          }),
        )

        // One rebind at a time: capture, then rebind, the countdown ticking on Effect's clock meanwhile.
        let running: Fiber.RuntimeFiber<void> | undefined
        yield* Effect.addFinalizer(() => (running === undefined ? Effect.void : Fiber.interrupt(running)))
        const settle = (
          action: string,
          result: Either.Either<unknown, { readonly _tag: string }>,
        ): ControlsState => {
          if (Either.isRight(result)) return { kind: 'saved', action }
          const error = result.left as { readonly _tag: string; readonly with?: string }
          switch (error._tag) {
            case 'RebindConflict':
              return { kind: 'conflict', action, with: error.with ?? '' }
            case 'RebindReserved':
              return { kind: 'reserved', action }
            case 'RebindTimedOut':
              return { kind: 'timed-out', action }
            default:
              return { kind: 'list' }
          }
        }
        const onrebind = (action: string, device: RebindDevice): void => {
          if (running !== undefined) return
          const seconds = REBIND_TIMEOUT_MS / 1000
          view.controls = { kind: 'capturing', action, device, secondsLeft: seconds }
          const countdown = Effect.sync(() => {
            const now = view.controls
            if (now.kind === 'capturing')
              view.controls = { ...now, secondsLeft: Math.max(0, now.secondsLeft - 1) }
          }).pipe(Effect.delay('1 second'), Effect.repeat(Schedule.recurs(seconds - 1)))
          running = Runtime.runFork(runtime)(
            Effect.gen(function* () {
              const ticking = yield* Effect.fork(countdown)
              const result = yield* Effect.either(
                input
                  .capture(device)
                  .pipe(Effect.flatMap((capture) => input.rebind(action, device, capture))),
              )
              yield* Fiber.interrupt(ticking)
              view.controls = settle(action, result)
              running = undefined
            }),
          )
        }

        const back = (): void => void flow.dispatch('back')
        yield* show(SettingsView, layer, {
          view,
          extensions: resolveExtensions(game.extensions ?? []).slots('settings.sections'),
          onrebind,
          onreset: () => {
            Effect.runSync(input.resetBindings)
            view.controls = { kind: 'list' }
          },
          ontouchmode: (mode: TouchMode) => {
            view.touchMode = mode
            store?.update((value) => ({
              ...asRecord(value),
              input: { ...savedInput(), touchMode: mode },
            }))
          },
          onquality: (quality: DisplayQuality) => {
            view.quality = quality
            store?.update((value) => ({
              ...asRecord(value),
              display: { ...asRecord(asRecord(value).display), quality },
            }))
            game.setQuality?.(quality)
          },
          onback: back,
        })
        // Escape and pad B go back; while a capture waits it takes Escape first, and B never reaches the menu.
        yield* listen(target, 'keydown', (event) => {
          if (event.code !== 'Escape' || event.repeat) return
          event.preventDefault()
          back()
        })
        yield* backGesture(target, () => sendBack(layer.ownerDocument))
        yield* driveMenu(target, input)
      }),
  }
}
