import { describe, expect, it, vi } from 'vitest';
import { BASE } from '../../../base/base';
import { measure } from '../../../src/features/body/genes';
import { J, skeleton } from '../../../src/features/body/rig';
import { GROUP, type Part } from '../../../src/features/body/parts';
import type { Anchor } from '../../../src/features/motion/motion';
import {
  box, dress, registerGarment, registerOutfitHooks, type Garment, type Look,
} from '../../../src/features/outfit/garments';

/**
 * The outfit hooks (garments.ts H1 and H2): a fork registers garment kinds and outfit callbacks, and dress() wears them
 * where the wardrobe was worn before it was cut. Base registers none, so this test registers toy kinds of its own, in its own module
 * scope: vitest isolates test files, so the registry stays empty for every other test. The kinds are augmented into
 * Garment as a fork would augment its own.
 */
declare module '../../../src/features/outfit/garments' {
  interface GarmentKinds {
    sash: { sash: string };
    late: { late: string };
    finale: { finale: string };
    helm: { helm: string };
  }
}

/** The toy kinds' parts are one box each on the chest, told apart by their material. */
const onChest = (material: string): Part => box(J.chest, material, GROUP.torso, { at: [0, 0, 0], r: [0.05, 0.05, 0.05] });
/** The hair a helm presses: every part but the first is dropped, so the press is visible in the part count. */
const press = vi.fn((hair: Part[]) => hair.slice(0, 1));
/** The anchor the anchors hook publishes in place of the kinds' own. */
const SENTINEL: Anchor = { kind: 'hip', bone: J.pelvis, at: [0, 0, 0], open: [0, 0, 1] };
const tie = vi.fn((_: Garment[], __: unknown) => 'charcoal');
const anchors = vi.fn((_c: unknown, _worn: { anchor: Anchor; from: Garment }[], _parts: Part[]) => [SENTINEL]);

registerGarment('sash', { build: () => ({ parts: [onChest('charcoal')], paint: { waist: 'flatGrey' }, anchors: [{ ...SENTINEL, kind: 'frontPocket' }] }) });
registerGarment('late', { build: () => ({ parts: [onChest('flatGrey')] }), last: true });
registerGarment('finale', { build: () => ({ parts: [] }), after: () => ({ parts: [onChest('wood')] }) });
registerGarment('helm', { build: () => ({ parts: [] }), coversHair: () => ({ press }) });
registerOutfitHooks({ tie, anchors });

const def = BASE[0].def, m = measure(def.sliders), s = skeleton(m.genes);
const wear = (...garments: Garment[]): Look => dress(m, s, def.skin, garments);
const HAIR: Garment = { hair: 'hairBlack', style: 'shortFade' };
/** The parts a look has beyond the body's own, which come first. */
const beyondBody = (look: Look) => look.parts.slice(wear().parts.length);

describe('garment kinds (H1)', () => {
  it('wear in order: the outfit, then the kinds built last, then each kind\'s after', () => {
    const look = wear({ finale: 'x' }, { late: 'x' }, { sash: 'x' });
    expect(beyondBody(look).map(p => p.material)).toEqual(['charcoal', 'flatGrey', 'wood']);
  });
  it('a kind\'s paint repaints the body\'s region, and its anchors are published with it', () => {
    const plain = wear(), sashed = wear({ sash: 'x' });
    expect(sashed.parts.length).toBe(plain.parts.length + 1);
    expect(sashed.parts.some(p => p.material === 'flatGrey')).toBe(true);
    expect(plain.parts.some(p => p.material === 'flatGrey')).toBe(false);
    expect(anchors).toHaveBeenLastCalledWith(expect.anything(), [{ anchor: { ...SENTINEL, kind: 'frontPocket' }, from: { sash: 'x' } }], sashed.parts);
  });
  it('registering a name twice throws', () => {
    expect(() => registerGarment('sash', { build: () => ({ parts: [] }) })).toThrow('registered already');
  });
  it('headwear presses the hair it covers', () => {
    const bareHair = beyondBody(wear(HAIR)).length;
    expect(bareHair).toBeGreaterThan(1);
    press.mockClear();
    expect(beyondBody(wear(HAIR, { helm: 'x' }))).toHaveLength(1);
    expect(press).toHaveBeenCalledTimes(1);
  });
});

describe('outfit hooks (H2)', () => {
  it('the tie hook names the tie where the hair entry names none, and the entry wins where it does', () => {
    tie.mockClear();
    wear(HAIR);
    expect(tie).toHaveBeenCalledTimes(1);
    wear({ ...HAIR, tie: 'wood' } as Garment);
    expect(tie).toHaveBeenCalledTimes(1);
  });
  it('the anchors hook gets the kinds\' anchors and every part, and replaces the anchors', () => {
    expect(wear({ sash: 'x' }).anchors).toEqual([SENTINEL]);
  });
  it('a second registration throws', () => {
    expect(() => registerOutfitHooks({})).toThrow('registered already');
  });
});
