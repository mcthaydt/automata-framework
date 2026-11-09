// A fixture page script for pixi3d-bundle.test.ts: the 3D renderer as a game ships it, through the main entry.
import '../../entries/no-eval.ts'
import { box, createPixi3dRenderer } from '../../entries/index.ts'

console.log(createPixi3dRenderer({ views: { crate: box({ width: 1, height: 1, depth: 1 }, { color: 0 }) } }))
