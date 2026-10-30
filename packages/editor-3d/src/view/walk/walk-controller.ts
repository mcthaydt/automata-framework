// The Walk view's camera as plain TypeScript (ED3D.8a step 4, spec D8, §5.3 flow 4, §9 and §10, ED3-n): what the two sticks,
// WASD and Q E, and the Walk, Fly and Orbit modes do to the camera, and what the crosshair is on. No Svelte, DOM, Pixi or
// clock: the view forwards the sticks and keys, calls `tick` from its frame loop with the seconds since the last frame,
// reads `view` and draws it. The selection a tap makes is the editor's, so Plan and 3D show the same one.
//
// Walk keeps the eye `eyeHeight` above the floor of the sector it is in and stops at the geometry's colliders (solid
// walls, steps too tall to climb, blocking masks), so it crosses at a portal and not through a wall. Fly goes anywhere.
// Orbit looks at a point from 8 m off at the dollhouse's 30 degrees. All three are one camera (D8).
import type { Point as ScreenPoint, Size } from '@mcthaydt/automata-editor-kit/core'
import { createGeometryCache, type Geometry } from '../../app/geometry-cache'
import type { Point } from '../../format/sector.schema'
import { crossing, type Edge, sectorAt, segmentDistance } from '../../geometry/sectors'
import type { LevelEditor } from '../../model/level-editor'
import {
  type Camera3D,
  forward,
  ORBIT_FOV,
  type Orbit,
  orbitBy,
  orbitCamera,
  rayThrough,
  type SpawnPoint,
  walkStart,
} from '../mesh/camera-3d'
import { pickMesh } from '../mesh/mesh-pick'
import { buildSectorMesh, type SectorMesh, type SurfaceRole, type Vec3 } from '../mesh/sector-mesh'
import { isLayerOff } from '../plan/plan-pick'

export type WalkMode = 'walk' | 'fly' | 'orbit'

/** A virtual stick's tilt: each axis from -1 to 1, `x` to the right and `y` up (forward, or look up). */
export interface Stick {
  readonly x: number
  readonly y: number
}

/** What the crosshair is on. */
export interface WalkAim {
  readonly role: SurfaceRole
  readonly sector: string
  /** What a tap selects; nothing on a locked layer or a surface nothing selects. */
  readonly selection: string | undefined
  readonly point: Vec3
  /** From the eye, in metres. */
  readonly distance: number
}

export interface WalkView {
  readonly mode: WalkMode
  readonly camera: Camera3D
  /** What the status line says when the start was a guess (ED3-n). */
  readonly warning: string | undefined
  readonly aim: WalkAim | undefined
  /** The sector the eye is over, for the status line. */
  readonly sector: string | undefined
}

export interface WalkController {
  readonly view: WalkView
  /** Called after `view` changes; returns a way to stop. */
  subscribe(run: () => void): () => void
  setMode(mode: WalkMode): void
  stick(which: 'move' | 'look', tilt: Stick): void
  /** A key by its `KeyboardEvent.code`, pressed or let go; true when it is one Walk uses. */
  key(code: string, down: boolean): boolean
  /** Fly's up and down buttons: -1 to 1, 0 when let go. */
  lift(amount: number): void
  /** Moves the camera by what is held, for this many seconds (at most a tenth). */
  tick(seconds: number): void
  /** A tap: selects what the crosshair is on, or clears the selection when it is on nothing. */
  pick(): void
  /** Back to the start: the spawn, or the first sector with its warning. */
  restart(): void
  resize(size: Size): void
  /** Stops following the editor. */
  dispose(): void
}

