// Shake and sparks (DESIGN.md §7.6, GAME-3D.1c part 3): presentation, game code, keyed by the sim's `hit.landed`.
// Shake is a screen-space translation of the stage's world layer, never a camera rotation; sparks are a few small
// flat cubes thrown out from the hit point. Reduced motion turns the shake off and shortens the sparks. The sim never
// reads either, and decision 7 keeps them out of Plus's `feel`.
import type { Pixi3dOptions } from '@mcthaydt/automata-render-pixi3d'
import { Q16 } from '@mcthaydt/automata-render-pixi3d/sim'
import type { FrameInfo } from '@mcthaydt/automata-runtime'
import type { StepResult } from '@mcthaydt/automata-sim'
import { CubeGeometry, FlatMaterial, Mesh3D, type View3D } from '@pixi/3d'
import type { Container } from 'pixi.js'
import { FoeDefeated, HitLanded } from '../events.ts'

/** A hit as presentation keeps it: its power and kind, where it landed (metres), and when (presentation ms). */
export interface FeltHit {
  readonly power: number
  /** A hit's kind, or `ash`: a beaten foe's burst (power 0, so no shake). */
  readonly kind: 'hit' | 'block' | 'parry' | 'ash'
  readonly at: { readonly x: number; readonly z: number }
  readonly startMs: number
}

/** The shake's size in internal pixels by power 1, 2 and 3 (§7.6's starting tunables). */
const SHAKE_PX: readonly number[] = [0, 1, 2, 4]
/** How long a shake takes to die away (§7.6). */
export const SHAKE_MS = 120
/** How long sparks last, and under reduced motion (§7.6: shortened). */
const SPARK_MS = 150
const SPARK_MS_REDUCED = 75
/** How far the sparks fly out by the end, in metres. */
const SPARK_SPREAD = 0.3
/**
 * The sparks' colours by kind: ember orange for a hit, ash grey for a block, flame yellow for a parry, and dark ash
 * for a beaten foe's burst (DESIGN.md §8.1 rule 6).
 */
export const SPARK_COLOURS = { hit: 0xff9a3c, block: 0xc8c4be, parry: 0xffe066, ash: 0x5a5353 } as const
/** Where the sparks fly from: chest height, metres above the floor. */
const SPARK_HEIGHT = 1.1

/**
 * The world layer's offset now, in internal pixels: the largest live shake, decaying linearly to nothing at
 * `SHAKE_MS`, flicking side to side every 16 ms (a frame at 60 Hz) and half as far up and down. None under reduced
 * motion.
 */
export function shakeOffset(
  hits: readonly FeltHit[],
  nowMs: number,
  reduced: boolean,
): { readonly x: number; readonly y: number } {
  if (reduced) return { x: 0, y: 0 }
  let size = 0
  let age = 0
  for (const hit of hits) {
    const elapsed = nowMs - hit.startMs
    if (elapsed < 0 || elapsed >= SHAKE_MS) continue
    const live = (SHAKE_PX[hit.power] ?? 0) * (1 - elapsed / SHAKE_MS)
    if (live > size) {
      size = live
      age = elapsed
    }
  }
  if (size === 0) return { x: 0, y: 0 }
  const flick = Math.floor(age / 16) % 2 === 0 ? 1 : -1
  return { x: size * flick, y: (size / 2) * -flick }
}

/** A hit's sparks now: how far out (metres), how much is left (1 to 0), and their colour; undefined once gone. */
export function sparkFrame(
  hit: FeltHit,
  nowMs: number,
  reduced: boolean,
): { readonly spread: number; readonly alpha: number; readonly colour: number } | undefined {
  const life = reduced ? SPARK_MS_REDUCED : SPARK_MS
  const t = (nowMs - hit.startMs) / life
  if (t < 0 || t >= 1) return undefined
  return { spread: SPARK_SPREAD * t, alpha: 1 - t, colour: SPARK_COLOURS[hit.kind] }
}

