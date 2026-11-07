// The `itch` and `web` targets' adapter entry points; `entries/target/web.ts` re-exports them.
// They take the Ruken adapter's arguments, so `@mcthaydt/automata/target` can swap one for the other; the second
// argument is the Ruken SDK's test seam and means nothing here.
import {
  bridgeHosting,
  bridgeLayer,
  type HostingLayer,
  type MakeHosting,
} from '../../../shared/host/effect-bridge'
import type { HostingOptions } from '../../../shared/host/hosting'
import type { HostResult } from '../../../shared/host/plain-errors'
import type { Hosting } from '../../../shared/host/plain-hosting'
import { ok } from '../../../shared/lib/result'
import { buildTarget, createWebHosting } from './hosting-web'

/** The plain adapter over the real page. */
export async function createHosting(options: HostingOptions, _seams?: unknown): Promise<HostResult<Hosting>> {
  return ok(createWebHosting(options, window, buildTarget()))
}

/** The adapter the runtime still reads (an Effect), until task 5.4 converts it. */
export const makeHosting: MakeHosting<unknown> = bridgeHosting<unknown>(createHosting)

/** The single `Hosting` layer for a web build, as `HostingLive` is for a Ruken build. */
export const HostingLive: HostingLayer<unknown> = bridgeLayer<unknown>(makeHosting)
