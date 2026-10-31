import type { PipelineDef } from './pipeline.ts'
import { puzzlePipeline } from './puzzle.pipeline.ts'
import { systemsPipeline } from './systems.pipeline.ts'

// The pipelines both bins serve (`automata-pipe` and `automata-pipe-mcp`): `puzzle` (M6.6b) and `systems` (M6.7b). Character and props
// arrive in M3.9 and show as planned (exit 2) until then.
export const REGISTERED: readonly PipelineDef[] = [
  puzzlePipeline as PipelineDef,
  systemsPipeline as PipelineDef,
]
