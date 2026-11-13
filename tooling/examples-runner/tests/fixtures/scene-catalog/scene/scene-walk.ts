// scene-walk: the 3D family's entries, public, in a scene example
//
// Shows: a catalog fixture.
// Controls: none
// Packages: @af-examples/set-3d, @automata/nav, @automata/3d
// Difficulty: ★☆☆☆
// Tier: extension
import { scene } from '@af-examples/set-3d'
import { render3dExtension } from '@automata/3d'
import { navGraph } from '@automata/nav/sim'

export default { id: 'scene-walk', scene, render3dExtension, navGraph }
