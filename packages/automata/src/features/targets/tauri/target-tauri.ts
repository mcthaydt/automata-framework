// The `tauri` target's adapter entry points; `entries/target/tauri.ts` re-exports them.
import type { HostResult } from '../../../shared/host/errors'
import type { Hosting, HostingOptions } from '../../../shared/host/hosting'
import { ok } from '../../../shared/lib/result'
import { tauriDesktop } from './desktop-tauri'
import { createTauriHosting } from './hosting-tauri'

/** The plain desktop adapter over the webview's window; the host's name is the page's title. */
export async function createHosting(options: HostingOptions, _seams?: unknown): Promise<HostResult<Hosting>> {
  return ok(await createTauriHosting(options, window, tauriDesktop(), document.title || 'Game'))
}
