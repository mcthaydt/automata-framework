import { type ReferenceSize, VARIANTS } from '@mcthaydt/automata-testing'
import { settleLayout } from '@mcthaydt/automata-ui/testing'

// The window sizes the 2D editor's layout tests run at (2D editor spec §12; plan ED2D.4c2a step 7), shared by every
// `*.layout.test.ts` of the app so they measure the same screens.

export type Mode = 'wide' | 'medium' | 'compact'
export interface EditorSize extends ReferenceSize {
  readonly mode: Mode
}

const at = (
  name: string,
  width: number,
  height: number,
  mode: Mode,
  formFactor: ReferenceSize['formFactor'],
  heightTier: ReferenceSize['heightTier'] = undefined,
): EditorSize => ({ name, width, height, mode, formFactor, heightTier, group: 'tablet' })

export const SIZES: readonly EditorSize[] = [
  at('ipad-pro-11-landscape', 1194, 834, 'wide', 'desktop'),
  at('ipad-pro-13-landscape', 1366, 1024, 'wide', 'desktop'),
  at('ipad-mini-landscape', 1133, 744, 'wide', 'desktop'),
  at('window-900x600', 900, 600, 'wide', 'desktop', 'short'),
  at('ipad-pro-11-portrait', 834, 1194, 'medium', 'tablet-portrait'),
  at('ipad-mini-portrait', 744, 1133, 'medium', 'tablet-portrait'),
  at('phone-portrait', 390, 844, 'compact', 'phone-portrait'),
  at('phone-landscape', 844, 390, 'compact', 'phone-landscape', 'short'),
]

export const REST: (typeof VARIANTS)[number] = ((): (typeof VARIANTS)[number] => {
  const found = VARIANTS.find((variant) => variant.name === 'rest')
  if (found === undefined) throw new Error('no rest variant')
  return found
})()

/** Layout settled and every drawer or sheet that was sliding has arrived: the shell moves them with a 160 ms transition. */
export async function arrived(): Promise<void> {
  await settleLayout()
  await Promise.all(document.getAnimations().map((animation) => animation.finished))
  await settleLayout()
}
