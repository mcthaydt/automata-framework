// The modules frameworkData() (vite-plugin.ts) serves, typed by the loaders that compute them.

declare module 'virtual:framework/guides' {
  const guides: import('./guides.ts').Guide[]
  export default guides
}
declare module 'virtual:framework/demos' {
  const demos: import('./demos.ts').Demo[]
  export default demos
}
declare module 'virtual:framework/api' {
  const reference: import('./api.ts').ApiReference
  export default reference
}
declare module 'virtual:framework/api-search' {
  const rows: import('./api.ts').ApiSearchRow[]
  export default rows
}
declare module 'virtual:framework/llms' {
  const llms: { readonly full: string; readonly api: string }
  export default llms
}
declare module 'virtual:framework/examples' {
  const examples: import('../../../playground/src/playground-catalog.ts').PlaygroundExample[]
  export default examples
}
declare module 'virtual:framework/facts' {
  const facts: import('./facts.ts').SiteFacts
  export default facts
}
declare module 'virtual:framework/changelog' {
  const entries: import('./changelog.ts').ChangelogEntry[]
  export default entries
}
