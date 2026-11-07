// The ward scene with a cautious-bot win-rate floor no run can meet (above 1), for the pipeline's failing check.
import type { SystemsScene } from '../bots/scene'
import { WARD_SYSTEMS, wardScene } from './ward-scene'

const def = WARD_SYSTEMS()
export const scene: SystemsScene = wardScene({ ...def, fairness: { ...def.fairness, cautiousWin: 1.01 } })
