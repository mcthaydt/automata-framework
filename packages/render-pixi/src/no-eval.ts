/**
 * The client runs under a CSP with no 'unsafe-eval' (Ruken and dev host).
 *
 * Two libraries generate code at runtime by default:
 * - Pixi probes for `new Function` when its renderer is built and throws if blocked;
 *   `pixi.js/unsafe-eval` swaps its generated functions for static ones.
 * - Zod's fast path compiles validators with `new Function`. Jitless mode validates
 *   without it, and skips the probe that triggers securitypolicyviolation.
 *
 * Imported first by any game entry point before schemas or renderer setup.
 */

import 'pixi.js/unsafe-eval'
import { config } from 'zod'

config({ jitless: true })
