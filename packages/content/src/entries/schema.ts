// @automata/content/schema: what a content kind's schema needs in the browser (defining a kind, a
// reference to another kind, a localized text), without the compiler. A page's packages import this; the root entry
// is the compiler, and its Node built-ins throw at boot in Vite's dev server.
export {
  type ContentSchemaDef,
  type ContentSchemaOptions,
  type ContentSchemaPlace,
  contentRef,
  defineContentSchema,
  localized,
} from '../shared/schema/content-schema'
