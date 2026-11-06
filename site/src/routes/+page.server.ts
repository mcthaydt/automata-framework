import { deferredProject } from '../data/projects'
import { STARTER_FILE } from '../data/home-sources'
import type { PageServerLoad } from './$types'

// Decided at build time, so it never reaches the browser's bundle: the starter project. The example sources are
// 260 KB, every project in one module; the page's data lists Emberwick's files and carries only the one shown first.
// A universal load once imported the module again at hydration, which put the parse on the main thread during
// Lighthouse's blocking-time window. The explorer fetches /sources/emberwick.json when another file is chosen.
export const load = (() => ({
  starterProject: deferredProject('emberwick', [STARTER_FILE])!,
})) satisfies PageServerLoad
