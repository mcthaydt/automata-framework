import { audioPipeline } from './audio.pipeline.ts'
import { narrativePipeline } from './narrative.pipeline.ts'
import type { PipelineDef } from './pipeline.ts'
import { puzzlePipeline } from './puzzle.pipeline.ts'
import { systemsPipeline } from './systems.pipeline.ts'

// The pipelines both bins serve (`automata-pipe` and `automata-pipe-mcp`): puzzle, systems, narrative and audio.
// Character and props show as planned (exit 2) until they exist.
export const REGISTERED: readonly PipelineDef[] = [
  puzzlePipeline as PipelineDef,
  systemsPipeline as PipelineDef,
  narrativePipeline as PipelineDef,
  audioPipeline as PipelineDef,
]
