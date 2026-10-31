// defineGame: a `GameSpec` with every default filled in (DX spec §3.1, §5 step 1). Pure: it reads no document
// until the runtime asks for the root, so a game module also loads in Node (the examples' golden parity).

import { GAME_ID_PATTERN } from '@mcthaydt/automata-content/game-config'
import type { HostingOptions } from '@mcthaydt/automata-host'
import {
  createPixiRenderer,
  type EntityViewFactory,
  type PixiRendererOptions,
  type PixiStage,
} from '@mcthaydt/automata-render-pixi'
import {
  BootDefect,
  CORE_SETTINGS,
  type CompiledContentData,
  type EventScores,
  type EventSounds,
  type GameDefinition,
  type GameOrientation,
  LOCALE_SAVE_KEY,
  type RendererFactory,
  type RotateHintMode,
  type RuntimeSeams,
  type SaveDef,
  type ScreenDef,
  type SettingsDef,
} from '@mcthaydt/automata-runtime'
import { type ExtensionDef, resolveExtensions } from '@mcthaydt/automata-runtime/extension'
import type { PluginDef, Sim } from '@mcthaydt/automata-sim'
import { defaultContent } from './default-content.ts'
import { createDrawLayer, type DrawContext, type DrawLayer, mergeStageHooks } from './draw/draw-layer.ts'
import type { InputMap } from './input/keys.ts'
import { defaultScreens } from './screens/default-screens.ts'
import type { ScreensCopyInput } from './screens/screens-copy.ts'

/**
 * What a game saves, and how the default screens read it from the sim and put it back (M5.2). The title lists the
 * save's slots; New game writes the starting data, Continue loads a slot, and play keeps it saved while it runs, on
 * the triggers the `def` declares (autosave).
 */
export interface GameSaves<D> {
  readonly def: SaveDef<D>
  /**
   * The data to keep, read from the live sim when a trigger writes, and for a new game from the sim at tick 0. It
   * only reads: it must not change the sim.
   */
  capture(sim: Sim): D
  /** Puts a loaded slot's data into the freshly set-up sim, before tick 0. */
  apply(sim: Sim, data: D): void
  /** The label a new game gives its slot on the list ("Run 2"). Default: none, and the list says "Slot N". */
  label?(slot: number): string
}

/** A game's words: the runtime's boot and failure copy, and the default screens' words (DX.2d). */
export type GameCopy = NonNullable<GameDefinition['copy']> & {
  /** The default screens' words, over their English defaults: a part of `ScreensCopy`, or a function of the locale. */
  readonly screens?: ScreensCopyInput | undefined
}

/**
 * A game in one object (DX spec §3.1): its id, size and sim, and optionally its title, input, views, sounds,
 * scores, saves, content, screens, settings, extensions, draw layer and host and renderer options.
 * `defineGame` fills in every default.
 */
