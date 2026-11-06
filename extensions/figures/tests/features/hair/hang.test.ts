import { describe, expect, it } from 'vitest';
import { BASE } from '../../../base/base';
import { measure } from '../../../src/features/body/genes';
import { GROUP, reach, type Material, type Part } from '../../../src/features/body/parts';
import { J, skeleton } from '../../../src/features/body/rig';
import { headForm } from '../../../src/features/body/head';
import type { CharacterDef } from '../../../src/features/figure/cast';
import { Figure } from '../../../src/features/figure/figure';
import { member, view, walking } from '../../../src/features/figure/frames';
import { hairParts, registerFinish, registerHairPiece, skull, toHead, type HairStyle, type Piece } from '../../../src/features/hair/hair';
import { insideHead } from '../../../src/features/body/head';
import { NECK, SWATCHES } from '../../../src/features/outfit/garments';

/**
 * Hair that hangs (c4 stage 5): the low pony (Tail.hang 'down'), the bun and the fall, each worn over the base blocks on
 * base-f. A style here is data this test owns (no base style uses a new piece): the base's top crop for a scalp, and the
 * piece under test.
 */
const f = BASE[1].def;
/** The base fade's second piece (the top crop, lift 0.06): copied from hair.json so this test stands alone. */
const SCALP: Piece = { scalp: { from: [[0, 0.5], [0.5, 0.5], [0.7, 0.4], [1.2, 0.34], [1.9, 0.3], [3.1416, 0.14]], lift: 0.06, edge: 0.35, crown: 0.03, ridges: [9, 0.08], comb: 'back', sheen: { count: 14, from: 0.45, to: 0.95 } } } as Piece;
const wearing = (style: HairStyle): CharacterDef => ({ ...f, outfits: { base: f.outfits.base.map(g => ('hair' in g ? { ...g, style } : g)) } });
const style = (finish: string, ...pieces: Piece[]): HairStyle => ({ about: 'a test style', finish, pieces: [SCALP, ...pieces] });
const filled = (px: Uint8ClampedArray) => { let n = 0; for (let i = 3; i < px.length; i += 4) if (px[i]) n++; return n; };
/** The figure standing in view d at density D, updated three times. */
function stand(def: CharacterDef, d: number, D: number, tweak?: (fig: Figure) => void) {
  const fig = new Figure(member(def, D));
  tweak?.(fig);
  for (let i = 0; i < 3; i++) fig.update(1 / 60, { facing: d * Math.PI / 4, moving: false, view: view() });
  return fig;
}
const builtParts = (fig: Figure) => (fig as unknown as { built: { parts: Part[]; materialIndex: Map<string, number> } }).built;
const HAIR = (p: number) => p >= 2000 && p < 3000;

/** A style's parts as hairParts builds them on base-f, with the dressed trunk the figure wears. */
function look(st: HairStyle) {
  const def = wearing(st), fig = new Figure(member(def, 2)), m = measure(def.sliders), s = skeleton(m.genes);
  const trunk = builtParts(fig).parts.filter(p => p.group === GROUP.torso);
  const swatch = (name: string): Material => ({ ...SWATCHES, ...def.swatches })[name];
  return { ...hairParts({ m, s, hair: 'hairBlack', skin: def.skin, swatch, trunk }, st), m, s, trunk };
}

/** Every view and the walk (D2; D4 the views only) builds and paints; the same hair never trips the neckline rule. */
export function draws(st: HairStyle) {
  const def = wearing(st);
  for (const D of [2, 4]) for (let d = 0; d < 8; d++) expect(filled(stand(def, d, D).painted), `D${D} view ${d}`).toBeGreaterThan(400);
  walking(member(def, 2)).forEach((fr, i) => expect(filled(fr), `walk ${i}`).toBeGreaterThan(400));
}
/**
 * The neckline check, for hair: `neckline.test.ts`'s teeth() is 0 after the rule by construction, so it cannot catch hair. The
 * risk is the rule joining neck texels into the hair (it takes any non-neck part of one material). Each view is drawn twice,
 * as it is and with the neck's tag deleted before the first update (the rule then finds no neck): every texel whose part
 * differs between the two takes the top's material, and none takes a hair part.
 */
