// The entry of `tsdown.dts.config.ts`: every type of the vendored `@ruken/sdk`, inlined into
// `dist/vendor/ruken-sdk.d.ts` so the published declarations never name `@ruken/sdk` (D-8, M2.4 spec §3.4).
export type * from '@ruken/sdk'
