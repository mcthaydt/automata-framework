// `@mcthaydt/automata-sector-format/blockout`: the blockout file format and its expansion (M6-D18). Not a sim entry: a sim never
// reads a blockout, so it sits outside `automata.simEntries` and outside the boundaries scan of `src/`; it is the build-time half
// the editor and the `pipe blockout` pipeline share.
export * from './blockout.schema'
export * from './expand'
