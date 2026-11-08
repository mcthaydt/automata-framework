export interface MigrationGuide {
  slug: string
  engine: string
  description: string
  introduction: string
  mappings: [string, string][]
  habit: string
  task: string
  caution: string
}
export const MIGRATION_GUIDES: MigrationGuide[] = [
  {
    slug: 'from-unity',
    engine: 'Unity',
    description: 'Map GameObjects, MonoBehaviours, scenes and ScriptableObjects to Automata ownership.',
    introduction:
      'Keep the habit of composing a game from small pieces. In Automata, separate the data that determines gameplay from the objects that draw it.',
    mappings: [
      [
        'GameObject and gameplay components',
        'A simulation entity with data components; its PixiJS view is separate.',
      ],
      ['FixedUpdate gameplay rules', 'Synchronous systems running in fixed simulation ticks.'],
      [
        'Update and visual feedback',
        'Presentation and input outside the simulation; drawing can happen between ticks.',
      ],
      [
        'Scenes, prefabs and ScriptableObjects',
        'Authored content plus explicit spawning and setup code. There is no scene or prefab importer.',
      ],
      [
        'Editor inspector tweaks',
        'Edit typed content or tuning values and verify the result with tests and the playable example.',
      ],
    ],
    habit:
      'Avoid making each view object responsible for its own gameplay state. Send input as commands and let simulation systems own the resulting state.',
    task: 'Start by moving P in Emberwick’s room content. Read room.test.ts, then follow player-move.system.ts and play-room.ts to see how content, rules and drawing connect.',
    caution:
      'Unity APIs, packages, serialized scenes and editor tooling are not drop-in dependencies. Port one mechanic first rather than translating a whole project.',
  },
  {
    slug: 'from-godot',
    engine: 'Godot',
    description:
      'Map nodes, scenes, signals, resources and physics callbacks to simulation and presentation.',
    introduction:
      'A Godot scene tree combines several responsibilities. In Automata, identify which parts describe gameplay state, which parts draw it, and which parts manage input or resources.',
    mappings: [
      [
        'Nodes and scenes',
        'Entities and data for gameplay, with separate PixiJS containers or HTML/Svelte UI for presentation.',
      ],
      ['_physics_process gameplay logic', 'Fixed-tick simulation systems.'],
      ['_process visual updates', 'Presentation outside the simulation, including drawing between ticks.'],
      [
        'Signals',
        'Explicit commands and events at ownership boundaries; do not assume a global signal replacement.',
      ],
      [
        'Resources and exported properties',
        'Typed content and tuning data, validated by the project’s parsers and schemas.',
      ],
    ],
    habit:
      'Keep the scene graph as a presentation structure. Do not turn it into a second owner of gameplay state.',
    task: 'Read the room content and its validation tests, then trace input through play-room.ts into the movement system. Rebuild one small scene interaction as a command and system.',
    caution:
      'There is no .tscn, GDScript or resource converter. Preserve the behavior you need, then implement it using Automata’s current APIs.',
  },
  {
    slug: 'from-unreal',
    engine: 'Unreal',
    description:
      'Map Actors, components, Blueprints and replication expectations to the current 2D framework.',
    introduction:
      'Bring the habit of defining ownership and boundaries, but evaluate the current 2D browser toolchain before planning a port from a full Unreal project.',
    mappings: [
      [
        'Actors and gameplay components',
        'Simulation entities with data components and systems; rendering is a separate view.',
      ],
      [
        'Blueprint gameplay graphs',
        'Reviewable TypeScript systems, commands and tests. Automata has no Blueprint editor.',
      ],
      ['Tick', 'Fixed simulation ticks for rules and a separate frame loop for drawing.'],
      ['Levels and data assets', 'Authored content and explicit project setup.'],
      [
        'Replication and server authority',
        'A roadmap concern: networking and server packages are planned, not a replacement for Unreal replication today.',
      ],
    ],
    habit:
      'Make the server/networking requirement an explicit capability check. A deterministic simulation alone does not supply transport, matchmaking or replication.',
    task: 'Try the browser starter and the fixed-step loop tests. Port one self-contained 2D mechanic with a clear command, state change and test before considering a larger project.',
    caution:
      'Do not choose the current framework as a drop-in replacement for Unreal’s 3D renderer, editor, asset pipeline or networking stack.',
  },
  {
    slug: 'from-gamemaker',
    engine: 'GameMaker',
    description: 'Map objects, instances, events, rooms and alarms to data, systems and content.',
    introduction:
      'The room and event model is a useful starting vocabulary. The main change is to make gameplay state explicit and keep drawing separate from rules.',
    mappings: [
      ['Objects and instances', 'Entities carrying data components, created through explicit setup.'],
      ['Create events', 'Entity initialization and plugin/project setup.'],
      ['Step events', 'Systems that advance gameplay in fixed ticks.'],
      ['Draw and Draw GUI events', 'PixiJS presentation and game UI outside the simulation.'],
      [
        'Rooms and alarms',
        'Authored room content and tick-based state for timed gameplay. Keep wall-clock timers outside the sim.',
      ],
    ],
    habit:
      'Avoid coupling a drawing instance to the only copy of gameplay state. Keep rules in systems and let views observe the result.',
    task: 'Open room.ts and map #, ., P and G to the playable room. Make one content edit, run the room tests, then inspect the movement system as the equivalent of a focused Step rule.',
    caution:
      'Automata does not import .yy projects or execute GML. Rebuild a small room or mechanic first and retain your original project as the behavior reference.',
  },
  {
    slug: 'from-web',
    engine: 'web development',
    description: 'Map application state, components, requestAnimationFrame and async work to game ownership.',
    introduction:
      'TypeScript, Vite and browser tools will be familiar. The new discipline is to give simulation time and gameplay state explicit owners rather than updating them from every UI callback.',
    mappings: [
      [
        'Application state',
        'Gameplay state belongs to the simulation; menus and UI can still own their own UI state.',
      ],
      [
        'UI components and DOM',
        'Svelte/HTML UI or PixiJS presentation. Simulation components are data, not UI components.',
      ],
      ['requestAnimationFrame', 'Drive drawing per frame; advance game rules through the fixed-step loop.'],
      [
        'Click/key callbacks',
        'Translate input into commands instead of mutating gameplay entities from the view.',
      ],
      [
        'fetch, timers and cleanup effects',
        'Resource work outside the simulation, with Effect-managed lifetimes where the runtime owns it.',
      ],
    ],
    habit:
      'Keep Date, Math.random, network requests and DOM access out of simulation steps. Use the framework’s deterministic inputs, time and RNG where gameplay depends on them.',
    task: 'Read loop.ts and loop.test.ts, then trace play-room.ts from input to sim.step and renderer.draw. Make the configurable-start change before adding a new mechanic.',
    caution:
      'A game loop is not a component rerender loop. Browser and device performance still require measurement, even when the source looks like a familiar web application.',
  },
]
