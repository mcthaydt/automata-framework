// figures-stand: the figures package's entry beside the 3D renderer's
//
// Shows: a catalog fixture.
// Controls: none
// Packages: @automataframework/automata, @automataframework/automata-figures, @automataframework/automata-render-pixi3d
// Difficulty: ★☆☆☆
// Tier: core
import '@automataframework/automata-render-pixi3d/no-eval'
import { figureSchema } from '@automataframework/automata-figures'
import { figure } from '@automataframework/automata-render-pixi3d'

export default { id: 'figures-stand', view: figure, schema: figureSchema }
