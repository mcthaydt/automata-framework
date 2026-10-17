// The fixture workspace the tests read: alpha (`.`, `./sub`, a CSS entry, a Svelte re-export, a re-export from
// beta), beta (version 1.2.0) and gamma (excluded, as `physics` is from the real core list).
import { fileURLToPath } from 'node:url'

export const FIXTURE_ROOT: string = fileURLToPath(new URL('../fixtures/repo', import.meta.url))
export const FIXTURE_EXCLUDED: Readonly<Record<string, string>> = { gamma: 'an extension in the fixture' }
