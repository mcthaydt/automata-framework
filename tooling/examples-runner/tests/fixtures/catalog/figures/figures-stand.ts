// figures-stand: the figures package's entry beside the 3D renderer's
//
// Shows: a catalog fixture.
// Controls: none
// Packages: @automata/framework, @automata/figures, @automata/render-pixi3d
// Difficulty: ★☆☆☆
// Tier: core
import '@automata/render-pixi3d/no-eval'
import { figureSchema } from '@automata/figures'
import { figure } from '@automata/render-pixi3d'

export default { id: 'figures-stand', view: figure, schema: figureSchema }
