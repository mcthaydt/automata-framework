import type { StyleFinding } from './style.ts'

// Tests import the code they test by the package's `#src/…` alias, never by a relative chain into `src/`: a chain
// breaks when a test moves and hides how far a test reaches. Only imports are read; a path built with `join` is not one.
const SRC_CHAIN = /(?:\bfrom\s+|\bimport\(\s*|\bmock\(\s*|\bimportActual\(\s*|\bimport\s+)['"](?:\.\.\/)+src\//

/** One finding per line of a test file that imports `src/` by a relative chain. */
export function testImportFindings(file: string, code: string): StyleFinding[] {
  const out: StyleFinding[] = []
  code.split('\n').forEach((text, index) => {
    if (SRC_CHAIN.test(text))
      out.push({
        file,
        rule: 'test-src-chain',
        message: 'Import the code under test as #src/… instead of a relative chain into src/.',
        line: index + 1,
      })
  })
  return out
}
