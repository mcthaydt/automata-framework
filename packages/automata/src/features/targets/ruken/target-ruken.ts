// The `ruken` target's adapter entry points; `entries/target/ruken.ts` re-exports them.
import {
  bridgeHosting,
  bridgeLayer,
  type HostingLayer,
  type MakeHosting,
} from '../../../shared/host/effect-bridge'
import type { HostingOptions } from '../../../shared/host/hosting'
import type { HostResult } from '../../../shared/host/plain-errors'
import type { Hosting } from '../../../shared/host/plain-hosting'
import { createRukenHosting, type HostingSeams } from './hosting-ruken'

/** The plain adapter: `Hosting` over `Ruken.init`, or the host's refusal. */
export function createHosting(options: HostingOptions, seams?: HostingSeams): Promise<HostResult<Hosting>> {
  return createRukenHosting(options, seams)
}

/** The adapter the runtime still reads (an Effect), until task 5.4 converts it. */
export const makeHosting: MakeHosting<HostingSeams> = bridgeHosting<HostingSeams>(createRukenHosting)

/** The single `Hosting` layer for a `ruken` build. */
export const HostingLive: HostingLayer<HostingSeams> = bridgeLayer<HostingSeams>(makeHosting)
