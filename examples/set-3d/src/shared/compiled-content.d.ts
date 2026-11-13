// The content plugin's module (`entries/vite.ts`), typed as far as the set reads it: everything the content folder
// compiles to, by kind and name. The plugin also writes a full declaration into content/generated/ on its first run;
// this one lets the set type-check before that, and in a package that imports the set without compiling it.
declare module 'virtual:automata/content' {
  export const content: unknown
}
