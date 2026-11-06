// The `camera-view` content kind (M3 spec §4.2): `content/camera-views/<id>.toml`, one view each, compiled and hashed
// like all content. It goes to the sim, which reads a view's `rotate` and `yawDeg` (the heading is sim state).
import { type ContentSchemaDef, defineContentSchema } from '@mcthaydt/automata-content/schema'
import { cameraViewSchema } from '../sim/camera-view.schema.js'

export const cameraViewContent: ContentSchemaDef<'camera-view'> = defineContentSchema(
  'camera-view',
  cameraViewSchema,
  {
    folder: 'camera-views',
  },
)
