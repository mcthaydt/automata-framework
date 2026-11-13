import { resolve } from 'node:path'

// Where the examples index's end-to-end run saves its screenshots for the Owner: the repository root's `evidence/`, which
// .gitignore covers. Resolved from the repository root, not by counting `../` from the test, which landed in `tooling/`.
const repoRoot = resolve(import.meta.dirname, '../../..')

export const examplesIndexEvidenceDir: string = resolve(repoRoot, 'evidence/examples-index')
