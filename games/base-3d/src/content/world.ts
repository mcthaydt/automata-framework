// The shipped world (GAME-3D.1i): the first slice, where a new game starts, and the Cold Kiln its kiln leads to.
import type { AreaSource } from '../systems/index.ts'
import { FIRST_SLICE } from './first-slice.ts'
import { KILN } from './kiln.ts'

export const WORLD_SOURCES: readonly AreaSource[] = [FIRST_SLICE, KILN]
