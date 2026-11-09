import { content } from 'virtual:automata/content'
import { createPixi3dRenderer, DEFAULT_LOOK, render3dExtension, targetSize } from '@automata/3d'
import { CameraTurn, STICK_MAX } from '@automata/3d/sim'
import { debugExtension, installDebug, shippedPanels } from '@automata/debug'
import { defaultContent, defineGame, inputs, keys } from '@automata/framework'
import { navExtension } from '@automata/nav'
import { puzzleExtension } from '@automata/puzzle'
import { sectorsExtension } from '@automata/sectors'
import { systemsExtension } from '@automata/systems'
import { Actor } from '../features/guard/actor.component.ts'
import { actorView } from '../features/guard/guard-view.ts'
import { drawRoom, worldLibraryOf } from '../features/room/room-view.ts'
import { Move } from '../features/wick/move.command.ts'
import { Wick } from '../features/wick/wick.component.ts'
import { spawnWick, wickPlugin } from '../features/wick/wick.plugin.ts'
import { wickView } from '../features/wick/wick-view.ts'
import { FOLLOW, TICK_HZ } from '../shared/constants.ts'
import { cameraTurnUnits, labelled, moveFromStick } from './controls.ts'
import { createProbe } from './probe.ts'
import { scenePlugin } from './scene.plugin.ts'
import { storyOf } from './story-content.ts'

const PLAY = storyOf(content)
const TUNING = PLAY.tuning
const ROOM = PLAY.room

// The guard's behaviour, its places and the puzzle are the game's content (content/systems, content/nav,
// content/puzzles): Schematic edits them, and this game only loads them. It has no hooks of its own.
const systems = systemsExtension()

/** The keyboard turns the camera 120 degrees a second: 65,536 units a turn, about 364 units a tick. */
const KEY_TURN = Math.round((65_536 * 120) / 360 / TICK_HZ)

// WASD and the arrows move; the left touch stick and the pad's stick do too. Q and E, the right stick, two buttons and a
// drag on the screen turn the camera. Each is its own command, sent every tick.
const MOVE = keys(
  Move,
  {
    KeyW: { y: -STICK_MAX },
    ArrowUp: { y: -STICK_MAX },
    KeyS: { y: STICK_MAX },
    ArrowDown: { y: STICK_MAX },
    KeyA: { x: -STICK_MAX },
    ArrowLeft: { x: -STICK_MAX },
    KeyD: { x: STICK_MAX },
    ArrowRight: { x: STICK_MAX },
  },
  { idle: { x: 0, y: 0 }, touch: false, analog: { touchStick: true, read: moveFromStick } },
)
// The turn keys are the screen's two buttons as well, so a phone can turn the camera without a drag.
const TURN = labelled(
  keys(
    CameraTurn,
    { KeyQ: { units: -KEY_TURN }, KeyE: { units: KEY_TURN } },
    { idle: { units: 0 }, analog: { drag: true, read: cameraTurnUnits } },
  ),
  { KeyQ: 'Turn left', KeyE: 'Turn right' },
)

/** 3D Story: Wick walking around a hall with a guard on patrol, on the default title, play and pause screens. */
export const game = defineGame({
  id: 'story-3d',
  title: '3D Story',
  // The pixel-art look's field: its short side is the look's, the long side a phone held sideways.
  size: targetSize({ width: 844, height: 390 }, DEFAULT_LOOK.pixel.short),
  orientation: 'landscape',
  sim: { plugins: [wickPlugin, scenePlugin(systems)], seed: 1, setup: (sim) => spawnWick(sim, ROOM) },
  // The camera's heading is a sim plugin of the 3D extension; defineGame adds it.
  extensions: [
    render3dExtension,
    sectorsExtension,
    navExtension,
    puzzleExtension({ extensions: ['systems'] }),
    systems.extension,
    ...(__AUTOMATA_DEBUG__ ? [debugExtension] : []),
  ],
  input: inputs(MOVE, TURN),
  // The default screens' flow, and the room and tuning as the sim's content (what its systems read as ctx.content).
  content: { ...defaultContent(), sim: PLAY },
  createRenderer: (options) => {
    const make = createPixi3dRenderer({
      ...options,
      look: DEFAULT_LOOK,
      views: { [Wick.id]: wickView(content, TUNING), [Actor.id]: actorView(content, TUNING.WALK_SPEED) },
      camera: { views: [FOLLOW], initial: FOLLOW.id, follow: Wick.id },
      scene: (view, _stage, occluders) => {
        view.environment = { skyColor: 0xcdd2da, groundColor: 0x3b303c }
        drawRoom(view.root, occluders, worldLibraryOf(content), DEFAULT_LOOK)
        return undefined
      },
    })
    if (!__AUTOMATA_DEBUG__) return make
    return async (target) => {
      const made = await make(target)
      if (!made.ok) return made
      // A development build also tells the debug overlay what the sim does (Watch beside Schematic reads it) and gives a
      // journey a way to ask where the characters are. It reads each step the screen draws and never writes the sim.
      const agents = PLAY.systems.agents
      const probe = createProbe(
        agents.map((agent) => agent.id),
        Object.fromEntries(agents.map((agent) => [agent.id, agent.initial])),
        Actor.id,
        Wick.id,
      )
      const drawn = made.value
      const uninstall = installDebug({
        panels: shippedPanels,
        bus: target.bus,
        tickHz: TICK_HZ,
        driver: {
          tick: probe.tick,
          agents: probe.agents,
          player: probe.player,
          changes: probe.changes,
          trail: probe.trail,
        },
      })
      return {
        ok: true,
        value: {
          apply: (result) => {
            probe.apply(result)
            drawn.apply(result)
          },
          draw: (frame) => drawn.draw(frame),
          reset: () => drawn.reset(),
          dispose: () => {
            uninstall()
            drawn.dispose()
          },
        },
      }
    }
  },
})
