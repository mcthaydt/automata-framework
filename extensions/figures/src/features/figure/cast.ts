import { J, type Genes, type Side, type Skeleton } from '../body/rig';
import { CHAIN, clearance, standHolds, type Anchor, type Gait, type Hold, type Stand } from '../motion/motion';
import { GROUP, reach, type Material } from '../body/parts';
import { measure, type Sliders } from '../body/genes';
import { dress, SWATCHES, type Garment, type Look as Dressed } from '../outfit/garments';
import { GAITS, POSES } from '../motion/presets';
/**
 * The cast: every figure is a character file (a `CharacterDef`: base/base.ts holds the base pair's) of gene sliders, a
 * gait, outfits as lists of garments, and swatches of its own. `fromDef` turns any such file into a figure on the one
 * shared rig, so a new character is a new file, nothing else. The libraries it draws on are data too (library/*.json):
 * swatches, gaits, stands, hair styles and items.
 */
/** A dressed figure, how far out its arms hang to clear it (motion.ts clearance), and the openings its hands may use
 * (motion.ts Anchor). */
export type Look = Dressed & { clear?: [number, number]; anchors?: Anchor[] };
export interface CastMember {
  id: string;
  genes: Genes; gait: Gait;
  /** Cell size, the metres it shows and its feet row: the cast's texel density (36.9 texels per metre). */
  cell: [number, number]; metres: number; feet: number;
  materials: Record<string, Material>;
  /** Each outfit dressed on a rig, at `ppm` texels a metre (the cell's: small features land on whole texels). */
  outfits: Record<string, (s: Skeleton, ppm?: number) => Look>;
  defaultOutfit: string;
  /** Which hand holds items. */
  hand: Side;
  /** How much of the camera's pitch the head tips back to show the face (the sprite cheat); 0 keeps it down. */
  faceCamera: number;
  /** The share of its yaw away from the camera that the head turns back toward it (profiles show a face); 0 for none. */
  faceTurn: number;
  /** The hair's spring: stiffness and damping, how far it trails at walking speed, its bounce per step, its sway in a
   * turn, and how much it hangs against the head's tilt. */
  hair: HairPhysics;
  /** Seconds between blinks; 0 never blinks. */
  blink: number;
  /** The skin's swatch, and whether the face is drawn from the painter's templates (paint.ts) rather than marks. */
  skin: string; drawnFace: boolean;
}
export interface HairPhysics { stiff: number; damp: number; trail: number; bounce: number; sway: number; hang: number }
const HAIR: HairPhysics = { stiff: 60, damp: 9, trail: 0.25, bounce: 0.06, sway: 1, hang: 0.5 };
/** A character file. */
export interface CharacterDef {
  id: string; name: string;
  sliders: Partial<Sliders>;
  /** Rig genes set directly, after the sliders (for figures meant to look wrong). */
  genes?: Partial<Genes>;
  skin: string;
  /** A gait preset (GAITS) and any of its numbers changed. */
  gait: string; gaitOverrides?: Partial<Gait>;
  hand: Side;
  face: { camera: number; turn: number; blink?: number; drawn?: boolean };
  hair?: Partial<HairPhysics>;
  default: string;
  outfits: Record<string, Garment[]>;
  /** Swatches of its own, beside the library's (library/swatches.json). */
  swatches?: Record<string, Material>;
}
/** A character file → a figure on the shared rig. A figure up to 1.75 m tall takes the small 48×72 cell (1.95 m), a taller
 * one the 64×96 (2.6 m), both at the cast's one texel density; `memberOf` sets the sheets' cell instead. The feet's row is
 * 13.5 either way. */
