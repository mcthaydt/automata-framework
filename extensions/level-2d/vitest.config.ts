import { defineTests } from '@automata/vitest-preset'

// Level-2d is sim code and pure maths: no browser project.
export default defineTests({ browsers: [] })
