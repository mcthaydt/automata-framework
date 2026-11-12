import { claimPorts } from '../../../../packages/tools/src/shared/ship/ports/free-ports.ts'

// The dev server the journeys play on, on a free port claimed from the operating system when the config loads
// (packages/tools free-ports.ts): two jobs on one machine never meet on a port, and the workers and the server the config starts
// read the same port from the environment. The journeys use the dev server because it is the build that has the probe
// (`__AUTOMATA_DEBUG__`); a release build never does.
const ports = claimPorts(['the-last-light-dev'])

export const devPort: number = ports['the-last-light-dev']
export const devUrl = `http://localhost:${devPort}/`
