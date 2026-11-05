import { J, fk, skeleton, type Pose, type Side, type Skeleton } from '../body/rig';
import { evaluate, type ActionId, type MotionState } from '../motion/motion';
import { apply, applyDir, wrapAngle, type M, type V3 } from '../../lib/math';
import type { CastMember } from './cast';
import { ITEMS } from '../outfit/items';
import { blendJoins, cleanup, gbuffer, rasterize, resolve, smoothContour, stamp, STYLE, TRI, VERT, type GBuffer, type Soup, type Style, type ViewDecal } from '../paint/raster';
import { boneGroups, GROUP, type Decal, type Material, type Part } from '../body/parts';
import type { Expression, FaceLook } from '../outfit/garments';
import { DEFAULT_HEAD } from '../body/genes';
import { densityOf, paint, PAINT, duel, eyeWhite, familyTones, tonesOf, type Bends, type FaceStamp, type HandStamp, type PaintStyle } from '../paint/paint';
/**
 * A procedural figure at run time: the stepped pose clock, the snap to 8 directions, the hair's spring, the triangle
 * soup, the G-buffer and the painter's cell with its normal map (which the lighting feature lights), each pose's cell
 * kept in a cache. Drawn by the review frames (frames.ts) and by the scriptable actors (actor.ts), whose made
 * poses it draws through `update({ pose })`.
 */
export interface View {
  /** The camera's azimuth around the figure (rad; 0 when it stands on +z of the figure), and its pitch down (rad). The
   * figure is drawn at the nearest of the 8 directions to it, and the pitch to the nearest 2°. */
  azimuth: number; pitch: number;
}
export interface Built { parts: Part[]; decals: Decal[]; materials: Material[]; materialIndex: Map<string, number>; vertexCount: number; triangleCount: number; face: DrawnFace; groups: Map<number, number>; clear?: [number, number]; hands: HandShape[] }
/**
 * A hand's measures in its own bone's space (x the figure's left, y up the bone, z forward), from the parts the hand
 * bone carries (garments.ts hands): so the hand stamp (paint.ts HandStamp) is sized from the hand the figure wears.
 */
