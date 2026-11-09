import { defineTests } from '@automata/vitest-preset'

// `tests/unit`: the kit's registrations, dresser, lettering, library, maps, textures and checks, on Node. `tests/browser`:
// the look passes on a real WebGL2 context. Svelte compiles the runtime's screens, which `@automata/3d`'s renderer reaches
// through `@automata/framework`.
export default defineTests({ svelte: true, optimizeDeps: ['zod'] })
