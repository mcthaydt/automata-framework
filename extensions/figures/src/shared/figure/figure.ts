// biome-ignore-all lint/style/noNonNullAssertion: the compiler needs these assertions until task 26 of the builders-fold plan (the strict flags) replaces each with a check

import { GROUP } from '../body/parts'
import { fk, J, type Skeleton, skeleton } from '../body/rig'
import { apply, applyDir, type M, type V3, wrapAngle } from '../math/math'
import { evaluate, type MotionState } from '../motion/motion'
import { NECK } from '../outfit/garments'
import { ITEMS } from '../outfit/items'
import { newWeave, type Weave } from '../paint/fabric'
import { type Bends, type FaceStamp, type HandStamp, PAINT, type PaintStyle, paint } from '../paint/paint'
import {
  blendJoins,
  cleanup,
  type GBuffer,
  gbuffer,
  neckline,
  rasterize,
  resolve,
  type Soup,
  STYLE,
  type Style,
  smoothContour,
  stamp,
  stampPrint,
  VERT,
} from '../paint/raster'
import type { CastMember } from './cast'
import { clothU } from './cloth'
import {
  type Built,
  build,
  type FaceState,
  type FigureInput,
  type FigureLight,
  soupOf,
  type View,
} from './figure-build'

export type { Built, FaceState, FigureInput, FigureLight, View } from './figure-build'
export { build } from './figure-build'

/**
 * One figure: call `update` every frame with the time step and input; it re-rasterises only when the stepped pose or
 * the snapped view changes (`dirty`), and keeps each pose's painted cell and normal map for the next time it is shown.
 */
