import { CameraHeading, cameraHeadingPlugin, cameraView } from '@mcthaydt/automata-render-pixi3d/sim'
import { type Command, createSim, type Sim } from '@mcthaydt/automata-sim'
import { recordGoldenEvidence } from '@mcthaydt/evidence/golden'
import { describe, expect, it } from 'vitest'
import { Fighter, Hero, HeroAction, Target } from './components.ts'
import {
  ACTION_CLIP,
  ACTION_TICKS,
  AREA_FADE_TICKS,
  CombatState,
  HERO_HALF,
  HERO_MOVES,
  type MoveDef,
  metres,
  WALK_PER_TICK,
} from './constants.ts'
import { FIRST_SLICE } from './content/first-slice.ts'
import { Freeze, Location, Progress } from './resources.ts'
import { base3dSaves } from './screens/saves.ts'
import { base3dPlugin, base3dSim, spawnArea } from './state/index.ts'
import { newGame } from './state/save.ts'
import { type Area, type AreaSource, areaOf, compileArea, compileWorld, viewAt } from './systems/index.ts'
import { angleOf, signedTurn } from './systems/lock-target.ts'

/** The game's own sim spec, on the first slice, as `main.ts` makes it. */
const BASE3D_SIM = base3dSim(compileWorld([FIRST_SLICE]))

// base-3d's sim, commands in, step, state out (DESIGN.md §3.1). The browsers project runs this whole file in
// Chromium, WebKit and Firefox, so every case here, the golden replay included, holds in four engines (B-a).

describe('the plugin', () => {
  it('registers beside the camera-heading plugin it depends on', async () => {
    const sim = await createSim({ seed: 1, plugins: [cameraHeadingPlugin, base3dPlugin] })
    expect(sim.hash()).toMatch(/^[0-9a-f]{16}$/)
    sim.dispose()
  })
})

describe('the area', () => {
  const tiny: AreaSource = {
    id: 'tiny',
    spawn: { x: 0.5, z: -1.25 },
    views: [{ id: 'hall', yawDeg: 90 }],
    rooms: [{ view: 'hall', min: [-2, -2], max: [2, 2] }],
    walls: [{ min: [-2.1, 2], max: [2.1, 2.2] }],
    targets: [{ x: 1, z: 0.25 }],
    ember: { x: -1, z: 1.5 },
  }

  it('compiles metres to Q16.16 integers and fills the views’ defaults', () => {
    const area = compileArea(tiny)
    expect(area.spawn).toEqual({ x: 32_768, z: -81_920 })
    expect(area.rooms).toEqual([
      { view: 'hall', minX: -131_072, minZ: -131_072, maxX: 131_072, maxZ: 131_072 },
    ])
    expect(area.walls).toEqual([
      {
        minX: Math.round(-2.1 * 65_536),
        minZ: 131_072,
        maxX: Math.round(2.1 * 65_536),
        maxZ: Math.round(2.2 * 65_536),
      },
    ])
    expect(area.targets).toEqual([{ x: 65_536, z: 16_384 }])
    expect(area.ember).toEqual({ x: -65_536, z: 98_304 })
    expect(area.views).toEqual([cameraView('hall', { yawDeg: 90 })])
  })

  it('refuses a room naming an unknown view, a box whose min passes its max, a repeated view and an unknown field', () => {
    expect(() => compileArea({ ...tiny, rooms: [{ view: 'kiln', min: [0, 0], max: [1, 1] }] })).toThrow(
      /kiln/,
    )
    expect(() => compileArea({ ...tiny, walls: [{ min: [1, 0], max: [0, 1] }] })).toThrow(/min/)
    expect(() => compileArea({ ...tiny, views: [{ id: 'hall' }, { id: 'hall' }] })).toThrow(/hall/)
    expect(() => compileArea({ ...tiny, views: [{ id: 'hall', tiltDeg: 80 }] })).toThrow()
    expect(() => compileArea({ ...tiny, extra: 1 } as AreaSource)).toThrow()
  })

  it('refuses a spawn whose square overlaps a wall, or that lies outside every room', () => {
    // The wall's south face is at z = 2 and Wick is 0.3 m to a side: 1.75 overlaps it, 1.7 only touches it.
    expect(() => compileArea({ ...tiny, spawn: { x: 0, z: 1.75 } })).toThrow(/spawn/)
    expect(compileArea({ ...tiny, spawn: { x: 0, z: 1.7 } }).spawn.z).toBe(metres(1.7))
    expect(() => compileArea({ ...tiny, spawn: { x: 3, z: 0 } })).toThrow(/spawn/)
  })

  it('refuses an ember outside every room', () => {
    expect(() => compileArea({ ...tiny, ember: { x: 3, z: 0 } })).toThrow(/ember/)
  })

  it('reads only an area as the sim’s content', () => {
    const area = compileArea(tiny)
    expect(areaOf(area)).toBe(area)
    expect(() => areaOf({ ...area, views: undefined })).toThrow(/not an area/)
    expect(() => areaOf({ ...area, targets: 'none' })).toThrow(/not an area/)
    expect(() => areaOf({ ...area, ember: undefined })).toThrow(/not an area/)
    expect(() => areaOf(null)).toThrow(/not an area/)
  })

  it('compiles the first slice: two rooms, two views, a doorway', () => {
    const area = compileArea(FIRST_SLICE)
    expect(area.views.map((view) => view.id)).toEqual(['hall', 'kiln'])
    expect(area.rooms.map((room) => room.view)).toEqual(['hall', 'kiln'])
    expect(area.targets).toHaveLength(1)
  })
})

/**
 * The game's sim spec as `defineGame` makes it: `BASE3D_SIM`'s plugin, then render3dExtension's heading plugin
 * (RT.EXT1). `game-spec.test.ts` checks the defined game's list is exactly this; this file runs in the browsers too,
 * where the game module's Node-side imports do not load.
 */
const GAME_PLUGINS = [base3dPlugin, cameraHeadingPlugin]
const GAME_SIM = { ...BASE3D_SIM, plugins: GAME_PLUGINS }
/** The first slice, the world's only area. */
const FIRST_AREA = BASE3D_SIM.content.areas[0] as Area

/** A sim made the way the game makes it (`GAME_SIM`), on the first slice or a test area. */
async function startSim(area: Area = FIRST_AREA, moves: readonly MoveDef[] = HERO_MOVES): Promise<Sim> {
  const sim = await createSim({ ...GAME_SIM, content: { areas: [area], moves } })
  if (area === FIRST_AREA) BASE3D_SIM.setup(sim)
  else spawnArea(sim, area)
  return sim
}

function hero(sim: Sim) {
  const [entity] = sim.query(Hero, CameraHeading)
  if (entity === undefined) throw new Error('no hero')
  return { ...entity.get(Hero), ...entity.get(CameraHeading) }
}

describe('setup', () => {
  it('places Wick at the spawn, in the spawn room’s view with its heading and no latch, and the target', async () => {
    const sim = await startSim()
    expect(hero(sim)).toMatchObject({
      x: 0,
      z: metres(-2),
      view: 'hall',
      heading: 0,
      rotate: true,
      latched: false,
    })
    expect(hero(sim)).toMatchObject({ facing: 0, moving: false, moveDir: 0, lockTarget: 0 })
    // GAME-3D.1c: the target is a training dummy now, facing back toward the doorway (a half turn).
    expect(sim.query(Target).map((target) => target.get(Target))).toEqual([
      { x: metres(2), z: metres(9), facing: 32_768 },
    ])
    sim.dispose()
  })
})

interface TickInput {
  readonly stick?: { readonly x: number; readonly y: number }
  readonly turn?: number
  readonly lock?: boolean
  /** The player's Lock mode, sent on every `lock` command; the tests default to hold (a held button is a lock). */
  readonly mode?: 'toggle' | 'hold'
  /** A `lock-cycle` this tick: 1 clockwise, −1 anticlockwise. */
  readonly cycle?: 1 | -1
  readonly act?: Partial<Record<'slash' | 'guard' | 'point' | 'pickup' | 'action', boolean>>
}

/**
 * One tick's commands from player slot 0: the stick every tick (as the input layer sends it), a turn, lock, and
 * the action buttons held.
 */
