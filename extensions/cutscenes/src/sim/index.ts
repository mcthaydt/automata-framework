// @mcthaydt/automata-cutscenes/sim: cutscene scripts as data and their tick-time playback (M6 spec §4.8), a sim entry.

export { anchorsOf, type PlacedActorKey, type PlacedScript, placeScript } from './anchors'
export { CutsceneSkip } from './cutscene.command'
export {
  CutsceneEnded,
  CutsceneStarted,
  type EndedPayload,
  type StartedPayload,
} from './cutscene.event'
export { type Cutscenes, type CutscenesOptions, createCutscenes } from './cutscene.plugin'
export {
  CutsceneScene,
  type CutsceneSceneValue,
  CutsceneState,
  type CutsceneStateValue,
  type SceneScript,
} from './cutscene.resource'
export {
  type ActorKey,
  type CameraKey,
  type Caption,
  type CutsceneScript,
  cutsceneSchema,
  EASES,
  type Ease,
  type LightKey,
  type SoundKey,
  type V3,
} from './cutscene.schema'
export { locked, startCutscene } from './cutscene.system'
export { loadCutscenes } from './load-cutscenes'
