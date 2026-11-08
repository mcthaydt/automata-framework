import { browserSafePort } from '../../../../packages/tools/src/shared/ship/ports/browser-safe-port.ts'
import { portsFor } from '../../../../packages/tools/src/shared/ship/ports/ports-for.ts'

// The 3D story's game and the editors that edit it, each on its own port from the checkout's pair: 900 above the preview
// port for the game's dev server and 1000 above for `automata editor`, clear of the other examples' (+100 to +800), so one
// `pnpm test:e2e` runs them all side by side. Both step past the browsers' bad ports.
const ports = portsFor(new URL('../../../..', import.meta.url).pathname, process.env)

export const gamePort: number = browserSafePort(ports.preview + 900)
export const editorPort: number = browserSafePort(ports.preview + 1000)
export const gameUrl = `http://localhost:${gamePort}/`
export const editorUrl = `http://127.0.0.1:${editorPort}/`