function commandsFor(sim: Sim, input: TickInput): Command[] {
  const at = { tick: sim.tick, source: 0 }
  const commands: Command[] = [
    { ...at, seq: sim.tick * 5, type: 'move', payload: input.stick ?? { x: 0, y: 0 } },
  ]
  if (input.turn !== undefined)
    commands.push({ ...at, seq: sim.tick * 5 + 1, type: 'camera-turn', payload: { units: input.turn } })
  const lock = { down: input.lock ?? false, mode: input.mode ?? 'hold' }
  commands.push({ ...at, seq: sim.tick * 5 + 2, type: 'lock', payload: lock })
  const act = { slash: false, guard: false, point: false, pickup: false, action: false, ...input.act }
  commands.push({ ...at, seq: sim.tick * 5 + 3, type: 'act', payload: act })
  if (input.cycle !== undefined)
    commands.push({ ...at, seq: sim.tick * 5 + 4, type: 'lock-cycle', payload: { dir: input.cycle } })
  return commands
}

/** Steps `ticks` ticks of `input` and returns the events they emitted, as `type@tick`. */
function run(sim: Sim, input: TickInput, ticks = 1): string[] {
  const events: string[] = []
  for (let i = 0; i < ticks; i++) {
    const result = sim.step(commandsFor(sim, input))
    if (result.rejected.length > 0) throw new Error(`rejected: ${JSON.stringify(result.rejected)}`)
    for (const event of result.events) events.push(`${event.type}@${result.tick}`)
  }
  return events
}

const UP = { x: 0, y: -127 }
const RIGHT = { x: 127, y: 0 }

/** One open room, no walls, a view with `yawDeg` and `rotate`. */
const openArea = (
  yawDeg = 0,
  rotate = true,
  targets: AreaSource['targets'] = [],
  ember: AreaSource['ember'] = { x: 40, z: 40 },
): Area =>
  compileArea({
    id: 'test',
    spawn: { x: 0, z: 0 },
    views: [{ id: 'open', yawDeg, rotate }],
    rooms: [{ view: 'open', min: [-50, -50], max: [50, 50] }],
    walls: [],
    targets,
    ember,
  })

describe('moving', () => {
  it('pushes Wick away from the camera at 4 m/s: +z at heading 0, +x at 90°', async () => {
    const sim = await startSim(openArea(0))
    run(sim, { stick: UP })
    expect(hero(sim)).toMatchObject({ x: 0, z: WALK_PER_TICK, moving: true, facing: 0, moveDir: 0 })
    sim.dispose()
    const turned = await startSim(openArea(90))
    run(turned, { stick: UP })
    expect(hero(turned)).toMatchObject({ x: WALK_PER_TICK, z: 0, facing: 16_384 })
    turned.dispose()
  })

  it('never goes faster on a keyboard diagonal than straight ahead', async () => {
    const sim = await startSim(openArea(0))
    run(sim, { stick: { x: 127, y: -127 } })
    const { x, z } = hero(sim)
    expect(Math.abs(x)).toBe(Math.abs(z))
    expect(x * x + z * z).toBeLessThanOrEqual(WALK_PER_TICK * WALK_PER_TICK)
    expect(x * x + z * z).toBeGreaterThan((WALK_PER_TICK - 2) * (WALK_PER_TICK - 2))
    sim.dispose()
  })

  it('faces the way it travels and keeps that facing when the stick is released', async () => {
    const sim = await startSim(openArea(0))
    run(sim, { stick: RIGHT }, 10)
    // The camera's right at heading 0 is −x (render-pixi3d's mapper), a facing of three quarters of a turn.
    expect(hero(sim)).toMatchObject({
      x: -10 * WALK_PER_TICK,
      z: 0,
      facing: 49_152,
      moving: true,
      moveDir: 0,
    })
    run(sim, {})
    expect(hero(sim)).toMatchObject({ x: -10 * WALK_PER_TICK, facing: 49_152, moving: false, moveDir: 0 })
    sim.dispose()
  })
})

describe('walls', () => {
  const walled = (): Area =>
    compileArea({
      id: 'test',
      spawn: { x: 0, z: 0 },
      views: [{ id: 'open', yawDeg: 0 }],
      rooms: [{ view: 'open', min: [-50, -50], max: [50, 50] }],
      walls: [{ min: [-5, 2], max: [5, 2.2] }],
      targets: [],
      ember: { x: 40, z: 40 },
    })

  it('stop Wick flush against their face and never let him through', async () => {
    const sim = await startSim(walled())
    for (let tick = 0; tick < 600; tick++) {
      run(sim, { stick: UP })
      expect(hero(sim).z).toBeLessThanOrEqual(metres(2) - HERO_HALF)
    }
    expect(hero(sim).z).toBe(metres(2) - HERO_HALF)
    sim.dispose()
  })

  it('let him slide along a wall on the free axis', async () => {
    const sim = await startSim(walled())
    run(sim, { stick: UP }, 120)
    const before = hero(sim)
    run(sim, { stick: { x: -127, y: -127 } }, 30) // up and left: +z into the wall, +x along it
    expect(hero(sim).z).toBe(metres(2) - HERO_HALF)
    expect(hero(sim).x).toBeGreaterThan(before.x + 20 * 3_000)
    sim.dispose()
  })
})

describe('rooms and the latch (M3R-D15)', () => {
  /** Walks north from the spawn until Wick is in the kiln, checking the view changes on the tick he crosses. */
  async function throughTheDoorway(): Promise<Sim> {
    const sim = await startSim()
    while (hero(sim).z < metres(4)) {
      expect(hero(sim)).toMatchObject({ view: 'hall', heading: 0 })
      run(sim, { stick: UP })
    }
    return sim
  }

  it('enters the kiln’s view on the tick Wick crosses into it, and takes its heading', async () => {
    const sim = await throughTheDoorway()
    expect(hero(sim)).toMatchObject({ view: 'kiln', heading: 16_384, latched: true, latchHeading: 0, x: 0 })
    sim.dispose()
  })

  it('keeps the held stick on the old heading, so he does not turn mid-stride', async () => {
    const sim = await throughTheDoorway()
    const { z } = hero(sim)
    run(sim, { stick: UP }, 20)
    expect(hero(sim)).toMatchObject({ x: 0, z: z + 20 * WALK_PER_TICK, latched: true, facing: 0 })
    sim.dispose()
  })

  it('lets go when the stick is released: stick up then follows the new heading', async () => {
    const sim = await throughTheDoorway()
    run(sim, { stick: UP }, 10)
    run(sim, {})
    const { x, z } = hero(sim)
    expect(hero(sim).latched).toBe(false)
    run(sim, { stick: UP })
    expect(hero(sim)).toMatchObject({ x: x + WALK_PER_TICK, z, facing: 16_384 })
    sim.dispose()
  })

  it('lets go when the player turns the camera', async () => {
    const sim = await throughTheDoorway()
    run(sim, { stick: UP, turn: 100 })
    expect(hero(sim)).toMatchObject({ latched: false, heading: 16_484 })
    sim.dispose()
  })
})

describe('camera-turn (render-pixi3d’s command, on Wick’s heading)', () => {
  it('turns the heading, and the stick with it, from the same tick', async () => {
    const sim = await startSim(openArea(0))
    run(sim, { stick: UP, turn: 16_384 / 2 })
    expect(hero(sim)).toMatchObject({ heading: 8_192, facing: 8_192 })
    const { x, z } = hero(sim)
    expect(x).toBe(z) // 45°: as far along +x as +z
    sim.dispose()
  })

  it('clamps a tick’s turn to 8,192 units and wraps', async () => {
    const sim = await startSim(openArea(0))
    run(sim, { turn: 10_000 })
    expect(hero(sim).heading).toBe(8_192)
    run(sim, { turn: -10_000 }, 2)
    expect(hero(sim).heading).toBe(65_536 - 8_192)
    sim.dispose()
  })

  it('changes nothing in a view with rotate: false', async () => {
    const sim = await startSim(openArea(0, false))
    run(sim, { turn: 1_000 })
    expect(hero(sim)).toMatchObject({ heading: 0, rotate: false })
    sim.dispose()
  })
})

