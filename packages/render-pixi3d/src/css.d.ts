// The typecheck follows imports into `@mcthaydt/automata`'s sources, whose default screens import stylesheets for
// their side effect; Vite handles them in a build, and this tells TypeScript they exist.
declare module '*.css'
