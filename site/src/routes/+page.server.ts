import { EVIDENCE } from '../data/evidence'
import { allGoldensAgree } from '$lib/evidence'
import { deferredProject } from '../data/projects'
import { STARTER_FILE } from '../data/home-sources'
import type { PageServerLoad } from './$types'

// Both decided at build time, so neither reaches the browser's bundle:
// - whether the evidence file proves cross-engine determinism (the validator, zod, stays out; see proof/+page.server.ts);
// - the starter project. The example sources are 260 KB, every project in one module; the page's data lists base-2d's
//   files and carries only the one shown first. A universal load once imported the module again at hydration, which put
//   the parse on the main thread during Lighthouse's blocking-time window. The explorer fetches /sources/base-2d.json
//   when another file is chosen.
export const load = (() => ({
  enginesAgree: allGoldensAgree(EVIDENCE),
  starterProject: deferredProject('base-2d', [STARTER_FILE])!,
})) satisfies PageServerLoad
