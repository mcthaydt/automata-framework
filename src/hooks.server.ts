import type { Handle } from '@sveltejs/kit'
import { withoutChunkPreloads } from '$lib/preloads'

/** Every prerendered page leaves without the modulepreload hints for shared chunks (see `withoutChunkPreloads`). */
export const handle: Handle = ({ event, resolve }) => resolve(event, { transformPageChunk: ({ html }) => withoutChunkPreloads(html) })
