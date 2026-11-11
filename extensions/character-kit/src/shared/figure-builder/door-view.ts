// The door to the figure builder's Pixi view (`figure-builder/view`): the only entry that loads Pixi, so it has its own
// file and Node code never reaches it. `CellSprite` is a painted cell on a Pixi 3D quad that writes a depth per texel; the
// kit places it (features/painted/place.ts) and the builder draws it, so the look and the depth rule stay the builder's.
// `poseQuaternion` is the turn that squares a quad to the image plane. The builder's view sources import pixi.js and
// @pixi/3d, and a bundler resolves them from their real path inside the submodule: up to the repository root's
// node_modules, which is why the root package.json lists both.
export { CellSprite, poseQuaternion } from 'figure-builder/view'
