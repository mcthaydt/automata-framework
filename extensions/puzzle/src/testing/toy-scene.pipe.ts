// The toy scene as a `puzzle` pipeline's scene module: the pipeline imports a module that exports `puzzle`.
import type { PuzzleScene } from '../entries/solver'
import { toyScene } from './toy-scene'

export const puzzle: PuzzleScene = { ...toyScene(), sources: [{ path: 'toy.puzzle.toml', hash: '' }] }
