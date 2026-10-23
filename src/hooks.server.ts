import type { Handle } from '@sveltejs/kit'
import { hydrateAfterFirstPaint } from '$lib/hydration'
import { withoutChunkPreloads } from '$lib/preloads'

/**
 * Every prerendered page leaves without the modulepreload hints for shared chunks (see `withoutChunkPreloads`) and
 * starts hydrating once the browser has painted (see `hydrateAfterFirstPaint`).
 */
export const handle: Handle = ({ event, resolve }) => resolve(event, { transformPageChunk: ({ html }) => hydrateAfterFirstPaint(withoutChunkPreloads(html)) })