describe('lock (the first slice’s minimal lock-on, M3 spec §4.7)', () => {
  const targetIds = (sim: Sim): number[] => sim.query(Target).map((target) => target.sid)

  it('locks onto a target within 12 m while held, and lets go on release', async () => {
    // GAME-3D.1b: the press picks inside the camera's cone (DESIGN.md §11.1), so the farther target ahead wins over
    // the nearer one 90° off (before 1b the nearer won); holding still keeps it.
    const sim = await startSim(
      openArea(0, true, [
        { x: 0, z: 5 },
        { x: 3, z: 0 },
      ]),
    )
    const [ahead] = targetIds(sim)
    run(sim, { lock: true })
    expect(hero(sim).lockTarget).toBe(ahead)
    run(sim, { lock: true, stick: RIGHT }, 10) // held: the lock stays while he strafes
    expect(hero(sim).lockTarget).toBe(ahead)
    run(sim, {})
    expect(hero(sim).lockTarget).toBe(0)
    sim.dispose()
  })

  it('locks only on the press: holding lock while walking into range stays unlocked until the next press', async () => {
    const sim = await startSim(openArea(0, true, [{ x: 0, z: 14 }]))
    run(sim, { lock: true }) // pressed with nothing within 12 m
    expect(hero(sim).lockTarget).toBe(0)
    run(sim, { lock: true, stick: UP }, 60) // still held, now 2.0 m nearer: within range
    expect(hero(sim).z).toBeGreaterThan(metres(2.1))
    expect(hero(sim).lockTarget).toBe(0)
    run(sim, {})
    run(sim, { lock: true }) // a new press finds it
    expect(hero(sim).lockTarget).toBe(targetIds(sim)[0])
    sim.dispose()
  })

  it('keeps his facing when the target stands exactly where he does', async () => {
    const sim = await startSim(openArea(90, true, [{ x: 0, z: 0 }]))
    expect(hero(sim).facing).toBe(16_384)
    run(sim, { lock: true })
    expect(hero(sim)).toMatchObject({ lockTarget: targetIds(sim)[0], facing: 16_384 })
    sim.dispose()
  })

  it('breaks a tie by the lower entity id, and finds nothing past 12 m', async () => {
    // GAME-3D.1b: the tie is inside the cone, both 4 m away and 30° either side of the heading.
    const tie = await startSim(
      openArea(0, true, [
        { x: 2, z: 3.4641 },
        { x: -2, z: 3.4641 },
      ]),
    )
    run(tie, { lock: true })
    expect(hero(tie).lockTarget).toBe(targetIds(tie)[0])
    tie.dispose()
    const far = await startSim(openArea(0, true, [{ x: 0, z: 12.01 }]))
    run(far, { lock: true })
    expect(hero(far).lockTarget).toBe(0)
    far.dispose()
  })

  it('faces the target while locked, standing or moving', async () => {
    const sim = await startSim(openArea(0, true, [{ x: 3, z: 0 }]))
    run(sim, { lock: true })
    expect(hero(sim)).toMatchObject({ facing: 16_384, moving: false, moveDir: 0 })
    // GAME-3D.1b: locked, the stick maps through the line to the target, so stick up walks at it (DESIGN.md §11.2).
    run(sim, { lock: true, stick: UP })
    expect(hero(sim)).toMatchObject({ facing: 16_384, moving: true, moveDir: 0 })
    sim.dispose()
  })

  it.each([0, 90, 200, 315])(
    'strafes: stick right is a right strafe (moveDir −16,384) at a heading of %i°',
    async (yaw) => {
      const radians = (yaw * Math.PI) / 180
      const ahead = { x: 5 * Math.sin(radians), z: 5 * Math.cos(radians) }
      const sim = await startSim(openArea(yaw, true, [ahead]))
      run(sim, { lock: true, stick: RIGHT })
      expect(hero(sim).moving).toBe(true)
      expect(Math.abs(hero(sim).moveDir + 16_384)).toBeLessThanOrEqual(1)
      sim.dispose()
    },
  )
})

describe('lock-on (GAME-3D.1b, DESIGN.md §11)', () => {
  const targetIds = (sim: Sim): number[] => sim.query(Target).map((target) => target.sid)
  const DOWN = { x: 0, y: 127 }
  const toggle = { lock: true, mode: 'toggle' } as const
  const released = { mode: 'toggle' } as const
  /** Where the target with `sid` stands, Q16.16. */
  const placeOf = (sim: Sim, sid: number) => {
    const target = sim.query(Target).find((entity) => entity.sid === sid)
    if (target === undefined) throw new Error('no target')
    return target.get(Target)
  }
  /** The signed turn from Wick's heading to the line from him to `sid`. */
  const offHeading = (sim: Sim, sid: number): number => {
    const { x, z, heading } = hero(sim)
    const target = placeOf(sim, sid)
    return signedTurn(angleOf(target.x - x, target.z - z) - heading)
  }

  it('toggles: a press locks, the release keeps it, the next press lets go', async () => {
    const sim = await startSim(openArea(0, true, [{ x: 0, z: 5 }]))
    const [target] = targetIds(sim)
    run(sim, toggle)
    expect(hero(sim).lockTarget).toBe(target)
    run(sim, released, 30)
    expect(hero(sim).lockTarget).toBe(target)
    run(sim, toggle)
    expect(hero(sim).lockTarget).toBe(0)
    run(sim, released)
    run(sim, toggle)
    expect(hero(sim).lockTarget).toBe(target)
    sim.dispose()
  })

  it('recentres the heading on his facing when nothing is in reach, only in a view that turns', async () => {
    const sim = await startSim(openArea(0, true, [{ x: 30, z: 0 }]))
    run(sim, { stick: RIGHT }) // he turns to face his right: −x, 49,152
    run(sim, {})
    expect(hero(sim)).toMatchObject({ facing: 49_152, heading: 0 })
    run(sim, toggle)
    expect(hero(sim)).toMatchObject({ lockTarget: 0, heading: 49_152, latched: false })
    sim.dispose()
    const fixed = await startSim(openArea(0, false))
    run(fixed, { stick: RIGHT })
    run(fixed, toggle)
    expect(hero(fixed)).toMatchObject({ lockTarget: 0, heading: 0 })
    fixed.dispose()
  })

  it('ignores the player’s camera turns while locked, and takes them again once released', async () => {
    const sim = await startSim(openArea(0, true, [{ x: 0, z: 5 }]))
    run(sim, toggle)
    run(sim, { ...released, turn: 2_000 })
    expect(hero(sim)).toMatchObject({ heading: 0, rotate: false })
    run(sim, toggle)
    expect(hero(sim)).toMatchObject({ lockTarget: 0, rotate: true })
    run(sim, { ...released, turn: 2_000 })
    expect(hero(sim).heading).toBe(2_000)
    sim.dispose()
  })

  it.each([0, 45, 90, 135, 180, 225, 270, 315])(
    'G3-f: stick right circles the target to his right, moveDir −16,384 within a unit, at a heading of %i°',
    async (yaw) => {
      // The target 30° to the left of the heading, inside the cone and inside the assist's 45°.
      const radians = ((yaw + 30) * Math.PI) / 180
      const sim = await startSim(
        openArea(yaw, true, [{ x: 6 * Math.sin(radians), z: 6 * Math.cos(radians) }]),
      )
      const [target] = targetIds(sim)
      run(sim, toggle)
      expect(hero(sim).lockTarget).toBe(target)
      const around = () => {
        const { x, z } = hero(sim)
        const place = placeOf(sim, target ?? 0)
        return angleOf(x - place.x, z - place.z)
      }
      for (let i = 0; i < 30; i++) {
        const before = around()
        run(sim, { ...released, stick: RIGHT })
        expect(Math.abs(hero(sim).moveDir + 16_384)).toBeLessThanOrEqual(1)
        // Facing in and stepping to his right carries him round the target in increasing turn units: anticlockwise
        // in this frame, where turning to his right is decreasing units (G3-f's "clockwise" is the PR's veto item).
        expect(signedTurn(around() - before)).toBeGreaterThan(0)
      }
      sim.dispose()
    },
  )

  it('keeps stick up within 45° of away from the camera under the assist (D3-i)', async () => {
    // 68° off the heading and 5.4 m away: the 6 m fallback takes it, and the assist brings the heading to 45°.
    const sim = await startSim(openArea(0, true, [{ x: 5, z: 2 }]))
    run(sim, toggle)
    expect(hero(sim).lockTarget).toBe(targetIds(sim)[0])
    for (let i = 0; i < 30; i++) run(sim, { ...released, stick: UP })
    expect(Math.abs(offHeading(sim, targetIds(sim)[0] ?? 0))).toBeLessThanOrEqual(8_192)
    sim.dispose()
  })

  it('G3-g: the assist turns the heading at most 546 units a tick, toward the target, and stops at 45°', async () => {
    // 90° to his right of the heading and 3 m away: the empty cone's 6 m fallback takes it.
    const sim = await startSim(openArea(0, true, [{ x: -3, z: 0 }]))
    const [target] = targetIds(sim)
    run(sim, toggle)
    expect(hero(sim).lockTarget).toBe(target)
    let turns = 0
    for (let i = 0; i < 40; i++) {
      const before = hero(sim).heading
      run(sim, released)
      const turned = signedTurn(hero(sim).heading - before)
      expect(Math.abs(turned)).toBeLessThanOrEqual(546)
      expect(turned).toBeLessThanOrEqual(0) // toward −x: decreasing turn units
      if (turned !== 0) turns += 1
      expect(hero(sim).latched).toBe(false)
    }
    // From 90° to 45° is 8,192 units: 15 ticks at 546 and the last 2 units.
    expect(turns).toBe(16)
    expect(offHeading(sim, target ?? 0)).toBe(-8_192)
    sim.dispose()
  })

  it('G3-g: a view change while locked latches the stick as any view change does (M3R-D15)', async () => {
    const sim = await startSim()
    const [target] = targetIds(sim)
    while (hero(sim).z < metres(4)) {
      run(sim, { stick: UP, mode: 'toggle', lock: hero(sim).lockTarget === 0 && hero(sim).z > metres(3) })
    }
    expect(hero(sim)).toMatchObject({ view: 'kiln', lockTarget: target, latched: true })
    sim.dispose()
  })

  it('cycles among the candidates in lock-cycle’s direction, and only while locked', async () => {
    const sim = await startSim(
      openArea(0, true, [
        { x: 0, z: 5 },
        { x: 4, z: 0 },
        { x: -4, z: 0 },
      ]),
    )
    const [ahead, left, right] = targetIds(sim)
    run(sim, { ...released, cycle: 1 })
    expect(hero(sim).lockTarget).toBe(0)
    run(sim, toggle)
    expect(hero(sim).lockTarget).toBe(ahead)
    run(sim, { ...released, cycle: 1 })
    expect(hero(sim).lockTarget).toBe(right)
    run(sim, { ...released, cycle: -1 })
    run(sim, { ...released, cycle: -1 })
    expect(hero(sim).lockTarget).toBe(left)
    sim.dispose()
  })

  it('lets go of a target past 15 m', async () => {
    const sim = await startSim(openArea(0, true, [{ x: 0, z: 10 }]))
    const [target] = targetIds(sim)
    run(sim, toggle)
    // The lock reads where the last tick left him: held while that was within 15 m, let go once it was past.
    let distance = metres(10)
    for (;;) {
      const seen = distance
      run(sim, { ...released, stick: DOWN }) // locked, stick down backs away from the target
      distance = metres(10) - hero(sim).z
      if (hero(sim).lockTarget !== target) {
        expect(seen).toBeGreaterThan(metres(15))
        break
      }
      expect(seen).toBeLessThanOrEqual(metres(15))
    }
    sim.dispose()
  })

  it('lets go of a target out of sight for 60 ticks running, and holds it through 59', async () => {
    const area = compileArea({
      id: 'wall',
      spawn: { x: 0, z: 0 },
      views: [{ id: 'open', yawDeg: 0, rotate: true }],
      rooms: [{ view: 'open', min: [-50, -50], max: [50, 50] }],
      walls: [{ min: [-3, 2], max: [-0.5, 3] }],
      targets: [{ x: 0, z: 6 }],
      ember: { x: 40, z: 40 },
    })
    const sim = await startSim(area)
    const [target] = targetIds(sim)
    run(sim, toggle)
    while (hero(sim).lockHidden === 0) run(sim, { ...released, stick: RIGHT }) // round behind the wall
    expect(hero(sim).lockTarget).toBe(target)
    run(sim, released, 58)
    expect(hero(sim)).toMatchObject({ lockTarget: target, lockHidden: 59 })
    run(sim, released)
    expect(hero(sim)).toMatchObject({ lockTarget: 0, lockHidden: 0 })
    sim.dispose()
  })
})

