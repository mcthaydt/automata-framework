// TEMPORARY (task 5.4): the Effect tags of features that are already plain TypeScript, for the parts of the runtime
// that still read services from an Effect context (boot, the default screens). Deleted when `app/` is converted.
import { Context, Effect, type Scope } from 'effect'
import type { Audio as AudioService } from '../../features/audio/audio.manager.ts'
import type { AudioBuses as AudioBusesService } from '../../features/audio/audio-buses.ts'
import type { Haptics as HapticsService } from '../../features/input/haptics/haptics.manager.ts'
import type { Leaderboards as LeaderboardsService } from '../../features/leaderboards/leaderboards.manager.ts'
import type { Locale as LocaleService } from '../../features/locale/locale.manager.ts'
import type { SaveDef } from '../../features/saves/save.schema.ts'
import { createSaves, type Saves as SavesService } from '../../features/saves/saves.manager.ts'
import { effectClock, toPlainHosting } from '../../shared/host/effect-bridge.ts'
import { HostError } from '../../shared/host/errors.ts'
import type { Hosting } from '../../shared/host/hosting.ts'
import { Hosting as HostingTag } from '../../shared/host/hosting.ts'
import type { Assets as AssetsService } from '../../shared/runtime/assets.manager.ts'
import type { AppLoop as AppLoopService } from '../../shared/runtime/loop/app-loop.manager.ts'
import { PresentationBus } from '../../shared/runtime/presentation/presentation-bus.manager.ts'
import { Renderer } from '../../shared/runtime/render/renderer.ts'
import {
  type SettingsDef,
  type Settings as SettingsService,
  type SettingsStore,
  storeOf,
} from '../../shared/runtime/settings/settings.manager.ts'
import type { Time as TimeService } from '../../shared/runtime/time/time.manager.ts'
import type { Flow as FlowService } from '../flow/flow.manager.ts'
import type { RuntimeServices } from '../flow/screen.ts'

/** The time service: whether the sim is paused, and why; each reason pauses until it is resumed. */
export type Time = TimeService
export const Time: Context.Tag<TimeService, TimeService> = Context.GenericTag<TimeService>(
  '@mcthaydt/automata-runtime/Time',
)

/**
 * The frame loop service: `run` steps a sim at its fixed tick rate from display frames, with the commands for each
 * tick, and the renderer draws every frame.
 */
export type AppLoop = AppLoopService
export const AppLoop: Context.Tag<AppLoopService, AppLoopService> = Context.GenericTag<AppLoopService>(
  '@mcthaydt/automata-runtime/AppLoop',
)

/** The asset loader as a runtime service: a screen's files and fonts, loaded under the stall rule. */
export type Assets = AssetsService
export const Assets: Context.Tag<AssetsService, AssetsService> = Context.GenericTag<AssetsService>(
  '@mcthaydt/automata-runtime/Assets',
)

/** The haptics service as a runtime service: rumble and buzz, off when the player's Vibration setting is. */
export type Haptics = HapticsService
export const Haptics: Context.Tag<HapticsService, HapticsService> = Context.GenericTag<HapticsService>(
  '@mcthaydt/automata-runtime/Haptics',
)

/** The game's leaderboards for screens: `Hosting.leaderboards` with each answer turned into a named state. */
export type Leaderboards<Board extends string = string> = LeaderboardsService<Board>
export const Leaderboards: Context.Tag<LeaderboardsService, LeaderboardsService> =
  Context.GenericTag<LeaderboardsService>('@mcthaydt/automata-runtime/Leaderboards')

/** The locale service: the game's locales, the one text is drawn in now, the player's choice and the text direction. */
export type Locale = LocaleService
export const Locale: Context.Tag<LocaleService, LocaleService> = Context.GenericTag<LocaleService>(
  '@mcthaydt/automata-runtime/Locale',
)

/** The booted game's settings as a runtime service: its key and store, both undefined for a game without settings. */
export type Settings = SettingsService
export const Settings: Context.Tag<SettingsService, SettingsService> = Context.GenericTag<SettingsService>(
  '@mcthaydt/automata-runtime/Settings',
)

