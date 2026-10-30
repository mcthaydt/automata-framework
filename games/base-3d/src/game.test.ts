import { CameraHeading, cameraHeadingPlugin, cameraView } from '@mcthaydt/automata-render-pixi3d/sim'
import { type Command, createSim, type Sim } from '@mcthaydt/automata-sim'
import { recordGoldenEvidence } from '@mcthaydt/evidence/golden'
import { describe, expect, it } from 'vitest'
import { base3d } from '../game.ts'
import { Hero, Target } from './components.ts'
import { HERO_HALF, metres, WALK_PER_TICK } from './constants.ts'
import { FIRST_SLICE } from './content/first-slice.ts'
import { type Area, type AreaSource, areaOf, compileArea, spawnArea } from './state.ts'
import { BASE3D_SIM, base3dPlugin } from './systems.ts'

// base-3d's sim, commands in, step, state out (DESIGN.md §3.1). The browsers project runs this whole file in
// Chromium, WebKit and Firefox, so every case here, the golden replay included, holds in four engines (B-a).

describe('the plugin', () => {
  it('registers beside the camera-heading plugin it depends on', async () => {
    const sim = await createSim({ seed: 1, plugins: [cameraHeadingPlugin, base3dPlugin] })
    expect(sim.hash()).toMatch(/^[0-9a-f]{16}$/)
    sim.dispose()
  })

  it('takes the heading from render3dExtension, not from the game’s own list (RT.EXT1)', () => {
    expect(BASE3D_SIM.plugins).toEqual([base3dPlugin])
    expect(base3d.sim.plugins).toEqual([base3dPlugin, cameraHeadingPlugin])
  })
})

describe('the area', () => {
  const tiny: AreaSource = {
    spawn: { x: 0.5, z: -1.25 },
    views: [{ id: 'hall', yawDeg: 90 }],
    rooms: [{ view: 'hall', min: [-2, -2], max: [2, 2] }],
    walls: [{ min: [-2.1, 2], max: [2.1, 2.2] }],
    targets: [{ x: 1, z: 0.25 }],
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

  it('reads only an area as the sim’s content', () => {
    const area = compileArea(tiny)
    expect(areaOf(area)).toBe(area)
    expect(() => areaOf({ ...area, views: undefined })).toThrow(/not an area/)
    expect(() => areaOf({ ...area, targets: 'none' })).toThrow(/not an area/)
    expect(() => areaOf(null)).toThrow(/not an area/)
  })

  it('compiles the first slice: two rooms, two views, a doorway', () => {
    const area = compileArea(FIRST_SLICE)
    expect(area.views.map((view) => view.id)).toEqual(['hall', 'kiln'])
    expect(area.rooms.map((room) => room.view)).toEqual(['hall', 'kiln'])
    expect(area.targets).toHaveLength(1)
  })
})

/** The game's sim spec as `defineGame` made it: `BASE3D_SIM` with render3dExtension's heading plugin after its own. */
const GAME_SIM = { ...BASE3D_SIM, plugins: base3d.sim.plugins }

/** A sim made the way the game makes it (`GAME_SIM`), on the first slice or a test area. */
async function startSim(area: Area = BASE3D_SIM.content): Promise<Sim> {
  const sim = await createSim({ ...GAME_SIM, content: area })
  if (area === BASE3D_SIM.content) BASE3D_SIM.setup(sim)
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
    expect(sim.query(Target).map((target) => target.get(Target))).toEqual([{ x: metres(2), z: metres(9) }])
    sim.dispose()
  })
})

interface TickInput {
  readonly stick?: { readonly x: number; readonly y: number }
  readonly turn?: number
  readonly lock?: boolean
}

