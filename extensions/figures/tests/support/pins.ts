import { createHash } from 'node:crypto';
import { BASE } from '../../base/base';
import type { Material } from '../../src/features/body/parts';
import { Figure, type FigureInput } from '../../src/features/figure/figure';
import { member, view } from '../../src/features/figure/frames';
import type { HairStyle } from '../../src/features/hair/hair';
import { EXPRESSIONS, registerGarment, type Expression, type Garment, type Regions } from '../../src/features/outfit/garments';
import { dressed, turned } from '../features/draw';

/**
 * c9-wardrobe's pins (audit S4): the cells the new machinery must leave exactly as they are when its fields are left
 * out, recorded from the code as it stood before c9 touched it. `pinCell(name)` draws a pinned cell now (the recipe sits
 * here, so a task's test can draw its own default case the same way), `PINS` holds the md5 it gave then, and
 * `identity.test.ts` asserts every pin. No test imports another `.test.ts` file: that would run its tests twice.
 * A pin moves only by a ruling written in the commit that moves it (F8 re-records `fear` and `sad`).
 */
declare module '../../src/features/outfit/garments' {
  interface GarmentKinds { fxPaint: { fxPaint: Partial<Regions> } }
}
/** A test kind that only repaints body regions (H1): `{ fxPaint: { shin: 'sheerTest' } }`. Registered once per file that imports this module. */
registerGarment('fxPaint', { build: (_c, item: { fxPaint: Partial<Regions> }) => ({ parts: [], paint: item.fxPaint }) });

const md5 = (b: Uint8ClampedArray) => createHash('md5').update(b).digest('hex');

/** A sheer test material: the skin's four tones mixed `at` of the way toward a dark cloth (`edge`, if given, is c9's rim term). */
export const sheerTest = (at: number, edge?: number): Material => ({
  ramp: 5, base: 3,
  mix: { from: ['#f1c6a0', '#d79d73', '#a86b4a', '#6a3d2c'], to: ['#5c5c70', '#3e3e50', '#2a2a38', '#16161f'], at, ...(edge === undefined ? {} : { edge }) },
});
/** Base-f with her thighs, knees and shins painted the sheer material, drawn in 8 views at density 2. */
export const mixLegs = (edge?: number) => turned(dressed(
  [...BASE[1].def.outfits.base, { fxPaint: { thigh: 'sheerTest', knee: 'sheerTest', shin: 'sheerTest' } }], { sheerTest: sheerTest(0.5, edge) }, BASE[1].def));
/** Base-m with the shoe and sole regions painted (a shod foot), 8 views at density 2. */
export const shodLegs = () => turned(dressed([...BASE[0].def.outfits.base, { fxPaint: { shoe: 'charcoal', sole: 'flatGrey' } }]));
/** The style of a loose fall to the chest on a smooth finish: base-f's scalp-less hair of `fall` alone. */
export const FALL_PLAIN: HairStyle = {
  about: 'pin', finish: 'smooth',
  pieces: [{ fall: { from: [[0, 0.45], [0.7, 0.35], [1.5, 0.0], [2.3, -0.35], [3.1416, -0.5]], part: 0, count: 18, length: 1, curl: 0, volume: 0, rope: { r: 0.14 } } }],
};
/** Base-f with that fall in her own hair colour, 8 views at density 2. */
export const fallPlain = (extra: Record<string, unknown> = {}) => {
  const def = BASE[1].def, outfit = def.outfits.base.map((g: Garment) => ('hair' in g ? { ...g, style: { ...FALL_PLAIN, pieces: [{ fall: { ...(FALL_PLAIN.pieces[0] as { fall: object }).fall, ...extra } }] } as HairStyle } : g));
  return turned(dressed(outfit as Garment[], undefined, def));
};
/** Base-m's face from the front at density `d`, at a clock where `talk`'s mouth is open (the recipe of `moods.test.ts`). */
export function faceCell(expression: Expression, d: 1 | 2): Uint8ClampedArray {
  const f = new Figure(member(BASE[0].def, d)), input: FigureInput = { facing: 0, moving: false, view: view(), expression, clock: 0 };
  for (let i = 0; i < 3; i++) f.update(1 / 60, input);
  return f.painted.slice();
}

/** The md5 of a pinned cell drawn now. */
export function pinCell(name: string): string {
  if (name === 'mixPlain') return md5(mixLegs());
  if (name === 'shodPlain') return md5(shodLegs());
  if (name === 'fallPlain') return md5(fallPlain());
  const m = /^face\/(\w+)@D([12])$/.exec(name);
  if (m && (EXPRESSIONS as readonly string[]).includes(m[1])) return md5(faceCell(m[1] as Expression, Number(m[2]) as 1 | 2));
  throw new Error(`no pin ${name}`);
}
/** The names of the pins: the three cells and base-m's front face in each of today's eight expressions at D1 and D2. */
export const PIN_NAMES: string[] = ['mixPlain', 'shodPlain', 'fallPlain', ...EXPRESSIONS.flatMap(e => [`face/${e}@D1`, `face/${e}@D2`])];
/** The pinned md5s, recorded before c9's first change (`npm run pins`). */
export const PINS: Record<string, string> = {
  'mixPlain': 'd46d740e895018a72b0f103009d74f09',
  'shodPlain': 'a2f66829d9b3d522e5d75d131631a74e',
  'fallPlain': '117ab2cdc34658cca26ea6b85998f534',
  'face/neutral@D1': 'e6d42651f99ddbb176d52cd0e6be5f16',
  'face/neutral@D2': 'bc8a6d55bdf5f3c5c1b1af496829d71c',
  'face/fear@D1': 'e6d42651f99ddbb176d52cd0e6be5f16',
  'face/fear@D2': 'bc8a6d55bdf5f3c5c1b1af496829d71c',
  'face/surprised@D1': '26ba248441157407893d6202155001c5',
  'face/surprised@D2': 'ba76cf54ce3b91a1f0961be3a6e32be4',
  'face/sad@D1': 'e6d42651f99ddbb176d52cd0e6be5f16',
  'face/sad@D2': 'bc8a6d55bdf5f3c5c1b1af496829d71c',
  'face/angry@D1': 'b3b1a968442668faed3598b1d3eb8813',
  'face/angry@D2': '3b779a2a214f0b3cef56e4a9a7d0de11',
  'face/talk@D1': '0f30983d9e7f88b17ef7c88cc9226670',
  'face/talk@D2': 'eb2041c2920cc50458593636276016d1',
  'face/smile@D1': 'ffcc5afb7367fa41fbd58632850d3ad6',
  'face/smile@D2': 'db183cc0f461595643766abee4f2fa62',
  'face/dead@D1': 'e6d42651f99ddbb176d52cd0e6be5f16',
  'face/dead@D2': '97b14cef8e08cac92e887e0044e768af',
};
/** The pin of `name` (the recipe's md5 as it was recorded), for a test to compare its default case against. */
export function pinned(name: string): string {
  const p = PINS[name]; if (!p) throw new Error(`no pin ${name}`); return p;
}
