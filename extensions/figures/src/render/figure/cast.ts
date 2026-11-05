import { J, type Genes, type Side, type Skeleton } from './rig';
import { CHAIN, clearance, type Anchor, type Gait, type Hold, type Stand } from './motion';
import { axisAngle, euler, type V3 } from './math';
import { reach, type Material, type Part } from './parts';
import { measure, type Sliders } from './genes';
import { box, dress, GROUP, SWATCHES, type Garment, type Look as Dressed } from './garments';
import gaitLibrary from './library/gaits.json';
import itemLibrary from './library/items.json';
import poseLibrary from './library/poses.json';
/**
 * The cast: every figure is a character file (a `CharacterDef`: base/base.ts holds the base pair's) of gene sliders, a
 * gait, outfits as lists of garments, and swatches of its own. `fromDef` turns any such file into a figure on the one
 * shared rig, so a new character is a new file, nothing else. The libraries it draws on are data too (library/*.json):
 * swatches, gaits, stands, hair styles and items.
 */
/** A dressed figure, how far out its arms hang to clear it (motion.ts clearance), and the openings its hands may use
 * (motion.ts Anchor). */
export type Look = Dressed & { clear?: [number, number]; anchors?: Anchor[] };
export interface Item {
  /** The item's parts, authored in its socket's space (+z up when held upright). */
  parts: (socket: number) => Part[];
  /** The arm pose that holds it, for a skeleton and a hand. */
  hold: (s: Skeleton, side: Side) => Hold;
}
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
// ─── Gaits: presets a character picks and adjusts (library/gaits.json) ───
export const GAITS = gaitLibrary as Record<string, Gait>;
// ─── Stands: lookbook poses a character picks by name (library/poses.json) ───
export const POSES = poseLibrary as unknown as Record<string, Stand>;
// ─── Items: on a hand socket (library/items.json) ───
/** An item as data: its parts in socket space (metres, +z up when held upright), and the
 * hold: the hand's place in the chest's space as sums of the figure's measures (k, shoulders, arms), mirrored in x for
 * the left hand, the hand's turn and the elbow's pole. */
interface ItemDef {
  parts: { material: string; at: V3; r: V3; e?: [number, number]; seg?: number; rings?: number; pitch?: number }[];
  hold: { hand: { k?: number; shoulders?: number; arms?: number }[]; turn: [number, number, number]; pole: V3 };
}
function item(def: ItemDef): Item {
  return {
    parts: socket => def.parts.map(p => box(socket, p.material, GROUP.item, { at: p.at, r: p.r, ...(p.e ? { e: p.e } : {}), ...(p.seg ? { seg: p.seg } : {}), ...(p.rings ? { rings: p.rings } : {}), ...(p.pitch !== undefined ? { turn: axisAngle([1, 0, 0], p.pitch) } : {}) })),
    hold: (s, side) => {
      const x = side === 'L' ? 1 : -1, k = s.genes.height / 1.62;
      const at = def.hold.hand.map(t => (t.shoulders ?? 0) * s.genes.shoulders + (t.arms ?? 0) * s.genes.arms + (t.k ?? 0) * k);
      return { side, hand: [x * at[0], at[1], at[2]], turn: def.hold.turn, pole: [x * def.hold.pole[0], def.hold.pole[1], def.hold.pole[2]] };
    },
  };
}
export const ITEMS: Record<string, Item> = Object.fromEntries(Object.entries(itemLibrary as unknown as Record<string, ItemDef>).map(([id, d]) => [id, item(d)]));
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
export { euler, GROUP };
