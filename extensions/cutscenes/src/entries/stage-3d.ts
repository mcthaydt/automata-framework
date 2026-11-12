// @automata/cutscenes/stage-3d: a cutscene drawn in 3D. `cutsceneStage3d` is for a game that has its own play camera, world
// and figures; `cutsceneHooks3d` is the renderer's `scene` hook for a 3D room, with `showScene3d` to draw each moment.
// Presentation only; it reads the director and writes nothing to the sim.
export {
  type ActorView,
  type CutsceneStage3d,
  type CutsceneStage3dOptions,
  cutsceneStage3d,
} from '../features/stage-3d/cutscene-stage-3d.ts'
export {
  type CutsceneHooks3dOptions,
  cutsceneHooks3d,
  type SceneTarget,
  showScene3d,
} from '../features/stage-3d/stage-hooks-3d.ts'
