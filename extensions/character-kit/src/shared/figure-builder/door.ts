// The door to the figure builder (the git submodule at vendor/FigureBuilder, the `figure-builder` workspace package),
// the half that is plain TypeScript: its `index` and `kit` entries, safe in Node. The figures are its own: it generates,
// poses and paints them, and this kit shows the cells it paints. Every module reaches the builder through this file (and
// `door-view.ts`, the half that loads Pixi) and nowhere else (tests/unit/shared/door.test.ts), so a refactor upstream
// breaks these files only. Fix the builder upstream and bump the submodule; never patch the vendored copy.
//
// It takes the builder's stage contract (vendor/FigureBuilder/docs/contract.md, `STAGE_VERSION` 1) as the kit's
// placement and the wardrobe need it, and no more: a name is added here by the change that first uses it.
export {
  BASE,
  type Backdrop,
  type CameraPose,
  type CastMember,
  type Cell,
  type CharacterDef,
  cellOf,
  compose,
  type Fabric,
  Figure,
  HAIR_STYLES,
  type HairFinish,
  type HairStyle,
  type Material,
  member,
  POSES,
  project,
  registerFabric,
  registerFinish,
  ScriptedActor,
  SPRITE_PITCH,
  STAGE_VERSION,
  type StageFrame,
  type StageSprite,
  SWATCHES,
  stageFrame,
  standing,
  TIE_BIAS,
  texelDepths,
  type V3,
  type View,
  viewOf,
  zoomOf,
} from 'figure-builder'
