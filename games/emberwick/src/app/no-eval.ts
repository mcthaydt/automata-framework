// Ruken serves games under a CSP with no 'unsafe-eval', and so does the dev host. Two libraries would otherwise
// generate code at runtime:
//
// - Pixi probes for `new Function` when its renderer is built and throws if the probe is blocked;
//   `pixi.js/unsafe-eval` swaps its generated functions for static ones (despite the name, it is the no-eval
//   build).
// - Zod's fast path compiles validators with `new Function`. Jitless mode validates without it. The sim parses
//   every command with Zod.
//
// Imported first by `main.ts`, so both are in place before anything renders or parses. Moves to
// the renderer's `no-eval` entry.
import 'pixi.js/unsafe-eval'
import { config } from 'zod'

config({ jitless: true })
