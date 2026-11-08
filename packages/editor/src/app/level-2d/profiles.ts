import { levelProject } from '../../shared/level-2d/profiles/level-project/level-project'
import { createProfileRegistry, type ProfileRegistry } from '../../shared/level-2d/profiles/profile'

// The registration list: the one file in `app/` that names a profile. The editor opens, lists and
// creates documents through the registry it returns and never mentions a profile id, so adding a profile is one line
// here.

export function createAppProfiles(): ProfileRegistry {
  const registry = createProfileRegistry()
  registry.register(levelProject)
  return registry
}
