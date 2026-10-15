export interface CheatsheetEntry {
  name: string
  signature: string
  description: string
  returnType: string
  parameters?: { name: string; type: string; desc: string }[]
  example?: string
}

export interface CheatsheetModule {
  name: string
  title: string
  description: string
  entries: CheatsheetEntry[]
}

export const CHEATSHEET_MODULES: CheatsheetModule[] = [
  {
    "name": "@mcthaydt/automata-sim",
    "title": "Simulation",
    "description": "Simulation definitions, fixed ticks, snapshots and seeded randomness.",
    "entries": [
      {
        "name": "createSim",
        "signature": "createSim(options: SimOptions): Promise<Sim>",
        "description": "Creates and initializes a simulation. Await creation; stepping stays synchronous.",
        "returnType": "Promise<Sim>"
      },
      {
        "name": "defineComponent",
        "signature": "defineComponent<S extends FieldSchema>(id: string, fields: S, opts?: { render?: boolean }): ComponentDef<S>",
        "description": "Defines component fields and whether they appear in render deltas.",
        "returnType": "ComponentDef<S>"
      },
      {
        "name": "defineSystem",
        "signature": "defineSystem(spec: { name: string; phase: Phase; run: (ctx: SimContext) => void; before?: readonly string[]; after?: readonly string[] }): SystemDef",
        "description": "Declares a synchronous system and its ordering constraints.",
        "returnType": "SystemDef"
      },
      {
        "name": "definePlugin",
        "signature": "definePlugin(spec: { name: string; components?: readonly ComponentDef[]; systems?: readonly SystemDef[]; dependsOn?: readonly string[]; commands?: readonly CommandDef[]; events?: readonly EventDef[]; resources?: readonly ResourceDef[]; state?: (setup: PluginStateSetup) => Promise<PluginState>; config?: unknown }): PluginDef",
        "description": "Groups simulation definitions and optional engine state.",
        "returnType": "PluginDef"
      },
      {
        "name": "defineResource",
        "signature": "defineResource<Z extends z.ZodType>(id: string, schema: Z, init: () => z.input<Z>): ResourceDef<Z>",
        "description": "Defines validated per-simulation resource state.",
        "returnType": "ResourceDef<Z>"
      },
      {
        "name": "step",
        "signature": "sim.step(commands: readonly Command[]): StepResult",
        "description": "Instance method. Advances one tick and returns events, rejected commands and render deltas.",
        "returnType": "StepResult"
      },
      {
        "name": "snapshot",
        "signature": "sim.snapshot(): Uint8Array",
        "description": "Instance method. Serializes the current simulation in its canonical binary format.",
        "returnType": "Uint8Array"
      },
      {
        "name": "createRng",
        "signature": "createRng(seed: number): Rng",
        "description": "Creates a seeded random stream. Systems receive their own stream through context.",
        "returnType": "Rng"
      }
    ]
  },
  {
    "name": "@mcthaydt/automata-runtime",
    "title": "Runtime",
    "description": "Effect-scoped boot, screen flow and resource lifetimes.",
    "entries": [
      {
        "name": "runGame",
        "signature": "runGame<S>(game: GameDefinition<S>): RuntimeHandle",
        "description": "Starts the game runtime. The handle owns shutdown.",
        "returnType": "RuntimeHandle"
      },
      {
        "name": "Time",
        "signature": "Time",
        "description": "Effect service tag for runtime time and pause behavior.",
        "returnType": "Effect service tag"
      },
      {
        "name": "Flow",
        "signature": "Flow",
        "description": "Effect service tag for screen transitions.",
        "returnType": "Effect service tag"
      },
      {
        "name": "Settings",
        "signature": "Settings",
        "description": "Effect service tag for runtime settings.",
        "returnType": "Effect service tag"
      }
    ]
  },
  {
    "name": "@mcthaydt/automata-render-pixi",
    "title": "PixiJS presentation",
    "description": "2D presentation with WebGL2 by default and opt-in WebGPU.",
    "entries": [
      {
        "name": "createPixiRenderer",
        "signature": "createPixiRenderer(options?: PixiRendererOptions): (target: RenderTarget) => Effect.Effect<PixiRenderer, RendererUnavailable, Scope.Scope>",
        "description": "Builds a renderer factory for the runtime. Import the no-eval entry before initializing PixiJS.",
        "returnType": "Renderer factory"
      },
      {
        "name": "RenderDeltaConsumer",
        "signature": "RenderDeltaConsumer",
        "description": "Consumes simulation render deltas for entity views. See the class type for constructor and methods.",
        "returnType": "Class"
      }
    ]
  },
  {
    "name": "@mcthaydt/automata-physics",
    "title": "Physics",
    "description": "Import the 2D plugin from @mcthaydt/automata-physics/2d.",
    "entries": [
      {
        "name": "physics2d",
        "signature": "physics2d(options?: Physics2DOptions): PluginDef",
        "description": "Creates the deterministic 2D physics plugin. Its engine is initialized during async simulation creation.",
        "returnType": "PluginDef"
      },
      {
        "name": "RigidBody2D",
        "signature": "RigidBody2D",
        "description": "Rigid-body component exported by the /2d entry.",
        "returnType": "Component definition"
      },
      {
        "name": "Collider2D",
        "signature": "Collider2D",
        "description": "Collider component exported by the /2d entry.",
        "returnType": "Component definition"
      }
    ]
  },
  {
    "name": "@mcthaydt/automata-ui",
    "title": "Responsive UI",
    "description": "Geometry ownership, layout and status components.",
    "entries": [
      {
        "name": "createGeometryOwner",
        "signature": "createGeometryOwner(options: GeometryOwnerOptions): GeometryOwner",
        "description": "Owns viewport geometry and updates for responsive game UI.",
        "returnType": "GeometryOwner"
      },
      {
        "name": "ScreenFrame",
        "signature": "ScreenFrame",
        "description": "Svelte layout component. Consult its Props type for supported inputs.",
        "returnType": "Svelte component"
      },
      {
        "name": "Dialog",
        "signature": "Dialog",
        "description": "Svelte dialog component with framework focus handling.",
        "returnType": "Svelte component"
      }
    ]
  },
  {
    "name": "@mcthaydt/automata-host",
    "title": "Hosting",
    "description": "Ruken hosting and standalone sessions.",
    "entries": [
      {
        "name": "makeHosting",
        "signature": "makeHosting(options: HostingOptions, seams?: HostingSeams): Effect.Effect<Hosting, HostError, Scope.Scope>",
        "description": "Creates a scoped hosting session. Wait for its ready effect before presenting the game.",
        "returnType": "Effect.Effect<Hosting, HostError, Scope.Scope>"
      },
      {
        "name": "Hosting",
        "signature": "Hosting",
        "description": "The hosting service and its Effect context tag.",
        "returnType": "Effect service tag"
      }
    ]
  },
  {
    "name": "@mcthaydt/automata-content",
    "title": "Content",
    "description": "TOML compilation and registered schemas.",
    "entries": [
      {
        "name": "compileContent",
        "signature": "compileContent(options: ContentOptions): Effect.Effect<CompiledContent, ContentCompileFailed | InvalidContentConfig>",
        "description": "Reads and validates content in memory. Writes nothing.",
        "returnType": "Effect.Effect<CompiledContent, ContentCompileFailed | InvalidContentConfig>"
      },
      {
        "name": "defineContentSchema",
        "signature": "defineContentSchema<K extends string, S extends z.ZodType>(kind: K, schema: S, place: ContentSchemaPlace, options?: ContentSchemaOptions): ContentSchemaDef<K, S>",
        "description": "Registers a schema and the file or folder containing that kind.",
        "returnType": "ContentSchemaDef<K, S>"
      }
    ]
  }
]

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function searchCheatsheet(query: string): CheatsheetEntry[] {
  const q = query.trim()
  if (!q) return []
  const safeRegex = new RegExp(escapeRegex(q), 'i')
  const results: CheatsheetEntry[] = []
  for (const mod of CHEATSHEET_MODULES) {
    for (const entry of mod.entries) {
      if (
        safeRegex.test(entry.name) ||
        safeRegex.test(entry.signature) ||
        safeRegex.test(entry.description)
      ) {
        results.push(entry)
      }
    }
  }
  return results
}
