// The entry of `tsdown.config.ts`: what game imports from the vendored `@ruken/manifest`, bundled into
// `dist/vendor/ruken-manifest.js` so the published package never names `@ruken/manifest` (D-8).
export { SLUG_RE } from '@ruken/manifest'
