// The toy scene as a `narrative` pipeline's scene module: the pipeline imports a module that exports `narrative`.
import type { NarrativeToolsScene } from '../features/tools/scene'
import { toyNarrativeScene } from './toy-trace'

export const narrative: NarrativeToolsScene = toyNarrativeScene()
