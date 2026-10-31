import { deferredProject } from '../data/projects'
import { STARTER_FILE } from '../data/home-sources'
import type { PageServerLoad } from './$types'

// The example sources are 260 KB, every project in one module. A server load keeps them out of the browser: the page's
// data lists base-2d's files and carries only the one shown first. Its universal load once imported the module again at
// hydration, which put the parse on the main thread during Lighthouse's blocking-time window. The explorer fetches
// /sources/base-2d.json when another file is chosen.
export const load = (() => ({ starterProject: deferredProject('base-2d', [STARTER_FILE])! })) satisfies PageServerLoad
