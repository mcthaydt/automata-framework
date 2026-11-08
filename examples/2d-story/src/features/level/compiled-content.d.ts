// The content plugin's module (vite.config.ts), typed as far as this game reads it: the compiled levels, by id, the
// editor's project and levels that the screen draws, and the story's files by kind (each kind's files by id). The plugin
// also writes a full declaration into content/generated/ on the first `pnpm dev` or build; this one lets the game
// type-check before that.
declare module 'virtual:automata/content' {
  type Files = Readonly<Record<string, unknown>> | undefined
  export const simContent: { readonly levels?: Readonly<Record<string, unknown>> }
  export const content: {
    readonly project?: unknown
    readonly levels?: Readonly<Record<string, unknown>>
    readonly lines?: Files
    readonly dialogue?: Files
    readonly cutscene?: Files
    readonly 'nav-graph'?: Files
    readonly systems?: Files
  }
}
