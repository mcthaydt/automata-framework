import { audioPipeline } from '../features/audio/audio-pipeline.ts'
import { narrativePipeline } from '../features/narrative/narrative-pipeline.ts'
import { puzzlePipeline } from '../features/puzzle/puzzle-pipeline.ts'
import { systemsPipeline } from '../features/systems/systems-pipeline.ts'
import type { PipelineDef } from '../shared/pipeline.ts'

// The pipelines both bins serve (`automata-pipe` and `automata-pipe-mcp`): puzzle, systems, narrative and audio.
// Character and props show as planned (exit 2) until they exist.
export const REGISTERED: readonly PipelineDef[] = [
  puzzlePipeline as PipelineDef,
  systemsPipeline as PipelineDef,
  narrativePipeline as PipelineDef,
  audioPipeline as PipelineDef,
]
