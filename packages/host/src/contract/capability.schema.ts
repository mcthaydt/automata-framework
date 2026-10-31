import { z } from 'zod'

/**
 * What a game may ask its host for (DIST spec §4.1). The names are Ruken's (`@ruken/protocol` `CAPABILITIES`),
 * kept where they fit; `ruken/conformance.test.ts` holds them to the vendored SDK. Which target grants which is in
 * the DIST spec §4.3.
 */
export const CAPABILITIES = [
  'lifecycle',
  'input',
  'display',
  'audio',
  'exit',
  'menu',
  'saves',
  'leaderboards',
  'entitlements',
  'store',
  'ads',
  'telemetry',
  'analytics.custom',
  'links',
] as const

/** One capability a game may ask for. */
export type Capability = (typeof CAPABILITIES)[number]

/** Checks a capability name. */
export const CapabilitySchema: z.ZodType<Capability> = z.enum(CAPABILITIES)
