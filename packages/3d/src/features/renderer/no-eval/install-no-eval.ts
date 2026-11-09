/**
 * The 3D renderer under a CSP with no 'unsafe-eval' (Ruken and the dev host). Import it first, in place of
 * `render-pixi/no-eval`, which it imports: Zod's jitless mode and Pixi's eval-free polyfills, then `@pixi/3d`, then
 * the AF-owned shim that lets those polyfills upload `@pixi/3d`'s uniforms (Owner, 2026-10-30, S7-Q1).
 * `allow_eval` is never used. Never import `@pixi/3d/extras`: its particle code probes `new Function` at load.
 */
import '@automata/framework/no-eval'
import '@pixi/3d'
import { installPixi3dUniformSync } from './pixi3d-uniform-sync.ts'

installPixi3dUniformSync()
