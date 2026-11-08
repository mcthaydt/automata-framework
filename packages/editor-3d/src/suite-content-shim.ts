// What the figures package takes from `@mcthaydt/automata-content`, without the content compiler. The package's entry
// also exports `buildContent` and the Paraglide catalogue compile, whose files import Node built-ins at the top; a
// build tree-shakes them away (the package is side-effect free), but Vite's dev server and Vitest's browser mode do
// not, and refuse to read from a Node built-in. The suite's Vite configs point `@mcthaydt/automata-content` here, so
// the Studio's page loads only the schema and the palette it uses. Nothing is copied: these are the package's own files.
// (A browser-safe entry for the content package is the proper home for this; it is a request to that package, not a
// Studio-only workaround.)

export { DEFAULT_PALETTE, type Palette } from '../../content/src/shared/palette/palette'
export {
  type ContentSchemaDef,
  type ContentSchemaOptions,
  type ContentSchemaPlace,
  contentRef,
  defineContentSchema,
  localized,
} from '../../content/src/shared/schema/content-schema'
