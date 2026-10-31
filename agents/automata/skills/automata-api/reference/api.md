# Automata API reference, version 0.0.4

> Every export of every published `@mcthaydt/automata-*` entry point at version 0.0.4, generated from the published `.d.ts` files. An export that is not listed here does not exist in this version.

## `@mcthaydt/automata`

### `import { … } from '@mcthaydt/automata'`

#### `AnalogOptions` (interface)

The `analog` option of `keys()`.

```ts
interface AnalogOptions<Z extends z.ZodType> {
  /**
   * Per tick: what the sticks and the drag add to the held keys' payload, merged over it and parsed by the
   * command's schema. The held payload is passed in so a game can sum a key term and a stick term. When the schema
   * refuses the merge (a `NaN`, a float in an integer field), the held payload is sent alone.
   */
  read(reading: AnalogReading, held: z.output<Z>): Partial<z.input<Z>>
  /** Bind the `camera-drag` gesture: the play screen mounts the drag surface (M4 spec §16.3.1). */
  readonly drag?: boolean
  /** Show the touch stick; its vector is `stick('left')`. */
  readonly touchStick?: boolean
}
```

#### `AnalogReading` (interface)

The analog input at one fixed step, read once after `Input.poll()`.

```ts
interface AnalogReading {
  /** The active pad's stick, or the touch stick, as integers −127..127 (M4-D2). */
  stick(side: 'left' | 'right'): { readonly x: number; readonly y: number }
  /** CSS px dragged to the right since the previous tick; 0 unless the map binds the camera drag. */
  cameraDrag(): number
  /** The player's camera settings. */
  readonly camera: CameraSettings
}
```

#### `AutosavePolicy` (interface)

When the loaded slot writes itself: on each listed trigger, with `intervalSeconds` for the `interval`
timer.

```ts
interface AutosavePolicy {
  readonly on: readonly AutosaveTrigger[]
  /** Seconds between timer writes, default 60. Read only when `interval` is in `on`. */
  readonly intervalSeconds?: number
}
```

#### `AutosaveTrigger` (type)

What can make the loaded slot write itself (M5 spec §4.4).

```ts
type AutosaveTrigger = 'screen-exit' | 'round-end' | 'background' | 'interval'
```

#### `Camera2d` (interface)

A presentation-only 2D camera over one container: it follows a target, shakes, and writes only that
container's transform, never a sim value.

```ts
interface Camera2d {
  /** The world point to follow. The first call snaps to it. */
  target(x: number, y: number): void
  /** Adds trauma, 0..1 (capped at 1); it decays over time. */
  shake(trauma: number): void
  /** Advances one display frame and writes the transform to the container. */
  update(frameSeconds: number): void
  readonly transform: { readonly x: number; readonly y: number; readonly scale: number }
}
```

#### `Camera2dOptions` (interface)

How `createCamera2d` frames the world: the view's size, and optionally a follow, bounds and zoom.

```ts
interface Camera2dOptions {
  /** The playfield's logical size: the area the camera shows at zoom 1. */
  readonly view: { readonly width: number; readonly height: number }
  /** Approach the target at `rate` per second; a dead zone, centred on the view, the target may move in freely. */
  readonly follow?: {
    readonly rate: number
    readonly deadZone?: { readonly width: number; readonly height: number }
  }
  /** The world rect the view never shows outside of. */
  readonly bounds?: CameraRect
  /** Default 1; above 1 shows less of the world. */
  readonly zoom?: number
  /** Default: the player's `prefers-reduced-motion`, read every frame. */
  readonly reducedMotion?: () => boolean
}
```

#### `CameraRect` (interface)

A world-space rectangle, in logical px: `Camera2dOptions.bounds`.

```ts
interface CameraRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}
```

#### `ChangedElsewhereCopy` (interface)

The words of the choice paused offers once another device has changed the slot being played (M5-D6).

```ts
interface ChangedElsewhereCopy {
  readonly message: string
  readonly loadNewer: string
  readonly keepPlaying: string
  /** Load newer was chosen and the other device's progress could not be used; this game goes on as it was. */
  readonly failed: string
}
```

#### `Command` (interface)

Input to the sim (spec §4.4 rule 4). `source` is a player slot (u8), `seq` a per-source counter (u32).

```ts
interface Command {
  readonly tick: number
  readonly source: number
  readonly seq: number
  readonly type: string
  readonly payload: unknown
}
```

#### `CommandDef` (interface)

A command the sim accepts as input: an id and the Zod schema its payload must match. Create one with
`defineCommand`.

```ts
interface CommandDef<Z extends z.ZodType = z.ZodType> {
  readonly kind: 'command'
  readonly id: string
  readonly schema: Z
}
```

#### `ComponentDef` (interface)

A component: a stable id and a flat record of typed fields. Create one with `defineComponent`; game code
addresses entity data through the definition, never through `trait`.

```ts
interface ComponentDef<S extends FieldSchema = FieldSchema> {
  readonly kind: 'component'
  readonly id: string
  readonly fields: S
  /** Field names in sorted order: the order used by snapshots. */
  readonly fieldNames: readonly string[]
  /** Included in RenderDelta rows (default true). */
  readonly render: boolean
  /** Internal Koota storage. Game code never touches it. */
  readonly trait: Trait
}
```

#### `createCamera2d` (function)

A camera writing `stage`'s transform (usually `PixiStage.world`). `seed` fixes the shake's random sequence,
so a shake looks the same in every run and visual test.

```ts
function createCamera2d(stage: Container, options: Camera2dOptions, seed = 1): Camera2d {
  const zoom = options.zoom ?? 1
  // The world-space size the view shows.
  const visibleWidth = options.view.width / zoom
  const visibleHeight = options.view.height / zoom

  let targetX = 0
  let targetY = 0
  let centreX = 0
  let centreY = 0
  let hasTarget = false
  let trauma = 0
  const noise = mulberry32(seed)
  const isReduced = options.reducedMotion ?? (() => reducedMotion())
  const transform = { x: 0, y: 0, scale: zoom }

  const clamp = (x: number, y: number): { x: number; y: number } => {
    const bounds = options.bounds
    if (bounds === undefined) return { x, y }
    return {
      x: clampAxis(x, visibleWidth, bounds.x, bounds.width),
      y: clampAxis(y, visibleHeight, bounds.y, bounds.height),
    }
  }

  return {
    target(x, y) {
      targetX = x
      targetY = y
      if (!hasTarget) {
        hasTarget = true
        centreX = x
        centreY = y
      }
    },
    shake(amount) {
      trauma = Math.min(1, trauma + amount)
    },
    update(frameSeconds) {
      const follow = options.follow
      if (follow === undefined) {
        centreX = targetX
        centreY = targetY
      } else {
        const zone = follow.deadZone
        const wantX = zone === undefined ? targetX : intoZone(centreX, targetX, zone.width / 2)
        const wantY = zone === undefined ? targetY : intoZone(centreY, targetY, zone.height / 2)
        centreX = damp(centreX, wantX, follow.rate, frameSeconds)
        centreY = damp(centreY, wantY, follow.rate, frameSeconds)
      }
      // The camera's own centre stays clamped too, so leaving a corner starts from inside the bounds.
      const clamped = clamp(centreX, centreY)
      centreX = clamped.x
      centreY = clamped.y

      // The shake is added to what is drawn, never to the stored centre, so the follow does not drift with it.
      // Noise is drawn every frame, even under reduced motion, so the sequence does not depend on the setting.
      trauma = Math.max(0, trauma - SHAKE_DECAY * frameSeconds)
      const strength = isReduced() ? 0 : SHAKE_MAX_OFFSET * trauma * trauma
      const noiseX = noise() * 2 - 1
      const noiseY = noise() * 2 - 1
      const shown = clamp(centreX + strength * noiseX, centreY + strength * noiseY)

      transform.x = options.view.width / 2 - shown.x * zoom
      transform.y = options.view.height / 2 - shown.y * zoom
      stage.position.set(transform.x, transform.y)
      stage.scale.set(zoom)
    },
    transform,
  }
}
```

#### `defaultContent` (function)

The default flow `title → play ⇄ paused → title`, with `paused ⇄ settings` (M4.4), and its hash.

```ts
function defaultContent(): GameContent {
  content ??= { data: DATA, hash: hex64(xxhash64(utf8(canonicalJson(DATA)))) }
  return content
}
```

#### `defaultScreens` (function)

The title, play, paused and settings screens (DX spec §7, M4.4) over the default content's flow
(`title → play ⇄ paused → title`, `paused ⇄ settings`).

The screens share one sim: play creates it on first entry (seed, plugins, content, then `setup`),
paused keeps it, and the title drops it, so Quit to title and Play start again at tick 0. A runtime that shuts
down with the sim alive drops it too, whichever screen is current (DX.2c). Returning
from paused re-sends the whole state to the renderer (G-5): `AppLoop.run` resets the renderer, so
play restores the sim's own snapshot, which makes the next step a resync.

```ts
function defaultScreens(game: ScreensGame): ScreenDef[] {
  /** The screens' words in the player's language, re-read on each change, for as long as the screen is open. */
  const words: Effect.Effect<LiveScreensCopy, never, Locale | Scope.Scope> = Effect.flatMap(
    Locale,
    (locale) => screensCopy(game.copy, locale),
  )
  // The pads already told they are not supported (M4 spec §6), for the whole session.
  const toldPads = new Set<string>()
  let sim: Sim | undefined
  let playFlow: Flow | undefined
  /** Set when play paused because the pad in use was unplugged (M4-D9); Resume or Quit clears it. */
  let reconnect = false

  const dropSim = (): void => {
    game.watchSim?.(undefined)
    sim?.dispose()
    sim = undefined
  }

  /** The run whose shutdown drops the sim: each run of the runtime (a retried boot, a second `runGame`) has its own. */
  let droppedWith: Scope.Scope | undefined
  /**
   * Drops the sim when the run's `runtime` scope closes (DX.2c), which is after the current screen and the save's last
   * flush have read it. Once per run: `dropSim` forgets the sim it disposes, so one the title dropped is not disposed
   * again, and a shutdown on the title disposes nothing.
   */
  const dropSimOnShutdown = (runtime: Scope.Scope): Effect.Effect<void> =>
    Effect.suspend(() => {
      if (droppedWith === runtime) return Effect.void
      droppedWith = runtime
      return Scope.addFinalizer(runtime, Effect.sync(dropSim))
    })

  /** A sim set up from the game's seed, plugins, content and `setup`, at tick 0. */
  const freshSim = async (): Promise<Sim> => {
    const { plugins, seed, content, setup } = game.sim
    const created = await createSim({ plugins: [...plugins], seed, content })
    setup?.(created)
    return created
  }

  const title: ScreenDef = {
    id: 'title',
    enter: ({ layer }) =>
      Effect.gen(function* () {
        const flow = yield* Flow
        // Quit to title: progress play kept is written while the sim that holds it still lives.
        if (game.saves !== undefined) yield* (yield* saveOf(game.saves.def)).flushPending
        dropSim()
        // The player's saved quality reaches the stage before play draws anything (M4.4).
        const { store } = yield* Settings
        // And the saved mix reaches the audio, so the first sound is at the player's levels (M5.4).
        applyAudio({ audio: yield* Audio, buses: yield* AudioBuses }, savedAudio(store))
        ;(yield* Haptics).setEnabled(savedHaptics(store))
        if (game.setQuality !== undefined && store !== undefined)
          game.setQuality(
            displaySettingsSchema
              .catch(() => ({ quality: 'high' as const }))
              .parse(asRecord(store.get()).display).quality,
          )
        const target = windowOf(layer)
        const play = (): void => void flow.dispatch('play')
        // A game with a save has no Play: the slot list starts play, with the sim its slot made.
        const saves =
          game.saves === undefined
            ? undefined
            : yield* titleSaves(game.saves, {
                fresh: freshSim,
                play: (started) => {
                  sim = started
                  play()
                },
              } satisfies SavesStart)
        const copy = yield* words
        yield* show(TitleScreen, layer, { title: game.title, onPlay: play, saves, copy })
        // Enter or Space anywhere on the title plays; on a focused button the button's own click does.
        if (saves === undefined)
          yield* listen(target, 'keydown', (event) => {
            if (!plain(event) || (event.code !== 'Enter' && event.code !== 'Space')) return
            if (event.target instanceof HTMLButtonElement) return
            event.preventDefault()
            play()
          })
        // Nothing on the title takes Back, so a back step leaves the game.
        yield* backGesture(target, () => sendBack(layer.ownerDocument))
        yield* driveMenu(target)
        yield* noticeUnsupportedPads(layer, toldPads, () => copy.current.padUnsupported)
      }),
  }

  const play: ScreenDef = {
    id: 'play',
    kind: 'gameplay',
    openMenu: () => playFlow?.dispatch('pause') ?? false,
    enter: ({ layer }) =>
      Effect.gen(function* () {
        const flow = yield* Flow
        const appLoop = yield* AppLoop
        const target = windowOf(layer)
        playFlow = flow
        yield* Effect.addFinalizer(() =>
          Effect.sync(() => {
            playFlow = undefined
          }),
        )

        let current = sim
        if (current === undefined) {
          // Kept the moment it is made. A runtime that shuts down while it is being made interrupts this enter, which
          // aborts the signal: the run no longer holds a sim to drop, so the late one is disposed here (DX.2c).
          // Waiting for it instead would hold shutdown on a plugin's engine setup.
          current = yield* Effect.promise((signal) =>
            freshSim().then((made) => {
              if (signal.aborted) made.dispose()
              else sim = made
              return made
            }),
          )
        } else {
          current.restore(current.snapshot())
        }

        // The Input service for this play session (M4 spec §4.2): sampled once per fixed step, closed with the screen.
        const map = game.input
        const bus = yield* PresentationBus
        // The player's bindings and touch mode, from the settings (M4.4).
        const { store } = yield* Settings
        const input = yield* makeInput({
          target,
          profile: map?.profile ?? NO_BINDINGS,
          bus,
          settings: store,
          hostInput: yield* hostInput,
        })
        const bindsCameraDrag = Object.values(map?.profile.bindings ?? {}).some(
          (binding) => binding.gesture?.includes('camera-drag') === true,
        )
        // The player's camera choices, read each tick so a change in Settings applies at once.
        const camera = (): CameraSettings => cameraSettingsSchema.parse(asRecord(store?.get()).camera)
        const touchMode = inputSettingsSchema.parse(asRecord(store?.get()).input).touchMode ?? map?.touchMode
        const running = current
        game.watchSim?.(running)
        // The slot play was started from is kept saved: each tick says what the progress is, and the save's own
        // triggers (leaving play, a round's end, the page going to the background) write it.
        const save = game.saves === undefined ? undefined : yield* saveOf(game.saves.def)
        const keep = (): unknown => game.saves?.capture(running)
        // An idle pointer hides while playing (M4 spec §4.7); leaving play detaches it and shows the pointer again.
        const cursor = new CursorRunner(layer, { kind: () => 'gameplay' })
        const detachCursor = cursor.attach(target)
        yield* Effect.addFinalizer(() => Effect.sync(detachCursor))
        const copy = yield* words
        yield* noticeUnsupportedPads(layer, toldPads, () => copy.current.padUnsupported)
        if (game.saves !== undefined)
          yield* noticeChangedElsewhere(layer, game.saves.def.key, copy.current.saves.changedElsewhereToast)
        appLoop.run({
          sim: running,
          commands: (tick) => {
            cursor.tick()
            save?.touch(keep)
            if (map === undefined) return []
            input.poll()
            return map.toCommand(input.held(), tick, analogReading(input, camera()))
          },
        })
        yield* Effect.addFinalizer(() => Effect.sync(() => appLoop.stop()))

        const pause = (): void => void flow.dispatch('pause')
        // The pad in use unplugged mid-play pauses with a reconnect message (M4-D9), under the `input` reason so
        // nothing else resumes the sim behind the player's back. Another pad or the keyboard in use: play on.
        const time = yield* Time
        yield* Effect.acquireRelease(
          Effect.sync(() =>
            bus.subscribe('input.pad.disconnected', (pad) => {
              if (!pad.wasActive || Effect.runSync(SubscriptionRef.get(input.device)).device !== 'gamepad')
                return
              reconnect = true
              time.pause('input')
              pause()
            }),
          ),
          (stop) => Effect.sync(stop),
        )
        // Escape and the pad's Start are the Input's pause edge; KeyP is the default screens' own extra.
        yield* Effect.acquireRelease(
          Effect.sync(() => input.onPress('pause', pause)),
          (stop) => Effect.sync(stop),
        )
        yield* listen(target, 'keydown', (event) => {
          if (!plain(event) || event.code !== 'KeyP') return
          event.preventDefault()
          pause()
        })
        yield* backGesture(target, () => {
          pause()
          return true
        })

        const tracker = new InputMethodTracker()
        const detach = tracker.attach(target)
        yield* Effect.addFinalizer(() => Effect.sync(detach))
        yield* show(PlayScreen, layer, {
          copy,
          onPause: pause,
          tracker,
          touchButtons: game.input?.touch === false ? [] : (game.input?.touchButtons ?? []),
          onHold: (id: string) => input.hold(id),
          onRelease: (id: string) => input.release(id),
          swipe: touchMode === 'swipe' ? new SwipeTracker(input.gesture) : undefined,
          drag: bindsCameraDrag ? new CameraDragTracker(input.drag) : undefined,
          stick:
            map?.touchStick === true
              ? {
                  onstick: (x: number, y: number) => input.touchStick.set(x, y),
                  onstickend: () => input.touchStick.release(),
                }
              : undefined,
          hud: resolveExtensions(game.extensions ?? []).slots('hud.overlay'),
        })
      }),
  }

  const paused: ScreenDef = {
    id: 'paused',
    pausesSim: true,
    enter: ({ layer }) =>
      Effect.gen(function* () {
        const flow = yield* Flow
        const time = yield* Time
        const target = windowOf(layer)
        // Any device that reaches Resume or Quit lets the game go on (M4 spec §5, pad hot-plug).
        const clearReconnect = (): void => {
          reconnect = false
          time.resume('input')
        }
        const resume = (): void => {
          clearReconnect()
          flow.dispatch('resume')
        }
        const quit = (): void => {
          clearReconnect()
          flow.dispatch('quit')
        }
        const boards = yield* Leaderboards
        // Read from the host each time paused opens: what the host says, never a copy kept here (M5 spec §4.8).
        const board =
          game.board === undefined
            ? undefined
            : { load: () => Effect.runPromise(boards.readBoard(game.board as string)) }
        const settings = (): void => void flow.dispatch('settings')
        // Load newer replaces the sim with the other device's progress and plays on from it.
        const saves =
          game.saves === undefined
            ? undefined
            : yield* pausedSaves(game.saves, {
                fresh: freshSim,
                play: (next) => {
                  dropSim()
                  sim = next
                  resume()
                },
              } satisfies SavesStart)
        // Mute is the Audio group's setting (M5.4), as FloorFifty's pause has it.
        const { store } = yield* Settings
        const targets = { audio: yield* Audio, buses: yield* AudioBuses }
        const copy = yield* words
        yield* show(PausedScreen, layer, {
          copy,
          onResume: resume,
          onQuit: quit,
          onSettings: settings,
          muted: savedAudio(store).muted,
          onMute: (muted: boolean) => changeAudio(targets, store, { ...savedAudio(store), muted }),
          reconnect,
          board,
          saves,
        })
        // Escape is the dialog's (Modal): it steps back from the Quit confirm, and from the menu it resumes.
        yield* backGesture(target, () => sendBack(layer.ownerDocument))
        yield* driveMenu(target)
        yield* noticeUnsupportedPads(layer, toldPads, () => copy.current.padUnsupported)
      }),
  }

  // Every screen ties the sim to the run before its own enter, so a flow that starts anywhere still drops it.
  return [title, play, paused, settingsScreen(game, toldPads)].map(
    (screen): ScreenDef => ({
      ...screen,
      enter: (context) => Effect.zipRight(dropSimOnShutdown(context.runtime), screen.enter(context)),
    }),
  )
}
```

#### `defineCommand` (function)

Defines a command by id and payload schema. Throws for an id that is not lower-case words separated by dots
or dashes.

```ts
function defineCommand<Z extends z.ZodType>(id: string, schema: Z): CommandDef<Z> {
  checkId('command', id)
  return { kind: 'command', id, schema }
}
```

#### `defineComponent` (function)

Defines a component from an id (lower-case words separated by dots or dashes) and its fields by name and
type. `render: false` keeps it out of the renderer's deltas. Throws for a bad id, no fields, a bad field
name or an unknown field type.

```ts
function defineComponent<S extends FieldSchema>(
  id: string,
  fields: S,
  opts: { render?: boolean } = {},
): ComponentDef<S> {
  checkId('component', id)
  const fieldNames = sortedKeys(fields)
  if (fieldNames.length === 0) throw new Error(`component "${id}" needs at least one field`)
  const defaults: Record<string, number | boolean | string> = {}
  for (const name of fieldNames) {
    const type = fields[name] as FieldType
    if (!FIELD_RE.test(name)) throw new Error(`component "${id}" has invalid field name "${name}"`)
    if (!FIELD_TYPES.includes(type))
      throw new Error(`component "${id}" field "${name}" has unknown field type "${type}"`)
    defaults[name] = defaultField(type)
  }
  // A factory, not a schema object: Koota builds structure-of-arrays accessors for a schema object with
  // `new Function`, which Ruken's CSP (no 'unsafe-eval') blocks. Each entity holds its own record instead
  // (array-of-structures); the entity store always writes whole records, so nothing else changes.
  const traitDef = trait(() => ({ ...defaults }))
  return { kind: 'component', id, fields, fieldNames, render: opts.render ?? true, trait: traitDef }
}
```

#### `DefinedGame` (interface)

The runtime's `GameDefinition`, plus what the screens and the golden replay read from the spec.

```ts
interface DefinedGame<S = never> extends GameDefinition<S> {
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
```

#### `defineEvent` (function)

Defines an event by id and payload schema, to emit from a system with `ctx.emit`. Events come back in
`StepResult.events`; `ctx.emit` throws for a payload that fails the schema.

```ts
function defineEvent<Z extends z.ZodType>(id: string, schema: Z): EventDef<Z> {
  checkId('event', id)
  return { kind: 'event', id, schema }
}
```

#### `defineGame` (function)

Checks a spec and fills in every default over the runtime, the Pixi renderer, Ruken hosting and the default
screens; `startGame` boots the result. Pure: it reads no document, so a game module also loads in Node.
Throws `BootDefect` (its cause a `GameSpecError`) for an invalid spec.

```ts
function defineGame<S = never, D = unknown>(spec: GameSpec<S, D>): DefinedGame<S> {
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
```

#### `definePlugin` (function)

Defines a plugin from a name, its dependencies and its definitions, given in the keyed lists or in one flat
`defs` list sorted by kind. A plugin written either way registers the same lists and gets the same schema
hash. `config` is copied as canonical, frozen JSON, so anything that cannot hash exactly throws a
`CanonicalJsonError` here.

```ts
function definePlugin(spec: {
  name: string
  dependsOn?: readonly string[]
  /** One flat list, sorted into the keyed lists by `kind`; each entry follows that list's keyed entries. */
  defs?: readonly Def[]
  components?: readonly ComponentDef[]
  commands?: readonly CommandDef[]
  events?: readonly EventDef[]
  resources?: readonly ResourceDef[]
  systems?: readonly SystemDef[]
  state?: (setup: PluginStateSetup) => Promise<PluginState>
  config?: unknown
}): PluginDef {
  checkId('plugin', spec.name)
  // A canonical, frozen copy: it throws CanonicalJsonError for anything that cannot hash exactly, and nobody
  // can change it after it joins the schema hash.
  const config = spec.config === undefined ? undefined : deepFreeze(JSON.parse(canonicalJson(spec.config)))
  // Keyed entries first, then `defs` in order, so a plugin written either way registers the same lists in the
  // same order and gets the same schema hash. Duplicates are left for createSim to reject, as they are today.
  const components = [...(spec.components ?? [])]
  const commands = [...(spec.commands ?? [])]
  const events = [...(spec.events ?? [])]
  const resources = [...(spec.resources ?? [])]
  const systems = [...(spec.systems ?? [])]
  for (const def of spec.defs ?? []) {
    if (def.kind === 'component') components.push(def)
    else if (def.kind === 'command') commands.push(def)
    else if (def.kind === 'event') events.push(def)
    else if (def.kind === 'resource') resources.push(def)
    else if (def.kind === 'system') systems.push(def)
    else
      throw new Error(
        `plugin "${spec.name}" defs has an entry of unknown kind "${(def as { kind: unknown }).kind}"`,
      )
  }
  return {
    kind: 'plugin',
    name: spec.name,
    dependsOn: spec.dependsOn ?? [],
    components,
    commands,
    events,
    resources,
    systems,
    state: spec.state,
    config,
  }
}
```

#### `defineResource` (function)

Defines a resource by id, schema and starting value. `createSim` parses `init()` with the schema, so a bad
start fails there.

```ts
function defineResource<Z extends z.ZodType>(
  id: string,
  schema: Z,
  init: () => z.input<Z>,
): ResourceDef<Z> {
  checkId('resource', id)
  return { kind: 'resource', id, schema, init }
}
```

#### `defineSave` (function)

Declares a save. It checks nothing the SDK checks; it only gives the definition its type.

```ts
function defineSave<S>(def: SaveDef<S>): SaveDef<S> {
  return def
}
```

#### `defineSystem` (function)

A system: `defineSystem(name, run)` runs in `gameplay`, `defineSystem(name, phase, run)` in that phase, and the
object form also takes `before`/`after`. All three build the same SystemDef (DX spec §3.2).

```ts
function defineSystem(name: string, run: (ctx: SimContext) => void): SystemDef
function defineSystem(name: string, phase: Phase, run: (ctx: SimContext) => void): SystemDef
function defineSystem(spec: SystemSpec): SystemDef
function defineSystem(
  nameOrSpec: string | SystemSpec,
  phaseOrRun?: Phase | ((ctx: SimContext) => void),
  run?: (ctx: SimContext) => void,
): SystemDef {
  if (typeof nameOrSpec !== 'string') return defineSystemFrom(nameOrSpec)
  if (typeof phaseOrRun === 'function')
    return defineSystemFrom({ name: nameOrSpec, phase: 'gameplay', run: phaseOrRun })
  return defineSystemFrom({
    name: nameOrSpec,
    phase: phaseOrRun as Phase,
    run: run as (ctx: SimContext) => void,
  })
}
```

#### `DrawContext` (interface)

What `draw` receives each frame. Coordinates are logical playfield pixels (plan D-2).

```ts
interface DrawContext {
  /** The sim at this frame, read-only. */
  readonly sim: DrawSim
  readonly frame: FrameInfo
  /** The playfield's logical size. */
  readonly width: number
  readonly height: number
  rect(x: number, y: number, w: number, h: number, color: number): void
  circle(x: number, y: number, radius: number, color: number): void
  line(x1: number, y1: number, x2: number, y2: number, color: number, width?: number): void
  /** One line of text, its top-left at (x, y). */
  text(value: string, x: number, y: number, options?: DrawTextOptions): void
}
```

#### `DrawEntity` (interface)

One entity, read-only: its components' values are frozen copies.

```ts
interface DrawEntity {
  readonly sid: number
  has(component: ComponentDef): boolean
  get<S extends FieldSchema>(component: ComponentDef<S>): Readonly<FieldValues<S>>
}
```

#### `DrawSim` (interface)

The sim at this frame, read-only.

```ts
interface DrawSim {
  readonly tick: number
  query(...components: ComponentDef[]): DrawEntity[]
  entity(sid: number): DrawEntity | undefined
  /** A deep-frozen copy of the resource's value. */
  resource<Z extends z.ZodType>(def: ResourceDef<Z>): z.output<Z>
}
```

#### `DrawTextOptions` (interface)

Options for `DrawContext.text`: colour and font size.

```ts
interface DrawTextOptions {
  /** Default 0xffffff. */
  readonly color?: number | undefined
  /** Font size in logical pixels. Default 8. */
  readonly size?: number | undefined
}
```

#### `EntityRef` (interface)

A live entity, addressed by its StableId. Writes are coerced per field type and mark the entity changed.

```ts
interface EntityRef {
  readonly sid: number
  has(component: ComponentDef): boolean
  get<S extends FieldSchema>(component: ComponentDef<S>): Readonly<FieldValues<S>>
  set<S extends FieldSchema>(component: ComponentDef<S>, values: Partial<FieldValues<S>>): void
  add<S extends FieldSchema>(component: ComponentDef<S>, values?: Partial<FieldValues<S>>): void
  remove(component: ComponentDef): void
}
```

#### `EventDef` (interface)

An event a system emits: an id and the Zod schema its payload must match. Create one with `defineEvent`.

```ts
interface EventDef<Z extends z.ZodType = z.ZodType> {
  readonly kind: 'event'
  readonly id: string
  readonly schema: Z
}
```

#### `GameCopy` (type)

A game's words: the runtime's boot and failure copy, and the default screens' words (DX.2d).

```ts
type GameCopy = NonNullable<GameDefinition['copy']> & {
  /** The default screens' words, over their English defaults: a part of `ScreensCopy`, or a function of the locale. */
  readonly screens?: ScreensCopyInput | undefined
}
```

#### `GameSaves` (interface)

What a game saves, and how the default screens read it from the sim and put it back (M5.2). The title lists the
save's slots; New game writes the starting data, Continue loads a slot, and play keeps it saved while it runs, on
the triggers the `def` declares (autosave).

```ts
interface GameSaves<D> {
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
```

#### `GameSpec` (interface)

A game in one object (DX spec §3.1): its id, size and sim, and optionally its title, input, views, sounds,
scores, saves, content, screens, settings, extensions, draw layer and host and renderer options.
`defineGame` fills in every default.

```ts
interface GameSpec<S = never, D = unknown> {
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
```

#### `GameSpecError` (class)

Every invalid field of a spec, by path: `size.width: …`.

```ts
class GameSpecError extends Error {
  readonly problems: readonly string[]
  constructor(problems: readonly string[]) {
    super(`invalid GameSpec:\n  ${problems.join('\n  ')}`)
    this.name = 'GameSpecError'
    this.problems = problems
  }
}
```

#### `InputMap` (interface)

Held keys, touch buttons and gamepad buttons, turned into one command per tick (DX spec §3.3).

```ts
interface InputMap {
  readonly command: CommandDef
  /** Whether the play screen shows touch buttons when the player uses touch. */
  readonly touch: boolean
  readonly touchButtons: readonly TouchButton[]
  /** How the play screen takes touch: its buttons, or swipes over the whole screen (M4 spec §4.4). */
  readonly touchMode: TouchMode
  /**
   * The bindings as data (M4 spec §2.2): one action per distinct payload, id `<command id>-<n>`, with its keys, its
   * pad buttons and whether it has a touch button. Rebinding swaps the profile and never the command mapping.
   */
  readonly profile: InputProfile
  /** Each action's name, as the Settings screen's Controls section lists it (M4.4). */
  readonly labels: Readonly<Record<string, string>>
  /** Whether the play screen shows the touch stick (the `analog.touchStick` option). */
  readonly touchStick: boolean
  /**
   * Pure: the one command for the held actions, merged in iteration order (a later action wins per field). With an
   * `analog` option, `reading` adds the sticks and the drag (M4 spec §17); without one it is ignored.
   */
  toCommand(held: Iterable<string>, tick: number, reading?: AnalogReading): readonly Command[]
  attach(target: Window): InputSource
}
```

#### `inputs` (function)

One input map from `maps`, each sending its own command every tick in map order. The commands share source 0, so
each gets its own `seq`: `tick × maps.length + index` (a u32, which at 60 Hz lasts 2³²/60/86,400/n ≈ 828/n days of
play). `command` is the first map's. Throws on no maps, on two maps for one command, and on an action id, a key or
a pad button two maps share.

```ts
function inputs(...maps: readonly InputMap[]): InputMap {
  const first = maps[0]
  if (first === undefined) throw new Error('inputs(): needs at least one map')
  const ids = maps.map((map) => map.command.id)
  for (const [index, id] of ids.entries())
    if (ids.indexOf(id) !== index) throw new Error(`inputs(): the command "${id}" is mapped twice`)
  checkShared(maps)

  const profile: InputProfile = inputProfileSchema.parse({
    id: ids.join('+'),
    bindings: Object.assign({}, ...maps.map((map) => map.profile.bindings)),
  })
  const modes = touchModesFor(profile)
  const touchMode: TouchMode = maps.every((map) => map.touchMode === 'swipe') ? 'swipe' : 'buttons'
  if (!modes.includes(touchMode)) throw new Error(`inputs(): touchMode "${touchMode}" has nothing to touch`)

  const toCommand = (held: Iterable<string>, tick: number, reading?: AnalogReading): readonly Command[] => {
    const actions = [...held]
    const commands: Command[] = []
    for (const [index, map] of maps.entries())
      for (const command of map.toCommand(actions, tick, reading))
        commands.push({ ...command, seq: tick * maps.length + index })
    return commands
  }

  return {
    command: first.command,
    touch: maps.some((map) => map.touch),
    touchButtons: maps.flatMap((map) => (map.touch ? map.touchButtons : [])),
    touchMode,
    touchStick: maps.some((map) => map.touchStick),
    profile,
    labels: Object.assign({}, ...maps.map((map) => map.labels)),
    toCommand,
    attach(target) {
      // One Input over the merged bindings, in a scope of its own that `dispose` closes, as `keys()` attaches.
      const scope = Effect.runSync(Scope.make())
      const input = Effect.runSync(makeInput({ target, profile, bus: SILENT_BUS }).pipe(Scope.extend(scope)))
      return {
        commands(tick) {
          input.poll()
          return toCommand(input.held(), tick, analogReading(input, CAMERA_SETTINGS_DEFAULT))
        },
        hold: (buttonId) => input.hold(buttonId),
        release: (buttonId) => input.release(buttonId),
        gesture: input.gesture,
        dispose: () => Effect.runSync(Scope.close(scope, Exit.void)),
      }
    },
  }
}
```

#### `InputSource` (interface)

The input map attached to a window for one play session.

```ts
interface InputSource {
  /** This tick's command, if any: one per tick, never an edge (DX spec §3.3). */
  commands(tick: number): readonly Command[]
  /** A touch button pressed or released (its `TouchButton.id`). */
  hold(buttonId: string): void
  release(buttonId: string): void
  /** Gestures from a `SwipeTracker` (M4.3): held swipes and one-tick flicks and taps. */
  readonly gesture: GestureSink
  dispose(): void
}
```

#### `KeyBindings` (type)

By `KeyboardEvent.code`, so the keys sit in the same place on every keyboard layout.

```ts
type KeyBindings<Z extends z.ZodType> = Readonly<Record<string, Payload<Z>>>
```

#### `keys` (function)

An input map sending `command` once per tick with the payload of what is held: keys by
`KeyboardEvent.code`, on-screen touch buttons, gamepad buttons, the stick and gestures, merged over the
idle payload. Throws when a binding's payload fails the command's schema, and when a key in `options.required` has
no binding.

```ts
function keys<Z extends z.ZodType>(
  command: CommandDef<Z>,
  bindings: KeyBindings<Z>,
  options: KeysOptions<Z> = {},
): InputMap {
  const schema = command.schema
  const idleParse = schema.safeParse(options.idle ?? {})
  // What every payload is merged over: the idle payload, or nothing when the schema has no idle state.
  const base = idleParse.success ? asRecord(idleParse.data) : asRecord(options.idle)

  // A binding the schema refuses is a developer error, thrown now rather than dropped every tick (DX spec §6).
  const check = (where: string, payload: unknown): void => {
    const parsed = schema.safeParse({ ...base, ...asRecord(payload) })
    if (!parsed.success) {
      const why = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
      throw new Error(
        `keys(): ${where} → ${JSON.stringify(payload)} fails the "${command.id}" schema (${why})`,
      )
    }
  }
  for (const [code, payload] of Object.entries(bindings)) check(code, payload)
  for (const code of options.required ?? [])
    if (!Object.hasOwn(bindings, code)) throw new Error(`keys(): required key ${code} is not bound`)
  const pad = Object.entries(options.pad ?? {}).map(([index, payload]) => ({ index: Number(index), payload }))
  for (const { index, payload } of pad) check(`pad button ${index}`, payload)
  const gestures = Object.entries(options.gestures ?? {}) as [GestureName, Payload<Z>][]
  for (const [gesture, payload] of gestures) check(`gesture ${gesture}`, payload)
  const stick = Object.entries(options.stick ?? {}) as [StickDirection, Payload<Z>][]
  for (const [direction, payload] of stick) check(`stick ${direction}`, payload)

  // One action per distinct payload: the keys' payloads in binding order, then any pad, stick or gesture payload
  // no key shares.
  const actions: {
    id: string
    payload: unknown
    keys: string[]
    pad: number[]
    stick: StickDirection[]
    gesture: GestureName[]
  }[] = []
  const actionFor = (payload: unknown): (typeof actions)[number] => {
    const key = JSON.stringify(payload)
    const found = actions.find((action) => JSON.stringify(action.payload) === key)
    if (found !== undefined) return found
    const made = { id: `${command.id}-${actions.length}`, payload, keys: [], pad: [], stick: [], gesture: [] }
    actions.push(made)
    return made
  }
  for (const [code, payload] of Object.entries(bindings)) actionFor(payload).keys.push(code)
  for (const { index, payload } of pad) actionFor(payload).pad.push(index)
  for (const [direction, payload] of stick) actionFor(payload).stick.push(direction)
  for (const [gesture, payload] of gestures) actionFor(payload).gesture.push(gesture)

  const touch = options.touch !== false
  const requiredKeys = new Set(options.required ?? [])
  const isRequired = (action: (typeof actions)[number]): boolean =>
    action.keys.some((code) => requiredKeys.has(code))
  const analog = options.analog
  const parsedProfile = inputProfileSchema.safeParse({
    id: command.id,
    bindings: Object.fromEntries([
      ...actions.map((action) => [
        action.id,
        {
          keys: action.keys,
          pad: action.pad,
          ...(action.stick.length > 0 ? { stick: action.stick } : {}),
          touch: touch && action.keys.length > 0,
          ...(action.gesture.length > 0 ? { gesture: action.gesture } : {}),
          ...(isRequired(action) ? { required: true } : {}),
        },
      ]),
      // Binding the camera drag is what turns it on (M4 spec §16.3.1); it has no key and no button.
      ...(analog?.drag === true
        ? [[`${command.id}-drag`, { keys: [], pad: [], touch: false, gesture: ['camera-drag'] }]]
        : []),
    ]),
  })
  // A reserved key or pad button is a developer error, thrown now (M4-D3, I-j).
  if (!parsedProfile.success)
    throw new Error(`keys(): ${parsedProfile.error.issues.map((issue) => issue.message).join('; ')}`)
  const profile = parsedProfile.data
  const modes = touchModesFor(profile)
  if (options.touchMode !== undefined && !modes.includes(options.touchMode))
    throw new Error(
      `keys(): touchMode "${options.touchMode}" needs ${options.touchMode === 'swipe' ? 'a swipe, flick or tap' : 'a touch button'}`,
    )
  const touchMode: TouchMode =
    options.touchMode ?? (modes.includes('buttons') || !modes.includes('swipe') ? 'buttons' : 'swipe')

  const touchButtons: TouchButton[] = actions
    .filter((action) => action.keys.length > 0)
    .map((action) => ({
      id: action.id,
      label: labelFor(action.keys[0] as string),
      keys: action.keys,
      ...(isRequired(action) ? { required: true } : {}),
    }))
  const payloadOf = new Map(actions.map((action) => [action.id, action.payload]))
  const labels = Object.fromEntries(
    actions.map((action) => {
      const named = action.keys.map((code) => options.labels?.[code]).find((label) => label !== undefined)
      const fields = Object.entries(asRecord(action.payload)).map(
        ([field, value]) => `${field} ${String(value)}`,
      )
      return [action.id, named ?? [command.id, ...fields].join(' ')]
    }),
  )

  /** The parsed payload for payloads merged in order over the idle payload; undefined when the schema refuses it. */
  const merge = (payloads: readonly unknown[]): unknown => {
    const parsed = schema.safeParse(Object.assign({}, base, ...payloads.map(asRecord)))
    return parsed.success ? parsed.data : undefined
  }
  const asCommands = (payload: unknown, tick: number): readonly Command[] =>
    payload === undefined ? [] : [{ tick, source: 0, seq: tick, type: command.id, payload }]

  // The parsed payload for the last held list, so a tick with nothing new parses nothing.
  let cachedFor: string | undefined
  let cached: unknown
  const toCommand = (held: Iterable<string>, tick: number): readonly Command[] => {
    const known: string[] = []
    for (const action of held) if (payloadOf.has(action)) known.push(action)
    const key = known.join('|')
    if (key !== cachedFor) {
      cachedFor = key
      cached = merge(known.map((action) => payloadOf.get(action)))
    }
    return asCommands(cached, tick)
  }
  const toCommandWith = (
    held: Iterable<string>,
    tick: number,
    reading?: AnalogReading,
  ): readonly Command[] => {
    if (analog === undefined || reading === undefined) return toCommand(held, tick)
    const known: string[] = []
    for (const action of held) if (payloadOf.has(action)) known.push(action)
    const heldPayload = merge(known.map((action) => payloadOf.get(action)))
    if (heldPayload === undefined) return []
    // Fresh every tick, never cached. A refused merge (a NaN, a float) drops the analog part, not the held keys.
    const parsed = schema.safeParse({
      ...asRecord(heldPayload),
      ...asRecord(analog.read(reading, heldPayload as z.output<Z>)),
    })
    return asCommands(parsed.success ? parsed.data : heldPayload, tick)
  }

  return {
    command,
    touch,
    touchButtons,
    touchMode,
    profile,
    labels,
    touchStick: analog?.touchStick === true,
    toCommand: toCommandWith,
    attach(target) {
      // The Input service over `target`, in a scope of its own that `dispose` closes. Nothing here listens to
      // its facts, so it publishes to a bus no one reads.
      const scope = Effect.runSync(Scope.make())
      const input = Effect.runSync(makeInput({ target, profile, bus: SILENT_BUS }).pipe(Scope.extend(scope)))
      return {
        commands(tick) {
          input.poll()
          return toCommandWith(input.held(), tick, analogReading(input, CAMERA_SETTINGS_DEFAULT))
        },
        hold: (buttonId) => input.hold(buttonId),
        release: (buttonId) => input.release(buttonId),
        gesture: input.gesture,
        dispose: () => Effect.runSync(Scope.close(scope, Exit.void)),
      }
    },
  }
}
```

#### `KeysOptions` (interface)

Options for `keys`: touch buttons, gamepad buttons, gestures and the stick, the idle payload, required keys
and the Controls section's labels.

```ts
interface KeysOptions<Z extends z.ZodType> {
  /** On-screen buttons from the bindings when the player uses touch. Default true. */
  readonly touch?: boolean
  /** Standard-mapping gamepad button index → payload, polled once per tick. */
  readonly pad?: Readonly<Record<number, Payload<Z>>>
  /** Touch gesture → payload (M4.3): a swipe holds while the finger steers, a flick or a tap lasts one tick. */
  readonly gestures?: Readonly<Partial<Record<GestureName, Payload<Z>>>>
  /** Default `buttons` when the map has touch buttons, else `swipe`. The player's setting is M4.4's. */
  readonly touchMode?: TouchMode
  /** A stick pushed past the deadzone in a direction (`left-left`, `right-up`, …) → payload (M4.2). */
  readonly stick?: Readonly<Partial<Record<StickDirection, Payload<Z>>>>
  /** The payload with nothing held. Default: the schema's own defaults (`schema.parse({})`), when it has them. */
  readonly idle?: z.input<Z>
  /**
   * Keys whose actions the game cannot be played without (M4.7): rebinding never leaves them unbound on a device
   * (M4-D4), and where the touch buttons do not all fit, theirs are the ones that show.
   */
  readonly required?: readonly string[]
  /**
   * Action names for the Controls section, by any of the action's default keys: `{ Space: 'Jump' }`. Default: the
   * command and payload (`move x -1`).
   */
  readonly labels?: Readonly<Record<string, string>>
  /** The sticks and the camera drag, added to the held keys' payload each tick (M4 spec §17). */
  readonly analog?: AnalogOptions<Z>
}
```

#### `PluginDef` (interface)

A bundle of definitions the sim registers together: components, commands, events, resources and systems,
the plugins it depends on, and optionally per-sim engine state and `config`. Create one with
`definePlugin`.

```ts
interface PluginDef {
  readonly kind: 'plugin'
  readonly name: string
  /** Creates this plugin's per-sim engine state; its systems see it as `ctx.pluginState`. */
  readonly state: ((setup: PluginStateSetup) => Promise<PluginState>) | undefined
  readonly dependsOn: readonly string[]
  readonly components: readonly ComponentDef[]
  readonly commands: readonly CommandDef[]
  readonly events: readonly EventDef[]
  readonly resources: readonly ResourceDef[]
  readonly systems: readonly SystemDef[]
  /**
   * Settings that change what the plugin simulates (physics gravity), as plain JSON. Part of the schema hash,
   * so a snapshot never restores into a sim configured differently. Undefined when the plugin has none.
   */
  readonly config: unknown
}
```

#### `postFilter` (function)

Declares a screen-space filter over the whole picture: `renderer: { postFilters: [postFilter('vignette', {
glsl, wgsl })] }`. The renderer builds it when it starts and keeps it in the stage's post-filter slot under
`name`. A filter that cannot be built, or whose GLSL does not link, is left out with a warning and the frame
draws without it. Throws when the name or either shader is empty.

```ts
function postFilter(name: string, spec: PostFilterSpec): PostFilterDef {
  if (name.trim() === '') throw new Error('postFilter: name is empty')
  for (const field of ['glsl', 'wgsl'] as const)
    if (spec[field].trim() === '') throw new Error(`postFilter "${name}": ${field} is empty`)
  return Object.freeze({
    name,
    glsl: spec.glsl,
    wgsl: spec.wgsl,
    order: spec.order ?? 0,
    minTier: spec.minTier,
  })
}
```

#### `PostFilterDef` (interface)

A declared filter, as `postFilter` returns it and `PixiRendererOptions.postFilters` takes it.

```ts
interface PostFilterDef {
  readonly name: string
  readonly glsl: string
  readonly wgsl: string
  readonly order: number
  readonly minTier: QualityTier | undefined
}
```

#### `PostFilterSpec` (interface)

What a screen-space filter is made of: the same effect written twice, for WebGL2 (`glsl`) and WebGPU (`wgsl`),
so the two renderers stay at parity. Both are fragment shaders that `filterPrograms` joins to the shared vertex
stage: GLSL reads `vTextureCoord`, `vPixelCoord` and `uTexture`; WGSL has `mainFragment(input: VSOutput)`.

```ts
interface PostFilterSpec {
  /** The GLSL ES 3.00 fragment shader, run under WebGL2. */
  readonly glsl: string
  /** The WGSL fragment shader, run under WebGPU; its entry point is `mainFragment`. */
  readonly wgsl: string
  /** Where it sits among the stage's filters: lower runs first, ties by name. Default 0. */
  readonly order?: number | undefined
  /** The lowest quality tier it runs at; left out, it runs at every tier. */
  readonly minTier?: QualityTier | undefined
}
```

#### `rect` (function)

A filled rectangle that follows its component's `x`, `y` and `angle`, interpolated between ticks:
`entityViews: { [Body.id]: rect({ w: 8, h: 8, color: 0xf9c22b }) }`.

```ts
function rect(options: RectViewOptions): EntityViewFactory {
  const anchor = anchorXY(options.anchor)
  return (_row, componentId) => {
    const graphics = new Graphics()
      .rect(-anchor.x * options.w, -anchor.y * options.h, options.w, options.h)
      .fill(options.color)
    return {
      container: graphics,
      update(curr, prev, alpha = 1) {
        placeView(graphics, curr, prev, alpha, componentId)
      },
      destroy() {
        graphics.destroy()
      },
    }
  }
}
```

#### `RectViewOptions` (interface)

A `rect` view's size, colour and anchor.

```ts
interface RectViewOptions {
  /** Width in world pixels. */
  readonly w: number
  /** Height in world pixels. */
  readonly h: number
  /** Fill colour, e.g. 0xf9c22b. */
  readonly color: number
  /** Default 0.5 (centred on the entity's position). */
  readonly anchor?: ViewAnchor | undefined
}
```

#### `ResourceDef` (interface)

A value the sim keeps once, not on any entity: an id, a Zod schema and the `init` that gives its starting
value. Create one with `defineResource`.

```ts
interface ResourceDef<Z extends z.ZodType = z.ZodType> {
  readonly kind: 'resource'
  readonly id: string
  readonly schema: Z
  readonly init: () => z.input<Z>
}
```

#### `SaveDef` (interface)

A game's save: one record, or a fixed number of slots, each one Ruken key.

```ts
interface SaveDef<S> {
  /** The key prefix. Ruken's key rule is the SDK's, which checks it on write. */
  readonly key: string
  /** This build's version of the data, an integer from 1. */
  readonly version: number
  readonly schema: z.ZodType<S>
  /** What an empty slot loads as. */
  readonly empty: () => S
  /** `migrations[n]` turns version `n` data into version `n + 1`. */
  readonly migrations: Readonly<Record<number, SaveMigration>>
  /** Absent: one record, slot 0, stored at `key`. */
  readonly slots?: { readonly count: number }
  /** Absent: save on `screen-exit`, `round-end` and `background`, with no timer (M5-D10). `{ on: [] }` turns it off. */
  readonly autosave?: AutosavePolicy
}
```

#### `ScreensCopy` (interface)

Every word the default title, play, paused and settings screens show (DX spec §7, M4 spec §4.8, M5 spec §4.8).

```ts
interface ScreensCopy {
  readonly title: { readonly play: string }
  /** The play screen's corner button and the touch stick, read by assistive technology. */
  readonly play: { readonly pause: string; readonly move: string }
  readonly paused: {
    readonly title: string
    readonly resume: string
    /** The dialog's close button away from the menu (the quit confirm, the changed-elsewhere step). */
    readonly back: string
    readonly mute: string
    readonly unmute: string
    readonly settings: string
    readonly quit: string
    readonly quitPrompt: string
    readonly quitConfirm: string
    readonly cancel: string
    /** Why play paused when a controller in use was unplugged (M4-D9). */
    readonly reconnect: string
  }
  readonly settings: {
    readonly screen: SettingsScreenCopy
    readonly prompts: PromptCopy
    readonly controls: ControlsCopy
    readonly language: LanguageCopy
    readonly vibration: VibrationCopy
    readonly audio: AudioCopy
    readonly touch: TouchCopy
    readonly display: DisplayCopy
  }
  readonly saves: {
    readonly slots: SaveSlotsCopy
    readonly status: SaveStatusCopy
    readonly changedElsewhere: ChangedElsewhereCopy
    readonly changedElsewhereToast: string
  }
  /** The scored board on the paused screen (M5.7). */
  readonly board: LeaderboardCopy
  /** Told once when a controller the input does not support is plugged in (M4 spec §6). */
  readonly padUnsupported: string
}
```

#### `ScreensCopyInput` (type)

A game's words for the default screens: a part of the record, or a function of the player's locale returning one.
The function runs again on each language change, so a Paraglide game can pass its messages:
`screens: () => ({ title: { play: m.play() } })`.

```ts
type ScreensCopyInput = ScreensCopyOverrides | ((locale: string) => ScreensCopyOverrides)
```

#### `ScreensCopyOverrides` (type)

A part of `ScreensCopy` with every group optional, down to the words; a word or a function is replaced whole.

```ts
type ScreensCopyOverrides<T = ScreensCopy> = {
  readonly [K in keyof T]?: T[K] extends Leaf ? T[K] : ScreensCopyOverrides<T[K]>
}
```

#### `ScreensGame` (interface)

What the default screens need from the game.

```ts
interface ScreensGame {
  readonly title: string
  readonly sim: {
    readonly plugins: readonly PluginDef[]
    readonly seed: number
    readonly setup?: ((sim: Sim) => void) | undefined
    readonly content?: unknown
  }
  readonly input?: InputMap | undefined
  /** Told the sim play runs, and `undefined` when the title drops it: the draw layer reads it (PRODUCT.2). */
  readonly watchSim?: ((sim: Sim | undefined) => void) | undefined
  /** The board paused shows: the game's first scored board (M5.7). None: paused shows no board. */
  readonly board?: string | undefined
  /** Applies the player's graphics quality to the stage (M4.4): the saved one at the title, then each choice. */
  readonly setQuality?: ((tier: QualityTier) => void) | undefined
  /** The game's save (M5.2): the title lists its slots and play keeps the loaded one saved. None: no slot list. */
  readonly saves?: GameSaves<unknown> | undefined
  /** The game's extensions: play draws their `hud.overlay` components (M4.7), Settings shows their `settings.sections` (M4.4). */
  readonly extensions?: readonly ExtensionDef[] | undefined
  /** The game's words for these screens (`GameSpec.copy.screens`, DX.2d), over the English defaults. */
  readonly copy?: ScreensCopyInput | undefined
}
```

#### `SettingsScreenCopy` (interface)

The Settings screen's own words: its title, Back, the tabs and the overflow count.

```ts
interface SettingsScreenCopy {
  readonly title: string
  readonly back: string
  readonly tabs: string
  readonly settingsTab: string
  readonly controlsTab: string
  readonly more: (count: number) => string
}
```

#### `Sim` (interface)

A running simulation, stepped with commands, that can snapshot, restore and hash its state. `step` is the
only way gameplay state changes. Create one with `createSim`, and `dispose` it when done.

```ts
interface Sim {
  readonly seed: number
  readonly tickHz: number
  readonly tick: number
  /** XXH64 of the canonical content this sim was created with, 16 hex digits; the snapshot header's value. */
  readonly contentHash: string
  step(commands: readonly Command[]): StepResult
  /** Setup and inspection outside `step` (tests, scene setup). Runtime changes go through commands. */
  spawn(parts: readonly SpawnPart[]): number
  entity(sid: number): EntityRef | undefined
  query(...components: ComponentDef[]): EntityRef[]
  resource<Z extends z.ZodType>(def: ResourceDef<Z>): z.output<Z>
  /** Canonical snapshot v1 bytes (spec §4.6). */
  snapshot(): Uint8Array
  /** Replaces the whole state. Throws SnapshotFormatError / SnapshotMismatchError and leaves the sim unchanged. */
  restore(bytes: Uint8Array): void
  /**
   * A readable view of `bytes`, or of the current state when none are given (M2.3 spec §3.1). Decodes and checks
   * the header as `restore` does (SnapshotFormatError / SnapshotMismatchError) but not restore's later
   * cross-checks, and changes nothing.
   */
  describeSnapshot(bytes?: Uint8Array): SnapshotView
  /** xxhash64 of the snapshot, 16 hex digits. */
  hash(): string
  /** Frees the Koota world and every plugin's engine. Idempotent; any later call throws SimDisposedError. */
  dispose(): void
}
```

#### `SimContext` (interface)

What a system's `run` receives each tick (spec §4.1).

```ts
interface SimContext {
  readonly tick: number
  /** Fixed step, 1 / tickHz. */
  readonly dt: number
  /** This system's own RNG substream. */
  readonly rng: Rng
  /** Compiled content, deep-frozen. */
  readonly content: unknown
  /** Live entities that have every listed component, in ascending StableId order. */
  query(...components: ComponentDef[]): EntityRef[]
  entity(sid: number): EntityRef | undefined
  /** Spawns immediately; returns the new StableId. */
  spawn(...parts: SpawnPart[]): number
  /** Despawn is deferred to the end of the tick (built-in `entities.flush`). */
  despawn(sid: number): void
  readonly commands: {
    of<Z extends z.ZodType>(def: CommandDef<Z>): ReadonlyArray<CommandRecord<z.output<Z>>>
  }
  emit<Z extends z.ZodType>(def: EventDef<Z>, payload: z.input<Z>): void
  resource<Z extends z.ZodType>(def: ResourceDef<Z>): z.output<Z>
  /** The per-sim state of the plugin that registered this system (`definePlugin({ state })`), else undefined. */
  readonly pluginState: unknown
}
```

#### `sprite` (function)

A sprite that follows its component's `x`, `y` and `angle`, interpolated between ticks. `source` is a
texture or a url: a url the runtime already loaded (it is in `Assets.cache`) shows at once; otherwise the
sprite is empty until `Assets.load` resolves. A url that fails to load is reported with `reportError`
and the sprite stays empty. The frame textures are sliced once per factory and shared by its sprites.
With `frame`, the url is an atlas page's Spritesheet and the sprite shows that frame; a name the atlas lacks
is reported the same way.

```ts
function sprite(source: Texture | string, options: SpriteViewOptions = {}): EntityViewFactory {
  if (options.frame !== undefined && options.frames !== undefined) {
    throw new Error(
      'sprite: `frame` (an atlas frame) and `frames` (a sheet of equal frames) cannot be combined',
    )
  }
  const anchor = anchorXY(options.anchor)
  let frames: readonly Texture[] | undefined
  let loading: Promise<readonly Texture[]> | undefined

  if (typeof source !== 'string') {
    frames = sliceFrames(source, options.frames)
  } else if (Assets.cache.has(source)) {
    try {
      frames = texturesOf(Assets.cache.get(source), options)
    } catch (error) {
      // Reported once; the sprites stay empty, as for a url that fails to load.
      globalThis.reportError?.(error)
      frames = [Texture.EMPTY]
    }
  }

  function load(url: string): Promise<readonly Texture[]> {
    if (loading === undefined) {
      loading = Assets.load<unknown>(url).then((loaded) => {
        frames = texturesOf(loaded, options)
        return frames
      })
      // One report per factory, however many sprites wait on the same url.
      loading.catch((error: unknown) => globalThis.reportError?.(error))
    }
    return loading
  }

  return (_row, componentId) => {
    const shown = new Sprite(frames?.[0] ?? Texture.EMPTY)
    shown.anchor.set(anchor.x, anchor.y)
    let frameField: unknown

    const showFrame = (): void => {
      if (frames === undefined || shown.destroyed) return
      shown.texture = frames[frameIndex(frameField, frames.length)] ?? Texture.EMPTY
    }

    if (frames === undefined && typeof source === 'string') {
      load(source).then(showFrame, () => {})
    }

    return {
      container: shown,
      update(curr, prev, alpha = 1) {
        placeView(shown, curr, prev, alpha, componentId)
        frameField = poseComponent(curr, componentId)?.frame
        showFrame()
      },
      destroy() {
        shown.destroy()
      },
    }
  }
}
```

#### `SpriteFrames` (interface)

The texture is a sheet of equal frames, read left to right, top to bottom. The pose component's numeric
`frame` field picks one (floored, wrapped by the frame count); with no `frame` field the first is shown.
Frames switch on ticks; they are not interpolated.

```ts
interface SpriteFrames {
  readonly width: number
  readonly height: number
  /** Default: every whole frame that fits in the texture. */
  readonly count?: number | undefined
}
```

#### `SpriteViewOptions` (interface)

A `sprite` view's anchor and either its sprite-sheet frames or one frame of a packed atlas.

```ts
interface SpriteViewOptions {
  /** Default 0.5 (centred on the entity's position). */
  readonly anchor?: ViewAnchor | undefined
  readonly frames?: SpriteFrames | undefined
  /**
   * A frame of a packed atlas (M5.6): `source` is the url of an atlas page's Spritesheet JSON, which
   * `automata-content assets` writes, and `frame` names one of its frames. Not with `frames`.
   */
  readonly frame?: string | undefined
}
```

#### `startGame` (function)

Boots a game (DX spec §3.1): `defineGame`'s defaults over the runtime, the Pixi renderer, Ruken hosting
and the default screens, then the runtime's boot on the game's root. Takes a spec or a game `defineGame`
already returned. Throws `BootDefect` before anything mounts when the spec is invalid or there is no
root (`spec.root`, else `#game`); a failure after that shows on the runtime's boot failure panel.

```ts
function startGame<S = never>(game: GameSpec<S> | DefinedGame<S>): RuntimeHandle {
  const defined = isDefinedGame(game) ? game : defineGame(game)
  // Read the root once, here, so a missing one throws before the runtime starts.
  return runGame({ ...defined, root: defined.root })
}
```

#### `StepResult` (interface)

What one `step` produced: the new tick, the events emitted, the renderer's delta and the commands that were
rejected.

```ts
interface StepResult {
  /** The tick the sim is at after this step. */
  readonly tick: number
  readonly events: readonly SimEvent[]
  readonly render: RenderDelta
  /** Invalid commands, in input order. The sim has no I/O, so it reports instead of logging. */
  readonly rejected: readonly RejectedCommand[]
}
```

#### `SystemDef` (interface)

A system: a name, the phase it runs in, the systems it must run `before` or `after` within that phase, and
its `run`, called once per tick. Create one with `defineSystem`.

```ts
interface SystemDef {
  readonly kind: 'system'
  readonly name: string
  readonly phase: Phase
  readonly before: readonly string[]
  readonly after: readonly string[]
  readonly run: (ctx: SimContext) => void
}
```

#### `TouchButton` (interface)

One on-screen touch button: every key bound to the same payload shares it.

```ts
interface TouchButton {
  readonly id: string
  readonly label: string
  readonly keys: readonly string[]
  /** Which lower corner's group it sits in (M4 spec §4.4). Default `start`; a game moves buttons to `end` itself. */
  readonly side?: 'start' | 'end' | undefined
  /** The game cannot be played without it: where the touch buttons do not all fit, only these show (M4.7). */
  readonly required?: boolean | undefined
}
```

## `@mcthaydt/automata-content`

### `import { … } from '@mcthaydt/automata-content'`

#### `AssetsSource` (interface)

What `content/assets.toml` says: for each screen, the files it waits for (`dir/*` names every file in a
folder), and the atlases and fonts of the asset build it uses, by their names in `atlases.toml` and
`fonts.toml`. A preloaded screen's atlas pages and font subsets join the preload list (M5.6F.2).

```ts
interface AssetsSource {
  readonly screens: Readonly<Record<string, {
    readonly files: readonly string[];
    /** Atlases named in `content/atlases.toml`: each page's Spritesheet JSON and image. */
    readonly atlases?: readonly string[] | undefined;
    /** Fonts named in `content/fonts.toml`: the subset of every language `fonts.json` lists. */
    readonly fonts?: readonly string[] | undefined;
  }>>;
}
```

#### `buildContent` (const)

Compiles, writes every output under the output folder, then removes the outputs it no longer produces.

```ts
const buildContent: (options: ContentOptions) => Effect.Effect<CompiledContent, ContentCompileFailed | InvalidContentConfig | ContentWriteFailed>;
```

#### `checkTuningLayer` (function)

Checks one layer of tuning against code-owned declarations. `complete` is true for the base layer, which
must name every tunable; false for a partial override (FloorFifty's stage and mode layers).

Invariants are rejected before unknown names so the more specific answer wins, then non-numbers, then
integer declarations, then the inclusive range.

```ts
function checkTuningLayer(layer: Readonly<Record<string, unknown>>, options: TuningOptions & {
  readonly tunables: TunableDeclarations;
}, { complete }: {
  readonly complete: boolean;
}): Problem[];
```

#### `compileContent` (const)

Compiles `<root>/content` in memory. Writes nothing.

```ts
const compileContent: (options: ContentOptions) => Effect.Effect<CompiledContent, ContentCompileFailed | InvalidContentConfig>;
```

#### `CompiledContent` (interface)

The result of a compile: the content and its hash, the sim partition, every output file's text, warnings,
the languages and each language's message catalog.

```ts
interface CompiledContent {
  readonly data: ContentData;
  /** Over all of `data`: the boot check and evidence identity. Never compared with `sim.hash`. */
  readonly hash: string;
  /** What the sim receives, and the hash that gates snapshots and replays (M2.2 spec §3.2). */
  readonly sim: SimPartition;
  /** Each output path, relative to the output folder, to its exact text. Build and verify use the same bytes. */
  readonly files: ReadonlyMap<string, string>;
  /** Problems that do not stop a compile (`skippedFile`), sorted. They are not part of the hash or the outputs. */
  readonly warnings: readonly Diagnostic[];
  /** The source language, then each translation's language, sorted. */
  readonly languages: readonly string[];
  /**
   * Each language's checked catalog (without `$schema`), in `languages` order. Derived beside the hashed data,
   * never inside it, so a translation edit moves neither hash. Paraglide and the glyph sets read these.
   */
  readonly catalogs: ReadonlyMap<string, MessageCatalog>;
  /**
   * Where each language's messages are written, in `languages` order: a source message at its text in the
   * TOML, a translated one at its key in `messages/<lang>.json`. The glyph gate names a message by these (M5.5).
   */
  readonly messageLocations: ReadonlyMap<string, ReadonlyMap<string, MessageLocation>>;
}
```

#### `ContentCompileFailed` (class)

The authored content has problems. Every one is listed, sorted; nothing was written.

```ts
class ContentCompileFailed extends CompileFailedBase {}
```

#### `ContentConfig` (type)

The default export of `automata.content.ts`.

```ts
type ContentConfig = Omit<ContentOptions, "root"> & {
  /** The authoring guide whose tunable table `docs` writes and `--verify-artifact` checks. */
  readonly guide?: string | undefined;
};
```

#### `ContentData` (type)

The compiled content as it is written to `content.json` and hashed.

```ts
type ContentData = Readonly<Record<string, unknown>>;
```

#### `ContentGenerator` (interface)

A generator: a unique name and a pure `generate` that turns compiled content into extra files. Create one
with `defineContentGenerator`.

```ts
interface ContentGenerator {
  readonly name: string;
  generate(input: GeneratorInput): GeneratorOutput;
}
```

#### `contentHash` (function)

16 lowercase hex digits.

```ts
function contentHash(data: unknown): string;
```

#### `ContentOptions` (interface)

What the content compiler is given: the project root, the registered kinds, and optionally tunables,
invariants, flow capabilities, generators, an output folder and Paraglide.

```ts
interface ContentOptions {
  /** The project root; content is read from `<root>/content`. */
  readonly root: string;
  readonly schemas: readonly ContentSchemaDef[];
  /** Code-owned tunable names and ranges. Absent: ranges are authored in `tuning.toml`. */
  readonly tunables?: TunableDeclarations | undefined;
  /** Code-only constants an author may not write in `tuning.toml`. */
  readonly invariants?: readonly string[] | undefined;
  /** Code-owned screens, pairs and styles for `flow.toml`. */
  readonly flow?: FlowCapabilities | undefined;
  readonly generators?: readonly ContentGenerator[] | undefined;
  /** Relative to `root`. Default `content/generated`. */
  readonly outDir?: string | undefined;
  /** Compile the catalogs with Paraglide on each build (PRODUCT.L2). Absent: no Paraglide output. */
  readonly paraglide?: ParaglideOptions | undefined;
}
```

#### `contentRef` (function)

The ID of another content item of `kind`. Checked to exist, and to be that kind, after parsing.

```ts
function contentRef<const K extends string>(kind: K): z.ZodType<string, string>;
```

#### `ContentSchemaDef` (interface)

A content kind a game registers: its name, the Zod schema each item must match, where its TOML files live,
and whether the sim receives it. Create one with `defineContentSchema`.

```ts
interface ContentSchemaDef<K extends string = string, S extends z.ZodType = z.ZodType> {
  readonly kind: K;
  readonly schema: S;
  readonly place: ContentSchemaPlace;
  /**
   * Whether the sim receives this kind (M2.2 spec §3.1). Default true: content is gameplay unless the game
   * says otherwise, so a forgotten flag can only refuse a snapshot, never let a gameplay change through.
   */
  readonly sim: boolean;
}
```

#### `ContentSchemaOptions` (interface)

Options for `defineContentSchema`; `sim: false` keeps the kind out of the sim's content and its hash.

```ts
interface ContentSchemaOptions {
  readonly sim?: boolean;
}
```

#### `ContentSchemaPlace` (type)

Where a kind's files are: every TOML file under a folder (a collection), or one file (a document).

```ts
type ContentSchemaPlace = {
  readonly folder: string;
} | {
  readonly file: string;
};
```

#### `ContentWriteFailed` (class)

An output could not be written. Files already replaced are whole; none is half written.

```ts
class ContentWriteFailed extends WriteFailedBase {}
```

#### `DEFAULT_OUT_DIR` (const)

Where outputs go when `outDir` is not set: `content/generated`, relative to the project root.

```ts
const DEFAULT_OUT_DIR = "content/generated";
```

#### `DEFAULT_PALETTE` (const)

The palette a game gets when it has no `content/palette.toml`: Endesga 64.

```ts
const DEFAULT_PALETTE: Palette;
```

#### `defineContentGenerator` (function)

Defines a generator by name and `generate` function. Generators do no I/O: the compiler writes their files.
A generator that throws, repeats another's name, returns a path outside the output folder or writes a file
another generator wrote is reported as `InvalidContentConfig`.

```ts
function defineContentGenerator(name: string, generate: (input: GeneratorInput) => GeneratorOutput): ContentGenerator;
```

#### `defineContentSchema` (function)

Registers a content kind: a name, its Zod schema, and a folder (every TOML file in it is an item) or one
file (a single document). The sim receives the kind unless `{ sim: false }`. A bad registration (a name
that does not start with a lower-case letter followed by lower-case letters, digits and dashes, a built-in
name, a duplicate, or a place two kinds share) is reported when content compiles, as `InvalidContentConfig`.

```ts
function defineContentSchema<const K extends string, S extends z.ZodType>(kind: K, schema: S, place: ContentSchemaPlace, options?: ContentSchemaOptions): ContentSchemaDef<K, S>;
```

#### `Diagnostic` (interface)

One authoring problem: a stable `code`, the file to open, the 1-based line and column, the dotted key
inside it and a message that says what to write instead.

```ts
interface Diagnostic {
  readonly code: DiagnosticCode;
  /** Project-relative, `/`-separated, e.g. `content/tuning.toml`. */
  readonly file: string;
  readonly line: number;
  readonly column: number;
  /** Dotted path inside the file (`transitions.3.to`), or '' for the whole file. */
  readonly keyPath: string;
  readonly message: string;
}
```

#### `DiagnosticCode` (type)

Stable codes. Tests and tools match on these, so a code is never renamed, only added.

```ts
type DiagnosticCode = "invalidToml" | "invalidType" | "missingField" | "unknownField" | "invalidId" | "unknownReference" | "wrongKind" | "outOfRange" | "invariantNotAuthorable" | "invalidFlow" | "invalidPalette" | "invalidGame" | "missingAsset" | "invalidAsset" | "offPalette" | "missingGlyph" | "duplicateMessageKey" | "staleTranslation" | "staleArtifact" | "reservedKey" | "simReference" | "skippedFile";
```

#### `FlowCapabilities` (interface)

What the game's code implements: the screens, and optionally the pairs and destinations each allows.

```ts
interface FlowCapabilities {
  /** The only screen a session may begin on. */
  readonly entry?: string;
  readonly screens: readonly string[];
  /** For each screen and event, the destinations that screen is prepared to enter (FloorFifty `FLOW_TARGETS`). */
  readonly targets?: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;
  /** Transition styles the runtime draws. Default: only `cut`. */
  readonly styles?: readonly string[];
}
```

#### `FlowGraph` (interface)

The checked screen flow from `flow.toml`: the entry screen, every screen, the terminal screens and every
transition, in a fixed order.

```ts
interface FlowGraph {
  readonly entry: string;
  /** Sorted. */
  readonly screens: readonly string[];
  /** Sorted. */
  readonly terminal: readonly string[];
  /** Sorted by from, event, then to (FloorFifty `byPair`): declaration order means nothing. */
  readonly transitions: readonly FlowTransition[];
}
```

#### `FlowTransition` (interface)

One checked move in the flow: on `event` the game goes `from` one screen `to` another, drawn in the
`transition` style (`cut` when unwritten).

```ts
interface FlowTransition {
  readonly from: string;
  readonly event: string;
  readonly to: string;
  readonly transition: string;
}
```

#### `formatDiagnostic` (function)

`content/tuning.toml:12:1  GRAVITY  outOfRange: expected -1200..-100, received -2000`

```ts
function formatDiagnostic(d: Diagnostic): string;
```

#### `GameSource` (interface)

What `content/game.toml` says about the game: its source language, rating, content descriptors, estimated
hours, the analytics events it may send, and the screens whose files are preloaded.

```ts
interface GameSource {
  /** The language the TOML is written in. Default `en`. */
  readonly source_language: string;
  readonly rating: Rating;
  readonly descriptors: string[];
  readonly estimated_hours?: number | undefined;
  readonly custom_events: string[];
  /** The screens whose files Ruken preloads, in order. Default: the flow's entry. */
  readonly preload_screens?: string[] | undefined;
}
```

#### `GeneratorInput` (interface)

Everything a generator is given: the compiled content and its hash, the sim partition, the registered
schemas, the message catalog and the tuning metadata.

```ts
interface GeneratorInput {
  readonly data: ContentData;
  readonly hash: string;
  /** The sim partition and its hash (M2.2), so a generator never re-derives it from `schemas`. */
  readonly sim: SimPartition;
  readonly schemas: readonly ContentSchemaDef[];
  readonly messages: MessageCatalog;
  readonly tuning: TuningMeta;
}
```

#### `GeneratorOutput` (interface)

What a generator returns: files to write and diagnostics to report. Both are optional.

```ts
interface GeneratorOutput {
  /** Path relative to the output folder → the file's exact text. */
  readonly files?: Readonly<Record<string, string>>;
  readonly diagnostics?: readonly Diagnostic[];
}
```

#### `InvalidContentConfig` (class)

The game's code registered something unusable (a duplicate kind, a clashing generator).

```ts
class InvalidContentConfig extends InvalidConfigBase {}
```

#### `localized` (function)

Text a player reads, written in the source language. It gets a message key for translators.

```ts
function localized(): z.ZodType<string, string>;
```

#### `MessageCatalog` (type)

One locale's messages: message key to translated text.

```ts
type MessageCatalog = Readonly<Record<string, string>>;
```

#### `messageKey` (function)

The message key of one text. `id` is absent for a single-document kind.

```ts
function messageKey(kind: string, id: string | undefined, path: DataPath): string;
```

#### `MessageLocation` (interface)

A message's place in its file, 1-based.

```ts
interface MessageLocation {
  readonly file: string;
  readonly line: number;
  readonly column: number;
}
```

#### `Palette` (interface)

The game's palette: a name and its colors.

```ts
interface Palette {
  readonly name: string;
  /** `#rrggbb`, lowercase, in authored order. */
  readonly colors: readonly string[];
}
```

#### `ParaglideOptions` (interface)

Where and which catalogs `ContentOptions.paraglide` compiles with Paraglide on build.

```ts
interface ParaglideOptions {
  /** Where the generated `runtime.js` and `messages.js` go, relative to the root. Emptied on each compile. */
  readonly outdir: string;
  /** The game's own catalogs, `{locale}` path patterns relative to the root (`messages/ui/{locale}.json`). */
  readonly catalogs?: readonly string[] | undefined;
}
```

#### `PreloadInput` (interface)

What `preloadList` reads: the content options (to compile `game.toml` and `assets.toml`, and to find the asset
build's outputs below `outDir`) and the built game folder.

```ts
interface PreloadInput {
  readonly options: ContentOptions;
  /** The built game folder (Vite's `dist/`). */
  readonly distDir: string;
}
```

#### `preloadList` (const)

The files Ruken preloads before the game starts, in order, for `[loading] preload`: each `preload_screens`
screen's files from `assets.toml` (the flow's entry when none is named), then the pages of the atlases and
every language's subset of the fonts it names there, which `automata-content assets` wrote below `outDir`
and the build serves in `atlases/` and `fonts/`; without repeats. Empty without a `game.toml`. Fails with
`ContentCompileFailed` carrying a diagnostic for every file the build lacks (`missingAsset`), every atlas or
font not declared (`unknownReference`) or not built (`missingAsset`), all at once, or with
`InvalidContentConfig`.

```ts
const preloadList: (input: PreloadInput) => Effect.Effect<string[], ContentCompileFailed | InvalidContentConfig>;
```

#### `renderTuningTable` (function)

Every tunable once, sorted by name, with its type, range and value in `content/tuning.toml`.

```ts
function renderTuningTable(meta: TuningMeta): string;
```

#### `RukenFields` (type)

The `[content]` and `[analytics]` tables of Ruken's manifest, worked out from `game.toml` and the languages
present and written to `ruken-fields.json`.

```ts
type RukenFields = Pick<Manifest, "content" | "analytics">;
```

#### `SimPartition` (interface)

The part of the compiled content the sim receives (`tuning` and every kind with `sim: true`) and its hash,
which gates snapshots and replays.

```ts
interface SimPartition {
  /** `tuning` and each sim kind, the same objects as in the full data. */
  readonly data: ContentData;
  /** `contentHash(data)`: exactly what `createSim` computes from the same data. */
  readonly hash: string;
}
```

#### `sortDiagnostics` (function)

Returns the diagnostics in the one fixed order (file, line, column, key, code, message), without changing
the input. The order never depends on locale.

```ts
function sortDiagnostics(diagnostics: readonly Diagnostic[]): Diagnostic[];
```

#### `TunableDeclaration` (interface)

A tunable a game declares in code: `int` or `float`, an inclusive range and a default. Content selects a
value inside the range and never widens it.

```ts
interface TunableDeclaration {
  readonly type: TunableType;
  /** Inclusive lower bound. */
  readonly min: number;
  /** Inclusive upper bound. */
  readonly max: number;
  readonly default: number;
}
```

#### `TunableDeclarations` (type)

A game's tunables by name (upper-case words joined by underscores, such as `GRAVITY`).

```ts
type TunableDeclarations = Readonly<Record<string, TunableDeclaration>>;
```

#### `TuningMeta` (type)

Every tunable's type, value and range (`min`, `max`, `step`) by name, as written to `tuning-meta.json` for
debug sliders.

```ts
type TuningMeta = Readonly<Record<string, TuningEntryMeta>>;
```

#### `verifyContent` (const)

Fails with `staleArtifact` for each committed output that differs from a fresh compile.

```ts
const verifyContent: (options: ContentOptions) => Effect.Effect<void, ContentCompileFailed | InvalidContentConfig>;
```

#### `withTuningTable` (function)

The guide with its generated section replaced, or undefined when it has no markers.

```ts
function withTuningTable(guide: string, meta: TuningMeta): string | undefined;
```

### `import { … } from '@mcthaydt/automata-content/assets'`

#### `ATLAS_EXTRUDE` (const)

Pixels of each frame's edge repeated around it, so filtering never samples a neighbour.

```ts
const ATLAS_EXTRUDE = 1;
```

#### `ATLAS_PADDING` (const)

Transparent pixels between cells, and between a cell and the page edge.

```ts
const ATLAS_PADDING = 1;
```

#### `ATLAS_PAGE_MAX` (const)

The largest atlas page side, in pixels: WebGL2's guaranteed `MAX_TEXTURE_SIZE`.

```ts
const ATLAS_PAGE_MAX = 2048;
```

#### `AtlasFrameTooLarge` (class)

A frame that cannot fit a page even alone.

```ts
class AtlasFrameTooLarge extends Error {
  readonly frame: FrameSize;
  constructor(frame: FrameSize);
}
```

#### `AtlasOutputs` (interface)

What `buildAtlases` produces; the caller writes it.

```ts
interface AtlasOutputs {
  /** `<atlas>-<page>.png` and `<atlas>-<page>.json`, sorted by name. */
  readonly files: ReadonlyMap<string, Uint8Array>;
}
```

#### `buildAtlases` (const)

Builds every atlas `<root>/content/atlases.toml` names, or fails with every problem found. Without the file
there is nothing to build.

```ts
const buildAtlases: (root: string) => Effect.Effect<AtlasOutputs, ContentCompileFailed>;
```

#### `buildFonts` (const)

Builds every subset `<root>/content/fonts.toml` names, or fails with every problem found. Without the file
there is nothing to build, and the content is not compiled.

```ts
const buildFonts: (options: ContentOptions) => Effect.Effect<FontOutputs, ContentCompileFailed | InvalidContentConfig>;
```

#### `fontCoverage` (function)

Whether a font file (TrueType, OpenType, woff or woff2) has a glyph for each character.

```ts
function fontCoverage(font: Uint8Array): (character: string) => boolean;
```

#### `FontOutputs` (interface)

What `buildFonts` produces; the caller writes it.

```ts
interface FontOutputs {
  /** `<font>-<locale>-<hash8>.woff2` and `fonts.json` (`{ font: { locale: file } }`), sorted by name. */
  readonly files: ReadonlyMap<string, Uint8Array>;
}
```

#### `FontsFile` (interface)

`content/fonts.toml`: each source font by name.

```ts
interface FontsFile {
  readonly font: Readonly<Record<string, FontSource>>;
}
```

#### `FontSource` (interface)

One source font: its committed file, the sha256 of its bytes, its licence and the languages it serves.

```ts
interface FontSource {
  readonly file: string;
  readonly sha256: string;
  readonly license: string;
  readonly locales: readonly string[];
}
```

#### `FrameSize` (interface)

A frame to pack: its name (the PNG's file name without `.png`) and size in pixels.

```ts
interface FrameSize {
  readonly name: string;
  readonly width: number;
  readonly height: number;
}
```

#### `PackedAtlas` (interface)

Every frame's placement, and the pages they fill.

```ts
interface PackedAtlas {
  /** Each page's side, in pixels. */
  readonly pageSizes: readonly number[];
  /** In code-unit order of the frame names. */
  readonly placements: readonly Placement[];
}
```

#### `packFrames` (function)

Packs `frames` into atlas pages. Throws `AtlasFrameTooLarge` for a frame no page can hold.

```ts
function packFrames(frames: readonly FrameSize[]): PackedAtlas;
```

#### `Placement` (interface)

Where a frame's own pixels are: inside its extrusion, on page `page`.

```ts
interface Placement {
  readonly name: string;
  readonly page: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
```

#### `subsetWoff2` (function)

The font cut to `characters`, as woff2. A character the font lacks is simply not in the subset.

```ts
function subsetWoff2(source: Uint8Array, characters: ReadonlySet<string>): Promise<Uint8Array>;
```

### `import { … } from '@mcthaydt/automata-content/locale'`

#### `ALWAYS_CHARACTERS` (const)

Printable ASCII, CJK symbols and punctuation, half- and full-width forms, and the symbols the UI draws.

```ts
const ALWAYS_CHARACTERS: readonly string[];
```

#### `catalogCharacters` (function)

Every character the catalog's messages show. `$schema` is the file's format, not text a player reads.

```ts
function catalogCharacters(catalog: MessageCatalog): Set<string>;
```

#### `ContentText` (type)

`text(kind, id, path, authored, inputs?)`: the text in the active locale, or the authored text.

```ts
type ContentText = (kind: string, id: string | undefined, path: DataPath, authored: string, inputs?: Readonly<Record<string, unknown>>) => string;
```

#### `ContentTextOptions` (interface)

Options for `createContentText`.

```ts
interface ContentTextOptions {
  /** Called once per key the messages lack. */
  readonly onMissing?: ((key: string) => void) | undefined;
}
```

#### `createContentText` (function)

A lookup over the messages module Paraglide compiles into `paraglide.outdir` (its `messages.js`, imported whole).

```ts
function createContentText(messages: Readonly<Record<string, unknown>>, options?: ContentTextOptions): ContentText;
```

#### `endonymOf` (function)

A language's name in its own language ("日本語" for `ja`), from the browser's `Intl.DisplayNames`. An engine without
it, or a tag it cannot name, gives the tag back, so the picker never shows nothing.

```ts
function endonymOf(tag: string): string;
```

#### `hasRawText` (function)

True when a piece of visible text has English in it that did not come from the xx-long catalog: any ASCII
letter outside a ⟦ ⟧ span. Data a player typed (a name) is also "raw", so a check lists the data it expects.

```ts
function hasRawText(text: string): boolean;
```

#### `localeCharacters` (function)

A locale's own characters for its subset font: `ALWAYS_CHARACTERS` and the catalog's characters. The font build
also adds every content language's name for the language picker (`endonymOf`, M5.5F).

```ts
function localeCharacters(catalog: MessageCatalog): Set<string>;
```

#### `MessageCatalog` (type)

One locale's messages: message key to translated text.

```ts
type MessageCatalog = Readonly<Record<string, string>>;
```

#### `messageKey` (function)

The message key of one text. `id` is absent for a single-document kind.

```ts
function messageKey(kind: string, id: string | undefined, path: DataPath): string;
```

#### `MessageValue` (type)

A value in an inlang message file: a message, a list of variants, or a namespace or variant object.

```ts
type MessageValue = string | readonly MessageValue[] | {
  readonly [key: string]: MessageValue;
};
```

#### `PSEUDO_LOCALE` (const)

The pseudo-locale's tag. `Intl` reads it as the unknown language `xx`, so formatting falls back, never throws.

```ts
const PSEUDO_LOCALE = "xx-long";
```

#### `pseudoLocalize` (function)

The xx-long form of one message string. Placeholders and escaped braces stay as written. The extra length is
spread over the words in proportion to their length, each word's share right after it, so a long message keeps
the places a line can break, as a longer language's would; a message with no words has it at the end.

```ts
function pseudoLocalize(message: string): string;
```

#### `pseudoMessages` (function)

The xx-long form of a whole message file (the inlang message format): nested namespaces are walked, plural
variants keep their `declarations` and `selectors` (they are code, not text) and only their `match` texts
change. `$schema` is copied as is.

```ts
function pseudoMessages(file: {
  readonly [key: string]: MessageValue;
}): Record<string, MessageValue>;
```

#### `snakeKey` (function)

`snow-shrine` → `snow_shrine`, `fastFall` → `fast_fall`, `melee/sword` → `melee_sword`.

```ts
function snakeKey(value: string): string;
```

### `import { … } from '@mcthaydt/automata-content/vite'`

#### `automataContent` (function)

The Vite plugin that compiles content and serves it as `virtual:automata/content`. It builds when Vite
starts and on every save in dev, with the same build as `automata-content build`. A `vite build` with
content errors fails; a dev server keeps serving the last good content and reports the diagnostics through
Vite's logger and the `automata:content-error` event (`automata:content` after a good save). It also sets
`build.assetsInlineLimit: 0` when the game's config leaves it unset, so no asset becomes a `data:` URL that Ruken's
CSP refuses to fetch.

```ts
function automataContent(pluginOptions?: AutomataContentOptions): Plugin;
```

#### `AutomataContentOptions` (type)

The plugin's options: `ContentOptions`, with `root` defaulting to Vite's root.

```ts
type AutomataContentOptions = Omit<ContentOptions, "root"> & {
  readonly root?: string | undefined;
};
```

#### `VIRTUAL_MODULE_ID` (const)

The import path of the compiled content: `content`, `contentHash`, `simContent` and `simContentHash`.

```ts
const VIRTUAL_MODULE_ID = "virtual:automata/content";
```

## `@mcthaydt/automata-game`

### `import { … } from '@mcthaydt/automata-game'`

#### `AnalogOptions` (interface)

The `analog` option of `keys()`.

```ts
interface AnalogOptions<Z extends z.ZodType> {
    /**
     * Per tick: what the sticks and the drag add to the held keys' payload, merged over it and parsed by the
     * command's schema. The held payload is passed in so a game can sum a key term and a stick term. When the schema
     * refuses the merge (a `NaN`, a float in an integer field), the held payload is sent alone.
     */
    read(reading: AnalogReading, held: z.output<Z>): Partial<z.input<Z>>;
    /** Bind the `camera-drag` gesture: the play screen mounts the drag surface (M4 spec §16.3.1). */
    readonly drag?: boolean;
    /** Show the touch stick; its vector is `stick('left')`. */
    readonly touchStick?: boolean;
}
```

#### `AnalogReading` (interface)

The analog input at one fixed step, read once after `Input.poll()`.

```ts
interface AnalogReading {
    /** The active pad's stick, or the touch stick, as integers −127..127 (M4-D2). */
    stick(side: 'left' | 'right'): {
        readonly x: number;
        readonly y: number;
    };
    /** CSS px dragged to the right since the previous tick; 0 unless the map binds the camera drag. */
    cameraDrag(): number;
    /** The player's camera settings. */
    readonly camera: CameraSettings;
}
```

#### `AutosavePolicy` (interface)

When the loaded slot writes itself: on each listed trigger, with `intervalSeconds` for the `interval`
timer.

```ts
interface AutosavePolicy {
  readonly on: readonly AutosaveTrigger[]
  /** Seconds between timer writes, default 60. Read only when `interval` is in `on`. */
  readonly intervalSeconds?: number
}
```

#### `AutosaveTrigger` (type)

What can make the loaded slot write itself (M5 spec §4.4).

```ts
type AutosaveTrigger = 'screen-exit' | 'round-end' | 'background' | 'interval'
```

#### `Camera2d` (interface)

A presentation-only 2D camera over one container: it follows a target, shakes, and writes only that
container's transform, never a sim value.

```ts
interface Camera2d {
  /** The world point to follow. The first call snaps to it. */
  target(x: number, y: number): void
  /** Adds trauma, 0..1 (capped at 1); it decays over time. */
  shake(trauma: number): void
  /** Advances one display frame and writes the transform to the container. */
  update(frameSeconds: number): void
  readonly transform: { readonly x: number; readonly y: number; readonly scale: number }
}
```

#### `Camera2dOptions` (interface)

How `createCamera2d` frames the world: the view's size, and optionally a follow, bounds and zoom.

```ts
interface Camera2dOptions {
  /** The playfield's logical size: the area the camera shows at zoom 1. */
  readonly view: { readonly width: number; readonly height: number }
  /** Approach the target at `rate` per second; a dead zone, centred on the view, the target may move in freely. */
  readonly follow?: {
    readonly rate: number
    readonly deadZone?: { readonly width: number; readonly height: number }
  }
  /** The world rect the view never shows outside of. */
  readonly bounds?: CameraRect
  /** Default 1; above 1 shows less of the world. */
  readonly zoom?: number
  /** Default: the player's `prefers-reduced-motion`, read every frame. */
  readonly reducedMotion?: () => boolean
}
```

#### `CameraRect` (interface)

A world-space rectangle, in logical px: `Camera2dOptions.bounds`.

```ts
interface CameraRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}
```

#### `ChangedElsewhereCopy` (interface)

The words of the choice paused offers once another device has changed the slot being played (M5-D6).

```ts
interface ChangedElsewhereCopy {
    readonly message: string;
    readonly loadNewer: string;
    readonly keepPlaying: string;
    /** Load newer was chosen and the other device's progress could not be used; this game goes on as it was. */
    readonly failed: string;
}
```

#### `createCamera2d` (function)

A camera writing `stage`'s transform (usually `PixiStage.world`). `seed` fixes the shake's random sequence,
so a shake looks the same in every run and visual test.

```ts
function createCamera2d(stage: Container, options: Camera2dOptions, seed = 1): Camera2d {
  const zoom = options.zoom ?? 1
  // The world-space size the view shows.
  const visibleWidth = options.view.width / zoom
  const visibleHeight = options.view.height / zoom

  let targetX = 0
  let targetY = 0
  let centreX = 0
  let centreY = 0
  let hasTarget = false
  let trauma = 0
  const noise = mulberry32(seed)
  const isReduced = options.reducedMotion ?? (() => reducedMotion())
  const transform = { x: 0, y: 0, scale: zoom }

  const clamp = (x: number, y: number): { x: number; y: number } => {
    const bounds = options.bounds
    if (bounds === undefined) return { x, y }
    return {
      x: clampAxis(x, visibleWidth, bounds.x, bounds.width),
      y: clampAxis(y, visibleHeight, bounds.y, bounds.height),
    }
  }

  return {
    target(x, y) {
      targetX = x
      targetY = y
      if (!hasTarget) {
        hasTarget = true
        centreX = x
        centreY = y
      }
    },
    shake(amount) {
      trauma = Math.min(1, trauma + amount)
    },
    update(frameSeconds) {
      const follow = options.follow
      if (follow === undefined) {
        centreX = targetX
        centreY = targetY
      } else {
        const zone = follow.deadZone
        const wantX = zone === undefined ? targetX : intoZone(centreX, targetX, zone.width / 2)
        const wantY = zone === undefined ? targetY : intoZone(centreY, targetY, zone.height / 2)
        centreX = damp(centreX, wantX, follow.rate, frameSeconds)
        centreY = damp(centreY, wantY, follow.rate, frameSeconds)
      }
      // The camera's own centre stays clamped too, so leaving a corner starts from inside the bounds.
      const clamped = clamp(centreX, centreY)
      centreX = clamped.x
      centreY = clamped.y

      // The shake is added to what is drawn, never to the stored centre, so the follow does not drift with it.
      // Noise is drawn every frame, even under reduced motion, so the sequence does not depend on the setting.
      trauma = Math.max(0, trauma - SHAKE_DECAY * frameSeconds)
      const strength = isReduced() ? 0 : SHAKE_MAX_OFFSET * trauma * trauma
      const noiseX = noise() * 2 - 1
      const noiseY = noise() * 2 - 1
      const shown = clamp(centreX + strength * noiseX, centreY + strength * noiseY)

      transform.x = options.view.width / 2 - shown.x * zoom
      transform.y = options.view.height / 2 - shown.y * zoom
      stage.position.set(transform.x, transform.y)
      stage.scale.set(zoom)
    },
    transform,
  }
}
```

#### `defaultContent` (function)

The default flow `title → play ⇄ paused → title`, with `paused ⇄ settings` (M4.4), and its hash.

```ts
function defaultContent(): GameContent;
```

#### `defaultScreens` (function)

The title, play, paused and settings screens (DX spec §7, M4.4) over the default content's flow
(`title → play ⇄ paused → title`, `paused ⇄ settings`).

The screens share one sim: play creates it on first entry (seed, plugins, content, then `setup`),
paused keeps it, and the title drops it, so Quit to title and Play start again at tick 0. A runtime that shuts
down with the sim alive drops it too, whichever screen is current (DX.2c). Returning
from paused re-sends the whole state to the renderer (G-5): `AppLoop.run` resets the renderer, so
play restores the sim's own snapshot, which makes the next step a resync.

```ts
function defaultScreens(game: ScreensGame): ScreenDef[];
```

#### `DefinedGame` (interface)

The runtime's `GameDefinition`, plus what the screens and the golden replay read from the spec.

```ts
interface DefinedGame<S = never> extends GameDefinition<S> {
    readonly id: string;
    readonly title: string;
    readonly size: {
        readonly width: number;
        readonly height: number;
    };
    readonly input?: InputMap | undefined;
    readonly sim: {
        readonly plugins: readonly PluginDef[];
        readonly seed: number;
        readonly setup?: ((sim: Sim) => void) | undefined;
        readonly content?: unknown;
    };
}
```

#### `defineGame` (function)

Checks a spec and fills in every default over the runtime, the Pixi renderer, Ruken hosting and the default
screens; `startGame` boots the result. Pure: it reads no document, so a game module also loads in Node.
Throws `BootDefect` (its cause a `GameSpecError`) for an invalid spec.

```ts
function defineGame<S = never, D = unknown>(spec: GameSpec<S, D>): DefinedGame<S>;
```

#### `defineSave` (function)

Declares a save. It checks nothing the SDK checks; it only gives the definition its type.

```ts
function defineSave<S>(def: SaveDef<S>): SaveDef<S> {
  return def
}
```

#### `DrawContext` (interface)

What `draw` receives each frame. Coordinates are logical playfield pixels (plan D-2).

```ts
interface DrawContext {
    /** The sim at this frame, read-only. */
    readonly sim: DrawSim;
    readonly frame: FrameInfo;
    /** The playfield's logical size. */
    readonly width: number;
    readonly height: number;
    rect(x: number, y: number, w: number, h: number, color: number): void;
    circle(x: number, y: number, radius: number, color: number): void;
    line(x1: number, y1: number, x2: number, y2: number, color: number, width?: number): void;
    /** One line of text, its top-left at (x, y). */
    text(value: string, x: number, y: number, options?: DrawTextOptions): void;
}
```

#### `DrawEntity` (interface)

One entity, read-only: its components' values are frozen copies.

```ts
interface DrawEntity {
    readonly sid: number;
    has(component: ComponentDef): boolean;
    get<S extends FieldSchema>(component: ComponentDef<S>): Readonly<FieldValues<S>>;
}
```

#### `DrawSim` (interface)

The sim at this frame, read-only.

```ts
interface DrawSim {
    readonly tick: number;
    query(...components: ComponentDef[]): DrawEntity[];
    entity(sid: number): DrawEntity | undefined;
    /** A deep-frozen copy of the resource's value. */
    resource<Z extends z.ZodType>(def: ResourceDef<Z>): z.output<Z>;
}
```

#### `DrawTextOptions` (interface)

Options for `DrawContext.text`: colour and font size.

```ts
interface DrawTextOptions {
    /** Default 0xffffff. */
    readonly color?: number | undefined;
    /** Font size in logical pixels. Default 8. */
    readonly size?: number | undefined;
}
```

#### `GameCopy` (type)

A game's words: the runtime's boot and failure copy, and the default screens' words (DX.2d).

```ts
type GameCopy = NonNullable<GameDefinition['copy']> & {
    /** The default screens' words, over their English defaults: a part of `ScreensCopy`, or a function of the locale. */
    readonly screens?: ScreensCopyInput | undefined;
};
```

#### `GameSaves` (interface)

What a game saves, and how the default screens read it from the sim and put it back (M5.2). The title lists the
save's slots; New game writes the starting data, Continue loads a slot, and play keeps it saved while it runs, on
the triggers the `def` declares (autosave).

```ts
interface GameSaves<D> {
    readonly def: SaveDef<D>;
    /**
     * The data to keep, read from the live sim when a trigger writes, and for a new game from the sim at tick 0. It
     * only reads: it must not change the sim.
     */
    capture(sim: Sim): D;
    /** Puts a loaded slot's data into the freshly set-up sim, before tick 0. */
    apply(sim: Sim, data: D): void;
    /** The label a new game gives its slot on the list ("Run 2"). Default: none, and the list says "Slot N". */
    label?(slot: number): string;
}
```

#### `GameSpec` (interface)

A game in one object (DX spec §3.1): its id, size and sim, and optionally its title, input, views, sounds,
scores, saves, content, screens, settings, extensions, draw layer and host and renderer options.
`defineGame` fills in every default.

```ts
interface GameSpec<S = never, D = unknown> {
    /** Ruken's game id (`[game].id`), checked with Ruken's own rule; it is `hosting.gameId`. */
    readonly id: string;
    /** Shown on the title screen. Default: the id. */
    readonly title?: string;
    /** The playfield in logical pixels. */
    readonly size: {
        readonly width: number;
        readonly height: number;
    };
    readonly sim: {
        readonly plugins: readonly PluginDef[];
        /** Default 1. */
        readonly seed?: number;
        /** Spawns the starting entities before tick 0. */
        readonly setup?: (sim: Sim) => void;
    };
    /**
     * The orientation the game plays in, the same as the ship config's `runtime.orientation` (M4.7). On a phone held
     * the other way a `portrait` or `landscape` game pauses behind the rotate hint. Default `any`.
     */
    readonly orientation?: GameOrientation;
    /** On a phone held the other way: `'block'` (the default) covers and pauses; `'toast'` says so and plays on. */
    readonly rotateHint?: RotateHintMode;
    /** Default: no commands. */
    readonly input?: InputMap;
    /** Component id → view (`rect`, `sprite`). */
    readonly views?: Readonly<Record<string, EntityViewFactory>>;
    /**
     * The sound each sim event plays, by the event's id: `{ [Chime.id]: 'chime.wav' }`, or `{ alias, bus, gain }`.
     * Silent until the player's first gesture (browsers allow no sound before it).
     */
    readonly sounds?: EventSounds;
    /**
     * The board and score each sim event submits, by the event's id (M5.7):
     * `{ [RunEnded.id]: { board: 'best', score: (payload) => RunEnded.schema.parse(payload).score } }`. The board is a key
     * of the ship config's `leaderboards`; the game then asks the host for `leaderboards`.
     */
    readonly scores?: EventScores;
    /**
     * The game's save (M5.2): its slots, how the sim is captured into them and put back. The game then asks the host
     * for `saves`. Needs the default screens for the title's slot list; custom `screens` open the save themselves.
     */
    readonly saves?: GameSaves<D>;
    /** A game with `content/` passes the compiler's output; `sim` is the sim's partition of it. */
    readonly content?: {
        readonly data: CompiledContentData;
        readonly hash: string;
        readonly sim?: unknown;
    };
    /** Default: title, play and paused (DX spec §7). */
    readonly screens?: readonly ScreenDef[];
    /** Default: `#game`. */
    readonly root?: HTMLElement;
    readonly hosting?: Partial<Omit<HostingOptions, 'gameId' | 'disclosedEvents'>>;
    /**
     * Default: the core settings (`CORE_SETTINGS`, the save `settings`), with the player's bindings and graphics
     * quality. A game's own settings keep those only when its schema has `input: inputSettingsSchema` and
     * `display: displaySettingsSchema`.
     */
    readonly settings?: SettingsDef<S>;
    readonly extensions?: readonly ExtensionDef[];
    /**
     * Immediate-mode HUD, debug and prototype drawing over the entity views, once per display frame while the
     * default screens hold a sim (PRODUCT spec §7). It reads the sim and never writes it. Needs the default screens.
     */
    readonly draw?: (ctx: DrawContext) => void;
    /** Merged over the defaults (`pixelArt`, the logical size and the views). */
    readonly renderer?: PixiRendererOptions;
    /**
     * Makes the renderer from the Pixi options `defineGame` built (the size, pixel art, the views, `renderer` and
     * the draw layer's and Settings' `setup`): an extension's renderer, such as render-pixi3d's
     * `(options) => createPixi3dRenderer({ ...options, views })`. Default: core's `createPixiRenderer`.
     */
    readonly createRenderer?: (options: PixiRendererOptions) => RendererFactory;
    /**
     * Files the runtime fetches with the preload screens, with byte progress and the 30 s stall rule (M1.5), before
     * the renderer starts: model files a 3D view draws, for example. They stay out of the content and its hash, so a
     * new origin or a rebuilt file never changes the hash a save is stamped with.
     */
    readonly preload?: readonly string[];
    /**
     * The game's words: the runtime's boot and failure copy, and `screens`, the default screens' words over their
     * English defaults (DX.2d). `screens` may be a function of the locale, run again on each language change, so a
     * Paraglide game passes its messages: `screens: () => ({ title: { play: m.play() } })`.
     */
    readonly copy?: GameCopy;
    /** The game's languages (PRODUCT.L): Settings' Language group offers them. Absent, the content's one language. */
    readonly locale?: GameDefinition['locale'];
    /** Tests only. */
    readonly seams?: RuntimeSeams;
}
```

#### `GameSpecError` (class)

Every invalid field of a spec, by path: `size.width: …`.

```ts
class GameSpecError extends Error {
    readonly problems: readonly string[];
    constructor(problems: readonly string[]);
}
```

#### `InputMap` (interface)

Held keys, touch buttons and gamepad buttons, turned into one command per tick (DX spec §3.3).

```ts
interface InputMap {
    readonly command: CommandDef;
    /** Whether the play screen shows touch buttons when the player uses touch. */
    readonly touch: boolean;
    readonly touchButtons: readonly TouchButton[];
    /** How the play screen takes touch: its buttons, or swipes over the whole screen (M4 spec §4.4). */
    readonly touchMode: TouchMode;
    /**
     * The bindings as data (M4 spec §2.2): one action per distinct payload, id `<command id>-<n>`, with its keys, its
     * pad buttons and whether it has a touch button. Rebinding swaps the profile and never the command mapping.
     */
    readonly profile: InputProfile;
    /** Each action's name, as the Settings screen's Controls section lists it (M4.4). */
    readonly labels: Readonly<Record<string, string>>;
    /** Whether the play screen shows the touch stick (the `analog.touchStick` option). */
    readonly touchStick: boolean;
    /**
     * Pure: the one command for the held actions, merged in iteration order (a later action wins per field). With an
     * `analog` option, `reading` adds the sticks and the drag (M4 spec §17); without one it is ignored.
     */
    toCommand(held: Iterable<string>, tick: number, reading?: AnalogReading): readonly Command[];
    attach(target: Window): InputSource;
}
```

#### `inputs` (function)

One input map from `maps`, each sending its own command every tick in map order. The commands share source 0, so
each gets its own `seq`: `tick × maps.length + index` (a u32, which at 60 Hz lasts 2³²/60/86,400/n ≈ 828/n days of
play). `command` is the first map's. Throws on no maps, on two maps for one command, and on an action id, a key or
a pad button two maps share.

```ts
function inputs(...maps: readonly InputMap[]): InputMap;
```

#### `InputSource` (interface)

The input map attached to a window for one play session.

```ts
interface InputSource {
    /** This tick's command, if any: one per tick, never an edge (DX spec §3.3). */
    commands(tick: number): readonly Command[];
    /** A touch button pressed or released (its `TouchButton.id`). */
    hold(buttonId: string): void;
    release(buttonId: string): void;
    /** Gestures from a `SwipeTracker` (M4.3): held swipes and one-tick flicks and taps. */
    readonly gesture: GestureSink;
    dispose(): void;
}
```

#### `KeyBindings` (type)

By `KeyboardEvent.code`, so the keys sit in the same place on every keyboard layout.

```ts
type KeyBindings<Z extends z.ZodType> = Readonly<Record<string, Payload<Z>>>;
```

#### `keys` (function)

An input map sending `command` once per tick with the payload of what is held: keys by
`KeyboardEvent.code`, on-screen touch buttons, gamepad buttons, the stick and gestures, merged over the
idle payload. Throws when a binding's payload fails the command's schema, and when a key in `options.required` has
no binding.

```ts
function keys<Z extends z.ZodType>(command: CommandDef<Z>, bindings: KeyBindings<Z>, options?: KeysOptions<Z>): InputMap;
```

#### `KeysOptions` (interface)

Options for `keys`: touch buttons, gamepad buttons, gestures and the stick, the idle payload, required keys
and the Controls section's labels.

```ts
interface KeysOptions<Z extends z.ZodType> {
    /** On-screen buttons from the bindings when the player uses touch. Default true. */
    readonly touch?: boolean;
    /** Standard-mapping gamepad button index → payload, polled once per tick. */
    readonly pad?: Readonly<Record<number, Payload<Z>>>;
    /** Touch gesture → payload (M4.3): a swipe holds while the finger steers, a flick or a tap lasts one tick. */
    readonly gestures?: Readonly<Partial<Record<GestureName, Payload<Z>>>>;
    /** Default `buttons` when the map has touch buttons, else `swipe`. The player's setting is M4.4's. */
    readonly touchMode?: TouchMode;
    /** A stick pushed past the deadzone in a direction (`left-left`, `right-up`, …) → payload (M4.2). */
    readonly stick?: Readonly<Partial<Record<StickDirection, Payload<Z>>>>;
    /** The payload with nothing held. Default: the schema's own defaults (`schema.parse({})`), when it has them. */
    readonly idle?: z.input<Z>;
    /**
     * Keys whose actions the game cannot be played without (M4.7): rebinding never leaves them unbound on a device
     * (M4-D4), and where the touch buttons do not all fit, theirs are the ones that show.
     */
    readonly required?: readonly string[];
    /**
     * Action names for the Controls section, by any of the action's default keys: `{ Space: 'Jump' }`. Default: the
     * command and payload (`move x -1`).
     */
    readonly labels?: Readonly<Record<string, string>>;
    /** The sticks and the camera drag, added to the held keys' payload each tick (M4 spec §17). */
    readonly analog?: AnalogOptions<Z>;
}
```

#### `postFilter` (function)

Declares a screen-space filter over the whole picture: `renderer: { postFilters: [postFilter('vignette', {
glsl, wgsl })] }`. The renderer builds it when it starts and keeps it in the stage's post-filter slot under
`name`. A filter that cannot be built, or whose GLSL does not link, is left out with a warning and the frame
draws without it. Throws when the name or either shader is empty.

```ts
function postFilter(name: string, spec: PostFilterSpec): PostFilterDef {
  if (name.trim() === '') throw new Error('postFilter: name is empty')
  for (const field of ['glsl', 'wgsl'] as const)
    if (spec[field].trim() === '') throw new Error(`postFilter "${name}": ${field} is empty`)
  return Object.freeze({
    name,
    glsl: spec.glsl,
    wgsl: spec.wgsl,
    order: spec.order ?? 0,
    minTier: spec.minTier,
  })
}
```

#### `PostFilterDef` (interface)

A declared filter, as `postFilter` returns it and `PixiRendererOptions.postFilters` takes it.

```ts
interface PostFilterDef {
  readonly name: string
  readonly glsl: string
  readonly wgsl: string
  readonly order: number
  readonly minTier: QualityTier | undefined
}
```

#### `PostFilterSpec` (interface)

What a screen-space filter is made of: the same effect written twice, for WebGL2 (`glsl`) and WebGPU (`wgsl`),
so the two renderers stay at parity. Both are fragment shaders that `filterPrograms` joins to the shared vertex
stage: GLSL reads `vTextureCoord`, `vPixelCoord` and `uTexture`; WGSL has `mainFragment(input: VSOutput)`.

```ts
interface PostFilterSpec {
  /** The GLSL ES 3.00 fragment shader, run under WebGL2. */
  readonly glsl: string
  /** The WGSL fragment shader, run under WebGPU; its entry point is `mainFragment`. */
  readonly wgsl: string
  /** Where it sits among the stage's filters: lower runs first, ties by name. Default 0. */
  readonly order?: number | undefined
  /** The lowest quality tier it runs at; left out, it runs at every tier. */
  readonly minTier?: QualityTier | undefined
}
```

#### `rect` (function)

A filled rectangle that follows its component's `x`, `y` and `angle`, interpolated between ticks:
`entityViews: { [Body.id]: rect({ w: 8, h: 8, color: 0xf9c22b }) }`.

```ts
function rect(options: RectViewOptions): EntityViewFactory {
  const anchor = anchorXY(options.anchor)
  return (_row, componentId) => {
    const graphics = new Graphics()
      .rect(-anchor.x * options.w, -anchor.y * options.h, options.w, options.h)
      .fill(options.color)
    return {
      container: graphics,
      update(curr, prev, alpha = 1) {
        placeView(graphics, curr, prev, alpha, componentId)
      },
      destroy() {
        graphics.destroy()
      },
    }
  }
}
```

#### `RectViewOptions` (interface)

A `rect` view's size, colour and anchor.

```ts
interface RectViewOptions {
  /** Width in world pixels. */
  readonly w: number
  /** Height in world pixels. */
  readonly h: number
  /** Fill colour, e.g. 0xf9c22b. */
  readonly color: number
  /** Default 0.5 (centred on the entity's position). */
  readonly anchor?: ViewAnchor | undefined
}
```

#### `SaveDef` (interface)

A game's save: one record, or a fixed number of slots, each one Ruken key.

```ts
interface SaveDef<S> {
  /** The key prefix. Ruken's key rule is the SDK's, which checks it on write. */
  readonly key: string
  /** This build's version of the data, an integer from 1. */
  readonly version: number
  readonly schema: z.ZodType<S>
  /** What an empty slot loads as. */
  readonly empty: () => S
  /** `migrations[n]` turns version `n` data into version `n + 1`. */
  readonly migrations: Readonly<Record<number, SaveMigration>>
  /** Absent: one record, slot 0, stored at `key`. */
  readonly slots?: { readonly count: number }
  /** Absent: save on `screen-exit`, `round-end` and `background`, with no timer (M5-D10). `{ on: [] }` turns it off. */
  readonly autosave?: AutosavePolicy
}
```

#### `ScreensCopy` (interface)

Every word the default title, play, paused and settings screens show (DX spec §7, M4 spec §4.8, M5 spec §4.8).

```ts
interface ScreensCopy {
    readonly title: {
        readonly play: string;
    };
    /** The play screen's corner button and the touch stick, read by assistive technology. */
    readonly play: {
        readonly pause: string;
        readonly move: string;
    };
    readonly paused: {
        readonly title: string;
        readonly resume: string;
        /** The dialog's close button away from the menu (the quit confirm, the changed-elsewhere step). */
        readonly back: string;
        readonly mute: string;
        readonly unmute: string;
        readonly settings: string;
        readonly quit: string;
        readonly quitPrompt: string;
        readonly quitConfirm: string;
        readonly cancel: string;
        /** Why play paused when a controller in use was unplugged (M4-D9). */
        readonly reconnect: string;
    };
    readonly settings: {
        readonly screen: SettingsScreenCopy;
        readonly prompts: PromptCopy;
        readonly controls: ControlsCopy;
        readonly language: LanguageCopy;
        readonly vibration: VibrationCopy;
        readonly audio: AudioCopy;
        readonly touch: TouchCopy;
        readonly display: DisplayCopy;
    };
    readonly saves: {
        readonly slots: SaveSlotsCopy;
        readonly status: SaveStatusCopy;
        readonly changedElsewhere: ChangedElsewhereCopy;
        readonly changedElsewhereToast: string;
    };
    /** The scored board on the paused screen (M5.7). */
    readonly board: LeaderboardCopy;
    /** Told once when a controller the input does not support is plugged in (M4 spec §6). */
    readonly padUnsupported: string;
}
```

#### `ScreensCopyInput` (type)

A game's words for the default screens: a part of the record, or a function of the player's locale returning one.
The function runs again on each language change, so a Paraglide game can pass its messages:
`screens: () => ({ title: { play: m.play() } })`.

```ts
type ScreensCopyInput = ScreensCopyOverrides | ((locale: string) => ScreensCopyOverrides);
```

#### `ScreensCopyOverrides` (type)

A part of `ScreensCopy` with every group optional, down to the words; a word or a function is replaced whole.

```ts
type ScreensCopyOverrides<T = ScreensCopy> = {
    readonly [K in keyof T]?: T[K] extends Leaf ? T[K] : ScreensCopyOverrides<T[K]>;
};
```

#### `ScreensGame` (interface)

What the default screens need from the game.

```ts
interface ScreensGame {
    readonly title: string;
    readonly sim: {
        readonly plugins: readonly PluginDef[];
        readonly seed: number;
        readonly setup?: ((sim: Sim) => void) | undefined;
        readonly content?: unknown;
    };
    readonly input?: InputMap | undefined;
    /** Told the sim play runs, and `undefined` when the title drops it: the draw layer reads it (PRODUCT.2). */
    readonly watchSim?: ((sim: Sim | undefined) => void) | undefined;
    /** The board paused shows: the game's first scored board (M5.7). None: paused shows no board. */
    readonly board?: string | undefined;
    /** Applies the player's graphics quality to the stage (M4.4): the saved one at the title, then each choice. */
    readonly setQuality?: ((tier: QualityTier) => void) | undefined;
    /** The game's save (M5.2): the title lists its slots and play keeps the loaded one saved. None: no slot list. */
    readonly saves?: GameSaves<unknown> | undefined;
    /** The game's extensions: play draws their `hud.overlay` components (M4.7), Settings shows their `settings.sections` (M4.4). */
    readonly extensions?: readonly ExtensionDef[] | undefined;
    /** The game's words for these screens (`GameSpec.copy.screens`, DX.2d), over the English defaults. */
    readonly copy?: ScreensCopyInput | undefined;
}
```

#### `SettingsScreenCopy` (interface)

The Settings screen's own words: its title, Back, the tabs and the overflow count.

```ts
interface SettingsScreenCopy {
    readonly title: string;
    readonly back: string;
    readonly tabs: string;
    readonly settingsTab: string;
    readonly controlsTab: string;
    readonly more: (count: number) => string;
}
```

#### `sprite` (function)

A sprite that follows its component's `x`, `y` and `angle`, interpolated between ticks. `source` is a
texture or a url: a url the runtime already loaded (it is in `Assets.cache`) shows at once; otherwise the
sprite is empty until `Assets.load` resolves. A url that fails to load is reported with `reportError`
and the sprite stays empty. The frame textures are sliced once per factory and shared by its sprites.
With `frame`, the url is an atlas page's Spritesheet and the sprite shows that frame; a name the atlas lacks
is reported the same way.

```ts
function sprite(source: Texture | string, options: SpriteViewOptions = {}): EntityViewFactory {
  if (options.frame !== undefined && options.frames !== undefined) {
    throw new Error(
      'sprite: `frame` (an atlas frame) and `frames` (a sheet of equal frames) cannot be combined',
    )
  }
  const anchor = anchorXY(options.anchor)
  let frames: readonly Texture[] | undefined
  let loading: Promise<readonly Texture[]> | undefined

  if (typeof source !== 'string') {
    frames = sliceFrames(source, options.frames)
  } else if (Assets.cache.has(source)) {
    try {
      frames = texturesOf(Assets.cache.get(source), options)
    } catch (error) {
      // Reported once; the sprites stay empty, as for a url that fails to load.
      globalThis.reportError?.(error)
      frames = [Texture.EMPTY]
    }
  }

  function load(url: string): Promise<readonly Texture[]> {
    if (loading === undefined) {
      loading = Assets.load<unknown>(url).then((loaded) => {
        frames = texturesOf(loaded, options)
        return frames
      })
      // One report per factory, however many sprites wait on the same url.
      loading.catch((error: unknown) => globalThis.reportError?.(error))
    }
    return loading
  }

  return (_row, componentId) => {
    const shown = new Sprite(frames?.[0] ?? Texture.EMPTY)
    shown.anchor.set(anchor.x, anchor.y)
    let frameField: unknown

    const showFrame = (): void => {
      if (frames === undefined || shown.destroyed) return
      shown.texture = frames[frameIndex(frameField, frames.length)] ?? Texture.EMPTY
    }

    if (frames === undefined && typeof source === 'string') {
      load(source).then(showFrame, () => {})
    }

    return {
      container: shown,
      update(curr, prev, alpha = 1) {
        placeView(shown, curr, prev, alpha, componentId)
        frameField = poseComponent(curr, componentId)?.frame
        showFrame()
      },
      destroy() {
        shown.destroy()
      },
    }
  }
}
```

#### `SpriteFrames` (interface)

The texture is a sheet of equal frames, read left to right, top to bottom. The pose component's numeric
`frame` field picks one (floored, wrapped by the frame count); with no `frame` field the first is shown.
Frames switch on ticks; they are not interpolated.

```ts
interface SpriteFrames {
  readonly width: number
  readonly height: number
  /** Default: every whole frame that fits in the texture. */
  readonly count?: number | undefined
}
```

#### `SpriteViewOptions` (interface)

A `sprite` view's anchor and either its sprite-sheet frames or one frame of a packed atlas.

```ts
interface SpriteViewOptions {
  /** Default 0.5 (centred on the entity's position). */
  readonly anchor?: ViewAnchor | undefined
  readonly frames?: SpriteFrames | undefined
  /**
   * A frame of a packed atlas (M5.6): `source` is the url of an atlas page's Spritesheet JSON, which
   * `automata-content assets` writes, and `frame` names one of its frames. Not with `frames`.
   */
  readonly frame?: string | undefined
}
```

#### `startGame` (function)

Boots a game (DX spec §3.1): `defineGame`'s defaults over the runtime, the Pixi renderer, Ruken hosting
and the default screens, then the runtime's boot on the game's root. Takes a spec or a game `defineGame`
already returned. Throws `BootDefect` before anything mounts when the spec is invalid or there is no
root (`spec.root`, else `#game`); a failure after that shows on the runtime's boot failure panel.

```ts
function startGame<S = never>(game: GameSpec<S> | DefinedGame<S>): RuntimeHandle;
```

#### `TouchButton` (interface)

One on-screen touch button: every key bound to the same payload shares it.

```ts
interface TouchButton {
    readonly id: string;
    readonly label: string;
    readonly keys: readonly string[];
    /** Which lower corner's group it sits in (M4 spec §4.4). Default `start`; a game moves buttons to `end` itself. */
    readonly side?: 'start' | 'end' | undefined;
    /** The game cannot be played without it: where the touch buttons do not all fit, only these show (M4.7). */
    readonly required?: boolean | undefined;
}
```

### `import { … } from '@mcthaydt/automata-game/tooling'`

#### `isDefinedGame` (function)

Whether `value` came from `defineGame`.

```ts
function isDefinedGame<S>(value: GameSpec<S> | DefinedGame<S>): value is DefinedGame<S>;
```

## `@mcthaydt/automata-host`

### `import { … } from '@mcthaydt/automata-host'`

#### `AnalyticsProps` (type)

The properties of one analytics event: flat names to strings, numbers or booleans, as the Ruken SDK accepts
them.

```ts
type AnalyticsProps = Record<string, string | number | boolean>;
```

#### `ErrorCode` (type)

Ruken's error codes (`@ruken/protocol` `ERROR_CODES`), as the SDK's `RukenError` carries them.

```ts
type ErrorCode = RukenError["code"];
```

#### `findRukenSdkMarkers` (function)

The markers found in `code` (built JavaScript), each named once; empty means no Ruken SDK code.

```ts
function findRukenSdkMarkers(code: string): string[];
```

#### `HOST_EXIT_CAP` (const)

How long the game may hold the host's close (FloorFifty `ruken/exit.ts`,
Ruken P6 §4 "1 s cap"). Ruken's own grace is 1.5 s
(`sdk-host/src/bridge/defaults.ts` `EXIT_GRACE_MS`), so the game always
answers before the host gives up on it.

```ts
const HOST_EXIT_CAP: Duration.Duration;
```

#### `HostError` (class)

Any failure after the handshake. A request that fails never falls back to another path.

```ts
class HostError extends HostErrorBase {}
```

#### `HostHandshakeFailed` (class)

The page is inside a frame, but the SDK got no usable welcome and fell back
to its standalone session. Not fatal: reported on `Hosting.handshake.fellBack`
and logged once (shared contracts §1.2).

```ts
class HostHandshakeFailed extends HostHandshakeFailedBase {}
```

#### `Hosting` (interface)

Everything a game may ask of, or hear from, its host: the `Hosting` contract
of the M1 shared contracts spec §1, implemented by the host lane.
The `Hosting` service tag.

```ts
interface Hosting {
  /**
   * Which session this is: 'ruken' when Ruken hosts it; 'standalone' when the Ruken adapter got the SDK's
   * standalone session; 'web' for the web adapter of an `itch` or `web` build (PUB spec §3).
   */
  readonly kind: "ruken" | "standalone" | "web";
  /** The host's name for UI, such as "Back to …": 'Ruken', 'itch.io' or 'this page' (PUB spec §3). */
  readonly hostName: string;
  /** Some when the page is inside a frame but the SDK fell back to standalone (shared contracts §1.2). */
  readonly handshake: {
    readonly fellBack: Option.Option<HostHandshakeFailed>;
  };
  readonly player: {
    readonly id: string;
    readonly displayName: string;
  };
  readonly locale: string;
  readonly granted: ReadonlySet<Capability>;
  /** Resolves on `session.ready` (at once standalone). No gameplay renders before it (R-04). */
  readonly ready: Effect.Effect<void, HostError>;
  readonly lifecycle: Subscribable.Subscribable<LifecyclePayload>;
  readonly input: Subscribable.Subscribable<InputModePayload>;
  readonly display: Subscribable.Subscribable<DisplayMetricsPayload>;
  readonly audio: Subscribable.Subscribable<AudioChange>;
  readonly entitlements: Subscribable.Subscribable<EntitlementsPayload>;
  readonly savesStatus: Subscribable.Subscribable<SavesStatus>;
  readonly saves: HostingSaves;
  readonly leaderboards: HostingLeaderboards;
  /** Ruken's `FullscreenRes`: `support` says what the device allows (for example `ios-home-screen`). */
  setFullscreen(on: boolean): Effect.Effect<FullscreenRes, HostError>;
  readonly round: {
    /** A round began. A second start before an end is dropped. */
    readonly start: Effect.Effect<void>;
    /** The open round ended. With no round open it is dropped. */
    end(outcome?: RoundOutcome): Effect.Effect<void>;
    /**
     * One item per round that ended, with its outcome, from the moment the stream
     * is read (nothing is replayed). A dropped end gives none. Ends when Hosting
     * shuts down. The `round-end` autosave trigger reads this.
     */
    readonly ended: Stream.Stream<RoundOutcome | undefined>;
  };
  /** A disclosed analytics event. Never fails: undisclosed, unconsented or refused events are dropped. */
  track(event: string, props?: AnalyticsProps): Effect.Effect<void>;
  /** Hands the player back to the host. Standalone it does nothing. */
  exit(reason?: "player" | "completed"): Effect.Effect<void, HostError>;
  /**
   * Answers the host's "Open game menu" while the scope is open: the handler
   * returns true when the game opened its own menu. With no handler the host
   * keeps its own drawer.
   */
  onMenuRequest(handler: () => boolean): Effect.Effect<void, never, Scope.Scope>;
  /**
   * Runs `handler` when the host closes the game, while the scope is open. The
   * host waits for it, but AF cuts everything off at `HOST_EXIT_CAP` (1 s),
   * inside Ruken's 1.5 s grace. Handlers run one after another in registration
   * order and the host save flush runs after the last, so a write a handler
   * makes is flushed. All of them share the one cap: a handler that never
   * returns costs the handlers after it and the flush.
   */
  onExiting(handler: Effect.Effect<void>): Effect.Effect<void, never, Scope.Scope>;
}
const Hosting: Context.Tag<Hosting, Hosting>;
```

#### `HostingLeaderboards` (interface)

The host's leaderboards (Ruken's `LeaderboardsApi`, PRODUCT spec §2 F1). Needs the `leaderboards` grant.
Each call relays the SDK's answer or error as a `HostError`: without the grant and standalone it fails
`UNSUPPORTED`, offline it fails with the host's code. None keeps a local board instead.

```ts
interface HostingLeaderboards {
  /** Submits `score` to `board` (a Ruken slug); `meta` is passed to the host as is. */
  submit(board: string, score: number, meta?: Parameters<LeaderboardsApi["submit"]>[2]): Effect.Effect<LeaderboardSubmitRes, HostError>;
  /**
   * Reads `board` with the SDK's options (`scope` `top` or `around-me`, `limit`). Ruken's host now answers with the
   * player's own entry only, or none, whatever the options (the SDK marks `get` deprecated at RukenApp d0fa2fe, since
   * Ruken added achievements); the call and its answer's shape are unchanged.
   */
  get(board: string, query?: Parameters<LeaderboardsApi["get"]>[1]): Effect.Effect<LeaderboardGetRes, HostError>;
}
```

#### `HostingLive` (function)

The single `Hosting` layer for games (shared contracts §1.1).

```ts
function HostingLive(options: HostingOptions, seams?: HostingSeams): Layer.Layer<Hosting, HostError>;
```

#### `HostingOptions` (interface)

What the game asks of its host. In M1 the game passes these by hand; later they come from content.

```ts
interface HostingOptions {
  /** `[game].id` in ruken.toml; the host checks it. */
  readonly gameId: string;
  /** The capabilities the game asks the host for (`wants` in the hello). */
  readonly wants: readonly Capability[];
  /** Fixed for the game's whole life (Ruken's answer 7 in docs/spikes/s6-ruken-stub.md). */
  readonly pauseBehavior: PauseBehavior;
  /**
   * `[analytics].custom_events` in ruken.toml. When given, `track` drops every
   * other name before it reaches the SDK (FloorFifty `ruken/host.ts` `track`).
   */
  readonly disclosedEvents?: readonly string[];
  /** Test builds only: exact https origins also trusted to send the welcome. Passed to `Ruken.init` as is. */
  readonly testHostOrigins?: readonly string[];
}
```

#### `HostingSaves` (interface)

The player's saves (shared contracts §1.1). Each call relays the SDK's error as a `HostError`; none falls back.

```ts
interface HostingSaves {
  get(key: string): Effect.Effect<string | null, HostError>;
  set(key: string, value: string): Effect.Effect<void, HostError>;
  remove(key: string): Effect.Effect<void, HostError>;
  readonly flush: Effect.Effect<SavesFlushRes, HostError>;
  /** Every key the session holds, sorted by code unit (M5 spec §4.1). Fails `CANCELLED` once Hosting has shut down. */
  readonly keys: Effect.Effect<readonly string[], HostError>;
  /**
   * Another device's write, or the host's conflict choice, reached this session (`SavesApi.on('changed')`, M5 spec
   * §4.1). No current value: only changes. Ends when Hosting shuts down.
   */
  readonly changed: Stream.Stream<SavesChangedPayload>;
}
```

#### `HostingSeams` (interface)

Test seams. Games pass nothing; `HostingTest` passes the fake host's in-memory window pair.

```ts
interface HostingSeams {
  readonly env?: SdkEnv;
}
```

#### `makeHosting` (function)

Builds `Hosting` over `Ruken.init`. The SDK decides between a hosted session
and its standalone one (shared contracts §1.1), enforces grants and limits,
and owns the handshake's timing; AF relays what it reports.

When the scope closes, in this order: Hosting marks itself closed (later
calls fail with `HostError{code:'CANCELLED'}`), every observed stream ends,
and then the session is disposed.

```ts
function makeHosting(options: HostingOptions, seams?: HostingSeams): Effect.Effect<Hosting, HostError, Scope.Scope>;
```

#### `RUKEN_SDK_MARKERS` (const)

String literals only the Ruken SDK contains, which survive minification (PUB spec §3): the SDK's storage probe
key (`env-browser.ts`) and its standalone refusal message (`standalone.ts`), at RukenApp d0fa2fe (as at
b30d31b). An `itch` or `web` build must contain neither, because it bundles the web adapter instead of the SDK;
a `ruken` build contains both. The web adapter's own probe key (`WEB_STORAGE_PROBE_KEY`) is deliberately different.

Re-check these after re-vendoring the SDK: `target.build.test.ts` fails if a default build stops containing them.

```ts
const RUKEN_SDK_MARKERS: readonly string[];
```

#### `toHostError` (function)

Turns whatever the SDK threw or rejected with into a `HostError`.
- A `RukenError` keeps its code and retryable flag.
- A `QuotaExceededError` is what Ruken's save map throws for a save over a
  limit (`sdk/src/save-map.ts`); it becomes `QUOTA_EXCEEDED`, which Ruken
  marks not retryable.
- Anything else (a closed port, a bug) becomes `INTERNAL`, which Ruken marks retryable.

```ts
function toHostError(operation: string, cause: unknown): HostError;
```

### `import { … } from '@mcthaydt/automata-host/testing'`

#### `FakeHostClock` (interface)

The clock shape `@ruken/sdk-host`'s fake host takes; the game's `SdkEnv.timers` run on it too.

```ts
interface FakeHostClock {
  epochMs(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}
```

#### `FakeHostHandle` (interface)

The fake host behind `HostingTest`, for tests that drive the host side.

```ts
interface FakeHostHandle {
  readonly host: FakeHost;
  /** Every message of `type` the game sent the host, as payloads, in order. */
  sentByGame(type: string): unknown[];
}
const FakeHostHandle: Context.Tag<FakeHostHandle, FakeHostHandle>;
```

#### `HostingTest` (function)

`HostingLive` wired to `@ruken/sdk-host`'s fake host over in-memory ports,
with the real SDK in between (shared contracts §1.1). Provides `Hosting` and
`FakeHostHandle`; both are disposed when the scope closes.

```ts
function HostingTest(options?: HostingTestOptions): Layer.Layer<Hosting | FakeHostHandle, HostError>;
```

#### `HostingTestOptions` (interface)

What to change about `HostingTest`'s defaults: the game's hosting options, the fake host, the SDK
environment and the game's origin.

```ts
interface HostingTestOptions {
  /** Overrides for the game's options; the defaults ask for saves and pause in the menu. */
  readonly hosting?: Partial<HostingOptions>;
  /** Overrides for `createFakeHost` (clock, grants, seeded saves, consent, scripted UI and ads). */
  readonly host?: Partial<Omit<FakeHostOptions, "gameOrigin" | "gameId">>;
  /** Rewrites the game's `SdkEnv`, for example to forge where messages come from. */
  readonly env?: (env: SdkEnv) => SdkEnv;
  /** Where the game is served from; the SDK's allowlist depends on it. Defaults to `TEST_GAME_ORIGIN`. */
  readonly gameOrigin?: string;
}
```

#### `manualClock` (function)

SDK and fake-host timing (hello retries, the 10 s handshake give-up, request
timeouts) runs on this clock, so a test can step past them without waiting
(shared contracts §1.4). AF's own timing uses Effect's `TestClock` instead.
Timers fire in due order; a timer scheduled by another one fires in the same
`advance` if it falls due within it.

```ts
function manualClock(startMs?: number): ManualClock;
```

#### `ManualClock` (interface)

A clock that moves only when the test calls `advance`. It is both the fake
host's `BridgeClock` (`epochMs`) and the SDK's `SdkTimers` (`now`), so one
clock drives both sides (shared contracts §1.4).

```ts
interface ManualClock extends FakeHostClock {
  now(): number;
  advance(ms: number): void;
}
```

#### `realClock` (const)

Real time, for tests that only need the host to answer.

```ts
const realClock: FakeHostClock;
```

#### `runScoped` (function)

Runs a test program in a fresh scope, closing it (and every layer built inside) at the end.

```ts
function runScoped<A, E>(program: Effect.Effect<A, E, Scope.Scope>): Promise<A>;
```

#### `TEST_GAME_ORIGIN` (const)

The origin `HostingTest` serves the game from unless `gameOrigin` says otherwise.

```ts
const TEST_GAME_ORIGIN = "http://localhost:4400";
```

## `@mcthaydt/automata-node`

### `import { … } from '@mcthaydt/automata-node'`

#### `FileError` (class)

Reading, writing, listing or removing a file failed.

```ts
class FileError extends FileErrorBase {
  override get message(): string;
}
```

#### `Files` (interface)

The service's tag. A tag and an identity interface instead of `class Files extends Context.Tag(...)`, because
isolatedDeclarations cannot type a call in an `extends` clause (the pattern `host`'s `Hosting` uses).

```ts
interface Files {
  readonly _Files: unique symbol;
}
const Files: Context.Tag<Files, FilesService>;
```

#### `FilesLive` (const)

`Files` on `node:fs`: synchronous calls wrapped in `Effect.try`, so the first failure surfaces as a
`FileError`.

```ts
const FilesLive: Layer.Layer<Files>;
```

#### `FilesService` (interface)

The file operations build-time code needs, each as an Effect. A failed call fails with a `FileError` naming
the path, except `exists`, which cannot fail.

```ts
interface FilesService {
  readText(path: string): Effect.Effect<string, FileError>;
  /**
   * The file's bytes exactly as they are on disk, for binary inputs such as images: reading them as text
   * would replace every byte that is not valid UTF-8. The array owns its bytes (it is not a Node `Buffer`).
   */
  readBytes(path: string): Effect.Effect<Uint8Array, FileError>;
  /** Writes UTF-8 text, creating parent folders. */
  writeText(path: string, text: string): Effect.Effect<void, FileError>;
  exists(path: string): Effect.Effect<boolean>;
  /** Every file below `dir`, as `/`-separated paths relative to it, sorted. */
  listFiles(dir: string): Effect.Effect<readonly string[], FileError>;
  /** Removes a file or folder recursively; a missing path is not an error. */
  remove(path: string): Effect.Effect<void, FileError>;
}
```

#### `ProcessError` (class)

A program could not be started (not found, not executable). A non-zero exit is not this error.

```ts
class ProcessError extends ProcessErrorBase {
  override get message(): string;
}
```

#### `ProcessRunner` (interface)

The service's tag; see `Files` for why it is not a `Context.Tag` class.

```ts
interface ProcessRunner {
  readonly _ProcessRunner: unique symbol;
}
const ProcessRunner: Context.Tag<ProcessRunner, ProcessRunnerService>;
```

#### `ProcessRunnerLive` (const)

`ProcessRunner` on `node:child_process`: the real programs, with the parent's environment plus
`RunOptions.env`.

```ts
const ProcessRunnerLive: Layer.Layer<ProcessRunner>;
```

#### `ProcessRunnerService` (interface)

Runs a program with arguments and no shell. The effect fails with a `ProcessError` only when the program
cannot be started; interrupting it stops the program.

```ts
interface ProcessRunnerService {
  run(command: string, args: readonly string[], options?: RunOptions): Effect.Effect<RunResult, ProcessError>;
}
```

#### `RunOptions` (interface)

How a program is started: its working folder, extra environment, stdin, and whether its output is also
echoed.

```ts
interface RunOptions {
  readonly cwd?: string | undefined;
  /** Added to the parent's environment. */
  readonly env?: Readonly<Record<string, string>> | undefined;
  /** Written to the program's stdin, which is then closed. */
  readonly stdin?: Uint8Array | undefined;
  /** Also copy the program's output to this process's stdout and stderr as it arrives. */
  readonly echo?: boolean | undefined;
}
```

#### `RunResult` (interface)

What a finished program left: its exit code (128 when a signal killed it) and everything it wrote to stdout
and stderr, decoded as UTF-8. A non-zero exit code is a result, not a failure.

```ts
interface RunResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}
```

#### `TaggedErrorClass` (type)

The class `Data.TaggedError(tag)` returns, written out. isolatedDeclarations cannot infer the type of a call in
an `extends` clause, so each error extends a constant annotated with this type instead (the pattern of
`content`'s compile errors and `host`'s errors). `ship` uses it for its own errors.

```ts
type TaggedErrorClass<Tag extends string, Fields> = new (fields: Fields) => Cause.YieldableError & {
  readonly _tag: Tag;
} & Readonly<Fields>;
```

## `@mcthaydt/automata-render-pixi`

### `import { … } from '@mcthaydt/automata-render-pixi'`

#### `Camera2d` (interface)

A presentation-only 2D camera over one container: it follows a target, shakes, and writes only that
container's transform, never a sim value.

```ts
interface Camera2d {
  /** The world point to follow. The first call snaps to it. */
  target(x: number, y: number): void;
  /** Adds trauma, 0..1 (capped at 1); it decays over time. */
  shake(trauma: number): void;
  /** Advances one display frame and writes the transform to the container. */
  update(frameSeconds: number): void;
  readonly transform: {
    readonly x: number;
    readonly y: number;
    readonly scale: number;
  };
}
```

#### `Camera2dOptions` (interface)

How `createCamera2d` frames the world: the view's size, and optionally a follow, bounds and zoom.

```ts
interface Camera2dOptions {
  /** The playfield's logical size: the area the camera shows at zoom 1. */
  readonly view: {
    readonly width: number;
    readonly height: number;
  };
  /** Approach the target at `rate` per second; a dead zone, centred on the view, the target may move in freely. */
  readonly follow?: {
    readonly rate: number;
    readonly deadZone?: {
      readonly width: number;
      readonly height: number;
    };
  };
  /** The world rect the view never shows outside of. */
  readonly bounds?: CameraRect;
  /** Default 1; above 1 shows less of the world. */
  readonly zoom?: number;
  /** Default: the player's `prefers-reduced-motion`, read every frame. */
  readonly reducedMotion?: () => boolean;
}
```

#### `CameraRect` (interface)

A world-space rectangle, in logical px: `Camera2dOptions.bounds`.

```ts
interface CameraRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
```

#### `canvasResolutionFor` (function)

Calculates device pixels per CSS pixel for the canvas.

Capped at 2 on phones and desktop, and lower at a lower quality tier. A tablet held upright draws at 1x
because its large CSS area would exceed the mobile fragment fill budget at 2x.

```ts
function canvasResolutionFor(formFactor: FormFactor, devicePixelRatio: number, tier?: QualityTier): number;
```

#### `CompositeTarget` (class)

The fixed-resolution composite (M4 spec §4.11).

The world and the UI draw here first, at resolution 1 and exactly the play field's logical size, and the result is
nearest-upscaled into the letterbox. Two reasons, and the second is the durable one. Filters cost per pixel, and a
device-resolution frame on a phone is several times the work; bounding the chain to the logical size makes the
cost the same everywhere. More importantly, pixel art sampled at a fractional device scale is pixel art with torn
edges, so compositing at 1:1 and upscaling by whole pixels is correct whatever the cost.

From FloorFifty `apps/client/src/systems/render/render-target.ts` at `ac72660`; FloorFifty's fixed 960 × 540 is
the game's logical size here.

```ts
class CompositeTarget {
  /** What the world and the UI draw into. Not the backdrop: see `adopt`. */
  readonly stage: Container;
  /** What the letterbox displays. */
  readonly sprite: Sprite;
  /** The texture the stage renders into each frame. */
  readonly texture: RenderTexture;
  private readonly width;
  constructor(size: {
    readonly width: number;
    readonly height: number;
  });
  /**
   * Moves a frame's world and UI into the target, and puts the target's sprite where they were.
   *
   * The backdrop is deliberately left where it is: it is the one layer that is not clipped, and a target of the
   * play field's size would bound it to exactly the rectangle it exists to escape. It keeps device resolution.
   */
  adopt(frame: LetterboxFrame): void;
  /** Resizes the target to a field `height` logical units tall; a no-op when the height has not changed. */
  resize(height: number): void;
  destroy(): void;
}
```

#### `createCamera2d` (function)

A camera writing `stage`'s transform (usually `PixiStage.world`). `seed` fixes the shake's random sequence,
so a shake looks the same in every run and visual test.

```ts
function createCamera2d(stage: Container, options: Camera2dOptions, seed?: number): Camera2d;
```

#### `createPixiRenderer` (function)

The core 2D renderer (ADR 0002) as a runtime `RendererFactory`: a letterboxed Pixi app on the render
target, entity views from each step's render delta, interpolated each frame. Fails with
`RendererUnavailable` when the renderer cannot start.

```ts
function createPixiRenderer(options?: PixiRendererOptions): (target: RenderTarget) => Effect.Effect<PixiRenderer, RendererUnavailable, Scope.Scope>;
```

#### `createPostFilterSlot` (function)

A post-filter slot writing its composed filters to `target`'s `filters`.

```ts
function createPostFilterSlot(target: PostFilterTarget): PostFilterSlot;
```

#### `DEFAULT_BAR_COLOR` (const)

The letterbox bars' default colour (FloorFifty's plum black).

```ts
const DEFAULT_BAR_COLOR = 3023407;
```

#### `DEFAULT_BAR_FRACTION` (const)

How much of the playfield's height each letterbox bar crops in a landscape view, by default (5%).

```ts
const DEFAULT_BAR_FRACTION = .05;
```

#### `DEFAULT_FIELD_COLOR` (const)

The default colour behind the playfield, under the world.

```ts
const DEFAULT_FIELD_COLOR = 0;
```

#### `EntityView` (interface)

What an entity view factory returns: the container drawn for one entity, updated with its current and
previous component values and the interpolation alpha, and destroyed when the entity goes.

```ts
interface EntityView<C extends SceneNode = Container> {
  readonly container: C;
  update?(curr: Readonly<Record<string, Readonly<FieldRecord>>>, prev?: Readonly<Record<string, Readonly<FieldRecord>>> | undefined, alpha?: number): void;
  destroy?(): void;
}
```

#### `EntityViewFactory` (type)

Builds the view for one entity, or `undefined` to draw nothing. A record resolver passes the component id
the factory was registered under, so a view such as `rect()` knows which component holds its pose; a bare
function resolver passes no id.

```ts
type EntityViewFactory<C extends SceneNode = Container> = (row: RenderRow, componentId?: string) => EntityView<C> | undefined;
```

#### `EntityViewResolver` (type)

Which view an entity gets: one factory for every entity, or factories by component id (the first id, in the
record's own key order, whose component the entity has wins).

```ts
type EntityViewResolver<C extends SceneNode = Container> = EntityViewFactory<C> | Readonly<Record<string, EntityViewFactory<C>>>;
```

#### `FILTER_VERTEX` (const)

The GLSL vertex stage every AF filter shares: it passes the texture coordinate and the pixel position
(`vPixelCoord`) to the fragment stage.

```ts
const FILTER_VERTEX = "\nin vec2 aPosition;\nout vec2 vTextureCoord;\nout vec2 vPixelCoord;\n\nuniform vec4 uInputSize;\nuniform vec4 uOutputFrame;\nuniform vec4 uOutputTexture;\n\nvec4 filterVertexPosition(void) {\n    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;\n    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;\n    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;\n    return vec4(position, 0.0, 1.0);\n}\n\nvec2 filterTextureCoord(void) {\n    return aPosition * (uOutputFrame.zw * uInputSize.zw);\n}\n\nvoid main(void) {\n    gl_Position = filterVertexPosition();\n    vTextureCoord = filterTextureCoord();\n    vPixelCoord = aPosition * uOutputFrame.zw + uOutputFrame.xy;\n}\n";
```

#### `filterPrograms` (function)

Builds a filter's programs from its GLSL and WGSL fragment stages on the shared vertex stages, so WebGL2
stays at parity with WebGPU (AGENTS.md).

```ts
function filterPrograms(name: string, fragmentGlsl: string, fragmentWgsl: string): FilterProgramsResult;
```

#### `FilterProgramsResult` (interface)

A filter's WebGL2 and WebGPU programs, for a Pixi `Filter`'s `glProgram` and `gpuProgram`.

```ts
interface FilterProgramsResult {
  readonly glProgram: GlProgram;
  readonly gpuProgram: GpuProgram;
}
```

#### `interpolatePose` (function)

The pose between the previous tick (`alpha = 0`) and the current one (`alpha = 1`). With no previous tick
(just added, or after a resync) it is the current pose. A missing `angle`, or a non-numeric `x`/`y`, is 0.

```ts
function interpolatePose(curr: Readonly<FieldRecord>, prev: Readonly<FieldRecord> | undefined, alpha: number): Pose;
```

#### `lerp` (function)

Linear blend; `t = 1` returns `b` exactly, because `a + (b - a)` can round away from it.

```ts
function lerp(a: number, b: number, t: number): number;
```

#### `lerpAngle` (function)

Blends two angles (radians) along the shorter arc, so a body turning from just under π to just over -π
swings through π instead of spinning the long way round through 0. At `t = 1` it returns `b` exactly, so a
view at rest shows the sim's own value rather than an equivalent angle 2π away.

```ts
function lerpAngle(a: number, b: number, t: number): number;
```

#### `LetterboxFrame` (class)

The containers a letterboxed scene is built from (backdrop, world, ui, mask and bars), laid out for a view
size by `layout`.

```ts
class LetterboxFrame {
  readonly scene: Container;
  readonly backdrop: Container;
  readonly root: Container;
  readonly world: Container;
  readonly ui: Container;
  readonly field: Graphics;
  readonly mask: Graphics;
  readonly bars: Container;
  readonly topBar: Graphics;
  readonly bottomBar: Graphics;
  private readonly logicalWidth;
  private readonly logicalHeight;
  private readonly barFraction;
  private readonly barColor;
  private readonly fieldColor;
  constructor(options: LetterboxOptions);
  layout(viewWidth: number, viewHeight: number): LetterboxGeometry;
  setBarBlack(amount: number): void;
  destroy(): void;
}
```

#### `LetterboxGeometry` (interface)

Where `LetterboxFrame.layout` put the playfield in the view, in screen px: its scale and rect, the gameplay
and scenery areas, and whether the view is portrait.

```ts
interface LetterboxGeometry {
  scale: number;
  x: number;
  y: number;
  width: number;
  height: number;
  gameplay: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  scenery: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  portrait: boolean;
  fieldHeight: number;
}
```

#### `LetterboxOptions` (interface)

A letterbox's logical playfield size and its bar and field colours (defaults `DEFAULT_BAR_FRACTION`,
`DEFAULT_BAR_COLOR`, `DEFAULT_FIELD_COLOR`).

```ts
interface LetterboxOptions {
  readonly logicalWidth: number;
  readonly logicalHeight: number;
  readonly barFraction?: number | undefined;
  readonly barColor?: number | undefined;
  readonly fieldColor?: number | undefined;
}
```

#### `MAX_RESOLUTION` (const)

The highest canvas resolution (device pixels per CSS pixel) the renderer uses, at the `high` quality tier.

```ts
const MAX_RESOLUTION = 2;
```

#### `meetsTier` (function)

Whether `tier` is `min` or higher: a pass registered for `medium` runs at `medium` and `high`.

```ts
function meetsTier(tier: QualityTier, min: QualityTier): boolean;
```

#### `PixiRenderer` (interface)

The runtime's `GameRenderer`, built on PixiJS, with its stage.

```ts
interface PixiRenderer extends GameRenderer {
  readonly stage: PixiStage;
}
```

#### `PixiRendererOptions` (interface)

Options for `createPixiRenderer`; every field has a default.

```ts
interface PixiRendererOptions {
  /**
   * Preferred backend. Default is 'webgl' (WebGL2).
   * Overridden by URL query param `?renderer=webgl` or `?renderer=webgpu` if present in browser.
   */
  readonly preference?: RendererPreference | undefined;
  /** Logical playfield width in pixels (e.g. 960 or 320). If omitted, renders unletterboxed. */
  readonly logicalWidth?: number | undefined;
  /** Logical playfield height in pixels (e.g. 540 or 192). If omitted, renders unletterboxed. */
  readonly logicalHeight?: number | undefined;
  /** Background clear colour (hex number, e.g. 0x000000). Default is 0x000000. */
  readonly backgroundColor?: number | undefined;
  /** If true, textures default to nearest-neighbour sampling for crisp pixel art. Default is true. */
  readonly pixelArt?: boolean | undefined;
  /** Letterbox cropping fraction for top and bottom bars. Default is 0.05 (5%). */
  readonly barFraction?: number | undefined;
  /** Bar color in hex. Default is 0x2e222f (FloorFifty plum black). */
  readonly barColor?: number | undefined;
  /** The graphics quality tier to start at (M4 spec §4.11); `PixiStage.setQuality` changes it. Default `high`. */
  readonly quality?: QualityTier | undefined;
  /**
   * Draws the world and UI at the logical size and resolution 1, then nearest-upscales them into the letterbox
   * (`CompositeTarget`). Needs a letterbox. Default: on when `pixelArt` is on.
   */
  readonly composite?: boolean | undefined;
  /** Optional view factory resolver for entity components. */
  readonly entityViews?: EntityViewResolver | undefined;
  /**
   * Screen-space filters declared with `postFilter`. Each is built when the renderer starts and set in the
   * stage's post-filter slot before `setup` runs, so `setup` sees them and may add more. Names must be unique.
   */
  readonly postFilters?: readonly PostFilterDef[] | undefined;
  /**
   * Optional setup hook called before the first frame to add layers/filters. It may return hooks for a game
   * that draws its own scene: they run after the entity views each step, before Pixi renders each frame, and
   * after the views reset.
   */
  readonly setup?: ((stage: PixiStage) => PixiStageHooks | undefined) | ((stage: PixiStage) => void) | undefined;
}
```

#### `PixiStage` (interface)

The Pixi scene the renderer draws, as a game's `setup` sees it: the app, the letterbox's layers, the entity
views, the post-filter slot and the quality tier.

```ts
interface PixiStage {
  readonly app: Application;
  readonly frame?: LetterboxFrame | undefined;
  /** The world container where entity views and gameplay objects are mounted. */
  readonly world: Container;
  /** The logical screen-space UI layer (masked with the playfield). */
  readonly ui: Container;
  /** The unclipped background scenery container. */
  readonly backdrop: Container;
  /** The delta consumer tracking entity views. */
  readonly consumer: RenderDeltaConsumer;
  /** The fixed-resolution composite the world and UI draw into, when it is on. */
  readonly composite?: CompositeTarget | undefined;
  /** Post-processing filters applied to the root rendered scene. Owned by `postFilters` once it is used. */
  filters: Filter[] | null;
  /** The post-filter slot over `filters`: each owner keeps its own filters by id and order (PRODUCT spec §2 F1). */
  readonly postFilters: PostFilterSlot;
  /** The graphics quality tier now. */
  readonly quality: QualityTier;
  /** Changes the tier: re-caps the canvas resolution and leaves out post-filter owners registered for a higher one. */
  setQuality(tier: QualityTier): void;
  /**
   * Builds a filter, or returns `undefined` when it cannot be built or compiled: it then warns and publishes
   * `render.filter.dropped` on the render target's bus, and the frame draws without it (M4 spec §6).
   */
  tryFilter<F extends Filter>(id: string, make: () => F): F | undefined;
}
```

#### `PixiStageHooks` (interface)

What a `setup` may return to hear every step, frame and reset (DX spec §3.4, DX.3 decision E-1).

```ts
interface PixiStageHooks {
  /** After the entity views took the step's render delta. */
  readonly apply?: ((result: StepResult) => void) | undefined;
  /** Each display frame, after the views interpolated and before Pixi renders. */
  readonly draw?: ((frame: FrameInfo) => void) | undefined;
  /** After the views reset (a new sim or a resync). */
  readonly reset?: (() => void) | undefined;
}
```

#### `PORTRAIT_FIELD_TOP` (const)

The most room above the playfield in a portrait view, in screen px (the HUD's top margin, M1 render-pixi spec):
the field sits this far down, or centred when centring leaves less room above it.

```ts
const PORTRAIT_FIELD_TOP = 60;
```

#### `portraitFieldHeight` (function)

The playfield's logical height in a portrait view: what fits below `PORTRAIT_FIELD_TOP` and above the
`band` of on-screen controls at `scale`, and never less than `baseHeight`.

```ts
function portraitFieldHeight(viewHeight: number, scale: number, band: number, baseHeight?: number): number;
```

#### `Pose` (interface)

Where an entity view draws: position in world pixels and rotation in radians (Pixi `rotation`).

```ts
interface Pose {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
}
```

#### `poseComponent` (function)

The component a view reads its pose from: the one it was registered under, or (for a bare function
resolver, which has no id) the first component in row order with numeric `x` and `y`.

```ts
function poseComponent(components: Components, componentId?: string | undefined): Readonly<FieldRecord> | undefined;
```

#### `postFilter` (function)

Declares a screen-space filter over the whole picture: `renderer: { postFilters: [postFilter('vignette', {
glsl, wgsl })] }`. The renderer builds it when it starts and keeps it in the stage's post-filter slot under
`name`. A filter that cannot be built, or whose GLSL does not link, is left out with a warning and the frame
draws without it. Throws when the name or either shader is empty.

```ts
function postFilter(name: string, spec: PostFilterSpec): PostFilterDef;
```

#### `PostFilterDef` (interface)

A declared filter, as `postFilter` returns it and `PixiRendererOptions.postFilters` takes it.

```ts
interface PostFilterDef {
  readonly name: string;
  readonly glsl: string;
  readonly wgsl: string;
  readonly order: number;
  readonly minTier: QualityTier | undefined;
}
```

#### `PostFilterOptions` (interface)

Options for `PostFilterSlot.set`.

```ts
interface PostFilterOptions {
  /** The lowest quality tier these filters run at; omitted, they run at every tier. */
  readonly minTier?: QualityTier | undefined;
}
```

#### `PostFilterSlot` (interface)

The post-filter slot (PRODUCT spec §2 F1): each owner (an extension, quality tiers, the game) keeps its own
filters under its id, and the slot writes all of them to the target, ordered by `order` (lower first), then
by id. Once a slot is in use it owns the target's `filters`; assigning them directly is overwritten on the
next change. Filters stay GLSL + WGSL pairs (`filterPrograms`), so WebGL2 keeps parity with WebGPU.

Quality tiers (M4 spec §4.11): an owner may declare the lowest tier it runs at. Below it, its filters are left
out of the composed list but kept, so raising the tier brings them back in their place. An owner without a
`minTier` (the art direction, such as a palette lock) runs at every tier.

```ts
interface PostFilterSlot {
  /** Sets (or replaces) `id`'s filters. Returns a remover that only removes this setting, once. */
  set(id: string, filters: readonly Filter[], order?: number, options?: PostFilterOptions): () => void;
  /** Removes `id`'s filters; nothing happens when it has none. */
  remove(id: string): void;
  /** The owners whose filters run now, in the order they run. */
  readonly ids: readonly string[];
  /** The quality tier the slot composes for; `high` until `setTier`. */
  readonly tier: QualityTier;
  /** Recomposes for `tier`, leaving out owners registered for a higher one. */
  setTier(tier: QualityTier): void;
}
```

#### `PostFilterSpec` (interface)

What a screen-space filter is made of: the same effect written twice, for WebGL2 (`glsl`) and WebGPU (`wgsl`),
so the two renderers stay at parity. Both are fragment shaders that `filterPrograms` joins to the shared vertex
stage: GLSL reads `vTextureCoord`, `vPixelCoord` and `uTexture`; WGSL has `mainFragment(input: VSOutput)`.

```ts
interface PostFilterSpec {
  /** The GLSL ES 3.00 fragment shader, run under WebGL2. */
  readonly glsl: string;
  /** The WGSL fragment shader, run under WebGPU; its entry point is `mainFragment`. */
  readonly wgsl: string;
  /** Where it sits among the stage's filters: lower runs first, ties by name. Default 0. */
  readonly order?: number | undefined;
  /** The lowest quality tier it runs at; left out, it runs at every tier. */
  readonly minTier?: QualityTier | undefined;
}
```

#### `PostFilterTarget` (interface)

Where the composed filters go: `PixiStage` (its scene's `filters`), or any Pixi container.

```ts
interface PostFilterTarget {
  filters: Filter[] | null;
}
```

#### `QualityBuild` (interface)

What `rebuildOnQuality` keeps mounted.

```ts
interface QualityBuild<T> {
  /** The build for the tier now. */
  current(): T;
  /** Stops following the setting and destroys the build. */
  dispose(): void;
}
```

#### `rebuildOnQuality` (function)

Keeps something built for the player's quality tier (M4 spec §4.11), rebuilding it when the tier changes.

Quality decides which passes a build makes at all, so a change is a rebuild, not a toggle. The old build is
destroyed before the new one is made: two live builds would both hold their GPU resources. From FloorFifty
`apps/client/src/systems/render/quality-rebuild.ts` at `ac72660`, over runtime's `SettingsStore` with `read`
picking the tier out of the game's settings.

```ts
function rebuildOnQuality<S, T extends {
  destroy(): void;
}>(settings: SettingsStore<S>, read: (settings: S) => QualityTier, build: (tier: QualityTier) => T, onBuilt?: (built: T) => void): QualityBuild<T>;
```

#### `rect` (function)

A filled rectangle that follows its component's `x`, `y` and `angle`, interpolated between ticks:
`entityViews: { [Body.id]: rect({ w: 8, h: 8, color: 0xf9c22b }) }`.

```ts
function rect(options: RectViewOptions): EntityViewFactory;
```

#### `RectViewOptions` (interface)

A `rect` view's size, colour and anchor.

```ts
interface RectViewOptions {
  /** Width in world pixels. */
  readonly w: number;
  /** Height in world pixels. */
  readonly h: number;
  /** Fill colour, e.g. 0xf9c22b. */
  readonly color: number;
  /** Default 0.5 (centred on the entity's position). */
  readonly anchor?: ViewAnchor | undefined;
}
```

#### `RenderDeltaConsumer` (class)

Keeps one entity view per sim entity in the world from each step's render delta, and interpolates them between
ticks. `C` is the scene's node type: Pixi's `Container` by default.

```ts
class RenderDeltaConsumer<C extends SceneNode = Container> {
  private readonly world;
  private readonly resolver?;
  private readonly views;
  private readonly cache;
  constructor(world: SceneParent<C>, resolver?: EntityViewResolver<C>);
  private resolveView;
  apply(delta: RenderDelta): void;
  interpolate(alpha: number): void;
  private removeEntity;
  reset(): void;
  destroy(): void;
}
```

#### `RendererPreference` (type)

The renderer backend: `webgl` (WebGL2, the default) or `webgpu` (opt-in).

```ts
type RendererPreference = "webgl" | "webgpu";
```

#### `RESOLUTION_CAPS` (const)

The canvas resolution each quality tier allows at most (M4 spec §4.11).

```ts
const RESOLUTION_CAPS: Readonly<Record<QualityTier, number>>;
```

#### `SceneNode` (interface)

What the consumer needs of a scene node: Pixi's `Container`, or another scene graph's node with the same meaning
(`@pixi/3d`'s `Container3D`, which is not a Pixi `Container`; M3 spec S7-Q5).

```ts
interface SceneNode {
  readonly parent: unknown;
  removeFromParent(): void;
}
```

#### `SceneParent` (interface)

A scene node that holds other nodes: the world the consumer mounts views into.

```ts
interface SceneParent<C extends SceneNode> {
  addChild(child: C): unknown;
}
```

#### `SHAKE_DECAY` (const)

Trauma lost per second: a full shake (1) is gone in 2/3 s.

```ts
const SHAKE_DECAY = 1.5;
```

#### `SHAKE_MAX_OFFSET` (const)

The largest shake offset per axis, in logical px, at trauma 1.

```ts
const SHAKE_MAX_OFFSET = 8;
```

#### `sprite` (function)

A sprite that follows its component's `x`, `y` and `angle`, interpolated between ticks. `source` is a
texture or a url: a url the runtime already loaded (it is in `Assets.cache`) shows at once; otherwise the
sprite is empty until `Assets.load` resolves. A url that fails to load is reported with `reportError`
and the sprite stays empty. The frame textures are sliced once per factory and shared by its sprites.
With `frame`, the url is an atlas page's Spritesheet and the sprite shows that frame; a name the atlas lacks
is reported the same way.

```ts
function sprite(source: Texture | string, options?: SpriteViewOptions): EntityViewFactory;
```

#### `SpriteFrames` (interface)

The texture is a sheet of equal frames, read left to right, top to bottom. The pose component's numeric
`frame` field picks one (floored, wrapped by the frame count); with no `frame` field the first is shown.
Frames switch on ticks; they are not interpolated.

```ts
interface SpriteFrames {
  readonly width: number;
  readonly height: number;
  /** Default: every whole frame that fits in the texture. */
  readonly count?: number | undefined;
}
```

#### `SpriteViewOptions` (interface)

A `sprite` view's anchor and either its sprite-sheet frames or one frame of a packed atlas.

```ts
interface SpriteViewOptions {
  /** Default 0.5 (centred on the entity's position). */
  readonly anchor?: ViewAnchor | undefined;
  readonly frames?: SpriteFrames | undefined;
  /**
   * A frame of a packed atlas (M5.6): `source` is the url of an atlas page's Spritesheet JSON, which
   * `automata-content assets` writes, and `frame` names one of its frames. Not with `frames`.
   */
  readonly frame?: string | undefined;
}
```

#### `ViewAnchor` (type)

Where the view's own box sits on its position: 0 = left/top, 0.5 = centre, 1 = right/bottom.

```ts
type ViewAnchor = number | {
  readonly x: number;
  readonly y: number;
};
```

#### `WGSL_FILTER_HEADER` (const)

The WGSL counterpart of `FILTER_VERTEX`: the filter uniforms and bindings and the vertex stage, which
passes the pixel position to the fragment stage.

```ts
const WGSL_FILTER_HEADER = "\nstruct GlobalFilterUniforms {\n    uInputSize: vec4<f32>,\n    uInputPixel: vec4<f32>,\n    uInputClamp: vec4<f32>,\n    uOutputFrame: vec4<f32>,\n    uGlobalFrame: vec4<f32>,\n    uOutputTexture: vec4<f32>,\n};\n\n@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;\n@group(0) @binding(1) var uTexture: texture_2d<f32>;\n@group(0) @binding(2) var uSampler: sampler;\n\nstruct VSOutput {\n    @builtin(position) position: vec4<f32>,\n    @location(0) uv: vec2<f32>,\n    @location(1) pixelCoord: vec2<f32>,\n};\n\nfn filterVertexPosition(aPosition: vec2<f32>, gfu: GlobalFilterUniforms) -> vec4<f32> {\n    var position = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;\n    position.x = position.x * (2.0 / gfu.uOutputTexture.x) - 1.0;\n    position.y = position.y * (2.0 * gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;\n    return vec4(position, 0.0, 1.0);\n}\n\nfn filterTextureCoord(aPosition: vec2<f32>, gfu: GlobalFilterUniforms) -> vec2<f32> {\n    return aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw);\n}\n\n@vertex\nfn mainVertex(@location(0) aPosition: vec2<f32>, @builtin(instance_index) instanceIndex: u32) -> VSOutput {\n    var output: VSOutput;\n    output.position = filterVertexPosition(aPosition, gfu);\n    output.uv = filterTextureCoord(aPosition, gfu);\n    output.pixelCoord = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;\n    return output;\n}\n";
```

## `@mcthaydt/automata-runtime`

### `import { … } from '@mcthaydt/automata-runtime'`

#### `actionsForGesture` (function)

Every action `gesture` drives in `profile` (M4.3); none when it is unbound.

```ts
function actionsForGesture(profile: InputProfile, gesture: GestureName): string[];
```

#### `actionsForKey` (function)

Every action `code` (a `KeyboardEvent.code`) drives in `profile`; none when it is unbound.

```ts
function actionsForKey(profile: InputProfile, code: string): string[];
```

#### `actionsForPadButton` (function)

Every action the standard-mapping pad button `index` drives in `profile`; none when it is unbound.

```ts
function actionsForPadButton(profile: InputProfile, index: number): string[];
```

#### `ActiveDevice` (interface)

The device of the last real input, and the button labels of the active pad (`generic` before any pad).

```ts
interface ActiveDevice {
  readonly device: InputDevice;
  readonly glyphs: GlyphFamily;
}
```

#### `AppLoop` (interface)

The frame loop service: `run` steps a sim at its fixed tick rate from display frames, with the commands for each
tick, and the renderer draws every frame. No step runs while `Time` is paused; a throw from a step stops it.

```ts
interface AppLoop {
  run(options: {
    sim: Sim;
    commands: (tick: number) => readonly Command[];
  }): void;
  stop(): void;
  readonly running: boolean;
}
const AppLoop: Context.Tag<AppLoop, AppLoop>;
```

#### `applyDocumentLocale` (function)

`<html lang dir>`: the browser picks glyph forms and line breaking from `lang`, and the layout direction from `dir`.

```ts
function applyDocumentLocale(element: HTMLElement, locale: string): void;
```

#### `applyOverrides` (function)

The game's profile with the player's overrides applied (M4 spec §6): an override for an unknown action, one that
binds a reserved input, or one with a pad button out of range is dropped and named in `dropped` (sorted), and the
defaults stand for it. Overrides saved against another profile are all dropped.

```ts
function applyOverrides(defaults: InputProfile, saved: InputSettings): {
  readonly profile: InputProfile;
  readonly dropped: readonly string[];
};
```

#### `AssetLoadFailed` (class)

An asset download failed with a non-OK HTTP status or network error (status 0).

```ts
class AssetLoadFailed extends AssetLoadFailedBase {}
```

#### `Assets` (interface)

The asset loader service: `load` fetches a screen's assets and fonts with progress, failing
`AssetLoadFailed` or `LoadStalled`; `get` returns a loaded file by path.

```ts
interface Assets {
  load(screen: string, onProgress?: (fraction: number | undefined) => void): Effect.Effect<void, AssetLoadFailed | LoadStalled>;
  get(path: string): Blob | undefined;
  isLoaded(screen: string): boolean;
}
const Assets: Context.Tag<Assets, Assets>;
```

#### `Audio` (interface)

The audio service (M5 spec §4.6): one-shot sounds and looping music on the audio buses, unlocked by the
first gesture after `session.ready`; the game runs silent when no audio context can be built.

```ts
interface Audio {
  /** False until the first gesture after `session.ready` builds and resumes the graph. */
  readonly unlocked: Subscribable.Subscribable<boolean>;
  /** False once a context could not be built (`audio.unavailable`): the game runs silent, and Settings says so. */
  readonly available: Subscribable.Subscribable<boolean>;
  /** Plays the asset at `alias` once. Fire and forget: silent before the unlock, while asleep, or if it fails. */
  sound(alias: string, options?: SoundOptions): void;
  /** Loops the asset at `alias` on the music bus. Asked for before the unlock, it starts on the unlock. */
  music(alias: string, options?: MusicOptions): Effect.Effect<void, AudioDecodeFailed | AssetLoadFailed>;
  /** Fades the music out over `fadeSeconds`, a click-free cut by default. */
  stopMusic(fadeSeconds?: number): void;
  /** Takes `bus` down by `amount` (0..1) for `seconds`; `master` ducks every bus. */
  duck(bus: AudioBusName, amount: number, seconds: number): void;
  /** The player's mute: the master only, so unmuting restores the mix as it was. */
  setMuted(muted: boolean): void;
  /**
   * A short tone on `bus`, as the volume sliders play on release (FloorFifty's sample), so the player hears the level
   * they set. The graph makes it: no game asset. Silent before the unlock, as every sound is.
   */
  sample(bus: AudioBusName): void;
  /** The player's "mute when in the background": silences the master while another window has focus. */
  setMuteUnfocused(muteUnfocused: boolean): void;
}
const Audio: Context.Tag<Audio, Audio>;
```

#### `AUDIO_BUS_NAMES` (const)

The core audio buses (PRODUCT spec §2 F1): `master` carries the other four; M5-D3 added `voice` (announcers,
dialogue). Every change to the set is an API change (PRODUCT spec §2 F6).

```ts
const AUDIO_BUS_NAMES: readonly ["master", "music", "sfx", "ui", "voice"];
```

#### `AUDIO_SETTINGS_DEFAULT` (const)

Not muted, every bus at full.

```ts
const AUDIO_SETTINGS_DEFAULT: AudioSettings;
```

#### `AudioBuses` (interface)

The audio-bus seam (PRODUCT spec §2 F1). M5's core audio implements it over Web Audio (a gain node per bus
into `master`, combined there with `Hosting.audio`'s volume and focus); an extension such as Plus
`audio-stream`, or the game, connects its sources to `input(bus)` and never to the destination directly,
so the player's gains and the host's ducking always apply.
The `AudioBuses` service tag. Core provides no implementation until M5.

```ts
interface AudioBuses {
  /** The node a source connects to so that it plays on `bus`. */
  input(bus: AudioBusName): AudioNode;
  /** The player's current gain for `bus`, 0..1. */
  gain(bus: AudioBusName): number;
  /** Sets the player's gain for `bus`, 0..1. Persisting it is the game's settings' job. */
  setGain(bus: AudioBusName, gain: number): void;
}
const AudioBuses: Context.Tag<AudioBuses, AudioBuses>;
```

#### `AudioBusGains` (type)

The player's gain per bus, 0 (silent) to 1 (full), as a game's settings store it.

```ts
type AudioBusGains = Readonly<Record<AudioBusName, number>>;
```

#### `audioBusGainsSchema` (const)

Validates saved bus gains; a bus left out is at full gain. A gain outside 0..1 fails the parse rather than
being clamped, so `SettingsDef`'s fallback to defaults (runtime `readSettings`) applies to a bad record.

```ts
const audioBusGainsSchema: z.ZodType<AudioBusGains, Partial<Record<AudioBusName, number | undefined>>>;
```

#### `AudioBusName` (type)

One of `AUDIO_BUS_NAMES`.

```ts
type AudioBusName = (typeof AUDIO_BUS_NAMES)[number];
```

#### `AudioContextLike` (type)

The part of `AudioContext` the graph uses. `interrupted` is Safari's state for a call or Siri.

```ts
type AudioContextLike = Pick<AudioContext, "currentTime" | "destination" | "createGain" | "createBufferSource" | "createBuffer" | "sampleRate" | "decodeAudioData" | "resume" | "suspend" | "close"> & {
  readonly state: AudioContextState | "interrupted";
};
```

#### `AudioDecodeFailed` (class)

The browser could not decode a sound's bytes (M5 spec §6): that sound is silent and nothing else stops. The
`audio.decode.failed` fact carries the same alias.

```ts
class AudioDecodeFailed extends AudioDecodeFailedBase {}
```

#### `AudioDecodeFailedFields` (interface)

The fields of `AudioDecodeFailed`.

```ts
interface AudioDecodeFailedFields {
  /** The asset path the sound or music was asked for by. */
  readonly alias: string;
  readonly cause: unknown;
}
```

#### `audioLayer` (const)

`makeAudio` with its defaults, reading `Hosting`, `Assets` and `PresentationBus` from the runtime.

```ts
const audioLayer: (options?: AudioOptions) => Layer.Layer<Audio | AudioBuses, never, Hosting | Assets | PresentationBus>;
```

#### `AudioLive` (const)

The Audio service with its defaults: the browser's `AudioContext`, `window`, `document` and `fetch`.

```ts
const AudioLive: Layer.Layer<Audio | AudioBuses, never, Hosting | Assets | PresentationBus>;
```

#### `AudioOptions` (interface)

Options for the audio service; each has a browser default, replaced in tests.

```ts
interface AudioOptions {
  /** Builds the context on the unlock. Defaults to `new AudioContext()`. */
  readonly createContext?: () => AudioContextLike;
  /** Where gestures, `blur` and `focus` land. Defaults to `window`. */
  readonly window?: Pick<EventTarget, "addEventListener" | "removeEventListener">;
  /** Whose `visibilitychange` sleeps and wakes the graph. Defaults to `document`. */
  readonly document?: Pick<EventTarget, "addEventListener" | "removeEventListener"> & {
    readonly visibilityState: DocumentVisibilityState;
  };
  /** Silences the master while another window has focus (FloorFifty's setting); the graph keeps running. */
  readonly muteUnfocused?: boolean;
  /** Loads a file no screen preloaded. Defaults to `fetch`. */
  readonly fetch?: typeof fetch;
}
```

#### `AudioServices` (interface)

What the service reads from the runtime.

```ts
interface AudioServices {
  readonly hosting: Pick<Hosting, "ready" | "lifecycle" | "audio">;
  readonly assets: Pick<Assets, "get">;
  readonly bus: PresentationBus;
}
```

#### `AudioSettings` (interface)

The player's audio choices (M5 spec §7, M5.4), as FloorFifty's `audio` settings: the mute, the mute while another
window has focus, and a gain per bus. The one owner of their shape: the Settings screen's Audio group and the
`Audio` service read it from here. Kept on the device, not in the player's saves (§4.5): `CORE_SETTINGS.deviceFields`.

```ts
interface AudioSettings {
  readonly muted: boolean;
  readonly muteUnfocused: boolean;
  readonly gains: AudioBusGains;
}
```

#### `audioSettingsSchema` (const)

A missing field takes its default; a bad record reads as the defaults, as every settings field falls back.

```ts
const audioSettingsSchema: z.ZodType<AudioSettings, unknown>;
```

#### `AuthoritativeSnapshot` (interface)

One authoritative state: the authority sim's `snapshot()` bytes at `tick`, with its `hash()`. A receiver
`restore`s the bytes and may compare its own hash to `hash` to detect divergence.

```ts
interface AuthoritativeSnapshot {
  readonly tick: number;
  readonly bytes: Uint8Array;
  readonly hash: string;
}
```

#### `AutosavePolicy` (interface)

When the loaded slot writes itself: on each listed trigger, with `intervalSeconds` for the `interval`
timer.

```ts
interface AutosavePolicy {
  readonly on: readonly AutosaveTrigger[];
  /** Seconds between timer writes, default 60. Read only when `interval` is in `on`. */
  readonly intervalSeconds?: number;
}
```

#### `AutosaveTrigger` (type)

What can make the loaded slot write itself (M5 spec §4.4).

```ts
type AutosaveTrigger = "screen-exit" | "round-end" | "background" | "interval";
```

#### `BindingOverride` (interface)

What the player changed about one action: its keys, its pad buttons, or both.

```ts
interface BindingOverride {
  readonly keys?: readonly string[] | undefined;
  readonly pad?: readonly number[] | undefined;
}
```

#### `BoardEntry` (type)

One row of a board, as Ruken gives it; `isMe` marks the player.

```ts
type BoardEntry = Effect.Effect.Success<ReturnType<HostingLeaderboards["get"]>>["entries"][number];
```

#### `BoardQuery` (type)

What `readBoard` asks for: Ruken's `get` options (`scope` `top` or `around-me`, `limit`).

```ts
type BoardQuery = NonNullable<Parameters<HostingLeaderboards["get"]>[1]>;
```

#### `BoardState` (type)

The state of a board after the game's last submit to it.

```ts
type BoardState = {
  readonly state: "idle";
} | {
  readonly state: "submitting";
} | {
  readonly state: "accepted";
  readonly personalBest: number;
  readonly rank?: number;
} | {
  readonly state: "refused";
} | {
  readonly state: "unavailable";
} | {
  readonly state: "offline";
};
```

#### `BoardView` (type)

A board read for a screen: its rows, or why there are none.

```ts
type BoardView = {
  readonly state: "entries";
  readonly entries: readonly BoardEntry[];
} | {
  readonly state: "empty";
} | {
  readonly state: "unavailable";
} | {
  readonly state: "offline";
};
```

#### `BootDefect` (class)

An unexpected defect during boot.

```ts
class BootDefect extends BootDefectBase {}
```

#### `BootError` (type)

Every way boot can fail; each draws on the runtime's boot failure panel (shared contracts §4).

```ts
type BootError = HostError | ContentHashMismatch | AssetLoadFailed | LoadStalled | RendererUnavailable | ModelInvalid | BootDefect;
```

#### `browserHaptics` (function)

The browser's haptics: its pads, its `vibrate`, and whether its pointer is a finger.

```ts
function browserHaptics(target: Window): Haptics;
```

#### `CAMERA_SETTINGS_DEFAULT` (const)

The camera choices a new player starts with: the default turn speed, not inverted.

```ts
const CAMERA_SETTINGS_DEFAULT: CameraSettings;
```

#### `CAMERA_TURN_SPEED` (const)

The range of "Camera turn speed" in degrees per dragged pixel (M4 spec §16.3.6, M3 spec §4.2): 0.25° by default,
so a 1,440 px sweep is one full turn. A Settings slider steps through it.

```ts
const CAMERA_TURN_SPEED: {
  readonly min: 0.05;
  readonly max: 1;
  readonly step: 0.05;
  readonly default: 0.25;
};
```

#### `CameraDragTracker` (class)

Turns pointer samples into camera drags for one `DragSink`: one pointer at a time, its horizontal CSS px per move,
from a touch or pen's primary contact or the mouse's secondary button.

```ts
class CameraDragTracker {
  private readonly sink;
  private pointerId;
  private lastX;
  private pointer;
  constructor(sink: DragSink);
  /** A pointer drives the drag now. */
  get dragging(): boolean;
  /**
   * A pointer went down. It starts a drag only when none is in progress (or it is the dragging pointer again) and it
   * is a finger or pen on its primary contact or a mouse on its secondary button. True when it now drives the drag.
   */
  down(id: number, x: number, start: DragStart): boolean;
  /** A pointer moved: the dragging one sends how far it went to the right. Others are ignored. */
  move(id: number, x: number): void;
  /** A pointer lifted: the drag ends if it was the dragging one. A finger still down never takes over. */
  up(id: number): void;
  /** The browser took the pointers (pointercancel, lost capture): the drag ends; what it sent stands. */
  cancel(): void;
}
```

#### `CameraSettings` (interface)

The player's camera choices, `camera` in the core settings: how far a dragged pixel turns the camera, and whether
the turn is inverted. The one owner of their shape: the game's Settings rows (GAME-3D) and its command mapping
(`turnUnitsFromPixels`) read them from here.

```ts
interface CameraSettings {
  readonly degPerPixel: number;
  readonly invert: boolean;
}
```

#### `cameraSettingsSchema` (const)

A missing, malformed or out-of-range field reads as its default, keeping the other; a record that is not an
object reads as the defaults, as every settings field falls back.

```ts
const cameraSettingsSchema: z.ZodType<CameraSettings, unknown>;
```

#### `Capture` (type)

The input a capture caught: a key by its `KeyboardEvent.code`, or a standard-mapping pad button.

```ts
type Capture = {
  readonly code: string;
} | {
  readonly button: number;
};
```

#### `CompiledContentData` (interface)

The compiled JSON content read by the runtime (spec §3.3).

```ts
interface CompiledContentData {
  readonly flow: FlowGraph;
  readonly assets?: AssetsSource | undefined;
  readonly game?: GameSource | undefined;
  readonly [key: string]: unknown;
}
```

#### `ContentHashMismatch` (class)

Content hash does not match expected hash.

```ts
class ContentHashMismatch extends ContentHashMismatchBase {}
```

#### `contentHashOf` (function)

The content hash formula: hex64(xxhash64(utf8(canonicalJson(data)))).
Matches
@mcthaydt /automata-content's contentHash formula (M1.3), pinned by tests.

```ts
function contentHashOf(data: unknown): string;
```

#### `CORE_SETTINGS` (const)

The `settings` save, version 1: the player's bindings (`input`), graphics quality (`display`), audio (`audio`),
vibration (`haptics`) and camera turn (`camera`).

```ts
const CORE_SETTINGS: SettingsDef<CoreSettings>;
```

#### `CoreSettings` (interface)

The settings every game carries: input bindings, display, audio and vibration.

```ts
interface CoreSettings {
  readonly input: InputSettings;
  readonly display: DisplaySettings;
  /** The Audio group's choices (M5.4); a record saved before it reads them as the defaults. */
  readonly audio: AudioSettings;
  /** The Vibration group's toggle (Owner, 2026-10-18); a record saved before it reads it as on. */
  readonly haptics: HapticsSettings;
  /** "Camera turn speed" and "Invert camera" (M4.12); a record saved before them reads them as the defaults. */
  readonly camera: CameraSettings;
}
```

#### `createHaptics` (function)

The haptics service over these sources; it starts enabled.

```ts
function createHaptics(options: HapticsOptions): Haptics;
```

#### `createT` (function)

`t` over a messages module (`import * as m from './paraglide/messages.js'`). Each call reads the current
locale, so a screen that calls `t` again after `'locale.changed'` shows the new language without a remount.
An unknown key throws, naming it: the types already forbid it, so it means the catalog and the code drifted.

```ts
function createT<Messages extends Record<string, unknown>>(messages: Messages): Translate<Messages>;
```

#### `DEFAULT_QUALITY` (const)

`high` until PRODUCT.7 has measured the phone profiles (M4-D6); no device auto-detection.

```ts
const DEFAULT_QUALITY: QualityTier;
```

#### `defineSave` (function)

Declares a save. It checks nothing the SDK checks; it only gives the definition its type.

```ts
function defineSave<S>(def: SaveDef<S>): SaveDef<S>;
```

#### `DeviceStorage` (interface)

Where a settings field that belongs to one device is kept (M5 spec §4.5, M5-D4). Any method may throw, as a
blocked or full `localStorage` does; the settings store copes with that and never falls back to the saves.

```ts
interface DeviceStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}
```

#### `DisplayCopy` (interface)

The words of the display policy: the landscape gate, the rotate hint for each orientation and the rotate
toast.

```ts
interface DisplayCopy {
  readonly gate: LandscapeGateCopy;
  readonly rotate: Readonly<Record<"portrait" | "landscape", RotateHintCopy>>;
  readonly toast: RotateToastCopy;
}
```

#### `DisplaySettings` (interface)

The core display settings a game's settings carry as `display`: `{ display: displaySettingsSchema }`.

```ts
interface DisplaySettings {
  readonly quality: QualityTier;
}
```

#### `displaySettingsSchema` (const)

The schema of `DisplaySettings`: an unknown or missing quality reads as `DEFAULT_QUALITY`.

```ts
const displaySettingsSchema: z.ZodType<DisplaySettings, {
  quality?: unknown;
}>;
```

#### `DragPointer` (type)

What drove a drag: a finger or pen (`touch`), or the mouse.

```ts
type DragPointer = "touch" | "mouse";
```

#### `DragSink` (interface)

Where drags go (`Input.drag`): CSS px moved to the right since the previous move, negative to the left.

```ts
interface DragSink {
  drag(dxPx: number, pointer: DragPointer): void;
}
```

#### `DragStart` (interface)

The parts of a `pointerdown` that decide whether it may drag.

```ts
interface DragStart {
  /** `PointerEvent.pointerType`: `touch`, `pen` or `mouse`. */
  readonly pointerType: string;
  /** `PointerEvent.button`: 0 primary, 2 secondary. */
  readonly button: number;
}
```

#### `EventScores` (type)

A sim event's type (its `defineEvent` id) → the board it scores on and the score its payload gives.

```ts
type EventScores = Readonly<Record<string, {
  readonly board: string;
  readonly score: (payload: unknown) => number;
}>>;
```

#### `EventSounds` (type)

A sim event's type (its `defineEvent` id) → the asset path it plays, or the path with its bus and gain.

```ts
type EventSounds = Readonly<Record<string, string | {
  readonly alias: string;
  readonly bus?: AudioBusName;
  readonly gain?: number;
}>>;
```

#### `Flow` (interface)

The screen flow service: the current screen, `dispatch` to follow an event's transition from it, `openMenu`
for the current screen's menu, and `settled` once no transition is pending.

```ts
interface Flow {
  readonly current: string | undefined;
  dispatch(event: string): boolean;
  openMenu(): boolean;
  readonly settled: Effect.Effect<void>;
}
const Flow: Context.Tag<Flow, Flow>;
```

#### `FlowFailure` (type)

Why entering a screen failed: an asset load, a stalled download, or the screen's own failure.

```ts
type FlowFailure = AssetLoadFailed | LoadStalled | {
  readonly _tag: "ScreenFailed";
  readonly screen: string;
  readonly cause: unknown;
};
```

#### `formatDateTime` (const)

A moment as a date and a short time in the reader's convention, in the reader's zone unless `options.timeZone`
names one (a test names UTC). A save's time on the slot list is this.

```ts
const formatDateTime: (locale: string, epochMs: number, options?: Intl.DateTimeFormatOptions) => string;
```

#### `formatDuration` (function)

A clock-style duration from milliseconds, whole seconds: `01:15`, or `1:02:05` once there are hours.
Each part is a locale number (Arabic-Indic digits in `ar-EG`); the separator is a colon. NumberFormat, not
Intl.DurationFormat, so it needs no ES2025 lib in a game's tsconfig and runs on engines without it.

```ts
function formatDuration(locale: string, milliseconds: number): string;
```

#### `formatNumber` (const)

A number in `locale`'s convention (Intl.NumberFormat with `options`).

```ts
const formatNumber: (locale: string, value: number, options?: Intl.NumberFormatOptions) => string;
```

#### `formatPercent` (const)

A whole percentage of a fraction: 0.5 → `50%` (`50 %` in French).

```ts
const formatPercent: (locale: string, fraction: number) => string;
```

#### `FrameInfo` (interface)

One display frame: the interpolation alpha between the last two ticks, the frame's length in ms, and
whether time is paused.

```ts
interface FrameInfo {
  alpha: number;
  frameMs: number;
  paused: boolean;
}
```

#### `GameDefinition` (interface)

Everything a game provides to the runtime to boot (spec §3.3).

```ts
interface GameDefinition<S = never> {
  readonly root: HTMLElement;
  readonly hosting: Omit<HostingOptions, "disclosedEvents">;
  readonly content: {
    readonly data: CompiledContentData;
    readonly hash: string;
  };
  readonly screens: readonly ScreenDef[];
  /**
   * Files fetched with the preload screens' own (byte progress, the 30 s stall rule) before the renderer starts,
   * outside the content: a game without `content/` lists its 3D models here (M3.4a). They are not part of
   * `content.hash`, so a new origin or a rebuilt file never changes the hash saves are stamped with.
   */
  readonly preload?: readonly string[] | undefined;
  readonly renderer: RendererFactory;
  readonly settings?: SettingsDef<S> | undefined;
  /**
   * The game's save (M5): its slots, autosave and migrations. Boot opens it, wires its triggers and flushes it when
   * the host closes the game; a screen reaches it with `saveOf(def)`. Absent, the game has no save and the runtime
   * reads and writes nothing for one.
   */
  readonly saves?: SaveDef<unknown> | undefined;
  /**
   * The orientation the game plays in, as the ship config's `runtime.orientation` says (M4.7). A `portrait` or
   * `landscape` game on a phone held the other way pauses behind the rotate hint. Default `any`.
   */
  readonly orientation?: GameOrientation | undefined;
  /** How a locked orientation says so on a phone held the other way: `'block'` (the default) or `'toast'`. */
  readonly rotateHint?: RotateHintMode | undefined;
  /**
   * The game's languages: pass its Paraglide `runtime.js` (`import * as runtime from './paraglide/runtime.js'`).
   * Absent, the game has one locale, the content's `source_language` (PRODUCT spec §4).
   */
  readonly locale?: LocaleDef | undefined;
  readonly extensions?: readonly ExtensionDef[] | undefined;
  /** The sound each sim event plays, by the event's type (M5.3). */
  readonly sounds?: EventSounds | undefined;
  /** The board and score each sim event submits, by the event's type (M5.7). Needs the `leaderboards` grant. */
  readonly scores?: EventScores | undefined;
  readonly copy?: Partial<BootFailureCopy> & {
    readonly loading?: string;
    readonly slow?: string;
    /** The panel when the renderer's graphics context is lost for good (M3 spec §5). */
    readonly contextLost?: string;
  };
  readonly seams?: RuntimeSeams;
}
```

#### `GameOrientation` (type)

The orientation a game plays in; the ship config writes the same value as `runtime.orientation`.

```ts
type GameOrientation = "portrait" | "landscape" | "any";
```

#### `GameRenderer` (interface)

What the runtime asks of a renderer: apply each step's result, draw each frame, and reset for a new sim.

```ts
interface GameRenderer {
  apply(result: StepResult): void;
  draw(frame: FrameInfo): void;
  reset(): void;
}
```

#### `GESTURE_TUNING` (const)

FloorFifty's gesture tuning, the defaults.

```ts
const GESTURE_TUNING: GestureTuning;
```

#### `GestureName` (type)

A touch gesture (M4.3 recognises the swipes, flick and tap; M4.12 the camera drag).

```ts
type GestureName = (typeof GESTURE_NAMES)[number];
```

#### `GestureSink` (interface)

Where gestures go: held while a finger steers, pulsed for a flick or a tap. The camera drag is analog (M4.12) and
goes to `Input.drag` instead, so it is not one of these.

```ts
interface GestureSink {
  hold(gesture: Exclude<GestureName, "camera-drag">): void;
  release(gesture: Exclude<GestureName, "camera-drag">): void;
  pulse(gesture: Exclude<GestureName, "camera-drag">): void;
}
```

#### `GestureTuning` (interface)

Content tuning, in CSS px and ms; FloorFifty's values are the defaults.

```ts
interface GestureTuning {
  /** How far the thumb must be from the anchor, on an axis, to steer on it. Also how still a tap must be. */
  readonly deadZonePx: number;
  /** How far the anchor lets the thumb get ahead of it. */
  readonly saturationPx: number;
  /** How far down, within `flickMs`, makes a flick. */
  readonly flickPx: number;
  /** A flick's window; also the longest tap. */
  readonly flickMs: number;
}
```

#### `GlyphFamily` (type)

Which labels a pad's buttons carry, read from its id.

```ts
type GlyphFamily = "xbox" | "playstation" | "generic";
```

#### `HapticPulse` (interface)

One pulse: a pad's dual-rumble (milliseconds, each motor 0..1), and a phone's buzz in `navigator.vibrate`'s terms.

```ts
interface HapticPulse {
  readonly duration: number;
  readonly strong: number;
  readonly weak: number;
  /** None: a phone stays still for this pulse. */
  readonly phone?: number | readonly number[] | undefined;
}
```

#### `Haptics` (interface)

The haptics service: a pad's rumble or a phone's buzz, when the device can and the player's Vibration
setting allows.

```ts
interface Haptics {
  /** Rumbles or buzzes, as above. Never throws: feel is never worth an error, and this may run inside a frame. */
  pulse(pulse: HapticPulse): void;
  /** Whether this device can do either now: a pad that can rumble, or a touch screen that can buzz. */
  readonly supported: boolean;
  /** The player's Vibration setting. */
  setEnabled(enabled: boolean): void;
}
const Haptics: Context.Tag<Haptics, Haptics>;
```

#### `HapticsOptions` (interface)

Where the haptics service finds pads, the vibrate call and whether this is a touch screen; replaced in
tests.

```ts
interface HapticsOptions {
  readonly getGamepads?: () => readonly (PadLike | null)[];
  /** `navigator.vibrate`, where the browser has it. */
  readonly vibrate?: (pattern: number | number[]) => boolean;
  /** Whether this is a touch screen, which a phone's buzz is for. */
  readonly touch: () => boolean;
}
```

#### `HapticsSettings` (interface)

The player's Vibration setting: whether `Haptics` pulses at all.

```ts
interface HapticsSettings {
  readonly enabled: boolean;
}
```

#### `hapticsSettingsSchema` (const)

On unless saved off; a bad record reads as on, as every settings field falls back.

```ts
const hapticsSettingsSchema: z.ZodType<HapticsSettings, unknown>;
```

#### `Input` (interface)

The input service (M4 spec §4.2): held actions from keys, pads, touch buttons and gestures under the game's
profile and the player's overrides, menu edges, the active device and pads, and rebinding.

```ts
interface Input {
  /** The actions held now, the union over devices, in first-press order. Read once per fixed step; never copied. */
  held(): ReadonlySet<string>;
  /** The active pad's stick, each axis an integer in −127..127, centred inside the deadzone (M4-D2). */
  stick(side: "left" | "right"): {
    readonly x: number;
    readonly y: number;
  };
  /** Menu and pause edges, never sent to the sim. Returns the unsubscribe. */
  onPress(action: MenuAction, listener: () => void): () => void;
  /**
   * Reads the pads; the loop calls it once per fixed step, before `held()`. `nowMs` (the frame or step time)
   * paces the held-direction repeat in menus.
   */
  poll(nowMs?: number): void;
  /** A touch button held or let go, by action. */
  hold(action: string): void;
  release(action: string): void;
  /**
   * Gestures from a `SwipeTracker` (M4.3), as touch: a held gesture holds its actions until released, and a pulse
   * (a flick or a tap) holds them for exactly one sample.
   */
  readonly gesture: GestureSink;
  /** The overlay's move stick (M4.12): while held it is `stick('left')` and drives the `left-*` directions. */
  readonly touchStick: TouchStickSink;
  /** Where a `CameraDragTracker` sends its pixels (M4.12). */
  readonly drag: DragSink;
  /** CSS px dragged to the right between the previous two `poll()`s; 0 unless a live action binds `camera-drag`. */
  cameraDrag(): number;
  /** `play` during gameplay, `menu` while a screen pauses the sim or a modal is open. Releases what is held. */
  setContext(context: InputContextNow): void;
  readonly device: SubscriptionRef.SubscriptionRef<ActiveDevice>;
  readonly profile: SubscriptionRef.SubscriptionRef<InputProfile>;
  /** The pads connected since this Input started, in connection order. */
  readonly pads: SubscriptionRef.SubscriptionRef<readonly PadInfo[]>;
  /**
   * Binds the captured key or pad button to `action` on `device` (M4 spec §4.5, M4-D4), saved in the settings'
   * `input` when the Input has settings; refused, with nothing changed, by `RebindError`.
   */
  rebind(action: string, device: "keyboard" | "gamepad", capture: Capture): Effect.Effect<void, RebindError>;
  /** Every binding back to the game's profile. */
  readonly resetBindings: Effect.Effect<void>;
  /**
   * The next key (`keyboard`) or pad button (`gamepad`) pressed, for `rebind`. Escape or pad B cancels; nothing
   * for `REBIND_TIMEOUT_MS` on Effect's Clock times out. While it waits, every key it sees goes no further, and the
   * pads drive nothing else.
   */
  capture(device: "keyboard" | "gamepad"): Effect.Effect<Capture, RebindCancelled | RebindTimedOut>;
}
const Input: Context.Tag<Input, Input>;
```

#### `INPUT_SETTINGS_DEFAULT` (const)

Nothing changed: the game's profile as it ships.

```ts
const INPUT_SETTINGS_DEFAULT: InputSettings;
```

#### `InputBinding` (interface)

What drives one action: keys by `KeyboardEvent.code` (layout independent), pad buttons, an on-screen button.

```ts
interface InputBinding {
  readonly keys: readonly string[];
  readonly pad: readonly number[];
  readonly touch: boolean;
  readonly stick?: readonly StickDirection[] | undefined;
  readonly gesture?: readonly GestureName[] | undefined;
  /** Rebinding may never leave it unbound on a device it had (M4.4). */
  readonly required?: boolean | undefined;
  /** Default `'play'`. */
  readonly context?: InputContext | undefined;
}
```

#### `InputContext` (type)

Where an action is live: during play, in menus, or both.

```ts
type InputContext = "play" | "menu" | "any";
```

#### `InputContextNow` (type)

What input drives now: `play` (the game's bindings) or `menu` (the menu actions).

```ts
type InputContextNow = "play" | "menu";
```

#### `InputDevice` (type)

A kind of input device.

```ts
type InputDevice = "keyboard" | "gamepad" | "touch";
```

#### `InputOptions` (interface)

What the input service listens to: the window, the game's profile, the bus, and optionally the settings and
the host's input mode.

```ts
interface InputOptions {
  readonly target: Window;
  /** The game's bindings, before the player's overrides. */
  readonly profile: InputProfile;
  readonly bus: PresentationBus;
  /**
   * The game's settings, whose `input` field (`inputSettingsSchema`) holds the player's overrides: they apply at
   * once and on every change, and `rebind` writes them. Without settings a rebind lasts for this Input only.
   */
  readonly settings?: SettingsStore<unknown> | undefined;
  /** Under a host, its input mode (`Hosting.input`): where the active device starts, and a pad it reports. */
  readonly hostInput?: Hosting["input"] | undefined;
}
```

#### `InputProfile` (interface)

A named set of bindings, one per game action (PRODUCT spec §2 F1). It is data: a settings screen rebinds a
copy and saves it in the game's `SettingsDef`; M4's input service reads it. Action ids are the game's own.

```ts
interface InputProfile {
  readonly id: string;
  readonly bindings: Readonly<Record<string, InputBinding>>;
}
```

#### `InputProfileInput` (interface)

What `inputProfileSchema` accepts: every binding field may be left out.

```ts
interface InputProfileInput {
  readonly id: string;
  readonly bindings: Readonly<Record<string, {
    readonly keys?: readonly string[] | undefined;
    readonly pad?: readonly number[] | undefined;
    readonly touch?: boolean | undefined;
    readonly stick?: readonly StickDirection[] | undefined;
    readonly gesture?: readonly GestureName[] | undefined;
    readonly required?: boolean | undefined;
    readonly context?: InputContext | undefined;
  }>>;
}
```

#### `inputProfileSchema` (const)

Validates an input profile, filling left-out binding fields with "unbound". A reserved key or pad button fails
the parse with the action named (M4-D3, I-j): at boot that is a developer error before anything renders.

```ts
const inputProfileSchema: z.ZodType<InputProfile, InputProfileInput>;
```

#### `InputSettings` (interface)

The player's input settings, kept in the game's settings as `input`: the profile, the per-action overrides
and the touch mode.

```ts
interface InputSettings {
  readonly profile: string;
  readonly overrides: Readonly<Record<string, BindingOverride>>;
  /** How touch drives play, when the player chose (M4 spec §4.4). Unset: the game's default. */
  readonly touchMode?: TouchMode | undefined;
}
```

#### `inputSettingsSchema` (const)

The `input` field of a game's settings schema: `{ input: inputSettingsSchema }`. A record that does not read is
the default, as every settings field falls back (`readSettings`); a single bad override is `applyOverrides`'s to
drop, so the player's other bindings survive it.

```ts
const inputSettingsSchema: z.ZodType<InputSettings, unknown>;
```

#### `Leaderboards` (interface)

`Board` is the game's board ids (its ship config's `leaderboards` keys); `string` until a game narrows it.

```ts
interface Leaderboards<Board extends string = string> {
  /** Sends `score` to `board`. Never fails: the result, also published as `leaderboard.submitted`, is the state. */
  submitScore(board: Board, score: number): Effect.Effect<BoardState>;
  /** Reads `board` from the host. Never fails, and never answers from a copy kept here. */
  readBoard(board: Board, query?: BoardQuery): Effect.Effect<BoardView>;
  /** The state of the last submit to `board` (`idle` before one). */
  state(board: Board): BoardState;
}
const Leaderboards: Context.Tag<Leaderboards, Leaderboards>;
```

#### `liveDeviceStorage` (function)

The game frame's own `localStorage` as a device, with `prefix:` before every key so two games on one origin do
not meet. Undefined where merely reaching `window.localStorage` throws (blocked site data, a sandbox): the
settings store then holds device fields for the visit only.

This is the declared stand-in for a host-owned device scope (Ruken request R-6), and a choice per settings field,
not a fallback for a denied `saves` grant.

```ts
function liveDeviceStorage(win: Pick<Window, "localStorage">, prefix: string): DeviceStorage | undefined;
```

#### `Loaded` (interface)

A slot loaded for play.

```ts
interface Loaded<S> {
  readonly slot: number;
  readonly data: S;
  /** Undefined for an empty slot. */
  readonly meta: SlotMeta | undefined;
  /** The sim snapshot, only when it was taken with this build's content (M5-D5). */
  readonly snapshot?: Uint8Array;
}
```

#### `LoadMeter` (interface)

Watches downloads: `guard` fails a wait with `LoadStalled` after `STALL_MS` without progress, and calls its
`onSlow` after `SLOW_MS`.

```ts
interface LoadMeter {
  progress(): void;
  guard<A, E, R>(wait: Effect.Effect<A, E, R>, info: GuardInfo): Effect.Effect<A, E | LoadStalled, R>;
}
```

#### `LoadStalled` (class)

A resource download had no progress reported for STALL_MS (30 s).
Triggers the "Taking a while" screen with a Try again button.

```ts
class LoadStalled extends LoadStalledBase {}
```

#### `Locale` (interface)

The locale service (PRODUCT spec §4): the game's locales, the one text is drawn in now, the player's choice
and the text direction.

```ts
interface Locale {
  /** The game's locales, in its own order (the picker's order). */
  readonly locales: readonly string[];
  readonly baseLocale: string;
  /** The locale text is drawn in now. */
  readonly current: string;
  /** The player's pick: one of `locales`, or null for Automatic (nothing saved, or a saved locale the game dropped). */
  readonly choice: string | null;
  readonly direction: "ltr" | "rtl";
  /** Svelte store contract: called at once with the current locale, then on each change. */
  subscribe(listener: (locale: string) => void): () => void;
  /**
   * The picker's one call: one of `locales`, or null for Automatic. Saved through `Hosting.saves`.
   * A locale the game does not ship throws: the picker only offers `locales`.
   */
  set(choice: string | null): void;
}
const Locale: Context.Tag<Locale, Locale>;
```

#### `LOCALE_SAVE_KEY` (const)

The save key of the player's language choice; absent means Automatic (negotiated).

```ts
const LOCALE_SAVE_KEY = "automata.locale";
```

#### `LocaleCandidates` (interface)

The candidates, best first; each is used only when the game has a matching locale.

```ts
interface LocaleCandidates {
  /** Ruken's `session.locale`, when the session is hosted. Standalone, the SDK's value is the browser's, so it is left out. */
  readonly hosted: string | undefined;
  /** The player's own choice, saved by the language picker. */
  readonly saved: string | undefined;
  /** The browser's languages, best first (`navigator.languages`). */
  readonly browser: readonly string[];
  /** The locales the game ships, in the game's spelling. */
  readonly locales: readonly string[];
  /** The game's default; one of `locales`. */
  readonly baseLocale: string;
}
```

#### `LocaleDef` (interface)

The game's languages. A Paraglide-generated `runtime.js` satisfies it as is
(`import * as runtime from './paraglide/runtime.js'`), and then its messages answer in this locale.

```ts
interface LocaleDef {
  readonly locales: readonly string[];
  readonly baseLocale: string;
  overwriteGetLocale?(fn: () => string): void;
  overwriteSetLocale?(fn: (locale: string) => void): void;
}
```

#### `makeAudio` (const)

Builds the Audio service, which is also the `AudioBuses` seam. Nothing is built until the first gesture after
the session is ready; closing the scope stops every sound, closes the context and removes every listener.

```ts
const makeAudio: (options: AudioServices & AudioOptions) => Effect.Effect<Audio & AudioBuses, never, Scope.Scope>;
```

#### `makeInput` (function)

Builds the Input over `target` for the scope's life: closing the scope removes every listener.

```ts
function makeInput(options: InputOptions): Effect.Effect<Input, never, Scope.Scope>;
```

#### `makeLeaderboards` (const)

Builds the leaderboards service over `Hosting`; each submit's state is published as
`leaderboard.submitted`.

```ts
const makeLeaderboards: Effect.Effect<Leaderboards, never, Hosting | PresentationBus>;
```

#### `makeSaves` (function)

Opens the game's save for boot, with its triggers and its exit flush, for as long as the scope is open. A game
without `saves` gets a `Saves` that holds nothing, and nothing is read from the host.

```ts
function makeSaves(def: SaveDef<unknown> | undefined, options: {
  readonly contentHash: string;
}): Effect.Effect<Saves, HostError, Hosting | PresentationBus | Scope.Scope>;
```

#### `matchLocale` (function)

The game's locale for a requested tag: the same tag (ignoring case), else the first locale with the same
primary language subtag. `fr-CA` finds `fr`; `pt` finds `pt-BR`. Undefined when the game lacks the language.

```ts
function matchLocale(requested: string, locales: readonly string[]): string | undefined;
```

#### `MAX_FRAME_MS` (const)

The Last Light clock.ts 0.1 s clamp: at most 6 steps at 60 Hz, the rest is dropped

```ts
const MAX_FRAME_MS = 100;
```

#### `MAX_TURN_UNITS_PER_STEP` (const)

The most one step's `camera-turn` may carry either way: 45°.

```ts
const MAX_TURN_UNITS_PER_STEP = 8192;
```

#### `MenuAction` (type)

A fixed menu action: it drives menus and the pause screen, never the sim.

```ts
type MenuAction = "nav-up" | "nav-down" | "nav-left" | "nav-right" | "confirm" | "back" | "page-prev" | "page-next" | "adjust-dec" | "adjust-inc" | "pause";
```

#### `MessageFunction` (type)

One compiled message: Paraglide passes its inputs as one object.

```ts
type MessageFunction = (inputs?: any) => string;
```

#### `ModelInvalid` (class)

A 3D model file could not be read (M3 spec §6): malformed, of an unknown type, not loaded, or a glTF with a skin,
which is not supported yet (M3R-D1). Boot shows the panel naming the file, with Try again.

```ts
class ModelInvalid extends ModelInvalidBase {}
```

#### `MusicOptions` (interface)

Options for `Audio.music`: where to begin and which region loops.

```ts
interface MusicOptions {
  /** Where in the track to begin, in seconds. */
  readonly fromSeconds?: number;
  /** The region that loops, in seconds; the whole track without it. */
  readonly loop?: {
    readonly start: number;
    readonly end: number;
  };
}
```

#### `negotiateLocale` (function)

The order is the player's saved choice, Ruken's session locale, the browser's languages, the default
(PRODUCT spec §4 item 2, as decided 2026-10-16: a choice made in the game's own picker outranks the
platform's, as in FloorFifty, where detection runs only "when the player has not chosen one").
Each step that names a language the game lacks falls through to the next.

```ts
function negotiateLocale(candidates: LocaleCandidates): string;
```

#### `NetworkPort` (interface)

The networking seam (PRODUCT spec §2 F1): remote commands in, authoritative snapshots out. The sim already
takes `Command`s and restores snapshot bytes, so the port carries exactly those; the wire format, rooms,
prediction and reconciliation belong to whatever implements it (Plus `net`, M7) or to the game.

An authority listens with `onRemoteCommand` and answers with `publishSnapshot`; a client sends with
`sendCommand` and listens with `onSnapshot`. One implementation may serve either role.

Commands cross the port every tick, so its members are plain callbacks rather than Effects (ADR 0003: no
Effect allocation per frame). Sends never throw: a transport failure is the implementation's to report
(for example as a presentation-bus fact), never a silent switch to another path. Each `on*` returns its
unsubscribe; a listener removed, or registered after the port's scope closed, receives nothing.
The `NetworkPort` service tag. Core provides no implementation; an extension or the game provides one.

```ts
interface NetworkPort {
  /** Each command a remote peer sent, in arrival order, as the sim's own `Command`. */
  onRemoteCommand(listener: (command: Command) => void): () => void;
  /** Sends one local command to the authority. */
  sendCommand(command: Command): void;
  /** The authority publishes its state after a step. */
  publishSnapshot(snapshot: AuthoritativeSnapshot): void;
  /** Each authoritative snapshot received, in arrival order. */
  onSnapshot(listener: (snapshot: AuthoritativeSnapshot) => void): () => void;
}
const NetworkPort: Context.Tag<NetworkPort, NetworkPort>;
```

#### `PadInfo` (interface)

A connected pad. Only `standard` pads drive bindings (DX spec §3.3).

```ts
interface PadInfo {
  readonly index: number;
  readonly id: string;
  readonly standard: boolean;
}
```

#### `ParaglideRuntime` (interface)

The parts of a Paraglide-generated `runtime.js` the runtime uses. Method syntax, so a narrower `Locale` union fits.

```ts
interface ParaglideRuntime {
  readonly locales: readonly string[];
  readonly baseLocale: string;
  overwriteGetLocale(fn: () => string): void;
  overwriteSetLocale(fn: (locale: string) => void): void;
}
```

#### `PauseReason` (type)

`input`: the active pad was unplugged during play (M4-D9); Resume on the pause screen clears it. `display`: a phone
is held the other way from the game's orientation (M4.7); turning it back clears it.

```ts
type PauseReason = "lifecycle" | "menu" | "input" | "display";
```

#### `pluralCategory` (const)

The CLDR plural (or, with 'ordinal', ordinal) category of a count: one, two, few, many, zero or other.

```ts
const pluralCategory: (locale: string, count: number, type?: Intl.PluralRuleType) => Intl.LDMLPluralRule;
```

#### `PresentationBus` (interface)

The presentation bus: typed facts the runtime publishes for screens, audio and tests to hear. Facts
describe what happened; they never change gameplay state.

```ts
interface PresentationBus<Facts = RuntimeFacts> {
  publish<K extends keyof Facts & string>(name: K, fact: Facts[K]): void;
  subscribe<K extends keyof Facts & string>(name: K, listener: (fact: Facts[K]) => void): () => void;
}
const PresentationBus: Context.Tag<PresentationBus, PresentationBus>;
```

#### `QUALITY_TIERS` (const)

Graphics quality (M4 spec §4.11). A lower tier caps the canvas resolution and leaves out the post-filter owners
registered for a higher one; it never drops the art direction. The one owner of the tier: render-pixi and the
Settings screen's Display section read it from here.

```ts
const QUALITY_TIERS: readonly ["high", "medium", "low"];
```

#### `QualityTier` (type)

A graphics quality tier: `high`, `medium` or `low`.

```ts
type QualityTier = (typeof QUALITY_TIERS)[number];
```

#### `qualityTierSchema` (const)

A tier; an unknown saved value reads as the default, as every settings field falls back.

```ts
const qualityTierSchema: z.ZodType<QualityTier, unknown>;
```

#### `REBIND_TIMEOUT_MS` (const)

How long `capture` waits for a press (M4 spec §4.2, §6).

```ts
const REBIND_TIMEOUT_MS = 1e4;
```

#### `RebindCancelled` (class)

The player pressed Escape or pad B while a capture waited: nothing changes.

```ts
class RebindCancelled extends RebindCancelledBase {}
```

#### `RebindConflict` (class)

Refused: the input would leave `with`, a required action, with nothing on that device (M4-D4).

```ts
class RebindConflict extends RebindConflictBase {}
```

#### `RebindError` (type)

Why a rebind was refused, with nothing changed.

```ts
type RebindError = RebindConflict | RebindReserved | RebindUnknown;
```

#### `rebindProfile` (function)

Binds `capture` to `action` on `device` (M4 spec §4.5, M4-D4): it becomes the action's only input there and
leaves every other action live in an overlapping context. Refused, with nothing changed, when the input is
reserved or when it would leave a `required` action with nothing on that device. The result is the overrides
over `defaults` for the whole profile, ready to save.

```ts
function rebindProfile(defaults: InputProfile, current: InputProfile, action: string, device: "keyboard" | "gamepad", capture: Capture): Either.Either<Record<string, BindingOverride>, RebindError>;
```

#### `RebindReserved` (class)

Refused: Escape, Tab, pad 8 or pad 16 (M4-D3), or a pad button the standard mapping does not have.

```ts
class RebindReserved extends RebindReservedBase {}
```

#### `RebindTimedOut` (class)

Nothing was pressed for `REBIND_TIMEOUT_MS`: nothing changes.

```ts
class RebindTimedOut extends RebindTimedOutBase {}
```

#### `RebindUnknown` (class)

Refused: the profile has no such action.

```ts
class RebindUnknown extends RebindUnknownBase {}
```

#### `Renderer` (const)

The game's renderer as a runtime service.

```ts
const Renderer: Context.Tag<GameRenderer, GameRenderer>;
```

#### `RendererFactory` (type)

Builds the game's renderer for a target. It fails with `RendererUnavailable` when no backend it accepts starts,
and with `ModelInvalid` when a 3D renderer cannot read a model file it was given (M3 spec §6).

```ts
type RendererFactory = (target: RenderTarget) => Effect.Effect<GameRenderer, RendererUnavailable | ModelInvalid, Scope.Scope>;
```

#### `RendererUnavailable` (class)

Neither WebGL2 nor WebGPU could be initialized.
In Ruken this presents the "unsupported" screen with an exit button.

```ts
class RendererUnavailable extends RendererUnavailableBase {}
```

#### `RenderTarget` (interface)

Where a renderer draws: the host element, the layout geometry, the loaded assets and the presentation bus.

```ts
interface RenderTarget {
  readonly host: HTMLElement;
  readonly geometry: GeometryOwner;
  readonly assets: Pick<Assets, "get">;
  /** The runtime's presentation bus, for render facts such as `render.filter.dropped`. Optional for tests and tools. */
  readonly bus?: PresentationBus | undefined;
  /**
   * Shows the "picture stopped" panel with Try again, for a renderer whose graphics context is lost and will not
   * come back by itself (M3 spec §5): Try again closes the panel and calls `retry`, which rebuilds the renderer from
   * the sim's current state. Returns a function that closes the panel. Optional for tests and tools.
   */
  readonly reportLost?: ((retry: () => void) => () => void) | undefined;
}
```

#### `RESERVED_KEYS` (const)

Keys never bindable in a game's profile: Escape (the one back path) and Tab (focus).

```ts
const RESERVED_KEYS: readonly string[];
```

#### `RESERVED_PAD_BUTTONS` (const)

Never bindable in a game's profile (M4-D3): Ruken's SDK summons the host on pad 8 (View), 16 is Home, Escape is the
one back path and Tab moves focus.

```ts
const RESERVED_PAD_BUTTONS: readonly number[];
```

#### `RotateHintMode` (type)

How a game locked to one orientation says so (Owner amendment, 2026-10-18): a blocking cover, or a toast.

```ts
type RotateHintMode = "block" | "toast";
```

#### `runGame` (function)

Boots and runs the game in a runtime Scope (spec §4 Failure and Shutdown).

Each attempt runs in a fresh Scope. On failure, mounts BootFailurePanel and keeps
the attempt scope open so Back to {host} can access its Hosting service. Try again
and Continue without loading close the failed attempt scope and re-run bootProgram
in a fresh Scope on the same root without reloading the page. Inside a Ruken session,
Try again reloads the game's frame instead: `@ruken/sdk-host` answers one hello per
frame load, so a second session in this load would never be welcomed (RT.BOOT1).

RuntimeHandle.shutdown() closes the runtime scope, running all finalizers in LIFO order.

```ts
function runGame<S>(game: GameDefinition<S>): RuntimeHandle;
```

#### `RuntimeFacts` (interface)

Every fact the runtime publishes on the presentation bus, by name.

```ts
interface RuntimeFacts {
  readonly "sim.events": readonly SimEvent[];
  readonly "screen.entered": {
    readonly screen: string;
    readonly from: string | undefined;
  };
  readonly "time.changed": {
    readonly paused: boolean;
  };
  /** The player's language changed (PRODUCT spec §4 item 2). Screens redraw their text; nothing remounts. */
  readonly "locale.changed": {
    readonly locale: string;
    readonly previous: string;
  };
  /** The player's last real input came from another device (M4 spec §4.2). Prompts and touch controls follow it. */
  readonly "input.device.changed": {
    readonly device: InputDevice;
    readonly glyphs: GlyphFamily;
    readonly previous: InputDevice;
  };
  /** The first gesture after `session.ready` built and resumed the audio graph (M5 spec §4.6). */
  readonly "audio.unlocked": Readonly<Record<never, never>>;
  /** No audio context could be built or resumed; the game runs silent (M5 spec §6). */
  readonly "audio.unavailable": {
    readonly reason: string;
  };
  /** A sound or a track could not be loaded or decoded; it is silent and nothing else stops (M5 spec §6). */
  readonly "audio.decode.failed": {
    readonly alias: string;
    readonly reason: string;
  };
  /** A pad was plugged in (M4 spec §5). `standard: false` means it cannot drive bindings (§6). */
  readonly "input.pad.connected": PadInfo;
  /** A pad was unplugged; what it held is released (M4 spec §5). `wasActive`: it was the pad in use. */
  readonly "input.pad.disconnected": PadInfo & {
    readonly wasActive: boolean;
  };
  /** The player's bindings changed (M4 spec §4.5): `action` when one was rebound, none on a reset or a follow. */
  readonly "input.bindings.changed": {
    readonly action?: string;
  };
  /** A post filter could not be built or compiled and was left out; the frame draws without it (M4 spec §6). */
  readonly "render.filter.dropped": {
    readonly id: string;
    readonly reason: string;
  };
  /** The WebGL context was lost; the renderer draws nothing until it is restored (M3 spec §5). */
  readonly "render.context.lost": Readonly<Record<never, never>>;
  /**
   * The WebGL context came back (M3 spec §5): Pixi re-uploads its GPU resources and the renderer draws again; the
   * views and the sim are untouched.
   */
  readonly "render.context.restored": Readonly<Record<never, never>>;
  /** A slot's save reached the host (M5 spec §4.3). `key` is the save's prefix (`SaveDef.key`). */
  readonly "save.written": {
    readonly key: string;
    readonly slot: number;
  };
  /** The host refused a slot's write; the slot keeps its previous value (M5 spec §4.3, §6). */
  readonly "save.failed": {
    readonly key: string;
    readonly slot: number;
    readonly code: ErrorCode;
  };
  /** A slot was loaded for play (M5 spec §5, "Load a slot"). */
  readonly "save.loaded": {
    readonly key: string;
    readonly slot: number;
  };
  /**
   * Another device changed the slot being played (M5 spec §5, M5-D6). Nothing was reloaded; the game offers Load
   * newer or Keep playing.
   */
  readonly "save.changedElsewhere": {
    readonly key: string;
    readonly slot: number;
  };
  /** A submit to `board` changed state: `submitting`, then how the host answered (M5 spec §4.8). */
  readonly "leaderboard.submitted": {
    readonly board: string;
    readonly state: BoardState;
  };
}
```

#### `RuntimeHandle` (interface)

Controls the running game: shutdown closes the runtime scope (spec §3.3, planning note 11).

```ts
interface RuntimeHandle {
  shutdown(): Promise<void>;
}
```

#### `RuntimeSeams` (interface)

Test seams injected into the runtime boot program (spec §3.3, planning note 10).

```ts
interface RuntimeSeams {
  readonly fetch?: typeof fetch;
  readonly frames?: FrameSource;
  readonly fonts?: Pick<FontFaceSet, "load">;
  readonly sdkEnv?: () => NonNullable<HostingSeams["env"]>;
  readonly document?: Document;
  /** The browser's languages, best first; defaults to `navigator.languages`. */
  readonly languages?: readonly string[];
  /** Builds the audio context on the unlock; defaults to `new AudioContext()`. */
  readonly createAudioContext?: () => AudioContextLike;
  /** The device's haptics, in place of the browser's (pads, `navigator.vibrate`, a coarse pointer). */
  readonly haptics?: Haptics;
  /** Where settings fields that belong to the device are kept; defaults to the frame's `localStorage` (M5 spec §4.5). */
  readonly deviceStorage?: DeviceStorage;
  /**
   * Hears what failed, after the runtime has shown it as usual: a boot failure's `BootError`, why a screen could not
   * load or enter, or what a running sim's step threw. Each Try again can fail again, so it can be called more than
   * once. A throw from it is ignored. The playground reports the line in the reader's code from it (website
   * playground spec §7.2).
   */
  readonly onFailure?: (cause: unknown) => void;
  /**
   * Reloads the game's frame: what Try again does after a boot failure inside a Ruken session, where the host answers
   * one hello per frame load (M1 runtime spec §4, RT.BOOT1). Defaults to reloading the document's location.
   */
  readonly reload?: () => void;
}
```

#### `RuntimeServices` (type)

The runtime services a screen's `enter` may use.

```ts
type RuntimeServices = Hosting | PresentationBus | Time | Flow | Settings | Saves | AppLoop | Assets | GameRenderer | Locale | Audio | AudioBuses | Leaderboards | Haptics;
```

#### `Save` (interface)

A game's save (M5 spec §4.3): its slots' states, load, write and remove, and the progress `touch` keeps for
the autosave triggers to write.

```ts
interface Save<S> {
  /** Every slot's state, in slot order. */
  readonly slots: Subscribable.Subscribable<readonly SlotState[]>;
  /** The slot being played: the last one `load` returned. Undefined before the first load. */
  readonly loaded: Subscribable.Subscribable<number | undefined>;
  /**
   * Reads a slot and makes it the one being played. Progress `touch`ed before is dropped: it came from the game this
   * load replaces, and must not be written over what was just read.
   */
  load(slot: number): Effect.Effect<Loaded<S>, SaveUnreadable | SaveFromNewerBuild | HostError>;
  write(slot: number, data: S, options?: SaveWriteOptions): Effect.Effect<void, SaveRefused | HostError>;
  remove(slot: number): Effect.Effect<void, HostError>;
  /**
   * Says the loaded slot's progress changed and what it is now. A plain function, safe to call every tick: it only
   * keeps `data`, and the next autosave trigger writes it. With no slot loaded it keeps nothing.
   */
  touch(data: () => S): void;
  /**
   * Writes the progress `touch` has kept for every slot that still has some, now, whatever the autosave policy
   * (an exit must not lose progress because `on` left out a trigger). It still never writes a slot whose state
   * is not `ready` or `empty` (a newer build's, a damaged one, one loaded with other content), nor the slot
   * another device changed while it was played, until the player answers: that progress stays kept (Keep
   * playing releases it; Load newer and any other load drop it). It never fails, because it runs inside the host's exit; a refused write is the `save.failed`
   * fact, and the progress stays kept for the next flush.
   */
  readonly flushPending: Effect.Effect<void>;
  /**
   * What a trigger calls: `flushPending` if the save's policy lists `trigger`, otherwise nothing. `saveService`
   * already wires every trigger to its source; this is for a game that raises one itself.
   */
  autosave(trigger: AutosaveTrigger): Effect.Effect<void>;
  /**
   * True while the loaded slot holds something another device wrote after it was loaded (M5-D6). Nothing is
   * reloaded, and no trigger writes that slot over the other device's until the player answers. Lowered by
   * `keepPlaying`, `loadNewer` or any load.
   */
  readonly changedElsewhere: Subscribable.Subscribable<boolean>;
  /** Loads the loaded slot again, so the game plays what the other device wrote. Dies when nothing is loaded. */
  loadNewer(): Effect.Effect<Loaded<S>, SaveUnreadable | SaveFromNewerBuild | HostError>;
  /** The player chose to carry on: lowers `changedElsewhere`. The next trigger writes the progress kept over the other device's, as any write would. */
  keepPlaying(): void;
}
```

#### `SaveDef` (interface)

A game's save: one record, or a fixed number of slots, each one Ruken key.

```ts
interface SaveDef<S> {
  /** The key prefix. Ruken's key rule is the SDK's, which checks it on write. */
  readonly key: string;
  /** This build's version of the data, an integer from 1. */
  readonly version: number;
  readonly schema: z.ZodType<S>;
  /** What an empty slot loads as. */
  readonly empty: () => S;
  /** `migrations[n]` turns version `n` data into version `n + 1`. */
  readonly migrations: Readonly<Record<number, SaveMigration>>;
  /** Absent: one record, slot 0, stored at `key`. */
  readonly slots?: {
    readonly count: number;
  };
  /** Absent: save on `screen-exit`, `round-end` and `background`, with no timer (M5-D10). `{ on: [] }` turns it off. */
  readonly autosave?: AutosavePolicy;
}
```

#### `SaveEnvelope` (interface)

What is stored: a self-describing envelope, one Ruken key per slot.

```ts
interface SaveEnvelope {
  readonly format: 1;
  readonly version: number;
  /** The sim content hash at save time (M2.2). */
  readonly contentHash: string;
  /** Effect `Clock` epoch ms, for the slot list; outside the sim. */
  readonly savedAt: number;
  readonly label?: string;
  readonly data: Record<string, unknown>;
  /** An optional sim snapshot, base64 (M5-D5). */
  readonly snapshot?: string;
}
```

#### `SaveFromNewerBuild` (class)

A slot was saved by a newer build. It is read-only here: nothing migrates, writes or autosaves over it.

```ts
class SaveFromNewerBuild extends SaveFromNewerBuildBase {}
```

#### `SaveFromNewerBuildFields` (interface)

The fields of `SaveFromNewerBuild`.

```ts
interface SaveFromNewerBuildFields {
  readonly key: string;
  readonly slot: number;
  /** The version the newer build stored. */
  readonly version: number;
}
```

#### `SaveMigration` (type)

One migration step of a save: version `n` data in, version `n + 1` data out (`SaveDef.migrations`).

```ts
type SaveMigration = (record: Record<string, unknown>) => Record<string, unknown>;
```

#### `saveOf` (function)

Returns the booted save when `def.key` matches.
Dies with a defect if the game booted a different save, or none: asking for a save the game never declared is
the game's mistake (as `settingsStore` does for settings).

```ts
function saveOf<S>(def: SaveDef<S>): Effect.Effect<Save<S>, never, Saves>;
```

#### `SaveRefused` (class)

A write AF refuses on its own: over a save from a newer build (M5 spec §4.3).

```ts
class SaveRefused extends SaveRefusedBase {}
```

#### `SaveRefusedFields` (interface)

The fields of `SaveRefused`.

```ts
interface SaveRefusedFields {
  readonly key: string;
  readonly slot: number;
  /** Why AF refused before asking the host. Everything else is the host's to refuse, relayed as a `HostError`. */
  readonly reason: "newer";
}
```

#### `Saves` (interface)

The booted game's save as a runtime service (M5 spec §4.3), as `Settings` is for settings: its key and the
`Save`, both undefined for a game without saves.

```ts
interface Saves {
  /** The booted save's key prefix; undefined for a game without saves. */
  readonly key: string | undefined;
  readonly save: Save<unknown> | undefined;
}
const Saves: Context.Tag<Saves, Saves>;
```

#### `saveService` (function)

Opens a game's save slots: reads the slot list from the host, then loads, writes and removes slots.

```ts
function saveService<S>(def: SaveDef<S>, options: SaveServiceOptions): Effect.Effect<Save<S>, HostError, Hosting | PresentationBus | Scope.Scope>;
```

#### `SaveServiceOptions` (interface)

What the save service stamps on every write and checks on every load.

```ts
interface SaveServiceOptions {
  /** The build's sim content hash (`GameDefinition.content.hash`), stamped on each write and compared on load. */
  readonly contentHash: string;
}
```

#### `SaveUnreadable` (class)

A slot's save cannot be read: a damaged envelope, a missing or throwing migration step, or data its schema refuses
(M5 spec §6). The slot is kept untouched; only an explicit write replaces it.

```ts
class SaveUnreadable extends SaveUnreadableBase {}
```

#### `SaveUnreadableFields` (interface)

The fields of `SaveUnreadable`.

```ts
interface SaveUnreadableFields {
  /** The save's key prefix (`SaveDef.key`). */
  readonly key: string;
  readonly slot: number;
  readonly reason: string;
}
```

#### `SaveWriteOptions` (interface)

Options for `Save.write`: the slot's label on the list, and a sim snapshot to keep with the data.

```ts
interface SaveWriteOptions {
  readonly label?: string;
  readonly snapshot?: Uint8Array;
}
```

#### `ScreenContext` (interface)

What a screen's `enter` is given: the layer to mount into, and the screen it came from.

```ts
interface ScreenContext {
  readonly layer: HTMLElement;
  readonly from: string | undefined;
  /**
   * The scope of what a game keeps across screens, such as the sim the default screens share (DX.2c). Every screen
   * of a run gets the same one. It is a child of the runtime scope, not the runtime scope itself. It stays open
   * through every transition and closes once, when the runtime shuts down or a failed boot is tried again: after the
   * current screen's scope and the save's last flush, which may still read what it holds, and before the renderer is
   * destroyed and Hosting closes.
   */
  readonly runtime: Scope.Scope;
}
```

#### `ScreenDef` (interface)

One screen of the flow: its id, whether it pauses the sim, its kind and fonts, and `enter`, which mounts it
in its scope (closing the scope leaves the screen).

```ts
interface ScreenDef<R = never> {
  readonly id: string;
  readonly pausesSim?: boolean;
  /** `gameplay` lets the cursor policy hide an idle pointer; a `menu` (the default) never does (M4 spec §4.7). */
  readonly kind?: "menu" | "gameplay";
  readonly fonts?: readonly string[];
  enter(context: ScreenContext): Effect.Effect<void, unknown, Scope.Scope | RuntimeServices | R>;
  openMenu?(): boolean;
}
```

#### `selectPlural` (function)

The form for a count. A category the caller did not give falls back to `other`, which is required.

```ts
function selectPlural(locale: string, count: number, forms: Partial<Record<Intl.LDMLPluralRule, string>> & {
  readonly other: string;
}): string;
```

#### `Settings` (interface)

The booted game's settings as a runtime service: its key and store, both undefined for a game without
settings.

```ts
interface Settings {
  readonly key: string | undefined;
  readonly store: SettingsStore<unknown> | undefined;
}
const Settings: Context.Tag<Settings, Settings>;
```

#### `SettingsDef` (interface)

A game's settings: the key it is saved under, its version, schema, defaults and migration steps, and which
fields stay on one device.

```ts
interface SettingsDef<S> {
  readonly key: string;
  readonly version: number;
  readonly schema: z.ZodType<S>;
  readonly defaults: S;
  readonly migrations?: Readonly<Record<number, (record: Record<string, unknown>) => Record<string, unknown>>>;
  /**
   * Fields that belong to one device: kept in its `DeviceStorage`, never in the player's saves, and the saves'
   * copy is never read (M5 spec §4.5). The rest of the record is the player's, as for any settings. Names, not
   * `keyof S`, so a `SettingsDef<S>` stays assignable where `SettingsDef<unknown>` is wanted; `makeSettings`
   * refuses a name the defaults do not have.
   */
  readonly deviceFields?: readonly string[];
}
```

#### `SettingsStore` (interface)

A game's settings value: read it, subscribe to changes, and update it (each update is saved).

```ts
interface SettingsStore<S> {
  get(): S;
  subscribe(listener: (value: S) => void): () => void;
  update(change: (value: S) => S): void;
}
```

#### `settingsStore` (function)

Returns the booted settings store when def.key matches.
Dies with a defect if requested key does not match booted key (planning note 7).

```ts
function settingsStore<S>(def: SettingsDef<S>): Effect.Effect<SettingsStore<S>, never, Settings>;
```

#### `SlotMeta` (interface)

A slot's header, read without migrating it.

```ts
interface SlotMeta {
  readonly version: number;
  readonly contentHash: string;
  readonly savedAt: number;
  readonly label?: string;
  /** Whether the save carries a sim snapshot. */
  readonly snapshot: boolean;
}
```

#### `SlotState` (type)

What a slot holds, as the slot list shows it (M5 spec §4.3, §6).

```ts
type SlotState = {
  readonly kind: "empty";
  readonly slot: number;
} | {
  readonly kind: "ready";
  readonly slot: number;
  readonly meta: SlotMeta;
} | {
  readonly kind: "unreadable";
  readonly slot: number;
  readonly reason: string;
} | {
  readonly kind: "newer";
  readonly slot: number;
  readonly version: number;
} | {
  readonly kind: "other-content";
  readonly slot: number;
  readonly meta: SlotMeta;
};
```

#### `SLOW_MS` (const)

After this long, in ms, a download still running is reported slow (the loader says so).

```ts
const SLOW_MS = 8e3;
```

#### `SoundOptions` (interface)

Options for `Audio.sound`: the bus (default `sfx`), a gain and a playback rate.

```ts
interface SoundOptions {
  /** `sfx` by default. */
  readonly bus?: AudioBusName;
  readonly gain?: number;
  readonly rate?: number;
}
```

#### `STALL_MS` (const)

A download that makes no progress for this long, in ms, fails `LoadStalled`.

```ts
const STALL_MS = 3e4;
```

#### `STANDARD_PAD_BUTTON_MAX` (const)

The highest button index of the W3C Gamepad standard mapping (0 = bottom face button … 16 = home). Only the
standard mapping is bound (DX spec §3.3); a pad without it is the device layer's to normalize.

```ts
const STANDARD_PAD_BUTTON_MAX = 16;
```

#### `StickDirection` (type)

A stick pushed past its dead zone in one direction (M4.2 reads them).

```ts
type StickDirection = (typeof STICK_DIRECTIONS)[number];
```

#### `SwipeIndicator` (interface)

What a swipe indicator draws: the anchor, the thumb, and whether the thumb is steering.

```ts
interface SwipeIndicator {
  readonly anchor: {
    readonly x: number;
    readonly y: number;
  };
  readonly thumb: {
    readonly x: number;
    readonly y: number;
  };
  /** Outside the dead zone on either axis. */
  readonly steering: boolean;
}
```

#### `SwipeTracker` (class)

Turns pointer samples into held swipes, flicks and taps for a `GestureSink` (M4 spec §4.4); it reads no
clock and touches no DOM.

```ts
class SwipeTracker {
  private readonly sink;
  readonly tuning: GestureTuning;
  private readonly fingers;
  private steerer;
  private readonly anchor;
  private readonly thumb;
  private readonly direction;
  constructor(sink: GestureSink, tuning?: Partial<GestureTuning>);
  /** Where the thumb indicator draws, or undefined while no finger steers. */
  get indicator(): SwipeIndicator | undefined;
  /** A finger landed. The first one that may steer steers; every one may flick or tap. */
  down(id: number, x: number, y: number, t: number, options?: {
    readonly steers?: boolean;
  }): void;
  /** A finger moved: look for a downward flick, and steer if it is the steerer. */
  move(id: number, x: number, y: number, t: number): void;
  /** A finger lifted: a tap if it was quick and still; stop steering if it steered. */
  up(id: number, _x: number, _y: number, t: number): void;
  /** The browser took the pointers (pointercancel, lost capture of every finger): release everything. */
  cancel(): void;
  private steer;
  private stopSteering;
  private setDirection;
}
```

#### `textDirection` (function)

Text direction from the locale's script: the explicit script subtag, else the likely one CLDR adds
(`ar` → `Arab`). Read from `Intl.Locale#maximize`, not `getTextInfo`, which not every engine has, so
every engine gives the same answer.

```ts
function textDirection(locale: string): "ltr" | "rtl";
```

#### `Time` (interface)

The time service: whether the sim is paused, and why; each reason pauses until it is resumed.

```ts
interface Time {
  readonly paused: boolean;
  readonly reasons: ReadonlySet<PauseReason>;
  pause(reason: PauseReason): void;
  resume(reason: PauseReason): void;
}
const Time: Context.Tag<Time, Time>;
```

#### `TouchMode` (type)

How touch drives play: the on-screen buttons, or swipes and flicks over the whole screen (M4 spec §4.4).

```ts
type TouchMode = "buttons" | "swipe";
```

#### `touchModesFor` (function)

The touch modes a profile offers: `buttons` when an action binds `touch`, `swipe` when one binds a swipe, flick or
tap. The camera drag works beside the buttons, so it offers no mode of its own.

```ts
function touchModesFor(profile: InputProfile): TouchMode[];
```

#### `TouchStickSink` (interface)

Where the overlay's move stick goes: a vector clamped to length 1, y positive down, as a pad's axes.

```ts
interface TouchStickSink {
  set(x: number, y: number): void;
  release(): void;
}
```

#### `Translate` (type)

The typed `t` verb: `t('hello', { name })`, checked against the game's compiled messages.

```ts
type Translate<Messages> = <K extends keyof Messages & string>(key: K, ...inputs: InputsOf<Messages[K]>) => string;
```

#### `TURN_UNITS_PER_TURN` (const)

Turn units in a full turn: the heading wraps here.

```ts
const TURN_UNITS_PER_TURN = 65536;
```

#### `turnUnitsFromPixels` (function)

`dxPx` dragged at `degPerPixel` as whole turn units: positive for a drag to the right (which way that turns the
heading is the game's convention), negated when `invert`, clamped to ±`MAX_TURN_UNITS_PER_STEP`. Halves round away
from zero, so a drag left and the same drag right are the same size. A non-finite input or a `degPerPixel` that is
not positive gives 0, and the result is never −0.

```ts
function turnUnitsFromPixels(dxPx: number, degPerPixel: number, invert: boolean): number;
```

#### `typedBus` (function)

Cast a PresentationBus instance to a typed view with game-specific fact types.
Safe because PresentationBus stores facts dynamically by string key.

```ts
function typedBus<GameFacts>(bus: PresentationBus<object>): PresentationBus<GameFacts>;
```

### `import { … } from '@mcthaydt/automata-runtime/extension'`

#### `defineExtension` (function)

Returns its argument. It exists so the name keeps its literal type and `pnpm style` can find extensions.

```ts
function defineExtension<const N extends string>(def: ExtensionDef<N>): ExtensionDef<N>;
```

#### `ExtensionDef` (interface)

One opt-in feature of a game (M1 shared contracts §2). Build it with `defineExtension`.

```ts
interface ExtensionDef<Name extends string = string> {
  /** Kebab-case and unique. */
  readonly name: Name;
  /** Names of other extensions that must come first. */
  readonly requires?: readonly string[];
  /** `definePlugin` results; they pass the determinism checker. */
  readonly sim?: readonly PluginDef[];
  /** `defineContentSchema` results. */
  readonly content?: readonly ContentSchemaDef[];
  /** Effect services the extension provides. They cannot fail at construction. */
  readonly layers?: Layer.Layer<any, never, any>;
  /** Components for the named ui slots. An extension fills the slots it wants, and cannot add a slot. */
  readonly ui?: {
    readonly slots?: Readonly<Partial<Record<UiSlotName, UiComponent>>>;
  };
  /** Called at build time with the game's manifest facts. */
  readonly manifest?: (config: GameConfig) => RukenManifestContribution;
}
```

#### `ExtensionError` (class)

A bad extension list. Thrown, not returned, so a game's Vite build fails with `message`.

```ts
class ExtensionError extends ExtensionErrorBase {
  override get message(): string;
}
```

#### `GameConfig` (type)

The parts of Ruken's manifest an extension may read (`@ruken/manifest` `Manifest`, never copied).

```ts
type GameConfig = Pick<Manifest, "game" | "runtime" | "content">;
```

#### `ResolvedExtensions` (interface)

Everything the runtime and the build tools need from a game's extension list, in one fixed order.

```ts
interface ResolvedExtensions {
  /** Extension names: `requires` first, ties by name. */
  readonly order: readonly string[];
  /** In extension order; the game passes them to `createSim`. */
  readonly simPlugins: readonly PluginDef[];
  /** For the content Vite plugin's `schemas`. */
  readonly contentSchemas: readonly ContentSchemaDef[];
  /** Every extension's layers, merged in order. Each layer may use the services of those before it. */
  readonly layer: Layer.Layer<any, never, any>;
  /** Every extension's component for that slot, in order. */
  slots(name: UiSlotName): readonly UiComponent[];
  /** The contributions merged: preload lists concatenated, a repeated path keeps its first place. */
  manifest(config: GameConfig): RukenManifestContribution;
}
```

#### `resolveExtensions` (function)

Checks the list and puts it in a fixed order. Throws `ExtensionError`, synchronously, so a game's
Vite config fails the build with the message. At run time the build has already resolved the same
list, so a throw there is a defect.

```ts
function resolveExtensions(defs: readonly ExtensionDef[]): ResolvedExtensions;
```

#### `RukenManifestContribution` (type)

What an extension may add to ruken.toml in M1: preload files. `wants` is not a manifest field (Q7).

```ts
type RukenManifestContribution = {
  readonly loading?: {
    readonly preload?: readonly string[];
  };
};
```

### `import { … } from '@mcthaydt/automata-runtime/testing'`

#### `FakeAudioContext` (interface)

A recording stand-in for an `AudioContext`: what was started, stopped and automated, with a clock tests
move by hand.

```ts
interface FakeAudioContext extends AudioContextLike {
  state: AudioContextLike["state"];
  currentTime: number;
  readonly gains: FakeGainNode[];
  readonly started: Started[];
  readonly stopped: Array<{
    readonly alias: string;
    readonly when: number;
  }>;
  readonly resumed: number;
  readonly closed: boolean;
  /** Moves the clock on, ending every source whose stop time it passes. */
  advance(seconds: number): void;
  /** As the system does for a phone call or Siri. */
  interrupt(): void;
  /** Ends a source as if it played out. */
  end(alias: string): void;
}
```

#### `fakeAudioContext` (function)

`decode` turns the bytes `decodeAudioData` receives into a buffer, or throws as the browser does for bytes that
are not audio; by default the bytes are the alias's UTF-8 text.

```ts
function fakeAudioContext(decode?: (bytes: ArrayBuffer) => AudioBuffer): FakeAudioContext;
```

#### `fakeBuffer` (const)

A decoded buffer that remembers the alias it came from, so `started` can name it.

```ts
const fakeBuffer: (alias: string, duration?: number) => AudioBuffer;
```

#### `fakeFetch` (function)

Creates an in-memory fetch implementation for deterministic loading tests.

```ts
function fakeFetch(routes: Readonly<Record<string, FakeRoute>>, options?: FakeFetchOptions): FakeFetchResult;
```

#### `FakeFetchOptions` (interface)

Options for `fakeFetch`: the fetch that answers urls with no route.

```ts
interface FakeFetchOptions {
  readonly fallback?: typeof fetch;
}
```

#### `FakeFetchResult` (interface)

The fake fetch, and the urls it was asked for and saw aborted.

```ts
interface FakeFetchResult {
  readonly fetch: typeof fetch;
  readonly requests: string[];
  readonly aborted: string[];
}
```

#### `FakeGainNode` (interface)

A gain node of `fakeAudioContext`, recording its value, its targets and its automation.

```ts
interface FakeGainNode {
  readonly targets: unknown[];
  readonly automation: Array<{
    readonly method: string;
    readonly value?: number;
    readonly at: number;
  }>;
  readonly gain: {
    value: number;
  };
}
```

#### `FakeRoute` (interface)

How `fakeFetch` answers one url: a status, the body in chunks, a content length or type, a hang or a
network error.

```ts
interface FakeRoute {
  readonly status?: number;
  readonly chunks?: readonly Uint8Array[];
  readonly contentLength?: number;
  readonly hang?: boolean;
  readonly networkError?: boolean;
  readonly type?: string;
}
```

#### `ManualFrames` (interface)

A frame source a test drives: `advance` moves time on and runs the frame asked for, if any.

```ts
interface ManualFrames extends FrameSource {
  advance(ms: number): void;
  readonly pending: boolean;
}
```

#### `manualFrames` (function)

A frame source that runs a frame only when a test advances it, starting at `startMs`.

```ts
function manualFrames(startMs?: number): ManualFrames;
```

#### `nullRenderer` (function)

A renderer that draws nothing and records each call in `log`, for runtime tests without a GPU.

```ts
function nullRenderer(log?: NullRendererEntry[], options?: NullRendererOptions): RendererFactory;
```

#### `NullRendererEntry` (type)

One call `nullRenderer` recorded.

```ts
type NullRendererEntry = {
  readonly type: "apply";
  readonly tick: number;
} | {
  readonly type: "draw";
  readonly alpha: number;
} | {
  readonly type: "reset";
} | {
  readonly type: "destroy";
};
```

#### `NullRendererOptions` (interface)

Options for `nullRenderer`: `fail` makes it fail `RendererUnavailable`.

```ts
interface NullRendererOptions {
  readonly fail?: boolean;
}
```

#### `RuntimeTest` (function)

Test harness providing `RuntimeServices | FakeHostHandle` for screen and integration tests (spec §3.1, §8.1).
Uses `HostingTest` behind the scenes, hooks DOM layers and geometry, starts the flow if screens exist,
and yields all runtime services plus `FakeHostHandle`.

```ts
function RuntimeTest(options?: RuntimeTestOptions): Layer.Layer<RuntimeServices | FakeHostHandle, BootError>;
```

#### `RuntimeTestOptions` (interface)

What `RuntimeTest` boots: the fake host, the screens, content, settings and save, and the frames, renderer,
fetch and locale it uses.

```ts
interface RuntimeTestOptions {
  readonly hosting?: HostingTestOptions | Partial<Omit<FakeHostOptions, "gameOrigin" | "gameId">>;
  readonly screens?: readonly ScreenDef<any>[];
  readonly content?: CompiledContentData;
  readonly settings?: SettingsDef<unknown>;
  /** The game's save, opened as boot opens it: its triggers and exit flush run, and `saveOf(def)` finds it. */
  readonly saves?: SaveDef<unknown>;
  /** Where settings fields kept on the device go; default a fresh in-memory one, so a test never meets the browser's. */
  readonly deviceStorage?: DeviceStorage;
  readonly frames?: ManualFrames | FrameSource;
  readonly renderer?: GameRenderer | RendererFactory;
  readonly fetch?: typeof fetch;
  /** The game's languages (a Paraglide `runtime.js`); absent, the content's source language alone. */
  readonly locale?: LocaleDef;
  /** The browser's languages, best first; default none. */
  readonly languages?: readonly string[];
  /** Builds the audio context on the first gesture; defaults to `fakeAudioContext()`. */
  readonly createAudioContext?: () => AudioContextLike;
}
```

## `@mcthaydt/automata-ship`

### `import { … } from '@mcthaydt/automata-ship'`

#### `BoardName` (interface)

A board a source file names, by its name and position (1-based, at the opening quote).

```ts
interface BoardName {
  readonly board: string;
  readonly line: number;
  readonly col: number;
}
```

#### `boardNamesIn` (function)

The boards one source file names, in source order; `undefined` when it does not parse (its typecheck already
fails, and a half-read tree could report a board that is not there). `automata check` reads files through its
own `Files` and calls this; `findUndeclaredBoards` walks the disk.

```ts
function boardNamesIn(file: string, code: string): BoardName[] | undefined;
```

#### `BUILD_ID_PATTERN` (const)

A build's ID on the dev host: the commit's UTC time to the minute, then its short sha, for example
`202610111205-abcdef0` (FloorFifty `deploy/bin/build-tag`). Time first, so IDs sort as commits do.
The host's `deploy` script accepts only IDs matching BUILD_ID_PATTERN.

```ts
const BUILD_ID_PATTERN: RegExp;
```

#### `buildIdFor` (function)

The build ID for a commit: its UTC time to the minute, a dash, then the first seven characters of its sha.
Throws for a `sha` that is not 7 to 40 lower-case hex digits.

```ts
function buildIdFor(commit: {
  readonly time: Date;
  readonly sha: string;
}): string;
```

#### `ButlerFailed` (class)

butler exited non-zero. Its output was already shown as it ran; the CLI exits with butler's own code.

```ts
class ButlerFailed extends ButlerFailedBase {
  override get message(): string;
}
```

#### `checkManifest` (function)

Checks `ruken.toml` text with Ruken's own parser, so AF accepts exactly what Ruken accepts.

```ts
function checkManifest(toml: string): Effect.Effect<Manifest, ManifestInvalid>;
```

#### `checkVersion` (function)

A release's version must be its tag's (FloorFifty `deploy/tools/ruken-pack.ts`): the build Ruken shows as
0.10.2 is the one tagged v0.10.2. A branch build has no tag and passes. Returns what is wrong, or undefined.

```ts
function checkVersion(version: string, tag: string | undefined): string | undefined;
```

#### `declaredBoardsIn` (function)

The board ids a `ship.config.ts` declares: the keys of its `leaderboards` object, read from the source as written
(`automata check` reads files, it does not run them). `undefined` when the file does not parse, or `leaderboards`
is not written as an object (a spread or a variable), so the check says it could not read the boards.

```ts
function declaredBoardsIn(code: string): string[] | undefined;
```

#### `DeclaredInputs` (interface)

The `runtime.inputs` a `ship.config.ts` declares, with the position of its opening bracket.

```ts
interface DeclaredInputs {
  readonly inputs: string[];
  readonly line: number;
  readonly col: number;
}
```

#### `declaredInputsIn` (function)

The `runtime.inputs` a `ship.config.ts` declares, read from the source as written (`automata check` reads files, it
does not run them). `undefined` when the file does not parse or `runtime.inputs` is not an array of string literals.

```ts
function declaredInputsIn(code: string): DeclaredInputs | undefined;
```

#### `declaredOrientationIn` (function)

The `runtime.orientation` a `ship.config.ts` declares, read from the source as written (`automata check` reads
files, it does not run them). `undefined` when the file does not parse or `runtime.orientation` is not written as
a literal, so the check can say it could not read it.

```ts
function declaredOrientationIn(code: string): string | undefined;
```

#### `defineShipConfig` (function)

Identity function that gives a game's `ship.config.ts` type checking and editor completion.

```ts
function defineShipConfig(config: ShipConfig): ShipConfig;
```

#### `deployDev` (function)

Sends a prepared build to the dev host and returns its build ID and the URL it is served at. Fails with
`ManifestInvalid` for a bad `ruken.toml` in the build, `DeployFailed` when `tar` or `ssh` exits non-zero,
or a `FileError` or `ProcessError`. The temporary staging copy is removed either way.

```ts
function deployDev(input: DeployDevInput): Effect.Effect<{
  buildId: string;
  url: string;
}, DeployDevError, Files | ProcessRunner>;
```

#### `DeployDevInput` (interface)

What `deployDev` sends and where: a prepared build folder, the commit it came from, the dev host's ssh
target and URL, and whether the build becomes the one `/` redirects to.

```ts
interface DeployDevInput {
  /** A build folder `ship prepare` has written `ruken.toml` into. */
  readonly distDir: string;
  readonly commit: {
    readonly sha: string;
    readonly time: Date;
  };
  readonly tag: string | undefined;
  readonly branch: string | undefined;
  /** The ssh destination, e.g. `deploy@af-dev.floorfifty.duckdns.org`. */
  readonly target: string;
  /** The dev host's URL, e.g. `https://af-dev.floorfifty.duckdns.org`. It is also the page allowed to frame the game. */
  readonly siteUrl: string;
  /** Also make this build the one `/` redirects to. */
  readonly activate: boolean;
  /** The deploy key, when it is not in ~/.ssh (CI writes it to the runner's temp folder and removes it). */
  readonly sshKeyFile?: string | undefined;
  /** The dev host's known_hosts line, beside the key. */
  readonly knownHostsFile?: string | undefined;
}
```

#### `DeployFailed` (class)

The dev host's deploy step (tar or ssh) failed; `output` is what it printed.

```ts
class DeployFailed extends DeployFailedBase {
  override get message(): string;
}
```

#### `EntryMissing` (class)

`[game] entry` names a file the build does not have.

```ts
class EntryMissing extends EntryMissingBase {
  override get message(): string;
}
```

#### `EnvValue` (interface)

One variable read from a game's `.env*` files, whose value the bundle scan looks for in the build.

```ts
interface EnvValue {
  /** The `.env*` file the variable came from, relative to the game folder. */
  readonly file: string;
  readonly name: string;
  readonly value: string;
}
```

#### `FileError` (class)

Reading, writing, listing or removing a file failed.

```ts
class FileError extends FileErrorBase {
  override get message(): string {
    return `${this.path}: ${describe(this.cause)}`
  }
}
```

#### `findExecutable` (function)

The first `name` on `pathEnv` that is an executable file, or undefined. Windows also tries .exe, .cmd, .bat.

```ts
function findExecutable(name: string, pathEnv?: string, platform?: NodeJS.Platform): string | undefined;
```

#### `findInputsProblems` (function)

Each disagreement between `inputs` (a config's `runtime.inputs`) and what the `keys()` calls in a game's sources
bind, in `inputsProblems`' words; empty when they agree or the game has no `keys()` call to compare.

```ts
function findInputsProblems(gameDir: string, inputs: readonly string[]): string[];
```

#### `findOrientationMismatches` (function)

Every `defineGame` in a game's sources that plays in an orientation other than `declared` (its config's).

```ts
function findOrientationMismatches(gameDir: string, declared: string): OrientationMismatchFound[];
```

#### `findPixi3d` (function)

Every script in the build that carries
@pixi /3d (`core`) or its `./extras` (`extras`), the first marker each.

```ts
function findPixi3d(distDir: string): {
  core: Pixi3dFound[];
  extras: Pixi3dFound[];
};
```

#### `findRootAbsoluteReferences` (function)

Every root-absolute reference to one of the build's own files in a built folder, walking it in name order.
Reads each file's syntax (scripts, stylesheets, pages, JSON), so comments and prose are not reported.

```ts
function findRootAbsoluteReferences(distDir: string): RootAbsoluteReferenceFound[];
```

#### `findSecretsInBuild` (function)

Every secret in a built folder. Files are read as latin1, one character per byte, so offsets are byte offsets;
each `.env` value is encoded the same way so it matches its UTF-8 bytes.

```ts
function findSecretsInBuild(distDir: string, envValues: readonly EnvValue[]): SecretFound[];
```

#### `findUndeclaredBoards` (function)

Every board a game's sources name that `declared` (its ship config's `leaderboards` keys) lacks.

```ts
function findUndeclaredBoards(gameDir: string, declared: readonly string[]): UndeclaredBoardFound[];
```

#### `gameOrientationsIn` (function)

The orientations the `defineGame` calls in one source file play in, in source order; `undefined` when the file
does not parse (its typecheck already fails, and a half-read tree could name an orientation that is not there).

```ts
function gameOrientationsIn(file: string, code: string): PlayedOrientation[] | undefined;
```

#### `inputsProblems` (function)

Each disagreement between `runtime.inputs` and the bindings, in action order; empty when they agree.

```ts
function inputsProblems(inputs: readonly string[], bindings: ShipInputBindings): string[];
```

#### `isBoardSource` (const)

Whether `file` is one of the game's sources the board check reads (`.ts`, `.tsx`, `.mts`, `.js`, `.mjs`).

```ts
const isBoardSource: (file: string) => boolean;
```

#### `isInputsSource` (const)

Whether `file` is one of the game's sources the check reads: not a test, whose fixture games are not shipped.

```ts
const isInputsSource: (file: string) => boolean;
```

#### `isLocalStack` (function)

Whether `api` is Ruken's local stack: `localhost`, a `.localhost` name, or a loopback address.

```ts
function isLocalStack(api: string): boolean;
```

#### `isOrientationSource` (const)

Whether `file` is one of the game's sources the check reads: not a test, whose fixture games are not shipped.

```ts
const isOrientationSource: (file: string) => boolean;
```

#### `ITCH_FIRST_PUSH_CHECKLIST` (const)

The one-time page settings butler cannot make (PUB spec §6), printed after a channel's first push. The
"Publish to itch.io" guide (PUB.5) carries the same list.

```ts
const ITCH_FIRST_PUSH_CHECKLIST: string;
```

#### `ITCH_LIMITS` (const)

itch.io's documented limits for an HTML5 upload; "MB" is read as 10^6 bytes.

```ts
const ITCH_LIMITS: {
  readonly maxFiles: number;
  readonly maxPathLength: number;
  readonly maxFileBytes: number;
  readonly maxTotalBytes: number;
};
```

#### `ITCH_LIMITS_SOURCE` (const)

Where itch.io's limits were read, and when.

```ts
const ITCH_LIMITS_SOURCE: {
  readonly url: string;
  readonly read: string;
};
```

#### `ItchBuildInvalid` (class)

The build breaks one of itch.io's rules; each problem names the file and the limit.

```ts
class ItchBuildInvalid extends ItchBuildInvalidBase {
  override get message(): string;
}
```

#### `ItchCheck` (type)

The `prepare --target itch` check that failed, in the order they run (PUB spec §4).

```ts
type ItchCheck = "entry" | "file-count" | "path-length" | "file-size" | "case" | "ruken-toml";
```

#### `ItchConfig` (interface)

What a game writes in `ship.config.ts`.

```ts
interface ItchConfig {
  /** The itch.io project as butler names it: `user/game`, lower case. */
  readonly project: string;
  /** The butler channel. Defaults to `html5`. */
  readonly channel?: string | undefined;
}
```

#### `itchConfigSchema` (const)

Checks a game's `itch` section: `project` is `user/game` in lower case, and `channel` defaults to `html5`.

```ts
const itchConfigSchema: z.ZodType<ItchSettings, ItchConfig>;
```

#### `ItchSettingMissing` (class)

`publish --target itch` lacks the config section, the key or butler; found before anything runs.

```ts
class ItchSettingMissing extends ItchSettingMissingBase {}
```

#### `ItchSettings` (interface)

The checked settings, with the channel filled in.

```ts
interface ItchSettings {
  readonly project: string;
  readonly channel: string;
}
```

#### `keysBindingsIn` (function)

What the `keys()` calls in one source file bind, one `<file>:<line>:<col> keys` entry per call (and `pad` and
`gestures` entries where it binds them); empty when the file has no call; `undefined` when it does not parse (its
typecheck already fails, and a half-read tree could name a device that is not there).

```ts
function keysBindingsIn(file: string, code: string): ShipInputBindings | undefined;
```

#### `ManifestInputsMismatch` (class)

`runtime.inputs` disagrees with the game's input bindings (M4 spec §4.13, I-g).

```ts
class ManifestInputsMismatch extends ManifestInputsMismatchBase {
  override get message(): string;
}
```

#### `ManifestInvalid` (class)

Ruken's parser refused the generated `ruken.toml`. `problems` are Ruken's own issues, unchanged.

```ts
class ManifestInvalid extends ManifestInvalidBase {
  override get message(): string;
}
```

#### `OrientationMismatch` (class)

The game plays in an orientation its ship config's `runtime.orientation` does not send Ruken (M4.7 follow-up).

```ts
class OrientationMismatch extends OrientationMismatchBase {
  override get message(): string;
}
```

#### `OrientationMismatchFound` (interface)

A game that plays in an orientation its ship config does not declare.

```ts
interface OrientationMismatchFound extends PlayedOrientation {
  /** The ship config's `runtime.orientation`. */
  readonly declared: string;
  /** Relative to the game folder, with forward slashes. */
  readonly file: string;
}
```

#### `parseEnvFile` (function)

The variables of one `.env` file: `KEY=value` lines, with `export`, quotes and `#` comments allowed.

```ts
function parseEnvFile(file: string, text: string): EnvValue[];
```

#### `PIXI3D_EXTRAS_MARKERS` (const)

Strings only
@pixi /3d's `./extras` carries (its particle spawn code generator).

```ts
const PIXI3D_EXTRAS_MARKERS: readonly string[];
```

#### `PIXI3D_MARKERS` (const)

Strings only
@pixi /3d's main entry carries.

```ts
const PIXI3D_MARKERS: readonly string[];
```

#### `Pixi3dExtrasInBuild` (class)

A build contains `@pixi/3d/extras`, whose particle code probes `new Function` at load (M3 spec S7-g).

```ts
class Pixi3dExtrasInBuild extends Pixi3dExtrasInBuildBase {
  override get message(): string;
}
```

#### `Pixi3dFound` (interface)

One script that carries a marker.

```ts
interface Pixi3dFound {
  /** Relative to the build, with forward slashes. */
  readonly file: string;
  readonly marker: string;
}
```

#### `Pixi3dInPublicBuild` (class)

A build for a public target (Ruken's store, itch.io) contains `@pixi/3d`, a closed beta (M3 spec §4.8, X-b).

```ts
class Pixi3dInPublicBuild extends Pixi3dInPublicBuildBase {
  override get message(): string;
}
```

#### `PlayedOrientation` (interface)

An orientation a `defineGame` call plays in, at the literal's opening quote (or at the call, when it is left out).

```ts
interface PlayedOrientation {
  readonly orientation: string;
  readonly line: number;
  readonly col: number;
}
```

#### `portsFor` (function)

The ports a checkout's test server and preview build listen on (FloorFifty `playwright.config.ts`).
Several agents run at once, each in its own worktree; with fixed ports a second run either failed on a busy
port or, reusing the first run's server, silently tested another worktree's code. So each checkout path
hashes to its own slot. AF uses 4600–4799, clear of FloorFifty's 4400–4599 on the same machine; a second
example in the same run adds a fixed offset (the ui demo +100 on the preview port, Emberwick (`games/emberwick`) +300).
CI runs one job per machine and uses the fixed pair; AF_E2E_SERVER_PORT / AF_E2E_PREVIEW_PORT override.

```ts
function portsFor(checkoutPath: string, env: Readonly<Record<string, string | undefined>>): {
  server: number;
  preview: number;
};
```

#### `prepareBuild` (function)

Makes a built folder ready for `ruken publish` and the dev host (ship spec §3.3): checks the tag, the
entry page, root-absolute paths, secrets (QB-b), `@pixi/3d` (X-b, S7-g), the leaderboards the game names (M5.7) and the orientation it plays in (M4.7) and the devices its `keys()` calls bind (M4.1), then writes `ruken.toml` once Ruken's parser accepts it. Every check
runs before the write, so a failed prepare leaves the folder as it was. Zipping and Ruken's build checks
(archive, size, file types) happen inside `ruken publish`, not here.

```ts
function prepareBuild(input: PrepareInput): Effect.Effect<{
  manifestPath: string;
}, PrepareError, Files>;
```

#### `PrepareInput` (interface)

What `prepareBuild` checks and writes into: the built folder, the ship config, and the optional release
tag, game folder and input bindings.

```ts
interface PrepareInput {
  /** The built game folder (Vite's `dist/`). */
  readonly distDir: string;
  readonly config: ShipConfig;
  /** The release tag being built, when there is one (`v1.2.3`). */
  readonly tag?: string | undefined;
  /**
   * The game folder, whose `.env*` values must not appear in the build (QB-b). The CLI passes its working folder;
   * when it is left out, no `.env` file is read and only key formats and high-entropy strings are checked.
   */
  readonly gameDir?: string | undefined;
  /**
   * The game's input bindings (its input map's `profile.bindings`), checked against `runtime.inputs` (I-g).
   * Left out, the `keys()` calls in `gameDir`'s sources are read instead (M4.1 follow-up); with neither, nothing
   * is checked.
   */
  readonly inputBindings?: ShipInputBindings | undefined;
  /**
   * Who the build is for. `public` (the default: Ruken's store, through `publish`) refuses a build that contains
   * `@pixi/3d`, a closed beta (X-b); `private` (the dev host behind its access control, `deploy-dev`, and Ruken's
   * local stack, `publish --private`) allows it. Either refuses `@pixi/3d/extras` (S7-g).
   */
  readonly audience?: "public" | "private" | undefined;
}
```

#### `prepareItch` (function)

Makes a built folder ready for itch.io (PUB spec §4): the tag, root-absolute paths, secrets (QB.2: a page on
itch.io is public, so the build is scanned as Ruken's is), `@pixi/3d` (X-b, S7-g), `index.html`, itch.io's
limits, reference case and a stray `ruken.toml` are checked in that order, and the first that fails stops
prepare before anything is written. Then `<id>-<version>-itch.zip` is written beside the build folder (not in
it, so `butler push <dist>` never uploads it), for a manual upload; butler pushes the folder itself.

The build itself must already be an itch build (`resolve.conditions: ['automata-web']`, PUB.1); that is the
game's build step, not ship's.

```ts
function prepareItch(input: PrepareItchInput): Effect.Effect<{
  zipPath: string;
}, PrepareItchError>;
```

#### `PrepareItchInput` (interface)

What `prepareItch` checks and zips: the built folder, the ship config and the release tag.

```ts
interface PrepareItchInput {
  /** The built game folder. It is checked and zipped as it is; nothing is written into it. */
  readonly distDir: string;
  readonly config: ShipConfig;
  /** The release tag being built, when there is one (`v1.2.3`). */
  readonly tag?: string | undefined;
  /** The game's folder, whose `.env*` values must not appear in the build (QB.2). Without it only keys and entropy are scanned. */
  readonly gameDir?: string | undefined;
}
```

#### `PrivatePublishNotLocal` (class)

`publish --private` named a Ruken that is not the local stack (M3 spec §4.8): a private build stays local.

```ts
class PrivatePublishNotLocal extends PrivatePublishNotLocalBase {
  override get message(): string;
}
```

#### `ProcessError` (class)

A program could not be started (not found, not executable). A non-zero exit is not this error.

```ts
class ProcessError extends ProcessErrorBase {
  override get message(): string {
    return `could not run ${this.command}: ${describe(this.cause)}`
  }
}
```

#### `PublishAuth` (class)

Exit 3: the token was missing, wrong or lacks the rights.

```ts
class PublishAuth extends PublishAuthBase {
  override get message(): string;
}
```

#### `publishBuild` (function)

`ship publish` for Ruken (ship spec §3.4): prepare the build, then hand it to Ruken's own CLI. A public publish
(the default) refuses a build that contains `@pixi/3d` (X-b). A private one prepares with the closed beta allowed
and uploads only to Ruken's local stack, checked before anything is prepared, so the beta never reaches a public
Ruken through ship.

```ts
function publishBuild(input: PublishBuildInput): Effect.Effect<{
  url: string | undefined;
}, PrepareError | PublishError | PrivatePublishNotLocal, Files | ProcessRunner>;
```

#### `PublishBuildInput` (interface)

What `publishBuild` needs: `publishToRuken`'s input, the game's ship config, the release tag and the audience.

```ts
interface PublishBuildInput extends PublishInput {
  readonly config: ShipConfig;
  readonly tag?: string | undefined;
  /**
   * A private upload, to Ruken's local stack only: the build may contain `@pixi/3d`, a closed beta (D-1, M3 spec
   * §4.8). Refused unless `api` is a loopback or `.localhost` host.
   */
  readonly private?: boolean | undefined;
}
```

#### `PublishFailed` (class)

Any other exit code.

```ts
class PublishFailed extends PublishFailedBase {
  override get message(): string;
}
```

#### `PublishInput` (interface)

What `publishToRuken` needs: the prepared build folder, the game's folder, Ruken's site and token, and
whether to activate the build.

```ts
interface PublishInput {
  /** The prepared build folder (it already has its `ruken.toml`). */
  readonly distDir: string;
  /** Where Ruken's CLI reads and writes `.ruken/project.json` (the game's own folder). */
  readonly cwd: string;
  /** The Ruken site, e.g. `http://localhost:5173` for Ruken's local stack. */
  readonly api: string;
  /** A Ruken developer token. Passed in the environment, never on the command line. */
  readonly token: string;
  /** Make the build the game's active build once Ruken's checks pass. */
  readonly activate: boolean;
  /** The game's public id; otherwise Ruken uses `.ruken/project.json` or registers the game. */
  readonly game?: string | undefined;
  /** Ruken's CLI entry; defaults to the vendored `@ruken/cli`. */
  readonly cliPath?: string | undefined;
}
```

#### `PublishItchInput` (interface)

What `publishToItch` needs: the built folder, the ship config, the tag, the key and where butler is.

```ts
interface PublishItchInput {
  /** The built game folder. */
  readonly distDir: string;
  readonly config: ShipConfig;
  /** The release tag being built, when there is one (`v1.2.3`). */
  readonly tag?: string | undefined;
  /** The game's folder, for the secret scan's `.env*` values (see `PrepareItchInput.gameDir`). */
  readonly gameDir?: string | undefined;
  /** `BUTLER_API_KEY`. Passed in butler's environment, never on its command line. */
  readonly apiKey: string | undefined;
  /** butler as found on PATH (`findExecutable('butler')`), or undefined when it is not installed. */
  readonly butlerPath: string | undefined;
}
```

#### `PublishRejected` (class)

Exit 1: Ruken's checks rejected the build.

```ts
class PublishRejected extends PublishRejectedBase {
  override get message(): string;
}
```

#### `PublishTimeout` (class)

Exit 4: Ruken's checks took longer than the CLI waits.

```ts
class PublishTimeout extends PublishTimeoutBase {
  override get message(): string;
}
```

#### `publishToItch` (function)

Prepares the build for itch.io (every check of `prepareItch`), then pushes the folder with butler. It fails
before any zip or process when the `itch` section, the key or butler is missing, relays butler's exit code, and
retries nothing. `firstPush` is true when butler says the channel had no build yet.

```ts
function publishToItch(input: PublishItchInput): Effect.Effect<{
  firstPush: boolean;
}, PublishItchError, ProcessRunner>;
```

#### `publishToRuken` (function)

Runs Ruken's own `ruken publish` on a prepared build and returns the URL Ruken says the build is served at
(`undefined` when it prints none). Ruken's exit codes become `PublishRejected` (1), `PublishUsage` (2),
`PublishAuth` (3), `PublishTimeout` (4) and `PublishFailed` for any other.

```ts
function publishToRuken(input: PublishInput): Effect.Effect<{
  url: string | undefined;
}, PublishError, ProcessRunner>;
```

#### `PublishUsage` (class)

Exit 2: the command line was wrong.

```ts
class PublishUsage extends PublishUsageBase {
  override get message(): string;
}
```

#### `readEnvValues` (function)

The variables of every top-level `.env*` file in the game folder; none when the folder does not exist.

```ts
function readEnvValues(gameDir: string): EnvValue[];
```

#### `RootAbsoluteReference` (class)

The build names its own files from the origin's root, which 404s under `/b/<buildId>/`.

```ts
class RootAbsoluteReference extends RootAbsoluteReferenceBase {
  override get message(): string;
}
```

#### `rukenCliPath` (function)

The `ruken` bin of the vendored `@ruken/cli` package. The published `@mcthaydt/automata-ship` carries a copy of
Ruken's built CLI in `dist/vendor/ruken-cli/` (D-8, M2.4 spec §3.4); every built module sits directly in
`dist/`, so the copy is `./vendor/ruken-cli/cli.js` next to it. Running from `src` in the workspace there is
no copy, and the workspace's `@ruken/cli` dev dependency is used instead (`dist/cli.js`, next to its
`dist/index.js`). `moduleUrl` and `exists` are parameters only so tests can stand in for a built package.

```ts
function rukenCliPath(moduleUrl?: string, exists?: (path: string) => boolean): string;
```

#### `rukenToml` (function)

The text of `ruken.toml` (Ruken manifest schema 1) for a ship config. The same config always gives the same
text.

```ts
function rukenToml(config: ShipConfig): string;
```

#### `scanTextForSecrets` (function)

Every secret in one file's text.

```ts
function scanTextForSecrets(file: string, text: string, envValues: readonly EnvValue[]): SecretFound[];
```

#### `SecretFound` (interface)

A secret the bundle scan found in a built file, located without repeating the secret.

```ts
interface SecretFound {
  /** Relative to the build, with forward slashes. */
  readonly file: string;
  /** Index into the scanned text; a byte offset when the text was read as latin1 (as `findSecretsInBuild` does). */
  readonly offset: number;
  /** 1-based. */
  readonly line: number;
  readonly col: number;
  /** A gitleaks rule ID, `env-value` or `high-entropy`. */
  readonly rule: string;
  /** What was found, without the secret. */
  readonly detail: string;
}
```

#### `SecretInBuild` (class)

The build holds a key, an `.env` value or a high-entropy string (QB-b). The message never holds the secret.

```ts
class SecretInBuild extends SecretInBuildBase {
  override get message(): string;
}
```

#### `SHIP_PACKAGE` (const)

The name this package is published under.

```ts
const SHIP_PACKAGE = "@mcthaydt/automata-ship";
```

#### `ShipConfig` (interface)

What a game tells ship about itself, in Ruken's own manifest shape (`@ruken/manifest`'s `Manifest`).
Keys keep Ruken's snake_case so the config reads like the `ruken.toml` it becomes. ship fills in
`schema` and `allow_eval` (always false); every other field and allowed value is Ruken's, so a field
Ruken does not define is a type error here.

```ts
interface ShipConfig {
  readonly game: Manifest["game"];
  readonly runtime: Omit<Manifest["runtime"], "allow_eval">;
  readonly network: Manifest["network"];
  readonly content: Manifest["content"];
  readonly analytics?: Manifest["analytics"];
  readonly loading?: NonNullable<Manifest["loading"]>;
  readonly leaderboards?: Manifest["leaderboards"];
  /**
   * Where `automata-ship publish --target itch` pushes (PUB spec §4). Not a Ruken field: it is never written to
   * `ruken.toml`, and a Ruken build ignores it.
   */
  readonly itch?: ItchConfig | undefined;
  /**
   * Who the game's builds are for. `private` is a game that carries `@pixi/3d`, a closed beta (D-1), until Pixi 3D's
   * public release: `automata-ship prepare` then checks the build as private and writes no `ruken.toml`, and only
   * `deploy-dev` and `publish --private` ship it (M3 spec §4.8). Not a Ruken field. Left out, a game is `public`.
   */
  readonly audience?: "public" | "private" | undefined;
}
```

#### `ShipInputBindings` (interface)

What ship reads of a game's input profile. ship is published and the profile's owner (`runtime`) is private,
so this is the read-only subset ship consumes, not a copy of the contract: a profile's `bindings` is
assignable to it.

```ts
interface ShipInputBindings {
  readonly [action: string]: {
    readonly pad?: readonly number[] | undefined;
    readonly touch?: boolean | undefined;
    readonly gesture?: readonly string[] | undefined;
  };
}
```

#### `testRemote` (function)

Pushes the current branch, dispatches CI for it, waits and returns the run's URL and one `<result>\t<job>`
line per job when it is green. Otherwise fails with a `TestRemoteFailed` whose `reason` says why (see
`TestRemoteReason`).

```ts
function testRemote(input: TestRemoteInput): Effect.Effect<{
  runUrl: string;
  jobs: readonly string[];
}, TestRemoteFailed | ProcessError$1, ProcessRunner>;
```

#### `TestRemoteFailed` (class)

`test-remote` stopped without a green run; `reason` says why and `message` says what to do.

```ts
class TestRemoteFailed extends TestRemoteFailedBase {}
```

#### `TestRemoteInput` (interface)

What `testRemote` runs and how long it waits. The timing fields are for tests: the defaults suit a real
run. `args` are the words after `test-remote`: nothing for the hosted checks, Playwright arguments for one
focused run, or `--nightly`.

```ts
interface TestRemoteInput {
  /** The words after `test-remote`. Split on whitespace, so a quoted multi-word value does not survive. */
  readonly args: readonly string[];
  /** Only a run created at or after this time (ISO 8601, UTC) is ours. */
  readonly since: string;
  /** How often, and how many times, to look for the dispatched run (default 45 × 2 s). */
  readonly pollAttempts?: number;
  readonly pollIntervalMs?: number;
  /** How often to look at the run while it is queued or running (default 20 s). */
  readonly watchIntervalMs?: number;
  /** Looks at a run with no job started before it counts as having no runner (default 30, 10 minutes). */
  readonly queuePolls?: number;
  /** Looks at a run in all before giving up on it (default 180, 60 minutes). */
  readonly runPolls?: number;
  /** Failed looks in a row (gh error or not JSON) before giving up on gh (default 5). */
  readonly viewRetries?: number;
}
```

#### `TestRemoteReason` (type)

Why `test-remote` stopped without a green run.

```ts
type TestRemoteReason = "usage" | "detached" | "uncommitted" | "push" | "dispatch" | "no-run" | "no-runner" | "timeout" | "gh-unavailable" | "red";
```

#### `UndeclaredBoard` (class)

The game names a leaderboard its ship config's `leaderboards` does not declare (M5 spec §4.8, L-b).

```ts
class UndeclaredBoard extends UndeclaredBoardBase {
  override get message(): string;
}
```

#### `UndeclaredBoardFound` (interface)

A board the game's sources name that its ship config does not declare, at the call site.

```ts
interface UndeclaredBoardFound {
  readonly board: string;
  /** Relative to the game folder, with forward slashes. */
  readonly file: string;
  /** 1-based, at the board name's opening quote. */
  readonly line: number;
  readonly col: number;
}
```

#### `VersionMismatch` (class)

A release tag that is not `v<version>`.

```ts
class VersionMismatch extends VersionMismatchBase {}
```

## `@mcthaydt/automata-sim`

### `import { … } from '@mcthaydt/automata-sim'`

#### `canonicalJson` (function)

Canonical JSON: object keys sorted at every depth, no whitespace. Numbers use the ECMAScript
Number-to-string algorithm, which every engine implements identically, except that -0 is written as -0.
Throws CanonicalJsonError for anything JSON can't represent exactly: NaN, Infinity, undefined, bigint,
functions, symbols, and non-plain objects (a Date, Map, Set, typed array or class instance would otherwise
serialize as {} and hash the same as every other one; M2.1 spec §10.7).

```ts
function canonicalJson(value: unknown): string;
```

#### `CanonicalJsonError` (class)

A value canonical JSON cannot represent exactly; hashing it anyway would let different values collide.

```ts
class CanonicalJsonError extends Error {
  constructor(message: string);
}
```

#### `Command` (interface)

Input to the sim (spec §4.4 rule 4). `source` is a player slot (u8), `seq` a per-source counter (u32).

```ts
interface Command {
  readonly tick: number;
  readonly source: number;
  readonly seq: number;
  readonly type: string;
  readonly payload: unknown;
}
```

#### `CommandDef` (interface)

A command the sim accepts as input: an id and the Zod schema its payload must match. Create one with
`defineCommand`.

```ts
interface CommandDef<Z extends z.ZodType = z.ZodType> {
  readonly kind: "command";
  readonly id: string;
  readonly schema: Z;
}
```

#### `CommandRecord` (interface)

A command as a system reads it this tick: the player slot that sent it (`source`), its per-source `seq` and
its parsed `payload`.

```ts
interface CommandRecord<P> {
  readonly source: number;
  readonly seq: number;
  readonly payload: P;
}
```

#### `ComponentDef` (interface)

A component: a stable id and a flat record of typed fields. Create one with `defineComponent`; game code
addresses entity data through the definition, never through `trait`.

```ts
interface ComponentDef<S extends FieldSchema = FieldSchema> {
  readonly kind: "component";
  readonly id: string;
  readonly fields: S;
  /** Field names in sorted order: the order used by snapshots. */
  readonly fieldNames: readonly string[];
  /** Included in RenderDelta rows (default true). */
  readonly render: boolean;
  /** Internal Koota storage. Game code never touches it. */
  readonly trait: Trait;
}
```

#### `createRng` (function)

A generator seeded from `seed` (through splitmix32): the same seed gives the same sequence in every engine.

```ts
function createRng(seed: number): Rng;
```

#### `createSim` (function)

Creates a sim from its plugins, seed and content; async, because a plugin may create engine state (a Rapier
world). Throws for a bad `tickHz`, a duplicate definition, an unknown plugin dependency or system ordering
reference, an ordering cycle, a system name the sim reserves, or an invalid resource start. If a plugin's
engine fails to start, the engines already created are disposed first.

```ts
function createSim(opts: SimOptions): Promise<Sim>;
```

#### `Def` (type)

Anything `definePlugin`'s flat `defs` list takes (DX spec §3.2).

```ts
type Def = ComponentDef | CommandDef | EventDef | ResourceDef | SystemDef;
```

#### `defineCommand` (function)

Defines a command by id and payload schema. Throws for an id that is not lower-case words separated by dots
or dashes.

```ts
function defineCommand<Z extends z.ZodType>(id: string, schema: Z): CommandDef<Z>;
```

#### `defineComponent` (function)

Defines a component from an id (lower-case words separated by dots or dashes) and its fields by name and
type. `render: false` keeps it out of the renderer's deltas. Throws for a bad id, no fields, a bad field
name or an unknown field type.

```ts
function defineComponent<S extends FieldSchema>(id: string, fields: S, opts?: {
  render?: boolean;
}): ComponentDef<S>;
```

#### `defineEvent` (function)

Defines an event by id and payload schema, to emit from a system with `ctx.emit`. Events come back in
`StepResult.events`; `ctx.emit` throws for a payload that fails the schema.

```ts
function defineEvent<Z extends z.ZodType>(id: string, schema: Z): EventDef<Z>;
```

#### `definePlugin` (function)

Defines a plugin from a name, its dependencies and its definitions, given in the keyed lists or in one flat
`defs` list sorted by kind. A plugin written either way registers the same lists and gets the same schema
hash. `config` is copied as canonical, frozen JSON, so anything that cannot hash exactly throws a
`CanonicalJsonError` here.

```ts
function definePlugin(spec: {
  name: string;
  dependsOn?: readonly string[];
  /** One flat list, sorted into the keyed lists by `kind`; each entry follows that list's keyed entries. */
  defs?: readonly Def[];
  components?: readonly ComponentDef[];
  commands?: readonly CommandDef[];
  events?: readonly EventDef[];
  resources?: readonly ResourceDef[];
  systems?: readonly SystemDef[];
  state?: (setup: PluginStateSetup) => Promise<PluginState>;
  config?: unknown;
}): PluginDef;
```

#### `defineResource` (function)

Defines a resource by id, schema and starting value. `createSim` parses `init()` with the schema, so a bad
start fails there.

```ts
function defineResource<Z extends z.ZodType>(id: string, schema: Z, init: () => z.input<Z>): ResourceDef<Z>;
```

#### `defineSystem` (function)

A system: `defineSystem(name, run)` runs in `gameplay`, `defineSystem(name, phase, run)` in that phase, and the
object form also takes `before`/`after`. All three build the same SystemDef (DX spec §3.2).

```ts
function defineSystem(name: string, run: (ctx: SimContext) => void): SystemDef;
function defineSystem(name: string, phase: Phase, run: (ctx: SimContext) => void): SystemDef;
function defineSystem(spec: SystemSpec): SystemDef;
```

#### `deriveSeed` (function)

Seed for a named substream: FNV-1a over the name's UTF-16 code units, mixed with the root seed.

```ts
function deriveSeed(rootSeed: number, name: string): number;
```

#### `EntityRef` (interface)

A live entity, addressed by its StableId. Writes are coerced per field type and mark the entity changed.

```ts
interface EntityRef {
  readonly sid: number;
  has(component: ComponentDef): boolean;
  get<S extends FieldSchema>(component: ComponentDef<S>): Readonly<FieldValues<S>>;
  set<S extends FieldSchema>(component: ComponentDef<S>, values: Partial<FieldValues<S>>): void;
  add<S extends FieldSchema>(component: ComponentDef<S>, values?: Partial<FieldValues<S>>): void;
  remove(component: ComponentDef): void;
}
```

#### `EventDef` (interface)

An event a system emits: an id and the Zod schema its payload must match. Create one with `defineEvent`.

```ts
interface EventDef<Z extends z.ZodType = z.ZodType> {
  readonly kind: "event";
  readonly id: string;
  readonly schema: Z;
}
```

#### `FieldRecord` (type)

One component's field values on an entity, by field name.

```ts
type FieldRecord = Record<string, number | boolean | string>;
```

#### `FieldSchema` (type)

A component's fields, by name.

```ts
type FieldSchema = Readonly<Record<string, FieldType>>;
```

#### `FieldType` (type)

A component field's type: `f32`, `f64`, `i32`, `u32`, `bool`, `entity` (a StableId, stored as a `u32`) or
`string`.

```ts
type FieldType = (typeof FIELD_TYPES)[number];
```

#### `FieldValue` (type)

The JavaScript type a field holds: `boolean` for `bool`, `string` for `string`, `number` for every other
type.

```ts
type FieldValue<T extends FieldType> = T extends "bool" ? boolean : T extends "string" ? string : number;
```

#### `FieldValues` (type)

The writable record of values a `FieldSchema` describes.

```ts
type FieldValues<S extends FieldSchema> = { -readonly [K in keyof S]: FieldValue<S[K]>; };
```

#### `hex64` (function)

16 lowercase hex digits.

```ts
function hex64(value: bigint): string;
```

#### `Phase` (type)

One of the six phases a tick runs through, in `PHASES` order.

```ts
type Phase = (typeof PHASES)[number];
```

#### `PHASES` (const)

Fixed phase order (spec §4.3).

```ts
const PHASES: readonly ["input", "prePhysics", "physics", "postPhysics", "gameplay", "cleanup"];
```

#### `PluginDef` (interface)

A bundle of definitions the sim registers together: components, commands, events, resources and systems,
the plugins it depends on, and optionally per-sim engine state and `config`. Create one with
`definePlugin`.

```ts
interface PluginDef {
  readonly kind: "plugin";
  readonly name: string;
  /** Creates this plugin's per-sim engine state; its systems see it as `ctx.pluginState`. */
  readonly state: ((setup: PluginStateSetup) => Promise<PluginState>) | undefined;
  readonly dependsOn: readonly string[];
  readonly components: readonly ComponentDef[];
  readonly commands: readonly CommandDef[];
  readonly events: readonly EventDef[];
  readonly resources: readonly ResourceDef[];
  readonly systems: readonly SystemDef[];
  /**
   * Settings that change what the plugin simulates (physics gravity), as plain JSON. Part of the schema hash,
   * so a snapshot never restores into a sim configured differently. Undefined when the plugin has none.
   */
  readonly config: unknown;
}
```

#### `PluginState` (interface)

Engine state a plugin keeps outside the ECS, such as a Rapier world (M2.1 spec §3.1). `createSim` creates
one per sim, so a PluginDef shared by many sims never shares engine state between them.

```ts
interface PluginState {
  /** Bytes for snapshot section 6. Must be canonical: the same state gives the same bytes in every engine. */
  snapshot(): Uint8Array;
  /**
   * Validates and parses `bytes` without touching the live state. Throwing here (a SnapshotFormatError for bad
   * bytes) leaves the sim exactly as it was. Otherwise the sim later calls exactly one of the result's
   * methods: `commit` when every part of the snapshot was valid, `discard` when another part was not.
   */
  prepareRestore(bytes: Uint8Array): PreparedRestore;
  /** Frees the engine. The sim calls it once, on `dispose` or when `createSim` fails after creating it. */
  dispose(): void;
}
```

#### `PluginStateSetup` (interface)

What a plugin's state may know when it is created.

```ts
interface PluginStateSetup {
  /** The sim's fixed step, 1 / tickHz seconds. */
  readonly dt: number;
}
```

#### `PreparedRestore` (interface)

A plugin's parsed restore, held until the sim knows whether the whole snapshot is valid.

```ts
interface PreparedRestore {
  /** Adopts the parsed state and frees the state it replaces. Must not throw. */
  commit(): void;
  /** Frees whatever `prepareRestore` built (a restored engine world). Must not throw. */
  discard(): void;
}
```

#### `RejectedCommand` (interface)

A command `step` dropped, with the reason.

```ts
interface RejectedCommand {
  readonly command: Command;
  readonly reason: RejectReason;
}
```

#### `RejectReason` (type)

Why `step` dropped a command: `bad-header` (a field is missing or out of range), `unknown-command` (no
plugin defines its type), `wrong-tick` (not the sim's current tick), `duplicate-seq` (the same source and
seq twice in one step) or `invalid-payload` (it fails the command's schema).

```ts
type RejectReason = "bad-header" | "unknown-command" | "wrong-tick" | "duplicate-seq" | "invalid-payload";
```

#### `RenderDelta` (interface)

What changed for the renderer since the last delta (spec §4.7). `changed` rows carry the entity's full
render state, so a removed component shows up as its absence. `resync` deltas list every live render
entity as added; the renderer drops everything it had first.

```ts
interface RenderDelta {
  readonly resync: boolean;
  readonly added: readonly RenderRow[];
  readonly changed: readonly RenderRow[];
  readonly removed: readonly number[];
}
```

#### `RenderRow` (interface)

One entity's render-flagged components (component id -> field values).

```ts
interface RenderRow {
  readonly sid: number;
  readonly components: Readonly<Record<string, Readonly<FieldRecord>>>;
}
```

#### `ResourceDef` (interface)

A value the sim keeps once, not on any entity: an id, a Zod schema and the `init` that gives its starting
value. Create one with `defineResource`.

```ts
interface ResourceDef<Z extends z.ZodType = z.ZodType> {
  readonly kind: "resource";
  readonly id: string;
  readonly schema: Z;
  readonly init: () => z.input<Z>;
}
```

#### `Rng` (interface)

A deterministic generator (xoshiro128**, 32-bit integer math only, so it is bit-exact in every engine).
Each system gets its own, seeded from the sim's seed and the system's name.

```ts
interface Rng {
  /** Next raw 32-bit unsigned output. */
  nextU32(): number;
  /** Uniform in [0, 1), 32 bits of precision. */
  next(): number;
  /** Uniform integer in [0, n). `n` must be a positive integer <= 2^32. */
  int(n: number): number;
  /** Copy of the current state, for snapshots. */
  state(): RngState;
}
```

#### `RngState` (type)

The four 32-bit words of a generator's state, as `Rng.state()` copies them and snapshots store them.

```ts
type RngState = [number, number, number, number];
```

#### `Sim` (interface)

A running simulation, stepped with commands, that can snapshot, restore and hash its state. `step` is the
only way gameplay state changes. Create one with `createSim`, and `dispose` it when done.

```ts
interface Sim {
  readonly seed: number;
  readonly tickHz: number;
  readonly tick: number;
  /** XXH64 of the canonical content this sim was created with, 16 hex digits; the snapshot header's value. */
  readonly contentHash: string;
  step(commands: readonly Command[]): StepResult;
  /** Setup and inspection outside `step` (tests, scene setup). Runtime changes go through commands. */
  spawn(parts: readonly SpawnPart[]): number;
  entity(sid: number): EntityRef | undefined;
  query(...components: ComponentDef[]): EntityRef[];
  resource<Z extends z.ZodType>(def: ResourceDef<Z>): z.output<Z>;
  /** Canonical snapshot v1 bytes (spec §4.6). */
  snapshot(): Uint8Array;
  /** Replaces the whole state. Throws SnapshotFormatError / SnapshotMismatchError and leaves the sim unchanged. */
  restore(bytes: Uint8Array): void;
  /**
   * A readable view of `bytes`, or of the current state when none are given (M2.3 spec §3.1). Decodes and checks
   * the header as `restore` does (SnapshotFormatError / SnapshotMismatchError) but not restore's later
   * cross-checks, and changes nothing.
   */
  describeSnapshot(bytes?: Uint8Array): SnapshotView;
  /** xxhash64 of the snapshot, 16 hex digits. */
  hash(): string;
  /** Frees the Koota world and every plugin's engine. Idempotent; any later call throws SimDisposedError. */
  dispose(): void;
}
```

#### `SIM_VERSION` (const)

The sim package's version, written into replay headers for information only (M2.3 spec §3.2). A constant
rather than a build-time define, so workspace tests and un-built replays carry the real version; M2.4's
version step updates it with package.json, and version.test.ts keeps the two equal.

```ts
const SIM_VERSION: string;
```

#### `SimCapacityError` (class)

More sims are alive than Koota allows worlds (16 per process). Dispose sims you no longer need.

```ts
class SimCapacityError extends Error {
  constructor(cause: unknown);
}
```

#### `SimContext` (interface)

What a system's `run` receives each tick (spec §4.1).

```ts
interface SimContext {
  readonly tick: number;
  /** Fixed step, 1 / tickHz. */
  readonly dt: number;
  /** This system's own RNG substream. */
  readonly rng: Rng;
  /** Compiled content, deep-frozen. */
  readonly content: unknown;
  /** Live entities that have every listed component, in ascending StableId order. */
  query(...components: ComponentDef[]): EntityRef[];
  entity(sid: number): EntityRef | undefined;
  /** Spawns immediately; returns the new StableId. */
  spawn(...parts: SpawnPart[]): number;
  /** Despawn is deferred to the end of the tick (built-in `entities.flush`). */
  despawn(sid: number): void;
  readonly commands: {
    of<Z extends z.ZodType>(def: CommandDef<Z>): ReadonlyArray<CommandRecord<z.output<Z>>>;
  };
  emit<Z extends z.ZodType>(def: EventDef<Z>, payload: z.input<Z>): void;
  resource<Z extends z.ZodType>(def: ResourceDef<Z>): z.output<Z>;
  /** The per-sim state of the plugin that registered this system (`definePlugin({ state })`), else undefined. */
  readonly pluginState: unknown;
}
```

#### `SimDisposedError` (class)

The sim was disposed; it holds no world any more, so every call that reads or changes state refuses.

```ts
class SimDisposedError extends Error {
  constructor();
}
```

#### `SimEvent` (interface)

An event a system emitted during a step: the event's id as `type`, and its parsed `payload`.

```ts
interface SimEvent {
  readonly type: string;
  readonly payload: unknown;
}
```

#### `SimFaultedError` (class)

A system threw during `step`. The tick was left half-applied, so the sim refuses `step`, `snapshot` and
`hash` until a successful `restore` (M2.1 spec §10.2). Failing closed is cheaper than rolling back every tick.

```ts
class SimFaultedError extends Error {
  readonly system: string;
  readonly tick: number;
  constructor(system: string, tick: number, cause: unknown);
}
```

#### `SimOptions` (interface)

What `createSim` takes: the root `seed`, the `plugins`, `tickHz` (an integer from 1 to 1000, default 60)
and the `content` the systems read as `ctx.content` (default `{}`).

```ts
interface SimOptions {
  readonly seed: number;
  readonly tickHz?: number;
  readonly content?: unknown;
  readonly plugins: readonly PluginDef[];
}
```

#### `SNAPSHOT_VERSION` (const)

The snapshot format version this build reads and writes; a snapshot of another version fails with
`SnapshotFormatError`.

```ts
const SNAPSHOT_VERSION = 1;
```

#### `SnapshotFormatError` (class)

Snapshot bytes that are not a valid snapshot of this format version: bad magic, an unsupported version,
truncated or malformed sections.

```ts
class SnapshotFormatError extends Error {
  constructor(message: string, options?: ErrorOptions);
}
```

#### `SnapshotMismatchError` (class)

A valid snapshot that belongs to another sim: `field` names the header value that differs (`schemaHash`,
`contentHash` or `tickHz`), with this sim's `expected` value and the snapshot's `actual` one.

```ts
class SnapshotMismatchError extends Error {
  readonly field: "schemaHash" | "contentHash" | "tickHz";
  readonly expected: string;
  readonly actual: string;
  constructor(field: "schemaHash" | "contentHash" | "tickHz", expected: string, actual: string);
}
```

#### `SnapshotView` (interface)

A readable copy of a snapshot, for diffs and reports (M2.3 spec §3.1). Plugin bytes are opaque engine state,
so they are described by length and hash only.

```ts
interface SnapshotView {
  readonly header: {
    readonly formatVersion: number;
    readonly schemaHash: string;
    readonly contentHash: string;
    readonly tick: number;
    readonly tickHz: number;
  };
  /** Per system, its RNG state words. */
  readonly rng: Readonly<Record<string, readonly number[]>>;
  /** Per resource id, its value parsed from canonical JSON. */
  readonly resources: Readonly<Record<string, unknown>>;
  readonly nextId: number;
  /** Ascending sid; per component id, its field values. Components the entity lacks are absent. */
  readonly entities: ReadonlyArray<{
    readonly sid: number;
    readonly components: Readonly<Record<string, FieldRecord>>;
  }>;
  /** Section 6, per stateful plugin: byte length and XXH64 of its bytes. */
  readonly plugins: Readonly<Record<string, {
    readonly byteLength: number;
    readonly hash: string;
  }>>;
}
```

#### `sortedEntries` (function)

Own enumerable [key, value] pairs, sorted by key.

```ts
function sortedEntries<V>(obj: Readonly<Record<string, V>>): Array<[string, V]>;
```

#### `sortedKeys` (function)

Own enumerable string keys, sorted by UTF-16 code unit.

```ts
function sortedKeys(obj: object): string[];
```

#### `SpawnPart` (type)

A component to spawn with: the definition alone (defaults) or [definition, initial values].

```ts
type SpawnPart = ComponentDef | readonly [ComponentDef, Readonly<Record<string, unknown>>];
```

#### `StepResult` (interface)

What one `step` produced: the new tick, the events emitted, the renderer's delta and the commands that were
rejected.

```ts
interface StepResult {
  /** The tick the sim is at after this step. */
  readonly tick: number;
  readonly events: readonly SimEvent[];
  readonly render: RenderDelta;
  /** Invalid commands, in input order. The sim has no I/O, so it reports instead of logging. */
  readonly rejected: readonly RejectedCommand[];
}
```

#### `SystemDef` (interface)

A system: a name, the phase it runs in, the systems it must run `before` or `after` within that phase, and
its `run`, called once per tick. Create one with `defineSystem`.

```ts
interface SystemDef {
  readonly kind: "system";
  readonly name: string;
  readonly phase: Phase;
  readonly before: readonly string[];
  readonly after: readonly string[];
  readonly run: (ctx: SimContext) => void;
}
```

#### `SystemSpec` (interface)

The object form of `defineSystem`: a name, a phase, the optional `before`/`after` ordering and the run.

```ts
interface SystemSpec {
  name: string;
  phase: Phase;
  before?: readonly string[];
  after?: readonly string[];
  run: (ctx: SimContext) => void;
}
```

#### `xxhash64` (function)

XXH64 of `data` with an unsigned 64-bit `seed`.

```ts
function xxhash64(data: Uint8Array, seed?: bigint): bigint;
```

### `import { … } from '@mcthaydt/automata-sim/hash'`

#### `canonicalJson` (function)

Canonical JSON: object keys sorted at every depth, no whitespace. Numbers use the ECMAScript
Number-to-string algorithm, which every engine implements identically, except that -0 is written as -0.
Throws CanonicalJsonError for anything JSON can't represent exactly: NaN, Infinity, undefined, bigint,
functions, symbols, and non-plain objects (a Date, Map, Set, typed array or class instance would otherwise
serialize as {} and hash the same as every other one; M2.1 spec §10.7).

```ts
function canonicalJson(value: unknown): string;
```

#### `hex64` (function)

16 lowercase hex digits.

```ts
function hex64(value: bigint): string;
```

#### `utf8` (function)

UTF-8 encoding without TextEncoder (the sim's lib has no DOM/Web APIs). Lone surrogates become U+FFFD.

```ts
function utf8(s: string): Uint8Array;
```

#### `xxhash64` (function)

XXH64 of `data` with an unsigned 64-bit `seed`.

```ts
function xxhash64(data: Uint8Array, seed?: bigint): bigint;
```

### `import { … } from '@mcthaydt/automata-sim/math'`

#### `atan` (function)

Deterministic arctangent. NaN stays NaN; `-0` stays `-0`.

```ts
function atan(x0: number): number;
```

#### `atan2` (function)

Finite inputs only (sim values are finite). Signed zeros follow the built-in atan2.

```ts
function atan2(y: number, x: number): number;
```

#### `cos` (function)

Deterministic cosine, in radians. NaN for a non-finite input.

```ts
function cos(x: number): number;
```

#### `exp` (function)

Deterministic `e` to the power `x`. Infinity above about 709.78, 0 below about -745.13.

```ts
function exp(x: number): number;
```

#### `hypot` (function)

No overflow scaling: inputs must satisfy x*x + y*y < 1.7e308.

```ts
function hypot(x: number, y: number): number;
```

#### `log` (function)

Deterministic natural logarithm. NaN for a negative input, `-Infinity` for 0.

```ts
function log(x0: number): number;
```

#### `pow` (function)

Deterministic `x` to the power `y`. An integer `y` of 64 or less in magnitude multiplies exactly; otherwise
it is `exp(y * log(x))`, and a negative `x` with a non-integer `y` is NaN.

```ts
function pow(x: number, y: number): number;
```

#### `sin` (function)

Deterministic sine, in radians. NaN for a non-finite input; `-0` stays `-0`.

```ts
function sin(x: number): number;
```

#### `tan` (function)

Deterministic tangent, in radians, as `sin(x) / cos(x)`.

```ts
function tan(x: number): number;
```

### `import { … } from '@mcthaydt/automata-sim/replay'`

#### `createRecorder` (function)

Starts recording `sim` from its current state, for the recorder's `step` to extend. Throws
`ReplayRecordError` for a `checkEvery` or `snapshotEvery` that is not an integer of at least 1.

```ts
function createRecorder(sim: Sim, options?: RecorderOptions): Recorder;
```

#### `createReplayStepper` (function)

Creates a stepper over `replay`: a fresh sim built from the replay's seed and tick rate, restored from its
start snapshot. Throws `SnapshotMismatchError` when the start snapshot belongs to another schema or
content, `SnapshotFormatError` when it is malformed, and `ReplayFormatError` when the header disagrees with
the start snapshot it describes; the sim it created is disposed first.

```ts
function createReplayStepper(replay: Replay, setup: ReplayStepSetup): Promise<ReplayStepper>;
```

#### `decodeReplay` (function)

Decodes `.replay` bytes (already inflated) into a `Replay`. Throws `ReplayFormatError`, with the byte
offset when known, for anything that is not a valid replay.

```ts
function decodeReplay(bytes: Uint8Array): Replay;
```

#### `DEFAULT_CHECK_EVERY` (const)

How often, in ticks, a recording stores a check hash when `RecorderOptions.checkEvery` is not given.

```ts
const DEFAULT_CHECK_EVERY = 60;
```

#### `encodeReplay` (function)

Encodes a replay as `.replay` bytes before deflate. The same run encodes to the same bytes in every engine.
Throws `ReplayFormatError` for a replay that cannot be encoded.

```ts
function encodeReplay(replay: Replay): Uint8Array;
```

#### `packReplay` (function)

Encodes a replay and deflates it into `.replay` file bytes.

```ts
function packReplay(replay: Replay, compression: ReplayCompression): Promise<Uint8Array>;
```

#### `Recorder` (interface)

Steps a sim and records the run as a `Replay`. Nothing else may step the sim while it records; the recorder
refuses to continue if something did.

```ts
interface Recorder {
  /** `sim.step` plus recording. */
  step(commands: readonly Command[]): StepResult;
  /** Adds the final tick and hash; the recorder is closed afterwards. */
  finish(): Replay;
}
```

#### `RecorderOptions` (interface)

What a recording takes: how often to store a check hash, whether to keep a reference hash and snapshots
(goldens), and free-form `meta`.

```ts
interface RecorderOptions {
  /** A check hash every this many ticks from the start (default 60, at least 1). */
  readonly checkEvery?: number;
  /** Goldens: also a hash after every step and a full snapshot every `snapshotEvery` ticks. */
  readonly reference?: {
    readonly snapshotEvery: number;
  };
  readonly meta?: Readonly<Record<string, string>>;
}
```

#### `Replay` (interface)

A recorded run: its header, the start snapshot, the accepted commands by tick, check hashes along the way
and the final tick and hash. Replaying it must reproduce every hash.

```ts
interface Replay {
  readonly header: ReplayHeader;
  /** sim.snapshot() when recording started: covers setup spawns and checkpoint starts. */
  readonly start: Uint8Array;
  /** Only ticks with accepted commands, ascending; commands within a tick in (source, seq) order. */
  readonly ticks: ReadonlyArray<{
    readonly tick: number;
    readonly commands: readonly ReplayCommand[];
  }>;
  /** sim.hash() after stepping to `tick`; ascending, in (startTick, finalTick]. */
  readonly checks: ReadonlyArray<{
    readonly tick: number;
    readonly hash: string;
  }>;
  readonly finalTick: number;
  readonly finalHash: string;
  /** Goldens only: a hash after every step, and full snapshots every `snapshotEvery` ticks. */
  readonly reference?: {
    /** Index i is the hash at startTick + 1 + i. */
    readonly hashes: readonly string[];
    readonly snapshots: ReadonlyArray<{
      readonly tick: number;
      readonly bytes: Uint8Array;
    }>;
  };
}
```

#### `REPLAY_FORMAT` (const)

The `.replay` format version this build reads and writes.

```ts
const REPLAY_FORMAT = 1;
```

#### `REPLAY_INFLATE_MAX_BYTES` (const)

Larger than FloorFifty's 1 MiB because goldens carry reference snapshots; player replays may pass less.

```ts
const REPLAY_INFLATE_MAX_BYTES: number;
```

#### `REPLAY_MAX_TICKS` (const)

The longest run a replay may hold: 2^24 ticks, over 77 hours at 60 Hz. Bounds the work a small forged file can
ask of playback (its final delta is one varint).

```ts
const REPLAY_MAX_TICKS: number;
```

#### `ReplayCheck` (interface)

A hash check at a tick: the hash the replay recorded (`expected`) and the hash the re-simulated sim has
(`actual`). A recorded command the sim now rejects reports as `expected: 'accepted'` with the rejection
reason as `actual`.

```ts
interface ReplayCheck {
  readonly expected: string;
  readonly actual: string;
}
```

#### `ReplayCommand` (interface)

A command as a replay stores it: the sim's `Command` without its tick, which the replay's `ticks` entry
carries.

```ts
interface ReplayCommand {
  readonly source: number;
  readonly seq: number;
  readonly type: string;
  readonly payload: unknown;
}
```

#### `ReplayCompression` (interface)

The deflate and inflate a `.replay` file needs. The sim imports no compression library, so callers pass an
adapter (testing/sim has one for Node and one for browsers).

```ts
interface ReplayCompression {
  deflate(bytes: Uint8Array): Promise<Uint8Array>;
  /** Rejects once the output would pass maxBytes, without inflating the rest. */
  inflate(bytes: Uint8Array, maxBytes: number): Promise<Uint8Array>;
}
```

#### `ReplayFormatError` (class)

Bytes that are not a valid `.replay` (M2.3 spec §5). `offset` is the byte where reading failed, when known.

```ts
class ReplayFormatError extends Error {
  readonly offset: number | undefined;
  constructor(message: string, offset?: number, options?: ErrorOptions);
}
```

#### `ReplayHeader` (interface)

The facts a replay needs before it plays: tick rate, seed, the schema and content hashes it was recorded
against, where it starts and how often it checks.

```ts
interface ReplayHeader {
  readonly tickHz: number;
  readonly seed: number;
  /** 16 hex digits, copied from the start snapshot's header. */
  readonly schemaHash: string;
  readonly contentHash: string;
  readonly startTick: number;
  readonly checkEvery: number;
  /** SIM_VERSION when recorded; informational, never compared. */
  readonly framework: string;
  /** Free-form (game, build id); always {} in a golden. */
  readonly meta: Readonly<Record<string, string>>;
}
```

#### `ReplayRecordError` (class)

A recording that cannot be exact: the sim stepped outside the recorder, a payload that is not JSON, and so on.

```ts
class ReplayRecordError extends Error {
  constructor(message: string, options?: ErrorOptions);
}
```

#### `ReplayStepper` (interface)

A replay playing back one tick at a time on its own sim. Create one with `createReplayStepper`, and
`dispose` it when done.

```ts
interface ReplayStepper {
  readonly sim: Sim;
  readonly tick: number;
  readonly done: boolean;
  /** One step. `check` is present at a check tick, the final tick, or when a recorded command was rejected. */
  step(): {
    readonly tick: number;
    readonly result: StepResult;
    readonly check?: ReplayCheck;
  };
  /** Steps to the end; stops at the first failed check. `checks` counts the checks that passed. */
  run(): {
    readonly ok: boolean;
    readonly checks: number;
    readonly failed?: {
      readonly tick: number;
    } & ReplayCheck;
  };
  dispose(): void;
}
```

#### `ReplayStepSetup` (interface)

What a stepper needs to rebuild the recorded sim: the same `plugins` and `content` the recording sim had.

```ts
interface ReplayStepSetup {
  readonly plugins: readonly PluginDef[];
  /** As SimOptions.content: the content the recording sim was given. */
  readonly content?: unknown;
}
```

#### `unpackReplay` (function)

Inflates `.replay` file bytes and decodes them. Throws `ReplayFormatError` for bytes that are not a
deflated replay or that inflate past `maxInflatedBytes` (default `REPLAY_INFLATE_MAX_BYTES`).

```ts
function unpackReplay(bytes: Uint8Array, compression: ReplayCompression, options?: {
  readonly maxInflatedBytes?: number;
}): Promise<Replay>;
```

## `@mcthaydt/automata-testing`

### `import { … } from '@mcthaydt/automata-testing'`

#### `documentScrolls` (function)

The document itself never scrolls; screens scroll inside declared regions.

```ts
function documentScrolls(doc: Document): string[];
```

#### `FakeResizeObserver` (interface)

Controls the fake `ResizeObserver` `installFakeResizeObserver` put in place: report a width to every
observer, then restore the original.

```ts
interface FakeResizeObserver {
  /** Reports `width` to every live observer, for every element it observes. */
  resize(width: number): void;
  restore(): void;
}
```

#### `fakeViewportWindow` (function)

A fake window of the given size. Its `screen` defaults to that size and its `navigator` names no browser.
Resizing and the keyboard fire `resize` on the window and the visual viewport, as a browser does.

```ts
function fakeViewportWindow(size: {
  width: number;
  height: number;
  /** Defaults to the window's starting size. */
  screen?: {
    width: number;
    height: number;
  };
  /** Defaults to a navigator that names no browser. */
  navigator?: object;
}): FakeViewportWindow;
```

#### `FakeViewportWindow` (interface)

A stand-in for the browser window the geometry owner reads: its size, `screen`, `navigator`, visual
viewport and `resize` listeners, with methods to rotate, open the keyboard and count live listeners.

```ts
interface FakeViewportWindow {
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly visualViewport: FakeVisualViewport;
  /** `screen`, which does not move when the page does. */
  readonly screen: {
    readonly width: number;
    readonly height: number;
  };
  /** `navigator`, for corrections that only one browser needs (DuckDuckGo's client-hint brands). */
  readonly navigator: object;
  addEventListener(type: string, listener: Listener): void;
  removeEventListener(type: string, listener: Listener): void;
  /** Rotation, a browser bar, a window drag: both viewports take the new size. */
  resize(width: number, height: number): void;
  /** The on-screen keyboard covers `height` px of the visual viewport; the layout keeps its size. */
  openKeyboard(height: number): void;
  closeKeyboard(): void;
  /** Live listeners on the window and its visual viewport together, to prove disposal. */
  listenerCount(): number;
}
```

#### `FakeVisualViewport` (interface)

The visual viewport of `FakeViewportWindow`: its height (less the keyboard, if open), an offset, and
listeners for `resize`.

```ts
interface FakeVisualViewport {
  readonly height: number;
  readonly offsetTop: number;
  addEventListener(type: string, listener: Listener): void;
  removeEventListener(type: string, listener: Listener): void;
}
```

#### `findClipped` (function)

Each element `selector` names is tall enough for what it holds (a crushed row clips its content).

```ts
function findClipped(root: ParentNode, selector: string): string[];
```

#### `findCutAtSide` (function)

No control is cut at a side of a declared scroll region that clips it (see `clippedBy`). A region scrolls up and
down, so a control past its side is cut where a player would not think to scroll, as a long language's options
were in a Settings list; `findOffscreenControls` passes whatever a region clips, so this is what catches a control
cut across. A region that scrolls sideways on purpose (an editor's strip of scenes) declares
`data-scroll-region="both"`: a control past its side is reached by scrolling it, and the walk out through the
regions around it stops there. A checkbox or radio is judged by its label (`pressedPart`).

```ts
function findCutAtSide(root: ParentNode): string[];
```

#### `findIntrusions` (function)

No visible control intersects a reserved area (Ruken's strip, a keyboard), in viewport px, by its
whole box. The one exception is a control that a declared scroll region clips (see `clippedBy`)
where that region is itself clear of every area: scrolling brings it into view. An undeclared
scroller earns nothing, and a fixed control is measured where it is drawn, whatever it sits inside.

```ts
function findIntrusions(root: ParentNode, rects: readonly LayoutRect[]): string[];
```

#### `findOffscreenControls` (function)

Every visible control is on screen, unless a declared scroll region (`[data-scroll-region]`)
clips it (see `clippedBy`): a fixed control, or one positioned outside the region, is judged
where it is drawn, since scrolling the region would never bring it into view.

```ts
function findOffscreenControls(root: ParentNode): string[];
```

#### `findOverlaps` (function)

Two elements' boxes do not overlap.

```ts
function findOverlaps(a: Element, b: Element): string[];
```

#### `findSmallTargets` (function)

Every visible control is at least `min` square, and a primary (`data-kind="primary"`) at least
`minPrimary` tall. A checkbox or radio is pressed through its label too, so the label is its target.

```ts
function findSmallTargets(root: ParentNode, min: number, minPrimary: number): string[];
```

#### `findUnreachable` (function)

Each element is fully inside the viewport, and the whole of it is in view: a tap at its centre
and at the middle of each edge lands on it or inside it, so nothing covers or clips any part.

```ts
function findUnreachable(elements: readonly Element[]): string[];
```

#### `hostDisplay` (function)

Ruken's display metrics for a hosted game. Defaults are Ruken's own fixture
(`packages/protocol/src/fixtures/display.ts` at b30d31b): a 48 x 56 tab on the right, landscape.

```ts
function hostDisplay(options?: {
  edge?: "left" | "right";
  width?: number;
  scale?: DisplayMetricsPayload["scale"];
  safeArea?: DisplayMetricsPayload["safeArea"];
}): DisplayMetricsPayload;
```

#### `installFakeResizeObserver` (function)

Replaces the global `ResizeObserver` with a fake that reports only the widths you give it, for components
measured under jsdom, which has no layout. Call `restore` when the test ends.

```ts
function installFakeResizeObserver(): FakeResizeObserver;
```

#### `LayoutRect` (interface)

Layout assertions as plain DOM functions (M1.6 spec §3.10), from FloorFifty's
`tests/e2e/support/layout.ts` at 122a220 (`expectReachable`, `expectControlsFit`,
`expectRowsWhole`, `expectApart`, `expectNoDocumentScroll`).

Each returns a list of human-readable problems; `[]` is a pass. They take no test framework, so
the same code runs in Vitest browser mode and inside a Playwright `page.evaluate` bundle. They
measure what a player meets: no scrolling, at the centre of what they would tap. They need a real
layout engine; in jsdom every box is 0x0.

```ts
interface LayoutRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
```

#### `MountedFixture` (interface)

A mounted Svelte fixture: the element it was mounted into and a way to unmount it.

```ts
interface MountedFixture {
  readonly target: HTMLElement;
  /** Unmounts the component; removes the target too when `mountFixture` created it. */
  unmount(): Promise<void>;
}
```

#### `mountFixture` (function)

Mounts a Svelte component with the given props and no renderer or host, and flushes effects so the first
render is finished. Mounts into `target`, or into a new `div` in `document.body`, which `unmount` removes.

```ts
function mountFixture<Props extends Record<string, unknown>>(component: Component<Props>, props: Props, target?: HTMLElement): MountedFixture;
```

#### `pressedPart` (function)

What a player presses for `control`: a checkbox's or radio's label (the theme draws it as the control, and a
press anywhere on it toggles the input), else the control itself.

```ts
function pressedPart(control: HTMLElement): HTMLElement;
```

#### `REFERENCE_SIZES` (const)

The viewports a layout is checked at: phones in both orientations, tablets, desktops, both sides of every
breakpoint and the tightest sizes, each with the classification it should get.

```ts
const REFERENCE_SIZES: readonly ReferenceSize[];
```

#### `ReferenceFormFactor` (type)

`@mcthaydt/automata-ui`'s `FormFactor`.

```ts
type ReferenceFormFactor = "phone-portrait" | "phone-landscape" | "tablet-portrait" | "desktop";
```

#### `ReferenceHeightTier` (type)

`@mcthaydt/automata-ui`'s `HeightTier`.

```ts
type ReferenceHeightTier = "short" | "compact" | undefined;
```

#### `ReferenceSize` (interface)

One viewport every primitive and screen is checked at: a name, its size, and the form factor and height
tier it must classify as.

```ts
interface ReferenceSize {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly formFactor: ReferenceFormFactor;
  readonly heightTier: ReferenceHeightTier;
  readonly group: "phone" | "tablet" | "desktop" | "boundary" | "tight";
}
```

#### `textSnippet` (function)

A Svelte 5 snippet rendering `<tag>text</tag>`, so a test can pass `children`, `body` or an icon
to a component without writing a wrapper component (Ruken `packages/ui/src/test-snippets.ts`).
Text is escaped unless `trusted` is set, for fixture markup such as list rows.

```ts
function textSnippet(text: string, tag?: string, trusted?: boolean): Snippet;
```

#### `TIGHT_SIZES` (const)

Sideways phones shorter than 780x270, where an open keyboard leaves the least room (framework
audit of #7, 2026-10-11). Not resting viewports a screen is laid out for: the overlays that must
keep their actions above a keyboard (ErrorPanel, the boot failure) are checked here too.

```ts
const TIGHT_SIZES: readonly ReferenceSize[];
```

#### `Variant` (interface)

A condition layered over a reference size. Each field that is set applies; the caller turns them
into the geometry owner's inputs (a covered visual viewport, Ruken's display metrics).

```ts
interface Variant {
  readonly name: "rest" | "keyboard" | "host-reserved-right" | "host-reserved-left" | "tv-scale";
  /** Px of the height the on-screen keyboard covers at this size. */
  readonly keyboard?: (size: ReferenceSize) => number;
  /** Ruken's reserved strip (its fixture is 48 px wide). */
  readonly hostReserved?: {
    readonly edge: "left" | "right";
    readonly width: number;
  };
  /** Ruken's TV-mode scale hint. */
  readonly scale?: 1 | 1.333;
}
```

#### `VARIANTS` (const)

The conditions each size is also checked under: at rest, with the on-screen keyboard open, with Ruken's
reserved strip on the right or the left, and at its TV scale.

```ts
const VARIANTS: readonly Variant[];
```

#### `visibleControls` (function)

Controls a player could see and reach: laid out, not hidden, not in an inert subtree.

```ts
function visibleControls(root: ParentNode): HTMLElement[];
```

### `import { … } from '@mcthaydt/automata-testing/e2e'`

#### `Direction` (type)

A direction on the D-pad or the stick.

```ts
type Direction = "up" | "down" | "left" | "right";
```

#### `Engine` (type)

The browser engine a matrix cell runs in.

```ts
type Engine = "chromium" | "webkit" | "firefox";
```

#### `FakePad` (class)

One standard controller in a real browser, driven through the Gamepad API the game itself reads.

```ts
class FakePad {
  private target;
  private constructor();
  /** Installs the fake before any game script runs, in every frame; call before `goto`. The pad starts unplugged. */
  static install(page: Page, options?: FakePadOptions): Promise<FakePad>;
  /** Drives the pad of `frame` from here on: the game's frame under the fake host. */
  in(frame: Page | Frame): this;
  connect(): Promise<void>;
  unplug(): Promise<void>;
  press(button: PadButton, frames?: number): Promise<void>;
  release(button: PadButton): Promise<void>;
  /** Press and release, held for one polled frame. */
  tap(button: PadButton): Promise<void>;
  stick(x: number, y: number, frames?: number): Promise<void>;
  /** Holds a direction on the D-pad or the stick. */
  hold(direction: Direction, mode: PadMode, frames?: number): Promise<void>;
  letGo(direction: Direction, mode: PadMode): Promise<void>;
  /** One step of a direction: held for one polled frame, then let go. */
  step(direction: Direction, mode: PadMode): Promise<void>;
  /** Waits `count` animation frames in the pad's frame, so the game's per-frame poll has run. */
  frames(count?: number): Promise<void>;
  private write;
}
```

#### `FakePadOptions` (interface)

How the fake pad reports itself: its mapping and its id (the id picks the prompts' glyphs).

```ts
interface FakePadOptions {
  /** `''` for a pad the browser does not map to the standard layout. Default `standard`. */
  readonly mapping?: "" | "standard";
  readonly id?: string;
}
```

#### `flick` (function)

A quick vertical swipe of `dy` pixels within `ms` milliseconds from `from` (M4 spec I-f: 40 px in 180 ms).

```ts
function flick(scope: Page | Frame, from: Point, dy: number, ms: number): Promise<void>;
```

#### `hold` (function)

A finger down on `target`'s centre until `until` resolves true (checked once a frame), then up.

```ts
function hold(target: Locator, until: () => Promise<boolean>): Promise<void>;
```

#### `INPUT_MATRIX` (const)

M4 spec §9.1's cells, in table order: 17 cells, 22 journeys (the desktop cells run under both hosts).

```ts
const INPUT_MATRIX: readonly MatrixCell[];
```

#### `InputDevice` (type)

The device a matrix cell plays with.

```ts
type InputDevice = "keyboard" | "gamepad" | "touch";
```

#### `MatrixCell` (interface)

One cell of the input × form-factor matrix: a form factor, a device and an engine, and the hosts it runs under.

```ts
interface MatrixCell {
  /** `<form factor>-<device>-<engine>`, for example `phone-portrait-touch-webkit`. */
  readonly id: string;
  readonly formFactor: MatrixFormFactor;
  readonly viewport: {
    readonly width: number;
    readonly height: number;
  };
  readonly device: InputDevice;
  readonly engine: Engine;
  readonly hosts: readonly MatrixHost[];
  /** M4-D11: the cells that run locally and in hosted CI; the rest belong to the GPU runner's nightly. */
  readonly local: boolean;
}
```

#### `MatrixFormFactor` (type)

A matrix cell's form factor, each with one viewport (M4 spec §9.1).

```ts
type MatrixFormFactor = "phone-portrait" | "phone-landscape" | "compact" | "tablet-portrait" | "desktop";
```

#### `MatrixHost` (type)

Where a journey runs: under the fake Ruken host, or standalone.

```ts
type MatrixHost = "fake-ruken" | "standalone";
```

#### `PAD_BUTTONS` (const)

The standard mapping's buttons by name: south (A on an Xbox pad) is 0, Start is 9, the D-pad 12 to 15.

```ts
const PAD_BUTTONS: {
  readonly south: 0;
  readonly east: 1;
  readonly west: 2;
  readonly north: 3;
  readonly lb: 4;
  readonly rb: 5;
  readonly lt: 6;
  readonly rt: 7;
  readonly select: 8;
  readonly start: 9;
  readonly ls: 10;
  readonly rs: 11;
  readonly dpadUp: 12;
  readonly dpadDown: 13;
  readonly dpadLeft: 14;
  readonly dpadRight: 15;
  readonly home: 16;
};
```

#### `PadButton` (type)

A standard-mapping button by name.

```ts
type PadButton = keyof typeof PAD_BUTTONS;
```

#### `PadMode` (type)

Whether a direction is held on the D-pad or the left stick.

```ts
type PadMode = "dpad" | "stick";
```

#### `Point` (interface)

A point in the target frame's own CSS pixels.

```ts
interface Point {
  readonly x: number;
  readonly y: number;
}
```

#### `swipe` (function)

A finger from `from` to `to` over `ms` milliseconds, one move a frame, on whatever is under it.

```ts
function swipe(scope: Page | Frame, from: Point, to: Point, ms: number): Promise<void>;
```

#### `tap` (function)

A finger down on `target`'s centre and straight up again.

```ts
function tap(target: Locator): Promise<void>;
```

### `import { … } from '@mcthaydt/automata-testing/input'`

#### `fakeGamepads` (function)

`target` hears `gamepadconnected` and `gamepaddisconnected`, as `window` does in a browser.

```ts
function fakeGamepads(options?: {
  readonly target?: EventTarget;
}): FakeGamepads;
```

#### `FakeGamepads` (interface)

Four gamepad slots a unit test plugs pads into and presses; `getGamepads` reads them as the browser's would.

```ts
interface FakeGamepads {
  readonly getGamepads: () => (Gamepad | null)[];
  /** Puts a pad at rest in `index` (0 by default): standard, unless `mapping` says otherwise. */
  connect(index?: number, options?: {
    readonly mapping?: "" | "standard";
    readonly id?: string;
  }): void;
  unplug(index?: number): void;
  press(button: number, value?: number, index?: number): void;
  release(button: number, index?: number): void;
  /** The left stick. */
  stick(x: number, y: number, index?: number): void;
}
```

### `import { … } from '@mcthaydt/automata-testing/sim'`

#### `Difference` (interface)

One difference between two snapshot views: its kind, where it is (`entity 4 bounce.ball.vx`), the entity's
sid when it is an entity, and both values as printed.

```ts
interface Difference {
  readonly kind: "header" | "rng" | "resource" | "entity" | "plugin";
  /** What differs, as printed: "entity 4 bounce.ball.vx", "resource bounce.stats.bounces". */
  readonly at: string;
  /** For entity differences, the entity's sid. */
  readonly sid?: number;
  readonly expected: string;
  readonly actual: string;
}
```

#### `diffSnapshotViews` (function)

Every difference between an expected and an actual snapshot view, field by field, in a fixed order (header,
rng, resources, next id, entities, plugin bytes) so a report reads the same in every engine. Empty when
they are equal.

```ts
function diffSnapshotViews(expected: SnapshotView, actual: SnapshotView): Difference[];
```

#### `expectGolden` (function)

Throws with the formatted report unless the golden matched or was just written.

```ts
function expectGolden(report: GoldenReport): void;
```

#### `formatGoldenReport` (function)

One report as text: a line for most outcomes, and for a divergence the tick and up to 20 differences.

```ts
function formatGoldenReport(report: GoldenReport): string;
```

#### `GOLDEN_MAX_PACKED_BYTES` (const)

A golden that passes this cannot be reviewed or loaded cheaply; lower snapshotEvery's cost instead.

```ts
const GOLDEN_MAX_PACKED_BYTES: number;
```

#### `goldenCommands` (function)

The Vitest browser commands that let golden tests read golden files in a browser: register them with
`browser: { commands: goldenCommands() }`. Only `.golden.json` and `.replay` files inside the project root
can be read, and nothing can be written.

```ts
function goldenCommands(options?: GoldenCommandsOptions): Record<string, BrowserCommand<[path: string], Promise<string | null>>>;
```

#### `GoldenReport` (type)

What a golden check found: `pass`, `written`, `missing`, `schema-changed`, `content-changed`,
`setup-changed` or `diverged` (with the first differing tick and the fields that differ).

```ts
type GoldenReport = {
  readonly name: string;
} & ({
  readonly kind: "pass";
  readonly checks: number;
} | {
  readonly kind: "written";
  readonly file: string;
  readonly bytes: number;
} | {
  readonly kind: "missing";
  readonly file: string;
} | {
  readonly kind: "schema-changed" | "content-changed";
  readonly expected: string;
  readonly actual: string;
} | {
  readonly kind: "setup-changed";
  readonly field: "seed" | "tickHz" | "ticks" | "every";
  readonly expected: number;
  readonly actual: number;
} | {
  readonly kind: "diverged";
  /** The first tick whose hash differs (the tick after the step), or the failed check when not exact. */
  readonly firstTick: number;
  readonly lastGoodTick: number;
  readonly exact: boolean;
  /** The tick the differences were taken at, when that is not firstTick. */
  readonly diffTick?: number;
  readonly differences: readonly Difference[];
});
```

#### `nodeCompression` (const)

Node only. zlib is imported when first used, so importing this module in a browser costs nothing.

```ts
const nodeCompression: ReplayCompression;
```

#### `replayGolden` (function)

Replays a golden `.replay` against the current sim and reports whether it still matches. With reference
data a divergence names the exact tick and every field that differs. With `AUTOMATA_UPDATE_GOLDENS=1` in
Node and a `record` option it records the file first, then checks what it wrote. A mismatch is a report, not
a throw: pass it to `expectGolden`.

```ts
function replayGolden(options: ReplayGoldenOptions): Promise<GoldenReport>;
```

#### `ReplayGoldenOptions` (interface)

What `replayGolden` checks: the `.replay` file, the plugins and content to replay it with, and how to
record it when updating goldens.

```ts
interface ReplayGoldenOptions {
  /** A deflated `.replay`; a relative path is taken from the test file's folder. */
  readonly file: string;
  readonly plugins: readonly PluginDef[];
  readonly content?: unknown;
  /**
   * How to record the golden when updating (Node, AUTOMATA_UPDATE_GOLDENS=1); absent for replays recorded
   * elsewhere. Either seed/tickHz/setup, or `create`, a game's own sim factory.
   */
  readonly record?: RecordFrom & {
    readonly drive: (recorder: Recorder, sim: Sim) => void | Promise<void>;
    /** A reference snapshot every this many ticks (default 1, so a divergence is diffed at its exact tick). */
    readonly snapshotEvery?: number;
  };
}
```

#### `RoundTripFailure` (interface)

One case whose restored run differed from the uninterrupted one: its number, sim seed, length, restore
tick, variant and a report of what differed.

```ts
interface RoundTripFailure {
  readonly case: number;
  readonly simSeed: number;
  readonly ticks: number;
  readonly at: number;
  readonly variant: RoundTripVariant;
  readonly report: string;
}
```

#### `RoundTripOptions` (interface)

What `snapshotRoundTripProperty` runs: the plugins, content and a command script, and how many cases of
what length to try.

```ts
interface RoundTripOptions {
  readonly plugins: readonly PluginDef[];
  readonly content?: unknown;
  readonly tickHz?: number;
  /** Builds each case's world; `rng` is derived from the case's sim seed. */
  readonly setup?: (sim: Sim, rng: Rng) => void;
  readonly script: (tick: number, rng: Rng) => readonly Command[];
  /** Default 200. */
  readonly cases?: number;
  /** Each case runs 1..maxTicks ticks (default 300). */
  readonly maxTicks?: number;
  /** Chooses which cases run (default 1). */
  readonly seed?: number;
}
```

#### `RoundTripVariant` (type)

How a case restores: into a `fresh` sim, or into one that has `dirty` (stepped on past the snapshot).

```ts
type RoundTripVariant = "fresh" | "dirty";
```

#### `simGolden` (function)

Plays a scripted run and compares the sim's hash every `every` ticks with the golden JSON file, reporting
the first recorded tick that differs. With `AUTOMATA_UPDATE_GOLDENS=1` in Node it records the file. Throws
for an `every` that is not an integer of 1 or more; a mismatch is a report, not a throw.

```ts
function simGolden(options: SimGoldenOptions): Promise<GoldenReport>;
```

#### `SimGoldenOptions` (interface)

What `simGolden` runs: the plugins, content, seed and scripted commands to play for `ticks` ticks, where
the golden JSON lives, and how often to record a hash.

```ts
interface SimGoldenOptions {
  readonly name: string;
  /** The golden is <dir>/__goldens__/<name>.golden.json; a relative dir is taken from the test file's folder. */
  readonly dir: string;
  readonly plugins: readonly PluginDef[];
  readonly content?: unknown;
  readonly seed: number;
  readonly tickHz?: number;
  readonly setup?: (sim: Sim) => void;
  /** Commands for each tick; `rng` is a stream of its own, derived from the seed. */
  readonly script: (tick: number, rng: Rng) => readonly Command[];
  readonly ticks: number;
  /** Record a hash every this many ticks (default 1). */
  readonly every?: number;
}
```

#### `snapshotRoundTripProperty` (function)

Checks that snapshot, restore and continue equals an uninterrupted run, over many seeds, run lengths and
restore points, alternating fresh and dirty restores. Returns `{ failures }`; an empty list means the
property held.

```ts
function snapshotRoundTripProperty(options: RoundTripOptions): Promise<{
  readonly failures: readonly RoundTripFailure[];
}>;
```

#### `streamCompression` (const)

Browsers and Node: CompressionStream / DecompressionStream('deflate-raw').

```ts
const streamCompression: ReplayCompression;
```

### `import { … } from '@mcthaydt/automata-testing/sim/commands'`

#### `goldenCommands` (function)

The Vitest browser commands that let golden tests read golden files in a browser: register them with
`browser: { commands: goldenCommands() }`. Only `.golden.json` and `.replay` files inside the project root
can be read, and nothing can be written.

```ts
function goldenCommands(options?: GoldenCommandsOptions): Record<string, BrowserCommand<[path: string], Promise<string | null>>>;
```

#### `GoldenCommandsOptions` (interface)

Options for {@link goldenCommands}.

```ts
interface GoldenCommandsOptions {
  /**
   * The folder golden files must be inside; defaults to the Vitest project's root. A package whose goldens sit
   * beside it rather than under it names an absolute folder holding both.
   */
  readonly root?: string;
}
```

### `import { … } from '@mcthaydt/automata-testing/sim/property'`

#### `RoundTripFailure` (interface)

One case whose restored run differed from the uninterrupted one: its number, sim seed, length, restore
tick, variant and a report of what differed.

```ts
interface RoundTripFailure {
  readonly case: number;
  readonly simSeed: number;
  readonly ticks: number;
  readonly at: number;
  readonly variant: RoundTripVariant;
  readonly report: string;
}
```

#### `RoundTripOptions` (interface)

What `snapshotRoundTripProperty` runs: the plugins, content and a command script, and how many cases of
what length to try.

```ts
interface RoundTripOptions {
  readonly plugins: readonly PluginDef[];
  readonly content?: unknown;
  readonly tickHz?: number;
  /** Builds each case's world; `rng` is derived from the case's sim seed. */
  readonly setup?: (sim: Sim, rng: Rng) => void;
  readonly script: (tick: number, rng: Rng) => readonly Command[];
  /** Default 200. */
  readonly cases?: number;
  /** Each case runs 1..maxTicks ticks (default 300). */
  readonly maxTicks?: number;
  /** Chooses which cases run (default 1). */
  readonly seed?: number;
}
```

#### `RoundTripVariant` (type)

How a case restores: into a `fresh` sim, or into one that has `dirty` (stepped on past the snapshot).

```ts
type RoundTripVariant = "fresh" | "dirty";
```

#### `snapshotRoundTripProperty` (function)

Checks that snapshot, restore and continue equals an uninterrupted run, over many seeds, run lengths and
restore points, alternating fresh and dirty restores. Returns `{ failures }`; an empty list means the
property held.

```ts
function snapshotRoundTripProperty(options: RoundTripOptions): Promise<{
  readonly failures: readonly RoundTripFailure[];
}>;
```

## `@mcthaydt/automata-ui`

### `import { … } from '@mcthaydt/automata-ui'`

#### `ActionBar` (const)

One row of actions that collapses as its container narrows (M1.6 spec §3.4; from FloorFifty
`ui/layout/ActionBar.svelte` at 122a220).

It gives way in a fixed order as its container narrows (`collapseLevel`): utilities to their icon,
then secondaries to their short label, and only then a wrap with the primary on its own row.
Three hidden, inert copies of the row ([data-measure]) report how wide it would be at each level,
so the choice is measured rather than guessed from breakpoints.

```ts
const ActionBar: import("svelte").Component<Props, {}, "">;
type ActionBar = ReturnType<typeof ActionBar>;
```

#### `ActionKind` (type)

The action bar's model (M1.6 spec §3.4; from FloorFifty `ui/layout/action-bar.ts` at 122a220).

One row of actions that gives way in a fixed order as its container narrows, so the primary
action is the last thing to lose its words:
  0. every label in full;
  1. utility actions drop to their icon;
  2. secondary actions take their short label;
  3. it wraps, with the primary alone on the first row.
Level 3 is a fallback: the layout contracts fail any reference size where a bar reaches it.

```ts
type ActionKind = 'primary' | 'secondary' | 'utility';
```

#### `applyGeometry` (function)

Writes the geometry where CSS reads it (spec §3.2). Only the geometry owner calls this.

```ts
function applyGeometry(root: HTMLElement, geometry: Geometry): void;
```

#### `arrowKeyNav` (function)

The menu direction an arrow key walks, as a d-pad would, or undefined when the key is not a bare
arrow or its target keeps that arrow. Up and Down always walk off an input, so no slider, radio
group or text field can hold focus; Left and Right stay with a slider or radio group, and with a
text field until its caret meets the end the arrow points at. Multi-line text keeps every arrow.

```ts
function arrowKeyNav(event: KeyboardEvent): NavDirection | undefined;
```

#### `AUDIO_BUSES` (const)

The buses the Audio group offers, in the order it shows them.

```ts
const AUDIO_BUSES: readonly AudioBus[];
```

#### `AudioBus` (type)

An audio bus (runtime's `AudioBusName`).

```ts
type AudioBus = 'master' | 'music' | 'sfx' | 'ui' | 'voice';
```

#### `AudioCopy` (interface)

Every word the Audio group shows, in the game's language.

```ts
interface AudioCopy {
    readonly title: string;
    readonly mute: string;
    /** FloorFifty's "Mute in background": silent while another window has focus. */
    readonly muteUnfocused: string;
    /** A toggle's state words. */
    readonly on: string;
    readonly off: string;
    readonly buses: Readonly<Record<AudioBus, string>>;
    /** A gain as the player reads it: "50%". */
    percent(value: number): string;
    /** When sound could not start (A-e). */
    readonly unavailable: string;
    /** While the host's own volume is below full. */
    readonly hostVolume: string;
}
```

#### `AudioSection` (const)

The Audio group of the Settings tab (M5 spec §7, M5.4), laid out as FloorFifty's (`SettingsPanel.svelte` at
a28dc44): Mute, Mute in the background, then a slider per bus with its percentage. Every change is reported at
once (`onchange`); the game applies and saves it, so there is no Apply. When sound could not start
(`available` false, A-e) the group says so and its controls stay shown but disabled. While the host's own volume is
below full, a note says it also applies, so a quiet game is not taken for a broken slider.

```ts
const AudioSection: import("svelte").Component<Props, {}, "">;
type AudioSection = ReturnType<typeof AudioSection>;
```

#### `AudioSectionChange` (type)

One change in the Audio group: a toggle's new state, or a bus's new gain.

```ts
type AudioSectionChange = {
    readonly kind: 'muted';
    readonly value: boolean;
} | {
    readonly kind: 'muteUnfocused';
    readonly value: boolean;
} | {
    readonly kind: 'gain';
    readonly bus: AudioBus;
    readonly value: number;
};
```

#### `AudioValue` (interface)

The player's audio choices (runtime's `AudioSettings`): the mutes, and a gain per bus from 0 to 1.

```ts
interface AudioValue {
    readonly muted: boolean;
    readonly muteUnfocused: boolean;
    readonly gains: Readonly<Record<AudioBus, number>>;
}
```

#### `BarAction` (interface)

One action in an `ActionBar`: an id, a label and a kind (`primary`, `secondary` or `utility`), what it does
when selected, and optionally a short label, an icon, a disabled state and a pressed state.

```ts
interface BarAction {
    readonly id: string;
    readonly label: string;
    /** What a secondary action says from level 2 ("Replay" for "Watch replay"). */
    readonly shortLabel?: string | undefined;
    /** A utility's icon; from level 1 the icon alone stands for it, and the label stays its name. */
    readonly icon?: Snippet | undefined;
    readonly kind: ActionKind;
    /** Receives the click, so an action can act on its own button. */
    readonly onSelect: (event: MouseEvent) => void;
    readonly disabled?: boolean | undefined;
    /** A toggle's state, rendered as `aria-pressed`. */
    readonly pressed?: boolean | undefined;
    /** Defaults to `id`. */
    readonly testId?: string | undefined;
}
```

#### `BarSample` (type)

One reading of the viewport, as `HiddenBrowserBar.measure` needs it.

```ts
type BarSample = {
    /** `screen.height`, in CSS pixels, for the current orientation. */
    screenHeight: number;
    innerHeight: number;
    portrait: boolean;
    /** A text field has focus. This browser shrinks the whole page for its keyboard. */
    editing: boolean;
    /** The page is fullscreen, where it legitimately reaches the screen edge. */
    fullscreen: boolean;
    /** The size has stopped moving since the last reading. */
    settled: boolean;
};
```

#### `BOOT_FAILURE_COPY_EN` (const)

English defaults in Ruken's tone (quiet, human, no blame); replaced by Paraglide keys in M5. `{host}` is filled
with the host's name (`Hosting.hostName`: 'Ruken', 'itch.io' …) by `withHostName`.

```ts
const BOOT_FAILURE_COPY_EN: BootFailureCopy;
```

#### `bootDeviceClass` (function)

The device class at boot, read from the window's pointer and screen; `desktop` when the window cannot
answer.

```ts
function bootDeviceClass(win?: Window): DeviceClass;
```

#### `BootFailure` (type)

The structural view of the runtime's boot error that the UI draws: one of six tagged cases, so ui never
imports the runtime.

```ts
type BootFailure = {
    readonly _tag: 'HostError';
    readonly code: ErrorCode;
    readonly retryable: boolean;
    readonly operation: string;
} | {
    readonly _tag: 'ContentHashMismatch';
    readonly expected: string;
    readonly actual: string;
} | {
    readonly _tag: 'AssetLoadFailed';
    readonly url: string;
    readonly status: number;
} | {
    readonly _tag: 'LoadStalled';
    readonly url: string;
    readonly bytesSoFar: number;
    readonly stalledMs: number;
} | {
    readonly _tag: 'RendererUnavailable';
    readonly tried: readonly ('webgl2' | 'webgpu')[];
} | {
    readonly _tag: 'BootDefect';
}
/** A 3D model file that could not be read (M3 spec §6): `file` is its url, `reason` why. */
 | {
    readonly _tag: 'ModelInvalid';
    readonly file: string;
    readonly reason: string;
};
```

#### `BootFailureAction` (type)

Try again, Continue without loading, Back to {host}.

```ts
type BootFailureAction = 'retry' | 'continue' | 'exit';
```

#### `BootFailureCopy` (type)

The words for every boot failure state and action, by name. `BOOT_FAILURE_COPY_EN` holds the English
defaults.

```ts
type BootFailureCopy = Readonly<Record<BootFailureState | BootFailureAction, string>>;
```

#### `BootFailurePanel` (const)

The state a boot failure draws (M1 shared contracts §3; M1.6 spec §3.6): an ErrorPanel with the
failure's copy and its ways forward. The runtime passes its `BootError` and the handlers; this
component decides nothing beyond `bootFailureView`.

```ts
const BootFailurePanel: import("svelte").Component<Props, {}, "">;
type BootFailurePanel = ReturnType<typeof BootFailurePanel>;
```

#### `BootFailureState` (type)

What a boot failure draws: `start`, `connect`, `progress`, `damaged`, `download`, `download-stalled`,
`unsupported` or `model-invalid`.

```ts
type BootFailureState = 'start' | 'connect' | 'progress' | 'damaged' | 'download' | 'download-stalled' | 'unsupported' | 'model-invalid';
```

#### `bootFailureView` (function)

Which state a failure draws and which ways forward it offers. `canExit` is whether the host granted `exit`;
without it "Back to …" is never offered (PUB spec §3.1).

- Host start (`init`): `Ruken.init` threw. Try again when Ruken says a retry can succeed;
  otherwise it is a build or config fault (a bad `gameId` or `wants`) the player cannot fix, so
  the panel is final. A failed in-frame handshake is not an error: the SDK falls back to standalone.
- Storage (`saves.*`): Try again when Ruken says a retry can succeed. Otherwise a standalone page
  may go on without the saved progress; inside Ruken the way forward is Back to Ruken, because
  playing on without the player's saves would silently fork their progress.
- Renderer: nothing on this device can fix it. Inside Ruken the player goes back; a standalone
  page has nowhere to go, so its panel is final.
- Model: a 3D model file did not parse (M3 spec §6). Try again fetches it again in a fresh boot; when the file
  stays damaged, the host's way out is offered beside it.
- Everything else: Try again, which re-runs the boot program in a fresh scope (never a page reload
  inside a Ruken frame).

```ts
function bootFailureView(failure: BootFailure, hostKind: HostKind, canExit: boolean): BootFailureViewModel;
```

#### `BootFailureViewModel` (interface)

What `bootFailureView` decides for a failure: the state to draw and the ways forward, in order. No actions
means the panel is final.

```ts
interface BootFailureViewModel {
    readonly state: BootFailureState;
    readonly actions: BootFailureAction[];
}
```

#### `Button` (const)

The framework's button (M4 spec §4.12): an `.af-control` of one kind. A primary carries
`data-kind="primary"`, which both sizes it to the 48 px primary target and tells the layout check
to hold it to that size. The words are the caller's, in the game's language.

```ts
const Button: import("svelte").Component<Props, {}, "">;
type Button = ReturnType<typeof Button>;
```

#### `CameraDragSurface` (const)

The camera drag surface (M4 spec §16.3.7, M3 spec §4.2 and §7): the player turns the camera by dragging the scene,
a finger anywhere outside the controls or the mouse with its secondary button.

All the rules of who drags are the tracker's (runtime `CameraDragTracker`); this forwards pointer events with their
`clientX`. It is a fixed layer drawn under the play screen's controls, so a contact on a touch button, the stick,
the corner controls or an ActionBar never reaches it, and its box stops short of the host's reserved strip and of
what the browser lays over the page's foot, so a drag never starts inside `hostReserved`. Pointer only, never in
the focus order.

```ts
const CameraDragSurface: import("svelte").Component<CameraDragSurfaceProps, {}, "">;
type CameraDragSurface = ReturnType<typeof CameraDragSurface>;
```

#### `CameraDragSurfaceProps` (interface)

CameraDragSurface's props.

```ts
interface CameraDragSurfaceProps {
    tracker: DragTracker;
    testId?: string | undefined;
}
```

#### `Chip` (const)

A short status label (M4 spec §4.12). Its tone is `data-tone` and an edge colour, and never only
that: every tone but `info` also shows a glyph a sighted player reads and says `toneLabel` to
assistive technology, so the tone survives with every colour removed. A warning or danger chip
without words throws while it mounts.

```ts
const Chip: import("svelte").Component<Props, {}, "">;
type Chip = ReturnType<typeof Chip>;
```

#### `classifyDevice` (function)

A fine primary pointer is a `desktop`; a coarse one is a `phone` when the screen's shorter side is under
600 px, otherwise a `tablet`.

```ts
function classifyDevice(input: {
    coarse: boolean;
    screenWidth: number;
    screenHeight: number;
}): DeviceClass;
```

#### `classifyFormFactor` (function)

The form factor of a layout viewport: a portrait one narrower than 600 px is `phone-portrait`, any other
portrait one `tablet-portrait`; a landscape one shorter than 500 px is `phone-landscape`, otherwise
`desktop`. A square viewport is landscape.

```ts
function classifyFormFactor(width: number, height: number): FormFactor;
```

#### `classifyHeightTier` (function)

The height tier of a layout height in CSS px: `compact` below 340, `short` up to 600, otherwise
`undefined`.

```ts
function classifyHeightTier(height: number): HeightTier;
```

#### `CollapseLevel` (type)

How far an action bar has collapsed: 0 every label in full, 1 utilities as icons, 2 secondaries on their
short labels, 3 wrapped with the primary on its own row.

```ts
type CollapseLevel = 0 | 1 | 2 | 3;
```

#### `collapseLevel` (function)

The first level whose one-row width fits. `widths` are the bar's unwrapped widths at levels 0, 1 and 2.

```ts
function collapseLevel(available: number, widths: readonly [number, number, number]): CollapseLevel;
```

#### `COMPACT_MAX_HEIGHT` (const)

Below this, compact: what a browser leaves a sideways phone (780 x 270 Chrome on a Galaxy,
667 x 320 Safari on an SE). 844 x 340, Safari on an iPhone 14, sits exactly on it and stays short.

```ts
const COMPACT_MAX_HEIGHT = 340;
```

#### `ControlsCopy` (interface)

Every word the Controls section shows, in the game's language.

```ts
interface ControlsCopy {
    readonly title: string;
    /** Each device section's heading. */
    readonly keyboard: string;
    readonly gamepad: string;
    readonly touch: string;
    /** The mark on the section of the device in the player's hand. */
    readonly inUse: string;
    readonly reset: string;
    /** On the button that waits for a press. */
    readonly press: string;
    /** A rebind button's name for assistive technology: "Change Jump on Keyboard". */
    rebind(action: string, device: string): string;
    capturing(action: string, device: string, secondsLeft: number): string;
    conflict(action: string, other: string): string;
    reserved(action: string): string;
    timedOut(action: string): string;
    saved(action: string): string;
}
```

#### `controlsMessage` (function)

The section's status line for `state`, with actions by their labels; empty in the list.

```ts
function controlsMessage(state: ControlsState, copy: ControlsCopy, labelOf: (action: string) => string): string;
```

#### `ControlsRow` (interface)

One game action in the Controls section: its id, its name and its bindings now.

```ts
interface ControlsRow {
    /** The action's id, as `onrebind` reports it. */
    readonly id: string;
    readonly label: string;
    readonly binding: PromptBinding;
}
```

#### `ControlsSection` (const)

The Controls tab's section (M4 spec §4.5, §7), laid out as FloorFifty's Controls tab (`SettingsPanel.svelte` at
a28dc44): one section per device the player can use, the one in their hand first and marked. Keyboard and
Controller list each action with one rebind button showing that device's prompt; the Controller appears once a pad
has connected (`devices`). Touch, when shown, says what the on-screen buttons do; they are the game's, so there is
nothing to rebind (§4.5). A status line says each step of a rebind (`state`), and Reset puts every binding back.
Every row is a 44 px target; long labels wrap, and the targets never shrink.

```ts
const ControlsSection: import("svelte").Component<Props, {}, "">;
type ControlsSection = ReturnType<typeof ControlsSection>;
```

#### `ControlsState` (type)

Where a rebind is: the list; waiting for a press (with the seconds left); refused because it would leave `with`
unbound; refused as reserved; timed out; or saved.

```ts
type ControlsState = {
    readonly kind: 'list';
} | {
    readonly kind: 'capturing';
    readonly action: string;
    readonly device: RebindDevice;
    readonly secondsLeft: number;
} | {
    readonly kind: 'conflict';
    readonly action: string;
    readonly with: string;
} | {
    readonly kind: 'reserved';
    readonly action: string;
} | {
    readonly kind: 'timed-out';
    readonly action: string;
} | {
    readonly kind: 'saved';
    readonly action: string;
};
```

#### `ControlsTouchMode` (type)

How touch drives play (runtime's `TouchMode`).

```ts
type ControlsTouchMode = 'buttons' | 'swipe';
```

#### `CornerControls` (const)

Back at the start, the game's own corner controls (Mute, a language flag) at the end, in the
same row on every screen (M1.6 spec §3.4; from FloorFifty `ui/layout/CornerControls.svelte` at
122a220). A screen does not render its own. `header` sits between them in the same row, on the
screen's centre line, so a short screen spends no row of its own on it.

```ts
const CornerControls: import("svelte").Component<Props, {}, "">;
type CornerControls = ReturnType<typeof CornerControls>;
```

#### `createGeometryOwner` (function)

Creates the geometry owner of a document, the only writer of its geometry: make one per document. It measures
at once, on every resize of the window or the visual viewport, and again at 100, 400 and 1000 ms as bars and
the keyboard settle, and publishes each measure on the root.

```ts
function createGeometryOwner(options: GeometryOwnerOptions): GeometryOwner;
```

#### `CURSOR_IDLE_MS` (const)

How long the pointer must be still before it hides on a gameplay screen.

```ts
const CURSOR_IDLE_MS = 2000;
```

#### `cursorHidden` (function)

Whether the pointer is hidden now: on a gameplay screen, not paused, and the pointer unused or idle.

```ts
function cursorHidden(state: {
    kind: ScreenKind | undefined;
    paused: boolean;
    lastInput: CursorInput;
    msSincePointerMove: number;
}): boolean;
```

#### `CursorInput` (type)

The device the player used last, as the cursor policy sees it.

```ts
type CursorInput = 'pointer' | 'keyboard' | 'gamepad' | 'touch';
```

#### `CursorRunner` (class)

Applies `cursorHidden` to a target element: `attach` follows pointer moves and key presses, and each `tick` sets the
element's `cursor` style. Detaching shows the pointer again.

```ts
class CursorRunner {
    private readonly target;
    private readonly options;
    private lastInput;
    private movedAt;
    private readonly now;
    constructor(target: HTMLElement, options?: {
        now?: () => number;
        kind?: () => ScreenKind | undefined;
        paused?: () => boolean;
    });
    noteInput(input: CursorInput): void;
    attach(events?: EventTarget): () => void;
    tick(): void;
}
```

#### `defaultSlot` (function)

The newest slot that can be continued; else the first slot; else none.

```ts
function defaultSlot(slots: readonly SaveSlotView[]): number | undefined;
```

#### `DeviceClass` (type)

The kind of device the player holds: `phone`, `tablet` or `desktop`, decided once at boot.

```ts
type DeviceClass = 'phone' | 'tablet' | 'desktop';
```

#### `Dialog` (const)

A question that needs an answer before the screen goes on (M1.6 spec §3.4; from Ruken
`packages/ui/src/Dialog.svelte` at b30d31b). The screen renders it only while it is open
(`{#if open}<Dialog>`) and decides what each action does; `onclose` is what Escape means, and it
should mean the safe choice.

Keyboard and focus (the rules live in `modal-scope.ts`, which Modal and Sheet share):
- Initial focus goes to the control marked `data-initial-focus` (the safe action), else the
  first control, else the dialog itself.
- Tab and Shift+Tab wrap inside the dialog, and focus that lands outside it is pulled back in.
  The scrim covers the page, so a pointer cannot reach out either.
- When the dialog goes away, focus returns to whatever had it before the dialog opened.
- Escape calls `onclose`. The focus navigator's Back arrives as Escape, so a controller closes
  it the same way. With dialogs stacked, only the topmost answers Escape and holds focus.
- While it is open the page behind it is `inert` (every sibling of the dialog and of each of its
  ancestors up to the body), so assistive technology and the browser cannot reach it either.

Layout: a sheet on the bottom edge on a phone, centred otherwise; always inside the insets and
above the keyboard. Its body is a declared scroll region, so on a 780 x 270 screen the actions
stay reachable however long the text is.

```ts
const Dialog: import("svelte").Component<Props, {}, "">;
type Dialog = ReturnType<typeof Dialog>;
```

#### `DISPLAY_QUALITIES` (const)

The tiers the Display section offers, best first.

```ts
const DISPLAY_QUALITIES: readonly DisplayQuality[];
```

#### `DisplayCopy` (interface)

Every word the Display section shows, in the game's language.

```ts
interface DisplayCopy {
    readonly title: string;
    /** The quality choice's name. */
    readonly quality: string;
    readonly qualities: Readonly<Record<DisplayQuality, string>>;
    /** Reduced motion as the browser reports it: "Reduced motion: on (from your device)". */
    reducedMotion(reduced: boolean): string;
}
```

#### `DisplayQuality` (type)

A graphics quality tier (runtime's `QualityTier`).

```ts
type DisplayQuality = 'high' | 'medium' | 'low';
```

#### `DisplaySection` (const)

The Display section of Settings (M4 spec §4.8, §7): the graphics quality tier as an option group (a pad's `adjust`
cycles it), and reduced motion as the browser reports it. Reduced motion is the player's system setting, so it is
shown and never changed here.

```ts
const DisplaySection: import("svelte").Component<Props, {}, "">;
type DisplaySection = ReturnType<typeof DisplaySection>;
```

#### `DragTracker` (interface)

What a CameraDragSurface drives (M4 spec §16.3.7): runtime's `CameraDragTracker` satisfies it, so ui need not
import runtime. `down` answers whether the pointer now drives the drag (a finger's primary contact, the mouse's
secondary button, none already dragging).

```ts
interface DragTracker {
    down(id: number, x: number, start: {
        readonly pointerType: string;
        readonly button: number;
    }): boolean;
    move(id: number, x: number): void;
    up(id: number): void;
    cancel(): void;
}
```

#### `endonymOf` (function)

A language's name in its own language ("日本語" for `ja`), from the browser's `Intl.DisplayNames`. An engine without
it, or a tag it cannot name, gives the tag back, so the picker never shows nothing.

```ts
function endonymOf(tag: string): string {
  try {
    const name = new Intl.DisplayNames([tag], { type: 'language' }).of(tag)
    if (name === undefined || name === tag) return tag
    // Some engines start a name in lower case ("español"); a picker shows it as a name.
    return name.charAt(0).toLocaleUpperCase(tag) + name.slice(1)
  } catch {
    return tag
  }
}
```

#### `enterFullscreen` (function)

Enters element fullscreen, then asks for a landscape lock, which most phones refuse outside an installed app. A
refusal of either changes nothing: the game plays in the window (M4 spec §6).

```ts
function enterFullscreen(doc: Document, screen?: Screen): Promise<void>;
```

#### `ErrorAction` (interface)

One way forward from a failure (M1.6 spec §3.4).

```ts
interface ErrorAction {
    readonly id: string;
    readonly label: string;
    readonly kind: 'primary' | 'secondary';
    readonly onSelect: () => void;
}
```

#### `ErrorCode` (type)

Ruken's error code. The SDK exports the class, not the alias.

```ts
type ErrorCode = RukenError['code'];
```

#### `ErrorPanel` (const)

A failure, and what the player can do about it (M1.6 spec §3.4; from FloorFifty
`ui/components/ErrorPanel.svelte` at 122a220).

`role="alert"` rather than `role="status"`, because this interrupts: the player usually just
pressed something and needs to know it did not work. The panel is opaque, because a failure is
often the thing that means the artwork did not arrive. It sits at the top of the visible region,
under the corner row, so it never covers the way out of the screen it reports on, and its layer
passes taps through everywhere but the panel.

Where the room is short (a long message, a keyboard), the panel gives up space in this order:
first the message, which scrolls, down to one visible line; only then the gap that keeps it under
the corner row, so it rises over Back only when its actions cannot fit any other way. A final
panel has no actions and is the screen's last word, so it never rises: Back is its way out. The
actions sit outside the scrolling part and never shrink (framework audit of #7).

```ts
const ErrorPanel: import("svelte").Component<Props, {}, "">;
type ErrorPanel = ReturnType<typeof ErrorPanel>;
```

#### `fitColumns` (function)

The shape cut to the columns the largest group fills, at its rows. Run after `trimRows`.

```ts
function fitColumns<T>(shape: GridShape, groups: readonly PageGroup<T>[]): GridShape;
```

#### `fitShape` (function)

The most tiles of `minTile` px the box holds, never more than `most`, never below one by one.

```ts
function fitShape(most: GridShape, box: GridBox, minTile: number, gap: number): GridShape;
```

#### `FocusNavigator` (class)

Moves focus the way a d-pad would: `move` walks Tab order, `steer` walks a `[data-focus-grid]` spatially,
`page` offers a page turn, and `recover` puts focus back on the first control when a screen change dropped
it. `attach` listens for the player's own pointer and keys, so the navigator steps back from them.

```ts
class FocusNavigator {
    /**
     * Whether the navigator is the one moving focus: set by any navigator action, cleared by a
     * pointer or real key press. Only then does `recover` step in, so a mouse or keyboard player's
     * focus is never moved for them.
     */
    private engaged;
    private paused;
    /** Armed by `guard()` on a screen change; a confirm key held from the last screen is cancelled until it comes up. */
    private guarded;
    private readonly root;
    constructor(root?: () => ParentNode);
    /** Stops `recover` once the player presses anything that is not the navigator. */
    attach(target?: EventTarget): () => void;
    /**
     * Arms the pad guard (M4 spec §4.7, F-a): called on a screen change, it cancels repeating Enter and Space
     * keydowns until the key comes up or is pressed afresh. A pad's own confirm is an edge from `Input`, which
     * cannot repeat, so only the keyboard needs this; `attach` must be listening.
     */
    guard(): void;
    /** Paused while a screen transition covers the screen. */
    setPaused(paused: boolean): void;
    /**
     * Puts focus back on the first control, in Tab's order, when it has fallen to the page (the
     * screen it stood on was replaced) or out of an open dialog. Called each frame while the
     * navigator is in use; a controller player otherwise saw nothing selected after every screen change.
     */
    recover(): void;
    move(direction: 'next' | 'previous'): void;
    /**
     * One step in `direction` (M4 spec §4.7). Inside a `[data-focus-grid]` the move is spatial: the nearest control
     * whose centre lies that way, scored by distance along the direction plus twice the sideways offset, so a
     * straight line wins over a diagonal. Elsewhere it is DOM order: down and right go next, up and left previous.
     * Returns false when nothing lies that way in the grid, so the caller can page or stay put.
     */
    steer(direction: NavDirection): boolean;
    /**
     * Offers a page turn (PageUp/PageDown, the shoulder buttons, a page swipe) to the focused control. A
     * `[data-pager]` region above it takes the cancelable `af-page` event; returns whether one did.
     */
    page(delta: -1 | 1): boolean;
    /**
     * Changes the focused slider or option group by one step without leaving it (from FloorFifty's `adjust`, plus
     * radio groups for OptionGroup). Fires the event a pointer or arrow key would (`input` on a range, `change` on a
     * radio). Returns false when nothing adjustable has focus, so the caller steers instead.
     */
    adjust(delta: -1 | 1): boolean;
    confirm(): void;
    /** Sends Escape to the focused element, marked as the navigator's, so dialogs close through one path. */
    back(): void;
}
```

#### `FormFactor` (type)

The four form factors (M1.6 spec §3.1; from FloorFifty `ui/form-factor.ts` at 122a220).

Decided from the layout viewport's size alone. Whether the pointer is coarse is a different
question: it decides which controls mount, not how a screen is laid out. So a tablet with a
keyboard and a desktop with a touch screen both get the layout their shape asks for.

The one place the thresholds live. CSS reads the answer from `data-form-factor`, script from
the geometry owner, and neither re-derives it.

```ts
type FormFactor = 'phone-portrait' | 'phone-landscape' | 'tablet-portrait' | 'desktop';
```

#### `fullscreenSupport` (function)

Which fullscreen, if any, this browser can give a standalone page.

```ts
function fullscreenSupport(doc: Document, nav: Navigator): FullscreenSupport;
```

#### `FullscreenSupport` (type)

Ruken's answer to whether this browser can go fullscreen, and how.

```ts
type FullscreenSupport = FullscreenRes['support'];
```

#### `GateInputs` (type)

What `landscapeGate` decides from: the form factor, whether the pointer is coarse, the browser's fullscreen
support and state, and whether the page is installed as an app.

```ts
type GateInputs = {
    formFactor: FormFactor;
    /** `(pointer: coarse)`: the primary pointer is a finger. */
    coarse: boolean;
    support: FullscreenSupport;
    fullscreen: boolean;
    /** Installed and opened as an app (`display-mode` standalone or fullscreen): no browser bar. */
    installed: boolean;
};
```

#### `Geometry` (interface)

The geometry every screen lays out against: the layout size, form factor and height tier, the insets, the
usable and visible regions, what covers the page's foot, and the host's scale hint.

```ts
interface Geometry {
    readonly layout: {
        readonly width: number;
        readonly height: number;
    };
    readonly formFactor: FormFactor;
    readonly heightTier: HeightTier;
    /** Per side, the largest of the env inset, the host's safe area and the host's reserved strip. */
    readonly insets: Insets;
    readonly hostReserved: {
        readonly left: number;
        readonly right: number;
    };
    /** The layout viewport less the insets. */
    readonly usable: Rect;
    /** What the browser lays over the page's foot (keyboard, a bottom toolbar, a hidden bar), in whole px. */
    readonly visualInsetBottom: number;
    /** The part of `visualInsetBottom` that is a bar the browser does not report, in whole px. */
    readonly hiddenBarBottom: number;
    /** How much a keyboard shrank the layout viewport itself (see `restingLayout`), in whole px. */
    readonly keyboardResize: number;
    /** `usable` less the visual inset: what the player can actually see and reach. */
    readonly visible: Rect;
    readonly scale: HostDisplay['scale'];
}
```

#### `GeometryInput` (interface)

What `measureGeometry` reads: the layout viewport, the visual viewport, the safe-area insets, the host's
display metrics, a hidden bar's height and the layout before a keyboard shrank it.

```ts
interface GeometryInput {
    /** The layout viewport, `innerWidth x innerHeight`. Form factor and tier come from this alone. */
    readonly layout: {
        readonly width: number;
        readonly height: number;
    };
    /** The visual viewport, when the browser has one. The keyboard shrinks this, not the layout. */
    readonly visual?: {
        readonly height: number;
        readonly offsetTop: number;
    } | undefined;
    /** `env(safe-area-inset-*)`, read by a probe element. */
    readonly envSafeArea: Insets;
    /** Absent standalone. */
    readonly host?: HostDisplay | undefined;
    /** A bar the browser draws over the page without reporting it (`browser/hidden-browser-bar.ts`). */
    readonly hiddenBarBottom?: number | undefined;
    /**
     * The layout viewport before a keyboard shrank it, when one did. Browsers that ignore
     * `interactive-widget=resizes-visual` shrink the page itself for the keyboard; classifying the
     * shrunken page would remount the screen mid-typing, so the class comes from this instead.
     * The owner passes it only while a text field has focus and the width has not changed.
     */
    readonly restingLayout?: {
        readonly width: number;
        readonly height: number;
    } | undefined;
}
```

#### `GeometryOwner` (interface)

The one geometry owner of a document: `geometry.current` for components, `onChange` for script,
`setHostDisplay`, `remeasure` and `dispose`.

```ts
interface GeometryOwner {
    readonly geometry: GeometryState;
    /** Hears every measure; returns the unsubscribe. For consumers outside Svelte. */
    onChange(listener: (geometry: Geometry) => void): () => void;
    /** The host's display metrics changed (Ruken `display.metrics`), or `undefined` for standalone. */
    setHostDisplay(display: HostDisplay | undefined): void;
    /** For a screen that just mounted: a WebView's bars can settle with no event at all. */
    remeasure(): void;
    dispose(): void;
}
```

#### `GeometryOwnerOptions` (interface)

What `createGeometryOwner` needs: the window to read and the root to publish on, and optionally the host's
display, timers and a safe-area reader.

```ts
interface GeometryOwnerOptions {
    readonly window: ViewportWindow;
    /** Where the geometry is published: normally `document.documentElement`. */
    readonly root: HTMLElement;
    readonly host?: HostDisplay | undefined;
    readonly timers?: Timers | undefined;
    readonly readEnvSafeArea?: (() => Insets) | undefined;
}
```

#### `GeometryState` (interface)

The current geometry as rune state: reading `current` in a component or `$derived` tracks it.

```ts
interface GeometryState {
    readonly current: Geometry;
}
```

#### `GridBox` (interface)

The measured box a page is fitted into, in CSS px.

```ts
interface GridBox {
    readonly width: number;
    readonly height: number;
}
```

#### `GridPage` (interface)

One page: a group's items, padded with `undefined` to the page's capacity.

```ts
interface GridPage<T> {
    readonly key: string;
    readonly groupId: string;
    readonly title: string;
    readonly slots: readonly (T | undefined)[];
}
```

#### `GridShape` (interface)

A page's columns and rows.

```ts
interface GridShape {
    readonly columns: number;
    readonly rows: number;
}
```

#### `HeightTier` (type)

The height tiers (M1.6 spec §3.1; from FloorFifty `ui/height-tier.ts` at 122a220).

The form factor says what shape a screen is; the tier says how much height it has to spend.
Two screens of the same form factor can need different answers: a 1280 x 720 desktop and a
900 x 600 window are both desktop, and only one can afford a hero above the menu.

Written to `<html data-height>` by the geometry owner. Tokens tighten under it, so every
primitive tightens at once. Targets never shrink with the tier; gutters and decoration do.

```ts
type HeightTier = 'short' | 'compact' | undefined;
```

#### `HiddenBrowserBar` (class)

Recognises a browser bar the browser has stopped reporting (DuckDuckGo for Android's bottom bar) and
measures how much of the page's foot it covers. It keeps state: it learns the largest settled
screen-to-page gap for each orientation.

```ts
class HiddenBrowserBar {
    /** The bottom address bar's height when the gap cannot say (measured: 64). */
    static readonly FALLBACK_HEIGHT = 64;
    /**
     * The smallest honest portrait gap: a 24 px status bar and a 56 px address
     * bar, with no navigation bar at all. Below it, no bar is being accounted for.
     */
    static readonly MIN_PORTRAIT_GAP = 80;
    /** A change in the gap smaller than this is the system, not a bar. */
    static readonly MIN_HEIGHT = 40;
    /** Larger than this, and the page changed for some other reason. */
    static readonly MAX_HEIGHT = 120;
    /** A gap larger than this is a keyboard, and is never learned. */
    static readonly MAX_LEARNED_GAP = 200;
    private readonly honestGap;
    /** How much of the page's foot the browser's bar covers, in CSS pixels. */
    measure(sample: BarSample): number;
}
```

#### `HostDisplay` (type)

What the host says about the display: the parts of Ruken's `display.metrics` the geometry reads.
Imported from the vendored `@ruken/sdk`, never copied (M1 shared contracts).
`scale` is 1.333 on Ruken's TV mode: a hint to enlarge text and targets, never CSS zoom.

```ts
type HostDisplay = Pick<DisplayMetricsPayload, 'safeArea' | 'hostReserved' | 'scale'>;
```

#### `HostKind` (type)

`Hosting['kind']` (shared contracts §1.1), written out because ui never imports host. A `web` session (PUB
spec §3) draws as `standalone`: it has no host to go back to.

```ts
type HostKind = 'ruken' | 'standalone';
```

#### `hostReservedInsets` (function)

Ruken reserves a strip on one edge; its width is the rect's, never negative (FloorFifty `reservedOf`).

```ts
function hostReservedInsets(host: HostDisplay | undefined): {
    left: number;
    right: number;
};
```

#### `IconButton` (const)

A button whose face is an icon (M4 spec §4.12). Its accessible name is `label`, which it cannot
do without: an empty label throws while it mounts, so a nameless icon button fails its first test
instead of reaching a player. The icon is decoration and hidden from assistive technology.

```ts
const IconButton: import("svelte").Component<Props, {}, "">;
type IconButton = ReturnType<typeof IconButton>;
```

#### `InputMethod` (type)

The input method the player last used, app-wide.

Menus and tutorials teach the controls in the player's hand, and neither
lives inside the sim, so this is not the game's input. A mouse moves
nothing: it says nothing about which controls to teach. Which buttons a
controller carries (its glyph family) belongs to M4 input.

```ts
type InputMethod = 'keyboard' | 'gamepad' | 'touch';
```

#### `InputMethodTracker` (class)

Tracks the input method the player used last (`keyboard`, `gamepad` or `touch`) as rune state in `method`.
`attach` listens for key presses and touch or pen presses, counting a controller's Back (which arrives as
Escape) as the controller; `note` records one by hand.

```ts
class InputMethodTracker {
    /** A coarse pointer starts as touch, anything else as keyboard. */
    method: InputMethod;
    note(method: InputMethod): void;
    /** Listens in the capture phase, so a control that stops propagation still counts. */
    attach(target?: EventTarget): () => void;
}
```

#### `Insets` (interface)

CSS px on each side, all >= 0.

```ts
interface Insets {
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
    readonly left: number;
}
```

#### `installGlobalErrorHandlers` (function)

Installs once per window; a second call is a no-op. Returns the uninstall.

```ts
function installGlobalErrorHandlers(win: Window, onFatal: (errorClass: string) => void, 
/**
 * A promise nobody awaited that rejected. The game goes on -- a cue that
 * failed to fetch must not end a race -- so it is heard apart from `onFatal`.
 */
onRejection?: (errorClass: string) => void): () => void;
```

#### `interceptBackGesture` (function)

Holds the game's history entry and turns a back step off it into `onBack`.
`onBack` answers whether the game went back; `false` lets the step leave.

```ts
function interceptBackGesture(win: Window, onBack: () => boolean): () => void;
```

#### `isDuckDuckGo` (function)

DuckDuckGo names itself only in the client-hint brands, not the user agent.

```ts
function isDuckDuckGo(nav: object): boolean;
```

#### `isFullscreen` (function)

Whether the page is fullscreen now.

```ts
function isFullscreen(doc: Document): boolean;
```

#### `isTap` (function)

Whether a press that moved `dx`, `dy` px is a tap rather than a swipe.

```ts
function isTap(dx: number, dy: number): boolean;
```

#### `keyLabel` (function)

A key's label: the keyboard layout's own (`navigator.keyboard.getLayoutMap()`, a letter in capitals) when there
is one, else its `code` without the `Key` and `Digit` prefixes, an arrow as its arrow.

```ts
function keyLabel(code: string, layout?: ReadonlyMap<string, string>): string;
```

#### `landscapeGate` (function)

What a phone held sideways must do: `none`, `fullscreen` (one tap to go fullscreen) or `rotate-or-install`
(turn upright or add to the Home Screen). Only a coarse-pointer phone in landscape that is not installed is
ever gated.

```ts
function landscapeGate(inputs: GateInputs): LandscapeGateState;
```

#### `LandscapeGate` (const)

The landscape gate's cover (M4 spec §4.9, §7; FloorFifty `ui/components/LandscapeGate.svelte` at `ac72660`): over
every screen and every dialog, empty whenever the gate is open (`state` none). Where the browser can hide its bar,
one tap on the focused button does it; where it cannot, the cover says how to play. The runtime decides the state
(`landscapeGate`) and only standalone (M4-D5): under Ruken the host frames the game.

```ts
const LandscapeGate: import("svelte").Component<Props, {}, "">;
type LandscapeGate = ReturnType<typeof LandscapeGate>;
```

#### `LandscapeGateCopy` (interface)

The landscape gate's words: one tap to fullscreen, or how to play where a browser cannot hide its bar.

```ts
interface LandscapeGateCopy {
    readonly title: string;
    readonly body: string;
    /** The button that goes fullscreen. */
    readonly go: string;
    readonly uprightTitle: string;
    readonly uprightBody: string;
}
```

#### `LandscapeGateState` (type)

Nothing; a tap to go fullscreen; or turn upright / add to the Home Screen.

```ts
type LandscapeGateState = 'none' | 'fullscreen' | 'rotate-or-install';
```

#### `LanguageCopy` (interface)

Every word the Language group shows besides the languages' own names, in the game's language.

```ts
interface LanguageCopy {
    readonly title: string;
    /** The choice that follows the host and the browser (`Locale.set(null)`). */
    readonly automatic: string;
}
```

#### `LanguageSection` (const)

The Language group of the Settings tab (Owner, 2026-10-18), laid out as FloorFifty's (`LanguagePicker.svelte` at
a28dc44): Automatic, then each of the game's languages by its endonym, each in its own `lang` so a screen reader
says it in that language. A pick is reported at once (`Locale.set`); nothing remounts, so focus stays on it.
FloorFifty's flags are its own art; a game names its languages here, and may give its own names (`names`).

```ts
const LanguageSection: import("svelte").Component<Props, {}, "">;
type LanguageSection = ReturnType<typeof LanguageSection>;
```

#### `LeaderboardCopy` (interface)

Every word the panel shows, in the game's language.

```ts
interface LeaderboardCopy {
    readonly title: string;
    readonly loading: string;
    readonly empty: string;
    /** `UNSUPPORTED`: no grant, or standalone ("Scores aren't available here"). */
    readonly unavailable: string;
    /** `OFFLINE` ("You're offline"). */
    readonly offline: string;
    /** Said beside the player's own row. */
    readonly you: string;
    /** "+N more", for the rows below the fold. */
    readonly more: (count: number) => string;
}
```

#### `LeaderboardEntryView` (interface)

One row of a board, as the host gives it; `isMe` marks the player.

```ts
interface LeaderboardEntryView {
    readonly rank: number;
    readonly displayName: string;
    readonly score: number;
    readonly isMe: boolean;
}
```

#### `LeaderboardPanel` (const)

A board's rows, or why there are none (M5 spec §7): loading, entries (the player's row marked "you"
in words, not only by colour), empty, unavailable and offline. The rows are read, not chosen, so
they are out of the focus order; only the action row (Back, Play again) takes focus. Unavailable
and offline are what the host said: the panel never shows a board kept on the device instead.
The rows sit in a ScrollList, a declared scroll region, so on a short screen they scroll and the
action row stays.

```ts
const LeaderboardPanel: import("svelte").Component<Props, {}, "">;
type LeaderboardPanel = ReturnType<typeof LeaderboardPanel>;
```

#### `LeaderboardView` (type)

What the panel shows: the rows, or why there are none.

```ts
type LeaderboardView = {
    readonly state: 'loading';
} | {
    readonly state: 'entries';
    readonly entries: readonly LeaderboardEntryView[];
} | {
    readonly state: 'empty';
} | {
    readonly state: 'unavailable';
} | {
    readonly state: 'offline';
};
```

#### `LoaderOverlay` (const)

The loader over a screen while its assets load (M1.6 spec §3.4; from FloorFifty
`ui/components/LoaderOverlay.svelte` at 122a220). It shows real progress when the runtime has it
and an indeterminate bar before the first byte, says what is loading in words, and after the
runtime's slow threshold says quietly that it is slow, not failing. The slow line always holds
its height, so nothing shifts when it appears.

```ts
const LoaderOverlay: import("svelte").Component<Props, {}, "">;
type LoaderOverlay = ReturnType<typeof LoaderOverlay>;
```

#### `lockOverscroll` (function)

A Svelte action: `<div use:lockOverscroll>`.

```ts
function lockOverscroll(node: HTMLElement): {
    destroy(): void;
};
```

#### `measureGeometry` (function)

Turns what the browser and the host report into one `Geometry`. Pure. Each inset is the largest of the
browser's safe area, the host's and (at the sides) the host's reserved strip; the visible region is the
usable one less whatever covers the page's foot.

```ts
function measureGeometry(input: GeometryInput): Geometry;
```

#### `Modal` (const)

A panel over the screen with a visible Close (M4 spec §4.12; the rules of FloorFifty
`ui/components/Modal.svelte` at ac72660). Where Dialog asks a question that needs an answer,
Modal shows something the player can close at any time: a level list, a credits page.

It holds the page by the rules Dialog uses (`modal-scope.ts`): the page behind is inert, focus
moves in on open and back to the opener on close, Tab wraps, and Escape (or the pad's Back)
calls `onclose`. A tap on the dimmed page calls `onbackdrop` only when one is given; absent,
such a tap does nothing, so a stray tap never loses the player's place.

`anchor="bottom"` puts it on the bottom edge at every form factor; Sheet is that.

```ts
const Modal: import("svelte").Component<$$ComponentProps, {}, "">;
type Modal = ReturnType<typeof Modal>;
```

#### `ModalProps` (interface)

The props Modal and Sheet share.

```ts
interface ModalProps {
    title: string;
    /** The Close button's name, in the game's language. */
    closeLabel: string;
    onclose: () => void;
    /** A tap on the dimmed page around the panel; absent, such a tap does nothing. */
    onbackdrop?: (() => void) | undefined;
    children?: Snippet | undefined;
    /** What sits with the title (Settings' tabs): beside it where the dialog is 480 px wide, under it where not. */
    head?: Snippet | undefined;
    /** A long body (Settings) that widens on a short, wide band to set its groups two across; others keep their width. */
    wide?: boolean | undefined;
    /** A dialog that fills a phone's band, its body taking the rest and its actions at the bottom (Settings). */
    fill?: boolean | undefined;
    /** The buttons, in reading order. Mark the safe one with `data-initial-focus`. */
    actions?: Snippet | undefined;
    testId?: string | undefined;
}
```

#### `NavDirection` (type)

A direction a d-pad or an arrow key walks a menu.

```ts
type NavDirection = 'up' | 'down' | 'left' | 'right';
```

#### `nearestTarget` (function)

The button a point is on, or else the nearest within the margin, or nothing. Distance is to the button's edge,
so any point inside is 0.

```ts
function nearestTarget(x: number, y: number, targets: readonly TouchTarget[], margin?: number): string | undefined;
```

#### `onFullscreenChange` (function)

Hears fullscreen being entered or left, by the page or the player. Returns the unsubscribe.

```ts
function onFullscreenChange(doc: Document, listener: () => void): () => void;
```

#### `OptionGroup` (const)

A choice of one (M4 spec §4.8; the rules of FloorFifty `ui/layout/OptionGroup.svelte` at `ac72660`): a
segmented row whose chosen option is filled and marked, never only underlined or only coloured.

Native radios in a fieldset, where FloorFifty used `<button role="radio">`: the browser gives the arrow keys,
and the focus navigator's `adjust` cycles a named radio group, so a pad changes it without leaving it.

Controlled: it reports a choice through `onchange` and shows the `value` it is given. A choice the owner does
not take is undone, so what is checked is always the owner's value.

```ts
const OptionGroup: import("svelte").Component<Props, {}, "">;
type OptionGroup = ReturnType<typeof OptionGroup>;
```

#### `PAD_FOCUS` (const)

How the navigator focuses: with a ring, and without scrolling the page. `focusVisible` because a
browser draws no ring for script focus after a click or tap; `preventScroll` because the game owns
the viewport. (`focusVisible` is not yet in TypeScript's DOM types; Chromium, Firefox and Safari
take it.)

```ts
const PAD_FOCUS: FocusOptions;
```

#### `padKeyEvents` (const)

Keydown events the navigator sent itself. Back reaches the page as Escape so every dialog
handles it once, but it is not a keyboard: an input-method tracker skips these, or one press of
a controller's B would teach keyboard controls to a controller player.

```ts
const padKeyEvents: WeakSet<Event>;
```

#### `padLabel` (function)

A standard-mapping pad button's label on a pad of `glyphs`.

```ts
function padLabel(button: number, glyphs: PromptGlyphs, copy: PromptCopy): string;
```

#### `PadWord` (type)

The pad buttons known by a word, for a pad whose labels are not known.

```ts
type PadWord = 'bottom' | 'right' | 'left' | 'top' | 'leftBumper' | 'rightBumper' | 'leftTrigger' | 'rightTrigger' | 'select' | 'start' | 'leftStick' | 'rightStick' | 'home';
```

#### `PAGE_SWIPE` (const)

Swipe is the pagination on a paged region, on every form factor: a finger, a mouse drag, a trackpad's two-finger
sideways swipe. From FloorFifty `apps/client/src/ui/page-swipe.ts` at `ac72660`, unchanged but for a doc comment.
A press that moves less than 8 px is a tap, so swiping never picks by accident; a quick flick turns one page
whatever the distance; a slow drag snaps to the nearest page.

```ts
const PAGE_SWIPE: {
    readonly tapSlopPx: 8;
    readonly flickPxPerMs: 0.4;
    readonly wheelStepPx: 40;
};
```

#### `PagedGrid` (const)

A grid of items in pages that never scrolls (M4 spec §4.8; the page arithmetic of FloorFifty `ui/tile-pages.ts`
at `ac72660`). Each group starts its own page; the shape is `most`, cut to what the measured box holds at
`minTile` and to what the largest group fills. PagerDots show where it is.

The page is controlled: it reports `onpage` and shows the `page` it is given. A `[data-focus-grid]`, so the
focus navigator steers through the tiles spatially, and paging comes from the owner (a page swipe, a pad's
shoulder buttons, the dots).

```ts
const PagedGrid: $$IsomorphicComponent;
type PagedGrid<T extends {
    readonly id: string;
}> = InstanceType<typeof PagedGrid<T>>;
```

#### `PagedGridProps` (interface)

PagedGrid's props: groups of items, the most columns and rows a page has, and the page its owner shows.

```ts
interface PagedGridProps<T> {
    /** The grid's name for assistive technology, also the pager's. */
    label: string;
    groups: readonly PageGroup<T>[];
    /** The most columns and rows a page has. */
    most: GridShape;
    /** The current page, from 0; wrapped into range. */
    page: number;
    onpage: (page: number) => void;
    item: Snippet<[T]>;
    /** The smallest tile side, in px, before the shape drops a row or column. */
    minTile?: number | undefined;
    gap?: number | undefined;
    /** How a group's later pages are titled. */
    continued?: ((title: string, part: number) => string) | undefined;
    dotLabel?: ((position: number, total: number) => string) | undefined;
    testId?: string | undefined;
}
```

#### `PageGroup` (interface)

A titled run of items; each group starts its own page.

```ts
interface PageGroup<T> {
    readonly id: string;
    readonly title: string;
    readonly items: readonly T[];
}
```

#### `pageOf` (function)

The page holding the item with `id`, or -1 when no page does.

```ts
function pageOf<T extends {
    readonly id: string;
}>(pages: readonly GridPage<T>[], id: string): number;
```

#### `PagerDots` (const)

Where a paged view is (M4 spec §4.8; from FloorFifty `ui/layout/PagerDots.svelte` at `ac72660`): one row of
dots, each a whole touch target, or "3 / 11" once the dots would not fit on one row. It never wraps.

```ts
const PagerDots: import("svelte").Component<Props, {}, "">;
type PagerDots = ReturnType<typeof PagerDots>;
```

#### `pagerMode` (function)

PagerDots' choice (M4 spec §4.8; from FloorFifty `ui/layout/pager.ts` at `ac72660`): dots while they fit on one
row, a counter ("3 / 11") once they would not. Dots never wrap.

```ts
function pagerMode(count: number, max?: number, available?: number, dotSize?: number): 'dots' | 'counter';
```

#### `paginate` (function)

One group per page; a group longer than a page continues under `continued(title, part)`, "Title (2)" by default.
An empty group has no page.

```ts
function paginate<T>(groups: readonly PageGroup<T>[], capacity: number, continued?: (title: string, part: number) => string): GridPage<T>[];
```

#### `pastEdge` (function)

Whether a drag of `dy` (positive = finger moving down) would pass an edge.

```ts
function pastEdge(scroller: {
    scrollTop: number;
    scrollHeight: number;
    clientHeight: number;
}, dy: number): boolean;
```

#### `PHONE_LANDSCAPE_MAX_HEIGHT` (const)

A landscape viewport shorter than this is a phone, or a desktop window short enough to need
the phone's compact layout. 500 keeps the 932 x 430 class of phone inside it with room to spare.

```ts
const PHONE_LANDSCAPE_MAX_HEIGHT = 500;
```

#### `PHONE_PORTRAIT_MAX_WIDTH` (const)

A portrait viewport narrower than this is a phone; at or above it, a tablet.

```ts
const PHONE_PORTRAIT_MAX_WIDTH = 600;
```

#### `PointerLatch` (class)

Which fingers are down on which action. Reports only real changes: a second finger landing on a button already
held produces nothing, and lifting it produces nothing either. The action ends when its last finger lifts.

```ts
class PointerLatch {
    private readonly onInput;
    private readonly active;
    constructor(onInput: (action: string, active: boolean) => void);
    /** True while any finger holds the action; what the pressed style reads. */
    isHeld(action: string): boolean;
    press(action: string, pointerId: number): void;
    release(action: string, pointerId: number): void;
    /** Releases everything still held, reporting each action exactly once. */
    releaseAll(): void;
}
```

#### `PointerTracker` (interface)

What a SwipeSurface drives: runtime's `SwipeTracker` satisfies it, so ui need not import runtime. Times are
`PointerEvent.timeStamp`.

```ts
interface PointerTracker {
    readonly tuning: {
        readonly saturationPx: number;
    };
    readonly indicator: SwipeIndicatorView | undefined;
    down(id: number, x: number, y: number, t: number, options?: {
        readonly steers?: boolean;
    }): void;
    move(id: number, x: number, y: number, t: number): void;
    up(id: number, x: number, y: number, t: number): void;
    cancel(): void;
}
```

#### `probeEnvSafeArea` (function)

Reads `env(safe-area-inset-*)` through a hidden probe, since script cannot read `env()` directly.
An engine that does not compute `env()` (jsdom) yields 0 on every side.

```ts
function probeEnvSafeArea(root: HTMLElement): Insets;
```

#### `Prompt` (const)

A device prompt (M4 spec §4.6): the label of an action's input on the device in the player's hand, a key, a pad
button or the touch label, or "Unbound". It follows its props in place, so a rebind or a device switch never
remounts it, and it is never in the focus order. `data-prompt` is the kind.

```ts
const Prompt: import("svelte").Component<Props, {}, "">;
type Prompt = ReturnType<typeof Prompt>;
```

#### `PromptBinding` (interface)

What drives one action (runtime's `InputBinding`, the fields a prompt reads).

```ts
interface PromptBinding {
    readonly keys: readonly string[];
    readonly pad: readonly number[];
    readonly touch: boolean;
}
```

#### `PromptCopy` (interface)

Every word a prompt shows, in the game's language.

```ts
interface PromptCopy {
    /** An action with nothing on the active device. */
    readonly unbound: string;
    /** An action with an on-screen button, on touch. */
    readonly touch: string;
    readonly pad: Readonly<Record<PadWord, string>>;
}
```

#### `PromptDevice` (type)

The device a prompt is for (runtime's `InputDevice`).

```ts
type PromptDevice = 'keyboard' | 'gamepad' | 'touch';
```

#### `PromptGlyphs` (type)

The labels a pad's buttons carry (runtime's `GlyphFamily`).

```ts
type PromptGlyphs = 'xbox' | 'playstation' | 'generic';
```

#### `PromptView` (type)

What a prompt shows: its kind (`data-prompt`) and its label.

```ts
type PromptView = {
    readonly kind: 'key' | 'pad' | 'touch' | 'unbound';
    readonly label: string;
};
```

#### `promptView` (function)

What a prompt shows for `binding` on `device`: its first input there, or Unbound.

```ts
function promptView(binding: PromptBinding, device: PromptDevice, glyphs: PromptGlyphs, copy: PromptCopy, layout?: ReadonlyMap<string, string>): PromptView;
```

#### `readKeyboardLayout` (function)

The keyboard's layout map where the browser has one (`navigator.keyboard`, Chromium), or undefined: where the
browser has none or refuses (a cross-origin frame may), prompts name keys by their `code` (M4 spec §6).

```ts
function readKeyboardLayout(nav: Navigator): Promise<ReadonlyMap<string, string> | undefined>;
```

#### `RebindDevice` (type)

A device a player can rebind (touch buttons and gestures are the game's).

```ts
type RebindDevice = 'keyboard' | 'gamepad';
```

#### `Rect` (interface)

A rectangle in CSS px: its top-left corner and its size.

```ts
interface Rect {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}
```

#### `reducedMotion` (function)

Whether the player has asked for less movement.

Checked at call time rather than cached, because the setting can change
while the game is open. Primitives also honour it in CSS; this is for code
that moves things itself.

```ts
function reducedMotion(win?: Pick<Window, 'matchMedia'>): boolean;
```

#### `releaseStep` (function)

Pages to turn when a drag of `dx` px over `dtMs` is released: a swipe left is +1 (next).

```ts
function releaseStep(dx: number, dtMs: number, pageWidth: number): -1 | 0 | 1;
```

#### `RETRY_DELAYS_MS` (const)

The wait before each retry; when they are spent, the image has failed.

```ts
const RETRY_DELAYS_MS: readonly number[];
```

#### `RetryTimers` (type)

The timers `watchImage` waits with; tests pass fakes.

```ts
type RetryTimers = {
    setTimeout(run: () => void, ms: number): ReturnType<typeof setTimeout>;
    clearTimeout(handle: ReturnType<typeof setTimeout> | undefined): void;
};
```

#### `retryUrl` (function)

The URL a retry asks for; attempt 0 is the first request, as given.

```ts
function retryUrl(src: string, attempt: number): string;
```

#### `RotateHint` (const)

The rotate hint (M4 spec §4.9, §7): over a game locked to one orientation (`GameSpec.orientation`) on a phone held
the other way. The runtime pauses the game while it shows (`Time.pause('display')`). Not interactive: turning the
phone is the only way past it, so nothing in it takes focus. The words follow FloorFifty `RotateHint.svelte` at
`ac72660`, which offers the same advice as a toast.

```ts
const RotateHint: import("svelte").Component<Props, {}, "">;
type RotateHint = ReturnType<typeof RotateHint>;
```

#### `RotateHintCopy` (interface)

The rotate hint's words.

```ts
interface RotateHintCopy {
    readonly title: string;
    readonly body: string;
}
```

#### `RotateToast` (const)

The rotate toast (Owner amendment to M4 spec §4.9, 2026-10-18; FloorFifty `RotateHint.svelte` at a28dc44): for a
game with `rotateHint: 'toast'`, a small message at the top on a phone held the other way, "Turn your phone for a
bigger view", with an OK. It covers nothing and pauses nothing; the only part a thumb can hit is the OK, at 44 px.

```ts
const RotateToast: import("svelte").Component<Props, {}, "">;
type RotateToast = ReturnType<typeof RotateToast>;
```

#### `RotateToastCopy` (interface)

The rotate toast's words (`rotateHint: 'toast'`, FloorFifty's): the advice, and its OK.

```ts
interface RotateToastCopy {
    readonly text: string;
    readonly ok: string;
    /** The OK's name for assistive technology: what it dismisses. */
    readonly dismiss: string;
}
```

#### `SAVE_STATUS_TONES` (const)

`conflict` points the player at the host's own question (M5 spec §5), so it is a warning, not an error.

```ts
const SAVE_STATUS_TONES: {
    readonly [State in SaveStatusState]: SaveStatusTone;
};
```

#### `SaveSlotActivity` (type)

A write the caller has started and not finished, or one that failed.

```ts
type SaveSlotActivity = 'writing' | 'failed';
```

#### `SaveSlots` (const)

The save slots (M5 spec §6, §7): a row for each slot, and the few things a player does with one. Rows are chosen,
not acted on: the chosen row (the newest slot that can be continued, to begin with) decides the actions in the bar
under the list. Continue for a slot that can be opened, New game for an empty one, and Delete… for any that holds
something. A save that cannot be opened, or that a newer build made, offers nothing but Delete…, so writing over
it takes two steps. Delete… asks first, in a dialog whose safe button has focus; the question says so when a newer
build made the save.
The rows are in a ScrollList, a declared scroll region, so on a short screen they scroll and the bar stays. A label
and a time wrap to two lines and are then cut, with the whole text left in the row for assistive technology.
Nothing here reads a store: the runtime's slots arrive as `view` and the player's choices leave as callbacks.

```ts
const SaveSlots: import("svelte").Component<Props, {}, "">;
type SaveSlots = ReturnType<typeof SaveSlots>;
```

#### `SaveSlotsCopy` (interface)

Every word the list shows, in the game's language (each a PRODUCT.L message key).

```ts
interface SaveSlotsCopy {
    /** The list's accessible name. */
    readonly title: string;
    readonly loading: string;
    /** "Slot 3": a slot with no label of its own. */
    readonly slot: (slot: number) => string;
    readonly empty: string;
    /** `unreadable`: "This save can't be opened". */
    readonly unreadable: string;
    /** `newer`: "Saved by a newer version of the game". */
    readonly newer: string;
    /** `other-content`: saved with other game content; its progress loads, its snapshot does not (M5-D5). */
    readonly otherContent: string;
    readonly writing: string;
    readonly failed: string;
    /** Continue the chosen slot. */
    readonly load: string;
    readonly newGame: string;
    /** The action that opens the question, with its ellipsis. */
    readonly delete: string;
    readonly deleteTitle: string;
    /** The question's text; `name` is the slot's label or its "Slot N". */
    readonly deleteBody: (name: string) => string;
    /** The question's text for a slot a newer build made. */
    readonly deleteNewerBody: string;
    /** The confirming button. */
    readonly deleteConfirm: string;
    /** The safe button, which takes focus. */
    readonly cancel: string;
    /** "+N more", for the rows below the fold. */
    readonly more: (count: number) => string;
}
```

#### `SaveSlotsView` (type)

What the list shows: a moment of loading, or the slots.

```ts
type SaveSlotsView = {
    readonly state: 'loading';
} | {
    readonly state: 'slots';
    readonly slots: readonly SaveSlotView[];
};
```

#### `SaveSlotView` (type)

One slot, as the list shows it. `savedAt` is a time in milliseconds, kept as the header says.

```ts
type SaveSlotView = {
    readonly kind: 'empty';
    readonly slot: number;
    readonly activity?: SaveSlotActivity;
} | {
    readonly kind: 'ready' | 'other-content';
    readonly slot: number;
    readonly savedAt: number;
    readonly label?: string;
    readonly activity?: SaveSlotActivity;
} | {
    readonly kind: 'unreadable';
    readonly slot: number;
    readonly activity?: SaveSlotActivity;
} | {
    readonly kind: 'newer';
    readonly slot: number;
    readonly activity?: SaveSlotActivity;
};
```

#### `SaveStatus` (const)

The host's save state in words (M5 spec §7): checking, syncing, saved, offline-queued, retry, conflict, recovered, and
"no grant" for a game that was not given the saves grant ("Progress won't be kept"). It is not focusable. The line is
a polite live region that stays mounted while the state changes, so a screen reader hears each change.
With no `status` (the standalone session, where nothing syncs) it renders nothing at all.
A state that asks for notice (good news or a problem) shows a glyph beside its words, hidden from assistive
technology, which has the words, so the tone never rests on colour alone.

```ts
const SaveStatus: import("svelte").Component<Props, {}, "">;
type SaveStatus = ReturnType<typeof SaveStatus>;
```

#### `SaveStatusCopy` (type)

One line per state, in the game's language (each a PRODUCT.L message key).

```ts
type SaveStatusCopy = {
    readonly [State in SaveStatusState]: string;
};
```

#### `SaveStatusState` (type)

What the host says about the player's saves, or that there is no grant.

```ts
type SaveStatusState = 'checking' | 'syncing' | 'saved' | 'offline-queued' | 'retry' | 'conflict' | 'recovered' | 'no-grant';
```

#### `SaveStatusTone` (type)

How much a state asks of the player's notice. `info` states are working; the others carry a glyph beside the words.

```ts
type SaveStatusTone = 'info' | 'success' | 'warning';
```

#### `ScreenFrame` (const)

Every screen's frame: the visible region, a corner row, then a hero and a body (M1.6 spec §3.4; from
FloorFifty `ui/layout/ScreenFrame.svelte` at 122a220).

It fills the visible region: the layout viewport less the insets the geometry owner publishes
(safe area and Ruken's reserved strip), ending above whatever the browser lays over the page's
foot (the keyboard). Its first row is the corner controls, in flow, so they never sit over the
content. Below that it arranges a hero and a body:
  stack: hero above body; the hero takes what the body leaves, so on a short screen the hero
         shrinks first and never pushes the body off the screen;
  split: hero and body side by side.
The screen root picks the arrangement from the form factor and height tier; nothing inside the
frame branches on either. The body is the `af-screen` size container its contents query.

```ts
const ScreenFrame: import("svelte").Component<Props, {}, "">;
type ScreenFrame = ReturnType<typeof ScreenFrame>;
```

#### `ScreenKind` (type)

A screen's kind (`ScreenDef.kind`): only `gameplay` may hide the pointer.

```ts
type ScreenKind = 'menu' | 'gameplay';
```

#### `ScrollList` (const)

A list that keeps its rows (M1.6 spec §3.4; from FloorFifty `ui/layout/ScrollList.svelte` at 122a220).

It reserves `min(minRows, rowCount)` rows of `--af-row-h` as its minimum height, so on a short
screen its siblings shrink before a row is lost. The reserve is capped at the height its parent
gives it: where even that cannot hold the rows (TV scale on a compact phone) the list keeps what
fits and scrolls the rest inside its own box, rather than painting over the controls below it. For that to work its parent must give it a
`1fr` grid row or `flex: 1 1 auto`, never `minmax(0, 1fr)`, which ignores an item's minimum.
Rows mark themselves `data-row`. It is a declared scroll region (`data-scroll-region`): the layout
contracts allow controls to be off screen only inside one.

```ts
const ScrollList: import("svelte").Component<Props, {}, "">;
type ScrollList = ReturnType<typeof ScrollList>;
```

#### `scrollWithin` (function)

Brings `element` into view by scrolling its nearest scroll box, never the document.

```ts
function scrollWithin(element: HTMLElement): void;
```

#### `sendBack` (function)

Sends Back as an Escape to wherever a dialog would hear it, and reports
whether anything took it. A tap on a dialog's backdrop leaves focus on the
body, where the dialog's own Escape listener never hears a key, so an open
dialog is sent it directly.

```ts
function sendBack(doc: Document): boolean;
```

#### `SettingsScreen` (const)

The core Settings screen (M4 spec §4.8, M4-D8), laid out and behaving as FloorFifty's settings
(`ui/components/SettingsPanel.svelte` in `PauseOverlay.svelte` at a28dc44; Owner 2026-10-18: "match the layout and
function, not the style"): a dialog over the dimmed game, the same frame as Paused, so going between them reads as
one dialog changing its view. Tabs stay put and the chosen tab's sections scroll under them in one list that counts
what is below; Back sits under the dialog, and Escape and the dialog's Close go back too. Where the dialog is 560 px
wide (it widens on a short band) the sections go two across. The default screens give it Display and Controls;
extensions add theirs to the Settings tab through the `settings.sections` slot. A kit's styled screen replaces it
by flow (PRODUCT.6).

```ts
const SettingsScreen: import("svelte").Component<Props, {}, "">;
type SettingsScreen = ReturnType<typeof SettingsScreen>;
```

#### `SettingsSection` (type)

A section of the Settings screen: the screen's own snippet, or an extension's slot component.

```ts
type SettingsSection = {
    readonly snippet: Snippet;
} | {
    readonly component: UiComponent;
};
```

#### `SettingsTab` (interface)

A tab of the Settings screen (FloorFifty's Settings and Controls): its label and its sections, in order.

```ts
interface SettingsTab {
    readonly id: string;
    readonly label: string;
    readonly sections: readonly SettingsSection[];
}
```

#### `SETTLE_DELAYS_MS` (const)

When to measure again after a viewport event, in ms. A browser's bars and keyboard animate,
and the event can fire before the sizes stop moving: on an Android emulator the keyboard closed,
the last event fired mid-animation, and the inset was left at the keyboard's height with no
further event to correct it (FloorFifty). Each re-measure is only a read and a style write.

```ts
const SETTLE_DELAYS_MS: readonly number[];
```

#### `Sheet` (const)

A Modal on the bottom edge at every form factor (M4 spec §4.12): the same scoping, Close and
scroll region, where a thumb reaches the actions. Settings' sub-pages and a "more" menu use it.

```ts
const Sheet: import("svelte").Component<ModalProps, {}, "">;
type Sheet = ReturnType<typeof Sheet>;
```

#### `SHORT_MAX_HEIGHT` (const)

At or below this many CSS px of layout height, a screen is short.

```ts
const SHORT_MAX_HEIGHT = 600;
```

#### `Sleeper` (type)

Puts the game's sound to sleep while nobody can see it.

Locking a phone left a game's music playing. A hidden page is the signal
every browser gives for that, a backgrounded tab and a switched-away app
alike; `pagehide` and `freeze` cover the browsers that pause a page without
reporting it hidden first. The render loop needs nothing here: browsers
already stop animation frames for a hidden page.

A window that only loses focus stays awake. The page is still in view --
a second monitor, a chat app over the corner -- and an online game goes on
whether the player is clicked into it or not, so its sound does too.

Waking and sleeping on Ruken's `lifecycle` belongs to the runtime, over
`Hosting` (M1.5); this module is the browser half only.

Every gesture also asks the sound to come back from an interruption the
page was never told about: a call or Siri on a phone suspends the graph
while the page stays visible, and only a gesture may resume it.

```ts
type Sleeper = {
    sleep(): Promise<void>;
    wake(): Promise<void>;
    /** Resumes a graph the system suspended; for example an `AudioContext` the system suspended. */
    resumeOnGesture?(): Promise<void>;
};
```

#### `sleepWhenHidden` (function)

Puts a game's sound to sleep while its page is hidden and wakes it when the page shows again; a pointer,
touch or key gesture also asks sound the system suspended to resume. A window that only loses focus stays
awake. Returns a function that removes the listeners.

```ts
function sleepWhenHidden(doc: Document, sleeper: Sleeper, win?: Window): () => void;
```

#### `Slider` (const)

A number in a range (M4 spec §4.12): a labelled native `<input type="range">`, so the browser
gives the arrow keys and the focus navigator's `adjust` steps it. `valueText` gives the value its
words for assistive technology (`aria-valuetext`), and the same words show beside the track. The
thumb is a 44 px target, checked by the layout contract.

```ts
const Slider: import("svelte").Component<Props, {}, "">;
type Slider = ReturnType<typeof Slider>;
```

#### `slotActionsOf` (function)

What a player may do with a slot (M5 spec §6). A slot that cannot be opened, or that a newer build made, can only be
deleted: writing over it is two steps, delete then New game, so it is never one tap.

```ts
function slotActionsOf(slot: SaveSlotView): {
    readonly load: boolean;
    readonly newGame: boolean;
    readonly remove: boolean;
};
```

#### `Split` (const)

Two panes side by side where both fit at `min` px, stacked otherwise (M4 spec §4.8; from FloorFifty
`ui/layout/Split.svelte` at `ac72660`). Measured, because a container query cannot read a prop; stacked
until the first measurement, so a pane never starts squeezed.

```ts
const Split: import("svelte").Component<Props, {}, "">;
type Split = ReturnType<typeof Split>;
```

#### `splitMode` (function)

Split's choice (M4 spec §4.8; from FloorFifty `ui/layout/split.ts` at `ac72660`): side by side when both
columns and the gap between them fit at their minimum, stacked otherwise.

```ts
function splitMode(available: number, min: number, gap: number): 'row' | 'stack';
```

#### `STICKY_MARGIN_PX` (const)

How far outside a button a thumb still counts for it, in CSS pixels.

```ts
const STICKY_MARGIN_PX = 24;
```

#### `StickyPointers` (class)

Which button each finger is on, over the latch. A finger owns one button at a time: moving onto another releases
the first and presses the second; moving onto nothing keeps what it owns.

```ts
class StickyPointers {
    private readonly latch;
    private readonly owned;
    constructor(latch: PointerLatch);
    /** A finger landed on `action` (or on nothing); true when it pressed a button. */
    down(pointerId: number, action: string | undefined): boolean;
    move(pointerId: number, action: string | undefined): void;
    up(pointerId: number): void;
    releaseAll(): void;
}
```

#### `suppressPageGestures` (function)

Turns off the browser's document gestures over the game.

A right-click menu, a long-press menu or an image dragged off the page
reminds a player they are on a web page, which breaks the illusion the
screen is drawn. Text selection is off in CSS (`theme.css`); these two are
events, so they are cancelled here.

Text fields are the exception. A name or code field keeps its menu, so
text can be pasted from a message.

```ts
function suppressPageGestures(doc: Document): () => void;
```

#### `SwipeIndicatorView` (interface)

What a SwipeSurface draws: the thumb, the anchor it trails and whether it is past the dead zone.

```ts
interface SwipeIndicatorView {
    readonly anchor: {
        readonly x: number;
        readonly y: number;
    };
    readonly thumb: {
        readonly x: number;
        readonly y: number;
    };
    readonly steering: boolean;
}
```

#### `SwipeSurface` (const)

The whole visible screen as one swipe surface (M4 spec §4.4), from FloorFifty `ui/components/SwipeSurface.svelte`
at `ac72660`.

All bookkeeping is the tracker's (runtime `SwipeTracker`); this forwards pointer events, each with its own
`timeStamp`, and draws a thin thumb-to-anchor line so the player can see the dead zone. Which fingers may steer
is the game's rule (`steers`); any finger may flick or tap. Controls a screen draws above this surface keep their
taps. Pointer only, never in the focus order.

```ts
const SwipeSurface: import("svelte").Component<SwipeSurfaceProps, {}, "">;
type SwipeSurface = ReturnType<typeof SwipeSurface>;
```

#### `SwipeSurfaceProps` (interface)

SwipeSurface's props.

```ts
interface SwipeSurfaceProps {
    tracker: PointerTracker;
    /** Whether a finger landing at (x, y) may steer; any finger may flick or tap. Default: every finger. */
    steers?: ((x: number, y: number) => boolean) | undefined;
    testId?: string | undefined;
}
```

#### `tabbables` (function)

Everything Tab can reach under `root`, in DOM order: not disabled, inert or hidden.

```ts
function tabbables(root: ParentNode): HTMLElement[];
```

#### `tileSide` (function)

A square tile's side for the space a grid is given: the width shared by the columns and the `peek` (a fraction
of a tile) of the next page showing at the edge, and the height only when the box has one. A grid laid in a
content-sized panel passes an infinite height, because a height measured from its own tiles would only ever
confirm the smallest tile. Clamped to `min`..`max`.

```ts
function tileSide(shape: GridShape, box: GridBox, gap: number, limits: {
    readonly peek: number;
    readonly min: number;
    readonly max: number;
}): number;
```

#### `Timers` (interface)

Injected so tests drive the settle delays with fake timers.

```ts
interface Timers {
    set(callback: () => void, ms: number): unknown;
    clear(handle: unknown): void;
}
```

#### `Toast` (const)

A passing message (M4 spec §4.12): "Pad connected", "Saved", "This controller is not supported".
The owner shows it and takes it away; Toast neither times itself nor takes focus, so a player
in the middle of a menu is never moved.

It is a polite live region (`role="status"`), and an error is an alert. Every tone but `info`
shows a glyph and says `toneLabel` to assistive technology, so the tone survives with every
colour removed (U-b); a toned toast without words throws while it mounts.

It sits above Ruken's strip, the safe area and the keyboard, through the geometry owner's inset
variables, and slides in unless the player asked for less movement.

```ts
const Toast: import("svelte").Component<Props, {}, "">;
type Toast = ReturnType<typeof Toast>;
```

#### `Toggle` (const)

An on/off setting (M4 spec §4.12): a native checkbox with the switch role, so the browser gives
Space and the focus navigator's `adjust` flips it. The state shows in words (`onLabel`,
`offLabel`) beside the track, never in colour alone.

Controlled, as OptionGroup is: a click reports the new state through `onchange`, and the box
shows the `checked` it is given.

```ts
const Toggle: import("svelte").Component<Props, {}, "">;
type Toggle = ReturnType<typeof Toggle>;
```

#### `TouchButtonSpec` (interface)

One on-screen touch button (M4 spec §4.4): the action it holds and what it shows.

```ts
interface TouchButtonSpec {
    /** The profile's action id; also the button's `data-testid`. */
    readonly action: string;
    /** The button's face. */
    readonly label: string;
    /** Its name for assistive technology, where the face is a symbol. Default: the label. */
    readonly ariaLabel?: string | undefined;
    /** Which lower corner's group it sits in. Default `start`. */
    readonly side?: 'start' | 'end' | undefined;
    /** The game cannot be played without it: where the buttons do not all fit, only these show (M4.7). */
    readonly required?: boolean | undefined;
}
```

#### `TouchControls` (const)

The on-screen touch buttons (M4 spec §4.4), from FloorFifty `ui/components/TouchControls.svelte` at `ac72660`.

This is the element that produces pointer events and nothing more; the multi-touch bookkeeping is
`touch-controls.ts`. Each side's group takes the pointers, not the buttons, and reaches `STICKY_MARGIN_PX` past
them with an invisible margin, so a near miss presses the nearest button and a held thumb can slide from one to
the next. The group captures the pointer, so the release always arrives, however far the thumb wanders.

Pointer only: the buttons are never in the focus order, since a keyboard or pad drives the same actions directly.
Hidden (not unmounted) while the player uses another device, so the screen never remounts; hiding or coming down
releases whatever is held.

```ts
const TouchControls: import("svelte").Component<TouchControlsProps, {}, "">;
type TouchControls = ReturnType<typeof TouchControls>;
```

#### `TouchControlsProps` (interface)

TouchControls' props.

```ts
interface TouchControlsProps {
    buttons: readonly TouchButtonSpec[];
    /** An action's first finger landed. */
    onhold: (action: string) => void;
    /** An action's last finger lifted, or the controls hid or came down while it was held. */
    onrelease: (action: string) => void;
    /** False hides the controls without remounting them (the player put touch down). Default true. */
    shown?: boolean | undefined;
    /**
     * A floating move stick at the overlay's start (M4.12): its accessible name. None draws no stick, as in 2D. The
     * stick is always shown: the reduced set never drops it.
     */
    stick?: TouchStickSpec | undefined;
    /** The stick's vector as the thumb moves, clamped to length 1, `y` positive down (runtime's `Input.touchStick.set`). */
    onstick?: ((x: number, y: number) => void) | undefined;
    /** The stick let go: a lift, a cancel, the controls hiding or coming down (`Input.touchStick.release`). */
    onstickend?: (() => void) | undefined;
    testId?: string | undefined;
}
```

#### `TouchCopy` (interface)

Every word the Touch controls group shows, in the game's language.

```ts
interface TouchCopy {
    readonly title: string;
    /** The mode choice's name. */
    readonly mode: string;
    readonly modes: Readonly<Record<ControlsTouchMode, string>>;
}
```

#### `TouchSection` (const)

The Touch controls group of the Settings tab (FloorFifty `SettingsPanel.svelte` at a28dc44): how touch drives play,
on-screen buttons or swipes, as an option group. The game shows it on a coarse pointer when it offers both modes.

```ts
const TouchSection: import("svelte").Component<Props, {}, "">;
type TouchSection = ReturnType<typeof TouchSection>;
```

#### `TouchStickSpec` (interface)

The overlay's move stick (M4.12).

```ts
interface TouchStickSpec {
    /** Its name for assistive technology ("Move"). */
    readonly label: string;
}
```

#### `TouchTarget` (interface)

A button's action and where it is drawn, for `nearestTarget`.

```ts
interface TouchTarget {
    readonly action: string;
    readonly rect: {
        readonly left: number;
        readonly top: number;
        readonly right: number;
        readonly bottom: number;
    };
}
```

#### `trimRows` (function)

The shape cut to the rows the largest group fills, so no page carries a row of empty slots.

```ts
function trimRows<T>(shape: GridShape, groups: readonly PageGroup<T>[]): GridShape;
```

#### `UI_SLOT_NAMES` (const)

The named places an extension may add UI (M1 shared contracts §2; M1.6 spec §3.7).

Closed: an extension cannot add a slot. The screens that render each slot arrive with those
screens (title and pause in M1.5, settings and HUD in M4, the debug overlay in M6).

```ts
const UI_SLOT_NAMES: readonly ["title.actions", "pause.actions", "settings.sections", "hud.overlay", "debug.panels"];
```

#### `UiComponent` (type)

What an extension puts in a slot: a Svelte component that takes no props.

```ts
type UiComponent = Component<Record<string, never>>;
```

#### `UiSlotName` (type)

The name of a place an extension may add UI: one of `UI_SLOT_NAMES`.

```ts
type UiSlotName = (typeof UI_SLOT_NAMES)[number];
```

#### `VibrationCopy` (interface)

Every word the Vibration group shows, in the game's language.

```ts
interface VibrationCopy {
    readonly title: string;
    /** The toggle's name: a pad's rumble and a phone's buzz together. */
    readonly toggle: string;
    readonly on: string;
    readonly off: string;
}
```

#### `VibrationSection` (const)

The Vibration group of the Settings tab (Owner, 2026-10-18; FloorFifty's rumble row in `SettingsPanel.svelte` at
a28dc44): one toggle for a pad's rumble and a phone's buzz (`Haptics`). The game shows it only where the device can
do either (`Haptics.supported`), so it never offers a switch that does nothing.

```ts
const VibrationSection: import("svelte").Component<Props, {}, "">;
type VibrationSection = ReturnType<typeof VibrationSection>;
```

#### `ViewportWindow` (interface)

The parts of `window` the owner reads; a fake from `@mcthaydt/automata-testing` stands in for it in tests.

```ts
interface ViewportWindow {
    readonly innerWidth: number;
    readonly innerHeight: number;
    readonly visualViewport?: {
        readonly height: number;
        readonly offsetTop: number;
        addEventListener: Listen;
        removeEventListener: Listen;
    } | null | undefined;
    /** Read only where the browser needs its bar recognised (`browser/hidden-browser-bar.ts`). */
    readonly screen?: {
        readonly width: number;
        readonly height: number;
    } | undefined;
    readonly navigator?: object | undefined;
    addEventListener: Listen;
    removeEventListener: Listen;
}
```

#### `watchImage` (function)

Probes `src` and, while it fails, hands `onRetry` each retry's URL to draw
instead. Returns the stop.

```ts
function watchImage(src: string, onRetry: (url: string) => void, timers?: RetryTimers): () => void;
```

#### `WheelPager` (class)

A trackpad's horizontal wheel deltas, one page per gesture; `reset` when the gesture goes quiet.

```ts
class WheelPager {
    private travel;
    private spent;
    push(deltaX: number, deltaY: number): -1 | 0 | 1;
    reset(): void;
}
```

#### `withHostName` (function)

Fills the `{host}` slot of a copy string with the host's name. Copy without the slot is returned as is.

```ts
function withHostName(text: string, hostName: string): string;
```

#### `wrapPage` (function)

`index` wrapped into `0..count - 1`, so paging past either end comes round.

```ts
function wrapPage(index: number, count: number): number;
```

### `import { … } from '@mcthaydt/automata-ui/testing'`

#### `byTestId` (function)

The element a test id names; throws when the fixture has none, so a missing part fails loudly.

```ts
function byTestId(id: string): HTMLElement;
```

#### `checkLayout` (function)

The checks every screen shares: the document never scrolls; every control is at least the target
(primaries the primary target) at this scale, on screen unless in a declared scroll region,
never under a reserved area or a touch button and never over the corner row; the corner row's controls and any
`data-way-out` stay reachable (but under a modal dialog or an ErrorPanel that had to rise); no
ActionBar wraps (level 3); no row (`[data-row]`) clips what it holds; no control is cut at the side of the scroll
region it scrolls in (`findCutAtSide`: a region declared `data-scroll-region="both"` scrolls sideways too), and no
control's words run past its edge; and each of `essentials` is reachable without scrolling.

```ts
function checkLayout(conditions: Conditions, essentials: readonly Element[]): string[];
```

#### `Conditions` (interface)

The conditions a layout test runs under: the geometry published for a size and variant, and the regions
that cover the page (the keyboard, Ruken's strip), which nothing may sit under.

```ts
interface Conditions {
    readonly geometry: Geometry;
    /** What covers the page in this variant: the keyboard, Ruken's strip. Nothing may sit under it. */
    readonly reserved: LayoutRect[];
}
```

#### `errorPanelFloor` (function)

The least height any of an ErrorPanel's layouts needs, measured here rather than read from the
panel, so a panel that misjudges its room cannot excuse itself (spec §3.4, §7). For each layout
(`row`, `stack`, `row-tight`) it lays the panel out, keeps the layout only where its message is
readable there (20 characters or the whole panel, half that in `row-tight`, and clear of the
actions), and takes the panel's chrome, one message line and the actions as laid out. The
panel's own layout is put back after.

```ts
function errorPanelFloor(panel: HTMLElement): number;
```

#### `publishConditions` (function)

Measures and publishes the geometry for `size` under `variant`, as the owner would.

```ts
function publishConditions(root: HTMLElement, size: ReferenceSize, variant: Variant): Conditions;
```

#### `settleLayout` (function)

Waits until a freshly mounted fixture has finished laying out: fonts loaded, then two frames, so
ResizeObserver callbacks (ActionBar's collapse, ScrollList's measure) and the re-layout they
cause have run. A semantic wait, not a sleep.

```ts
function settleLayout(): Promise<void>;
```
