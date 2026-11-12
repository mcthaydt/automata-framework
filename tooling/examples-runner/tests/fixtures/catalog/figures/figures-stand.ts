// figures-stand: the figures package's entry beside the 3D renderer's
//
// Shows: a catalog fixture.
// Controls: none
// Packages: @automataframework/framework, @automataframework/3d
// Difficulty: ★☆☆☆
// Tier: core
import '@automataframework/3d/no-eval'
import { figure } from '@automataframework/3d'
import { figureSchema } from '@automataframework/3d/figures'

export default { id: 'figures-stand', view: figure, schema: figureSchema }
