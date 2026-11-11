// What crisp asks of core's renderer: the letterbox's `scale` option (`createPixiRenderer`, and `createPixi3dRenderer`, which
// passes it on). Spread it into the renderer's options: `createPixi3dRenderer({ ...options, ...crispRendererOptions(crisp) })`.

import type { CrispProfile } from './crisp-profile.schema.ts'

export function crispRendererOptions(profile: CrispProfile): { readonly scale: 'fit' | 'whole' } {
  return { scale: profile.scale === 'letterbox' ? 'whole' : 'fit' }
}
