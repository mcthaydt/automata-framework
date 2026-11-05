// The `tauri` target's adapter entry points (DIST spec §5.3, §6.1); `entries/target/tauri.ts` re-exports them.
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
import { tauriDesktop } from './desktop-tauri'
import { createTauriHosting } from './hosting-tauri'

/** The plain desktop adapter over the webview's window; the host's name is the page's title. */
export async function createHosting(options: HostingOptions, _seams?: unknown): Promise<HostResult<Hosting>> {
  return ok(await createTauriHosting(options, window, tauriDesktop(), document.title || 'Game'))
}

/** The adapter the runtime still reads (an Effect), until task 5.4 converts it. */
export const makeHosting: MakeHosting<unknown> = bridgeHosting<unknown>(createHosting)

/** The single `Hosting` layer for a desktop build. */
export const HostingLive: HostingLayer<unknown> = bridgeLayer<unknown>(makeHosting)
