import { fabricOf, registerFabric, type Fabric } from '../../../src/features/paint/fabric';

/**
 * The fabrics the c3-cloth tests draw with. Fixtures live in tests only: base registers none (H5), so with none named
 * no base pixel moves. `check` is a coarse pattern, `twill` and `rib` are motifs (one step deep), and `across` is a
 * test-only probe: stripes across the body, to look for shear.
 */
const grid = (w: number, h: number, f: (col: number, row: number) => number): number[] =>
  Array.from({ length: w * h }, (_, i) => f(i % w, Math.floor(i / w)));
export const FIXTURES: Record<'check' | 'twill' | 'rib' | 'across', Fabric> = {
  check: { w: 8, h: 8, labels: grid(8, 8, (c, r) => (r < 4 && c < 4 ? 1 : r >= 4 && c >= 4 ? -1 : 0)) },
  twill: { w: 4, h: 4, labels: grid(4, 4, (c, r) => (((c - r) % 4 + 4) % 4 === 0 ? -1 : 0)) },
  rib: { w: 2, h: 1, labels: [0, -1] },
  across: { w: 1, h: 2, labels: [0, -1] },
};
/** Registers each fixture as `fx-<key>`; idempotent within a file (registries are module-global). */
export function registerFixtures(): void {
  for (const [k, f] of Object.entries(FIXTURES)) if (!fabricOf(`fx-${k}`)) registerFabric(`fx-${k}`, f);
}
