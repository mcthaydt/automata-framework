// The S7 scene as S7-Q1 asks for it: render-pixi/no-eval first, then the scene.
import '@mcthaydt/automata-render-pixi/no-eval'
import { startScene } from './scene-page.ts'

startScene()
