export interface CheatsheetEntry {
  name: string
  signature: string
  description: string
  returnType: string
  parameters?: { name: string; type: string; desc: string }[]
  notes?: string[]
  receiver?: 'Sim'
}

export interface CheatsheetModule {
  id: string
  name: string
  title: string
  description: string
  sourcePath: string
  example: string
  entries: CheatsheetEntry[]
}

export const CHEATSHEET_MODULES: CheatsheetModule[] = [
  {
    "id": "simulation",
    "name": "@mcthaydt/automata-sim",
    "title": "Simulation",
    "sourcePath": "packages/sim/src/index.ts",
    "description": "Define gameplay state and advance it with synchronous fixed ticks. Use instance methods on the Sim returned by createSim.",
    "example": "import { createSim, defineComponent, definePlugin, defineSystem } from '@mcthaydt/automata-sim'\n\nconst Counter = defineComponent('counter', { value: 'u32' })\nconst count = defineSystem({\n  name: 'counter.advance',\n  phase: 'gameplay',\n  run(ctx) {\n    for (const entity of ctx.query(Counter)) {\n      entity.set(Counter, { value: entity.get(Counter).value + 1 })\n    }\n  },\n})\nconst plugin = definePlugin({\n  name: 'counter', components: [Counter], systems: [count],\n})\nconst sim = await createSim({ seed: 1, plugins: [plugin] })\ntry {\n  sim.spawn([Counter]) // Initial setup, before stepping.\n  for (let tick = 0; tick < 60; tick++) sim.step([])\n  const [entity] = sim.query(Counter)\n  if (entity.get(Counter).value !== 60) throw new Error('Expected 60 ticks')\n} finally {\n  sim.dispose()\n}",
    "entries": [
      {
        "name": "createSim",
        "signature": "createSim(options: SimOptions): Promise<Sim>",
        "description": "Creates an isolated simulation and awaits plugin engine initialization. Once created, stepping is synchronous.",
        "returnType": "Promise<Sim>",
        "parameters": [
          {
            "name": "options.seed",
            "type": "number",
            "desc": "Seed for repeatable random streams. Use the same seed when reproducing a run."
          },
          {
            "name": "options.plugins",
            "type": "readonly PluginDef[]",
            "desc": "Definitions to register, including required dependencies."
          },
          {
            "name": "options.tickHz",
            "type": "number",
            "desc": "Optional integer from 1 to 1000. Defaults to 60 fixed ticks per second."
          },
          {
            "name": "options.content",
            "type": "unknown",
            "desc": "Optional canonical JSON content, copied, frozen, and hashed at creation."
          }
        ],
        "notes": [
          "Always await creation and dispose the sim when its owner closes. Duplicate definitions or invalid ordering reject creation.",
          "Replay equivalence requires matching code, content, initial state, tick rate, and commands as well as the seed."
        ]
      },
      {
        "name": "defineComponent",
        "signature": "defineComponent<S extends FieldSchema>(id: string, fields: S, opts?: { render?: boolean }): ComponentDef<S>",
        "description": "Declares per-entity fields. Read with entity.get and write with entity.set so changes appear in render deltas.",
        "returnType": "ComponentDef<S>",
        "parameters": [
          {
            "name": "id",
            "type": "string",
            "desc": "Stable lowercase ID with dot or dash separators, used in snapshots and render rows."
          },
          {
            "name": "fields",
            "type": "FieldSchema",
            "desc": "Field names mapped to f32, f64, i32, u32, bool, entity, or string."
          },
          {
            "name": "opts.render",
            "type": "boolean",
            "desc": "Optional; defaults to true. Set false for simulation-only data such as input buffers."
          }
        ],
        "notes": [
          "Numbers default to 0, booleans to false, and strings to empty. Writes validate field types and ranges.",
          "Do not mutate the object returned by entity.get. Use entity.set with the fields you want to change."
        ]
      },
      {
        "name": "defineCommand",
        "signature": "defineCommand<Z extends z.ZodType>(id: string, schema: Z): CommandDef<Z>",
        "description": "Defines a validated input payload. Register it in a plugin and read accepted commands through ctx.commands.of(definition).",
        "returnType": "CommandDef<Z>",
        "parameters": [
          {
            "name": "id",
            "type": "string",
            "desc": "Command type in the input envelope."
          },
          {
            "name": "schema",
            "type": "z.ZodType",
            "desc": "Zod schema that validates payloads before systems receive them."
          }
        ],
        "notes": [
          "Keyboard, touch, and UI callbacks enqueue commands. Gameplay changes happen when a system consumes them."
        ]
      },
      {
        "name": "defineEvent",
        "signature": "defineEvent<Z extends z.ZodType>(id: string, schema: Z): EventDef<Z>",
        "description": "Defines an event emitted with ctx.emit and returned in StepResult.events. Register it in the owning plugin.",
        "returnType": "EventDef<Z>",
        "parameters": [
          {
            "name": "id",
            "type": "string",
            "desc": "Stable event ID, such as player.jumped."
          },
          {
            "name": "schema",
            "type": "z.ZodType",
            "desc": "Zod schema for the emitted payload."
          }
        ],
        "notes": [
          "React with audio and interface effects outside the sim."
        ]
      },
      {
        "name": "defineSystem",
        "signature": "defineSystem(spec: { name: string; phase: Phase; run: (ctx: SimContext) => void; before?: readonly string[]; after?: readonly string[] }): SystemDef",
        "description": "Declares synchronous gameplay behavior. Query matching entities through the context and write their components explicitly.",
        "returnType": "SystemDef",
        "parameters": [
          {
            "name": "spec.name",
            "type": "string",
            "desc": "Unique stable system name; also identifies its RNG stream."
          },
          {
            "name": "spec.phase",
            "type": "Phase",
            "desc": "input, prePhysics, physics, postPhysics, gameplay, or cleanup, in that order."
          },
          {
            "name": "spec.run",
            "type": "(ctx: SimContext) => void",
            "desc": "One synchronous tick. ctx.dt is the fixed step in seconds; ctx.rng is this system's stream."
          },
          {
            "name": "spec.before / spec.after",
            "type": "readonly string[]",
            "desc": "Optional ordering constraints by system name. Invalid schedules fail at creation."
          }
        ],
        "notes": [
          "Keep I/O, browser APIs, wall clocks, Math.random, and Effect outside run.",
          "A thrown system faults the sim. Restore a valid snapshot or recreate it before continuing."
        ]
      },
      {
        "name": "definePlugin",
        "signature": "definePlugin(spec: { name: string; components?: readonly ComponentDef[]; systems?: readonly SystemDef[]; dependsOn?: readonly string[]; commands?: readonly CommandDef[]; events?: readonly EventDef[]; resources?: readonly ResourceDef[]; state?: (setup: PluginStateSetup) => Promise<PluginState>; config?: unknown }): PluginDef",
        "description": "Registers a coherent set of definitions and optional engine state. Each sim owns its own plugin state.",
        "returnType": "PluginDef",
        "parameters": [
          {
            "name": "spec.name",
            "type": "string",
            "desc": "Unique plugin ID."
          },
          {
            "name": "spec.components / systems / commands / events / resources",
            "type": "readonly definition[]",
            "desc": "Definitions this plugin owns. Omitted lists are empty."
          },
          {
            "name": "spec.dependsOn",
            "type": "readonly string[]",
            "desc": "Names of required plugins."
          },
          {
            "name": "spec.config",
            "type": "unknown",
            "desc": "Optional canonical JSON settings included in the schema hash, such as gravity."
          }
        ],
        "notes": [
          "Optional state setup creates an engine with snapshot, prepareRestore, and dispose. Ordinary gameplay plugins usually need only definitions and systems."
        ]
      },
      {
        "name": "defineResource",
        "signature": "defineResource<Z extends z.ZodType>(id: string, schema: Z, init: () => z.input<Z>): ResourceDef<Z>",
        "description": "Defines shared per-sim state such as round score. Systems access it with ctx.resource(definition).",
        "returnType": "ResourceDef<Z>",
        "parameters": [
          {
            "name": "id",
            "type": "string",
            "desc": "Stable resource ID."
          },
          {
            "name": "schema",
            "type": "z.ZodType",
            "desc": "Validates initial and restored values."
          },
          {
            "name": "init",
            "type": "() => z.input<Z>",
            "desc": "Creates an independent initial value for each sim."
          }
        ],
        "notes": [
          "Register the resource in its plugin. Keep gameplay updates in systems."
        ]
      },
      {
        "name": "step",
        "signature": "sim.step(commands: readonly Command[]): StepResult",
        "description": "Advances one fixed tick and returns the resulting tick, events, render delta, and rejected commands.",
        "returnType": "StepResult",
        "parameters": [
          {
            "name": "commands",
            "type": "readonly Command[]",
            "desc": "Envelopes contain tick, source, seq, type, and payload. tick is sim.tick before the call; source is a u8 player slot and seq is a u32 counter."
          }
        ],
        "notes": [
          "Rejections report bad-header, unknown-command, wrong-tick, duplicate-seq, or invalid-payload. Inspect result.rejected when input seems ignored.",
          "Accepted commands are ordered by source and sequence. Keep sequence numbers distinct for a source within a tick.",
          "Presentation consumes the result and draws with a sub-tick alpha. Do not step gameplay from a second render loop."
        ],
        "receiver": "Sim"
      },
      {
        "name": "spawn",
        "signature": "sim.spawn(parts: readonly SpawnPart[]): number",
        "description": "Creates an entity during initial scene setup and returns its stable ID.",
        "returnType": "number",
        "parameters": [
          {
            "name": "parts",
            "type": "readonly SpawnPart[]",
            "desc": "A component definition or [definition, initial fields] tuple for each registered component."
          }
        ],
        "notes": [
          "During gameplay, request spawns through commands and call ctx.spawn from a system. ctx.spawn takes parts as separate arguments."
        ],
        "receiver": "Sim"
      },
      {
        "name": "snapshot",
        "signature": "sim.snapshot(): Uint8Array",
        "description": "Serializes canonical state, including resources, RNG, and plugin state.",
        "returnType": "Uint8Array",
        "notes": [
          "A snapshot is state, not a persistent save service. Store bytes outside the sim with matching code and content."
        ],
        "receiver": "Sim"
      },
      {
        "name": "restore",
        "signature": "sim.restore(bytes: Uint8Array): void",
        "description": "Replaces live state with a compatible snapshot. Invalid data throws and leaves current state unchanged.",
        "returnType": "void",
        "parameters": [
          {
            "name": "bytes",
            "type": "Uint8Array",
            "desc": "Snapshot bytes for compatible definitions and content."
          }
        ],
        "notes": [
          "Catch SnapshotFormatError and SnapshotMismatchError at the application boundary. Preserve saved bytes when loading fails.",
          "The next step emits a full render resync; let presentation rebuild its views."
        ],
        "receiver": "Sim"
      },
      {
        "name": "hash",
        "signature": "sim.hash(): string",
        "description": "Returns the current snapshot's XXH64 hash as 16 hexadecimal digits for equivalent-run comparisons.",
        "returnType": "string",
        "notes": [
          "Use describeSnapshot and the first differing tick to investigate divergence; a hash alone does not explain it."
        ],
        "receiver": "Sim"
      },
      {
        "name": "describeSnapshot",
        "signature": "sim.describeSnapshot(bytes?: Uint8Array): SnapshotView",
        "description": "Decodes a readable snapshot without changing live state. Omit bytes to inspect current state.",
        "returnType": "SnapshotView",
        "parameters": [
          {
            "name": "bytes",
            "type": "Uint8Array",
            "desc": "Optional snapshot. Header checks run; this does not replace full restore validation."
          }
        ],
        "receiver": "Sim"
      },
      {
        "name": "dispose",
        "signature": "sim.dispose(): void",
        "description": "Releases the world and plugin engines. Use in test teardown, runtime cleanup, and failed startup paths.",
        "returnType": "void",
        "notes": [
          "Idempotent. Later state operations throw SimDisposedError."
        ],
        "receiver": "Sim"
      },
      {
        "name": "createRng",
        "signature": "createRng(seed: number): Rng",
        "description": "Creates a seeded stream with next(), nextU32(), int(n), and state(). Systems normally use ctx.rng.",
        "returnType": "Rng",
        "parameters": [
          {
            "name": "seed",
            "type": "number",
            "desc": "Seed for a standalone stream."
          }
        ],
        "notes": [
          "rng.int(n) returns an integer from 0 inclusive to n exclusive. n must be a positive integer no greater than 2^32."
        ]
      }
    ]
  },
  {
    "id": "replays",
    "name": "@mcthaydt/automata-sim/replay",
    "title": "Snapshots and replays",
    "sourcePath": "packages/sim/src/replay/index.ts",
    "description": "Record accepted commands with checkpoints, encode a run, and verify it against matching plugins and content. Import replays through this simulation subpath.",
    "example": "import { createSim } from '@mcthaydt/automata-sim'\nimport { createRecorder, createReplayStepper, encodeReplay, decodeReplay } from '@mcthaydt/automata-sim/replay'\n\nconst sim = await createSim({ seed: 7, plugins: [] })\ntry {\n  const recorder = createRecorder(sim, { checkEvery: 10 })\n  for (let tick = 0; tick < 60; tick++) recorder.step([])\n  const replay = decodeReplay(encodeReplay(recorder.finish()))\n  const playback = await createReplayStepper(replay, { plugins: [] })\n  try {\n    const result = playback.run()\n    if (!result.ok) throw new Error('Replay diverged at tick ' + result.failed?.tick)\n  } finally {\n    playback.dispose()\n  }\n} finally {\n  sim.dispose()\n}",
    "entries": [
      {
        "name": "createRecorder",
        "signature": "createRecorder(sim: Sim, options?: RecorderOptions): Recorder",
        "description": "Captures the starting snapshot and records accepted commands while advancing through recorder.step.",
        "returnType": "Recorder",
        "parameters": [
          {
            "name": "sim",
            "type": "Sim",
            "desc": "Live simulation to record. Only the recorder may step it during recording."
          },
          {
            "name": "options.checkEvery",
            "type": "number",
            "desc": "Optional positive checkpoint interval. Defaults to 60 ticks."
          },
          {
            "name": "options.reference",
            "type": "{ snapshotEvery: number }",
            "desc": "Optional golden-run mode: per-tick hashes and periodic snapshots."
          }
        ],
        "notes": [
          "finish() records the final hash and closes the recorder. Stepping the sim separately invalidates the recording."
        ]
      },
      {
        "name": "createReplayStepper",
        "signature": "createReplayStepper(replay: Replay, setup: ReplayStepSetup): Promise<ReplayStepper>",
        "description": "Creates a fresh sim from the starting snapshot and feeds recorded commands. run() stops at the first failed check.",
        "returnType": "Promise<ReplayStepper>",
        "parameters": [
          {
            "name": "replay",
            "type": "Replay",
            "desc": "Decoded or freshly recorded run."
          },
          {
            "name": "setup.plugins",
            "type": "readonly PluginDef[]",
            "desc": "Matching plugin definitions."
          },
          {
            "name": "setup.content",
            "type": "unknown",
            "desc": "Matching simulation content if originally supplied."
          }
        ],
        "notes": [
          "Inspect result.ok, checks, and failed. Dispose the stepper when finished.",
          "Snapshot or header mismatches can reject creation before playback begins."
        ]
      },
      {
        "name": "encodeReplay",
        "signature": "encodeReplay(replay: Replay): Uint8Array",
        "description": "Encodes a recorded run to canonical, uncompressed bytes.",
        "returnType": "Uint8Array",
        "parameters": [
          {
            "name": "replay",
            "type": "Replay",
            "desc": "Run from recorder.finish()."
          }
        ],
        "notes": [
          "For compressed .replay files, use packReplay with a compression adapter."
        ]
      },
      {
        "name": "decodeReplay",
        "signature": "decodeReplay(bytes: Uint8Array): Replay",
        "description": "Validates and decodes uncompressed bytes. Malformed data throws ReplayFormatError.",
        "returnType": "Replay",
        "parameters": [
          {
            "name": "bytes",
            "type": "Uint8Array",
            "desc": "Output from encodeReplay. Compressed files need unpackReplay."
          }
        ]
      }
    ]
  },
  {
    "id": "runtime",
    "name": "@mcthaydt/automata-runtime",
    "title": "Runtime",
    "sourcePath": "packages/runtime/src/index.ts",
    "description": "Effect-scoped boot, screens, loading, settings, and shutdown. Runtime service tags are available inside runtime-provided contexts.",
    "example": "import { runGame, type GameDefinition } from '@mcthaydt/automata-runtime'\n\n// Supply your game's root, hosting, compiled content, screens, and renderer.\nexport function mountGame(game: GameDefinition) {\n  const handle = runGame(game)\n  // Await this cleanup when the owning page or component unmounts.\n  return async () => { await handle.shutdown() }\n}",
    "entries": [
      {
        "name": "runGame",
        "signature": "runGame<S>(game: GameDefinition<S>): RuntimeHandle",
        "description": "Starts boot immediately and returns a shutdown handle. The runtime provides loading and failure recovery UI.",
        "returnType": "RuntimeHandle",
        "parameters": [
          {
            "name": "game.root",
            "type": "HTMLElement",
            "desc": "Mount point owned by this running game."
          },
          {
            "name": "game.hosting",
            "type": "Omit<HostingOptions, 'disclosedEvents'>",
            "desc": "Game ID, requested capabilities, and pause policy."
          },
          {
            "name": "game.content",
            "type": "{ data: CompiledContentData; hash: string }",
            "desc": "Runtime content and its full content hash."
          },
          {
            "name": "game.screens",
            "type": "readonly ScreenDef[]",
            "desc": "Implementations matching the flow graph's screen IDs."
          },
          {
            "name": "game.renderer",
            "type": "RendererFactory",
            "desc": "Scoped renderer factory, such as createPixiRenderer(...)."
          }
        ],
        "notes": [
          "runGame is not a Promise and does not accept a bare canvas or sim. Await handle.shutdown() to close its scope.",
          "GameDefinition also supports settings, extensions, copy, and test seams. Use its current type for the full contract."
        ]
      },
      {
        "name": "Time",
        "signature": "Time: Context.Tag<Time, Time>",
        "description": "Effect service for pause state. yield* Time exposes paused, reasons, pause(reason), and resume(reason).",
        "returnType": "Effect service tag",
        "notes": [
          "Pause reasons are menu and lifecycle. Resuming one does not remove the other. Gameplay time stays fixed inside the sim."
        ]
      },
      {
        "name": "Flow",
        "signature": "Flow: Context.Tag<Flow, Flow>",
        "description": "Effect service exposing current screen, dispatch(event), openMenu(), and the settled Effect.",
        "returnType": "Effect service tag",
        "notes": [
          "dispatch returns whether an event was accepted; it does not await the transition. Yield flow.settled to wait.",
          "Screen IDs and transition events come from the compiled flow graph."
        ]
      },
      {
        "name": "Settings",
        "signature": "Settings: Context.Tag<Settings, Settings>",
        "description": "Effect service holding the booted settings key and store. Use settingsStore(definition) for typed access.",
        "returnType": "Effect service tag",
        "notes": [
          "Persistence uses Hosting.saves. Refused saves do not silently switch to localStorage."
        ]
      },
      {
        "name": "settingsStore",
        "signature": "settingsStore<S>(def: SettingsDef<S>): Effect.Effect<SettingsStore<S>, never, Settings>",
        "description": "Gets the typed booted store with get, subscribe, and update.",
        "returnType": "Effect.Effect<SettingsStore<S>, never, Settings>",
        "parameters": [
          {
            "name": "def",
            "type": "SettingsDef<S>",
            "desc": "The definition used at boot, with a matching key."
          }
        ],
        "notes": [
          "A mismatched key is a programming defect. Updates change memory first and persist asynchronously; they are not durability acknowledgements."
        ]
      }
    ]
  },
  {
    "id": "presentation",
    "name": "@mcthaydt/automata-render-pixi",
    "title": "PixiJS presentation",
    "sourcePath": "packages/render-pixi/src/index.ts",
    "description": "Draw render deltas without changing gameplay state. WebGL2 is the default; WebGPU is opt-in. Import no-eval before initializing PixiJS.",
    "example": "import '@mcthaydt/automata-render-pixi/no-eval'\nimport { createPixiRenderer, type EntityView } from '@mcthaydt/automata-render-pixi'\nimport { Graphics } from 'pixi.js'\n\n// Expects a registered, renderable component named position with x/y fields.\nexport const renderer = createPixiRenderer({\n  logicalWidth: 320, logicalHeight: 192,\n  entityViews: {\n    position: () => {\n      const dot = new Graphics().circle(0, 0, 4).fill(0xffc857)\n      const view: EntityView = {\n        container: dot,\n        update(current, previous, alpha = 1) {\n          const now = current.position as { x: number; y: number }\n          const before = (previous?.position ?? now) as { x: number; y: number }\n          dot.position.set(\n            before.x + (now.x - before.x) * alpha,\n            before.y + (now.y - before.y) * alpha,\n          )\n        },\n      }\n      return view\n    },\n  },\n})",
    "entries": [
      {
        "name": "createPixiRenderer",
        "signature": "createPixiRenderer(options?: PixiRendererOptions): (target: RenderTarget) => Effect.Effect<PixiRenderer, RendererUnavailable, Scope.Scope>",
        "description": "Returns a GameDefinition renderer factory. The runtime supplies the host element, geometry owner, and assets.",
        "returnType": "Scoped renderer factory",
        "parameters": [
          {
            "name": "options.logicalWidth / logicalHeight",
            "type": "number",
            "desc": "Logical game dimensions for letterboxing."
          },
          {
            "name": "options.preference",
            "type": "'webgl' | 'webgpu'",
            "desc": "Defaults to webgl (WebGL2). Opt-in WebGPU falls back to WebGL2 if initialization fails."
          },
          {
            "name": "options.entityViews",
            "type": "EntityViewResolver",
            "desc": "Factory, or component-ID map of factories, creating one view per entity."
          },
          {
            "name": "options.setup",
            "type": "(stage: PixiStage) => void",
            "desc": "Optional stage setup, such as filters."
          }
        ],
        "notes": [
          "View updates receive current fields, previous fields when available, and interpolation alpha. Handle the first frame with no previous values.",
          "Keep simulation and rendering units consistent. Emberwick player positions use subpixels."
        ]
      },
      {
        "name": "RenderDeltaConsumer",
        "signature": "new RenderDeltaConsumer(world: Container, resolver?: EntityViewResolver)",
        "description": "Maps stable entity IDs to views. apply(delta) handles additions, changes, removals, and full resync.",
        "returnType": "RenderDeltaConsumer",
        "parameters": [
          {
            "name": "world",
            "type": "Container",
            "desc": "Parent for generated view containers."
          },
          {
            "name": "resolver",
            "type": "EntityViewResolver",
            "desc": "Optional factory or component-ID map selecting entity views."
          }
        ],
        "notes": [
          "The framework renderer already owns a consumer. Create one only for a custom presentation integration."
        ]
      }
    ]
  },
  {
    "id": "physics",
    "name": "@mcthaydt/automata-physics/2d",
    "title": "Physics",
    "sourcePath": "packages/physics/src/2d.ts",
    "description": "Deterministic 2D physics inside the simulation. Use the /2d entry and spawn helpers rather than importing Rapier or relying on zero-valued collider defaults.",
    "example": "import { createSim } from '@mcthaydt/automata-sim'\nimport { physics2d, BodyKind, body2d, collider2d, transform2d } from '@mcthaydt/automata-physics/2d'\n\nconst sim = await createSim({ seed: 1, plugins: [physics2d()] })\ntry {\n  sim.spawn([transform2d({ x: 0, y: 3 }), body2d(BodyKind.dynamic), collider2d.ball(0.5)])\n  sim.spawn([transform2d({ x: 0, y: -1 }), body2d(BodyKind.fixed), collider2d.cuboid(10, 0.5)])\n  for (let tick = 0; tick < 60; tick++) sim.step([])\n} finally {\n  sim.dispose()\n}",
    "entries": [
      {
        "name": "physics2d",
        "signature": "physics2d(options?: Physics2DOptions): PluginDef",
        "description": "Creates the deterministic plugin. WebAssembly initializes during createSim and is released by sim.dispose().",
        "returnType": "PluginDef",
        "parameters": [
          {
            "name": "options.gravity",
            "type": "{ x: number; y: number }",
            "desc": "Optional acceleration in metres per second squared. Defaults to { x: 0, y: -9.81 }."
          }
        ],
        "notes": [
          "Gravity is included in the schema hash. Snapshots from a different gravity configuration are incompatible."
        ]
      },
      {
        "name": "RigidBody2D",
        "signature": "RigidBody2D: ComponentDef",
        "description": "Body kind, velocity, and damping fields. Prefer body2d(BodyKind.dynamic) or body2d(BodyKind.fixed) during spawning.",
        "returnType": "Component definition",
        "notes": [
          "Systems own body changes; presentation reads the resulting transform."
        ]
      },
      {
        "name": "Collider2D",
        "signature": "Collider2D: ComponentDef",
        "description": "Shape and collision settings. Use collider2d.ball, cuboid, or capsule to supply collision defaults.",
        "returnType": "Component definition",
        "notes": [
          "cuboid takes half extents. Raw zero-valued fields are not equivalent to the spawn helpers."
        ]
      },
      {
        "name": "transform2d",
        "signature": "transform2d(at?: { x?: number; y?: number; rotation?: number }): SpawnPart",
        "description": "Builds a starting Transform2D part; missing values default to zero.",
        "returnType": "SpawnPart",
        "parameters": [
          {
            "name": "at",
            "type": "{ x?: number; y?: number; rotation?: number }",
            "desc": "Optional initial transform, passed as a part to sim.spawn or ctx.spawn."
          }
        ]
      }
    ]
  },
  {
    "id": "ui",
    "name": "@mcthaydt/automata-ui",
    "title": "Responsive UI",
    "sourcePath": "packages/ui/src/index.ts",
    "description": "One geometry owner coordinates usable space, safe areas, browser bars, keyboard occlusion, and host display metrics. Svelte primitives consume that geometry.",
    "example": "import { createGeometryOwner } from '@mcthaydt/automata-ui'\n\n// For custom browser wiring. The runtime already creates its own geometry owner.\nexport function trackGeometry() {\n  const owner = createGeometryOwner({ window, root: document.documentElement })\n  return { owner, cleanup() { owner.dispose() } }\n}",
    "entries": [
      {
        "name": "createGeometryOwner",
        "signature": "createGeometryOwner(options: GeometryOwnerOptions): GeometryOwner",
        "description": "Measures available space and publishes reactive geometry and CSS properties as viewport overlays settle.",
        "returnType": "GeometryOwner",
        "parameters": [
          {
            "name": "options.window",
            "type": "ViewportWindow",
            "desc": "Browser window or injected test viewport."
          },
          {
            "name": "options.root",
            "type": "HTMLElement",
            "desc": "CSS publication root, normally document.documentElement."
          },
          {
            "name": "options.host",
            "type": "HostDisplay",
            "desc": "Optional initial host display metrics."
          }
        ],
        "notes": [
          "Read owner.geometry.current in Svelte or subscribe with owner.onChange. Forward host updates using setHostDisplay.",
          "Reuse the runtime owner when present. Dispose custom owners and unsubscribe listeners on cleanup."
        ]
      },
      {
        "name": "ScreenFrame",
        "signature": "ScreenFrame({ arrangement, body, hero?, actions?, back?, backLabel?, header?, end?, testId? })",
        "description": "Svelte screen layout keeping body and actions inside usable geometry. Content regions are snippets.",
        "returnType": "Svelte component",
        "parameters": [
          {
            "name": "arrangement",
            "type": "'stack' | 'split'",
            "desc": "Lay out hero and body vertically or side by side."
          },
          {
            "name": "body",
            "type": "Snippet",
            "desc": "Required main content."
          },
          {
            "name": "hero / actions / header / end",
            "type": "Snippet",
            "desc": "Optional regions and corner controls."
          },
          {
            "name": "back / backLabel",
            "type": "() => void / string",
            "desc": "Optional back action and accessible label."
          }
        ],
        "notes": [
          "Choose layout from usable geometry, independently of input mode. Verify rotation, keyboard occlusion, and reachable controls on devices."
        ]
      },
      {
        "name": "Dialog",
        "signature": "Dialog({ title, onclose, children?, actions? })",
        "description": "Svelte modal with trapped focus, inert background, Escape handling, and focus restoration when removed.",
        "returnType": "Svelte component",
        "parameters": [
          {
            "name": "title",
            "type": "string",
            "desc": "Visible title and accessible dialog name."
          },
          {
            "name": "onclose",
            "type": "() => void",
            "desc": "Called on Escape; the owner closes the dialog."
          },
          {
            "name": "children / actions",
            "type": "Snippet",
            "desc": "Optional body and buttons. Mark the safe action with data-initial-focus."
          }
        ],
        "notes": [
          "Mount only while open, using a Svelte if block. Keep the safe action reachable in compact height."
        ]
      }
    ]
  },
  {
    "id": "hosting",
    "name": "@mcthaydt/automata-host",
    "title": "Hosting",
    "sourcePath": "packages/host/src/index.ts",
    "description": "Use Hosting for readiness, capabilities, saves, lifecycle, and platform actions. The Ruken SDK owns the host protocol.",
    "example": "import { makeHosting } from '@mcthaydt/automata-host'\nimport { Effect } from 'effect'\n\nexport const saveProgress = Effect.scoped(Effect.gen(function* () {\n  const hosting = yield* makeHosting({\n    gameId: 'my-game', wants: ['saves'], pauseBehavior: 'pause',\n  })\n  yield* hosting.ready\n  if (!hosting.granted.has('saves')) {\n    return yield* Effect.fail(new Error('Saves unavailable in this session'))\n  }\n  yield* hosting.saves.set('progress-v1', JSON.stringify({ version: 1, room: 'room-1' }))\n  return yield* hosting.saves.flush\n}))\n// Run at the application boundary; handle the returned status or error.\n// In a runtime screen, reuse yield* Hosting instead of creating a session.",
    "entries": [
      {
        "name": "makeHosting",
        "signature": "makeHosting(options: HostingOptions, seams?: HostingSeams): Effect.Effect<Hosting, HostError, Scope.Scope>",
        "description": "Creates a scoped session. Wait for hosting.ready before presenting gameplay.",
        "returnType": "Effect.Effect<Hosting, HostError, Scope.Scope>",
        "parameters": [
          {
            "name": "options.gameId",
            "type": "string",
            "desc": "Must match ship.config.ts and ruken.toml."
          },
          {
            "name": "options.wants",
            "type": "readonly Capability[]",
            "desc": "Requested capabilities. Check hosting.granted before offering dependent features."
          },
          {
            "name": "options.pauseBehavior",
            "type": "'pause' | 'continue'",
            "desc": "Lifetime pause policy matching the manifest."
          },
          {
            "name": "seams",
            "type": "HostingSeams",
            "desc": "Optional injected SDK environment for testing."
          }
        ],
        "notes": [
          "Keep the scope alive while the session is in use. Runtime screens already receive Hosting.",
          "Inspect hosting.kind and handshake.fellBack for iframe issues. A denied hosted capability must not silently switch to device storage."
        ]
      },
      {
        "name": "Hosting",
        "signature": "Hosting: Context.Tag<Hosting, Hosting>",
        "description": "Effect service exposing ready, granted, player, locale, observable host state, and platform operations.",
        "returnType": "Effect service tag",
        "notes": [
          "saves.get(key) yields string or null. saves.set and remove can fail with HostError. Validate and version saved payloads.",
          "saves.flush is an Effect value, not a function. Inspect its result: a local update does not establish remote durability.",
          "Use onExiting for bounded cleanup and round.start / round.end for round lifecycle. Keep credentials outside game bundles."
        ]
      }
    ]
  },
  {
    "id": "content",
    "name": "@mcthaydt/automata-content",
    "title": "Content",
    "sourcePath": "packages/content/src/index.ts",
    "description": "Register Zod schemas for authored TOML, compile content, and pass the appropriate partition to the runtime or simulation.",
    "example": "import { compileContent, defineContentSchema } from '@mcthaydt/automata-content'\nimport { z } from 'zod'\n\nexport const enemySchema = defineContentSchema(\n  'enemy',\n  z.strictObject({ health: z.int().min(1), speed: z.number().positive() }),\n  { folder: 'enemies' },\n)\n// Reads content/enemies/*.toml plus built-in documents under this root.\nexport const compileGameContent = (root: string) =>\n  compileContent({ root, schemas: [enemySchema] })",
    "entries": [
      {
        "name": "defineContentSchema",
        "signature": "defineContentSchema<K extends string, S extends z.ZodType>(kind: K, schema: S, place: ContentSchemaPlace, options?: ContentSchemaOptions): ContentSchemaDef<K, S>",
        "description": "Registers one content kind and the file or folder that owns it.",
        "returnType": "ContentSchemaDef<K, S>",
        "parameters": [
          {
            "name": "kind",
            "type": "string",
            "desc": "Unique lowercase kind. tuning, flow, palette, game, and assets are reserved."
          },
          {
            "name": "schema",
            "type": "z.ZodType",
            "desc": "Zod schema for each document or collection item."
          },
          {
            "name": "place",
            "type": "{ file: string } | { folder: string }",
            "desc": "Location relative to content/. A file is one document; a folder is a collection."
          },
          {
            "name": "options.sim",
            "type": "boolean",
            "desc": "Defaults to true. Set false only for presentation-only content that cannot affect gameplay."
          }
        ],
        "notes": [
          "Never classify gameplay data as presentation-only to bypass snapshot or replay compatibility."
        ]
      },
      {
        "name": "compileContent",
        "signature": "compileContent(options: ContentOptions): Effect.Effect<CompiledContent, ContentCompileFailed | InvalidContentConfig>",
        "description": "Reads and validates in memory, returning data, generated file texts, hashes, and warnings. Writes nothing.",
        "returnType": "Effect.Effect<CompiledContent, ContentCompileFailed | InvalidContentConfig>",
        "parameters": [
          {
            "name": "options.root",
            "type": "string",
            "desc": "Project root containing content/."
          },
          {
            "name": "options.schemas",
            "type": "readonly ContentSchemaDef[]",
            "desc": "Game-specific registrations."
          },
          {
            "name": "options.flow / tunables / generators",
            "type": "ContentOptions",
            "desc": "Optional code-owned flow capabilities, tunables, and generators."
          }
        ],
        "notes": [
          "compiled.data and compiled.hash identify full runtime content. compiled.sim.data and compiled.sim.hash identify its gameplay partition.",
          "The full content hash, simulation content hash, and sim.hash() identify different artifacts. They are not interchangeable."
        ]
      },
      {
        "name": "buildContent",
        "signature": "buildContent(options: ContentOptions): Effect.Effect<CompiledContent, ContentCompileFailed | InvalidContentConfig | ContentWriteFailed>",
        "description": "Compiles successfully, then writes generated outputs. A failed compile leaves previous outputs intact.",
        "returnType": "Effect.Effect<CompiledContent, ContentCompileFailed | InvalidContentConfig | ContentWriteFailed>",
        "parameters": [
          {
            "name": "options",
            "type": "ContentOptions",
            "desc": "Compiler options; outDir defaults to content/generated relative to root."
          }
        ],
        "notes": [
          "Each file is replaced atomically. For live editing, see the content hot-reload example and @mcthaydt/automata-content/vite."
        ]
      },
      {
        "name": "verifyContent",
        "signature": "verifyContent(options: ContentOptions): Effect.Effect<void, ContentCompileFailed | InvalidContentConfig>",
        "description": "Recompiles in memory and compares generated outputs byte for byte. Missing or edited outputs report staleArtifact.",
        "returnType": "Effect.Effect<void, ContentCompileFailed | InvalidContentConfig>",
        "parameters": [
          {
            "name": "options",
            "type": "ContentOptions",
            "desc": "Use the same options as the build."
          }
        ],
        "notes": [
          "Regenerate from source; do not hand-edit generated JSON or hashes."
        ]
      }
    ]
  },
  {
    "id": "shipping",
    "name": "@mcthaydt/automata-ship",
    "title": "Shipping",
    "sourcePath": "packages/ship/src/index.ts",
    "description": "Configure identity and prepare a built folder. Preparation checks the local artifact; publishing needs a destination and credentials.",
    "example": "import { defineShipConfig } from '@mcthaydt/automata-ship'\n\n// ship.config.ts. Keep version aligned with the game package.json.\nexport default defineShipConfig({\n  game: { id: 'my-game', title: 'My Game', version: '0.1.0', entry: 'index.html', sdk: '^0.0.0' },\n  runtime: { renderer: 'webgl2', orientation: 'any', inputs: ['touch', 'keyboard'], pause_behavior: 'pause' },\n  network: { connect: [] },\n  content: { languages: ['en'], rating: 'everyone', descriptors: [] },\n})",
    "entries": [
      {
        "name": "defineShipConfig",
        "signature": "defineShipConfig(config: ShipConfig): ShipConfig",
        "description": "Provides type checking and editor completion for ship.config.ts using Ruken manifest fields.",
        "returnType": "ShipConfig",
        "parameters": [
          {
            "name": "config.game",
            "type": "Manifest['game']",
            "desc": "Game ID, title, version, entry, and SDK range. Match the hosting game ID."
          },
          {
            "name": "config.runtime",
            "type": "Omit<Manifest['runtime'], 'allow_eval'>",
            "desc": "Renderer, orientation, inputs, and pause policy. Ship sets allow_eval to false."
          },
          {
            "name": "config.network / content",
            "type": "ShipConfig",
            "desc": "Declared connections, languages, rating, and descriptors."
          }
        ],
        "notes": [
          "For the starter, run pnpm --filter @af-examples/base-2d build, then prepare-ruken. Preparation does not upload or activate a game.",
          "automata-ship publish uses RUKEN_API and RUKEN_TOKEN and delegates validation and upload to Ruken. Supply credentials in the environment, never browser code."
        ]
      }
    ]
  }
]

export function cheatsheetSearchText(module: CheatsheetModule, entry: CheatsheetEntry): string {
  return [module.name, module.title, entry.name, entry.signature, entry.description, entry.returnType,
    ...(entry.notes ?? []), ...(entry.parameters ?? []).flatMap(p => [p.name, p.type, p.desc])].join(' ')
}

export function searchCheatsheet(query: string): CheatsheetEntry[] {
  if (!query.trim()) return []
  const words = query.trim().toLowerCase().split(/\s+/)
  return CHEATSHEET_MODULES.flatMap(module => module.entries.filter(entry => {
    const text = cheatsheetSearchText(module, entry).toLowerCase()
    return words.every(word => text.includes(word))
  }))
}
