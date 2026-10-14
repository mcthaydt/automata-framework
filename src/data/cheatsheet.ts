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
    name: '@mcthaydt/automata-sim',
    title: 'Sim Core',
    description: 'Deterministic math, ECS simulation, snapshot serialization, and RNG.',
    entries: [
      {
        name: 'createSim',
        signature: 'createSim(options: SimOptions): SimInstance',
        description: 'Creates a deterministic ECS simulation instance with ordered plugins and systems.',
        returnType: 'SimInstance',
        parameters: [
          { name: 'options.plugins', type: 'Plugin[]', desc: 'Ordered list of sim plugins' },
          { name: 'options.seed', type: 'number', desc: 'Initial RNG seed for xoshiro128**' },
        ],
        example: `const sim = createSim({ plugins: [motionPlugin], seed: 1337 })`,
      },
      {
        name: 'step',
        signature: 'step(sim: SimInstance, commands: Command[]): StepResult',
        description: 'Advances the simulation by exactly one fixed 60Hz tick, executing systems and producing render deltas.',
        returnType: 'StepResult',
        parameters: [
          { name: 'sim', type: 'SimInstance', desc: 'The simulation instance' },
          { name: 'commands', type: 'Command[]', desc: 'Commands for this tick' },
        ],
      },
      {
        name: 'defineComponent',
        signature: 'defineComponent<T>(name: string, schema: SchemaDef<T>): ComponentDef<T>',
        description: 'Defines a typed ECS component schema with pure primitive fields.',
        returnType: 'ComponentDef<T>',
        example: `const Position = defineComponent('pos', { x: 'f64', y: 'f64' })`,
      },
      {
        name: 'definePlugin',
        signature: 'definePlugin(config: PluginConfig): Plugin',
        description: 'Defines a modular simulation plugin declaring components, systems, and execution order.',
        returnType: 'Plugin',
      },
      {
        name: 'defineResource',
        signature: 'defineResource<T>(name: string, initial: T): ResourceDef<T>',
        description: 'Defines a shared deterministic singleton resource accessible to systems.',
        returnType: 'ResourceDef<T>',
      },
      {
        name: 'snapshot',
        signature: 'snapshot(sim: SimInstance): Uint8Array',
        description: 'Serializes the entire ECS world into a validated, canonical binary snapshot.',
        returnType: 'Uint8Array',
      },
      {
        name: 'hash',
        signature: 'hash(sim: SimInstance): bigint',
        description: 'Calculates the 64-bit XXH64 golden state hash of the current tick.',
        returnType: 'bigint',
      },
    ],
  },
  {
    name: '@mcthaydt/automata-runtime',
    title: 'Runtime & Boot',
    description: 'Application loop, structured Effect lifecycles, Flow transitions, and Time.',
    entries: [
      {
        name: 'runApp',
        signature: 'runApp(config: AppConfig): Promise<AppHandle>',
        description: 'Boots the game loop, validates Ruken handshake, initializes rendering, and runs the main loop.',
        returnType: 'Promise<AppHandle>',
      },
      {
        name: 'createApp',
        signature: 'createApp(config: AppConfig): Effect<AppInstance, BootError, Scope>',
        description: 'Low-level Effect program that boots the runtime within an Effect scope.',
        returnType: 'Effect<AppInstance, BootError, Scope>',
      },
      {
        name: 'defineExtension',
        signature: 'defineExtension(config: ExtensionConfig): Extension',
        description: 'Declares an opt-in runtime extension providing layers, sim plugins, and UI slots.',
        returnType: 'Extension',
      },
      {
        name: 'Time',
        signature: 'Time: Context.Tag<TimeService>',
        description: 'Effect service providing game time, pause state, and lifecycle clock.',
        returnType: 'TimeService',
      },
      {
        name: 'Flow',
        signature: 'Flow: Context.Tag<FlowService>',
        description: 'State machine managing screen transitions declared in flow.toml.',
        returnType: 'FlowService',
      },
      {
        name: 'PresentationBus',
        signature: 'PresentationBus: Context.Tag<PresentationBusService>',
        description: 'Publish-subscribe event bus decoupling sim events from presentation audio/vfx.',
        returnType: 'PresentationBusService',
      },
      {
        name: 'Settings',
        signature: 'Settings: Context.Tag<SettingsService>',
        description: 'Persistent user configuration and options backed by host storage.',
        returnType: 'SettingsService',
      },
    ],
  },
  {
    name: '@mcthaydt/automata-render-pixi',
    title: 'PixiJS 2D Renderer',
    description: 'WebGL2/WebGPU rendering, sub-tick interpolation, and screen-space shaders.',
    entries: [
      {
        name: 'createPixiRenderer',
        signature: 'createPixiRenderer(options?: PixiRendererOptions): RendererService',
        description: 'Initializes PixiJS v8 with WebGL2 default, WebGPU fallback, and no-eval compliance.',
        returnType: 'RendererService',
      },
      {
        name: 'RenderDeltaConsumer',
        signature: 'class RenderDeltaConsumer',
        description: 'Consumes sim render deltas and computes sub-tick alpha interpolation for smooth 120Hz/144Hz displays.',
        returnType: 'RenderDeltaConsumer',
      },
      {
        name: 'FilterHelper',
        signature: 'createFilter(glFragment: string, wgslSource?: string): Filter',
        description: 'Creates a custom screen-space post-processing filter shader compatible with Ruken CSP.',
        returnType: 'Filter',
      },
      {
        name: 'setupLetterbox',
        signature: 'setupLetterbox(container: HTMLElement, targetRatio: number): LetterboxResult',
        description: 'Calculates pixel-perfect integer scale letterbox dimensions for game canvas viewports.',
        returnType: 'LetterboxResult',
      },
    ],
  },
  {
    name: '@mcthaydt/automata-physics',
    title: 'Deterministic Physics',
    description: 'Rapier2D and Rapier3D deterministic-compat physics extension.',
    entries: [
      {
        name: 'physicsPlugin',
        signature: 'physicsPlugin(options?: PhysicsOptions): Plugin',
        description: 'Sim plugin integrating Rapier deterministic physics with snapshot section 6 support.',
        returnType: 'Plugin',
      },
      {
        name: 'RigidBody',
        signature: 'defineRigidBody(bodyType: "fixed" | "dynamic" | "kinematic"): ComponentDef',
        description: 'Defines a physics rigid body component synchronized with Rapier.',
        returnType: 'ComponentDef',
      },
      {
        name: 'Collider',
        signature: 'defineCollider(shape: ColliderShape): ComponentDef',
        description: 'Defines a collision geometry (box, ball, capsule, trimesh).',
        returnType: 'ComponentDef',
      },
      {
        name: 'raycast',
        signature: 'raycast(world: PhysicsWorld, origin: Vec2, direction: Vec2, maxDist: number): RaycastHit | null',
        description: 'Performs a deterministic raycast against active physics colliders.',
        returnType: 'RaycastHit | null',
      },
    ],
  },
  {
    name: '@mcthaydt/automata-ui',
    title: 'Mobile-First UI',
    description: 'Geometry tracking, responsive height tiers, action bars, and dialogs.',
    entries: [
      {
        name: 'createGeometryOwner',
        signature: 'createGeometryOwner(options: GeometryOptions): GeometryOwner',
        description: 'Tracks safe area insets, usable screen height, and visual viewport occlusion.',
        returnType: 'GeometryOwner',
      },
      {
        name: 'ScreenFrame',
        signature: 'component ScreenFrame',
        description: 'Base responsive container providing root safe areas and host reserved edge bounds.',
        returnType: 'SvelteComponent',
      },
      {
        name: 'ActionBar',
        signature: 'component ActionBar',
        description: 'Standard touch-friendly action bar conforming to 44px/48px touch targets.',
        returnType: 'SvelteComponent',
      },
      {
        name: 'CornerControls',
        signature: 'component CornerControls',
        description: 'Fixed corner touch overlay controls for pause, sound, and quick inventory.',
        returnType: 'SvelteComponent',
      },
      {
        name: 'Dialog',
        signature: 'component Dialog',
        description: 'Modal alert and confirmation dialog supporting keyboard and gamepad navigation.',
        returnType: 'SvelteComponent',
      },
      {
        name: 'LoaderOverlay',
        signature: 'component LoaderOverlay',
        description: 'Progress and loading overlay with retry affordance on stalled asset loads.',
        returnType: 'SvelteComponent',
      },
    ],
  },
  {
    name: '@mcthaydt/automata-host',
    title: 'Host & Ruken SDK',
    description: 'Handshake protocol, persistent saves, analytics, and telemetry.',
    entries: [
      {
        name: 'Hosting',
        signature: 'Hosting: Context.Tag<HostingService>',
        description: 'Effect service wrapping the Ruken SDK and standalone iframe fallback session.',
        returnType: 'HostingService',
      },
      {
        name: 'Storage',
        signature: 'Storage: Context.Tag<StorageService>',
        description: 'Host-managed persistent key-value save storage.',
        returnType: 'StorageService',
      },
      {
        name: 'track',
        signature: 'track(eventName: string, payload?: Record<string, unknown>): Effect<void>',
        description: 'Dispatches custom telemetry and analytics events to the host container.',
        returnType: 'Effect<void>',
      },
    ],
  },
  {
    name: '@mcthaydt/automata-content',
    title: 'Content Compiler',
    description: 'Smol-TOML discovery, schema validation, and virtual module compilation.',
    entries: [
      {
        name: 'compileContent',
        signature: 'compileContent(contentDir: string): Promise<CompiledContent>',
        description: 'Discovers and validates all TOML files in the content folder against Zod schemas.',
        returnType: 'Promise<CompiledContent>',
      },
      {
        name: 'defineContentSchema',
        signature: 'defineContentSchema<T>(name: string, schema: z.ZodType<T>): ContentSchema<T>',
        description: 'Registers a typed game content schema with exact line:column error reporting.',
        returnType: 'ContentSchema<T>',
      },
    ],
  },
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