interface HandShape {
  side: Side; group: number; material: string;
  /** Wrist to fingertips (m), and the centre line's place across the bone (x, z). */
  len: number; c: [number, number];
  /** The breadth's axis across the bone (x, z: toward the thumb), the half-breadth at the wrist and at the knuckles,
   * and the half-thickness there; the back of the hand's side along the thickness axis (x, z). */
  across: [number, number]; wrist: number; breadth: number; thick: [number, number]; back: [number, number];
  /** The thumb's span down the hand (fractions of `len`). */
  thumb: [number, number];
}
/** The hand bones' parts as measures (HandShape): the palm and fingers together, the thumb (a surface of its own) apart. */
function handShapes(parts: Part[]): HandShape[] {
  const out: HandShape[] = [];
  for (const side of ['L', 'R'] as const) {
    const mine = parts.filter(p => p.bone === J[`hand.${side}`] && p.group !== GROUP.item);
    if (!mine.length) continue;
    const seam = mine[0].seam, thumb = mine.filter(p => p.seam !== seam), hand = mine.filter(p => p.seam === seam);
    const pts = (ps: Part[]) => ps.flatMap(p => { const v: V3[] = []; for (let i = 0; i < p.mesh.positions.length; i += 3) v.push([p.mesh.positions[i], p.mesh.positions[i + 1], p.mesh.positions[i + 2]]); return v; });
    const P = pts(hand), T = pts(thumb);
    const len = -Math.min(...P.map(v => v[1])), cx = P.reduce((s, v) => s + v[0], 0) / P.length, cz = P.reduce((s, v) => s + v[2], 0) / P.length;
    // The breadth runs along the cross-section's long axis (its xz spread's first principal axis), toward the thumb.
    let xx = 0, zz = 0, xz = 0;
    for (const v of P) { const a = v[0] - cx, b = v[2] - cz; xx += a * a; zz += b * b; xz += a * b; }
    const ang = 0.5 * Math.atan2(2 * xz, xx - zz);
    let across: [number, number] = [Math.cos(ang), Math.sin(ang)];
    const tc = T.length ? [T.reduce((s, v) => s + v[0], 0) / T.length - cx, T.reduce((s, v) => s + v[2], 0) / T.length - cz] : [0, 1];
    if (across[0] * tc[0] + across[1] * tc[1] < 0) across = [-across[0], -across[1]];
    const thickAxis: [number, number] = [-across[1], across[0]];
    const ext = (lo: number, hi: number, ax: [number, number]) => Math.max(...P.filter(v => -v[1] >= lo * len && -v[1] <= hi * len).map(v => Math.abs((v[0] - cx) * ax[0] + (v[2] - cz) * ax[1])));
    // The back of the hand faces out from the body (the palm to the thigh): +x on the left hand.
    const out1 = side === 'L' ? 1 : -1, back: [number, number] = thickAxis[0] * out1 >= 0 ? thickAxis : [-thickAxis[0], -thickAxis[1]];
    const ty = T.map(v => -v[1] / len);
    out.push({
      side, group: mine[0].group, material: mine[0].material, len, c: [cx, cz], across,
      wrist: ext(0, 0.15, across), breadth: ext(0.4, 0.7, across), thick: [ext(0, 0.15, thickAxis), ext(0.4, 0.7, thickAxis)], back,
      thumb: ty.length ? [Math.min(...ty), Math.max(...ty)] : [0.2, 0.6],
    });
  }
  return out;
}
/** Builds the part list of a cast member in an outfit, holding an item, once per change. */
export function build(member: CastMember, s: Skeleton, outfit: string, item: string | null): Built {
  const look = member.outfits[outfit](s, member.cell[1] / member.metres);
  // A drawn face replaces the face's marks (garments.ts face).
  const parts = [...look.parts], decals = look.decals.filter(d => !member.drawnFace || d.tag !== 'face');
  if (item) parts.push(...ITEMS[item].parts(J[`socket.${member.hand}`]));
  const names = [...new Set([...parts.map(p => p.material), ...decals.map(d => d.material)])];
  const own = { ...member.materials, ...look.materials };
  const materials = names.map(n => { const m = own[n]; if (!m) throw new Error(`${member.id}: no material ${n}`); return m; });
  const materialIndex = new Map(names.map((n, i) => [n, i]));
  const vertexCount = parts.reduce((n, p) => n + p.mesh.positions.length / 3, 0), triangleCount = parts.reduce((n, p) => n + p.mesh.indices.length / 3, 0);
  return { parts, decals, materials, materialIndex, vertexCount, triangleCount, face: drawnFace(member, look.face), groups: boneGroups(parts, [GROUP.item]), clear: look.clear, hands: handShapes(parts) };
}
/** The drawn face's structure and colours (paint.ts FaceStamp). */
type DrawnFace = Pick<FaceStamp, 'shape' | 'iris' | 'lash' | 'white' | 'brow' | 'lips'>;
/** From the outfit's swatches: the iris and lash the eyes' first two tones, the whites (dimmed to the skin, paint.ts
 * eyeWhite), the brow the brows' (the hair's) second tone, the lips' three; where the outfit names none, the skin's own
 * ramp gives the lips. Their near-blacks are their ramps' dark family (paint.ts darkOf), as the hair's are. */
