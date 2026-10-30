/**
 * The client runs under a CSP with no 'unsafe-eval' (Ruken and dev host).
 *
 * Two libraries generate code at runtime by default:
 * - Pixi probes for `new Function` when its renderer is built and throws if blocked;
 *   `pixi.js/unsafe-eval` swaps its generated functions for static ones.
 * - Zod's fast path compiles validators with `new Function`. Jitless mode validates
 *   without it, and skips the probe that triggers securitypolicyviolation.
 *
 * Pixi's texture loader also checks ImageBitmap support in a Blob worker that fetches a `data:` URL, which the
 * CSP's `connect-src` refuses (WebKit and Firefox report it). Textures load on the main thread instead.
 *
 * Imported first by any game entry point before schemas or renderer setup.
 */

import 'pixi.js/unsafe-eval'
import { loadTextures } from 'pixi.js'
import { config } from 'zod'

config({ jitless: true })
// Pixi types the loader's config as optional; a Pixi without it would leave the probe on, so say so.
const textureConfig = loadTextures.config
if (textureConfig === undefined)
  throw new Error('pixi.js loadTextures has no config, so no-eval cannot turn off its worker probe')
textureConfig.preferWorkers = false