function heroAction(sim: Sim) {
  const [entity] = sim.query(HeroAction)
  if (entity === undefined) throw new Error('no hero action')
  return entity.get(HeroAction)
}

describe('actions (the four clips’ sim side, M3 spec §4.4.5 and §4.7)', () => {
  const action = heroAction

  it('starts with no action and no guard', async () => {
    const sim = await startSim()
    expect(action(sim)).toEqual({ clip: 0, startedAt: 0, guard: false, guardSince: 0 })
    sim.dispose()
  })

  // GAME-3D.1c: the slash is `slash-1`, a move of 22 frames (DESIGN.md §7.2), no longer the clip's 24 ticks.
  const SLASH_1 = HERO_MOVES[0]?.total ?? 0

  it('starts a slash on the press, at that tick, and ends it after its length', async () => {
    const sim = await startSim()
    run(sim, {}, 5)
    const pressed = sim.tick
    run(sim, { act: { slash: true } })
    expect(action(sim)).toMatchObject({ clip: ACTION_CLIP.slash, startedAt: pressed })
    run(sim, { act: { slash: true } }, SLASH_1 - 1) // held: no second slash
    expect(action(sim)).toMatchObject({ clip: ACTION_CLIP.slash, startedAt: pressed })
    run(sim, {})
    expect(action(sim).clip).toBe(0)
    sim.dispose()
  })

  // GAME-3D.1c changed this on purpose: a second press mid-swing no longer replaces the slash at once; it queues
  // slash-2, which starts at slash-1's window (DESIGN.md §7.2 buffering; the combat cases cover the chain).
  it('queues a second slash pressed mid-swing for the window, and ignores point and pickup while one runs', async () => {
    const sim = await startSim()
    const first = sim.tick
    run(sim, { act: { slash: true } })
    run(sim, {}, 3)
    run(sim, { act: { point: true } })
    run(sim, { act: { pickup: true } })
    expect(action(sim)).toMatchObject({ clip: ACTION_CLIP.slash, startedAt: first })
    run(sim, { act: { slash: true } }) // frame 7: queued
    expect(action(sim)).toMatchObject({ clip: ACTION_CLIP.slash, startedAt: first })
    run(sim, {}, 2) // frames 8 and 9
    const second = sim.tick
    run(sim, {})
    expect(action(sim)).toMatchObject({ clip: ACTION_CLIP.slash, startedAt: second })
    sim.dispose()
  })

  it.each(['point', 'pickup'] as const)('plays %s when nothing runs, for its length', async (move) => {
    const sim = await startSim()
    const pressed = sim.tick
    run(sim, { act: { [move]: true } })
    expect(action(sim)).toMatchObject({ clip: ACTION_CLIP[move], startedAt: pressed })
    run(sim, {}, ACTION_TICKS[move] - 1)
    expect(action(sim).clip).toBe(ACTION_CLIP[move])
    run(sim, {})
    expect(action(sim).clip).toBe(0)
    sim.dispose()
  })

  it('holds the guard stance while guard is held, from the press, beside a slash and a lock', async () => {
    const sim = await startSim(openArea(0, true, [{ x: 0, z: 3 }]))
    run(sim, {}, 2)
    const raised = sim.tick
    run(sim, { act: { guard: true }, lock: true })
    run(sim, { act: { guard: true, slash: true }, lock: true, stick: RIGHT }, 4)
    expect(action(sim)).toMatchObject({ guard: true, guardSince: raised, clip: ACTION_CLIP.slash })
    expect(hero(sim)).toMatchObject({ moving: true, lockTarget: sim.query(Target)[0]?.sid })
    run(sim, {})
    expect(action(sim)).toMatchObject({ guard: false })
    sim.dispose()
  })
})

describe('the save, captured and applied outside the sim (DESIGN.md §12.1)', () => {
  it('counts a taken ember in the progress, and captures it with the play time', async () => {
    const sim = await startSim(openArea(0, true, [], { x: 0, z: 0.5 }))
    expect(sim.resource(Progress)).toEqual({ embers: 0 })
    run(sim, {}, 3)
    run(sim, { act: { pickup: true } })
    expect(sim.resource(Progress)).toEqual({ embers: 1 })
    const saves = base3dSaves()
    expect(saves.capture(sim)).toEqual({ ...newGame(), embers: 1, playTicks: sim.tick })
    sim.dispose()
  })

  it('Continue starts a fresh sim at the area entrance with the ember kept and the play time running on', async () => {
    const played = await startSim()
    run(played, { stick: RIGHT }, 40)
    expect(hero(played).x).not.toBe(FIRST_AREA.spawn.x)
    const saved = { ...base3dSaves().capture(played), embers: 1, flags: ['kept'], lantern: 'lit' }
    const saves = base3dSaves()
    const resumed = await startSim()
    saves.apply(resumed, saved)
    expect(resumed.resource(Progress)).toEqual({ embers: 1 })
    const { spawn } = FIRST_AREA
    expect(hero(resumed)).toMatchObject({ x: spawn.x, z: spawn.z })
    // Fields the sim does not hold (and ones a later build added) are kept from the applied slot.
    run(resumed, {}, 10)
    expect(saves.capture(resumed)).toEqual({ ...saved, playTicks: saved.playTicks + resumed.tick })
    // The same slot applied again gives the same sim.
    const again = await startSim()
    base3dSaves().apply(again, saved)
    run(again, {}, 10)
    expect(again.hash()).toBe(resumed.hash())
    for (const sim of [played, resumed, again]) sim.dispose()
  })
})

