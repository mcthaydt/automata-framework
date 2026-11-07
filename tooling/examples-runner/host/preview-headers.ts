import type { ShipConfig } from '@automata/tools'
import { rukenHeaders } from '@automata/tools/internal'
import { Effect } from 'effect'
import { demoHostOrigin } from './ports.ts'

// The headers `vite preview` serves a demo's build with: the ones Ruken would serve it with (`rukenHeaders` on
// the demo's own config, Ruken's CSP with no eval), framable by the shared demo host. Same rule as
// games/emberwick/vite.config.ts, so a demo that breaks under Ruken fails its smoke test.
export function previewHeaders(config: ShipConfig): Record<string, string> {
  return Effect.runSync(rukenHeaders(config, { hostOrigins: [demoHostOrigin] }))
}
