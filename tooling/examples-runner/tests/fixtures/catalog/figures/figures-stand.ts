// figures-stand: the figures package's entry beside the 3D renderer's
//
// Shows: a catalog fixture.
// Controls: none
// Packages: @mcthaydt/automata, @mcthaydt/automata-figures, @mcthaydt/automata-render-pixi3d
// Difficulty: ★☆☆☆
// Tier: core
import '@mcthaydt/automata-render-pixi3d/no-eval'
import { figureSchema } from '@mcthaydt/automata-figures'
import { figure } from '@mcthaydt/automata-render-pixi3d'

export default { id: 'figures-stand', view: figure, schema: figureSchema }
