import type { EntityView } from '@automata/framework'
import type { RenderRow } from '@automata/sim'
import type { Container3D } from '@pixi/3d'
import type { SceneLight } from '../light/scene-light.ts'
import type { ModelLibrary } from '../model/load-models.ts'

/**
 * What the renderer draws beside the scene's meshes, for the views to add to: the figures' layer. It is typed where it
 * is made (`features/figures/layer`), since this folder may not import a feature, and read back by its factory.
 */
export interface ViewLayers3d {
  readonly figures?: unknown
}

/** An entity's view in the 3D scene: `render-pixi`'s `EntityView` over a `Container3D`. */
export type EntityView3d = EntityView<Container3D>

/**
 * Builds the 3D view for one entity, or `undefined` to draw nothing. `componentId` is the component it was
 * registered under (it holds the pose); `models` holds every model file the views named, loaded before the first
 * frame. A factory that draws model files lists them in `models`. `light` is the room's light when the renderer has
 * `lighting`: a moving view tints itself from it each frame (M3R-D4). `layers` are the layers the renderer draws
 * beside the scene's meshes (a view that draws into one asks for it by name).
 */
export interface View3dFactory {
  (
    row: RenderRow,
    componentId: string | undefined,
    models: ModelLibrary,
    light?: SceneLight | undefined,
    layers?: ViewLayers3d | undefined,
  ): EntityView3d | undefined
  readonly models?: readonly string[]
}

/** Component id → its 3D view (`mesh`, `box`). */
export type EntityViewResolver3d = Readonly<Record<string, View3dFactory>>
