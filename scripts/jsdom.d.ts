// jsdom ships no types and the site only needs its constructor and window; this keeps svelte-check strict
// for scripts/site-checks.ts, which the Vitest suite imports.
declare module 'jsdom' {
  export class JSDOM {
    constructor(html: string)
    readonly window: Window & typeof globalThis
  }
}
