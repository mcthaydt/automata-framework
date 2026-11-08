import { getExampleProject } from '../../src/data/projects'
import { EVIDENCE } from '../../src/data/evidence'
import { allGoldensAgree } from '../../src/lib/evidence'

/** What the home page's load functions give it: the starter project, as the real module has it, and the evidence verdict. */
export const homeData = { starterProject: getExampleProject('base-2d')!, enginesAgree: allGoldensAgree(EVIDENCE) }

