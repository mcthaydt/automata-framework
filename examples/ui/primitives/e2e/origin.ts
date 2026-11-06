import { browserSafePort } from '../../../../packages/ship/src/ports/browser-safe-port.ts'
import { portsFor } from '../../../../packages/ship/src/ports/ports-for.ts'

// The demo's preview build, on its own port: the checkout's preview port plus 100 (4800–4899), so it never
// meets Emberwick's game or host pages, nor FloorFifty's 4400–4599. AF_E2E_DEMO_PORT overrides.
const ports = portsFor(new URL('../../../..', import.meta.url).pathname, process.env)

export const demoPort: number = Number(process.env.AF_E2E_DEMO_PORT ?? browserSafePort(ports.preview + 100))
export const demoUrl = `http://localhost:${demoPort}/`
