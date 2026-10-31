// `@mcthaydt/automata-host/target` under the `automata-tauri` condition: a `tauri` build's adapter (DIST spec §5.3,
// §6.1). Same exports and signatures as the other targets.
import type { Effect, Layer, Scope } from 'effect'
import { Layer as EffectLayer } from 'effect'
import type { HostError } from '../contract/errors'
import { Hosting, type HostingOptions } from '../contract/hosting'
import { tauriDesktop } from './desktop-tauri'
import { makeTauriHosting } from './hosting-tauri'

/** The desktop adapter over the webview's window; the host's name is the page's title. The second argument is unused. */
export function makeHosting(
  options: HostingOptions,
  _seams?: unknown,
): Effect.Effect<Hosting, HostError, Scope.Scope> {
  return makeTauriHosting(options, window, tauriDesktop(), document.title || 'Game')
}

/** The single `Hosting` layer for a desktop build. */
export function HostingLive(options: HostingOptions, seams?: unknown): Layer.Layer<Hosting, HostError> {
  return EffectLayer.scoped(Hosting, makeHosting(options, seams))
}