export function necklineSpares(st: HairStyle) {
  const def = wearing(st);
  for (const D of [2, 4]) for (let d = 0; d < 8; d++) {
    const a = stand(def, d, D), b = stand(def, d, D, fig => builtParts(fig).parts.forEach(p => { if (p.tag === NECK) delete p.tag; }));
    const top = builtParts(a).materialIndex.get('flatGrey')!;
    let changed = 0;
    for (let k = 0; k < a.g.w * a.g.h; k++) if (a.g.part[k] !== b.g.part[k]) {
      changed++;
      expect(a.g.material[k], `D${D} view ${d} texel ${k} joins the top`).toBe(top);
      expect(HAIR(a.g.part[k]), `D${D} view ${d} texel ${k} is not hair`).toBe(false);
    }
    expect(changed, 'the rule ran at all').toBeGreaterThanOrEqual(0);
  }
}
/** The trunk check: at rest, every hung hair vertex below the shoulder, inside the trunk's width, lies behind the trunk by
 * hair.ts's own measure (`reach` of the dressed trunk along −z, as the tail's `trunkBack` takes it). */
export function clearOfTrunk(st: HairStyle) {
  const { parts, trunk, s } = look(st);
  for (const p of parts) if (p.skin) for (let i = 0; i < p.mesh.positions.length; i += 3) {
    const [x, y, z] = [p.mesh.positions[i], p.mesh.positions[i + 1], p.mesh.positions[i + 2]];
    if (y >= s.shoulderY) continue;
    const r = reach(trunk, s.rest, [0, y, 0], [0, 0, -1]);
    if (r > 0 && Math.abs(x) < 0.2) expect(z, `vertex y ${y.toFixed(3)} x ${x.toFixed(3)}`).toBeLessThanOrEqual(-r + 1e-6);
  }
}

const LOW: Piece = { tail: { at: [0, 0.15, -0.98], hang: 'down', count: 6, rope: { r: 0.2 }, rise: 0, length: 0.8, spread: [0.25, 0.4] } } as Piece;
describe('the low pony', () => {
  it('has no rise and no arc: no tail vertex higher than the tie\'s centre plus one rope radius', () => {
    const { parts, m, s } = look(style('smooth', LOW)), k = skull(s), form = headForm(m, s), head = s.rest[J.head];
    const tie = head[1] + toHead(form, k, [0, 0.15, -0.98], 0.05)[1], ar = 0.2 * k.r[0];
    const tail = parts.filter(p => p.skin);
    expect(tail.length).toBeGreaterThan(0);
    for (const p of tail) for (let i = 1; i < p.mesh.positions.length; i += 3) expect(p.mesh.positions[i]).toBeLessThanOrEqual(tie + ar + 1e-6);
  });
  it('builds and paints in every view and the walk', () => draws(style('smooth', LOW)));
  it('stays clear of the trunk', () => clearOfTrunk(style('smooth', LOW)));
  it('does not trip the neckline rule at the collar', () => necklineSpares(style('smooth', LOW)));
  it('registers the smooth and curl finishes, so a fork cannot take the names', () => {
    expect(() => registerFinish('smooth', { tones: [0, 0, 0], matte: false })).toThrow('registered already');
    expect(() => registerFinish('curl', { tones: [0, 0, 0], matte: true })).toThrow('registered already');
  });
});

const BUN_AT = { nape: [0, -0.35, -1], crown: [0, 0.95, -0.2] } as const;
const bun = (at: readonly number[], extra = {}): Piece => ({ bun: { at, r: 0.5, rope: { r: 0.18 }, tie: true, ...extra } }) as Piece;
describe('the bun', () => {
  for (const [name, at] of Object.entries(BUN_AT)) {
    const st = style('smooth', bun(at));
    it(`${name}: rigid on the head only, wholly outside the head's form`, () => {
      const { parts, m, s } = look(st), form = headForm(m, s), hairs = parts.slice(look(style('smooth')).parts.length);
      expect(hairs.length, 'the bun adds parts').toBeGreaterThan(0);
      for (const p of hairs) {
        expect(p.bone, 'rigid on the head').toBe(J.head); expect(p.skin, 'not skinned').toBeUndefined();
        for (let i = 0; i < p.mesh.positions.length; i += 3) expect(insideHead(form, [p.mesh.positions[i], p.mesh.positions[i + 1], p.mesh.positions[i + 2]]), `vertex ${i / 3}`).toBe(false);
      }
    });
    it(`${name}: builds and paints in 8 views, the walk, and spares the neckline`, () => { draws(st); necklineSpares(st); });
  }
  it('takes the next seam after the pieces before it, and is no crown', () => {
    const before = look(style('smooth')).parts, after = look(style('smooth', bun(BUN_AT.nape))).parts.slice(before.length);
    expect(after.every(p => p.seam! >= 2100 && p.tag === undefined)).toBe(true);
  });
  it('is a base piece: a name a fork cannot take', () => {
    expect(() => registerHairPiece('bun', { build: () => undefined })).toThrow('registered already');
  });
});