function drawnFace(member: CastMember, look?: FaceLook): DrawnFace {
  const tones = (name?: string) => (name && member.materials[name] ? familyTones(tonesOf(member.materials[name])) : null);
  const eyes = tones(look?.eyes) ?? [duel(0x31222a), duel(0x1d1d21)], skin = tones(member.skin) ?? [0, 0, 0, 0], lips = tones(look?.lips) ?? [skin[2], skin[1], skin[3]];
  return {
    shape: look?.shape ?? DEFAULT_HEAD, iris: eyes[0], lash: eyes[1], white: eyeWhite(tones(look?.white)?.[0] ?? duel(0xeadbc9), skin[1]),
    brow: tones(look?.brows ?? 'brow')?.[1] ?? eyes[1], lips: [lips[0], lips[1], lips[2]],
  };
}
/** Projects the posed parts into the cell: orthographic along the camera's pitch, the root on the feet texel. */
function soupOf(built: Built, s: Skeleton, world: M[], pitch: number, cell: [number, number], metres: number, feet: number, soup?: Soup, scale = 1, face?: FaceState): { soup: Soup; decals: ViewDecal[] } {
  // `scale`: the supersampling factor; decals still come back in cell texels.
  const [w, h] = cell, ppm = h / metres * scale, cx = w / 2 * scale, cy = (h - feet) * scale;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const verts = soup && soup.verts.length >= built.vertexCount * VERT ? soup.verts : new Float32Array(built.vertexCount * VERT);
  const tris = soup && soup.tris.length >= built.triangleCount * TRI ? soup.tris : new Int32Array(built.triangleCount * TRI);
  // Skinning: a bone's world transform after undoing its rest position (rest rotations are the identity). Written out
  // by hand, with no per-vertex allocation: this loop runs over every vertex at each pose step.
  let vi = 0, ti = 0;
  // The surface's own place (its rest position, plus a per-part offset), so grain sticks to it as it moves.
  let sx = 0, sy = 0, sz = 0;
  const put = (px: number, py: number, pz: number, nx: number, ny: number, nz: number) => {
    const o = vi * VERT, l = Math.hypot(nx, ny, nz) || 1;
    verts[o + 6] = sx; verts[o + 7] = sy; verts[o + 8] = sz;
    verts[o] = cx + px * ppm; verts[o + 1] = cy - (py * cp - pz * sp) * ppm; verts[o + 2] = py * sp + pz * cp;
    verts[o + 3] = nx / l; verts[o + 4] = (ny * cp - nz * sp) / l; verts[o + 5] = (ny * sp + nz * cp) / l;
    return vi++;
  };
  for (let pi = 0; pi < built.parts.length; pi++) {
    const part = built.parts[pi], base = vi, pos = part.mesh.positions, nor = part.mesh.normals, mat = built.materialIndex.get(part.material)!;
    const seed = pi * 7.31;
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i], y = pos[i + 1], z = pos[i + 2], a = nor[i], b = nor[i + 1], c = nor[i + 2];
      sx = x + seed; sy = y; sz = z;
      if (part.bone !== undefined) {
        const m = world[part.bone];
        put(m[0] * x + m[1] * y + m[2] * z + m[9], m[3] * x + m[4] * y + m[5] * z + m[10], m[6] * x + m[7] * y + m[8] * z + m[11], m[0] * a + m[1] * b + m[2] * c, m[3] * a + m[4] * b + m[5] * c, m[6] * a + m[7] * b + m[8] * c);
      } else {
        let qx = 0, qy = 0, qz = 0, nx = 0, ny = 0, nz = 0;
        for (const [bone, wt] of part.skin![i / 3]) {
          if (!wt) continue;
          const m = world[bone], r = s.rest[bone], lx = x - r[0], ly = y - r[1], lz = z - r[2];
          qx += (m[0] * lx + m[1] * ly + m[2] * lz + m[9]) * wt; qy += (m[3] * lx + m[4] * ly + m[5] * lz + m[10]) * wt; qz += (m[6] * lx + m[7] * ly + m[8] * lz + m[11]) * wt;
          nx += (m[0] * a + m[1] * b + m[2] * c) * wt; ny += (m[3] * a + m[4] * b + m[5] * c) * wt; nz += (m[6] * a + m[7] * b + m[8] * c) * wt;
        }
        put(qx, qy, qz, nx, ny, nz);
      }
    }
    // A closed part's triangles that face away are hidden by its own front: skip them (open skirts and capes keep both
    // sides, so their insides show).
    const idx = part.mesh.indices, closed = part.skin === undefined;
    for (let i = 0; i < idx.length; i += 3) {
      const v0 = base + idx[i], v1 = base + idx[i + 1], v2 = base + idx[i + 2];
      if (closed && verts[v0 * VERT + 5] < -0.05 && verts[v1 * VERT + 5] < -0.05 && verts[v2 * VERT + 5] < -0.05) continue;
      const o = ti * TRI; tris[o] = v0; tris[o + 1] = v1; tris[o + 2] = v2; tris[o + 3] = mat; tris[o + 4] = part.group; tris[o + 5] = part.seam ?? pi; ti++;
    }
  }
  const D = densityOf(w), dense = (d: Decal) => !d.density || (D >= d.density[0] && D <= d.density[1]);
  const shown = (d: Decal) => dense(d) && (!face || ((!d.when || d.when.some(t => face.tags.has(t))) && (d.blink === undefined || d.blink === face.blink)));
  const decals: ViewDecal[] = built.decals.filter(shown).map(d => {
    const p = apply(world[d.bone], d.at), n = applyDir(world[d.bone], d.normal), nl = Math.hypot(...n) || 1;
    const y = p[1] * cp - p[2] * sp, z = p[1] * sp + p[2] * cp;
    return { x: (cx + p[0] * ppm) / scale, y: (cy - y * ppm) / scale, z, facing: (n[1] * sp + n[2] * cp) / nl, material: built.materialIndex.get(d.material)!, w: d.size?.[0] ?? 1, h: d.size?.[1] ?? 1, group: built.groups.get(d.bone) };
  });
  return { soup: { verts, count: vi, tris, triCount: ti }, decals };
}
export interface FigureInput {
  /** World facing (rad) the figure wants, and whether it walks. */
  facing: number; moving: boolean;
  view: View;
  /** An action playing, from its own start (s). */
  action?: { id: ActionId; t: number } | null;
  /** The face (garments.ts EXPRESSIONS): 'talk' opens and shuts the mouth. */
  expression?: Expression;
  /**
   * A pose made outside the figure's own motion (the actors' made poses, actor.ts): local to the figure (facing +z, root at
   * its feet), its `yaw` added to the facing. `key` names it for the cell cache, so the same key must mean the same
   * pose. The figure faces `facing` at once, with no turn steps.
   */
  pose?: { key: string; pose: Pose } | null;
  /**
   * The figure's clock (s), set from outside (a scripted actor's timeline, actors/actor.ts): its idle, blink and talk
   * are then a pure function of this time, not of the steps it was updated by. Left out, its own clock runs by `dt`.
   */
  clock?: number;
}
/** What the face shows this pose: the expression and its marks' tags, and whether the eyes are mid-blink. */
export interface FaceState { tags: Set<string>; blink: boolean }
/**
 * One figure: call `update` every frame with the time step and input; it re-rasterises only when the stepped pose or
 * the snapped view changes (`dirty`), and keeps each pose's painted cell and normal map for the next time it is shown.
 */