/** One tick's commands from player slot 0: the stick every tick (as the input layer sends it), a turn, lock. */
function commandsFor(sim: Sim, input: TickInput): Command[] {
  const at = { tick: sim.tick, source: 0 }
  const commands: Command[] = [
    { ...at, seq: sim.tick * 3, type: 'move', payload: input.stick ?? { x: 0, y: 0 } },
  ]
  if (input.turn !== undefined)
    commands.push({ ...at, seq: sim.tick * 3 + 1, type: 'camera-turn', payload: { units: input.turn } })
  commands.push({ ...at, seq: sim.tick * 3 + 2, type: 'lock', payload: { down: input.lock ?? false } })
  return commands
}

function run(sim: Sim, input: TickInput, ticks = 1): void {
  for (let i = 0; i < ticks; i++) {
    const result = sim.step(commandsFor(sim, input))
    if (result.rejected.length > 0) throw new Error(`rejected: ${JSON.stringify(result.rejected)}`)
  }
}

const UP = { x: 0, y: -127 }
const RIGHT = { x: 127, y: 0 }

/** One open room, no walls, a view with `yawDeg` and `rotate`. */
const openArea = (yawDeg = 0, rotate = true, targets: AreaSource['targets'] = []): Area =>
  compileArea({
    spawn: { x: 0, z: 0 },
    views: [{ id: 'open', yawDeg, rotate }],
    rooms: [{ view: 'open', min: [-50, -50], max: [50, 50] }],
    walls: [],
    targets,
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
      spawn: { x: 0, z: 0 },
      views: [{ id: 'open', yawDeg: 0 }],
      rooms: [{ view: 'open', min: [-50, -50], max: [50, 50] }],
      walls: [{ min: [-5, 2], max: [5, 2.2] }],
      targets: [],
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

  it('locks onto the nearest target within 12 m while held, and lets go on release', async () => {
    const sim = await startSim(
      openArea(0, true, [
        { x: 0, z: 5 },
        { x: 3, z: 0 },
      ]),
    )
    const [, near] = targetIds(sim)
    run(sim, { lock: true })
    expect(hero(sim).lockTarget).toBe(near)
    run(sim, { lock: true, stick: UP }, 10) // held: the lock stays though the other target is now nearer
    expect(hero(sim).lockTarget).toBe(near)
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
    const tie = await startSim(
      openArea(0, true, [
        { x: 4, z: 0 },
        { x: 0, z: 4 },
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
    run(sim, { lock: true, stick: UP })
    expect(hero(sim)).toMatchObject({ facing: 16_384, moving: true, moveDir: -16_384 })
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
]

/** The tick the golden route enters the kiln's view on. */
const GOLDEN_KILN_TICK = 118
/**
 * The sim's state hash after the whole golden route, with seed 1 (recorded in Node). Re-recorded when the lock
 * became edge-triggered (review of #250): `hero-control` gained `lockPressed`, which the hash covers (was
 * `d6ca2f2bc83ed284`; same route, same kiln tick, same 50 locked ticks, same end state).
 */
const GOLDEN_HASH = 'aa170b86451f0838'

async function runGolden() {
  const sim = await createSim(GAME_SIM)
  BASE3D_SIM.setup(sim)
  const startTick = sim.tick
  let kilnTick: number | undefined
  let rejected = 0
  let lockedTicks = 0
  for (const [input, ticks] of GOLDEN_ROUTE)
    for (let i = 0; i < ticks; i++) {
      const result = sim.step(commandsFor(sim, input))
      rejected += result.rejected.length
      if (kilnTick === undefined && hero(sim).view === 'kiln') kilnTick = result.tick
      if (hero(sim).lockTarget !== 0) lockedTicks += 1
    }
  const result = {
    hash: sim.hash(),
    kilnTick,
    rejected,
    lockedTicks,
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
    expect(result.lockedTicks).toBe(50)
    expect(result.kilnTick).toBe(GOLDEN_KILN_TICK)
    // Against the kiln's east wall, on the kiln's heading, unlocked and unlatched.
    expect(result.hero).toMatchObject({
      view: 'kiln',
      heading: 16_384,
      x: metres(4) - HERO_HALF,
      lockTarget: 0,
      latched: false,
    })
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
