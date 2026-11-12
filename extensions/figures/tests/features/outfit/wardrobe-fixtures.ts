import type { Garment, Regions } from '../../../src/features/outfit/garments';
import { registerGarment } from '../../../src/features/outfit/garments';
import type { ShoeForm } from '../../../src/features/outfit/shoe';

/**
 * The fixture kinds c9's tests draw with (H1). Fixtures live in tests only: base registers no garment kind, so with none
 * worn no base pixel moves. FB has no way to unregister a kind, and vitest isolates test files, so `useFixtures()`
 * registers them once per file, guarded; what varies goes in the item, and every kind's name starts `fx` so none is a
 * field of another kind's items.
 *
 * - `fxShod`, `fxShodToo`: a kind that paints the `shoe` and `sole` regions and returns the given form (two names, for the
 *   two-kinds-that-both-set-a-shoe case);
 * - F7 adds `fxPrinted` (a decal carrying a print).
 */
declare module '../../../src/features/outfit/garments' {
  interface GarmentKinds {
    fxShod: { fxShod: string; form?: ShoeForm };
    fxShodToo: { fxShodToo: string; form?: ShoeForm };
  }
}
let registered = false;
/** Registers the fixture kinds, once for this test file. */
export function useFixtures(): void {
  if (registered) return;
  registered = true;
  const paint = (swatch: string): Partial<Regions> => ({ shoe: swatch, sole: 'flatGrey' });
  registerGarment('fxShod', { build: (_c, item: { fxShod: string; form?: ShoeForm }) => ({ parts: [], paint: paint(item.fxShod), shoe: item.form }) });
  registerGarment('fxShodToo', { build: (_c, item: { fxShodToo: string; form?: ShoeForm }) => ({ parts: [], paint: paint(item.fxShodToo), shoe: item.form }) });
}
/** A shoe in the swatch, in the form: the item of `fxShod`. */
export const shod = (swatch: string, form?: ShoeForm): Garment => ({ fxShod: swatch, form });
/** The same under a second kind's name. */
export const shodToo = (swatch: string, form?: ShoeForm): Garment => ({ fxShodToo: swatch, form });
