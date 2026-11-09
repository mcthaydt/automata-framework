// Usage: pnpm source-names [--code <folder>...]. Fails, naming file, line and entry (never the name), when published text or the docs name
// a project AF's code was first proven in (src/source-names.ts).
import { fileURLToPath } from 'node:url'
import { findSourceNames } from './source-names.ts'

// `--code <folder>...` also reads the code files under those folders (a game's or package's source and tests).
const args = process.argv.slice(2)
const at = args.indexOf('--code')
const code = at === -1 ? [] : args.slice(at + 1).filter((arg) => !arg.startsWith('--'))
const findings = findSourceNames(fileURLToPath(new URL('../../..', import.meta.url)), { code })
for (const finding of findings) console.error(finding)
console.log(`source-names: ${findings.length} findings`)
process.exitCode = findings.length > 0 ? 1 : 0
