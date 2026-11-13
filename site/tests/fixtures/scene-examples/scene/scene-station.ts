// scene-station: a fixture scene example that imports only the set
//
// Shows: an example the site must leave out while the set's own package depends on a package a stranger could not
//   install, though its file imports nothing private by name.
// Controls: none
// Packages: @af-examples/set-3d
// Difficulty: ★☆☆☆
// Tier: core
import { scene } from '@af-examples/set-3d'

export default scene({ start: 'platform' })
