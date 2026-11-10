/**
 * The Pixi 3D view: a painted figure in a 3D scene (features/view). Its own entry, beside `src/index.ts`, so the rest
 * of the builder (the scripts, the goldens, a fork's Node code) never loads Pixi.
 */
export { FigureSprite, type FigureSpriteInput } from './features/view/figure-sprite';
export { anchorOf, facing, texelOf, viewFrom } from './features/view/camera';
