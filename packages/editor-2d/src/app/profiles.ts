import { floorFiftyStage } from '../profiles/floorfifty-stage/floorfifty-stage'
import { levelProject } from '../profiles/level-project/level-project'
import { createProfileRegistry, type ProfileRegistry } from '../profiles/profile'

// The registration list (2D editor spec §4): the one file in `app/` that names a profile. The editor opens, lists and
// creates documents through the registry it returns and never mentions a profile id, so adding a profile is one line
// here. The FloorFifty stage joined in EDFF.2a.

export function createAppProfiles(): ProfileRegistry {
  const registry = createProfileRegistry()
  registry.register(levelProject)
  registry.register(floorFiftyStage)
  return registry
}
