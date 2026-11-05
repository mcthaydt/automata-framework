import { defineTests } from '@mcthaydt/vitest-preset'

// Only the hash parity check runs in browsers; the compiler itself is Node build tooling. The parity tests also run
// in Node, the fourth engine the hashes must match in.
export default defineTests({ alsoInNode: ['tests/browser/**/*.test.ts'] })