export interface GameSpec<S = never, D = unknown> {
  /** Ruken's game id (`[game].id`), checked with Ruken's own rule; it is `hosting.gameId`. */
  readonly id: string
  /** Shown on the title screen. Default: the id. */
  readonly title?: string
  /** The playfield in logical pixels. */
  readonly size: { readonly width: number; readonly height: number }
  readonly sim: {
    readonly plugins: readonly PluginDef[]
    /** Default 1. */
    readonly seed?: number
    /** Spawns the starting entities before tick 0. */
    readonly setup?: (sim: Sim) => void
  }
  /**
   * The orientation the game plays in, the same as the ship config's `runtime.orientation` (M4.7). On a phone held
   * the other way a `portrait` or `landscape` game pauses behind the rotate hint. Default `any`.
   */
  readonly orientation?: GameOrientation
  /** On a phone held the other way: `'block'` (the default) covers and pauses; `'toast'` says so and plays on. */
  readonly rotateHint?: RotateHintMode
  /** Default: no commands. */
  readonly input?: InputMap
  /** Component id → view (`rect`, `sprite`). */
  readonly views?: Readonly<Record<string, EntityViewFactory>>
  /**
   * The sound each sim event plays, by the event's id: `{ [Chime.id]: 'chime.wav' }`, or `{ alias, bus, gain }`.
   * Silent until the player's first gesture (browsers allow no sound before it).
   */
  readonly sounds?: EventSounds
  /**
   * The board and score each sim event submits, by the event's id (M5.7):
   * `{ [RunEnded.id]: { board: 'best', score: (payload) => RunEnded.schema.parse(payload).score } }`. The board is a key
   * of the ship config's `leaderboards`; the game then asks the host for `leaderboards`.
   */
  readonly scores?: EventScores
  /**
   * The game's save (M5.2): its slots, how the sim is captured into them and put back. The game then asks the host
   * for `saves`. Needs the default screens for the title's slot list; custom `screens` open the save themselves.
   */
  readonly saves?: GameSaves<D>
  /** A game with `content/` passes the compiler's output; `sim` is the sim's partition of it. */
  readonly content?: { readonly data: CompiledContentData; readonly hash: string; readonly sim?: unknown }
  /** Default: title, play and paused (DX spec §7). */
  readonly screens?: readonly ScreenDef[]
  /** Default: `#game`. */
  readonly root?: HTMLElement
  readonly hosting?: Partial<Omit<HostingOptions, 'gameId' | 'disclosedEvents'>>
  /**
   * Default: the core settings (`CORE_SETTINGS`, the save `settings`), with the player's bindings and graphics
   * quality. A game's own settings keep those only when its schema has `input: inputSettingsSchema` and
   * `display: displaySettingsSchema`.
   */
  readonly settings?: SettingsDef<S>
  readonly extensions?: readonly ExtensionDef[]
  /**
   * Immediate-mode HUD, debug and prototype drawing over the entity views, once per display frame while the
   * default screens hold a sim (PRODUCT spec §7). It reads the sim and never writes it. Needs the default screens.
   */
  readonly draw?: (ctx: DrawContext) => void
  /** Merged over the defaults (`pixelArt`, the logical size and the views). */
  readonly renderer?: PixiRendererOptions
  /**
   * Makes the renderer from the Pixi options `defineGame` built (the size, pixel art, the views, `renderer` and
   * the draw layer's and Settings' `setup`): an extension's renderer, such as render-pixi3d's
   * `(options) => createPixi3dRenderer({ ...options, views })`. Default: core's `createPixiRenderer`.
   */
  readonly createRenderer?: (options: PixiRendererOptions) => RendererFactory
  /**
   * Files the runtime fetches with the preload screens, with byte progress and the 30 s stall rule (M1.5), before
   * the renderer starts: model files a 3D view draws, for example. They stay out of the content and its hash, so a
   * new origin or a rebuilt file never changes the hash a save is stamped with.
   */
  readonly preload?: readonly string[]
  /**
   * The game's words: the runtime's boot and failure copy, and `screens`, the default screens' words over their
   * English defaults (DX.2d). `screens` may be a function of the locale, run again on each language change, so a
   * Paraglide game passes its messages: `screens: () => ({ title: { play: m.play() } })`.
   */
  readonly copy?: GameCopy
  /** The game's languages (PRODUCT.L): Settings' Language group offers them. Absent, the content's one language. */
  readonly locale?: GameDefinition['locale']
  /** Tests only. */
  readonly seams?: RuntimeSeams
}

/** The runtime's `GameDefinition`, plus what the screens and the golden replay read from the spec. */
export interface DefinedGame<S = never> extends GameDefinition<S> {
  readonly id: string
  readonly title: string
  readonly size: { readonly width: number; readonly height: number }
  readonly input?: InputMap | undefined
  readonly sim: {
    readonly plugins: readonly PluginDef[]
    readonly seed: number
    readonly setup?: ((sim: Sim) => void) | undefined
    readonly content?: unknown
  }
}

/** Every invalid field of a spec, by path: `size.width: …`. */
export class GameSpecError extends Error {
  readonly problems: readonly string[]
  constructor(problems: readonly string[]) {
    super(`invalid GameSpec:\n  ${problems.join('\n  ')}`)
    this.name = 'GameSpecError'
    this.problems = problems
  }
}

const HASH = /^[0-9a-f]{16}$/
const isSize = (value: number): boolean => Number.isInteger(value) && value > 0

/**
 * The plugins the sim runs: the game's own, then every extension's `sim` plugins in extension order (M1 runtime
 * spec §3.2). `createSim` orders them by `dependsOn` and refuses a plugin listed twice.
 */
