// Usage: pnpm source-names. Fails, naming file, line and entry (never the name), when published text or the docs name
// a project AF's code was first proven in (src/source-names.ts).
import { fileURLToPath } from 'node:url'
import { findSourceNames } from './source-names.ts'

const findings = findSourceNames(fileURLToPath(new URL('../../..', import.meta.url)))
for (const finding of findings) console.error(finding)
console.log(`source-names: ${findings.length} findings`)
process.exitCode = findings.length > 0 ? 1 : 0
