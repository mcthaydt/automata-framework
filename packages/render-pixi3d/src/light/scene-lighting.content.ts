// The `scene-lighting` content kind: one TOML file per room under `content/lighting/`, kept out of the sim (light is
// presentation, law 1). A bad lamp, box, plane or fog is a compile error at its file, line and column.
//
// Why not `defineContentSchema`: `@mcthaydt/automata-content`'s root entry reaches its Node-only compiler, and this
// registration rides in `render3dExtension`, which is in every 3D game's browser bundle. A registration is a frozen
// `{ kind, schema, place, sim }` (what `defineContentSchema` returns), so it is written out here with a type-only
// import; the compiler still checks it (`configProblems`) like any other.
import type { ContentSchemaDef } from '@mcthaydt/automata-content'
import { sceneLightingSchema } from './scene-lighting.schema.js'

export const sceneLightingContent: ContentSchemaDef<'scene-lighting', typeof sceneLightingSchema> =
  Object.freeze({
    kind: 'scene-lighting',
    schema: sceneLightingSchema,
    place: { folder: 'lighting' },
    sim: false,
  })
