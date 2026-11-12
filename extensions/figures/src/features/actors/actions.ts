import { fill, mix, type Filled, type Spec } from './pose-spec';
import { smooth } from '../../lib/math';
import type { Gait } from '../motion/motion';
import library from './library/actions.json';
/**
 * The action set (library/actions.json): each action is pose specs (pose-spec.ts) keyed over its envelope, read here
 * into the spec at any moment and how much of it shows. Data plus this one generator: an action is a new entry in the
 * library, never code.
 *
 * The envelope: the anticipation (from the action's start, the pose blends in and reaches the wind-up), the action
 * (its keys play; a `loop` of them repeats while the action is held longer), the recovery (after it ends, it blends
 * back to the gait). A `hold` action (sit, kneel, fall) stays at its last key until it is ended.
 */
export interface ActionDef {
  about?: string;
  /** 'upper' lies over the gait, the legs left to it; 'full' poses the whole body, kept on the floor. */
  body: 'upper' | 'full';
  /** The acting arm (A): the main hand (the one that holds items), the free one, or either (the main unless it holds
   * an item). Left out, 'either'. */
  hand?: 'main' | 'free' | 'either';
  /** Seconds: the wind-up, the action, the return to the gait. `enter` blends in faster than the anticipation (0 at once). */
  anticipation: number; action: number; recovery: number; enter?: number;
  /** Held at its last key until the script ends it. */
  hold?: boolean;
  /** Keys a held-longer action repeats ([from, to] s). */
  loop?: [number, number];
  /** [time (s), spec] in time order; a neutral key (the body as it stands) is implied at 0. */
  keys: [number, Spec][];
  /** It turns to a target (`face`, an arm `to`); with none, `untargeted` plays instead (if named). */
  targeted?: boolean; untargeted?: string;
}
/** An alias: the action it plays with an item in the hand and without. */
export interface AliasDef { about?: string; alias: { item: string; bare: string } }
const lib = library as unknown as { modes: Record<string, { scale?: Partial<Record<keyof Gait, number>>; set?: Partial<Gait> }>; actions: Record<string, ActionDef | AliasDef> };
export const ACTIONS = lib.actions;
/** The action an id plays, alias and target resolved. */
export function actionOf(id: string, item: boolean, target: boolean): { id: string; def: ActionDef } {
  let a = ACTIONS[id];
  if (!a) throw new Error(`no action ${id} (the library's: ${Object.keys(ACTIONS).join(', ')})`);
  if ('alias' in a) return actionOf(item ? a.alias.item : a.alias.bare, item, target);
  if (a.targeted && !target && a.untargeted) return actionOf(a.untargeted, item, target);
  return { id, def: a as ActionDef };
}
/** The action's own length (s): its anticipation and action. */
export const lengthOf = (def: ActionDef) => def.anticipation + def.action;
/** The envelope's parts, for a sheet or a test: when each begins (s, from the action's start). */
export function envelopeOf(def: ActionDef, duration = lengthOf(def)) {
  return { anticipation: [0, def.anticipation], action: [def.anticipation, duration], recovery: [duration, duration + def.recovery] } as const;
}
/** The keys filled once per action (each a whole spec, the neutral one first). */
const filled = new WeakMap<ActionDef, [number, Filled][]>();
function keysOf(def: ActionDef): [number, Filled][] {
  let k = filled.get(def);
  if (!k) { k = [...(def.keys[0]?.[0] > 0 ? [[0, fill({})] as [number, Filled]] : []), ...def.keys.map(([t, s]) => [t, fill(s)] as [number, Filled])]; filled.set(def, k); }
  return k;
}
/** The key time an action held `duration` shows at `u` s from its start: its own time, the loop repeating to fill a
 * longer hold (the keys after the loop played out at its end), held at the last key after. */
function keyTime(def: ActionDef, u: number, duration: number) {
  const keys = keysOf(def), last = keys[keys.length - 1][0], v = Math.min(u, duration);
  if (!def.loop || duration <= last) return Math.min(v, last);
  const [a, b] = def.loop, tail = last - b;
  if (v <= a) return v;
  if (v >= duration - tail) return Math.min(last, b + (v - (duration - tail)));
  return a + ((v - a) % (b - a));
}
/** The spec at `u` s into an action held `duration` s: its keys eased one into the next. */
export function specAt(def: ActionDef, u: number, duration = lengthOf(def)): Filled {
  const keys = keysOf(def), t = keyTime(def, u, duration);
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) {
    const [t0, a] = keys[i - 1], [t1, b] = keys[i];
    return mix(a, b, smooth((t - t0) / Math.max(1e-6, t1 - t0)));
  }
  return keys[keys.length - 1][1];
}
/** How much of the action shows at `u` s from its start, held `duration` s: in over its anticipation (or `enter`), whole
 * through the action, out over its recovery. */
export function weightAt(def: ActionDef, u: number, duration = lengthOf(def)) {
  if (u < 0) return 0;
  const enter = def.enter ?? Math.max(0.08, def.anticipation);
  const inW = enter > 0 ? smooth(u / enter) : 1;
  if (u <= duration) return inW;
  return inW * (1 - smooth((u - duration) / Math.max(1e-6, def.recovery)));
}
/** A gait mode (library/actions.json modes: the run) made from a figure's own gait: its numbers scaled, then set. */
export function modeGait(gait: Gait, mode: string): Gait {
  const m = lib.modes[mode];
  if (!m) throw new Error(`no gait mode ${mode}`);
  const out = { ...gait, ...m.set } as Gait;
  for (const [key, by] of Object.entries(m.scale ?? {})) (out as unknown as Record<string, number>)[key] = (gait as unknown as Record<string, number>)[key] * by!;
  return out;
}
