// The `scene-lighting` content kind: one TOML file per room under `content/lighting/`, kept out of the sim (light is
// presentation, law 1). A bad lamp, box, plane or fog is a compile error at its file, line and column.
//
// This registration rides in `render3dExtension`, so it is in every 3D game's page: it imports content's
// browser-safe `/schema` entry. The root entry is the compiler; a production build tree-shakes its Node built-ins
// away, but Vite's dev server loads them and the page throws at boot.
import { type ContentSchemaDef, defineContentSchema } from '@automata/content/schema'
import { sceneLightingSchema } from './scene-lighting.schema.ts'

export const sceneLightingContent: ContentSchemaDef<'scene-lighting', typeof sceneLightingSchema> =
  defineContentSchema('scene-lighting', sceneLightingSchema, { folder: 'lighting' }, { sim: false })
