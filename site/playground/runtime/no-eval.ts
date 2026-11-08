// The playground frame's first module script (R-6): no-eval, alone, before any runtime chunk evaluates. Bundled into
// the frame script, it ran only after the chunks the frame imports, one of which parsed with Zod before jitless was
// set, so Zod's eval probe tripped the policy (Firefox reports it). Zod and Pixi have chunks of their own
// (vite.config.ts), so this entry evaluates nothing of the runtime's.
import '@mcthaydt/automata/no-eval'
