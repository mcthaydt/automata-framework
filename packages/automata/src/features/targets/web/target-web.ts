// The `itch` and `web` targets' adapter entry points; `entries/target/web.ts` re-exports them.
// They take the Ruken adapter's arguments, so `@mcthaydt/automata/target` can swap one for the other; the second
// argument is the Ruken SDK's test seam and means nothing here.
import type { HostResult } from '../../../shared/host/errors'
import type { Hosting, HostingOptions } from '../../../shared/host/hosting'
import { ok } from '../../../shared/lib/result'
import { buildTarget, createWebHosting } from './hosting-web'

/** The plain adapter over the real page. */
export async function createHosting(options: HostingOptions, _seams?: unknown): Promise<HostResult<Hosting>> {
  return ok(createWebHosting(options, window, buildTarget()))
}
