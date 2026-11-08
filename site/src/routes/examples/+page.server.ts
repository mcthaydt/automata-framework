import { exampleIndex } from '../../shared/framework/example-catalog'
import type { PageServerLoad } from './$types'

// A server load, so the catalog and its sources never reach the browser: the prerendered page carries only the
// summaries. Any query (the retired gallery's ?demo=) gets this same page.
export const load = (async () => ({ index: exampleIndex() })) satisfies PageServerLoad
