// The `ruken` target's adapter entry points; `entries/target/ruken.ts` re-exports them.
import type { HostResult } from '../../../shared/host/errors'
import type { Hosting, HostingOptions } from '../../../shared/host/hosting'
import { createRukenHosting, type HostingSeams } from './hosting-ruken'

/** The plain adapter: `Hosting` over `Ruken.init`, or the host's refusal. */
export function createHosting(options: HostingOptions, seams?: HostingSeams): Promise<HostResult<Hosting>> {
  return createRukenHosting(options, seams)
}
