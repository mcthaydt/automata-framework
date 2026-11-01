// `@mcthaydt/automata-content/schema`: what a content kind's schema needs in the browser (defining a kind, a reference
// to another kind, a localized text), without the compiler. A page's packages (figures, the 3D renderer's content
// kinds) import these; the root entry would bring the compiler and its Node built-ins into the page.
export {
  type ContentSchemaDef,
  type ContentSchemaOptions,
  type ContentSchemaPlace,
  contentRef,
  defineContentSchema,
  localized,
} from './content-schema'
