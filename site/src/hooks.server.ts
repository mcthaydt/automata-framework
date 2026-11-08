import type { Handle } from '@sveltejs/kit'
import { finishPage } from '$lib/finish-page'

/** Every prerendered page leaves through `finishPage`: fewer preloads, hydration after the first paint, and its CSP. */
export const handle: Handle = ({ event, resolve }) =>
  resolve(event, { transformPageChunk: ({ html }) => finishPage(html) })
