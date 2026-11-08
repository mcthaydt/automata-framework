// The editor asks its own origin `/api/ping` whether `automata editor` serves it (packages/editor, openServedStore).
// The try-it editor at /editor/app/ runs on this site, so the site answers that it is not an editor server: the editor
// then keeps levels in the browser's own storage, and the question gets an answer, not a 404 in the console.
export const prerender = true
export const GET = () => Response.json({ automata: 'site' })
