import type { PixiStageHooks } from '@automata/framework'
import { createDirector, type Director } from '../../shared/director/director.ts'
import type { CameraFrame, SceneState } from '../../shared/director/scene-state.ts'
import type { PlacedScript } from '../../shared/sim/anchors.ts'
import { CutsceneEnded, CutsceneStarted, type StartedPayload } from '../../shared/sim/cutscene.event.ts'

// A cutscene in a 3D room. The sim only says that a cutscene started (and on which tick) and that it ended; this follows
// those two events, asks the director for the scene at that time each step, and hands the moment to whatever draws the
// room (`show`). Nothing here changes the game (law 2), so a replay shows the same scene.
//
// A game returns this from its renderer's `scene` hook. The hook runs after the follow camera's, so the scene's camera
// wins while it plays, and the follow camera takes the camera back once the scene ends.

export interface CutsceneStage3dOptions {
  /** The placed scripts by cutscene id. */
  readonly scripts: Readonly<Record<string, PlacedScript>>
  /** Draws one moment of the scene: `showScene3d` over the room's camera, doors and lamps. */
  readonly show: (scene: SceneState) => void
  /** The sim's ticks a second. Default 60. */
  readonly tickHz?: number | undefined
}

/** The cutscene stage for a 3D room, as the hooks the renderer's `scene` returns. */
export function cutsceneStage3d(options: CutsceneStage3dOptions): PixiStageHooks {
  const tickHz = options.tickHz ?? 60
  let playing: { readonly start: number; readonly director: Director } | undefined
  return {
    apply(result) {
      for (const event of result.events) {
        if (event.type === CutsceneStarted.id) {
          const { id, start } = event.payload as StartedPayload
          const script = options.scripts[id]
          // The clips are for figures; a 3D room's people are drawn by their own views, so a cue has nothing to start.
          playing = script === undefined ? undefined : { start, director: createDirector(script, () => {}) }
        } else if (event.type === CutsceneEnded.id) playing = undefined
      }
      if (playing !== undefined)
        options.show(playing.director.stateAt(Math.max(0, (result.tick - playing.start) / tickHz)))
    },
    reset() {
      playing = undefined
    },
  }
}

/** What a scene is drawn on: a camera to write, and optionally the room's doors and props and its lamps. */
export interface SceneTarget {
  readonly camera: { set(shot: CameraFrame): void }
  /** The doors and props as the scene has them. */
  readonly pieces?: ((scene: SceneState) => void) | undefined
  /** The lamps' levels as the scene has them. */
  readonly lamps?: ((levels: SceneState['lamps']) => void) | undefined
}

/** A `show` that writes one moment of a scene into `target`: the camera first, then the doors and props, then the lamps. */
export function showScene3d(target: SceneTarget): (scene: SceneState) => void {
  return (scene) => {
    target.camera.set(scene.camera)
    target.pieces?.(scene)
    target.lamps?.(scene.lamps)
  }
}