const DEGREES = Math.PI / 180
/** Metres a second at full tilt: walking (and sliding Orbit's point), and flying. */
const WALK_SPEED = 3
const FLY_SPEED = 6
/** Radians a second at full tilt. */
const LOOK_RATE = 120 * DEGREES
const MAX_PITCH = 85 * DEGREES
/** The longest tick: a frame that took longer (a tab in the background) moves no farther. */
const MAX_TICK = 0.1
/** How near Walk's eye may come to a wall, so it never stands in the wall's face. */
const REACH = 0.25
/** Orbit's distance, pitch, and the height above the floor of the point it looks at. */
const ORBIT_DISTANCE = 8
const ORBIT_PITCH = 30 * DEGREES
const ORBIT_HEIGHT = 1

/** The keys Walk reads, as the axis each pushes and which way. */
const KEYS: Readonly<Record<string, readonly ['forward' | 'right' | 'turn', 1 | -1]>> = {
  KeyW: ['forward', 1],
  KeyS: ['forward', -1],
  KeyD: ['right', 1],
  KeyA: ['right', -1],
  KeyE: ['turn', 1],
  KeyQ: ['turn', -1],
}

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value))
const clampStick = (tilt: Stick): Stick => ({
  x: Number.isFinite(tilt.x) ? clamp(tilt.x, -1, 1) : 0,
  y: Number.isFinite(tilt.y) ? clamp(tilt.y, -1, 1) : 0,
})

/** Equal as data. */
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

/** Floors and ceilings are the `sectors` layer, the rest of a room's surfaces its `walls`. */
const layerOf = (role: SurfaceRole): string => (role === 'floor' || role === 'ceiling' ? 'sectors' : 'walls')

/** Whether `p` is on the side of an edge its room is on: a wall stops what leaves its room, not what comes into it. */
const inward = (p: Point, edge: Edge): boolean =>
  (p.x - edge.a.x) * edge.normal.x + (p.z - edge.a.z) * edge.normal.z >= 0

/** The level's spawn: the first thing of the definition `spawn`, facing its `facing` field (0 without one). */
function spawnOf<D>(editor: LevelEditor<D>): SpawnPoint | undefined {
  const spawn = editor.profile.entities(editor.level).things.find((thing) => thing.def === 'spawn')
  if (spawn === undefined) return undefined
  const facing = spawn.values['facing']
  return { x: spawn.x, z: spawn.z, facing: typeof facing === 'number' ? facing : 0 }
}

