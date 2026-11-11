// The one door to the figure builder (the git submodule at vendor/FigureBuilder, the `figure-builder` workspace package).
// The figures are its own: it generates, poses and paints them, and this kit only shows the cells it paints. Every other
// module reaches it through this file, and nowhere else (tests/unit/painted/door.test.ts), so a refactor upstream breaks
// this file only. Fix the builder upstream and bump the submodule; never patch the vendored copy.
export {
  BASE,
  type CastMember,
  type CharacterDef,
  Figure,
  type FigureInput,
  member,
  standing,
  type View,
} from 'figure-builder'
