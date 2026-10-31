import { z } from 'zod'

/** One subscription the player holds. The host computes `active`. */
export interface SubscriptionEntitlement {
  sku: string
  plan: 'monthly' | 'season'
  active: boolean
  seasonId?: string | undefined
  /** ISO 8601 UTC instant. */
  endsAt?: string | undefined
}

/** What the player owns: whether ads show, permanent items and subscriptions, and whether this is a dev build. */
export interface EntitlementsPayload {
  ads: boolean
  items: string[]
  subscriptions: SubscriptionEntitlement[]
  devBuild: boolean
}

/** Checks entitlements. */
export const EntitlementsPayloadSchema: z.ZodType<EntitlementsPayload> = z.object({
  ads: z.boolean(),
  items: z.array(z.string()),
  subscriptions: z.array(
    z.object({
      sku: z.string(),
      plan: z.enum(['monthly', 'season']),
      active: z.boolean(),
      seasonId: z.string().optional(),
      endsAt: z.string().optional(),
    }),
  ),
  devBuild: z.boolean(),
})
