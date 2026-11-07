// figures-stand: the figures package's entry beside the 3D renderer's
//
// Shows: a catalog fixture.
// Controls: none
// Packages: @automata/framework, @automata/3d
// Difficulty: ★☆☆☆
// Tier: core
import '@automata/3d/no-eval'
import { figure } from '@automata/3d'
import { figureSchema } from '@automata/3d/figures'

export default { id: 'figures-stand', view: figure, schema: figureSchema }