export function fromDef(def: CharacterDef): CastMember {
  const m = measure(def.sliders);
  const genes: Genes = { ...m.genes, ...def.genes };
  const tall = genes.height > 1.75;
  const materials = { ...SWATCHES, ...def.swatches };
  // One look per rig (every figure of a member shares its genes), with the arms' clearance of it worked out once.
  const look = (garments: Garment[]) => {
    const made = new WeakMap<Genes, Map<number | undefined, Look>>();
    return (s: Skeleton, ppm?: number): Look => {
      const at = made.get(s.genes) ?? new Map<number | undefined, Look>(), hit = at.get(ppm); if (hit) return hit;
      const dressed = dress({ ...m, genes }, s, def.skin, garments, materials, ppm);
      const out = { ...dressed, clear: clearance(s, dressed.parts, { L: GROUP.armL, R: GROUP.armR }, [GROUP.head, GROUP.item]), anchors: dressed.anchors ?? [] };
      at.set(ppm, out); made.set(s.genes, at);
      return out;
    };
  };
  return {
    id: def.id, genes, gait: { ...(GAITS[def.gait] ?? (() => { throw new Error(`no gait ${def.gait}`); })()), ...def.gaitOverrides },
    cell: tall ? [64, 96] : [48, 72], metres: tall ? 2.6 : 1.95, feet: 13.5,
    materials, outfits: Object.fromEntries(Object.entries(def.outfits).map(([name, garments]) => [name, look(garments)])),
    defaultOutfit: def.default, hand: def.hand, faceCamera: def.face.camera, faceTurn: def.face.turn,
    hair: { ...HAIR, ...def.hair }, blink: def.face.blink ?? 3.7, skin: def.skin, drawnFace: !!def.face.drawn,
  };
}
/** The sleeve's round at mid-forearm (in k) past which folded arms read as one mass: a slim sleeve passes, a full one
 * does not. */
const FOLD = 0.08;
/**
 * Whether a dressed figure suits a stand: its placed hands all find the opening they want first on the outfit, and arms
 * fold only in sleeves slim enough at the forearm (under FOLD) to read as two forearms across the chest.
 */
export function fits(s: Skeleton, look: Look, stand: Stand): boolean {
  const anchors = look.anchors ?? [], [ax, ay] = s.rest[J['upperArm.R']];
  const slim = () => reach(look.parts.filter(p => p.group === GROUP.armR), s.rest, [ax, ay - s.genes.arms + 0.5 * s.foreArm, 0], [1, 0, 0]) < FOLD * s.genes.height / 1.62;
  // The hip is every body's: where no garment publishes one on a side (none worn, or covered), the hand goes to the
  // body's own (motion.ts openings, place's fallback).
  const offers = (kind: string, side: string) => kind === 'hip' || anchors.some(a => a.kind === kind && (a.side ?? side) === side);
  return Object.entries(stand.hands ?? {}).every(([side, h]) => !h || !('at' in h) || (h.at === 'crossed' ? slim() : offers(CHAIN[h.at][0], side)));
}
/** The cast member at `density`: the sheets' tall cell, 64·D × 96·D texels showing 2.6 m, so every figure stands at one
 * scale in a line-up and nothing clips. The feet's row stays 13.5 texels at every density: the goldens were drawn so. */
export const memberOf = (def: CharacterDef, density = 1): CastMember => ({ ...fromDef(def), cell: [64 * density, 96 * density], metres: 2.6 });
/** A stand's holds on a dressed figure: its placed hands at the look's openings (motion.ts standHolds), each laid on the
 * surface a hand may rest on, which is the dressed figure but its arms, head and item, at rest. */
export function holdsFor(s: Skeleton, look: Look, stand: Stand): Hold[] {
  const cloth = look.parts.filter(p => ![GROUP.head, GROUP.armL, GROUP.armR, GROUP.item].includes(p.group as never));
  return standHolds(s, stand, (o, d) => reach(cloth, s.rest, o, d), look.anchors);
}
/** A library stand on a dressed figure: the named one (POSES), or the first of its fallbacks that the outfit suits
 * (`fits`), with its holds; null where none suits (the gait's relaxed stand). `name` is the one used. The hero
 * (frames.ts) and the actors (actor.ts standFor) both place stands with this. */
export function standOf(s: Skeleton, look: Look, name: string): { stand: Stand; holds: Hold[]; name: string } | null {
  const named = POSES[name];
  if (!named) throw new Error(`no pose ${name}`);
  for (const n of [name, ...(named.fallback ?? [])]) {
    const stand = POSES[n];
    if (stand && fits(s, look, stand)) return { stand, name: n, holds: holdsFor(s, look, stand) };
  }
  return null;
}
