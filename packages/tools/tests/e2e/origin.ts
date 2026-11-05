import { browserSafePort } from '../../src/shared/ship/ports/browser-safe-port.ts'
import { portsFor } from '../../src/shared/ship/ports/ports-for.ts'

// Where the new game's preview listens: 500 above the checkout's preview port (5200–5299), clear of the other
// areas' servers (the ui demo +100, the frame budget +200, Emberwick +300, the examples' host on the server port
// +500), so this journey runs beside theirs and never tests another checkout's game.
const ports = portsFor(new URL('../../../..', import.meta.url).pathname, process.env)

export const newGamePort: number = browserSafePort(ports.preview + 500)
export const newGameUrl: string = `http://localhost:${newGamePort}/`
