// @automata/cutscenes/sim: cutscene scripts as data and their tick-time playback, a sim entry.

export { anchorsOf, type PlacedActorKey, type PlacedScript, placeScript } from '../shared/sim/anchors'
export { CutsceneSkip } from '../shared/sim/cutscene.command'
export {
  CutsceneEnded,
  CutsceneStarted,
  type EndedPayload,
  type StartedPayload,
} from '../shared/sim/cutscene.event'
export { type Cutscenes, type CutscenesOptions, createCutscenes } from '../shared/sim/cutscene.plugin'
export {
  CutsceneScene,
  type CutsceneSceneValue,
  CutsceneState,
  type CutsceneStateValue,
  type SceneScript,
} from '../shared/sim/cutscene.resource'
export {
  type ActorKey,
  type CameraKey,
  type Caption,
  type CueKey,
  type CutsceneScript,
  cutsceneSchema,
  type DoorKey,
  type GradeKey,
  type LightKey,
  type PropKey,
  type SoundKey,
  type TimeKey,
  type V3,
} from '../shared/sim/cutscene.schema'
export { locked, startCutscene } from '../shared/sim/cutscene.system'
export { type AnchorOf, levelAnchors } from '../shared/sim/level-anchors'
export { loadCutscenes } from '../shared/sim/load-cutscenes'
