/**
 * The review frames every script and golden draws, in Node: a character at the sheets' scale, its 8 views standing, its
 * walk's poses, and its lookbook hero in a library stand (library/poses.json), each as an RGBA cell.
 */
import { Figure } from '../src/render/figure/figure';
import { fits, fromDef, GROUP, POSES, type CastMember, type CharacterDef } from '../src/render/figure/cast';
import { evaluate, standHolds } from '../src/render/figure/motion';
import { reach } from '../src/render/figure/parts';

export type Frame = Uint8ClampedArray;
/** The camera: the sheets' 18° pitch, from the front. */
export const view = (pitch = 18 * Math.PI / 180) => ({ azimuth: 0, pitch });
/** One frame for every figure (the builder's tall cell at `density` cells per texel of the brand kit), so a line-up
 * stands at one scale and nothing clips. */
export function member(def: CharacterDef, density = Number(process.env.DENSITY ?? 1)): CastMember {
  return { ...fromDef(def), cell: [64 * density, 96 * density], metres: 2.6 };
}
/** Standing in view d of the 8 (0 front, counter-clockwise by 45°). */
export function standing(cast: CastMember, d: number, pitch?: number): Frame {
  const f = new Figure(cast);
  for (let i = 0; i < 3; i++) f.update(1 / 60, { facing: d * Math.PI / 4, moving: false, view: view(pitch) });
  return f.painted.slice();
}
/** The walk, one frame per pose step of the cycle (the figure's own phase, kept here in step with it), after the hair's
 * spring has settled; with no blink, so no step is drawn twice. Three-quarter front. */
export function walking(cast: CastMember, pitch?: number): Frame[] {
  const f = new Figure({ ...cast, blink: 0 }), walk: Frame[] = [], dt = 1 / 60, poses = cast.gait.walkPoses;
  let phase = 0;
  for (let i = 0; i < Math.round(cast.gait.cycle * 4 * 60); i++) {
    phase = (phase + dt / cast.gait.cycle) % 1;
    f.update(dt, { facing: Math.PI / 4, moving: true, view: view(pitch) });
    walk[Math.floor(phase * poses)] = f.painted.slice();
  }
  return walk;
}
/** The lookbook hero: the named stand (POSES), or the first of its fallbacks that the outfit suits (cast.ts fits), drawn
 * as a made pose at `facing`, its hands placed at the dressed figure's openings (its pockets, its top's hem, the hip) on
 * the surface a hand may rest on (the figure but its arms, head and item, at rest); with no pose, or none that suits,
 * the gait's relaxed stand. */
export function hero(cast: CastMember, pose: string | undefined, facing = Math.PI / 4, pitch?: number): Frame {
  if (pose && !POSES[pose]) throw new Error(`no pose ${pose}`);
  const f = new Figure(cast), input = { facing, moving: false, view: view(pitch) }, s = f.skeleton, look = cast.outfits[cast.defaultOutfit](s);
  const name = pose ? [pose, ...(POSES[pose].fallback ?? [])].find(n => POSES[n] && fits(s, look, POSES[n])) : undefined;
  if (!name) { for (let i = 0; i < 3; i++) f.update(1 / 60, input); return f.painted.slice(); }
  const stand = POSES[name], rel = Math.round((facing - input.view.azimuth) / (Math.PI / 4)) * (Math.PI / 4);
  const cloth = look.parts.filter(p => ![GROUP.head, GROUP.armL, GROUP.armR, GROUP.item].includes(p.group as never));
  const holds = standHolds(s, stand, (o, d) => reach(cloth, s.rest, o, d), look.anchors);
  const st = { ...f.motion(input, 0, 0, facing, rel), yaw: 0, view: rel, stand, holds };
  f.update(1 / 60, { ...input, pose: { key: 'hero', pose: evaluate(s, cast.gait, st).pose } });
  return f.painted.slice();
}
