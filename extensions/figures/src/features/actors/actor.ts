import { J, fk, type Pose, type Side, type Skeleton } from '../body/rig';
import { evaluate, type ActionId, type Gait, type Hold, type MotionState, type Stand } from '../motion/motion';
import { euler, qmul, smooth, wrapAngle, type V3 } from '../../lib/math';
import { memberOf, standOf, type CastMember, type CharacterDef } from '../figure/cast';
import { GAITS } from '../motion/presets';
import type { Expression } from '../outfit/garments';
import { Figure, type View } from '../figure/figure';
import { actionOf, lengthOf, modeGait, specAt, weightAt, type ActionDef } from './actions';
import { aim, blend, eyesOf, layer, lift, lowest, specPose, type Aims } from './pose-spec';
import { BASE } from '../../../base/base';
/**
 * Scriptable actors: a character on a timeline. An actor is a script (data, JSON as well as TS): who it is, a path of
 * waypoints (each with a speed or a gait, a wait, stepping in place, a run, a strafe), facing keys, look-at targets (a
 * point or another actor), timed actions from the library (actions.ts), library stands held over a span, an expression
 * and a held item set at times.
 *
 * Everything an actor shows at time t is a pure function of t: where it is, which way it faces, its walk's phase (from
 * the distance it has walked), its actions' envelopes, its blink. There is no clock inside, so a cut, a second shot or a
 * test can sample any moment in any order and get the same frame. It draws through a Figure (figure.ts), as a pose made
 * outside the figure's own motion (`update({ pose, clock })`), in any view: first person, the diorama, top-down, or alone.
 *
 * Coordinates: the floor's x and z (a map's x and y), facing in radians with 0 toward +z and π/2 toward +x
 * (0 faces the camera); a script's facings are in degrees.
 */
/** A place on the floor (x, z), or a point in the world (x, y, z), or another actor by name. */
export type Target = [number, number] | [number, number, number] | string;
export interface Waypoint {
  /** Where it walks to (x, z). */
  at: [number, number];
  /** Its speed (m/s); left out, its gait's own (the run's when it runs). */
  speed?: number;
  /** The gait to walk there in: a library gait (library/gaits.json) or a mode of its own gait ('run'). */
  gait?: string;
  /** Runs there (its own gait's run). */
  run?: boolean;
  /** Keeps its facing (a face key's, else the one it had) and steps sideways or back to get there. */
  strafe?: boolean;
  /** On arriving: steps in place for this long (s), then waits `wait` s; `stop` ends the path here. */
  march?: number; wait?: number; stop?: boolean;
}
/** An action at a time: a library action (library/actions.json) or the motion's own reach and flinch. */
export interface ActionCue {
  t: number; action: string;
  /** Held until (s): a hold action (sit, kneel, fall) stays until then, a looping one (wave) plays on until then. */
  until?: number;
  /** Its target: what a point points at, a look looks at, a handshake meets. */
  at?: Target;
  /** A sit's seat height (m). */
  seat?: number;
  /** The acting hand; left out, the action's own rule (actions.ts ActionDef.hand). */
  side?: Side;
}
/** An actor's script. Every field but `who` and `at` may be left out. */
export interface ActorScript {
  /** Its name, for other actors' targets. */
  name?: string;
  /** A base figure's id (base/base.ts) or a whole character file. */
  who: string | CharacterDef;
  outfit?: string;
  /** Where it starts (x, z), and its facing there (degrees; left out, toward its first waypoint). */
  at: [number, number]; facing?: number;
  /** When it sets off along the path (s), and the path. */
  start?: number; path?: Waypoint[];
  /** From each time on, it faces this way (degrees) or toward this target, turning to it. Walking, it faces its way. */
  face?: { t: number; to: number | Target }[];
  /** From each time on, its head (and its chest, and past what they turn, its body) turns to this target; null stops. */
  look?: { t: number; at: Target | null }[];
  actions?: ActionCue[];
  /** A library stand (library/poses.json) held while it stands, from t to `until`. */
  stands?: { t: number; until?: number; pose: string }[];
  expressions?: { t: number; is: Expression }[];
  /** The item in its hand (library/items.json) from t on; null empties it. */
  items?: { t: number; hold: string | null }[];
}
/** What an actor is doing at a moment. */
export interface ActorState {
  /** Where it stands (x, z), its facing (rad) and its speed (m/s). */
  at: [number, number]; facing: number; speed: number;
  moving: boolean;
  /** Walk phase over a two-step cycle (stepped to the gait's poses), the gait, and the feet's heading against the facing. */
  phase: number; gait: Gait; heading: number; march: boolean;
}