function simPluginsOf<S, D>(spec: GameSpec<S, D>): readonly PluginDef[] {
  if (spec.extensions === undefined || spec.extensions.length === 0) return spec.sim.plugins
  return [...spec.sim.plugins, ...resolveExtensions(spec.extensions).simPlugins]
}

function problemsOf<S, D>(spec: GameSpec<S, D>, plugins: readonly PluginDef[]): string[] {
  const problems: string[] = []
  if (!GAME_ID_PATTERN.test(spec.id))
    problems.push(`id: "${spec.id}" is not a game id (lowercase letters, digits and hyphens)`)
  for (const side of ['width', 'height'] as const)
    if (!isSize(spec.size[side])) problems.push(`size.${side}: ${spec.size[side]} is not a positive integer`)
  const drawn = new Set(
    plugins.flatMap((plugin) => plugin.components.filter((c) => c.render).map((c) => c.id)),
  )
  for (const key of Object.keys(spec.views ?? {}))
    if (!drawn.has(key)) problems.push(`views.${key}: no plugin has a drawn component "${key}"`)
  const events = new Set(plugins.flatMap((plugin) => plugin.events.map((event) => event.id)))
  for (const key of Object.keys(spec.sounds ?? {}))
    if (!events.has(key)) problems.push(`sounds.${key}: no plugin defines an event "${key}"`)
  for (const key of Object.keys(spec.scores ?? {}))
    if (!events.has(key)) problems.push(`scores.${key}: no plugin defines an event "${key}"`)
  const reserved = [(spec.settings ?? CORE_SETTINGS).key, LOCALE_SAVE_KEY]
  if (spec.saves !== undefined && reserved.includes(spec.saves.def.key))
    problems.push(`saves.def.key: "${spec.saves.def.key}" is a key the framework keeps for itself`)
  if (spec.draw !== undefined && typeof spec.draw !== 'function') problems.push('draw: is not a function')
  else if (spec.draw !== undefined && spec.screens !== undefined)
    problems.push('draw: needs the default screens (custom screens do not hand their sim to the draw layer)')
  if (spec.createRenderer !== undefined && typeof spec.createRenderer !== 'function')
    problems.push('createRenderer: is not a function')
  if (spec.content !== undefined && !HASH.test(spec.content.hash))
    problems.push(`content.hash: "${spec.content.hash}" is not 16 hex digits`)
  return problems
}

/**
 * The capabilities the game asks for: the spec's, plus `saves` for the core settings when the game declares none
 * (M4.4) or has a save of its own (M5.2), and `leaderboards` when it has scores, each once.
 */
function wantsOf<S, D>(spec: GameSpec<S, D>): NonNullable<HostingOptions['wants']> {
  const wants = [...(spec.hosting?.wants ?? [])]
  if ((spec.settings === undefined || spec.saves !== undefined) && !wants.includes('saves'))
    wants.push('saves')
  if (spec.scores !== undefined && !wants.includes('leaderboards')) wants.push('leaderboards')
  return wants
}

/** `spec.root`, else `#game`; a BootDefect when there is neither (DX spec §6). */
function rootOf<S, D>(spec: GameSpec<S, D>): HTMLElement {
  const root = spec.root ?? (typeof document === 'undefined' ? null : document.getElementById('game'))
  if (root === null)
    throw new BootDefect({ cause: new Error('no root: pass `root` or add an element #game') })
  return root
}

/** Every game `defineGame` returned, so `startGame` can tell one from a spec without guessing from its shape. */
const definedGames = new WeakSet<object>()

/** Whether `value` came from `defineGame`. */
export function isDefinedGame<S>(value: GameSpec<S> | DefinedGame<S>): value is DefinedGame<S> {
  return definedGames.has(value)
}

/**
 * The Pixi renderer's options: the logical size, pixel art and the views, under the game's own `renderer`
 * options. With a draw layer, the game's own `setup` runs first and the layer mounts over it; their frame
 * hooks run in that order. `onStage` is told the stage once it exists (the Settings screen sets its quality).
 */
