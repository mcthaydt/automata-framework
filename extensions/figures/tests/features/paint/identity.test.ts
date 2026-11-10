import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { BASE } from '../../../base/base';
import { Figure } from '../../../src/features/figure/figure';
import { member } from '../../../src/features/figure/frames';
import { TIMES } from '../../../src/features/lighting/lamps';
import { lightFigure, type Lighting } from '../../../src/features/lighting/light';
import type { Garment } from '../../../src/features/outfit/garments';
import { SWATCHES } from '../../../src/features/outfit/garments';
import type { Material } from '../../../src/features/body/parts';
import { dressed, turned } from '../draw';

/**
 * c5-finish's pins, recorded before any painter change: the drawings the tile-last pass, the handed reading and the dark
 * gloss sheen must leave exactly as they are, to the texel. The materials cases (materials.test.ts's probe), a dark
 * metal (`chromeDark`: no gloss), a light gloss, a matte black, and the base pair lit with no fabric named (through
 * `lightFigure` at night under a spot, and through the light hook). Never edit a hash here to make a change pass.
 */
const md5 = (b: Uint8ClampedArray) => createHash('md5').update(b).digest('hex');
const probe: Material = { ramp: 5, base: 3 };
const outfit: Garment[] = [{ top: 'probe', sleeves: 'long' }, { shorts: 'probe' }];
const draw = (swatch: Material) => md5(turned(dressed(outfit, { probe: swatch })));

describe('materials the c5-finish painter changes must not move', () => {
  const cases: [string, Material, string][] = [
    ['the plain probe', probe, '66ab8abb0fa47bf09feb7f94951a93e4'],
    ['holo', { ...probe, holo: true }, '87f2d001e7ed3e0611890d941c9ad507'],
    ['a mirror', { ...probe, holo: 'mirror' }, 'beec0ff39940f6a587da50247f64bef3'],
    ['a stain', { ...probe, stain: { paint: ['#d8c8a0', '#b8a070', '#887048', '#584828'], hem: 0.3, below: 0.9 } }, 'f1ea085f5ff880f5deab201afbf6af2d'],
    ['strands', { ...probe, strands: true }, 'a85a0c31d0985ec2b3e1a9bc00134938'],
    ['chromeDark', SWATCHES.chromeDark, 'b45a1f223f6c2b8540eb5efe1240ac9e'],
    ['a light gloss', { ramp: 10, base: 6, gloss: 0.7 }, '73404d96a173fd36234a7505217072a6'],
    ['a matte black', { ramp: 0, base: 1 }, '5bedaf5a1266e30e3c88b03b98d50955'],
  ];
  for (const [name, swatch, hash] of cases) it(name, () => expect(draw(swatch)).toBe(hash));
});

describe('an unfabricked figure lit is unchanged', () => {
  const night: Lighting = {
    time: TIMES.night,
    lamps: [{ at: [0, 3.2, 0.6], color: '#fff3d6', steps: 3, radius: 4, tint: 0.35, aim: [0, -1, 0], cone: 26 }],
    t: 0, bounce: { floor: 0x5b5c69 },
  };
  const drawn = (i: number, d: number, how: 'lamps' | 'hook') => {
    const f = new Figure(member(BASE[i].def, 2));
    f.cache = false;
    if (how === 'hook') f.light = () => [1, 0.9, 0.8];
    for (let k = 0; k < 3; k++) f.update(1 / 60, { facing: d * Math.PI / 4, moving: false, view: { azimuth: 0, pitch: 18 * Math.PI / 180 } });
    return md5(how === 'lamps' ? lightFigure(f, night) : f.painted);
  };
  const pins: Record<string, string> = {
    'lamps 0 0': '2757a1c571ad9078042b2105f5379c71', 'lamps 0 4': '1d3b136711383ea9dba1c314f6f545be', 'lamps 1 0': 'ad1b4c8363a18e306521225160cac6e4', 'lamps 1 4': 'af3bed48f28930166b461c8505b75b97',
    'hook 0 0': 'e8d90429a0ca694c1a71fb794f520904', 'hook 0 4': 'd79f341486be8bace4228eb6b9323254', 'hook 1 0': '246a660cf0068ea220b86fd0582d3a2a', 'hook 1 4': 'c788b42e5a22fc7423a65958cae73baf',
  };
  for (const [key, hash] of Object.entries(pins)) {
    const [how, i, d] = key.split(' ');
    it(`${how}: ${BASE[Number(i)].def.id}, direction ${d}`, () => expect(drawn(Number(i), Number(d), how as 'lamps' | 'hook')).toBe(hash));
  }
});