describe('taking the ember', () => {
  it('emits ember.taken on the tick a pickup starts within a metre of it, at the ember', async () => {
    const sim = await startSim(openArea(0, true, [], { x: 0.9, z: -0.9 }))
    expect(run(sim, {}, 3)).toEqual([])
    const pressed = sim.tick
    const events = run(sim, { act: { pickup: true } })
    expect(events).toEqual([`ember.taken@${pressed + 1}`])
    expect(heroAction(sim)).toMatchObject({ clip: ACTION_CLIP.pickup, startedAt: pressed })
    // Held, and through the rest of the pickup: nothing more.
    expect(run(sim, { act: { pickup: true } }, ACTION_TICKS.pickup)).toEqual([])
    sim.dispose()
  })

  it('emits it at the ember’s place', async () => {
    const sim = await startSim(openArea(0, true, [], { x: 0.5, z: 0.25 }))
    const taken = sim.step(commandsFor(sim, { act: { pickup: true } }))
    expect(taken.events.map((event) => event.payload)).toEqual([{ x: metres(0.5), z: metres(0.25) }])
    sim.dispose()
  })

  it('emits nothing for a pickup out of reach, or a slash or point in reach', async () => {
    const far = await startSim(openArea(0, true, [], { x: 1.1, z: 0 }))
    expect(run(far, { act: { pickup: true } })).toEqual([])
    far.dispose()
    const near = await startSim(openArea(0, true, [], { x: 0, z: 0.5 }))
    expect(run(near, { act: { slash: true } }, ACTION_TICKS.slash + 1)).toEqual([])
    expect(run(near, { act: { point: true } })).toEqual([])
    near.dispose()
  })

  it('places the first slice’s ember in the kiln, off the golden route', () => {
    const area = FIRST_AREA
    expect(viewAt(area, area.ember.x, area.ember.z)?.id).toBe('kiln')
  })
})

describe('the area exit (DESIGN.md §13, area change)', () => {
  // Two first-slice areas: the first's exit, across the hall a metre north of the spawn, leads to the second's
  // kiln. GAME-3D.1i brings the real hub and kiln.
  const first: AreaSource = {
    ...FIRST_SLICE,
    id: 'first',
    exits: [{ min: [-4, -1], max: [4, -0.5], to: 'second', entry: { x: 0, z: 8 } }],
  }
  const second: AreaSource = { ...FIRST_SLICE, id: 'second' }

  async function walkToTheExit(): Promise<{ sim: Sim; events: string[] }> {
    const world = compileWorld([first, second])
    const sim = await createSim({ ...GAME_SIM, content: world })
    BASE3D_SIM.setup(sim)
    const events: string[] = []
    for (let ticks = 0; ticks < 120 && !events.some((e) => e.startsWith('area.exit')); ticks++)
      events.push(...run(sim, { stick: UP }))
    return { sim, events }
  }

  it('on stepping into an exit, says where it leads and keeps Wick in his area while the fade runs', async () => {
    const { sim, events } = await walkToTheExit()
    const exitTick = sim.tick
    expect(events).toContain(`area.exit@${exitTick}`)
    expect(sim.resource(Location).area).toBe(0)
    run(sim, {}, AREA_FADE_TICKS - 1)
    expect(sim.resource(Location).area).toBe(0)
    sim.dispose()
  })

  it('after AREA_FADE_TICKS swaps the area, places Wick at the entry and cuts to its view', async () => {
    const { sim } = await walkToTheExit()
    const exitTick = sim.tick
    const events = run(sim, {}, AREA_FADE_TICKS)
    expect(events).toEqual([`area.entered@${exitTick + AREA_FADE_TICKS}`])
    expect(sim.resource(Location)).toMatchObject({ area: 1, next: -1 })
    const { x, z, view } = hero(sim)
    expect({ x, z }).toEqual({ x: 0, z: metres(8) })
    expect(view).toBe('kiln')
    // In the second area, which has no exit, walking on never leaves it.
    expect(run(sim, { stick: UP }, 30).some((e) => e.startsWith('area.'))).toBe(false)
    sim.dispose()
  })

  it('refuses a world whose exit names no area, whose entry is outside every room, or that repeats an id', () => {
    const exit = first.exits?.[0] as NonNullable<AreaSource['exits']>[number]
    expect(() => compileWorld([first])).toThrow(/second/)
    expect(() => compileWorld([{ ...first, exits: [{ ...exit, entry: { x: 0, z: 20 } }] }, second])).toThrow(
      /entry/,
    )
    expect(() => compileWorld([first, { ...second, id: 'first' }])).toThrow(/first/)
  })
})