/** Returns the booted settings store when `def.key` matches; dies with a defect when it does not. */
export function settingsStore<S>(
  def: SettingsDef<S>,
): Effect.Effect<SettingsStore<S>, never, SettingsService> {
  return Effect.map(Settings, (settings) => storeOf(settings, def))
}

/**
 * The audio service: one-shot sounds and looping music on the audio buses, unlocked by the first gesture after
 * `session.ready`; the game runs silent when no audio context can be built.
 */
export type Audio = AudioService
export const Audio: Context.Tag<AudioService, AudioService> = Context.GenericTag<AudioService>(
  '@mcthaydt/automata-runtime/Audio',
)

/** The audio-bus seam. The audio service implements it. */
// Spelled out member by member, each typed by the owner's interface, so the API report still shows the seam's members
// (the PRODUCT spec's seam check reads them); it goes back to being the interface itself when this file is deleted.
export type AudioBuses = {
  input: AudioBusesService['input']
  gain: AudioBusesService['gain']
  setGain: AudioBusesService['setGain']
}
export const AudioBuses: Context.Tag<AudioBusesService, AudioBusesService> =
  Context.GenericTag<AudioBusesService>('@mcthaydt/automata-runtime/AudioBuses')

/**
 * The booted game's save as a runtime service, as `Settings` is for settings: its key and the `Save`, both undefined
 * for a game without saves.
 */
export type Saves = SavesService
export const Saves: Context.Tag<SavesService, SavesService> = Context.GenericTag<SavesService>(
  '@mcthaydt/automata-runtime/Saves',
)

/**
 * Opens the game's save as boot did before the saves were plain: for as long as the scope is open, timed by the
 * runtime's Effect clock (so a `TestClock` still moves the timer and `savedAt`). A refused read fails with the
 * `HostError` it carries.
 */
export function openSaves(
  def: SaveDef<unknown> | undefined,
  options: { readonly contentHash: string; readonly hosting: Hosting; readonly bus: PresentationBus },
): Effect.Effect<SavesService, HostError, Scope.Scope> {
  return Effect.gen(function* () {
    const clock = effectClock(yield* Effect.runtime<never>())
    const opened = yield* Effect.promise(() =>
      createSaves(def, {
        contentHash: options.contentHash,
        hosting: toPlainHosting(options.hosting),
        bus: options.bus,
        clock,
        now: () => clock.now(),
      }),
    )
    if (!opened.ok) return yield* Effect.fail(new HostError(opened.reason))
    const saves = opened.value
    yield* Effect.addFinalizer(() => Effect.promise(() => saves.dispose()))
    return { key: saves.key, save: saves.save }
  })
}

/** The screen flow service: the current screen, `dispatch`, `openMenu` and `settled()`. */
export type Flow = FlowService
export const Flow: Context.Tag<FlowService, FlowService> = Context.GenericTag<FlowService>(
  '@mcthaydt/automata-runtime/Flow',
)

/** Every runtime tag the tests and games still read from an Effect context. */
export type RuntimeTags =
  | Hosting
  | PresentationBus
  | TimeService
  | FlowService
  | SettingsService
  | SavesService
  | AppLoopService
  | AssetsService
  | import('../../shared/runtime/render/renderer.ts').GameRenderer
  | LocaleService
  | AudioService
  | AudioBusesService
  | LeaderboardsService
  | HapticsService

/**
 * The plain runtime services as the Effect context the tests and the games' own Effect code still read (`Hosting` is
 * the Effect one, which the plain one was made from).
 */
export function runtimeContext(services: RuntimeServices, hosting: Hosting): Context.Context<RuntimeTags> {
  return Context.empty().pipe(
    Context.add(HostingTag, hosting),
    Context.add(PresentationBus, services.bus),
    Context.add(Time, services.time),
    Context.add(Flow, services.flow),
    Context.add(Settings, services.settings),
    Context.add(Saves, services.saves),
    Context.add(AppLoop, services.appLoop),
    Context.add(Assets, services.assets),
    Context.add(Renderer, services.renderer),
    Context.add(Locale, services.locale),
    Context.add(Audio, services.audio),
    Context.add(AudioBuses, services.audio),
    Context.add(Leaderboards, services.leaderboards),
    Context.add(Haptics, services.haptics),
  ) as Context.Context<RuntimeTags>
}
