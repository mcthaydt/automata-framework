// The door to the figure painter's Pixi view (`@automata/figures/view`): the only entry that loads Pixi, so it has its own
// file and Node code never reaches it. `CellSprite` is a painted cell on a Pixi 3D quad that writes a depth per texel; the
// kit places it (features/painted/place.ts) and the painter draws it, so the look and the depth rule stay the painter's.
// `poseQuaternion` is the turn that squares a quad to the image plane.
export { CellSprite, poseQuaternion } from '@automata/figures/view'
