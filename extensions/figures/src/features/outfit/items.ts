import { axisAngle, type V3 } from '../../lib/math';
import type { Side, Skeleton } from '../body/rig';
import type { Hold } from '../motion/motion';
import { box } from './garments';
import { GROUP, type Part } from '../body/parts';
import itemLibrary from './library/items.json';
/** A held thing, in a hand socket (library/items.json): its parts and the arm pose that holds it. */
export interface Item {
  /** The item's parts, authored in its socket's space (+z up when held upright). */
  parts: (socket: number) => Part[];
  /** The arm pose that holds it, for a skeleton and a hand. */
  hold: (s: Skeleton, side: Side) => Hold;
}
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
/** Every item, by id (library/items.json). */
export const ITEMS: Record<string, Item> = Object.fromEntries(Object.entries(itemLibrary as unknown as Record<string, ItemDef>).map(([id, d]) => [id, item(d)]));
