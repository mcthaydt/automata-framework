import type { TemplateFile } from './template-file.ts'

// The story a new 2D game plays where the story's packages are (story-gate.ts): a keeper who talks when the player walks
// up to him, a cutscene his answer starts, and a guard who walks and notices the player. These are the code files, ported
// from `examples/2d-story`; the words, the scene and the guard are the files in `template-story-content/`
// (template-story-content.ts), which Writer, Sequence and Schematic edit. These are the files that are the same for
// every story game; the ones that change with the options (the package, the config, the game's wiring) are in
// template-story-game.ts. A file with the plain game's path replaces it.

/** The code files the story adds or replaces. */
export const STORY_FILES: readonly TemplateFile[] = [
  {
    path: 'src/features/story/story-content.ts',
    content: () => `import { content } from 'virtual:automata/content'
import { cutsceneSchema } from '@automata/cutscenes/sim'
import { wordsOf as wordsOfLines } from '@automata/narrative'
import { dialogueFileSchema, type LineRecord, type LinesFile, linesFileSchema } from '@automata/narrative/sim'
import { navGraphSchema } from '@automata/nav/sim'
import { systemsDefShape } from '@automata/systems/sim'
import words from '../../../content/words/en.json' with { type: 'json' }

// What the story's files say, read once: the keeper's lines and conversation, the cutscene, where the guard may walk and how
// he behaves. They are the files the editors write (\`content/lines\`, \`dialogue\`, \`cutscenes\`, \`nav\`, \`systems\`), already
// checked when the content compiled; reading them through their schemas again keeps a hand-edited file from reaching the sim
// half-understood.

const filesOf = (kind: Readonly<Record<string, unknown>> | undefined): unknown[] => Object.values(kind ?? {})

/** Every lines file in \`content/lines\`, by its name. */
const LINE_FILES: Readonly<Record<string, LinesFile>> = Object.fromEntries(
  Object.entries(content.lines ?? {}).map(([name, file]) => [name, linesFileSchema.parse(file)]),
)

/** Every line record of every file in \`content/lines\`. */
export const LINES: readonly LineRecord[] = Object.values(LINE_FILES).flatMap((file) => file.lines)

/** Every conversation in \`content/dialogue\`. */
export const GRAPHS = filesOf(content.dialogue).flatMap((file) => dialogueFileSchema.parse(file).graphs)

/** The cutscenes, by id. */
export const SCRIPTS = Object.fromEntries(
  filesOf(content.cutscene).map((file) => {
    const script = cutsceneSchema.parse(file)
    return [script.id, script] as const
  }),
)

/** Where the guard may walk: the one file in \`content/nav\`. */
const nav = filesOf(content['nav-graph'])[0]
if (nav === undefined) throw new Error('There is no walking graph. Add content/nav/guard.toml.')
export const NAV = navGraphSchema.parse(nav)

/** How the guard behaves: the one file in \`content/systems\`. */
const systems = filesOf(content.systems)[0]
if (systems === undefined) throw new Error('There are no systems. Add content/systems/guard.toml.')
export const SYSTEMS = systemsDefShape.parse(systems)

const lineIndex = new Map(LINES.map((line) => [line.id, line]))
/** A line record by id, for the dialogue box and the caption. */
export const lineOf = (id: string): LineRecord | undefined => lineIndex.get(id)

const lineWords = wordsOfLines(LINE_FILES)
const catalog: Readonly<Record<string, string>> = words
/**
 * The words of a key: what a line says (its \`words\`, which Writer edits), else the game's few fixed words
 * (\`content/words/en.json\`: the speakers' names and the Next button).
 */
export const wordsOf = (key: string): string | undefined => lineWords.get(key) ?? catalog[key]
`,
  },
  {
    path: 'src/features/story/story.extensions.ts',
    content: () => `import { cutscenesExtension } from '@automata/cutscenes'
import { levelAnchors } from '@automata/cutscenes/sim'
import { level2dExtension } from '@automata/level-2d'
import { level2dPlaces } from '@automata/level-2d/sim'
import { narrativeExtension } from '@automata/narrative'
import { createNavExtension } from '@automata/nav'
import { puzzleExtension } from '@automata/puzzle'
import { systemsExtension } from '@automata/systems'
import { METRE } from '../../shared/constants.ts'
import { project, startLevel } from '../level/level-content.ts'
import { itemOf } from '../level/level-items.ts'
import { Square } from '../square/square.component.ts'
import { createStoryPlugin } from './story.plugin.ts'
import { GRAPHS, lineOf, NAV, SCRIPTS, SYSTEMS, wordsOf } from './story-content.ts'

// The extensions this story opts into, all given the same places: the level's areas, its solid cells, and the square's own
// position. One metre is one cell of the walls layer, so the guard's one metre a second is one cell a second.

/** Where things stand in the level, answered from the editor's files. */
export const PLACES = level2dPlaces({
  level: startLevel,
  project,
  metre: METRE,
  position: { component: Square, x: 'x', y: 'y' },
})

export const narrative = narrativeExtension({ places: PLACES, words: wordsOf, lines: lineOf })
const ANCHORS = levelAnchors(startLevel, METRE)
export const cutscenes = cutscenesExtension({
  places: PLACES,
  // A scene may start a character where Levels places it (\`at = "actor:keeper"\`).
  anchor: (_ctx, name) => ANCHORS(name),
  words: wordsOf,
  lines: lineOf,
  scripts: SCRIPTS,
})
export const systems = systemsExtension({ places: PLACES })

/** The extensions \`defineGame\` registers. */
export const EXTENSIONS = [
  level2dExtension,
  puzzleExtension({ extensions: ['level-2d', 'nav', 'narrative', 'cutscenes', 'systems'] }),
  createNavExtension({ places: PLACES }),
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
  keeper: itemOf('keeper'),
  guard: itemOf('guard'),
  metre: METRE,
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
    dependsOn: ['level-2d', 'nav', 'puzzle', 'narrative', 'cutscenes', 'systems'],
    resources: [Story],
    systems: storySystems(options),
  })
}
`,
  },
  {
    path: 'src/features/story/story.resource.ts',
    content: () => `import { defineResource } from '@automata/sim'
import { z } from 'zod'

/** What the story remembers between ticks. Part of the sim, so a saved game and a replay carry it. */
export const Story = defineResource(
  'story',
  z.strictObject({
    /** Whether the story's files have been handed to the extensions (the first tick does it). */
    loaded: z.boolean(),
    /** Whether the player stands at the keeper: a conversation starts when they arrive, not every tick they stay. */
    near: z.boolean(),
  }),
  () => ({ loaded: false, near: false }),
)
`,
  },
  {
    path: 'src/features/story/story.system.ts',
    content: () => `import type { CutsceneScript, Cutscenes } from '@automata/cutscenes/sim'
import { type DialogueGraph, type Narrative, NarrativeDialogue, NarrativeEnv } from '@automata/narrative/sim'
import { loadNavGraph, type NavGraph } from '@automata/nav/sim'
import { defineSystem, type SystemDef } from '@automata/sim'
import { hypot } from '@automata/sim/math'
import { type Systems, type SystemsDef, SystemsEnv } from '@automata/systems/sim'
import { Hero } from '../square/hero.component.ts'
import { Square } from '../square/square.component.ts'
import { Story } from './story.resource.ts'

// The story's behaviour, which stays code: the keeper starts talking when the player walks up to him, and the second answer
// sends the player to the gate in a cutscene. What is said, where the guard walks and how he behaves are files, handed in.

/** A point in the level's pixels. */
export interface Spot {
  readonly x: number
  readonly y: number
}

/** What the story's systems work with: the extensions' handles, the story's files, and where the editor placed two characters. */
export interface StoryOptions {
  readonly narrative: Narrative
  readonly cutscenes: Cutscenes
  readonly systems: Systems
  readonly graphs: readonly DialogueGraph[]
  readonly scripts: readonly CutsceneScript[]
  readonly nav: NavGraph
  readonly guardDef: SystemsDef
  /** Where the keeper and the guard stand (their feet). */
  readonly keeper: Spot
  readonly guard: Spot
  /** Level pixels in a metre. */
  readonly metre: number
}

/** How close the player walks (in the level's pixels) before the keeper speaks, and how far away they must go before he can again. */
const TOUCH = 24
const REARM = 40

/** The story's three systems: load the files, freeze the player while busy, and start the conversation and the cutscene. */
export function storySystems(options: StoryOptions): SystemDef[] {
  const { narrative, cutscenes, systems } = options

  /** Hands the story's files to the extensions, once, on the first tick. */
  const load = defineSystem('story.load', 'input', (ctx) => {
    const story = ctx.resource(Story)
    if (story.loaded) return
    story.loaded = true
    const [hero] = ctx.query(Hero)
    if (hero === undefined) throw new Error('The story needs the player in the level.')
    ctx.resource(NarrativeEnv).player = hero.sid
    ctx.resource(SystemsEnv).player = hero.sid
    loadNavGraph(ctx, options.nav)
    narrative.load(ctx, { graphs: options.graphs, storylets: [] })
    cutscenes.load(ctx, options.scripts)
    // The guard starts where the editor placed him, in metres: the places' plan.
    systems.load(ctx, options.guardDef, {
      guard: { x: options.guard.x / options.metre, z: options.guard.y / options.metre },
    })
  })

  /** The player cannot walk while someone is talking to them or a cutscene plays. */
  const freeze = defineSystem('story.freeze', 'prePhysics', (ctx) => {
    const busy = cutscenes.locked(ctx) || ctx.resource(NarrativeDialogue).graph !== null
    for (const hero of ctx.query(Hero)) hero.set(Hero, { frozen: busy })
  })

  /** The keeper speaks when the player arrives; the cutscene starts when the conversation has ended on the second answer. */
  const run = defineSystem('story.run', 'gameplay', (ctx) => {
    const story = ctx.resource(Story)
    if (cutscenes.locked(ctx)) return
    const dialogue = ctx.resource(NarrativeDialogue)
    if (dialogue.graph === null && dialogue.facts.gate === true) {
      // The answer is used up, so asking again needs the answer again.
      dialogue.facts = { ...dialogue.facts, gate: false }
      cutscenes.start(ctx, 'gate')
      return
    }
    const [hero] = ctx.query(Hero)
    if (hero === undefined) return
    const at = hero.get(Square)
    const gap = hypot(at.x - options.keeper.x, at.y - options.keeper.y)
    if (!story.near && gap <= TOUCH && dialogue.graph === null) {
      story.near = true
      narrative.startDialogue(ctx, 'keeper')
    } else if (story.near && gap > REARM) story.near = false
  })

  return [load, freeze, run]
}
`,
  },
  {
    path: 'src/features/square/hero.component.ts',
    content: () => `import { defineComponent } from '@automata/sim'

/**
 * Marks the square the player moves (the guard has a body too, and the player's moves must not carry him along).
 * \`frozen\` is set while the player cannot walk: in a conversation, or in a cutscene.
 */
export const Hero = defineComponent('hero', { frozen: 'bool' })
`,
  },
  {
    path: 'src/features/level/level-content.ts',
    content: () => `import { content } from 'virtual:automata/content'
import { type ContentLevel, levelContentSchema, projectContentSchema } from '@automata/content/level-2d'

// The editor's files as data, with no drawing in them: the characters, tilesets and layers (project.toml) and every level.
// The screen draws them (level-scene.ts) and the story reads where things are placed (features/story).

/** The editor's project: the characters, tilesets and layers the levels are made from. */
export const project = projectContentSchema.parse(content.project)

/** Every level, by id. */
export const levels: Readonly<Record<string, ContentLevel>> = Object.fromEntries(
  Object.entries(content.levels ?? {}).map(([id, level]) => [id, levelContentSchema.parse(level)]),
)

/** The level the game starts in and plays. */
export const START_LEVEL = 'start'
export const startLevel: ContentLevel = (() => {
  const level = levels[START_LEVEL]
  if (level === undefined)
    throw new Error(\`There is no level "\${START_LEVEL}". Open the level in the editor and press Save.\`)
  return level
})()
`,
  },
  {
    path: 'src/features/level/level-items.ts',
    content: () => `import { entitiesOf } from '@automata/content/level-2d'
import { startLevel } from './level-content.ts'

/** Where the editor placed the first character of a kind, in the level's pixels (its pivot, the feet). */
export function itemOf(def: string): { readonly x: number; readonly y: number } {
  const item = entitiesOf(startLevel, 'entities').find((each) => each.def === def)
  if (item === undefined)
    throw new Error(\`The level needs a "\${def}". Place one in the editor and press Save.\`)
  return { x: item.x, y: item.y }
}
`,
  },
  {
    path: 'src/features/level/level-scene.ts',
    content: () => `import { levelScene } from '@automata/framework'
import { levels, project, START_LEVEL } from './level-content.ts'

// What the game shows of the level: core draws the tiles, auto tiles, objects and placed characters the editor made,
// from the same files the sim reads. Press Save in the editor and the game shows the change.

/** The pictures Add tiles put in \`assets/\`, by the path the editor knows them by (\`assets/terrain.png\`). */
const found: Record<string, string> = import.meta.glob('../../../assets/*.{png,webp,jpg,jpeg}', {
  eager: true,
  query: '?url',
  import: 'default',
})
export const images: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(found).map(([path, url]) => [path.replace(/^(\\.\\.\\/)+/, ''), url]),
)

/**
 * The scene. The square is the player start and the guard walks, so the game draws them itself (\`live\`); an area is a
 * zone, not a picture. The keeper stands still, so core draws him where the editor placed him.
 */
export const LEVEL_SCENE = levelScene({
  project,
  levels,
  images,
  start: START_LEVEL,
  live: ['player-start', 'guard', 'area'],
})
`,
  },
  {
    path: 'src/app/story-camera.ts',
    content:
      () => `import { type Camera2d, createCamera2d, type PixiStage, type PixiStageHooks } from '@automata/framework'
import { LEVEL } from '../features/level/level.ts'

// The one camera of the story. The renderer makes its stage (and with it the container a camera moves) after the game is
// defined, so the cutscene stage is given \`cutsceneCamera\`, which forwards to the camera made when the stage exists
// (\`storyCamera\`, the renderer's \`setup\`) and does nothing before that. The level fits the view, so the camera stays framed on
// it; it is here for a cutscene to point.

let camera: Camera2d | undefined

export const cutsceneCamera: Camera2d = {
  target: (x, y) => camera?.target(x, y),
  shake: (amount) => camera?.shake(amount),
  update: (seconds) => camera?.update(seconds),
  get transform() {
    return camera?.transform ?? { x: 0, y: 0, scale: 1 }
  },
}

/**
 * The renderer's \`setup\`: makes the camera on the stage's world and moves it each display frame.
 */
export function storyCamera(stage: PixiStage): PixiStageHooks {
  camera = createCamera2d(stage.world, {
    view: { width: LEVEL.width, height: LEVEL.height },
    bounds: { x: 0, y: 0, width: LEVEL.width, height: LEVEL.height },
  })
  camera.target(LEVEL.width / 2, LEVEL.height / 2)
  return { draw: (frame) => camera?.update(frame.frameMs / 1000) }
}
`,
  },
  {
    path: 'src/app/story-sim.ts',
    content: () => `import { content } from 'virtual:automata/content'
import { resolveExtensions } from '@automata/framework/extension'
import { createSim, type Sim } from '@automata/sim'
import { project } from '../features/level/level-content.ts'
import { LEVEL } from '../features/level/level.ts'
import { itemOf } from '../features/level/level-items.ts'
import { playerBoxOf } from '../features/level/player-box.ts'
import type { PlayContent } from '../features/level/read-level.ts'
import { Hero } from '../features/square/hero.component.ts'
import { Square } from '../features/square/square.component.ts'
import { squarePlugin } from '../features/square/square.plugin.ts'
import { EXTENSIONS, storyPlugin } from '../features/story/story.extensions.ts'
import { tuningOf } from '../shared/tuning.ts'

// The sim of the story, apart from the screen: the game's own plugins, the extensions' (\`resolveExtensions\` orders and checks
// them as \`defineGame\` does) and the player at the level's start. The game (game.ts) and its tests make theirs from this.

/** What the sim reads as its content: the level, the player's box and the tuning (what its systems find as \`ctx.content\`). */
export const PLAY: PlayContent = { level: LEVEL, player: playerBoxOf(project), tuning: tuningOf(content) }

/** The game's own plugins, before the extensions'. */
export const PLUGINS = [squarePlugin, storyPlugin]

/** The plugins the sim runs: the game's own, then the extensions'. */
export const simPlugins = () => [...PLUGINS, ...resolveExtensions(EXTENSIONS).simPlugins]

/** The player stands on the level's start: the square's position is its feet, as the editor's is. */
export function setup(sim: Sim): void {
  const start = itemOf('player-start')
  sim.spawn([
    [Square, { x: start.x, y: start.y }],
    [Hero, { frozen: false }],
  ])
}

/** A sim of the story at tick 0. */
export async function createStorySim(): Promise<Sim> {
  const sim = await createSim({ seed: 1, plugins: simPlugins(), content: PLAY })
  setup(sim)
  return sim
}
`,
  },
]
