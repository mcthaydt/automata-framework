import { SQUARE_WHERE } from './create-game-targets.ts'
import { frameworkSpec, type TemplateFile } from './template-file.ts'
import { GAME_FILES } from './template-game.ts'
import { packageFile, readmeFile, viteConfigFile } from './template-project.ts'

// What the story changes in the plain 2D game: the files that depend on the options or on what the plain game has, so each
// is written out here (template-story.ts has the ones that are the same for every game). A file with the plain game's path
// replaces it.

/** The lines of the README the story adds to the plain game's. */
const STORY_WHERE = `
- \`src/features/story/\`: the keeper. Walking up to him starts the talk and the answer "Show me the gate." plays the
  cutscene: that is code. What he says, the scene and the guard are not: they are content.
- \`content/lines/\` and \`content/dialogue/\`: what the keeper says. \`pnpm editor\` opens them in Writer.
- \`content/cutscenes/gate.toml\`: the scene. Sequence opens it.
- \`content/systems/guard.toml\` and \`content/nav/guard.toml\`: how the guard behaves and where he may walk. Schematic opens them.`

/** The text of a plain game's file, to derive the story's from; it must be there. */
function plainText(path: string, options: Parameters<TemplateFile['content']>[0]): string {
  const file = GAME_FILES.find((each) => each.path === path)
  if (file === undefined) throw new Error(`The plain game has no ${path}.`)
  return file.content(options)
}

/** `text` with `from` replaced by `to`; a `from` that is not there is a mistake in this file, not something to skip. */
function swap(text: string, from: string, to: string): string {
  if (!text.includes(from)) throw new Error(`The plain game's file has no "${from}" to change.`)
  return text.replace(from, to)
}

