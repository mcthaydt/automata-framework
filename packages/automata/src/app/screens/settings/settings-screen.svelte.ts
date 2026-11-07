// The default Settings screen, reached from paused. Its menu Input has the
// game's bindings and its settings, so a rebind saves through the settings store (memory first, then
// `Hosting.saves`) and the next play session's Input reads it. The view's state is a `$state` object the screen
// changes in place: a rebind, a pad connecting, a device switch or a capture's countdown never remount it.

import { resolveExtensions } from '../../../features/extension/resolve-extensions.ts'
import { inputSettingsSchema } from '../../../features/input/bindings/input-settings.schema.ts'
import { REBIND_TIMEOUT_MS } from '../../../features/input/input.manager.ts'
import {
  type InputProfile,
  type TouchMode,
  touchModesFor,
} from '../../../features/input/input-profile.schema.ts'
import type { Result } from '../../../shared/lib/result.ts'
import { displaySettingsSchema } from '../../../shared/runtime/display-settings.schema.ts'
import { InputMethodTracker } from '../../../shared/ui/browser/input-method.svelte.ts'
import { reducedMotion } from '../../../shared/ui/browser/reduced-motion.ts'
import { sendBack } from '../../../shared/ui/focus/back-gesture.ts'
import { readKeyboardLayout } from '../../../shared/ui/prompts/prompt-label.ts'
import type { ScreenDef } from '../../flow/screen.ts'
import type { ScreensGame } from '../default-screens.ts'
import {
  backGesture,
  driveMenu,
  hostInput,
  NO_BINDINGS,
  noticeUnsupportedPads,
  ownInput,
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
    enter: ({ layer, screen, services }) => {
      const { flow, bus, hosting, locale, haptics, clock } = services
      const { store } = services.settings
      const audio = services.audio
      const buses = services.audio
      const copy = screensCopy(screen, game.copy, locale)
      const target = windowOf(layer)
      const map = game.input

      const input = ownInput(screen, {
        target,
        profile: map?.profile ?? NO_BINDINGS,
        bus,
        clock,
        settings: store,
        hostInput: hostInput(hosting),
      })
      input.setContext('menu')
      const savedInput = () => inputSettingsSchema.parse(asRecord(store?.get()).input)
      const savedQuality = (): DisplayQuality =>
        displaySettingsSchema
          .catch(() => ({ quality: 'high' as const }))
          .parse(asRecord(store?.get()).display).quality

      const view: SettingsViewState = $state({
        rows: map === undefined ? undefined : rowsOf(input.profile.get(), map.labels),
        devices: padConnected(target) ? ['keyboard', 'gamepad'] : ['keyboard'],
        coarse: target.matchMedia?.('(pointer: coarse)').matches === true,
        glyphs: input.device.get().glyphs,
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
        audioAvailable: audio.available.get(),
        hostVolumeBelowFull: hosting.audio.get().master.volume < 1,
        reducedMotion: reducedMotion(target),
      })
      // The device in the player's hand leads the Controls tab: a key or a finger as play's touch buttons see it
      // (InputMethodTracker), a pad press through the Input's device.
      const tracker = new InputMethodTracker()
      screen.add(tracker.attach(target))
      void readKeyboardLayout(target.navigator).then((layout) => {
        view.layout = layout
      })
      const stops = [
        bus.subscribe('input.bindings.changed', () => {
          if (map !== undefined) view.rows = rowsOf(input.profile.get(), map.labels)
        }),
        bus.subscribe('input.pad.connected', (pad) => {
          if (pad.standard && !view.devices.includes('gamepad')) view.devices = ['keyboard', 'gamepad']
        }),
        bus.subscribe('input.device.changed', ({ device, glyphs }) => {
          tracker.note(device)
          view.glyphs = glyphs
        }),
      ]
      for (const stop of stops) screen.add(stop)

      // Sound that fails to start, and the host's volume, change the Audio group in place.
      screen.add(
        audio.available.subscribe((available) => {
          view.audioAvailable = available
        }),
      )
      screen.add(
        hosting.audio.subscribe((change) => {
          view.hostVolumeBelowFull = change.master.volume < 1
        }),
      )
      const onaudio = (change: AudioSectionChange): void => {
        const now = view.audio
        view.audio =
          change.kind === 'gain'
            ? { ...now, gains: { ...now.gains, [change.bus]: change.value } }
            : { ...now, [change.kind]: change.value }
        changeAudio({ audio, buses }, store, view.audio)
      }

      // One rebind at a time: capture, then rebind, the countdown ticking on the runtime's clock meanwhile. Leaving
      // the screen aborts the capture and stops the countdown.
      let running: AbortController | undefined
      screen.add(() => running?.abort())
      const settle = (action: string, result: Result<unknown, { readonly _tag: string }>): ControlsState => {
        if (result.ok) return { kind: 'saved', action }
        const error = result.reason as { readonly _tag: string; readonly with?: string }
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
        const abort = new AbortController()
        running = abort
        // One tick a second, `seconds` ticks at most, until the capture answers.
        let tick: unknown
        const countdown = (left: number): void => {
          if (left === 0) return
          tick = clock.setTimeout(() => {
            const now = view.controls
            if (now.kind === 'capturing')
              view.controls = { ...now, secondsLeft: Math.max(0, now.secondsLeft - 1) }
            countdown(left - 1)
          }, 1000)
        }
        countdown(seconds)
        abort.signal.addEventListener('abort', () => clock.clearTimeout(tick))
        void input.capture(device, abort.signal).then((caught) => {
          clock.clearTimeout(tick)
          if (abort.signal.aborted) return
          const result = caught.ok ? input.rebind(action, device, caught.value) : caught
          view.controls = settle(action, result)
          running = undefined
        })
      }

      const back = (): void => void flow.dispatch('back')
      show(screen, SettingsView, layer, {
        copy,
        view,
        tracker,
        extensions: resolveExtensions(game.extensions ?? []).slots('settings.sections'),
        onrebind,
        onreset: () => {
          input.resetBindings()
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
      backGesture(screen, target, hosting, () => sendBack(layer.ownerDocument))
      driveMenu(screen, target, services, input)
      noticeUnsupportedPads(screen, services, layer, toldPads, () => copy.current.padUnsupported)
    },
  }
}