// ─── Who: a base figure or a character file ───
/** A character file (and its lookbook stand) from a base figure's id (base/base.ts) or the file itself. */
export function characterOf(who: string | CharacterDef): { def: CharacterDef; pose?: string } {
  if (typeof who === 'object') return { def: who };
  const b = BASE.find(c => c.def.id === who);
  if (!b) throw new Error(`no figure ${who} (a base id: ${BASE.map(c => c.def.id).join(', ')}, or a character file)`);
  return { def: b.def, pose: b.pose };
}
export { memberOf } from '../figure/cast';
const deg = (d: number) => d * Math.PI / 180;
/** Turn speeds (rad/s): to a new way of walking at a corner, and to a face key. */
const CORNER = 9, TURN = 5;
/** The head and chest turn this far to a look target (rad); past it, the body turns. Blends between targets over LOOK s. */
const NECK = 1.45, LOOK = 0.35;
/** A stand blends in and out over STAND s. */
const STAND = 0.35;

interface Seg { t0: number; t1: number; from: [number, number]; to: [number, number]; kind: 'move' | 'march' | 'still'; gait: Gait; strafe: boolean; cycles0: number; cps: number; dir: number }
interface Turn { t: number; rate: number; to: (t: number) => number }
interface Cue { cue: ActionCue; start: number; end: number; cut: number }

/** A set of actors that can name each other as targets (a cast). */
export class Troupe {
  readonly actors: ScriptedActor[] = [];
  add(script: ActorScript, opts: ActorOptions = {}) { const a = new ScriptedActor(script, { ...opts, troupe: this }); this.actors.push(a); return a; }
  get(name: string) { return this.actors.find(a => a.name === name); }
}
export interface ActorOptions {
  /** The cell density its figure is drawn at by default (texels per brand-kit texel). */
  density?: number;
  troupe?: Troupe;
  /** The floor's height at (x, z); 0 by default. */
  ground?: (x: number, z: number) => number;
  /** Whether its figures keep their cell cache (true); a caller reading the G-buffer turns it off. */
  cache?: boolean;
}

