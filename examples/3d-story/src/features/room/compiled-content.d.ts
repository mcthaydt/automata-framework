// The content plugin's module (vite.config.ts), typed as far as this game reads it: everything the content folder
// compiles to, by kind and name. The plugin also writes a full declaration into content/generated/ on the first
// `pnpm dev` or build; this one lets the game type-check before that.
declare module 'virtual:automata/content' {
  export const content: unknown
}
