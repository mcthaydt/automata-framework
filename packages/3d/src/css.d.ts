// The typecheck follows imports into `@automataframework/framework`'s sources, whose default screens import stylesheets for
// their side effect; Vite handles them in a build, and this tells TypeScript they exist.
declare module '*.css'
