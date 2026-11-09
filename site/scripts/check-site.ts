import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { checkSignInDisclosed, checkTargets } from './site-checks/copy.ts'
import { checkCompileWorker, checkEditorChunk } from './site-checks/javascript.ts'
import { builtPages } from './site-checks/pages.ts'
import { checkSite } from './site-checks.ts'

const root = resolve('build')
// The Vite manifest stays in SvelteKit's output, next to the build it describes; it names the editor's chunk.
const editor = checkEditorChunk(
  root,
  JSON.parse(readFileSync(resolve('.svelte-kit/output/client/.vite/manifest.json'), 'utf8')),
)
const worker = checkCompileWorker(root)
const privacy = existsSync(resolve(root, 'privacy.html')) ? readFileSync(resolve(root, 'privacy.html'), 'utf8') : undefined
const failures = [
  ...checkSite(root),
  ...checkTargets(root),
  ...checkSignInDisclosed(privacy, existsSync(resolve('functions/api/github'))),
  ...editor.failures,
  ...worker.failures,
]
if (failures.length) throw new Error(failures.join('\n'))
console.log(
  `Verified ${builtPages(root).length} built pages: titles, metadata, landmarks, links, anchors, no link into the private repository, sitemap, robots.txt, icons, image formats, alt text, fonts, third-party assets, preloaded script weight, hydration after the first paint, the Content-Security-Policy, footer contact, security.txt, banned phrases and the standalone rules (no reference project named, no target cast as the host, the four targets named). The editor chunk is ${editor.gzipBytes} bytes gzip and the compile worker ${worker.gzipBytes}, and no page loads either.`,
)