describe('combat (GAME-3D.1c, DESIGN.md §7)', () => {
  // Two test moves for an attacker the test starts by hand (enemies are GAME-3D.1d): a jab and a low sweep, both
  // reaching 1.5 m ahead at waist height, active on frames 5 and 6.
  const jabHit = {
    near: 0,
    far: metres(1.5),
    bottom: metres(0.5),
    top: metres(1.5),
    dmg: 2,
    stop: 3,
    stun: 10,
  }
  const jab = { ...jabHit, kb: metres(1), power: 1 }
  const JAB: MoveDef = { id: 'test-jab', total: 20, active: [5, 6], hit: jab }
  const SWEEP: MoveDef = { ...JAB, id: 'test-sweep', hit: { ...jab, low: true } }
  const MOVES = [...HERO_MOVES, JAB, SWEEP]
  const moveIndex = (id: string) => MOVES.findIndex((move) => move.id === id) + 1
  const HALF_TURN = 32_768

  const wickSid = (sim: Sim) => sim.query(Hero)[0]?.sid as number
  const fighter = (sim: Sim, sid: number) => sim.entity(sid)?.get(Fighter)
  const moveOf = (sim: Sim, sid: number) => MOVES[(fighter(sim, sid)?.move ?? 0) - 1]?.id
  /** A training dummy (the area's target) `z` metres ahead of Wick, who stands at the origin facing +z. */
  const withDummy = async (z = 1) => {
    const sim = await startSim(openArea(0, true, [{ x: 0, z }]), MOVES)
    return { sim, dummy: sim.query(Target)[0]?.sid as number }
  }
  /** An attacker of side `side` at `x`, `z` facing `facing`, its move started by `start`. */
  const spawnFighter = (sim: Sim, side: number, z: number, facing: number, x = 0) =>
    sim.spawn([
      [Target, { x: metres(x), z: metres(z), facing }],
      [Fighter, { side, health: 6, radius: metres(0.4), height: metres(1.8) }],
    ])
  /** Starts `move` on `sid` so that the next step plays its frame `frame`. */
  const startMove = (sim: Sim, sid: number, move: string, frame = 1) =>
    sim.entity(sid)?.set(Fighter, {
      move: moveIndex(move),
      moveTick: frame - 1,
      moveStart: sim.tick,
      state: CombatState.act,
    })
  const slash = (sim: Sim) => run(sim, { act: { slash: true } })

  it('gives Wick 4 hearts and each dummy 3, both idle', async () => {
    const { sim, dummy } = await withDummy()
    expect(fighter(sim, wickSid(sim))).toMatchObject({ health: 8, state: CombatState.idle, side: 0 })
    expect(fighter(sim, dummy)).toMatchObject({ health: 6, state: CombatState.idle, side: 1 })
    sim.dispose()
  })

  it.each(['slash-1', 'slash-2', 'thrust'])(
    'opens %s’s hit window on its first active frame, and not after its last (G3-d)',
    async (id) => {
      const move = HERO_MOVES.find((candidate) => candidate.id === id) as MoveDef
      const opens = await withDummy()
      startMove(opens.sim, wickSid(opens.sim), id)
      run(opens.sim, {}, move.active[0] - 1)
      expect(fighter(opens.sim, opens.dummy)?.health).toBe(6)
      run(opens.sim, {})
      expect(fighter(opens.sim, opens.dummy)?.health).toBe(6 - (move.hit?.dmg ?? 0))
      opens.sim.dispose()

      const closed = await withDummy()
      startMove(closed.sim, wickSid(closed.sim), id, move.active[1] + 1)
      run(closed.sim, {}, move.total - move.active[1])
      expect(fighter(closed.sim, closed.dummy)?.health).toBe(6)
      closed.sim.dispose()
    },
  )

  it('lands a move on a dummy once, however many active frames reach it', async () => {
    const { sim, dummy } = await withDummy()
    const events = run(sim, { act: { slash: true } })
    events.push(...run(sim, {}, 40))
    expect(fighter(sim, dummy)?.health).toBe(5)
    expect(events.filter((event) => event.startsWith('hit.landed'))).toHaveLength(1)
    sim.dispose()
  })

  it('chains: a press from frame 4 queues slash-2 at the window’s first frame, one inside the window starts the thrust at once, and the thrust ends the chain', async () => {
    const sim = await startSim(openArea(), MOVES)
    const wick = wickSid(sim)
    slash(sim) // frame 1
    run(sim, {}, 2) // frames 2, 3
    slash(sim) // frame 4: queued
    run(sim, {}, 5) // frames 5 to 9
    expect(fighter(sim, wick)).toMatchObject({ moveTick: 9 })
    expect(moveOf(sim, wick)).toBe('slash-1')
    run(sim, {}) // slash-1's frame 10: slash-2 starts instead
    expect(moveOf(sim, wick)).toBe('slash-2')
    expect(fighter(sim, wick)?.moveTick).toBe(1)
    run(sim, {}, 11) // frames 2 to 12, inside slash-2's window (11 to 19)
    const pressed = sim.tick
    slash(sim)
    expect(moveOf(sim, wick)).toBe('thrust')
    expect(heroAction(sim)).toMatchObject({ clip: ACTION_CLIP.slash, startedAt: pressed })
    run(sim, {})
    slash(sim) // the thrust has no next: dropped
    run(sim, {}, 31)
    expect(moveOf(sim, wick)).toBe('thrust')
    run(sim, {})
    expect(moveOf(sim, wick)).toBeUndefined()
    expect(fighter(sim, wick)?.state).toBe(CombatState.idle)
    expect(heroAction(sim).clip).toBe(0)
    sim.dispose()
  })

  it('drops a press before frame 4, so a lone slash ends after its 22 frames', async () => {
    const sim = await startSim(openArea(), MOVES)
    const wick = wickSid(sim)
    slash(sim)
    run(sim, {})
    slash(sim) // frame 3
    run(sim, {}, 19)
    expect(moveOf(sim, wick)).toBe('slash-1')
    run(sim, {})
    expect(moveOf(sim, wick)).toBeUndefined()
    sim.dispose()
  })

  it('resolves two hits on one tick both, attackers in id order: Wick and a foe trade (G3-k)', async () => {
    const sim = await startSim(openArea(), MOVES)
    const wick = wickSid(sim)
    const foe = spawnFighter(sim, 1, 1, HALF_TURN)
    startMove(sim, wick, 'slash-1', 6)
    startMove(sim, foe, 'test-jab', 5)
    const result = sim.step(commandsFor(sim, {}))
    expect(fighter(sim, wick)?.health).toBe(6)
    expect(fighter(sim, foe)?.health).toBe(5)
    const hits = result.events.filter((event) => event.type === 'hit.landed')
    expect(hits.map((event) => (event.payload as { attacker: number }).attacker)).toEqual([wick, foe])
    sim.dispose()
  })

  it('defeats a dummy once when two hits reach it on one tick (G3-F8)', async () => {
    const { sim, dummy } = await withDummy()
    sim.entity(dummy)?.set(Fighter, { health: 1 })
    const ally = spawnFighter(sim, 0, 0, 0, 0.5)
    startMove(sim, wickSid(sim), 'slash-1', 6)
    startMove(sim, ally, 'slash-1', 6)
    const events = run(sim, {})
    expect(events.filter((event) => event.startsWith('foe.defeated'))).toHaveLength(1)
    expect(events.filter((event) => event.startsWith('hit.landed'))).toHaveLength(1)
    expect(sim.entity(dummy)).toBeUndefined()
    sim.dispose()
  })

  describe('the shield (G3-i)', () => {
    /** A foe 1 m ahead, facing Wick, and the guard raised and held `held` ticks before its jab lands. */
    async function guarded(held: number, move = 'test-jab') {
      const sim = await startSim(openArea(), MOVES)
      const foe = spawnFighter(sim, 1, 1, HALF_TURN)
      run(sim, { act: { guard: true } }, held)
      startMove(sim, foe, move, 5)
      const events = run(sim, { act: { guard: true } })
      return { sim, foe, wick: wickSid(sim), events }
    }

    it('parries a hit on frames 1 to 8 of the guard: the attacker staggers 28 ticks, 14 of hitstop, no damage', async () => {
      for (const held of [0, 7]) {
        const { sim, foe, wick, events } = await guarded(held)
        expect(fighter(sim, wick)?.health).toBe(8)
        expect(fighter(sim, foe)).toMatchObject({ state: CombatState.stagger, stun: 28, move: 0 })
        expect(sim.resource(Freeze).ticks).toBe(14)
        expect(events).toContain(`hit.landed@${sim.tick}`)
        sim.dispose()
      }
    })

    it('blocks one on frame 9: blockstun 12, pushed back, no damage', async () => {
      const { sim, wick } = await guarded(8)
      expect(fighter(sim, wick)).toMatchObject({ health: 8, state: CombatState.blockstun, stun: 12 })
      // The attacker's 4 ticks of hitstop hold the blockstun, then its 12 live ticks.
      run(sim, { act: { guard: true } }, 4 + 12)
      expect(hero(sim).z).toBeLessThan(0)
      expect(fighter(sim, wick)?.state).toBe(CombatState.idle)
      sim.dispose()
    })

    it('never blocks a low hit, nor one from behind', async () => {
      const low = await guarded(8, 'test-sweep')
      expect(fighter(low.sim, low.wick)).toMatchObject({ health: 6, state: CombatState.stun })
      low.sim.dispose()

      const sim = await startSim(openArea(), MOVES)
      const behind = spawnFighter(sim, 1, -1, 0)
      run(sim, { act: { guard: true } }, 3)
      startMove(sim, behind, 'test-jab', 5)
      run(sim, { act: { guard: true } })
      expect(fighter(sim, wickSid(sim))?.health).toBe(6)
      sim.dispose()
    })
  })

  it('freezes everything but the freeze counter and the input during hitstop, and a press in it starts the next slash on the first live tick in its window (G3-j)', async () => {
    const { sim, dummy } = await withDummy()
    const wick = wickSid(sim)
    slash(sim)
    run(sim, {}, 5) // frame 6 lands: slash-1's 4 ticks of hitstop
    expect(sim.resource(Freeze).ticks).toBe(4)
    const at = {
      wick: { ...hero(sim) },
      startedAt: heroAction(sim).startedAt,
      stun: fighter(sim, dummy)?.stun,
    }
    slash(sim) // pressed in the freeze, at frame 6: queued for slash-1's window
    run(sim, { stick: UP }, 3)
    expect(sim.resource(Freeze).ticks).toBe(0)
    expect(fighter(sim, wick)?.moveTick).toBe(6)
    expect(hero(sim)).toMatchObject({ x: at.wick.x, z: at.wick.z })
    expect(fighter(sim, dummy)?.stun).toBe(at.stun)
    expect(heroAction(sim).startedAt).toBe(at.startedAt + 4)
    run(sim, {}, 3) // live: frames 7 to 9
    expect(moveOf(sim, wick)).toBe('slash-1')
    run(sim, {})
    expect(moveOf(sim, wick)).toBe('slash-2')
    sim.dispose()
  })

  it('hurts Wick: damage, 18 ticks of stun, then no second hit inside 60 ticks', async () => {
    const sim = await startSim(openArea(), MOVES)
    const wick = wickSid(sim)
    const foe = spawnFighter(sim, 1, 1, HALF_TURN)
    startMove(sim, foe, 'test-jab', 5)
    run(sim, {})
    expect(fighter(sim, wick)).toMatchObject({ health: 6, state: CombatState.stun, stun: 18, iframes: 60 })
    run(sim, {}, 30)
    startMove(sim, foe, 'test-jab', 5)
    run(sim, {})
    expect(fighter(sim, wick)?.health).toBe(6)
    sim.dispose()
  })

  it('at 0 hearts knocks Wick down for 40 ticks, then raises hero.defeated once', async () => {
    const sim = await startSim(openArea(), MOVES)
    const wick = wickSid(sim)
    sim.entity(wick)?.set(Fighter, { health: 2 })
    const foe = spawnFighter(sim, 1, 1, HALF_TURN)
    startMove(sim, foe, 'test-jab', 5)
    run(sim, {})
    const landed = sim.tick
    expect(fighter(sim, wick)).toMatchObject({ health: 0, state: CombatState.down, stun: 40 })
    // The jab's 3 ticks of hitstop hold the count, then 40 live ticks (events are labelled as `run` labels them).
    const events = run(sim, {}, 60)
    expect(events.filter((event) => event.startsWith('hero.defeated'))).toEqual([
      `hero.defeated@${landed + 3 + 40}`,
    ])
    sim.dispose()
  })

  describe('part 2: moving out of the way', () => {
    const DOWN = { x: 0, y: 127 }
    const near = (value: number, expected: number) => expect(Math.abs(value - expected)).toBeLessThan(64)

    it('starts a spin on releasing Attack held 40 ticks, not 39, which hits foes on both sides once', async () => {
      const short = await startSim(openArea(), MOVES)
      run(short, { act: { slash: true } }, 39)
      run(short, {})
      expect(moveOf(short, wickSid(short))).not.toBe('spin')
      short.dispose()

      const sim = await startSim(openArea(), MOVES)
      run(sim, { act: { slash: true } }, 40)
      const front = spawnFighter(sim, 1, 1, HALF_TURN)
      const back = spawnFighter(sim, 1, -1, 0)
      run(sim, {})
      expect(moveOf(sim, wickSid(sim))).toBe('spin')
      const events = run(sim, {}, 60)
      expect(fighter(sim, front)?.health).toBe(4)
      expect(fighter(sim, back)?.health).toBe(4)
      expect(events.filter((event) => event.startsWith('hit.landed'))).toHaveLength(2)
      sim.dispose()
    })

    it('rolls 3.2 m in 24 frames toward the stick, and nothing lands on frames 2 to 12', async () => {
      const sim = await startSim(openArea(), MOVES)
      const wick = wickSid(sim)
      run(sim, { stick: UP, act: { action: true } })
      expect(moveOf(sim, wick)).toBe('roll')
      run(sim, {}, 23)
      near(hero(sim).z, metres(3.2))
      expect(hero(sim)).toMatchObject({ x: 0, facing: 0 })
      run(sim, {})
      expect(moveOf(sim, wick)).toBeUndefined()

      // A jab whose reach covers the roll's path from frame 12 on: frame 12 is safe, frame 13 is not.
      const hurt = await startSim(openArea(), MOVES)
      const foe = spawnFighter(hurt, 1, 3, HALF_TURN)
      run(hurt, { stick: UP, act: { action: true } })
      run(hurt, {}, 10) // frames 2 to 11
      startMove(hurt, foe, 'test-jab', 5)
      run(hurt, {}) // roll frame 12, jab frame 5
      expect(fighter(hurt, wickSid(hurt))?.health).toBe(8)
      run(hurt, {}) // roll frame 13, jab frame 6
      expect(fighter(hurt, wickSid(hurt))?.health).toBe(6)
      sim.dispose()
      hurt.dispose()
    })

    it('hops 2 m to the side or back while locked, facing the target; forward does nothing', async () => {
      for (const [stick, dx, dz] of [
        [RIGHT, -2, 0],
        [DOWN, 0, -2],
      ] as const) {
        const { sim } = await withDummy(3)
        run(sim, { lock: true })
        run(sim, { lock: true, stick, act: { action: true } })
        expect(moveOf(sim, wickSid(sim))).toMatch(/^hop-/)
        run(sim, { lock: true }, 19)
        near(hero(sim).x, metres(dx))
        near(hero(sim).z, metres(dz))
        // Locked, he faces the target from where each tick found him: one more tick reads the hop's end.
        const { x, z } = hero(sim)
        run(sim, { lock: true })
        expect(hero(sim).facing).toBe(angleOf(-x, metres(3) - z))
        sim.dispose()
      }
      const { sim } = await withDummy(3)
      run(sim, { lock: true })
      run(sim, { lock: true, stick: UP, act: { action: true } })
      expect(moveOf(sim, wickSid(sim))).toBeUndefined()
      sim.dispose()
    })

    it('knocks a dummy down 40 ticks and up 14 on a power-3 hit, and nothing lands meanwhile', async () => {
      const { sim, dummy } = await withDummy()
      startMove(sim, wickSid(sim), 'thrust', 10)
      run(sim, {})
      expect(fighter(sim, dummy)).toMatchObject({ health: 4, state: CombatState.down, stun: 40 })
      run(sim, {}, 8) // the thrust's hitstop
      startMove(sim, wickSid(sim), 'slash-1', 6)
      run(sim, {})
      expect(fighter(sim, dummy)?.health).toBe(4)
      run(sim, {}, 39)
      expect(fighter(sim, dummy)).toMatchObject({ state: CombatState.rise, stun: 14 })
      run(sim, {}, 14)
      expect(fighter(sim, dummy)?.state).toBe(CombatState.idle)
      sim.dispose()
    })

    /** Two rooms split at z = 0, Wick spawning in the south one, a pit across the north one at 3 m to 5 m. */
    const pitArea = () =>
      compileArea({
        id: 'pit',
        spawn: { x: 0, z: -2 },
        views: [
          { id: 'south', yawDeg: 0, rotate: true },
          { id: 'north', yawDeg: 0, rotate: true },
        ],
        rooms: [
          { view: 'south', min: [-10, -10], max: [10, 0] },
          { view: 'north', min: [-10, 0], max: [10, 10] },
        ],
        walls: [],
        targets: [],
        ember: { x: 9, z: 9 },
        pits: [{ min: [-10, 3], max: [10, 5] }],
      })

    it('drops Wick into a pit: half a heart, 60 ticks, then back at the room’s entry facing in, with 60 i-frames', async () => {
      const sim = await startSim(pitArea(), MOVES)
      const wick = wickSid(sim)
      let entry: { x: number; z: number } | undefined
      for (let ticks = 0; ticks < 200 && fighter(sim, wick)?.state !== CombatState.fall; ticks++) {
        run(sim, { stick: UP })
        if (entry === undefined && hero(sim).view === 'north') entry = { x: hero(sim).x, z: hero(sim).z }
      }
      expect(fighter(sim, wick)).toMatchObject({ health: 7, state: CombatState.fall, stun: 60 })
      run(sim, { stick: UP }, 59)
      expect(fighter(sim, wick)?.state).toBe(CombatState.fall)
      run(sim, {})
      expect(fighter(sim, wick)).toMatchObject({ state: CombatState.idle, iframes: 60 })
      expect(hero(sim)).toMatchObject({ ...entry, facing: 0 })
      sim.dispose()
    })

    it('a fall at half a heart knocks Wick down and defeats him', async () => {
      const sim = await startSim(pitArea(), MOVES)
      sim.entity(wickSid(sim))?.set(Fighter, { health: 1 })
      const events: string[] = []
      for (let ticks = 0; ticks < 200; ticks++) events.push(...run(sim, { stick: UP }))
      expect(fighter(sim, wickSid(sim))).toMatchObject({ health: 0, state: CombatState.defeated })
      expect(events.filter((event) => event.startsWith('hero.defeated'))).toHaveLength(1)
      sim.dispose()
    })
  })
})

