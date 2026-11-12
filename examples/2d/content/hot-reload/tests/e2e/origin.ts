import { fileURLToPath } from 'node:url'
import { demoPort } from '@automataframework/examples-runner/host/ports'

// This demo's servers: its production build in slot 1 and its dev server in slot 2 of the feature demos
// (tooling/examples-runner/host/ports.ts). The dev server compiles a copy of content/ in `.e2e/` (package.json `e2e:dev`)
// that the hot-reload check edits, so the committed room is never touched.
export const port: number = demoPort(1)
export const url = `http://localhost:${port}/`
export const devPort: number = demoPort(2)
export const devUrl = `http://localhost:${devPort}/`
export const GAME_ID = 'demo-content-hot-reload'
export const e2eRoomFile: string = fileURLToPath(new URL('../../.e2e/content/room.toml', import.meta.url))
