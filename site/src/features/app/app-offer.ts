// What the Automata app costs, where to buy it and what downloading it gives you. Every editor is free on the web. Every price, place to
// buy and list on /app is read from here, so when the app goes on sale this file is the one thing that changes. The prices
// themselves are in `shared/content/pricing.ts`, which Home reads too.
import { APP_PRICES } from '../../shared/content/pricing.ts'

export interface PlaceToBuy {
  readonly label: string
  /** `null` until the app is on sale there: the page then says "Coming soon" and links nowhere. */
  readonly url: string | null
}

export interface Purchase {
  readonly price: string
  readonly devices: string
  readonly buy: readonly PlaceToBuy[]
}

export interface AppOffer {
  readonly phone: Purchase
  readonly computer: Purchase
  /** What the editors in the browser do, free. */
  readonly web: readonly string[]
  /** What you get by downloading the app (never an editor: they are all free on the web). */
  readonly app: readonly string[]
}

export const APP_OFFER: AppOffer = {
  phone: {
    price: APP_PRICES.phone,
    devices: 'iPhone, iPad and Android',
    buy: [
      { label: 'App Store', url: null },
      { label: 'Google Play', url: null },
    ],
  },
  computer: {
    price: APP_PRICES.computer,
    devices: 'Mac, Windows and Linux',
    buy: [{ label: 'Buy for your computer', url: null }],
  },
  // The Owner, 2026-11-08 21:25: "all editors are free on Web, you only have to pay to download". This replaces the
  // 14:53 split (essentials on the web, the full suite in the app). So no editor is named in `app`: what the price buys
  // is the download itself.
  web: [
    'All the editors, for 2D and 3D games: Levels, Characters, Add tiles, the Tuner, Feel, Audio, Schematic and more',
    'Your games on every device: sign in with GitHub and they stay in sync',
    'Play and Publish, once you open the free editor on your own game',
  ],
  app: [
    'It installs in one step and keeps itself up to date',
    'The editors on your phone, tablet or computer, made for touch',
    'Your coding agent can use the editors too, through MCP (coming later)',
  ],
}
