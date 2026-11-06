import { defineTests } from '@mcthaydt/vitest-preset'

// The umbrella's surface, in jsdom: it re-exports the game package, whose default screens are Svelte components with
// CSS, so Svelte compiles them and resolves its client build.
export default defineTests({ environment: 'jsdom', svelte: true, css: true, browsers: [] })
