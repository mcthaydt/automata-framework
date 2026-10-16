import { resolve } from 'node:path'
import { builtPages, checkSite } from './site-checks.ts'

const root = resolve('build')
const failures = checkSite(root)
if (failures.length) throw new Error(failures.join('\n'))
console.log(`Verified ${builtPages(root).length} built pages: titles, metadata, main landmarks, links and anchors.`)