export class Figure {
  readonly member: CastMember; readonly skeleton: Skeleton;
  readonly cell: [number, number]; readonly metres: number; readonly feet: number;
  outfit: string; item: string | null = null;
  style: Style = { ...STYLE };
  /** Seconds since the figure was made, and the walk phase. */
  private time = 0; private phase = 0;
  /** The facing shown (it turns toward the wanted one a step at a time) and the last pose step. */
  private shown: number | null = null; private step = -1;
  private built: Built; private soup?: Soup;
  readonly g: GBuffer;
  /** The supersampled G-buffer the raster draws into, resolved into `g`. */
  private hi: GBuffer;
  /** The painter's output (paint.ts): the cell's colours and normal map; and its style. */
  readonly painted: Uint8ClampedArray; readonly normals: Uint8ClampedArray;
  paintStyle: PaintStyle = { ...PAINT };
  private faceStamp: FaceStamp | null = null;
  /** The cell cache (paint.ts cells by pose key, most recent last) and whether it is used; its cap is CELLS. */
  cache = true;
  /** Cells keep only the figure's own rows (y0 up to y0 + rows), most of a cell being empty. */
  private cells = new Map<string, { y0: number; painted: Uint8ClampedArray; normals: Uint8ClampedArray; world: M[]; face: FaceStamp | null }>();
  private shownKey = ''; private hairPose = { pitch: 0, roll: 0 };
  /** The hands the last raster drew (paint.ts HandStamp). */
  handStamps: HandStamp[] = [];
  /** The world matrices of the last pose, and the yaw it was rendered at (relative to the camera). */
  world: M[] = []; relativeYaw = 0; pitch = 0;
  private key = '';
  /** The hair's spring: its swing and how fast it swings, integrated every update, sampled at each pose step. */
  private hairState = { pitch: 0, roll: 0, vPitch: 0, vRoll: 0 }; private lastShown: number | null = null;
  constructor(member: CastMember, outfit?: string) {
    this.member = member;
    this.skeleton = skeleton(this.member.genes);
    this.cell = this.member.cell; this.metres = this.member.metres; this.feet = this.member.feet;
    this.outfit = outfit ?? this.member.defaultOutfit;
    this.built = build(this.member, this.skeleton, this.outfit, null);
    this.g = gbuffer(this.cell[0], this.cell[1]);
    this.hi = gbuffer(this.cell[0] * this.style.supersample, this.cell[1] * this.style.supersample);
    this.painted = new Uint8ClampedArray(this.cell[0] * this.cell[1] * 4); this.normals = new Uint8ClampedArray(this.painted.length);
  }
  /** Swaps the outfit or the held item (rebuilds the part list once). */
  wear(outfit: string, item: string | null = this.item) {
    if (outfit === this.outfit && item === this.item) return;
    if (!this.member.outfits[outfit]) throw new Error(`${this.member.id} has no outfit ${outfit}`);
    this.outfit = outfit; this.item = item; this.built = build(this.member, this.skeleton, outfit, item); this.key = '';
  }
  /** The motion state at the current stepped clock (public for tests and sheets). */
  motion(input: FigureInput, steppedT: number, phase: number, shownYaw: number, relative = 0, beat = steppedT): MotionState {
    const gait = this.member.gait;
    // The sprite cheat for profiles: the head turns a little toward the camera, unless the figure faces away.
    // And the three-quarter cheat: a head at 45° turns a further THREE_Q toward the camera, fading to none square on and
    // in profile, so the far eye clears the far contour (a true 45° head leaves it two texels of face, where it reads as
    // part of the outline) while a profile stays a profile.
    const a = Math.abs(relative), threeQ = a <= Math.PI / 2 ? THREE_Q * Math.sin(2 * a) : 0;
    const toCamera = Math.abs(relative) < Math.PI * 0.7 ? -relative * this.member.faceTurn - Math.sign(relative) * threeQ : 0;
    // The head's lead in 30° steps (a sprite's head turn is a few frames): a turn is a short, fixed set of cells.
    // (the profile's turn toward the camera stays exact: it is one value per view, so it adds no cells).
    const lead = Math.max(-gait.headLead, Math.min(gait.headLead, Math.round(wrapAngle(input.facing - shownYaw) / HEAD_STEP) * HEAD_STEP + toCamera));
    const turning = Math.abs(wrapAngle(input.facing - shownYaw)) > 1e-3;
    return {
      t: steppedT, moving: input.moving, lookUp: this.member.faceCamera * input.view.pitch, pitch: input.view.pitch, phase, yaw: 0, headYaw: lead, shuffle: turning && !input.moving ? (Math.floor(beat * gait.poseRate) % 4) / 4 : 0,
      action: input.action ? { id: input.action.id, t: input.action.t, side: this.member.hand === 'R' ? 'L' : 'R' } : null,
      hold: this.item ? ITEMS[this.item].hold(this.skeleton, this.member.hand) : null,
      hair: { pitch: this.hairPose.pitch, roll: this.hairPose.roll }, clear: this.built.clear,
    };
  }
  /** Advances the clock; returns true when the frame must be re-rasterised. */
  update(dt: number, input: FigureInput): boolean {
    const gait = this.member.gait;
    if (input.clock === undefined) this.time += dt; else this.time = input.clock;
    if (input.moving) this.phase = (this.phase + dt / gait.cycle) % 1;
    const rate = input.moving ? gait.walkPoses / gait.cycle : gait.poseRate;
    const step = Math.floor(this.time * rate);
    if (this.shown === null || input.pose) this.shown = input.facing;
    // Turn toward the wanted facing one step at a time; the steps land on the 8 directions.
    if (step !== this.step) {
      const diff = wrapAngle(input.facing - this.shown);
      this.shown = Math.abs(diff) <= gait.turnRate ? input.facing : this.shown + Math.sign(diff) * gait.turnRate;
      this.step = step;
    }
    this.swingHair(dt, input);
    // The pose clock. An idle of breath alone loops at the breath, so its poses repeat and come from the cell cache; the
    // blink keeps the true time.
    const { steppedT, faceT } = this.clockAt(this.time);
    const phase = Math.floor(this.phase * gait.walkPoses) / gait.walkPoses;
    const { rel, pitch } = this.snap(this.shown, input.view);
    const faceState = this.face(input, faceT);
    // While an action plays or the figure turns on the spot the idle holds still, so a reach or a turn is one strip of
    // cells, not one per breath (the shuffle keeps its own beat).
    const still = !!input.action || (!input.moving && Math.abs(wrapAngle(input.facing - this.shown)) > 1e-3), idleT = still ? 0 : steppedT;
    const shownKey = [this.outfit, this.item, rel.toFixed(4), pitch.toFixed(4), input.pose ? `p${input.pose.key}` : input.moving ? `w${phase}` : `i${idleT}`, input.action ? `${input.action.id}${Math.floor(input.action.t * gait.poseRate)}` : '-', [...faceState.tags].join('+'), faceState.blink].join('|');
    // The hair's swing is sampled once per pose (as the body is), to a tenth of a radian, so a cached cell is exact.
    if (shownKey !== this.shownKey) {
      this.shownKey = shownKey;
      this.hairPose = { pitch: Math.round(this.hairState.pitch * 10) / 10, roll: Math.round(this.hairState.roll * 10) / 10 };
    }
    const st = this.motion(input, idleT, phase, this.shown, rel, faceT);
    const key = [shownKey, st.headYaw.toFixed(3), st.shuffle, this.hairPose.pitch, this.hairPose.roll].join('|');
    if (key === this.key) return false;
    this.key = key; this.relativeYaw = rel; this.pitch = pitch;
    const hit = this.cache ? this.cells.get(key) : undefined;
    if (hit) {
      // A cell drawn before: its colours, normal map, joints (the flame's socket) and face, with no raster.
      const o = hit.y0 * this.cell[0] * 4;
      this.painted.fill(0); this.normals.fill(0); this.painted.set(hit.painted, o); this.normals.set(hit.normals, o);
      this.world = hit.world; this.faceStamp = hit.face;
      this.cells.delete(key); this.cells.set(key, hit);
      return true;
    }
    st.yaw = rel;
    this.world = input.pose ? fk(this.skeleton, { ...input.pose.pose, yaw: rel + input.pose.pose.yaw }) : evaluate(this.skeleton, gait, st).world;
    this.raster(pitch, faceState);
    if (this.cache) {
      const row = this.cell[0] * 4;
      let y0 = 0, y1 = this.cell[1];
      const empty = (y: number) => { for (let i = y * row + 3; i < (y + 1) * row; i += 4) if (this.painted[i]) return false; return true; };
      while (y0 < y1 && empty(y0)) y0++;
      while (y1 > y0 && empty(y1 - 1)) y1--;
      this.cells.set(key, { y0, painted: this.painted.slice(y0 * row, y1 * row), normals: this.normals.slice(y0 * row, y1 * row), world: this.world, face: this.faceStamp });
      if (this.cells.size > CELLS) this.cells.delete(this.cells.keys().next().value!);
    }
    return true;
  }
  /** The idle's stepped time at clock `time` (looped at the breath when the weight never shifts, so its poses repeat
   * and come from the cell cache), and the face's (stepped, unlooped). */
  clockAt(time: number): { steppedT: number; faceT: number } {
    const gait = this.member.gait;
    const loopS = gait.shift === 0 ? gait.breathPeriod : 0;
    const stepIndex = Math.floor(time * gait.poseRate), loop = Math.round(loopS * gait.poseRate), faceT = stepIndex / gait.poseRate;
    const steppedT = (loop > 0 ? stepIndex % loop : stepIndex) / gait.poseRate;
    return { steppedT, faceT };
  }
  /**
   * The view a figure facing `facing` is drawn at: its bearing from the camera (rel), snapped to the 8 directions, and
   * the camera's pitch snapped to the nearest 2°, so a figure is always one of a finite set of cells, as a sprite set is.
   */
  snap(facing: number, view: View): { rel: number; pitch: number } {
    let rel = wrapAngle(facing - view.azimuth);
    rel = Math.round(rel / (Math.PI / 4)) * (Math.PI / 4);
    const pitch = Math.round(view.pitch / (Math.PI / 90)) * (Math.PI / 90);
    return { rel, pitch };
  }
  /** The limbs' joints at rest, for the painter to model each bone's segment (paint Bends). */
  private bends(): Bends {
    const r = this.skeleton.rest, b: Bends = {};
    for (const s of ['L', 'R'] as const) {
      b[s === 'L' ? GROUP.armL : GROUP.armR] = [r[J[`upperArm.${s}`]][1], r[J[`foreArm.${s}`]][1], r[J[`hand.${s}`]][1]];
      b[s === 'L' ? GROUP.legL : GROUP.legR] = [r[J[`thigh.${s}`]][1], r[J[`shin.${s}`]][1], r[J[`foot.${s}`]][1]];
    }
    return b;
  }
  /** Draws the current pose: the triangle soup, the G-buffer and its cleanup, the marks, and the painter's cell. */
  private raster(pitch: number, faceState: FaceState) {
    const S = this.style.supersample;
    if (this.hi.w !== this.cell[0] * S) this.hi = gbuffer(this.cell[0] * S, this.cell[1] * S);
    const { soup, decals } = soupOf(this.built, this.skeleton, this.world, pitch, this.cell, this.metres, this.feet, this.soup, S, faceState);
    this.soup = soup;
    rasterize(soup, this.hi); resolve(this.hi, this.g, S, this.style);
    if (this.style.cleanup) { cleanup(this.g); blendJoins(this.g); smoothContour(this.g); }
    stamp(decals, this.g, this.metres / this.cell[1], [GROUP.item]);
    this.faceStamp = this.member.drawnFace ? this.faceAt(pitch, faceState.blink) : null;
    this.handStamps = this.handsAt(pitch);
    paint(this.g, this.built.materials, this.painted, this.normals, this.faceStamp, this.paintStyle, this.built.materialIndex.get(this.member.skin) ?? -1, this.handStamps, this.bends());
  }
  /**
   * The hair's spring (secondary motion; the character file's `hair`): it trails behind as the figure walks, bounces with
   * each step, lags through a turn, and hangs against the head's tilt. Semi-implicit Euler in fixed 1/120 s substeps, so it
   * is the same whatever the frame rate.
   */
  private swingHair(dt: number, input: FigureInput) {
    const hp = this.member.hair, h = this.hairState, gait = this.member.gait;
    const shown = this.shown ?? input.facing, yawRate = this.lastShown === null || dt <= 0 ? 0 : wrapAngle(shown - this.lastShown) / dt;
    this.lastShown = shown;
    // The hair hangs plumb against the head's pitch (the last pose's: its nod and its tip back toward the camera), as it
    // does against its tilt, so a tail falls down the back rather than swinging out behind with the face.
    const head = this.world[J.head], fwd = [Math.sin(this.relativeYaw), Math.cos(this.relativeYaw)];
    const nod = head ? Math.atan2(head[1] * fwd[0] + head[7] * fwd[1], head[4]) : 0;
    const pitchTarget = (input.moving ? hp.trail * gait.speed / 3 + hp.bounce * Math.cos(4 * Math.PI * this.phase) : 0) - nod * hp.hang;
    const rollTarget = Math.max(-0.6, Math.min(0.6, -hp.sway * yawRate * 0.05)) - this.member.genes.headTilt * hp.hang;
    for (let left = dt; left > 1e-9; left -= 1 / 120) {
      const step = Math.min(left, 1 / 120);
      h.vPitch += (hp.stiff * (pitchTarget - h.pitch) - hp.damp * h.vPitch) * step; h.pitch += h.vPitch * step;
      h.vRoll += (hp.stiff * (rollTarget - h.roll) - hp.damp * h.vRoll) * step; h.roll += h.vRoll * step;
    }
  }
  /** The face this pose: its expression, a blink every `blink` seconds (one pose long), the mouth flapping in 'talk'. */
  private face(input: FigureInput, t: number): FaceState {
    const expression = input.expression ?? 'neutral', every = this.member.blink, rate = this.member.gait.poseRate;
    // Half a period in, so a figure does not open on a blink.
    const blink = every > 0 && ((t + every / 2) % every) < 1.5 / rate;
    const tags = new Set<string>([expression]);
    if (expression === 'talk' && Math.floor(t * 6) % 2 === 0) tags.add('mouthOpen');
    return { tags, blink };
  }
  /**
   * Where the drawn face goes this pose: the eye row's centre on the face, projected into the cell, and which template
   * the head's yaw toward the camera picks (0 front … ±2 profile; past that the face is turned away).
   */
  private faceAt(pitch: number, blink: boolean): FaceStamp | null {
    const skin = this.built.materialIndex.get(this.member.skin);
    if (skin === undefined) return null;
    const g = this.skeleton.genes, m = this.world[J.head], [w, h] = this.cell, ppm = h / this.metres, cp = Math.cos(pitch), sp = Math.sin(pitch);
    const hw = g.head * g.headWidth / 2, hd = g.head * g.headDepth / 2, H = g.head, z = (u: number) => hd * (g.faceAhead + u);
    // Head space (garments.ts head) into the cell's texels.
    const at = (p: V3): [number, number] => { const q = apply(m, p); return [w / 2 + q[0] * ppm, h - this.feet - (q[1] * cp - q[2] * sp) * ppm]; };
    const eyes = [at([hw * 0.42, H * 0.45, z(0.88)]), at([-hw * 0.42, H * 0.45, z(0.88)])].sort((a, b) => a[0] - b[0]) as [[number, number], [number, number]];
    const yaw = Math.atan2(m[2], m[8]);
    // The head's frame in the cell: its origin (texels, and depth), and the turn from the view's axes (x right, y up,
    // toward the camera: in the figure's space (1,0,0), (0,cp,−sp), (0,sp,cp)) into the head's own.
    const view = [[1, 0, 0], [0, cp, -sp], [0, sp, cp]], R: number[] = [];
    for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) R.push(m[i] * view[k][0] + m[3 + i] * view[k][1] + m[6 + i] * view[k][2]);
    return {
      // The eyes one size on every face, whatever its width or the figure's height: only the cell's density sizes them.
      view: Math.round(yaw / (Math.PI / 4)), size: hw * ppm, eye: Math.max(1, Math.round(EYE * ppm)),
      centre: at([0, H * 0.45, z(1)]), eyes, nose: at([0, H * 0.23, z(1.06)]), mouth: at([0, H * 0.17, z(1)]),
      frame: { o: [w / 2 + m[9] * ppm, h - this.feet - (m[10] * cp - m[11] * sp) * ppm, m[10] * sp + m[11] * cp], ppm, R, head: [hw, H, hd, g.faceAhead] },
      skin, ...this.built.face, blink,
    };
  }
  /**
   * Where each hand goes this pose (paint.ts HandStamp): its wrist and fingertips projected into the cell, its widths
   * across the axis there (the cross-section's breadth and thickness as the view sees them), which side the thumb is on,
   * the back of the hand's normal, and whether it hangs.
   */
  private handsAt(pitch: number): HandStamp[] {
    const [w, h] = this.cell, ppm = h / this.metres, cp = Math.cos(pitch), sp = Math.sin(pitch), out: HandStamp[] = [];
    for (const s of this.built.hands) {
      const m = this.world[J[`hand.${s.side}`]], material = this.built.materialIndex.get(s.material);
      if (!m || material === undefined) continue;
      const at = (p: V3): [number, number, number] => { const q = apply(m, p); return [w / 2 + q[0] * ppm, h - this.feet - (q[1] * cp - q[2] * sp) * ppm, q[1] * sp + q[2] * cp]; };
      const view = (d: V3): V3 => { const q = applyDir(m, d); return [q[0], q[1] * cp - q[2] * sp, q[1] * sp + q[2] * cp]; };
      const wrist = at([s.c[0], 0, s.c[1]]), tip = at([s.c[0], -s.len, s.c[1]]), axis = view([0, -1, 0]);
      // The axis on screen (y down), and across it; a hand pointing at the camera keeps its axis's own lean.
      let ax = tip[0] - wrist[0], ay = tip[1] - wrist[1];
      if (Math.hypot(ax, ay) < 0.5) { ax = axis[0]; ay = -axis[1]; }
      const al = Math.hypot(ax, ay) || 1, a: [number, number] = [ax / al, ay / al], p: [number, number] = [-a[1], a[0]];
      const vb = view([s.across[0], 0, s.across[1]]), vt = view([s.back[0], 0, s.back[1]]);
      const across = (b: number, t: number) => ppm * Math.hypot(b * (vb[0] * p[0] - vb[1] * p[1]), t * (vt[0] * p[0] - vt[1] * p[1]));
      const side = vb[0] * p[0] - vb[1] * p[1] >= 0 ? 1 : -1;
      out.push({
        group: s.group, material, wrist, tip, axis, half: [across(s.wrist, s.thick[0]), across(s.breadth, s.thick[1])],
        front: s.breadth * Math.abs(vb[2]) + s.thick[1] * Math.abs(vt[2]), thumb: [p[0] * side, p[1] * side], thumbAt: s.thumb, thumbFacing: vb[2],
        back: vt, hangs: applyDir(m, [0, -1, 0])[1] < -0.75,
      });
    }
    return out;
  }
}
/** Cells the cache keeps: a walk in 8 views is 48–64, an idle 64–96, a turn's and an orbit's steps the rest. */
const CELLS = 384;
/** An eye's drawn width (m; paint.ts FaceStamp.eye): two texels at the brand kit's density, four at twice it (a JRPG
 * sprite's eye, with a two-texel iris). */
const EYE = 0.05;
/** The head's lead step. */
const HEAD_STEP = Math.PI / 6;
/** The three-quarter view's head turn toward the camera (rad), at 45° from it (motion: toCamera). */
const THREE_Q = 0.2;
