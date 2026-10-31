// What has been published, in one place so a page cannot claim more than this file says. `npm` flips to true only when the
// first public release exists (DX.11d: the first publish from npmjs.org, verified by a clean install). Until then the site
// shows no install command and says nothing is published. Pinned by tests/releases.test.ts and tests/restorations.test.ts.
export const PUBLICATION = {
  npm: false,
  proof: null as string | null,
} as const