/** The files of the story that the options and the plain game shape. */
export const STORY_GAME_FILES: readonly TemplateFile[] = [
  readmeFile(SQUARE_WHERE + STORY_WHERE),
  packageFile((options) => ({
    // Feel and Audio play what their editors make, the rest is what the story plays on.
    '@automata/audio-synth': frameworkSpec(options),
    '@automata/cutscenes': frameworkSpec(options),
    '@automata/feel': frameworkSpec(options),
    '@automata/level-2d': frameworkSpec(options),
    '@automata/narrative': frameworkSpec(options),
    '@automata/nav': frameworkSpec(options),
    '@automata/puzzle': frameworkSpec(options),
    '@automata/systems': frameworkSpec(options),
  })),
  viteConfigFile({
    imports: `import { audioContent } from '@automata/audio-synth'
import { controlsKind } from '@automata/content/controls'
import { level2dKinds } from '@automata/content/level-2d'
import { cutsceneContent } from '@automata/cutscenes/content'
import { feelContent } from '@automata/feel'
import { dialogueContent, linesContent } from '@automata/narrative/content'
import { navGraphContent } from '@automata/nav'
import { systemsContent } from '@automata/systems'`,
    schemas: `[
      ...level2dKinds(),
      controlsKind(),
      linesContent,
      dialogueContent,
      cutsceneContent,
      navGraphContent,
      systemsContent({ hooks: [] }),
      feelContent,
      audioContent,
    ]`,
    compiles:
      "the level the editor writes, the keeper's words, the cutscene, the guard, and what Feel and Audio write",
  }),
  {
    path: 'src/shared/constants.ts',
    content:
      () => `// The numbers the game is built from. Both the sim and the screen read them, so they live here. The game's size is
// its level's (content/levels/start.af2d.json, made in the 2D editor). How fast the square moves is not here: a designer
// changes it, in content/tuning.toml.

/** The square's side, in the game's pixels. */
export const SQUARE_SIZE = 8

/** Level pixels in a metre, the unit the story's extensions plan in: one cell of the level's walls. */
export const METRE = 16
`,
  },
  {
    path: 'src/features/square/square.plugin.ts',
    content: (options) => `import { definePlugin } from '@automata/sim'
import { Bumped } from './bumped.event.ts'
import { Hero } from './hero.component.ts'
import { Move } from './move.command.ts'
import { move } from './move.system.ts'
import { Square } from './square.component.ts'

/** The square's part of the sim: what it holds, what it hears, what it says and what runs each tick. */
export const squarePlugin = definePlugin({ name: '${options.id}', defs: [Square, Hero, Move, Bumped, move] })
`,
  },
  {
    path: 'src/features/square/move.system.ts',
    content: () => `import { defineSystem } from '@automata/sim'
import { SQUARE_SIZE } from '../../shared/constants.ts'
import { playIn } from '../level/read-level.ts'
import { hitsWall } from '../level/walls.ts'
import { Bumped } from './bumped.event.ts'
import { Hero } from './hero.component.ts'
import { Move } from './move.command.ts'
import { Square } from './square.component.ts'

/**
 * Moves the hero's square by what the player holds, unless a wall is in the way or the hero is frozen (in a conversation,
 * or in a cutscene), and says so once when it first meets a wall. Only the sim changes the game, so a replay ends where
 * play did.
 */
export const move = defineSystem('move', (ctx) => {
  const { level, tuning } = playIn(ctx.content)
  for (const { payload } of ctx.commands.of(Move))
    for (const square of ctx.query(Square, Hero)) {
      if (square.get(Hero).frozen) continue
      const { x, y, blocked } = square.get(Square)
      // One axis at a time, so a square pushed into a wall at an angle slides along it instead of stopping.
      const nextX = x + payload.x * tuning.SPEED
      const movedX = hitsWall(level, nextX, y, SQUARE_SIZE) ? x : nextX
      const nextY = y + payload.y * tuning.SPEED
      const movedY = hitsWall(level, movedX, nextY, SQUARE_SIZE) ? y : nextY
      // Pressed into a wall: a move was asked for and none of it happened. Said once, not every tick it is held.
      const pressed = (payload.x !== 0 || payload.y !== 0) && movedX === x && movedY === y
      if (pressed && !blocked) ctx.emit(Bumped, {})
      square.set(Square, { x: movedX, y: movedY, blocked: pressed })
    }
})
`,
  },
  {
    path: 'src/features/square/square.view.ts',
    content: () => `import { pictureView } from '@automata/framework'
import { SystemsAgent } from '@automata/systems/sim'
import { SQUARE_SIZE } from '../../shared/constants.ts'
import { project } from '../level/level-content.ts'
import { images } from '../level/level-scene.ts'
import { Square } from './square.component.ts'

/**
 * How a body is drawn: the player's square as the player start looks in the editor, the guard as the guard does (change
 * either in Characters, press Save). The player's position is the square's centre and the character stands on its pivot,
 * its feet, so the picture sits half a square lower; the guard's position is already his feet.
 */
const heroView = pictureView(project, 'player-start', images, { offset: { x: 0, y: SQUARE_SIZE / 2 } })
const guardView = pictureView(project, 'guard', images)

export const squareView = {
  [Square.id]: ((row, id) =>
    (row.components[SystemsAgent.id] === undefined ? heroView : guardView)(row, id)) as typeof heroView,
}
`,
  },
  {
    path: 'src/features/level/compiled-content.d.ts',
    content:
      () => `// The content plugin's module (vite.config.ts), typed as far as this game reads it: the compiled levels, by id, the
// editor's project and levels that the screen draws, the default controls and tuning, the story's files by kind (each
// kind's files by id), and what Feel and Audio write. The plugin also writes a full declaration into content/generated/
// on the first \`pnpm dev\` or build; this one lets the game type-check before that.
declare module 'virtual:automata/content' {
  type Files = Readonly<Record<string, unknown>> | undefined
  export const simContent: { readonly levels?: Readonly<Record<string, unknown>> }
  export const content: {
    readonly project?: unknown
    readonly controls?: unknown
    readonly tuning?: Readonly<Record<string, unknown>>
    readonly levels?: Readonly<Record<string, unknown>>
    readonly lines?: Files
    readonly dialogue?: Files
    readonly cutscene?: Files
    readonly 'nav-graph'?: Files
    readonly systems?: Files
    readonly feel?: Readonly<Record<string, unknown>>
    readonly audio?: Readonly<Record<string, unknown>>
  }
}
`,
  },
  {
    path: 'src/app/game.ts',
    content: (options) => `import { content } from 'virtual:automata/content'
import { controlsFileSchema } from '@automata/content/controls'
import { levelAnchors, placeScript } from '@automata/cutscenes/sim'
import { cutsceneStage2d } from '@automata/cutscenes/stage-2d'
import { controlsFrom, defaultContent, defineGame, mergeStageHooks } from '@automata/framework'
import { project, startLevel } from '../features/level/level-content.ts'
import { LEVEL } from '../features/level/level.ts'
import { images, LEVEL_SCENE } from '../features/level/level-scene.ts'
import { Move } from '../features/square/move.command.ts'
import { squareView } from '../features/square/square.view.ts'
import { EXTENSIONS } from '../features/story/story.extensions.ts'
import { SCRIPTS } from '../features/story/story-content.ts'
import { METRE } from '../shared/constants.ts'
import { audio, feelOnStage } from './feel-audio.ts'
import { cutsceneCamera, storyCamera } from './story-camera.ts'
import { PLAY, PLUGINS, setup } from './story-sim.ts'

// The cutscenes' actors are the placed characters named in the editor. A key that names \`actor:keeper\` starts where
// Levels places him, and the rest are points in metres.
const SCRIPTS_PLACED = Object.fromEntries(
  Object.entries(SCRIPTS).map(([id, script]) => {
    const placed = placeScript(script, levelAnchors(startLevel, METRE))
    if (!placed.ok)
      throw new Error(\`The cutscene "\${id}" names \${placed.missing.join(', ')}, which this game cannot place.\`)
    return [id, placed.script] as const
  }),
)
LEVEL_SCENE.add(
  cutsceneStage2d({
    scene: LEVEL_SCENE,
    project,
    level: startLevel,
    images,
    camera: cutsceneCamera,
    metre: METRE,
    scripts: SCRIPTS_PLACED,
    view: { width: LEVEL.width, height: LEVEL.height },
  }),
)

/** The default controls, as content/controls.toml (arrows or WASD, the pad's D-pad, and touch buttons). */
if (content.controls === undefined) throw new Error('There is no controls file. Add content/controls.toml.')
const CONTROLS = controlsFileSchema.parse(content.controls)

/** ${options.title}: a square the player moves around the level, a keeper to talk to, a cutscene and a guard. */
export const game = defineGame({
  id: '${options.id}',
  title: '${options.title}',
  size: { width: LEVEL.width, height: LEVEL.height },
  sim: { plugins: PLUGINS, seed: 1, setup },
  extensions: EXTENSIONS,
  // The default screens' flow, and the level and tuning as the sim's content (what its systems read as \`ctx.content\`).
  content: { ...defaultContent(), sim: PLAY },
  // The keys, pad buttons and touch buttons are content/controls.toml, which the Tuner edits.
  input: controlsFrom(Move, CONTROLS),
  views: squareView,
  // The level's tiles and placed characters, drawn by core from what the editor saved.
  level: LEVEL_SCENE,
  // The camera places the world each frame; Feel's shake, flash, freeze, squash and words play on top of it.
  renderer: { setup: (stage) => mergeStageHooks(storyCamera(stage), feelOnStage(stage)) },
  // The sounds the event map names and the music the rules pick, played on the game's own audio buses.
  audio,
})
`,
  },
  {
    // The plain game's test of the square, with the hero marked as the extensions need it.
    path: 'tests/unit/square/square-move.test.ts',
    content: (options) => {
      let text = plainText('tests/unit/square/square-move.test.ts', options)
      text = swap(
        text,
        'import { Move }',
        "import { Hero } from '../../../src/features/square/hero.component.ts'\nimport { Move }",
      )
      text = swap(
        text,
        'sim.spawn([[Square, from]])',
        'sim.spawn([[Square, from], [Hero, { frozen: false }]])',
      )
      return swap(
        text,
        'sim.spawn([[Square, ON_THE_START]])',
        'sim.spawn([[Square, ON_THE_START], [Hero, { frozen: false }]])',
      )
    },
  },
  {
    path: 'tests/unit/story/story-run.test.ts',
    content: (options) => `import { CutsceneState } from '@automata/cutscenes/sim'
import { NarrativeDialogue } from '@automata/narrative/sim'
import type { Sim } from '@automata/sim'
import { SystemsState } from '@automata/systems/sim'
import { describe, expect, it } from 'vitest'
import { createStorySim } from '../../../src/app/story-sim.ts'
import { Move } from '../../../src/features/square/move.command.ts'
import { Square } from '../../../src/features/square/square.component.ts'

// A scripted play of the story, on the sim alone: walk to the keeper, answer, watch the cutscene. Every order is a
// command, so a replay of them ends in the same state.

const command = (sim: Sim, type: string, payload: unknown) => ({ tick: sim.tick, source: 0, seq: 0, type, payload })

/** Holds \`x\`/\`y\` for \`ticks\` ticks. */
function hold(sim: Sim, x: number, y: number, ticks: number): void {
  for (let i = 0; i < ticks; i++) sim.step([command(sim, Move.id, { x, y })])
}
const wait = (sim: Sim, ticks: number): void => {
  for (let i = 0; i < ticks; i++) sim.step([])
}
const player = (sim: Sim) => (sim.query(Square)[0]?.get(Square) ?? { x: 0, y: 0 }) as { x: number; y: number }
const dialogue = (sim: Sim) => sim.resource(NarrativeDialogue)

/** The player walks up to the keeper: the conversation starts by itself. */
const touchTheKeeper = (sim: Sim): void => hold(sim, 1, 0, 70)

describe('${options.title}: a play from the keeper to the cutscene', () => {
  it('starts the keeper’s conversation when the player walks up to him', async () => {
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
    expect(sim.resource(CutsceneState).id).toBe('gate')
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

  it('holds the player still while the cutscene plays, then lets them walk again', async () => {
    const sim = await createStorySim()
    touchTheKeeper(sim)
    sim.step([command(sim, 'narrative.choose', { index: 1 })])
    sim.step([command(sim, 'narrative.advance', {})])
    wait(sim, 1)
    const before = player(sim)
    hold(sim, 0, -1, 10)
    expect(player(sim)).toEqual(before)
    wait(sim, 6 * 60)
    expect(sim.resource(CutsceneState).id).toBeNull()
    hold(sim, 0, -1, 5)
    expect(player(sim).y).toBeLessThan(before.y)
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
      hold(sim, 1, 0, 60)
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