// The golden replay (B-a): a scripted route through the first slice as commands, from the game's own sim spec. It
// pins the sim: Node records the hash, and Chromium, WebKit and Firefox must end on the same one bit for bit. A
// change to movement, the area or the plugin changes it on purpose: investigate it, never rebaseline it per engine.
type RouteSegment = readonly [input: TickInput, ticks: number]

const LEFT = { x: -127, y: 0 }
const GOLDEN_ROUTE: readonly RouteSegment[] = [
  [{ stick: UP }, 30], // north across the hall
  [{ stick: UP, turn: 10_000 }, 1], // a turn past the clamp: 45°
  [{ stick: UP }, 20], // north-east on the turned heading
  [{ turn: -10_000 }, 1], // and back
  [{ stick: RIGHT }, 20], // back under the doorway
  [{ stick: UP }, 75], // through it into the kiln: the view cuts, the stick latches
  [{}, 1], // released: the latch lets go
  [{ stick: UP }, 70], // on the kiln's heading, east into the wall
  [{ stick: RIGHT, lock: true }, 40], // lock onto the target and strafe along the wall
  [{ stick: LEFT, lock: true }, 10], // and back
  [{}, 10], // released
  [{ act: { slash: true } }, 1], // a slash
  [{}, 8], // mid-swing
  [{ act: { slash: true } }, 1], // a second slash: on slash-1's frame 10, its window's first, so slash-2 starts at once
  [{ act: { guard: true } }, 30], // guard raised and held while the slash ends
  [{}, 30], // lowered
  [{ act: { pickup: true } }, 1], // a pickup
  [{}, 60], // plays out
  [{ act: { point: true } }, 1], // a point
  [{}, 10], // still pointing
  // GAME-3D.1b: Lock mode toggle, while the point plays out (its 48 ticks outlast these 14).
  [{ lock: true, mode: 'toggle' }, 1], // a press locks
  [{ mode: 'toggle', cycle: 1 }, 1], // released, still locked; a cycle with one candidate keeps it
  [{ mode: 'toggle' }, 10], // locked, facing the target, already within the assist's 45°
  [{ lock: true, mode: 'toggle' }, 1], // the next press lets go
  [{ mode: 'toggle' }, 1], // released: still pointing at the end
]

