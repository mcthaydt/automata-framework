// The `scene-lighting` content kind: one TOML file per room under `content/lighting/`, kept out of the sim (light is
// presentation, law 1). A bad lamp, box, plane or fog is a compile error at its file, line and column.
//
// `@mcthaydt/automata-content`'s root entry also exports the Node-only compiler, and this registration rides in
// `render3dExtension`, so it is in every 3D game's browser bundle. Measured 2026-10-30 (M3.4d review): a Vite
// browser build of `defineContentSchema` alone tree-shakes to about 1 KB with no `node:` import and no compiler
// code; the build only warns that the compiler's `node:` modules were externalized (as `figures` already does).
import { type ContentSchemaDef, defineContentSchema } from '@mcthaydt/automata-content'
import { sceneLightingSchema } from './scene-lighting.schema.js'

export const sceneLightingContent: ContentSchemaDef<'scene-lighting', typeof sceneLightingSchema> =
  defineContentSchema('scene-lighting', sceneLightingSchema, { folder: 'lighting' }, { sim: false })
