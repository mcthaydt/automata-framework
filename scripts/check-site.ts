import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { builtPages, checkEditorChunk, checkSite } from './site-checks.ts'

const root = resolve('build')
// The Vite manifest stays in SvelteKit's output, next to the build it describes; it names the editor's chunk.
const editor = checkEditorChunk(root, JSON.parse(readFileSync(resolve('.svelte-kit/output/client/.vite/manifest.json'), 'utf8')))
const failures = [...checkSite(root), ...editor.failures]
if (failures.length) throw new Error(failures.join('\n'))
console.log(`Verified ${builtPages(root).length} built pages: titles, metadata, landmarks, links, anchors, sitemap, robots.txt, icons, image formats, alt text, fonts, third-party assets, preloaded script weight, hydration after the first paint, the Content-Security-Policy, footer contact, security.txt and banned phrases. The editor chunk is ${editor.gzipBytes} bytes gzip and no page loads it.`)
