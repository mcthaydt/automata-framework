import { base3dPort } from '../../../tooling/examples-runner/host/ports.ts'

// base-3d's preview build for the browser journeys, served from /b/<buildId>/ as Ruken serves it, on the port after
// the feature demos' (tooling/examples-runner/host/ports.ts), and framed by their shared fake host.
export const gamePort: number = base3dPort
export const gameBuildPath = '/b/202610310000-e2e0b3d/'
export const gameUrl = `http://localhost:${gamePort}${gameBuildPath}`
