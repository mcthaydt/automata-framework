// Where the editor is. It is the framework's own build, copied into the site at /editor/app/, not one of the site's
// routes, so a link to it must load the page whole (`data-sveltekit-reload`) instead of asking the router for it.

/** The address of the editor, which every "Editor" link opens. */
export const EDITOR_URL = '/editor/app/'

/**
 * The value for a link's `data-sveltekit-reload`: set (empty) for a link to the editor, absent for any other. Spread
 * into an anchor as `data-sveltekit-reload={reloads(href)}`.
 */
export const reloads = (href: string): '' | undefined => (href === EDITOR_URL ? '' : undefined)
