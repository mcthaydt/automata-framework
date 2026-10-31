import { EVIDENCE } from '../data/evidence'
import { allGoldensAgree } from '$lib/evidence'
import type { PageServerLoad } from './$types'

// Whether the evidence file proves cross-engine determinism, decided at build time so the validator (zod) stays out
// of the homepage's bundle; see proof/+page.server.ts.
export const load = (() => ({ enginesAgree: allGoldensAgree(EVIDENCE) })) satisfies PageServerLoad
