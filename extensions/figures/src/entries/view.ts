/**
 * The Pixi 3D view: painted figures in a 3D scene (features/view). Its own entry, beside `src/index.ts`, so the rest
 * of the builder (the scripts, the goldens, a fork's Node code) never loads Pixi.
 */

export { anchorOf, facing, poseQuaternion, texelOf, viewFrom } from '../features/view/camera'
export { CellSprite } from '../features/view/cell-sprite'
export { FigureSprite, type FigureSpriteInput } from '../features/view/figure-sprite'
export { StageView } from '../features/view/stage-view'
