import type { TemplateFile } from './template-file.ts'
import { STORY_FILES } from './template-story.ts'

// The story a new 3D game plays: a keeper who talks when Wick walks up to him, a cutscene his second answer starts, and a
// guard who walks the back of the room. These are the code files, in the shape of the 2D game's (template-story.ts) over
// the room's floor plan instead of a level's cells; the words, the scene and the guard are the files in
// `template-3d-content/` (template-3d-content.ts), which Writer, Sequence and Schematic edit. The 3D game is made only
// where `@automata/3d` is (three-d-gate.ts), which holds the story's packages too, so the story has no gate of its own.

/** A file of the 2D story that is the same text in 3D (it reads only the content, not the level). */
function sameAs2d(path: string): TemplateFile {
  const file = STORY_FILES.find((each) => each.path === path)
  if (file === undefined) throw new Error(`The 2D story has no ${path}.`)
  return file
}

/** The code files the story adds to the plain 3D game. */
export const STORY_3D_FILES: readonly TemplateFile[] = [
  // What the story's files say, read once: identical to the 2D game's, which reads only the content.
  sameAs2d('src/features/story/story-content.ts'),
  sameAs2d('src/features/story/story.resource.ts'),
  {
    path: 'src/features/story/story.extensions.ts',
    content: () => `import { cutscenesExtension } from '@automata/cutscenes'
import { narrativeExtension } from '@automata/narrative'
import { navExtension } from '@automata/nav'
import { puzzleExtension } from '@automata/puzzle'
import { sectorsExtension } from '@automata/sectors'
import { sectorAnchors } from '@automata/sectors/sim'
import { systemsExtension } from '@automata/systems'
import { guardAt, keeperAt, ROOM_LEVEL, ROOM_MAP } from '../room/room.ts'
import { createStoryPlugin } from './story.plugin.ts'
import { GRAPHS, lineOf, NAV, SCRIPTS, SYSTEMS, wordsOf } from './story-content.ts'

// The extensions this story opts into. They all answer "where is everyone" from the room's floor plan, which the sectors
// extension holds, and the cutscene finds a person the room places by name (\`at = "actor:keeper"\`).

export const narrative = narrativeExtension({ words: wordsOf, lines: lineOf })
const ANCHORS = sectorAnchors(ROOM_LEVEL)
export const cutscenes = cutscenesExtension({
  anchor: (_ctx, name) => ANCHORS(name),
  words: wordsOf,
  lines: lineOf,
  scripts: SCRIPTS,
})
export const systems = systemsExtension()

/** The extensions \`defineGame\` registers, beside the 3D renderer's. */
export const EXTENSIONS = [
  sectorsExtension,
  navExtension,
  puzzleExtension({ extensions: ['nav', 'narrative', 'cutscenes', 'systems'] }),
  narrative.extension,
  cutscenes.extension,
  systems.extension,
]

/** The story's own sim plugin, given the extensions' handles and the story's files. */
export const storyPlugin = createStoryPlugin({
  narrative,
  cutscenes,
  systems,
  graphs: GRAPHS,
  scripts: Object.values(SCRIPTS),
  nav: NAV,
  guardDef: SYSTEMS,
  map: ROOM_MAP,
  keeper: keeperAt(),
  guard: guardAt(),
})
`,
  },
  {
    path: 'src/features/story/story.plugin.ts',
    content: () => `import { definePlugin, type PluginDef } from '@automata/sim'
import { Story } from './story.resource.ts'
import { type StoryOptions, storySystems } from './story.system.ts'

/** The story's part of the sim: what it remembers, and the systems that load it, start the conversation and the cutscene. */
export function createStoryPlugin(options: StoryOptions): PluginDef {
  return definePlugin({
    name: 'story-lines',
    dependsOn: ['sectors', 'nav', 'puzzle', 'narrative', 'cutscenes', 'systems'],
    resources: [Story],
    systems: storySystems(options),
  })
}
`,
  },
  {
    path: 'src/features/story/story.system.ts',
    content: () => `import type { CutsceneScript, Cutscenes } from '@automata/cutscenes/sim'
import { type DialogueGraph, type Narrative, NarrativeDialogue, NarrativeEnv } from '@automata/narrative/sim'
import { loadNavGraph, type NavGraph } from '@automata/nav/sim'
import { InSector, loadSectorMap, type SectorMap } from '@automata/sectors/sim'
import { defineSystem, type SystemDef } from '@automata/sim'
import { hypot } from '@automata/sim/math'
import { type Systems, type SystemsDef, SystemsEnv } from '@automata/systems/sim'
import { Hold } from '../wick/hold.resource.ts'
import { Wick } from '../wick/wick.component.ts'
import { Story } from './story.resource.ts'

// The story's behaviour, which stays code: the keeper starts talking when Wick walks up to him, and the second answer sends
// the camera round the room in a cutscene. What is said, the scene, where the guard walks and how he behaves are files, handed in.

/** A point on the room's floor, in metres. */
export interface Spot {
  readonly x: number
  readonly z: number
}

/** What the story's systems work with: the extensions' handles, the story's files, the room's floor plan, and where the room puts two people. */
export interface StoryOptions {
  readonly narrative: Narrative
  readonly cutscenes: Cutscenes
  readonly systems: Systems
  readonly graphs: readonly DialogueGraph[]
  readonly scripts: readonly CutsceneScript[]
  readonly nav: NavGraph
  readonly guardDef: SystemsDef
  readonly map: SectorMap
  /** Where the room stands the keeper and the guard (their feet). */
  readonly keeper: Spot
  readonly guard: Spot
}

/** How close Wick walks (in metres) before the keeper speaks, and how far away he must go before he can again. */
const TOUCH = 1.2
const REARM = 2

/** The story's four systems: load the files, follow Wick on the floor plan, hold him while busy, and start the talk and the cutscene. */
export function storySystems(options: StoryOptions): SystemDef[] {
  const { narrative, cutscenes, systems } = options

  /** Hands the story's files to the extensions, once, on the first tick. */
  const load = defineSystem('story.load', 'input', (ctx) => {
    const story = ctx.resource(Story)
    if (story.loaded) return
    story.loaded = true
    const [wick] = ctx.query(Wick)
    if (wick === undefined) throw new Error('The story needs Wick in the room.')
    // The extensions find people on the floor plan, so Wick is put on it before the plan is loaded.
    const { x, z } = wick.get(Wick)
    wick.add(InSector, { x, z })
    ctx.resource(NarrativeEnv).player = wick.sid
    ctx.resource(SystemsEnv).player = wick.sid
    loadSectorMap(ctx, options.map)
    loadNavGraph(ctx, options.nav)
    narrative.load(ctx, { graphs: options.graphs, storylets: [] })
    cutscenes.load(ctx, options.scripts)
    // The guard starts where the room puts him.
    systems.load(ctx, options.guardDef, { guard: options.guard })
  })

  /** The characters sense Wick where he is on the floor plan, and notice whether he moves. */
  const follow = defineSystem('story.follow', (ctx) => {
    for (const wick of ctx.query(Wick, InSector)) {
      const { x, z, walking } = wick.get(Wick)
      wick.set(InSector, { x, z })
      ctx.resource(SystemsEnv).moving = walking
    }
  })

  /** Wick cannot walk while someone is talking to him or a cutscene plays. */
  const freeze = defineSystem('story.freeze', 'prePhysics', (ctx) => {
    ctx.resource(Hold).held = cutscenes.locked(ctx) || ctx.resource(NarrativeDialogue).graph !== null
  })

  /** The keeper speaks when Wick arrives; the cutscene starts when the conversation has ended on the second answer. */
  const run = defineSystem('story.run', 'gameplay', (ctx) => {
    const story = ctx.resource(Story)
    if (cutscenes.locked(ctx)) return
    const dialogue = ctx.resource(NarrativeDialogue)
    if (dialogue.graph === null && dialogue.facts.look === true) {
      // The answer is used up, so asking again needs the answer again.
      dialogue.facts = { ...dialogue.facts, look: false }
      cutscenes.start(ctx, 'look')
      return
    }
    const [wick] = ctx.query(Wick)
    if (wick === undefined) return
    const at = wick.get(Wick)
    const gap = hypot(at.x - options.keeper.x, at.z - options.keeper.z)
    if (!story.near && gap <= TOUCH && dialogue.graph === null) {
      story.near = true
      narrative.startDialogue(ctx, 'keeper')
    } else if (story.near && gap > REARM) story.near = false
  })

  return [load, follow, freeze, run]
}
`,
  },
  {
    path: 'src/features/keeper/keeper.component.ts',
    content: () => `import { defineComponent } from '@automata/sim'

/**
 * The keeper: where his feet are on the floor (metres, y up), the way he faces (radians, 0 toward +z and growing toward
 * +x) and whether he is walking. He stands where the room puts him; the screen reads these to place and pose his figure.
 */
export const Keeper = defineComponent('keeper', {
  x: 'f32',
  y: 'f32',
  z: 'f32',
  yaw: 'f32',
  walking: 'bool',
})
`,
  },
  {
    path: 'src/features/keeper/keeper.plugin.ts',
    content: () => `import { definePlugin, type PluginDef, type Sim } from '@automata/sim'
import { keeperAt } from '../room/room.ts'
import { Keeper } from './keeper.component.ts'

/** The keeper's part of the sim: what he holds. */
export const keeperPlugin: PluginDef = definePlugin({ name: 'keeper', defs: [Keeper] })

/** Stands the keeper where the room puts him, facing the way the room says. */
export function spawnKeeper(sim: Sim): void {
  const { x, z, yaw } = keeperAt()
  sim.spawn([[Keeper, { x, y: 0, z, yaw, walking: false }]])
}
`,
  },
  {
    path: 'src/features/keeper/keeper.view.ts',
    content: () => `import type { View3dFactory } from '@automata/3d'
import { personView } from '../../shared/person.view.ts'
import type { Tuning } from '../../shared/tuning.ts'
import { Keeper } from './keeper.component.ts'

/** How the keeper looks: his figure from content/figures/keeper.toml, which Characters opens. */
export const keeperView = (content: unknown, tuning: Tuning): View3dFactory =>
  personView(content, 'keeper', Keeper.id, tuning.WALK_SPEED)
`,
  },
  {
    path: 'src/features/guard/actor.component.ts',
    content: () => `import { defineComponent } from '@automata/sim'

/**
 * A character the systems move, as the screen draws it: where its feet are on the floor (metres, y up), the way it faces
 * (radians, 0 toward +z and growing toward +x) and whether it is walking. The sim copies it from the character's place on
 * the floor plan each tick; nothing else writes it.
 */
export const Actor = defineComponent('actor', {
  x: 'f32',
  y: 'f32',
  z: 'f32',
  yaw: 'f32',
  walking: 'bool',
})
`,
  },
  {
    path: 'src/features/guard/actor.system.ts',
    content: () => `import { InSector } from '@automata/sectors/sim'
import { defineSystem, sortedKeys } from '@automata/sim'
import { SystemsState } from '@automata/systems/sim'
import { Actor } from './actor.component.ts'

/**
 * Puts every character the systems made on the screen's component, and keeps it where the systems say. A character is
 * given its \`Actor\` the first time this sees it, so a Save that adds one in Schematic shows up in play.
 */
export const syncActors = defineSystem('actors.sync', 'cleanup', (ctx) => {
  const agents = ctx.resource(SystemsState).agents
  for (const id of sortedKeys(agents)) {
    const record = agents[id]
    const entity = record === undefined ? undefined : ctx.entity(record.sid)
    if (record === undefined || entity === undefined) continue
    const at = entity.get(InSector)
    const values = { x: at.x, y: 0, z: at.z, yaw: record.facing, walking: record.moving }
    if (entity.has(Actor)) entity.set(Actor, values)
    else entity.add(Actor, values)
  }
})
`,
  },
  {
    path: 'src/features/guard/guard.plugin.ts',
    content: () => `import { definePlugin, type PluginDef } from '@automata/sim'
import { Actor } from './actor.component.ts'
import { syncActors } from './actor.system.ts'

/** The guard's part of the sim: the screen's view of every character the systems move. */
export const guardPlugin: PluginDef = definePlugin({
  name: 'guard',
  dependsOn: ['sectors', 'systems'],
  defs: [Actor, syncActors],
})
`,
  },
  {
    path: 'src/features/guard/guard.view.ts',
    content: () => `import type { View3dFactory } from '@automata/3d'
import { personView } from '../../shared/person.view.ts'
import type { Tuning } from '../../shared/tuning.ts'
import { Actor } from './actor.component.ts'

/**
 * How every character the systems move looks: the guard's figure from content/figures/guard.toml, which Characters opens.
 * One that Schematic adds is drawn the same until the game gives it a figure of its own.
 */
export const guardView = (content: unknown, tuning: Tuning): View3dFactory =>
  personView(content, 'guard', Actor.id, tuning.WALK_SPEED)
`,
  },
  {
    path: 'src/shared/person.view.ts',
    content: () => `import { figure, type View3dFactory } from '@automata/3d'
import {
  clipsWithActions,
  type FigureDef,
  type FigureLibrary,
  type MotionLibrary,
} from '@automata/3d/figures'

type Kind<T> = Readonly<Record<string, T>>

/** The figure kinds as the compiled content holds them (content/figures, content/figure-swatches, ...). */
interface FigureKinds {
  readonly figure?: Kind<FigureDef>
  readonly 'figure-swatch'?: FigureLibrary['swatches']
  readonly 'figure-hair'?: FigureLibrary['hair']
  readonly 'figure-headwear'?: FigureLibrary['headwear']
  readonly 'figure-item'?: FigureLibrary['items']
  readonly 'figure-gait'?: MotionLibrary['gaits']
  readonly 'figure-pose'?: MotionLibrary['poses']
  readonly 'figure-clip'?: Parameters<typeof clipsWithActions>[0]
  readonly 'figure-action'?: Parameters<typeof clipsWithActions>[1]
  readonly 'figure-stand'?: MotionLibrary['stands']
  readonly 'figure-rig'?: MotionLibrary['rigs']
}

/**
 * How a person looks: the figure called \`name\` in content/figures, drawn one mesh a part and posed from its gait. It
 * walks, at \`speed\` metres a second, while the sim says its component (\`componentId\`) is walking, and stands otherwise.
 * The compiler checked every record with the figure kinds' schemas, so each is that schema's output; the cast says so once.
 */
export function personView(content: unknown, name: string, componentId: string, speed: number): View3dFactory {
  const kinds = content as FigureKinds
  const def = kinds.figure?.[name]
  if (def === undefined) throw new Error(\`There is no figure "\${name}". Check content/figures/\${name}.toml.\`)
  const library: FigureLibrary = {
    swatches: kinds['figure-swatch'] ?? {},
    hair: kinds['figure-hair'] ?? {},
    headwear: kinds['figure-headwear'] ?? {},
    items: kinds['figure-item'] ?? {},
  }
  const motion: MotionLibrary = {
    gaits: kinds['figure-gait'] ?? {},
    poses: kinds['figure-pose'] ?? {},
    clips: clipsWithActions(kinds['figure-clip'] ?? {}, kinds['figure-action'] ?? {}),
    items: library.items,
    stands: kinds['figure-stand'] ?? {},
    rigs: kinds['figure-rig'] ?? {},
  }
  return figure(def, {
    library,
    motion,
    state: (components) => {
      const walking = components[componentId]?.walking === true
      return { moving: walking, speed: walking ? speed : 0 }
    },
  })
}
`,
  },
  {
    path: 'src/app/story-sim.ts',
    content: () => `import { content } from 'virtual:automata/content'
import { cameraHeadingPlugin } from '@automata/3d/sim'
import { resolveExtensions } from '@automata/framework/extension'
import { createSim, type Sim } from '@automata/sim'
import { guardPlugin } from '../features/guard/guard.plugin.ts'
import { keeperPlugin, spawnKeeper } from '../features/keeper/keeper.plugin.ts'
import type { PlayContent } from '../features/room/read-room.ts'
import { roomIn } from '../features/room/room.ts'
import { EXTENSIONS, storyPlugin } from '../features/story/story.extensions.ts'
import { spawnWick, wickPlugin } from '../features/wick/wick.plugin.ts'
import { TICK_HZ } from '../shared/constants.ts'
import { tuningOf } from '../shared/tuning.ts'

// The sim of the story, apart from the screen: the game's own plugins, the extensions' (\`resolveExtensions\` orders and checks
// them as \`defineGame\` does) and Wick and the keeper in the room. The game (game.ts) and its tests make theirs from this.

/** What the sim reads as its content: the room and the tuning (what its systems find as \`ctx.content\`). */
export const PLAY: PlayContent = { room: roomIn(content), tuning: tuningOf(content) }

/** The game's own plugins, before the extensions'. */
export const PLUGINS = [wickPlugin, keeperPlugin, guardPlugin, storyPlugin]

/** Wick on the room's start point and the keeper where the room puts him. */
export function setup(sim: Sim): void {
  spawnWick(sim, PLAY.room)
  spawnKeeper(sim)
}

/** A sim of the story at tick 0, with the camera's heading that \`defineGame\` would add. */
export async function createStorySim(): Promise<Sim> {
  const sim = await createSim({
    seed: 1,
    tickHz: TICK_HZ,
    plugins: [cameraHeadingPlugin, ...PLUGINS, ...resolveExtensions(EXTENSIONS).simPlugins],
    content: PLAY,
  })
  setup(sim)
  return sim
}
`,
  },
  {
    path: 'tests/unit/story/story-run.test.ts',
    content: (options) => `import { CutsceneState } from '@automata/cutscenes/sim'
import { NarrativeDialogue } from '@automata/narrative/sim'
import type { Sim } from '@automata/sim'
import { SystemsState } from '@automata/systems/sim'
import { describe, expect, it } from 'vitest'
import { createStorySim } from '../../../src/app/story-sim.ts'
import { Move } from '../../../src/features/wick/move.command.ts'
import { Wick } from '../../../src/features/wick/wick.component.ts'

// A scripted play of the story, on the sim alone: walk to the keeper, answer, watch the cutscene. Every order is a
// command, so a replay of them ends in the same state.

const command = (sim: Sim, type: string, payload: unknown) => ({ tick: sim.tick, source: 0, seq: 0, type, payload })

// Forward is the stick pushed up, which walks away from the camera: toward +z, and the keeper.
const FORWARD = { x: 0, y: -127 }

/** Holds the stick for \`ticks\` ticks. */
function hold(sim: Sim, stick: { x: number; y: number }, ticks: number): void {
  for (let i = 0; i < ticks; i++) sim.step([command(sim, Move.id, stick)])
}
const wait = (sim: Sim, ticks: number): void => {
  for (let i = 0; i < ticks; i++) sim.step([])
}
const wick = (sim: Sim) => (sim.query(Wick)[0]?.get(Wick) ?? { x: 0, z: 0 }) as { x: number; z: number }
const dialogue = (sim: Sim) => sim.resource(NarrativeDialogue)

/** Wick walks up to the keeper: the conversation starts by itself. */
const touchTheKeeper = (sim: Sim): void => hold(sim, FORWARD, 90)

describe('${options.title}: a play from the keeper to the cutscene', () => {
  it('starts the keeper’s conversation when Wick walks up to him', async () => {
    const sim = await createStorySim()
    expect(dialogue(sim).graph).toBeNull()
    touchTheKeeper(sim)
    expect(dialogue(sim).graph).toBe('keeper')
    sim.dispose()
  })

  it('starts the cutscene when the second answer is chosen and the conversation ends', async () => {
    const sim = await createStorySim()
    touchTheKeeper(sim)
    sim.step([command(sim, 'narrative.choose', { index: 1 })])
    expect(sim.resource(CutsceneState).id).toBeNull()
    sim.step([command(sim, 'narrative.advance', {})])
    wait(sim, 1)
    expect(sim.resource(CutsceneState).id).toBe('look')
    sim.dispose()
  })

  it('does not start the cutscene when the first answer is chosen', async () => {
    const sim = await createStorySim()
    touchTheKeeper(sim)
    sim.step([command(sim, 'narrative.choose', { index: 0 })])
    sim.step([command(sim, 'narrative.advance', {})])
    wait(sim, 5)
    expect(sim.resource(CutsceneState).id).toBeNull()
    sim.dispose()
  })

  it('holds Wick still while he is talked to and while the cutscene plays, then lets him walk again', async () => {
    const sim = await createStorySim()
    touchTheKeeper(sim)
    const talking = wick(sim)
    hold(sim, FORWARD, 10)
    expect(wick(sim)).toEqual(talking)
    sim.step([command(sim, 'narrative.choose', { index: 1 })])
    sim.step([command(sim, 'narrative.advance', {})])
    wait(sim, 1)
    hold(sim, FORWARD, 10)
    expect(wick(sim)).toEqual(talking)
    wait(sim, 6 * 60)
    expect(sim.resource(CutsceneState).id).toBeNull()
    hold(sim, { x: 0, y: 127 }, 5)
    expect(wick(sim).z).toBeLessThan(talking.z)
    sim.dispose()
  })

  it('has the guard walking his rounds from the first tick', async () => {
    const sim = await createStorySim()
    wait(sim, 1)
    expect((sim.resource(SystemsState).agents.guard as { mode: string } | undefined)?.mode).toBe('patrol')
    sim.dispose()
  })

  it('ends in the same state every time the same play is run', async () => {
    const run = async (): Promise<string> => {
      const sim = await createStorySim()
      touchTheKeeper(sim)
      sim.step([command(sim, 'narrative.choose', { index: 1 })])
      sim.step([command(sim, 'narrative.advance', {})])
      wait(sim, 8 * 60)
      hold(sim, { x: 127, y: 0 }, 60)
      const hash = sim.hash()
      sim.dispose()
      return hash
    }
    expect(await run()).toBe(await run())
  })
})
`,
  },
]
