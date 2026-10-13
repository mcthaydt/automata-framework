import { checkManifest, rukenToml, type ShipConfig } from '@mcthaydt/automata-ship'
import { compileHeaders } from '@ruken/manifest'
import { Effect } from 'effect'
import { demoHostOrigin } from './ports.ts'

// The headers `vite preview` serves a demo's build with: the ones Ruken would serve it with (compileHeaders on
// the demo's own manifest, Ruken's CSP with no eval), framable by the shared demo host. Same rule as
// examples/base-2d/vite.config.ts, so a demo that breaks under Ruken fails its smoke test.
export function previewHeaders(config: ShipConfig): Record<string, string> {
  return compileHeaders(Effect.runSync(checkManifest(rukenToml(config))), { hostOrigins: [demoHostOrigin] })
}