export function createWalkController<D>(editor: LevelEditor<D>, canvas: Size): WalkController {
  const listeners = new Set<() => void>()
  const geometry = createGeometryCache(editor)
  const { eyeHeight, fov } = editor.profile.hints
  let size = canvas
  let mode: WalkMode = 'walk'
  let move: Stick = { x: 0, y: 0 }
  let look: Stick = { x: 0, y: 0 }
  let lifting = 0
  const held = new Set<string>()

  /** Walk and Fly's eye and the way it looks; Orbit's point and angles; the last place Walk stood on a floor. */
  let eye: Vec3 = [0, 0, 0]
  let yaw = 0
  let pitch = 0
  let orbit: Orbit = { target: [0, 0, 0], distance: ORBIT_DISTANCE, yaw: 0, pitch: ORBIT_PITCH }
  let lastWalk: { eye: Vec3; yaw: number } = { eye, yaw }
  let warning: string | undefined

  let mesh: { readonly level: D; readonly mesh: SectorMesh } | undefined
  const meshOf = (built: Geometry<D>): SectorMesh => {
    if (mesh?.level !== built.level)
      mesh = { level: built.level, mesh: buildSectorMesh(built.layers, built.select) }
    return mesh.mesh
  }

  const sectorUnder = (p: Point) => {
    for (const layer of geometry().layers) {
      const sector = sectorAt(layer.map, p)
      if (sector !== undefined) return sector
    }
    return undefined
  }

  /**
   * A step Walk may take: one that ends in a sector, and crosses no collider on its way out of a room or comes nearer
   * than `REACH` to one (a step that leaves a wall it already stands too near is allowed, so Walk cannot be stuck).
   */
  const canStep = (from: Point, to: Point): boolean => {
    if ((to.x === from.x && to.z === from.z) || sectorUnder(to) === undefined) return false
    return !geometry().layers.some((layer) =>
      layer.map.colliders.some(({ edge }) => {
        if (!inward(from, edge)) return false
        if (crossing(from.x, from.z, to.x, to.z, edge.a, edge.b) >= 0) return true
        const near = segmentDistance(to, to, edge.a, edge.b)
        return near < REACH && near < segmentDistance(from, from, edge.a, edge.b)
      }),
    )
  }

  /** Walk's eye at a place: on the floor of the sector there, and remembered as where Walk last stood. */
  const standAt = (p: Point): void => {
    const floor = sectorUnder(p)?.floor ?? 0
    eye = [p.x, floor + eyeHeight, p.z]
    lastWalk = { eye, yaw }
  }

  const camera = (): Camera3D => (mode === 'orbit' ? orbitCamera(orbit, ORBIT_FOV) : { eye, yaw, pitch, fov })

  const aimOf = (seen: Camera3D): WalkAim | undefined => {
    const { hidden, locked } = editor.view.state
    const whole = meshOf(geometry())
    // A hidden layer is not drawn, so the ray goes through it; a locked one is drawn and stops it.
    const shown = {
      ...whole,
      surfaces: whole.surfaces.filter((surface) => !hidden.includes(layerOf(surface.role))),
    }
    const centre: ScreenPoint = { x: size.w / 2, y: size.h / 2 }
    const hit = pickMesh(shown, rayThrough(seen, size, centre))
    if (hit === undefined) return undefined
    const off = isLayerOff({ hidden, locked }, layerOf(hit.role))
    return {
      role: hit.role,
      sector: hit.sector,
      selection: off ? undefined : hit.selection,
      point: hit.point,
      distance: hit.distance,
    }
  }

  const compute = (): WalkView => {
    const seen = camera()
    const at = mode === 'orbit' ? orbit.target : seen.eye
    return {
      mode,
      camera: seen,
      warning,
      aim: aimOf(seen),
      sector: sectorUnder({ x: at[0], z: at[2] })?.id,
    }
  }

  const start = (): void => {
    const begun = walkStart(geometry().layers, spawnOf(editor), { eyeHeight, fov })
    mode = 'walk'
    eye = begun.camera.eye
    yaw = begun.camera.yaw
    pitch = 0
    lastWalk = { eye, yaw }
    warning = begun.warning
  }
  start()
  let view = compute()

  const refresh = (): void => {
    const next = compute()
    if (same(view, next)) return
    view = next
    for (const run of [...listeners]) run()
  }

  /** An edit can move the floor under Walk's eye: it stands on the new one. */
  const onLevel = (): void => {
    if (mode === 'walk' && sectorUnder({ x: eye[0], z: eye[2] }) !== undefined)
      standAt({ x: eye[0], z: eye[2] })
    refresh()
  }
  const stops = [editor.history.subscribe(onLevel), editor.view.subscribe(refresh)]

  /** The keys' push on an axis, and a stick's added to it, held to one. */
  const axis = (name: 'forward' | 'right' | 'turn', stick: number): number => {
    let push = stick
    for (const code of held) {
      const key = KEYS[code]
      if (key?.[0] === name) push += key[1]
    }
    return clamp(push, -1, 1)
  }

  /** The move as metres along the plan for this tick: forward along the heading and to its right, never more than full. */
  const planStep = (seconds: number, speed: number, heading: number): Point => {
    let [ahead, right] = [axis('forward', move.y), axis('right', move.x)]
    const length = Math.hypot(ahead, right)
    if (length > 1) [ahead, right] = [ahead / length, right / length]
    const distance = speed * seconds
    return {
      x: (Math.sin(heading) * ahead + Math.cos(heading) * right) * distance,
      z: (-Math.cos(heading) * ahead + Math.sin(heading) * right) * distance,
    }
  }

  const walkTick = (seconds: number): void => {
    yaw += axis('turn', look.x) * LOOK_RATE * seconds
    pitch = clamp(pitch + look.y * LOOK_RATE * seconds, -MAX_PITCH, MAX_PITCH)
    const step = planStep(seconds, WALK_SPEED, yaw)
    const from = { x: eye[0], z: eye[2] }
    const to = { x: from.x + step.x, z: from.z + step.z }
    // Into a wall, the step slides along it: across, then along.
    const open = [to, { x: to.x, z: from.z }, { x: from.x, z: to.z }].find((p) => canStep(from, p))
    standAt(open ?? from)
  }

  const flyTick = (seconds: number): void => {
    yaw += look.x * LOOK_RATE * seconds
    pitch = clamp(pitch + look.y * LOOK_RATE * seconds, -MAX_PITCH, MAX_PITCH)
    const ahead = forward({ eye, yaw, pitch, fov })
    const right: Vec3 = [Math.cos(yaw), 0, Math.sin(yaw)]
    const [a, r] = [axis('forward', move.y), axis('right', move.x)]
    const up = clamp(lifting + axis('turn', 0), -1, 1)
    const distance = FLY_SPEED * seconds
    eye = [
      eye[0] + (ahead[0] * a + right[0] * r) * distance,
      eye[1] + (ahead[1] * a + up) * distance,
      eye[2] + (ahead[2] * a + right[2] * r) * distance,
    ]
  }

  const orbitTick = (seconds: number): void => {
    orbit = orbitBy(orbit, axis('turn', look.x) * LOOK_RATE * seconds, look.y * LOOK_RATE * seconds)
    const step = planStep(seconds, WALK_SPEED, orbit.yaw)
    const [x, y, z] = orbit.target
    orbit = { ...orbit, target: [x + step.x, y, z + step.z] }
  }

  /** Walk again: on the floor under a point, or where Walk last stood when the point is outside every sector. */
  const landAt = (p: Point, heading: number): void => {
    yaw = heading
    pitch = 0
    if (sectorUnder(p) !== undefined) standAt(p)
    else ({ eye, yaw } = lastWalk)
  }

  return {
    get view() {
      return view
    },
    subscribe(run) {
      listeners.add(run)
      return () => {
        listeners.delete(run)
      }
    },
    setMode(next) {
      if (next === mode) return
      if (next === 'orbit') {
        const at = mode === 'walk' ? eye[1] - eyeHeight : (sectorUnder({ x: eye[0], z: eye[2] })?.floor ?? 0)
        orbit = {
          target: [eye[0], at + ORBIT_HEIGHT, eye[2]],
          distance: ORBIT_DISTANCE,
          yaw,
          pitch: ORBIT_PITCH,
        }
      } else if (mode === 'orbit') {
        if (next === 'walk') landAt({ x: orbit.target[0], z: orbit.target[2] }, orbit.yaw)
        else ({ eye, yaw, pitch } = orbitCamera(orbit, fov))
      } else if (next === 'walk') landAt({ x: eye[0], z: eye[2] }, yaw)
      mode = next
      refresh()
    },
    stick(which, tilt) {
      if (which === 'move') move = clampStick(tilt)
      else look = clampStick(tilt)
    },
    key(code, down) {
      if (KEYS[code] === undefined) return false
      if (down) held.add(code)
      else held.delete(code)
      return true
    },
    lift(amount) {
      lifting = Number.isFinite(amount) ? clamp(amount, -1, 1) : 0
    },
    tick(seconds) {
      if (!(seconds > 0)) return
      const step = Math.min(seconds, MAX_TICK)
      if (mode === 'walk') walkTick(step)
      else if (mode === 'fly') flyTick(step)
      else orbitTick(step)
      refresh()
    },
    pick() {
      const selection = view.aim?.selection
      editor.selection.set(selection === undefined ? [] : [selection])
    },
    restart() {
      start()
      refresh()
    },
    resize(next) {
      size = next
      refresh()
    },
    dispose() {
      for (const stop of stops) stop()
      listeners.clear()
    },
  }
}
