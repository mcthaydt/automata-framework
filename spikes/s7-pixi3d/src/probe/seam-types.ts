// S7-Q5 at the type level (checked by `tsc -p .`, never run): each @ts-expect-error below must stay an error, so
// tsc passing proves Container3D is not assignable where render-pixi takes a pixi Container. The lines without one
// prove View3D is a pixi Container (a ViewContainer) and mounts in `setup(stage)`, and that the camera's fov is a
// plain number of degrees.
import type { EntityView } from '@mcthaydt/automata-render-pixi/delta'
import { RenderDeltaConsumer } from '@mcthaydt/automata-render-pixi/delta'
import type { PixiStage } from '@mcthaydt/automata-render-pixi/renderer'
import type { Camera3D, Container3D, Mesh3D, View3D } from '@pixi/3d'

export function seams(
  stage: PixiStage,
  view: View3D,
  root: Container3D,
  mesh: Mesh3D,
  camera: Camera3D,
): void {
  stage.world.addChild(view)
  // @ts-expect-error Container3D extends EventEmitter, not pixi's Container
  new RenderDeltaConsumer(root)
  // @ts-expect-error a Mesh3D is a Container3D, not a pixi Container
  const asView: EntityView = { container: mesh }
  void asView
  const fov: number = camera.fov
  void fov
}
