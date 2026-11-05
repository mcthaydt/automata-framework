import { z } from 'zod'

/**
 * What a game may ask its host for. The names are Ruken's (`@ruken/protocol` `CAPABILITIES`),
 * kept where they fit; `ruken/conformance.test.ts` holds them to the vendored SDK. Each target's adapter says
 * which it grants.
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
