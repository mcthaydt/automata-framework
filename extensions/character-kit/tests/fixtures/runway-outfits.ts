// The eight runway outfits as garment lists (what the models of `cast.ts` wear), for the fit test, which dresses them on every
// slider extreme. The names are the runway's: swatches and hair styles of `src/features/fashion`, and the builder's own.
import type { Garment } from '#src/shared/figure-builder/door.ts'

export const RUNWAY_OUTFITS: Readonly<Record<string, readonly Garment[]>> = {
  mara: [
    { tee: 'ribBlack', sleeves: 'long' },
    { trousers: 'charcoalWool' },
    { shoes: 'leatherOxblood' },
    { coat: 'plaid', length: 0.8 },
  ],
  dre: [
    { tee: 'teeWhite' },
    { jeans: 'denim' },
    { shoes: 'sneakerWhite', sole: 'soleWhite' },
    { jacket: 'leatherBlack', collar: 'leatherBlack', zip: 'chrome' },
  ],
  june: [
    { dress: 'gingham', length: 0.72, sleeves: 'short', flare: 0.6 },
    { shoes: 'leatherBrown', sole: 'soleGum' },
  ],
  theo: [{ jeans: 'denimLight' }, { shoes: 'sneakerWhite', sole: 'soleGum' }, { hoodie: 'hoodieGreen' }],
  edith: [
    { tee: 'ribCream', sleeves: 'long', ease: 2, length: 0.4 },
    { skirt: 'plaidGrey', length: 0.66, flare: 0.3 },
    { shoes: 'leatherBlack', sole: 'soleBlack' },
  ],
  sam: [
    { tee: 'teeWhite' },
    { trousers: 'charcoalWool', wide: 1.1 },
    { shoes: 'leatherBlack', sole: 'soleBlack' },
    { jacket: 'pinstripe', inner: 'teeWhite' },
  ],
  nia: [
    { tee: 'breton', length: 0.1 },
    { skirt: 'mustard', length: 0.45, flare: 0.5 },
    { shoes: 'sneakerWhite', sole: 'soleWhite' },
  ],
  otto: [
    { tee: 'checkShirt', sleeves: 'long' },
    { trousers: 'olive' },
    { shoes: 'leatherBrown', sole: 'soleBlack' },
    { jacket: 'camel', inner: 'checkShirt' },
  ],
}