/**
 * What a step's events feel like, at `nowMs`: each `hit.landed` as its sparks and shake, and each `foe.defeated` as a
 * burst of ash where the foe fell, with no shake.
 */
export function feltEvents(result: StepResult, nowMs: number): FeltHit[] {
  const felt: FeltHit[] = []
  for (const event of result.events) {
    if (event.type === HitLanded.id) {
      const hit = event.payload as { power: number; kind: FeltHit['kind']; x: number; z: number }
      felt.push({ power: hit.power, kind: hit.kind, at: { x: hit.x / Q16, z: hit.z / Q16 }, startMs: nowMs })
    } else if (event.type === FoeDefeated.id) {
      const fallen = event.payload as { x: number; z: number }
      felt.push({ power: 0, kind: 'ash', at: { x: fallen.x / Q16, z: fallen.z / Q16 }, startMs: nowMs })
    }
  }
  return felt
}

/** Each burst's sparks fly out along these four diagonals in plan, and a little up. */
const DIRECTIONS: readonly (readonly [number, number, number])[] = [
  [1, 0.6, 1],
  [-1, 0.4, 1],
  [1, 0.5, -1],
  [-1, 0.7, -1],
]
/** At most this many bursts show at once; older ones give way. */
const MAX_BURSTS = 4

/**
 * The stage hooks that play shake and sparks: `hit.landed` events in `apply`, then each frame the world layer's
 * offset and the sparks' meshes, on presentation time (paused frames do not advance it). `reduced` is read each
 * frame, so a change to the player's setting takes effect at once.
 */
export function feelHooks(
  view: View3D,
  stage: { readonly world: Container },
  reduced: () => boolean,
): NonNullable<ReturnType<NonNullable<Pixi3dOptions['scene']>>> {
  let nowMs = 0
  let hits: FeltHit[] = []
  const geometry = new CubeGeometry({ width: 0.06, height: 0.06, depth: 0.06 })
  const materials = new Map<number, FlatMaterial>()
  const materialFor = (colour: number): FlatMaterial => {
    const known = materials.get(colour)
    if (known !== undefined) return known
    const made = new FlatMaterial({ baseColor: colour })
    materials.set(colour, made)
    return made
  }
  const meshes: Mesh3D[] = []
  for (let i = 0; i < MAX_BURSTS * DIRECTIONS.length; i++) {
    const mesh = new Mesh3D({ geometry, material: materialFor(SPARK_COLOURS.hit) })
    mesh.visible = false
    view.root.addChild(mesh)
    meshes.push(mesh)
  }
  const restX = stage.world.position.x
  const restY = stage.world.position.y

  return {
    apply(result: StepResult) {
      hits.push(...feltEvents(result, nowMs))
      if (hits.length > MAX_BURSTS) hits = hits.slice(-MAX_BURSTS)
    },
    draw(frame: FrameInfo) {
      if (!frame.paused) nowMs += frame.frameMs
      const isReduced = reduced()
      const offset = shakeOffset(hits, nowMs, isReduced)
      stage.world.position.set(restX + offset.x, restY + offset.y)
      for (const mesh of meshes) mesh.visible = false
      hits.forEach((hit, burst) => {
        const spark = sparkFrame(hit, nowMs, isReduced)
        if (spark === undefined) return
        DIRECTIONS.forEach(([dx, dy, dz], index) => {
          const mesh = meshes[burst * DIRECTIONS.length + index]
          if (mesh === undefined) return
          mesh.visible = true
          mesh.material = materialFor(spark.colour)
          mesh.position.set(
            hit.at.x + dx * spark.spread,
            SPARK_HEIGHT + dy * spark.spread,
            hit.at.z + dz * spark.spread,
          )
          mesh.scale.set(spark.alpha, spark.alpha, spark.alpha)
        })
      })
      hits = hits.filter((hit) => nowMs - hit.startMs < Math.max(SHAKE_MS, SPARK_MS))
    },
    reset() {
      hits = []
      stage.world.position.set(restX, restY)
    },
  }
}
