import { EVIDENCE } from '../../data/evidence'
import type { PageServerLoad } from './$types'

// Reading the evidence validates it (zod, about 150 KB built). Doing that here, at build time, rather than in the page
// keeps the validator out of the browser's bundle: /proof is static text that the browser only needs to display.
export const load = (() => ({ evidence: EVIDENCE })) satisfies PageServerLoad