export class ScriptedActor {
  readonly script: ActorScript; readonly def: CharacterDef; readonly name: string;
  /** The character's own lookbook stand (a base figure's), for a placement's 'hero'. */
  readonly heroPose?: string;
  readonly member: CastMember; readonly skeleton: Skeleton;
  density: number; troupe?: Troupe; ground: (x: number, z: number) => number; cache: boolean;
  private segs: Seg[] = []; private turns: Turn[] = []; private cues: Cue[] = [];
  private figures = new Map<number, Figure>();
  private standCache = new Map<string, { stand: Stand; holds: Hold[]; name: string } | null>();
  constructor(script: ActorScript, opts: ActorOptions = {}) {
    this.script = script;
    const { def, pose } = characterOf(script.who);
    this.def = def; this.heroPose = pose; this.name = script.name ?? def.id;
    this.density = opts.density ?? 1; this.troupe = opts.troupe; this.ground = opts.ground ?? (() => 0); this.cache = opts.cache ?? true;
    this.member = memberOf(def, 1); this.skeleton = this.figure(this.density).skeleton;
    this.compile();
  }
  /** The figure it is drawn by at `density` (one per density, made once). */
  figure(density = this.density): Figure {
    let f = this.figures.get(density);
    if (!f) { f = new Figure(memberOf(this.def, density), this.script.outfit); f.cache = this.cache; this.figures.set(density, f); }
    return f;
  }
  private get k() { return this.member.genes.height / 1.62; }
  /** A gait's walking speed on this body (m/s): a stride per stance, so the feet never slide. */
  speedOf(g: Gait) { return (g.stride * this.k) / (g.duty * g.cycle); }
  /** The gait a waypoint asks for: a mode of its own (the run), a library gait, or its own. */
  gaitOf(w?: Pick<Waypoint, 'gait' | 'run'>): Gait {
    const own = this.member.gait, name = w?.run ? 'run' : w?.gait;
    if (!name) return own;
    if (GAITS[name]) return { ...GAITS[name] };
    return modeGait(own, name);
  }
  // ─── The timeline, compiled once from the script ───
  private compile() {
    const sc = this.script, segs: Seg[] = [], own = this.member.gait;
    let t = sc.start ?? 0, pos: [number, number] = [...sc.at], cycles = 0;
    const still = (t0: number, t1: number) => segs.push({ t0, t1, from: pos, to: pos, kind: 'still', gait: own, strafe: false, cycles0: cycles, cps: 0, dir: 0 });
    still(-Infinity, t);
    for (const w of sc.path ?? []) {
      const g = this.gaitOf(w), d = Math.hypot(w.at[0] - pos[0], w.at[1] - pos[1]);
      if (d > 1e-6) {
        const v = w.speed ?? this.speedOf(g), dur = d / v, cps = v * g.duty / (g.stride * this.k);
        segs.push({ t0: t, t1: t + dur, from: pos, to: [...w.at], kind: 'move', gait: g, strafe: !!w.strafe, cycles0: cycles, cps, dir: Math.atan2(w.at[0] - pos[0], w.at[1] - pos[1]) });
        cycles += cps * dur; t += dur; pos = [...w.at];
      }
      if (w.march) { segs.push({ t0: t, t1: t + w.march, from: pos, to: pos, kind: 'march', gait: g, strafe: false, cycles0: cycles, cps: 1 / g.cycle, dir: 0 }); cycles += w.march / g.cycle; t += w.march; }
      if (w.wait) { still(t, t + w.wait); t += w.wait; }
      if (w.stop) break;
    }
    still(t, Infinity);
    this.segs = segs;
    // The turns: its first facing; each walk's way (at once, round a corner); each face key, deferred to the end of a
    // walk it falls in (walking, it faces its way).
    const first = segs.find(s => s.kind === 'move' && !s.strafe);
    const f0 = sc.facing !== undefined ? deg(sc.facing) : first ? first.dir : 0;
    const turns: Turn[] = [{ t: -Infinity, rate: Infinity, to: () => f0 }];
    for (const s of segs) if (s.kind === 'move' && !s.strafe) turns.push({ t: s.t0, rate: CORNER, to: () => s.dir });
    for (const key of sc.face ?? []) {
      const walking = segs.find(s => s.kind === 'move' && !s.strafe && key.t >= s.t0 && key.t < s.t1);
      const at = walking ? walking.t1 : key.t, to = key.to;
      turns.push({ t: at - 1e-9, rate: TURN, to: typeof to === 'number' ? () => deg(to) : tt => { const p = this.positionAt(tt), q = this.pointOf(to, tt); return Math.atan2(q[0] - p[0], q[2] - p[1]); } });
    }
    this.turns = turns.sort((a, b) => a.t - b.t);
    // The actions: each lasts its own length (or to `until`; a hold one until then, or on), and a whole-body one ends any
    // whole-body one before it once it has blended in.
    const cues: Cue[] = (sc.actions ?? []).map(cue => {
      const def = this.defOf(cue, cue.t);
      return { cue, start: cue.t, end: cue.until ?? (def && def.hold ? Infinity : cue.t + (def ? lengthOf(def) : this.member.gait.reach)), cut: Infinity };
    }).sort((a, b) => a.start - b.start);
    for (let i = 0; i < cues.length; i++) {
      const d = this.defOf(cues[i].cue, cues[i].start);
      if (d?.body !== 'full') continue;
      for (let j = 0; j < i; j++) { const e = this.defOf(cues[j].cue, cues[j].start); if (e?.body === 'full') cues[j].cut = Math.min(cues[j].cut, cues[i].start + (d.enter ?? Math.max(0.08, d.anticipation))); }
    }
    this.cues = cues;
  }
  /** A cue's library action (alias and target resolved, by what it holds when it starts), or null for the motion's own. */
  private defOf(cue: ActionCue, t: number): ActionDef | null {
    if (cue.action === 'reach' || cue.action === 'flinch') return null;
    return actionOf(cue.action, !!this.itemAt(t), cue.at !== undefined).def;
  }
  private segAt(t: number): Seg {
    const s = this.segs;
    let lo = 0, hi = s.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (s[m].t0 <= t) lo = m; else hi = m - 1; }
    return s[lo];
  }
  /** Where it stands at t (x, z): along its path. Pure, and reads no other actor. */
  positionAt(t: number): [number, number] {
    const s = this.segAt(t);
    if (s.kind !== 'move') return [...s.from];
    const u = Math.min(1, Math.max(0, (t - s.t0) / (s.t1 - s.t0)));
    return [s.from[0] + (s.to[0] - s.from[0]) * u, s.from[1] + (s.to[1] - s.from[1]) * u];
  }
  /** Its eyes in the world at t. */
  eyesAt(t: number): V3 { const p = this.positionAt(t); return [p[0], this.ground(p[0], p[1]) + eyesOf(this.skeleton)[1], p[1]]; }
  /** A target as a world point at t: a place on the floor at this actor's eye height, a point, another actor's eyes. */
  pointOf(to: Target, t: number, eyes = true): V3 {
    if (typeof to === 'string') {
      const other = this.troupe?.get(to);
      if (!other) throw new Error(`${this.name}: no actor ${to} to look at`);
      const e = other.eyesAt(t);
      return eyes ? e : [e[0], e[1] - eyesOf(other.skeleton)[1] * 0.42, e[2]];
    }
    if (to.length === 3) return [...to] as V3;
    return [to[0], this.ground(to[0], to[1]) + eyesOf(this.skeleton)[1], to[1]];
  }
  /** The body's facing at t, before a look turns it: each turn from where the last left it, toward its way at its rate. */
  private facingBase(t: number): number {
    let cur = this.turns[0].to(t);
    for (let i = 1; i < this.turns.length && this.turns[i].t <= t; i++) {
      const tr = this.turns[i], next = this.turns[i + 1], until = next && next.t <= t ? next.t : t;
      cur = cur + Math.max(-tr.rate * (until - tr.t), Math.min(tr.rate * (until - tr.t), wrapAngle(tr.to(until) - cur)));
    }
    return wrapAngle(cur);
  }
  /** The look at t: the target's yaw and pitch from the eyes (root space at `facing`), blended from the last key's over LOOK s. */
  private lookAt(t: number, at: [number, number], facing: number): [number, number] | null {
    const keys = this.script.look ?? [];
    let i = -1;
    for (let j = 0; j < keys.length; j++) if (keys[j].t <= t) i = j;
    if (i < 0) return null;
    const angles = (key?: { at: Target | null }): [number, number] => {
      if (!key?.at) return [0, 0];
      const p = this.pointOf(key.at, t), y0 = this.ground(at[0], at[1]), dx = p[0] - at[0], dz = p[2] - at[1];
      const local: V3 = [dx * Math.cos(facing) - dz * Math.sin(facing), p[1] - y0, dx * Math.sin(facing) + dz * Math.cos(facing)];
      return aim(eyesOf(this.skeleton), local);
    };
    const a = angles(keys[i - 1]), b = angles(keys[i]), k = smooth((t - keys[i].t) / LOOK);
    if (!keys[i].at && k >= 1) return null;
    return [a[0] + wrapAngle(b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  }
  /** Everything it is doing at t but its pose: a pure function of t. */
  state(t: number): ActorState & { look: [number, number] | null } {
    const s = this.segAt(t), at = this.positionAt(t);
    let facing = this.facingBase(t);
    // A look past what the neck and chest turn turns the body with it.
    let look = this.lookAt(t, at, facing);
    if (look && Math.abs(look[0]) > NECK) { const over = look[0] - Math.sign(look[0]) * NECK; facing = wrapAngle(facing + over); look = [look[0] - over, look[1]]; }
    const moving = s.kind !== 'still', cycles = s.cycles0 + s.cps * Math.max(0, t - s.t0), g = s.gait;
    const phase = Math.floor((cycles - Math.floor(cycles)) * g.walkPoses) / g.walkPoses;
    const speed = s.kind === 'move' ? Math.hypot(s.to[0] - s.from[0], s.to[1] - s.from[1]) / (s.t1 - s.t0) : 0;
    return { at, facing, speed, moving, phase, gait: moving ? g : this.member.gait, heading: s.kind === 'move' ? wrapAngle(s.dir - facing) : 0, march: s.kind === 'march', look };
  }
  /** What it holds at t, its expression, its stand. */
  itemAt(t: number): string | null { let it: string | null = null; for (const k of this.script.items ?? []) if (k.t <= t) it = k.hold; return it; }
  expressionAt(t: number): Expression | undefined { let e: Expression | undefined; for (const k of this.script.expressions ?? []) if (k.t <= t) e = k.is; return e; }
  /** The stand at t and how much of it shows (in and out over STAND s). */
  standAt(t: number): { pose: string; w: number } | null {
    for (const k of this.script.stands ?? []) {
      const end = k.until ?? Infinity;
      if (t < k.t || t > end + STAND) continue;
      return { pose: k.pose, w: smooth((t - k.t) / STAND) * (t > end ? 1 - smooth((t - end) / STAND) : 1) };
    }
    return null;
  }
  /** A library stand on this dressed figure: the named one or the first of its fallbacks its outfit suits (cast.ts fits),
   * its hands placed at the outfit's openings; null where none suits (the gait's relaxed stand). `name` the one used. */
  standFor(name: string, f: Figure): { stand: Stand; holds: Hold[]; name: string } | null {
    const key = `${f.outfit}|${name}`;
    if (!this.standCache.has(key)) this.standCache.set(key, standOf(f.skeleton, f.member.outfits[f.outfit](f.skeleton), name));
    return this.standCache.get(key)!;
  }
  /** The acting side for an action. */
  private sideOf(cue: ActionCue, def: ActionDef | null, item: boolean): Side {
    if (cue.side) return cue.side;
    const main = this.member.hand, free: Side = main === 'L' ? 'R' : 'L', rule = def?.hand ?? 'either';
    return rule === 'main' ? main : rule === 'free' ? free : item ? free : main;
  }
  /** A world point in this figure's root space at t. */
  private local(p: V3, at: [number, number], facing: number): V3 {
    const dx = p[0] - at[0], dz = p[2] - at[1], y = p[1] - this.ground(at[0], at[1]);
    return [dx * Math.cos(facing) - dz * Math.sin(facing), y, dx * Math.sin(facing) + dz * Math.cos(facing)];
  }
  /** What a cue aims at in root space: its target (ahead, at shoulder height, with none), the meeting point with another
   * actor (between the two, at the waist's height), and its seat. */
  private aimsOf(cue: ActionCue, t: number, st: ActorState): Aims {
    const s = this.skeleton, x = this.member.hand === 'R' ? -1 : 1;
    const target = cue.at !== undefined ? this.local(this.pointOf(cue.at, t), st.at, st.facing) : [x * 0.6, s.shoulderY, 3] as V3;
    let meet: V3 | null = null;
    if (cue.at !== undefined) {
      const p = this.pointOf(cue.at, t), o = this.ground(st.at[0], st.at[1]);
      meet = this.local([(p[0] + st.at[0]) / 2, o + s.hipY + 0.1 * this.k, (p[2] + st.at[1]) / 2], st.at, st.facing);
    }
    return { target, meet, seat: cue.seat ?? null };
  }
  /** The actions playing at t: each with its spec's weight. */
  activeAt(t: number) {
    const out: { cue: ActionCue; def: ActionDef | null; u: number; duration: number; w: number }[] = [];
    for (const c of this.cues) {
      if (t < c.start || t >= c.cut) continue;
      const def = this.defOf(c.cue, c.start), duration = c.end - c.start, u = t - c.start;
      const w = def ? weightAt(def, u, duration) : u <= duration ? 1 : 0;
      if (w > 0) out.push({ cue: c.cue, def, u, duration, w });
    }
    return out;
  }
  /**
   * The pose at t for a figure drawn at `rel` (its bearing from the camera, snapped as the figure snaps it): the gait (or
   * a stand), the whole-body actions blended in and kept on the floor, the upper-body ones laid over, the look on top.
   * Pure: the figure is read only for its measures, its item and its outfit.
   */
  poseAt(t: number, f: Figure, view: View, st = this.state(t)): Pose {
    const s = f.skeleton, item = this.itemAt(t);
    f.wear(this.script.outfit ?? f.outfit, item);
    const rel = f.snap(st.facing, view).rel, active = this.activeAt(t);
    // The motion's own actions (reach, flinch) ride its state.
    const own = active.find(a => !a.def);
    const input = { facing: st.facing, moving: st.moving, view, action: own ? { id: own.cue.action as ActionId, t: own.u } : null };
    const ms: MotionState = f.motion(input, f.clockAt(t).steppedT, st.phase, st.facing, rel, t);
    const hp = f.member.hair, gait = st.gait;
    ms.yaw = 0; ms.view = rel;
    ms.hair = { pitch: Math.round((st.moving ? hp.trail * st.speed / 3 + hp.bounce * Math.cos(4 * Math.PI * st.phase) : 0) * 10) / 10, roll: Math.round(-f.member.genes.headTilt * hp.hang * 10) / 10 };
    if (st.heading) ms.heading = st.heading;
    if (st.march) ms.stride = 0;
    // A stand, blended in from the gait's relaxed one.
    const stand = !st.moving ? this.standAt(t) : null, placed = stand ? this.standFor(stand.pose, f) : null;
    let ev = evaluate(s, gait, ms);
    if (stand && placed) {
      const on = evaluate(s, gait, { ...ms, stand: placed.stand, holds: placed.holds });
      ev = stand.w >= 1 ? on : { pose: blend(ev.pose, on.pose, stand.w), world: [] };
    }
    let pose = ev.pose;
    // Whole-body actions: each its own pose, set on the floor, blended over the gait's in the order they began; then the
    // whole kept on the floor as far as they show (the gait's own feet where they do not).
    const full = active.filter(a => a.def?.body === 'full');
    if (full.length) {
      const floor0 = lowest(s, fk(s, pose));
      const tip = ((ms.lookUp ?? 0) + (gait.chin ?? 0)) * Math.max(0, Math.cos(rel));
      let shown = 0;
      for (const a of full) {
        const p = specPose(s, specAt(a.def!, a.u, a.duration), this.sideOf(a.cue, a.def, !!item), this.aimsOf(a.cue, t, st), tip);
        pose = blend(pose, lift(p, -lowest(s, fk(s, p))), a.w);
        shown = 1 - (1 - shown) * (1 - a.w);
      }
      pose = lift(pose, floor0 * (1 - shown) - lowest(s, fk(s, pose)));
    }
    // Upper-body actions over that.
    let out = { pose, world: fk(s, pose) };
    for (const a of active) if (a.def?.body === 'upper') out = layer(s, out, specAt(a.def, a.u, a.duration), this.sideOf(a.cue, a.def, !!item), a.w, this.aimsOf(a.cue, t, st));
    pose = out.pose;
    // The look: the chest a share (up to 0.4 rad), the head the rest, the pitch on the head.
    if (st.look) {
      const [y, p] = st.look, chest = Math.max(-0.4, Math.min(0.4, y * 0.3)), head = y - chest, pitch = Math.max(-0.6, Math.min(0.7, p));
      pose.rot[J.chest] = qmul(pose.rot[J.chest], euler(0, chest, 0));
      pose.rot[J.neck] = qmul(pose.rot[J.neck], euler(pitch * 0.4, head * 0.4, 0));
      pose.rot[J.head] = qmul(pose.rot[J.head], euler(pitch * 0.6, head * 0.6, 0));
    }
    return pose;
  }
  /** Brings its figure at `density` to time t under `view`, and returns it (its painted cell, normals, G-buffer). */
  draw(t: number, view: View, density = this.density): Figure {
    const f = this.figure(density), st = this.state(t), pose = this.poseAt(t, f, view, st);
    f.update(0, { facing: st.facing, moving: st.moving, view, pose: { key: keyOf(pose), pose }, expression: this.expressionAt(t), clock: t });
    // The painter leaves an empty texel's colour as the last raster had it (only its alpha cleared): cleared here, so a
    // frame is the same in every channel whatever was drawn before it.
    const px = f.painted;
    for (let i = 3; i < px.length; i += 4) if (!px[i]) px[i - 3] = px[i - 2] = px[i - 1] = 0;
    return f;
  }
}
/** A pose's cache key: its numbers, to a tenth of a millimetre and a ten-thousandth of a radian. */
function keyOf(p: Pose): string {
  let h = 2166136261;
  const put = (v: number) => { h = Math.imul(h ^ (Math.round(v * 1e4) | 0), 16777619); };
  put(p.yaw); p.root.forEach(put); for (const q of p.rot) q.forEach(put); for (const v of p.shift) v.forEach(put);
  return `a${(h >>> 0).toString(36)}`;
}


// ─── Placements: the short form of a script ───
/** A figure placed on the floor, the short form of a script: who it is, where it stands (x, z), where it walks to over
 * the clip (`to`, at its gait's speed), its facing (degrees: 0 toward +z, 90 toward +x) and a library stand it holds
 * standing still ('hero' its own lookbook stand). */
export interface Placement {
  who: ActorScript['who'];
  at: [number, number]; to?: [number, number];
  facing?: number;
  pose?: string;
}
/** What a troupe's caller may cast: a placement or a whole script. */
export type Casting = Placement | ActorScript;
/** A placement as a script: it walks to `to` at its gait's speed (facing its way), and holds `pose` while it stands
 * ('hero' its own lookbook stand). A script passes through. */
export function scriptOf(c: Casting): ActorScript {
  const p = c as Placement & Partial<ActorScript>;
  if (p.to === undefined && p.pose === undefined) return c as ActorScript;
  const { to, pose, ...rest } = p;
  const stand = pose === 'hero' ? characterOf(p.who).pose : pose;
  return {
    ...rest,
    ...(to ? { path: [...(rest.path ?? []), { at: to }] } : {}),
    ...(stand ? { stands: [...(rest.stands ?? []), { t: 0, pose: stand }] } : {}),
  };
}
