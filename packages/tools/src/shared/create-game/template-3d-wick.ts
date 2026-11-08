import type { TemplateFile } from './template-file.ts'

// The 3D game's Wick feature (template-3d-game.ts has the rest): what he holds, what the player sends him, how he
// walks, and the controls and look that go with him.

/** The Wick feature: what he holds, what the player sends him, how he walks and how he looks. */
export const WICK_FILES: readonly TemplateFile[] = [
  {
    path: 'src/features/wick/wick.component.ts',
    content: () => `import { defineComponent } from '@automata/sim'

/**
 * Wick: where his feet are on the floor (metres, y up), the way he faces (radians, 0 toward +z and growing toward +x),
 * whether he is walking, and whether he was pressed into a wall last tick. The screen reads these to place and pose his
 * figure.
 */
export const Wick = defineComponent('wick', {
  x: 'f32',
  y: 'f32',
  z: 'f32',
  yaw: 'f32',
  walking: 'bool',
  blocked: 'bool',
})
`,
  },
  {
    path: 'src/features/wick/bumped.event.ts',
    content: () => `import { defineEvent } from '@automata/sim'
import { z } from 'zod'

/**
 * Wick met a wall or a prop he was pushed into. Feel and Audio answer events like this one: open \`content/feel/feel.toml\`
 * or \`content/audio/audio.toml\` in the editors and change what the player feels and hears.
 */
export const Bumped = defineEvent('wick.bumped', z.object({}))
`,
  },
  {
    path: 'src/features/wick/move.command.ts',
    content: () => `import { STICK_MAX } from '@automata/3d/sim'
import { defineCommand } from '@automata/sim'
import { z } from 'zod'

const axis = z.int().min(-STICK_MAX).max(STICK_MAX)

/** Where the stick is: -127 to 127 on each axis, y positive down. Sent every tick; no command is a centred stick. */
export const Move = defineCommand('move', z.object({ x: axis, y: axis }))
`,
  },
  {
    path: 'src/features/wick/walk.system.ts',
    content: () => `import { CameraHeading, moveDirection, Q16 } from '@automata/3d/sim'
import { defineSystem } from '@automata/sim'
import { atan2 } from '@automata/sim/math'
import { playIn, standsAt } from '../room/read-room.ts'
import { TICK_HZ, WICK_HALF } from '../../shared/constants.ts'
import { Bumped } from './bumped.event.ts'
import { Move } from './move.command.ts'
import { Wick } from './wick.component.ts'

/**
 * Walks Wick the way the stick points, seen from the camera, at the walking speed scaled by how far the stick is
 * pushed. He faces the way he goes. Walls and props stop him, and he says so once when he first is. Only the sim
 * changes the game, so a replay ends where play did.
 */
export const walk = defineSystem('walk', (ctx) => {
  const { room, tuning } = playIn(ctx.content)
  const moves = ctx.commands.of(Move)
  const stick = moves[moves.length - 1]?.payload ?? { x: 0, y: 0 }
  const step = tuning.WALK_SPEED / TICK_HZ
  for (const wick of ctx.query(Wick, CameraHeading)) {
    const mapped = moveDirection(wick.get(CameraHeading), stick)
    wick.set(CameraHeading, mapped.state)
    const here = wick.get(Wick)
    const dx = (mapped.direction.x / Q16) * step
    const dz = (mapped.direction.z / Q16) * step
    // One axis at a time, so Wick pushed into a wall at an angle slides along it instead of stopping.
    const x = standsAt(room, here.x + dx, here.z, WICK_HALF) ? here.x + dx : here.x
    const z = standsAt(room, x, here.z + dz, WICK_HALF) ? here.z + dz : here.z
    const pushing = dx !== 0 || dz !== 0
    const walking = x !== here.x || z !== here.z
    // Pressed into something: a move was asked for and none of it happened. Said once, not every tick it is held.
    const blocked = pushing && !walking
    if (blocked && !here.blocked) ctx.emit(Bumped, {})
    wick.set(Wick, { x, z, yaw: pushing ? atan2(dx, dz) : here.yaw, walking, blocked })
  }
})
`,
  },
  {
    path: 'src/features/wick/wick.plugin.ts',
    content: () => `import { CameraHeading, enterView, START } from '@automata/3d/sim'
import { definePlugin, type PluginDef, type Sim } from '@automata/sim'
import { FOLLOW } from '../../shared/constants.ts'
import type { Room } from '../room/read-room.ts'
import { Bumped } from './bumped.event.ts'
import { Move } from './move.command.ts'
import { walk } from './walk.system.ts'
import { Wick } from './wick.component.ts'

/** Wick's part of the sim: what he holds, what he hears and what runs each tick. It needs the camera's heading. */
export const wickPlugin: PluginDef = definePlugin({
  name: 'wick',
  dependsOn: ['camera-heading'],
  defs: [Wick, Move, Bumped, walk],
})

/** Puts Wick on the room's start point, facing away from the camera, with the camera on him. */
export function spawnWick(sim: Sim, room: Room): void {
  sim.spawn([
    [Wick, { x: room.start.x, y: 0, z: room.start.z, yaw: 0, walking: false, blocked: false }],
    [CameraHeading, enterView(START, FOLLOW, { x: 0, y: 0 })],
  ])
}
`,
  },
  {
    path: 'src/app/controls.ts',
    content: () => `import { STICK_MAX } from '@automata/3d/sim'
import type { AnalogReading, InputMap } from '@automata/framework'
import { MAX_TURN_UNITS_PER_STEP, turnUnitsFromPixels } from '@automata/framework'
import { TICK_HZ } from '../shared/constants.ts'

// The analog half of the controls: what the touch stick and the camera drag add to the keys' move and camera-turn.
// Presentation only: the sim sees whole numbers, never an input device.

/** The right stick turns the camera at 180 degrees a second: 65,536 units a turn, so about 546 units a tick. */
const STICK_TURN_UNITS = Math.round((65_536 * 180) / 360 / TICK_HZ)

/** \`map\` with its touch buttons named in the game's words (\`names\`, by KeyboardEvent.code of the button's first key). */
export function labelled(map: InputMap, names: Readonly<Record<string, string>>): InputMap {
  return {
    ...map,
    touchButtons: map.touchButtons.map((button) => ({ ...button, label: names[button.keys[0] as string] ?? button.label })),
  }
}

/** The left stick as a move; centred, it adds nothing, so the keys (the held payload) still move Wick. */
export function moveFromStick(reading: AnalogReading): { x?: number; y?: number } {
  const { x, y } = reading.stick('left')
  return x !== 0 || y !== 0 ? { x, y } : {}
}

/**
 * The camera turn of a tick: the keys' units, plus the right stick's, plus a drag's (the player's camera speed and
 * invert settings), held to what one step may turn.
 */
export function cameraTurnUnits(reading: AnalogReading, held: { readonly units: number }): { units: number } {
  const stick = Math.round((reading.stick('right').x / STICK_MAX) * STICK_TURN_UNITS)
  const drag = turnUnitsFromPixels(reading.cameraDrag(), reading.camera.degPerPixel, reading.camera.invert)
  const units = held.units + stick + drag
  return { units: Math.max(-MAX_TURN_UNITS_PER_STEP, Math.min(MAX_TURN_UNITS_PER_STEP, units)) }
}
`,
  },
  {
    path: 'src/features/wick/wick.view.ts',
    content: () => `import { figure, type View3dFactory } from '@automata/3d'
import {
  clipsWithActions,
  type FigureDef,
  type FigureLibrary,
  type MotionLibrary,
} from '@automata/3d/figures'
import type { Tuning } from '../../shared/tuning.ts'
import { Wick } from './wick.component.ts'

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
 * How Wick looks: his figure from content/figures/wick.toml, drawn one mesh a part and posed from his gait. He walks
 * while the sim says so, at the walking speed, and stands otherwise. The compiler checked every record with the
 * figure kinds' schemas, so each is that schema's output; the cast says so once.
 */
export function wickView(content: unknown, tuning: Tuning): View3dFactory {
  const kinds = content as FigureKinds
  const wick = kinds.figure?.wick
  if (wick === undefined) throw new Error('There is no figure "wick". Check content/figures/wick.toml.')
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
  return figure(wick, {
    library,
    motion,
    state: (components) => {
      const walking = components[Wick.id]?.walking === true
      return { moving: walking, speed: walking ? tuning.WALK_SPEED : 0 }
    },
  })
}
`,
  },
]
