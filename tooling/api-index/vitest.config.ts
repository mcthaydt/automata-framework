import { defineTests } from '@automata/vitest-preset'

// Every test runs on Node, so there is no browser project.
export default defineTests({ browsers: [] })