export class Figure {
  readonly member: CastMember
  readonly skeleton: Skeleton
  readonly cell: [number, number]
  readonly metres: number
  readonly feet: number
  outfit: string
  item: string | null = null
  style: Style = { ...STYLE }
  /** Seconds since the figure was made, and the walk phase. */
  private time = 0
  private phase = 0
  /** The facing shown (it turns toward the wanted one a step at a time) and the last pose step. */
  private shown: number | null = null
  private step = -1
  private built: Built
  private soup?: Soup
  private lightOut = new Float32Array(0)
  readonly g: GBuffer
  /** The outside light (see FigureLight); null draws the painter's own key. It changes as the figure moves, so a lit
   * figure never reads or writes the cell cache. */
  light: FigureLight | null = null
  /** With a light: the G-buffer rasterised with each vertex's light in its place slots, and its supersampled pass. */
  private gL: GBuffer
  private hiL: GBuffer
  /** With a fabric in use (H5): the G-buffer rasterised with each vertex's cloth slots in its place slots, and its supersampled pass. */
  private gC: GBuffer | null = null
  private hiC: GBuffer | null = null
  /** The supersampled G-buffer the raster draws into, resolved into `g`. */
  private hi: GBuffer
  /** The painter's output (paint.ts): the cell's colours and normal map; and its style. */
  readonly painted: Uint8ClampedArray
  readonly normals: Uint8ClampedArray
  /** The cell's depth, per texel: metres toward the camera from the root's plane. The G-buffer's where a surface is, the nearest
   * neighbour's under an outline texel (the ink ring has no surface of its own), −Infinity where the cell is empty. Finite at
   * every opaque texel, fresh or from the cell cache, so a scene can depth-test the cell (stage/cell.ts). */
  readonly depth: Float32Array
  /** With a fabric in use (H5): the cell's untiled colours and tile labels (paint.ts), which `lightFigure` lights the cloth's ground
   * from before it lays the tile; null when no built material names a fabric (and no buffer is allocated). Allocated on first
   * use and kept with each cached cell. */
  private weaveBuf: Weave | null = null
  get weave(): Weave | null {
    return this.built.cloth ? this.weaveBuf : null
  }
  paintStyle: PaintStyle = { ...PAINT }
  private faceStamp: FaceStamp | null = null
  /** The cell cache (paint.ts cells by pose key, most recent last) and whether it is used; its cap is CELLS. */
  cache = true
  /** Cells keep only the figure's own rows (y0 up to y0 + rows), most of a cell being empty. */
  private cells = new Map<
    string,
    {
      y0: number
      painted: Uint8ClampedArray
      normals: Uint8ClampedArray
      depth: Float32Array
      weave: Weave | null
      world: M[]
      face: FaceStamp | null
    }
  >()
  private shownKey = ''
  private hairPose = { pitch: 0, roll: 0 }
  /** The hands the last raster drew (paint.ts HandStamp). */
  handStamps: HandStamp[] = []
  /** The world matrices of the last pose, and the yaw it was rendered at (relative to the camera). */
  world: M[] = []
  relativeYaw = 0
  pitch = 0
  private key = ''
  /** The hair's spring: its swing and how fast it swings, integrated every update, sampled at each pose step. */
  private hairState = { pitch: 0, roll: 0, vPitch: 0, vRoll: 0 }
  private lastShown: number | null = null
  constructor(member: CastMember, outfit?: string) {
    this.member = member
    this.skeleton = skeleton(this.member.genes)
    this.cell = this.member.cell
    this.metres = this.member.metres
    this.feet = this.member.feet
    this.outfit = outfit ?? this.member.defaultOutfit
    this.built = build(this.member, this.skeleton, this.outfit, null)
    this.g = gbuffer(this.cell[0], this.cell[1])
    this.hi = gbuffer(this.cell[0] * this.style.supersample, this.cell[1] * this.style.supersample)
    this.gL = gbuffer(this.cell[0], this.cell[1])
    this.hiL = gbuffer(this.hi.w, this.hi.h)
    this.painted = new Uint8ClampedArray(this.cell[0] * this.cell[1] * 4)
    this.normals = new Uint8ClampedArray(this.painted.length)
    this.depth = new Float32Array(this.cell[0] * this.cell[1]).fill(-Infinity)
  }
  /** Swaps the outfit or the held item (rebuilds the part list once). */
  wear(outfit: string, item: string | null = this.item) {
    if (outfit === this.outfit && item === this.item) return
    if (!this.member.outfits[outfit]) throw new Error(`${this.member.id} has no outfit ${outfit}`)
    this.outfit = outfit
    this.item = item
    this.built = build(this.member, this.skeleton, outfit, item)
    this.key = ''
  }
  /** The motion state at the current stepped clock (public for tests and sheets). */
  motion(
    input: FigureInput,
    steppedT: number,
    phase: number,
    shownYaw: number,
    relative = 0,
    beat = steppedT,
  ): MotionState {
    const gait = this.member.gait
    // The sprite cheat for profiles: the head turns a little toward the camera, unless the figure faces away.
    // And the three-quarter cheat: a head at 45° turns a further THREE_Q toward the camera, fading to none square on and
    // in profile, so the far eye clears the far contour (a true 45° head leaves it two texels of face, where it reads as
    // part of the outline) while a profile stays a profile.
    const a = Math.abs(relative),
      threeQ = a <= Math.PI / 2 ? THREE_Q * Math.sin(2 * a) : 0
    const toCamera =
      Math.abs(relative) < Math.PI * 0.7 ? -relative * this.member.faceTurn - Math.sign(relative) * threeQ : 0
    // The head's lead in 30° steps (a sprite's head turn is a few frames): a turn is a short, fixed set of cells.
    // (the profile's turn toward the camera stays exact: it is one value per view, so it adds no cells).
    const lead = Math.max(
      -gait.headLead,
      Math.min(
        gait.headLead,
        Math.round(wrapAngle(input.facing - shownYaw) / HEAD_STEP) * HEAD_STEP + toCamera,
      ),
    )
    const turning = Math.abs(wrapAngle(input.facing - shownYaw)) > 1e-3
    return {
      t: steppedT,
      moving: input.moving,
      lookUp: this.member.faceCamera * input.view.pitch,
      pitch: input.view.pitch,
      phase,
      yaw: 0,
      headYaw: lead,
      shuffle:
        turning && !input.moving && gait.shuffle !== false ? (Math.floor(beat * gait.poseRate) % 4) / 4 : 0,
      action: input.action
        ? { id: input.action.id, t: input.action.t, side: this.member.hand === 'R' ? 'L' : 'R' }
        : null,
      hold: this.item ? ITEMS[this.item].hold(this.skeleton, this.member.hand) : null,
      hair: { pitch: this.hairPose.pitch, roll: this.hairPose.roll },
      clear: this.built.clear,
    }
  }
  /** Advances the clock; returns true when the frame must be re-rasterised. */
  update(dt: number, input: FigureInput): boolean {
    const gait = this.member.gait
    if (input.clock === undefined) this.time += dt
    else this.time = input.clock
    if (input.moving) this.phase = (this.phase + dt / gait.cycle) % 1
    const rate = input.moving ? gait.walkPoses / gait.cycle : gait.poseRate
    const step = Math.floor(this.time * rate)
    if (this.shown === null || input.pose) this.shown = input.facing
    // Turn toward the wanted facing one step at a time; the steps land on the 8 directions.
    if (step !== this.step) {
      const diff = wrapAngle(input.facing - this.shown)
      this.shown =
        Math.abs(diff) <= gait.turnRate ? input.facing : this.shown + Math.sign(diff) * gait.turnRate
      this.step = step
    }
    this.swingHair(dt, input)
    // The pose clock. Idle loops (the gait's idleLoop, or the breath alone), so idle poses repeat and come from the cell
    // cache; the blink keeps the true time.
    // An idle with `idlePoses` holds that many poses across its loop, as a pixel artist's idle is a few frames, not twelve
    // a second; so an idle is a short, fixed set of cells.
    const { steppedT, faceT } = this.clockAt(this.time)
    const phase = Math.floor(this.phase * gait.walkPoses) / gait.walkPoses
    const { rel, pitch } = this.snap(this.shown, input.view)
    const faceState = this.face(input, faceT)
    // While an action plays or the figure turns on the spot the idle holds still, so a reach or a turn is one strip of
    // cells, not one per breath (the shuffle keeps its own beat).
    const still = !!input.action || (!input.moving && Math.abs(wrapAngle(input.facing - this.shown)) > 1e-3),
      idleT = still ? 0 : steppedT
    const shownKey = [
      this.outfit,
      this.item,
      rel.toFixed(4),
      pitch.toFixed(4),
      input.pose ? `p${input.pose.key}` : input.moving ? `w${phase}` : `i${idleT}`,
      input.action ? `${input.action.id}${Math.floor(input.action.t * gait.poseRate)}` : '-',
      [...faceState.tags].join('+'),
      faceState.blink,
    ].join('|')
    // The hair's swing is sampled once per pose (as the body is), to a tenth of a radian, so a cached cell is exact.
    if (shownKey !== this.shownKey) {
      this.shownKey = shownKey
      this.hairPose = {
        pitch: Math.round(this.hairState.pitch * 10) / 10,
        roll: Math.round(this.hairState.roll * 10) / 10,
      }
    }
    const st = this.motion(input, idleT, phase, this.shown, rel, faceT)
    const key = [shownKey, st.headYaw.toFixed(3), st.shuffle, this.hairPose.pitch, this.hairPose.roll].join(
      '|',
    )
    if (key === this.key && !this.light) return false
    this.key = key
    this.relativeYaw = rel
    this.pitch = pitch
    const hit = this.cache && !this.light ? this.cells.get(key) : undefined
    if (hit) {
      // A cell drawn before: its colours, normal map, joints (the flame's socket) and face, with no raster.
      const o = hit.y0 * this.cell[0] * 4
      this.painted.fill(0)
      this.normals.fill(0)
      this.painted.set(hit.painted, o)
      this.normals.set(hit.normals, o)
      this.depth.fill(-Infinity)
      this.depth.set(hit.depth, o / 4)
      if (hit.weave && this.built.cloth) {
        this.weaveBuf ??= newWeave(this.cell[0] * this.cell[1])
        const wv = this.weaveBuf,
          t = o / 4
        wv.ground.fill(0)
        wv.labels.fill(0)
        wv.on.fill(0)
        wv.depths.length = 0
        wv.depths.push(...hit.weave.depths)
        wv.ground.set(hit.weave.ground, o)
        wv.labels.set(hit.weave.labels, t)
        wv.on.set(hit.weave.on, t)
      }
      this.world = hit.world
      this.faceStamp = hit.face
      this.cells.delete(key)
      this.cells.set(key, hit)
      return true
    }
    st.yaw = rel
    this.world = input.pose
      ? fk(this.skeleton, { ...input.pose.pose, yaw: rel + input.pose.pose.yaw })
      : evaluate(this.skeleton, gait, st).world
    this.raster(pitch, faceState)
    if (this.cache && !this.light) {
      const row = this.cell[0] * 4
      let y0 = 0,
        y1 = this.cell[1]
      const empty = (y: number) => {
        for (let i = y * row + 3; i < (y + 1) * row; i += 4) if (this.painted[i]) return false
        return true
      }
      while (y0 < y1 && empty(y0)) y0++
      while (y1 > y0 && empty(y1 - 1)) y1--
      const wv = this.weave,
        a = y0 * this.cell[0],
        b = y1 * this.cell[0]
      const weave = wv
        ? {
            ground: wv.ground.slice(a * 4, b * 4),
            labels: wv.labels.slice(a, b),
            on: wv.on.slice(a, b),
            depths: wv.depths.slice(),
          }
        : null
      this.cells.set(key, {
        y0,
        painted: this.painted.slice(y0 * row, y1 * row),
        normals: this.normals.slice(y0 * row, y1 * row),
        depth: this.depth.slice(a, b),
        weave,
        world: this.world,
        face: this.faceStamp,
      })
      if (this.cells.size > CELLS) this.cells.delete(this.cells.keys().next().value!)
    }
    return true
  }
  /** The idle's stepped time at clock `time` (looped, held to its few poses), and the face's (stepped, unlooped). */
  clockAt(time: number): { steppedT: number; faceT: number } {
    const gait = this.member.gait
    const loopS = gait.idleLoop ?? (gait.shift === 0 && !gait.twitch ? gait.breathPeriod : 0)
    const stepIndex = Math.floor(time * gait.poseRate),
      loop = Math.round(loopS * gait.poseRate),
      faceT = stepIndex / gait.poseRate
    const held = loopS > 0 && gait.idlePoses ? loopS / gait.idlePoses : 0
    const steppedT = held
      ? (Math.floor(time / held) % gait.idlePoses!) * held
      : (loop > 0 ? stepIndex % loop : stepIndex) / gait.poseRate
    return { steppedT, faceT }
  }
  /**
   * The view a figure facing `facing` is drawn at: its bearing from the camera (rel), snapped to the 8 directions, and
   * the camera's pitch snapped to the nearest 2°, so a figure is always one of a finite set of cells, as a sprite set is.
   */
  snap(facing: number, view: View): { rel: number; pitch: number } {
    let rel = wrapAngle(facing - view.azimuth)
    rel = Math.round(rel / (Math.PI / 4)) * (Math.PI / 4)
    const pitch = Math.round(view.pitch / (Math.PI / 90)) * (Math.PI / 90)
    return { rel, pitch }
  }
  /** The limbs' joints at rest, for the painter to model each bone's segment (paint Bends). */
  private bends(): Bends {
    const r = this.skeleton.rest,
      b: Bends = {}
    for (const s of ['L', 'R'] as const) {
      b[s === 'L' ? GROUP.armL : GROUP.armR] = [
        r[J[`upperArm.${s}`]][1],
        r[J[`foreArm.${s}`]][1],
        r[J[`hand.${s}`]][1],
      ]
      b[s === 'L' ? GROUP.legL : GROUP.legR] = [
        r[J[`thigh.${s}`]][1],
        r[J[`shin.${s}`]][1],
        r[J[`foot.${s}`]][1],
      ]
    }
    return b
  }
  /**
   * The last raster's cloth coordinates (metres) at cell texel `k`: `u` round the texel's group and `v` down the body. Null
   * when no fabric is in use, where nothing is drawn, or on an untiled group (the head, a held item). The cell cache skips
   * the raster, so read this with `cache = false`. A fork's checks and the mapping tests read labels from it.
   */
  clothAt(k: number): [u: number, v: number] | null {
    if (!this.built.cloth || !this.gC || this.g.part[k] < 0) return null
    const u = clothU(this.built.frame!, this.g.group[k], this.gC.place[k * 3], this.gC.place[k * 3 + 1])
    return u === null ? null : [u, this.gC.place[k * 3 + 2]]
  }
  /** One scratch copy of the soup's vertices, shared by the light pass and the cloth pass (each is rasterised before the next
   * is filled), grown when a figure needs more. */
  private scratch = new Float32Array(0)
  private scratchOf(soup: Soup): Float32Array {
    const n = soup.count * VERT
    if (this.scratch.length < n) this.scratch = new Float32Array(n)
    this.scratch.set(soup.verts.subarray(0, n))
    return this.scratch
  }
  /** Draws the current pose: the triangle soup, the G-buffer and its cleanup, the marks, and the painter's cell. */
  private raster(pitch: number, faceState: FaceState) {
    const S = this.style.supersample
    if (this.hi.w !== this.cell[0] * S) this.hi = gbuffer(this.cell[0] * S, this.cell[1] * S)
    const light = this.light ?? undefined
    if (light && this.lightOut.length < this.built.vertexCount * 3)
      this.lightOut = new Float32Array(this.built.vertexCount * 3)
    const { soup, decals } = soupOf(
      this.built,
      this.skeleton,
      this.world,
      pitch,
      this.cell,
      this.metres,
      this.feet,
      this.soup,
      S,
      faceState,
      light,
      this.lightOut,
    )
    this.soup = soup
    // The neck's ids in the G-buffer (`seam ?? index`, as soupOf writes them), for the neckline rule: from the built parts
    // each raster, so a new outfit's rebuild never leaves them stale.
    const necks = new Set<number>(this.built.parts.flatMap((p, i) => (p.tag === NECK ? [p.seam ?? i] : [])))
    const cleaned = (g: GBuffer) => {
      if (this.style.cleanup) {
        cleanup(g)
        blendJoins(g)
        smoothContour(g)
        neckline(g, necks)
      }
    }
    rasterize(soup, this.hi)
    resolve(this.hi, this.g, S, this.style)
    cleaned(this.g)
    if (light) {
      // A second raster of the same triangles with the light in the place slots (6–8): the resolve averages it like a
      // place. The cleanup reads only part, group, material and depth, so gL follows g texel for texel.
      if (this.hiL.w !== this.hi.w) this.hiL = gbuffer(this.hi.w, this.hi.h)
      const verts = this.scratchOf(soup)
      for (let v = 0; v < soup.count; v++)
        for (let i = 0; i < 3; i++) verts[v * VERT + 6 + i] = this.lightOut[v * 3 + i]
      rasterize({ ...soup, verts }, this.hiL)
      resolve(this.hiL, this.gL, S, this.style)
      cleaned(this.gL)
    }
    // With a fabric in use (H5): a third raster of the same triangles with each vertex's cloth slots in the place slots,
    // resolved and cleaned as gL is, so gC follows g texel for texel.
    const cloth = this.built.cloth
    if (cloth) {
      // Allocated on first use: a figure with no fabric never holds the two buffers.
      this.gC ??= gbuffer(this.cell[0], this.cell[1])
      if (!this.hiC || this.hiC.w !== this.hi.w) this.hiC = gbuffer(this.hi.w, this.hi.h)
      const verts = this.scratchOf(soup)
      for (let v = 0; v < soup.count; v++)
        for (let i = 0; i < 3; i++) verts[v * VERT + 6 + i] = cloth[v * 3 + i]
      rasterize({ ...soup, verts }, this.hiC)
      resolve(this.hiC, this.gC, S, this.style)
      cleaned(this.gC)
    }
    // A print on a surface before the marks (they find its surface by its part), one hung over it (a pendant) after,
    // over every mark on the cloth behind it.
    for (const d of decals) if (d.print?.seams) stampPrint(d, this.g)
    stamp(
      decals.filter((d) => !d.print),
      this.g,
      this.metres / this.cell[1],
      [GROUP.item],
    )
    for (const d of decals) if (d.print && !d.print.seams) stampPrint(d, this.g)
    this.faceStamp = this.member.drawnFace ? this.faceAt(pitch, faceState.blink, faceState.tags) : null
    this.handStamps = this.handsAt(pitch)
    if (cloth) this.weaveBuf ??= newWeave(this.cell[0] * this.cell[1])
    paint(
      this.g,
      this.built.materials,
      this.painted,
      this.normals,
      this.faceStamp,
      this.paintStyle,
      this.built.materialIndex.get(this.member.skin) ?? -1,
      this.handStamps,
      this.bends(),
      light && this.gL.place,
      cloth ? { place: this.gC!.place, u: (g, c, sn) => clothU(this.built.frame!, g, c, sn) } : undefined,
      cloth ? this.weaveBuf! : undefined,
    )
    this.fillDepth()
  }
  /** `depth` from the G-buffer and the painted cell: a surface texel keeps its depth; an opaque texel with none (the outline
   * ring, drawn beside the surface) takes the nearest depth among its neighbours, widening a ring at a time until a surface
   * is found (the outline's width grows with the density, so no fixed radius would do); an empty one is −Infinity. The root's
   * plane (0) is only for a cell with no surface at all. */
  private fillDepth() {
    const [w, h] = this.cell,
      z = this.g.depth,
      px = this.painted,
      out = this.depth,
      reach = Math.max(w, h)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const k = y * w + x
        if (!px[k * 4 + 3]) {
          out[k] = -Infinity
          continue
        }
        if (z[k] > -Infinity) {
          out[k] = z[k]
          continue
        }
        let best = -Infinity
        for (let r = 1; r <= reach && best === -Infinity; r++)
          for (let dy = -r; dy <= r; dy++)
            for (let dx = -r; dx <= r; dx++) {
              if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
              const X = x + dx,
                Y = y + dy
              if (X >= 0 && X < w && Y >= 0 && Y < h && z[Y * w + X] > best) best = z[Y * w + X]
            }
        out[k] = best > -Infinity ? best : 0
      }
  }
  /**
   * The hair's spring (secondary motion; the character file's `hair`): it trails behind as the figure walks, bounces with
   * each step, lags through a turn, and hangs against the head's tilt. Semi-implicit Euler in fixed 1/120 s substeps, so it
   * is the same whatever the frame rate.
   */
  private swingHair(dt: number, input: FigureInput) {
    const hp = this.member.hair,
      h = this.hairState,
      gait = this.member.gait
    const shown = this.shown ?? input.facing,
      yawRate = this.lastShown === null || dt <= 0 ? 0 : wrapAngle(shown - this.lastShown) / dt
    this.lastShown = shown
    // The hair hangs plumb against the head's pitch (the last pose's: its nod and its tip back toward the camera), as it
    // does against its tilt, so a tail falls down the back rather than swinging out behind with the face.
    const head = this.world[J.head],
      fwd = [Math.sin(this.relativeYaw), Math.cos(this.relativeYaw)]
    const nod = head ? Math.atan2(head[1] * fwd[0] + head[7] * fwd[1], head[4]) : 0
    const pitchTarget =
      (input.moving ? (hp.trail * gait.speed) / 3 + hp.bounce * Math.cos(4 * Math.PI * this.phase) : 0) -
      nod * hp.hang
    const rollTarget =
      Math.max(-0.6, Math.min(0.6, -hp.sway * yawRate * 0.05)) - this.member.genes.headTilt * hp.hang
    for (let left = dt; left > 1e-9; left -= 1 / 120) {
      const step = Math.min(left, 1 / 120)
      h.vPitch += (hp.stiff * (pitchTarget - h.pitch) - hp.damp * h.vPitch) * step
      h.pitch += h.vPitch * step
      h.vRoll += (hp.stiff * (rollTarget - h.roll) - hp.damp * h.vRoll) * step
      h.roll += h.vRoll * step
    }
  }
  /** The face this pose: its expression, a blink every `blink` seconds (one pose long), the mouth flapping in 'talk'. */
  private face(input: FigureInput, t: number): FaceState {
    const expression = input.expression ?? 'neutral',
      every = this.member.blink,
      rate = this.member.gait.poseRate
    // Half a period in, so a figure does not open on a blink.
    const blink = every > 0 && (t + every / 2) % every < 1.5 / rate
    const tags = new Set<string>([expression, ...(input.mood ?? [])])
    if (tags.has('talk') && Math.floor(t * 6) % 2 === 0) tags.add('mouthOpen')
    return { tags, blink }
  }
  /**
   * Where the drawn face goes this pose: the eye row's centre on the face, projected into the cell, and which template
   * the head's yaw toward the camera picks (0 front … ±2 profile; past that the face is turned away).
   */
  private faceAt(pitch: number, blink: boolean, mood: Set<string> = new Set()): FaceStamp | null {
    const skin = this.built.materialIndex.get(this.member.skin)
    if (skin === undefined) return null
    const g = this.skeleton.genes,
      m = this.world[J.head],
      [w, h] = this.cell,
      ppm = h / this.metres,
      cp = Math.cos(pitch),
      sp = Math.sin(pitch)
    const hw = (g.head * g.headWidth) / 2,
      hd = (g.head * g.headDepth) / 2,
      H = g.head,
      z = (u: number) => hd * (g.faceAhead + u)
    // Head space (garments.ts head) into the cell's texels.
    const at = (p: V3): [number, number] => {
      const q = apply(m, p)
      return [w / 2 + q[0] * ppm, h - this.feet - (q[1] * cp - q[2] * sp) * ppm]
    }
    // The drawn eyes' set (eyeSpacing; exactly 0.42 at 0.5). The undrawn face's decals (garments.ts face) and the gaze keep 0.42.
    const ex = hw * (0.42 + 0.08 * (this.built.face.shape.eyeSpacing - 0.5) * 2),
      D = Math.round(ppm / (96 / 2.6))
    const eyes = [at([ex, H * 0.45, z(0.88)]), at([-ex, H * 0.45, z(0.88)])].sort((a, b) => a[0] - b[0]) as [
      [number, number],
      [number, number],
    ]
    const yaw = Math.atan2(m[2], m[8]),
      detail = eyeWidth(hw * ppm, ppm)
    // The head's frame in the cell: its origin (texels, and depth), and the turn from the view's axes (x right, y up,
    // toward the camera: in the figure's space (1,0,0), (0,cp,−sp), (0,sp,cp)) into the head's own.
    const view = [
        [1, 0, 0],
        [0, cp, -sp],
        [0, sp, cp],
      ],
      R: number[] = []
    for (let i = 0; i < 3; i++)
      for (let k = 0; k < 3; k++) R.push(m[i] * view[k][0] + m[3 + i] * view[k][1] + m[6 + i] * view[k][2])
    return {
      // The eyes one size on every face, whatever the figure's height: the cell's density sizes them, capped by the face's width.
      view: Math.round(yaw / (Math.PI / 4)),
      size: hw * ppm,
      detail,
      eye:
        D >= 2
          ? Math.max(2, detail + Math.round((this.built.face.shape.eyeSize - 0.5) * 2) * (D >= 4 ? 2 : 1))
          : detail,
      centre: at([0, H * 0.45, z(1)]),
      eyes,
      nose: at([0, H * 0.23, z(1.06)]),
      mouth: at([0, H * 0.17, z(1)]),
      frame: {
        o: [w / 2 + m[9] * ppm, h - this.feet - (m[10] * cp - m[11] * sp) * ppm, m[10] * sp + m[11] * cp],
        ppm,
        R,
        head: [hw, H, hd, g.faceAhead],
      },
      skin,
      ...this.built.face,
      blink,
      mood,
    }
  }
  /**
   * Where each hand goes this pose (paint.ts HandStamp): its wrist and fingertips projected into the cell, its widths
   * across the axis there (the cross-section's breadth and thickness as the view sees them), which side the thumb is on,
   * the back of the hand's normal, and whether it hangs.
   */
  private handsAt(pitch: number): HandStamp[] {
    const [w, h] = this.cell,
      ppm = h / this.metres,
      cp = Math.cos(pitch),
      sp = Math.sin(pitch),
      out: HandStamp[] = []
    for (const s of this.built.hands) {
      const m = this.world[J[`hand.${s.side}`]],
        material = this.built.materialIndex.get(s.material)
      if (!m || material === undefined) continue
      const at = (p: V3): [number, number, number] => {
        const q = apply(m, p)
        return [w / 2 + q[0] * ppm, h - this.feet - (q[1] * cp - q[2] * sp) * ppm, q[1] * sp + q[2] * cp]
      }
      const view = (d: V3): V3 => {
        const q = applyDir(m, d)
        return [q[0], q[1] * cp - q[2] * sp, q[1] * sp + q[2] * cp]
      }
      const wrist = at([s.c[0], 0, s.c[1]]),
        tip = at([s.c[0], -s.len, s.c[1]]),
        axis = view([0, -1, 0])
      // The axis on screen (y down), and across it; a hand pointing at the camera keeps its axis's own lean.
      let ax = tip[0] - wrist[0],
        ay = tip[1] - wrist[1]
      if (Math.hypot(ax, ay) < 0.5) {
        ax = axis[0]
        ay = -axis[1]
      }
      const al = Math.hypot(ax, ay) || 1,
        a: [number, number] = [ax / al, ay / al],
        p: [number, number] = [-a[1], a[0]]
      const vb = view([s.across[0], 0, s.across[1]]),
        vt = view([s.back[0], 0, s.back[1]])
      const across = (b: number, t: number) =>
        ppm * Math.hypot(b * (vb[0] * p[0] - vb[1] * p[1]), t * (vt[0] * p[0] - vt[1] * p[1]))
      const side = vb[0] * p[0] - vb[1] * p[1] >= 0 ? 1 : -1
      out.push({
        group: s.group,
        material,
        wrist,
        tip,
        axis,
        half: [across(s.wrist, s.thick[0]), across(s.breadth, s.thick[1])],
        front: s.breadth * Math.abs(vb[2]) + s.thick[1] * Math.abs(vt[2]),
        thumb: [p[0] * side, p[1] * side],
        thumbAt: s.thumb,
        thumbFacing: vb[2],
        back: vt,
        hangs: applyDir(m, [0, -1, 0])[1] < -0.75,
      })
    }
    return out
  }
}
/** Cells the cache keeps: a walk in 8 views is 48–64, an idle 64–96, a turn's and an orbit's steps the rest. */
const CELLS = 384
/** An eye's drawn width (m; paint.ts FaceStamp.eye): two texels at the brand kit's density, four at twice it (a JRPG
 * sprite's eye, with a two-texel iris). */
const EYE = 0.05
/** The widest an eye may be, as a fraction of the head's half-width: a little over half of it, so the two eyes and the
 * bridge between them leave the face its cheeks. The base pair's heads (half-width of 8 or more texels at density 2) never
 * reach it, so the cap changes nothing for them; a small head (the `head` slider low) gets a narrower eye in place of one
 * that covers a third of its face. */
const EYE_OF_FACE = 0.52
/** An eye's drawn width (texels; paint.ts FaceStamp.eye) on a head of the given half-width (texels) at `ppm` pixels per
 * metre: the density's own size (`EYE`), capped at `EYE_OF_FACE` of the half-width, and never under one texel. */
export const eyeWidth = (halfWidth: number, ppm: number): number =>
  Math.max(1, Math.min(Math.round(EYE * ppm), Math.round(EYE_OF_FACE * halfWidth)))
/** The head's lead step. */
const HEAD_STEP = Math.PI / 6
/** The three-quarter view's head turn toward the camera (rad), at 45° from it (motion: toCamera). */
const THREE_Q = 0.2
