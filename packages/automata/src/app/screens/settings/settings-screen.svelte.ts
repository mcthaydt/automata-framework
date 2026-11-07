// The default Settings screen, reached from paused. Its menu Input has the
// game's bindings and its settings, so a rebind saves through the settings store (memory first, then
// `Hosting.saves`) and the next play session's Input reads it. The view's state is a `$state` object the screen
// changes in place: a rebind, a pad connecting, a device switch or a capture's countdown never remount it.

import { Effect, Either, Fiber, Runtime, Schedule, Stream, SubscriptionRef } from 'effect'
import { Audio } from '../../../features/audio/audio.manager.ts'
import { AudioBuses } from '../../../features/audio/audio-buses.ts'
import { resolveExtensions } from '../../../features/extension/resolve-extensions.ts'
import { inputSettingsSchema } from '../../../features/input/bindings/input-settings.schema.ts'
import { Haptics } from '../../../features/input/haptics/haptics.manager.ts'
import { makeInput, REBIND_TIMEOUT_MS } from '../../../features/input/input.manager.ts'
import {
  type InputProfile,
  type TouchMode,
  touchModesFor,
} from '../../../features/input/input-profile.schema.ts'
import { Locale } from '../../../features/locale/locale.manager.ts'
import { Hosting } from '../../../shared/host/hosting.ts'
import { displaySettingsSchema } from '../../../shared/runtime/display-settings.schema.ts'
import { PresentationBus } from '../../../shared/runtime/presentation/presentation-bus.manager.ts'
import { Settings } from '../../../shared/runtime/settings/settings.manager.ts'
import { InputMethodTracker } from '../../../shared/ui/browser/input-method.svelte.ts'
import { reducedMotion } from '../../../shared/ui/browser/reduced-motion.ts'
import { sendBack } from '../../../shared/ui/focus/back-gesture.ts'
import { readKeyboardLayout } from '../../../shared/ui/prompts/prompt-label.ts'
import { Flow } from '../../flow/flow.manager.ts'
import type { ScreenDef } from '../../flow/screen.ts'
import type { ScreensGame } from '../default-screens.ts'
import {
  backGesture,
  driveMenu,
  hostInput,
  NO_BINDINGS,
  noticeUnsupportedPads,
  show,
  windowOf,
} from '../screen-kit.ts'
import { screensCopy } from '../screens-copy.svelte.ts'
import type { AudioBus, AudioSectionChange } from './audio-section.ts'
import { changeAudio, savedAudio } from './audio-settings.ts'
import type { ControlsRow, ControlsState, RebindDevice } from './controls-section.ts'
import type { DisplayQuality } from './display-section.ts'
import { changeHaptics, savedHaptics } from './haptics-settings.ts'
import SettingsView from './SettingsView.svelte'
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

/** `toldPads`: the session's pads already told they are not supported (`noticeUnsupportedPads`). */
export function settingsScreen(game: ScreensGame, toldPads: Set<string> = new Set()): ScreenDef {
  return {
    id: 'settings',
    pausesSim: true,
    enter: ({ layer }) =>
      Effect.gen(function* () {
        const flow = yield* Flow
        const bus = yield* PresentationBus
        const { store } = yield* Settings
        const audio = yield* Audio
        const buses = yield* AudioBuses
        const hosting = yield* Hosting
        const locale = yield* Locale
        const copy = yield* screensCopy(game.copy, locale)
        const haptics = yield* Haptics
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
          coarse: target.matchMedia?.('(pointer: coarse)').matches === true,
          glyphs: Effect.runSync(SubscriptionRef.get(input.device)).glyphs,
          controls: { kind: 'list' },
          layout: undefined,
          touchModes: map === undefined ? [] : touchModesFor(map.profile),
          touchMode: savedInput().touchMode ?? map?.touchMode ?? 'buttons',
          quality: savedQuality(),
          audio: savedAudio(store),
          locales: locale.locales,
          hapticsSupported: haptics.supported,
          hapticsEnabled: savedHaptics(store),
          localeChoice: locale.choice,
          audioAvailable: yield* audio.available.get,
          hostVolumeBelowFull: (yield* hosting.audio.get).master.volume < 1,
          reducedMotion: reducedMotion(target),
        })
        // The device in the player's hand leads the Controls tab: a key or a finger as play's touch buttons see it
        // (InputMethodTracker), a pad press through the Input's device.
        const tracker = new InputMethodTracker()
        const detach = tracker.attach(target)
        yield* Effect.addFinalizer(() => Effect.sync(detach))
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
          bus.subscribe('input.device.changed', ({ device, glyphs }) => {
            tracker.note(device)
            view.glyphs = glyphs
          }),
        ]
        yield* Effect.addFinalizer(() =>
          Effect.sync(() => {
            for (const stop of stops) stop()
          }),
        )

        // Sound that fails to start, and the host's volume, change the Audio group in place.
        yield* Effect.forkScoped(
          Stream.runForEach(audio.available.changes, (available) =>
            Effect.sync(() => {
              view.audioAvailable = available
            }),
          ),
        )
        yield* Effect.forkScoped(
          Stream.runForEach(hosting.audio.changes, (change) =>
            Effect.sync(() => {
              view.hostVolumeBelowFull = change.master.volume < 1
            }),
          ),
        )
        const onaudio = (change: AudioSectionChange): void => {
          const now = view.audio
          view.audio =
            change.kind === 'gain'
              ? { ...now, gains: { ...now.gains, [change.bus]: change.value } }
              : { ...now, [change.kind]: change.value }
          changeAudio({ audio, buses }, store, view.audio)
        }

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
          copy,
          view,
          tracker,
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
          onaudio,
          onsample: (bus: AudioBus) => audio.sample(bus),
          onhaptics: (enabled: boolean) => {
            view.hapticsEnabled = enabled
            changeHaptics(haptics, store, enabled)
          },
          onlocale: (choice: string | null) => {
            locale.set(choice)
            view.localeChoice = locale.choice
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
        // Escape and pad B (which arrives as Escape) go back through the dialog (`Modal`); while a capture waits, the
        // Input takes Escape first and stops it.
        yield* backGesture(target, () => sendBack(layer.ownerDocument))
        yield* driveMenu(target, input)
        yield* noticeUnsupportedPads(layer, toldPads, () => copy.current.padUnsupported)
      }),
  }
}
