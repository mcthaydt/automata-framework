// Builds the figure builder's declarations (tsconfig.types.json) from the submodule. With the submodule not checked out
// (a clone without `--recurse-submodules`, or a CI job without the read token) it says so and builds nothing, so the
// install goes on; what imports the builder then fails to typecheck, by name.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'

const here = new URL('.', import.meta.url).pathname
if (!existsSync(`${here}../FigureBuilder/src/index.ts`)) {
  console.warn(
    'figure-builder: vendor/FigureBuilder is not checked out (git submodule update --init), so its declarations were not built',
  )
  process.exit(0)
}
const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc')
execFileSync(process.execPath, [tsc, '-p', `${here}tsconfig.types.json`], { stdio: 'inherit' })