export function pixiOptions<S>(
  spec: GameSpec<S>,
  layer: DrawLayer | undefined,
  onStage?: (stage: PixiStage) => void,
): PixiRendererOptions {
  const options: PixiRendererOptions = {
    logicalWidth: spec.size.width,
    logicalHeight: spec.size.height,
    pixelArt: true,
    ...(spec.views === undefined ? {} : { entityViews: spec.views }),
    ...spec.renderer,
  }
  if (layer === undefined && onStage === undefined) return options
  const ownSetup = spec.renderer?.setup
  return {
    ...options,
    setup: (stage) => {
      onStage?.(stage)
      return mergeStageHooks(ownSetup?.(stage) ?? undefined, layer?.setup(stage))
    },
  }
}

/**
 * Checks a spec and fills in every default over the runtime, the Pixi renderer, Ruken hosting and the default
 * screens; `startGame` boots the result. Pure: it reads no document, so a game module also loads in Node.
 * Throws `BootDefect` (its cause a `GameSpecError`) for an invalid spec.
 */
export function defineGame<S = never, D = unknown>(spec: GameSpec<S, D>): DefinedGame<S> {
  // The runtime gets its own copy; `screens` is the default screens' (DX.2d).
  const { screens: _screens, ...rest } = spec.copy ?? {}
  const runtimeCopy = spec.copy === undefined ? undefined : rest
  const plugins = simPluginsOf(spec)
  const problems = problemsOf(spec, plugins)
  if (problems.length > 0) throw new BootDefect({ cause: new GameSpecError(problems) })

  const title = spec.title ?? spec.id
  const sim = {
    plugins,
    seed: spec.sim.seed ?? 1,
    ...(spec.sim.setup === undefined ? {} : { setup: spec.sim.setup }),
    ...(spec.content?.sim === undefined ? {} : { content: spec.content.sim }),
  }
  const content =
    spec.content === undefined ? defaultContent() : { data: spec.content.data, hash: spec.content.hash }
  const layer = spec.draw === undefined ? undefined : createDrawLayer(spec.draw, spec.size)
  // The stage, once the renderer has made it: the default screens give it the player's quality (M4.4).
  let stage: PixiStage | undefined
  const options = pixiOptions(spec, layer, (made) => {
    stage = made
  })
  const renderer = spec.createRenderer?.(options) ?? createPixiRenderer(options)

  const game: DefinedGame<S> = {
    id: spec.id,
    title,
    size: spec.size,
    orientation: spec.orientation ?? 'any',
    rotateHint: spec.rotateHint ?? 'block',
    sim,
    ...(spec.input === undefined ? {} : { input: spec.input }),
    get root() {
      return rootOf(spec)
    },
    hosting: { pauseBehavior: 'pause', ...spec.hosting, wants: wantsOf(spec), gameId: spec.id },
    content,
    screens:
      spec.screens ??
      defaultScreens({
        title,
        sim,
        input: spec.input,
        ...(layer === undefined ? {} : { watchSim: layer.watch }),
        ...(spec.scores === undefined ? {} : { board: Object.values(spec.scores)[0]?.board }),
        ...(spec.saves === undefined ? {} : { saves: spec.saves as GameSaves<unknown> }),
        setQuality: (tier) => stage?.setQuality(tier),
        ...(spec.extensions === undefined ? {} : { extensions: spec.extensions }),
        ...(spec.copy?.screens === undefined ? {} : { copy: spec.copy.screens }),
      }),
    renderer,
    // Without settings of its own, the game keeps the player's bindings and quality in the core settings (M4.4).
    // They are not the game's `S`: only the default screens read them, through `Settings`.
    settings: spec.settings ?? (CORE_SETTINGS as unknown as SettingsDef<S>),
    ...(spec.extensions === undefined ? {} : { extensions: spec.extensions }),
    ...(spec.preload === undefined ? {} : { preload: spec.preload }),
    ...(spec.sounds === undefined ? {} : { sounds: spec.sounds }),
    ...(spec.scores === undefined ? {} : { scores: spec.scores }),
    ...(spec.saves === undefined ? {} : { saves: spec.saves.def }),
    ...(runtimeCopy === undefined ? {} : { copy: runtimeCopy }),
    ...(spec.locale === undefined ? {} : { locale: spec.locale }),
    ...(spec.seams === undefined ? {} : { seams: spec.seams }),
  }
  definedGames.add(game)
  return game
}
