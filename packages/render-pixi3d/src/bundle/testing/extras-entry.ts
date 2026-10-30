// A fixture page script for pixi3d-bundle.test.ts: what render-pixi3d must never ship, @pixi/3d's `./extras`, whose
// particle code probes `new Function` at load (a CSP violation under Ruken, S7-g).
import * as extras from '@pixi/3d/extras'

console.log(extras)