/** The tick the golden route enters the kiln's view on. */
const GOLDEN_KILN_TICK = 118
/**
 * The sim's state hash after the whole golden route, with seed 1 (recorded in Node). Re-recorded when the lock
 * became edge-triggered (review of #250): `hero-control` gained `lockPressed`, which the hash covers (was
 * `d6ca2f2bc83ed284`; same route, same kiln tick, same 50 locked ticks, same end state). Re-recorded for M3.7b's
 * actions (was `aa170b86451f0838`): Wick gained `hero-action`, `hero-control` gained `actHeld` and `actPressed`, and
 * the route gained the slash, mid-swing slash, guard, pickup and point segments after the walk, whose kiln tick,
 * locked ticks and end position are unchanged. Re-recorded for M3.7b part 4 (was `ce0f0628722db568`): the snapshot
 * the hash is taken over carries the content hash (the area gained `ember`), the schema hash (the `ember.taken`
 * event) and each system's RNG state (the `ember.take` system), so the hash moved while the route's state did not:
 * the same kiln tick, locked ticks, action starts and end position, and no event on the route. Re-recorded for
 * GAME-3D.1a's save (was `0401873e6b063c1a`): the sim gained the `progress` resource (`embers: 0`, which
 * `ember.take` counts into), which the snapshot's schema hash and resource rows cover; the route takes no ember, so
 * its rejected commands, events, kiln tick, locked ticks, action starts and end position are unchanged. Re-recorded
 * for GAME-3D.1a's flow (was `1e1cf37b5fbe5d75`): the content became a world (`{ areas }`, each area gaining `id` and
 * `exits`), the schema hash covers the `hero.defeated`, `area.exit` and `area.entered` events and the `location`
 * resource, whose row the snapshot carries, and the `area.exit` system adds its RNG state. The first slice has no
 * exit, so the route's rejected commands, events, kiln tick, locked ticks, action starts and end position are
 * unchanged, and still asserted below. Re-recorded for GAME-3D.1b's lock-on (was `d78ee833353d562f`): `hero` gained
 * `lockHidden`, `hero-control` gained `lockHold` and `lockCycle`, the sim gained the `lock-cycle` command and the
 * `lock.assist` system; the held lock's press now picks inside the camera's cone (the same target: the slice has
 * one), its strafe maps through the line to the target and the assist turns the heading from 16,384 toward it, so
 * the end position, facing and heading moved; and the route gained a toggle press, a cycle and a toggle release
 * after the point. Its rejected commands (0), events (0), kiln tick (118), the held segment's 50 locked ticks (now
 * 62 with the toggle's 12) and the action starts are unchanged, and still asserted below. Re-recorded for GAME-3D.1c
 * part 1's combat (was `9fd1aebdb8f26a81`): the schema hash covers the `fighter` component (on Wick and the dummy),
 * `target`'s new `facing`, the `freeze` resource, the `hit.landed` and `foe.defeated` events and the four `combat.*`
 * systems, whose rows and RNG states the snapshot carries. The route's state did not move: its slashes are out of
 * the dummy's reach (0 events), the second press lands on slash-1's frame 10, the window's first frame, so it starts
 * slash-2 at once on the same tick 287 the old replace rule did, and the rejected commands, kiln tick, locked
 * ticks, action starts, end action and end position are unchanged, and still asserted below. Re-recorded for GAME-3D.1c part 2 (was
 * `c1998c3d0764df24`): the content gained the spin, roll and hop moves and each area's `pits` (none in the first
 * slice), the schema hash covers `act.action`, `fighter.charge` and the `location` resource's return point, which the
 * snapshot's rows carry (the spawn's). The route presses no Action and holds no Attack past a tick, so its state did
 * not move: the rejected commands, events, kiln tick, locked ticks, action starts, end action and end position are
 * unchanged, and still asserted below.
 */
const GOLDEN_HASH = 'ddddbb42a540c167'

async function runGolden() {
  const sim = await createSim(GAME_SIM)
  BASE3D_SIM.setup(sim)
  const startTick = sim.tick
  let kilnTick: number | undefined
  let rejected = 0
  let lockedTicks = 0
  let events = 0
  // Every action start on the route, as `clip@startedAt`.
  const starts: string[] = []
  for (const [input, ticks] of GOLDEN_ROUTE)
    for (let i = 0; i < ticks; i++) {
      const result = sim.step(commandsFor(sim, input))
      rejected += result.rejected.length
      events += result.events.length
      if (kilnTick === undefined && hero(sim).view === 'kiln') kilnTick = result.tick
      if (hero(sim).lockTarget !== 0) lockedTicks += 1
      const { clip, startedAt } = heroAction(sim)
      if (clip !== 0 && starts[starts.length - 1] !== `${clip}@${startedAt}`)
        starts.push(`${clip}@${startedAt}`)
    }
  const result = {
    hash: sim.hash(),
    kilnTick,
    rejected,
    lockedTicks,
    events,
    starts,
    action: heroAction(sim),
    hero: hero(sim),
    ticks: sim.tick - startTick,
  }
  sim.dispose()
  return { ...result, seed: BASE3D_SIM.seed }
}

describe('the golden replay (B-a)', () => {
  it('walks the route into the kiln, locks on, and ends on the recorded hash in this engine', async ({
    task,
  }) => {
    const result = await runGolden()
    expect(result.rejected).toBe(0)
    // The route's pickup is against the kiln's east wall, out of the ember's reach: the run never ends.
    expect(result.events).toBe(0)
    // The held segment's 50 ticks and the toggle's 12 (its press tick to the tick before the next press).
    expect(result.lockedTicks).toBe(62)
    expect(result.kilnTick).toBe(GOLDEN_KILN_TICK)
    // In the kiln, where the locked strafe round the target left him (it no longer runs along the east wall), on the
    // heading the assist turned toward the target, unlocked, unlatched and free to turn the camera again.
    expect(result.hero).toMatchObject({
      view: 'kiln',
      heading: 6_556,
      x: 116_656,
      z: 361_623,
      lockTarget: 0,
      lockHidden: 0,
      latched: false,
      rotate: true,
    })
    // Two slashes 9 ticks apart, the pickup after them, then the point, still running, with the guard lowered.
    expect(result.starts).toEqual(['1@278', '1@287', '3@348', '2@409'])
    expect(result.action).toEqual({ clip: 2, startedAt: 409, guard: false, guardSince: 288 })
    expect(result.hash).toBe(GOLDEN_HASH)
    // The hash this engine computed, for the evidence file (DX.9).
    const { seed, ticks, hash } = result
    recordGoldenEvidence(task, { scenario: 'base-3d/golden-route', seed, ticks, hash })
  })

  it('replays to the same hash twice in one engine', async () => {
    const first = await runGolden()
    const second = await runGolden()
    expect(second.hash).toBe(first.hash)
  })
})
