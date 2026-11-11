import { defineTests } from '@automata/vitest-preset'

// `tests/unit`: the policy, the resolver, the wall groups and the room masks (a `Container3D` tree needs no GL context), on
// Node. There are no browser tests: the masks draw through core's view, which the example's journey covers.
export default defineTests({ browsers: [] })
