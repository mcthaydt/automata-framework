// The ward scene as a `systems` pipeline's scene module: the pipeline imports a module that exports `scene`.
import type { SystemsScene } from '../features/bots/scene'
import { wardScene } from './ward-scene'

export const scene: SystemsScene = wardScene()
