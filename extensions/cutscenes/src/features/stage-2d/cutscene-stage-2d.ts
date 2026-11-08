import type { ContentLevel, ContentProject } from '@automata/content/level-2d'
import {
  type Camera2d,
  type LevelScene,
  type LevelSceneHooks,
  type PictureViewOptions,
  pictureView,
} from '@automata/framework'
import { Graphics } from 'pixi.js'
import { createDirector, type Director } from '../../shared/director/director.ts'
import type { PlacedScript } from '../../shared/sim/anchors.ts'
import { CutsceneState } from '../../shared/sim/cutscene.resource.ts'

// A cutscene on the 2D level. The sim only says which cutscene is under way and the tick it started on (CutsceneState);
// this reads that each frame, asks the director for the scene at that time, and moves what a person sees: the camera, the
// placed characters the script names, and the fade. Nothing here changes the game (law 2), so a replay shows the same scene.
//
// The plan is in metres and the level in pixels, so every point the script gives is multiplied by `metre` here and
// nowhere else. The camera's `pos` and `lens` are a 3D idea: a flat stage looks at `look`, and the zoom stays the game's.

/** What `pictureView` makes: a factory of the view of one character. */
type ViewFactory = ReturnType<typeof pictureView>

export interface CutsceneStage2dOptions {
  /** The level scene to draw into (`levelScene(...)`). */
  readonly scene: LevelScene
  readonly project: ContentProject
  /** The level the cutscenes play in: the characters in it are the actors. */
  readonly level: ContentLevel
  /** The pictures the build gave the game, for the characters. */
  readonly images: Readonly<Record<string, string>>
  /** The game's camera. The stage points it at the scene's `look` for as long as the cutscene lasts. */
  readonly camera: Camera2d
  /** Level pixels to a metre; the same number `level2dPlaces` was given. */
  readonly metre: number
  /** The placed scripts by cutscene id. */
  readonly scripts: Readonly<Record<string, PlacedScript>>
  /** The size of the game's view in level pixels, for the fade to cover. */
  readonly view: { readonly width: number; readonly height: number }
  /** The sim's ticks a second. Default 60. */
  readonly tickHz?: number | undefined
  /** How a character is drawn. Default: core's `pictureView`, which draws it as the editor shows it. */
  readonly viewOf?: ((def: string, options: PictureViewOptions) => ViewFactory) | undefined
}

interface Actor {
  readonly view: ReturnType<ViewFactory>
  readonly itemId: string
}

const report = (message: string): void => globalThis.reportError?.(new Error(message))

/** The cutscene stage. It adds itself to `options.scene` and is returned for a test to drive. */
export function cutsceneStage2d(options: CutsceneStage2dOptions): LevelSceneHooks {
  const { project, level, camera, metre, view } = options
  const tickHz = options.tickHz ?? 60
  const viewOf =
    options.viewOf ?? ((def, viewOptions) => pictureView(project, def, options.images, viewOptions))

  /** The placed characters by the name a person gave them in the editor. */
  const placed = new Map<string, { id: string; def: string }>()
  for (const layer of level.layers)
    if (layer.kind === 'entities')
      for (const item of layer.items) {
        const name = item.fields.name
        if (typeof name === 'string' && name !== '') placed.set(name, { id: item.id, def: item.def })
      }

  const told = new Set<string>()
  const once = (message: string): void => {
    if (told.has(message)) return
    told.add(message)
    report(message)
  }

  const firstClip = (def: string): string =>
    project.entities.find((candidate) => candidate.id === def)?.animation?.clips[0]?.id ?? ''

  let playing:
    | { key: string; script: PlacedScript; director: Director; clips: Map<string, string> }
    | undefined
  const actors = new Map<string, Actor>()
  let fade: Graphics | undefined
  let hide: ((itemId: string, hidden: boolean) => void) | undefined

  /** Takes away everything the stage put in the scene and shows the placed characters again. */
  function teardown(): void {
    for (const actor of actors.values()) {
      hide?.(actor.itemId, false)
      actor.view?.container.removeFromParent()
      actor.view?.destroy?.()
    }
    actors.clear()
    fade?.destroy()
    fade = undefined
    playing = undefined
  }

  const hooks: LevelSceneHooks = {
    draw(sim, scene) {
      hide = scene.hide
      const state = sim.resource(CutsceneState)
      const script = state.id === null ? undefined : options.scripts[state.id]
      if (state.id === null || script === undefined) {
        if (playing !== undefined) teardown()
        return
      }
      const key = `${state.id}@${state.start}`
      if (playing?.key !== key) {
        teardown()
        const clips = new Map<string, string>()
        playing = {
          key,
          script,
          clips,
          director: createDirector(script, (who, clip) => clips.set(who, clip)),
        }
      }
      const t = Math.max(0, (sim.tick - state.start) / tickHz)
      const at = playing.director.stateAt(t)

      camera.target(at.camera.look[0] * metre, at.camera.look[2] * metre)

      for (const [who, frame] of Object.entries(at.actors)) {
        const item = placed.get(who)
        if (item === undefined) {
          once(
            `The cutscene "${script.id}" has an actor "${who}", but no character in the level is named "${who}".`,
          )
          continue
        }
        let actor = actors.get(who)
        if (actor?.view?.container.destroyed === true) actor = undefined
        if (actor === undefined) {
          const made = viewOf(item.def, {
            clip: (components) => String(components.actor?.clip ?? firstClip(item.def)),
          })({ sid: -1, components: {} }, 'actor')
          if (made === undefined) continue
          actor = { view: made, itemId: item.id }
          actors.set(who, actor)
          scene.container.addChild(made.container)
          scene.hide(item.id, true)
        }
        const clip = playing.clips.get(who) ?? firstClip(item.def)
        actor.view?.update?.(
          { actor: { x: frame.x * metre, y: frame.z * metre, angle: 0, clip } },
          undefined,
          1,
        )
        if (actor.view !== undefined) actor.view.container.alpha = frame.alpha
      }

      if (at.fade > 0) {
        if (fade === undefined || fade.destroyed) {
          fade = new Graphics()
          fade.label = 'cutscene-fade'
        }
        const { x, y, scale } = camera.transform
        fade
          .clear()
          .rect(-x / scale, -y / scale, view.width / scale, view.height / scale)
          .fill(0x000000)
        fade.alpha = at.fade
        // Last, so it covers the characters too.
        scene.container.addChild(fade)
      } else if (fade !== undefined) {
        fade.destroy()
        fade = undefined
      }
    },
  }
  options.scene.add(hooks)
  return hooks
}
