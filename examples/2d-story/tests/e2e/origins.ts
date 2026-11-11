import { claimPorts } from '../../../../packages/tools/src/shared/ship/ports/free-ports.ts'

// The 2D story's game and the editors that edit it, each on a free port. Both are claimed here, before either server
// starts, because the editors are started with the game's URL (`--game-url`).
const ports = claimPorts(['story-2d-game', 'story-2d-editor'])

export const gamePort: number = ports['story-2d-game']
export const editorPort: number = ports['story-2d-editor']
export const gameUrl = `http://localhost:${gamePort}/`
export const editorUrl = `http://127.0.0.1:${editorPort}/`
