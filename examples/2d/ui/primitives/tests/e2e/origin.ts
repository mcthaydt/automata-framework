import { claimPort } from '../../../../../../packages/tools/src/shared/ship/ports/free-ports.ts'

// The demo's preview build, on a free port of its own.
export const demoPort: number = claimPort('ui-primitives-demo')
export const demoUrl = `http://localhost:${demoPort}/`
