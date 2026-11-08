// What the Automata app costs, where to buy it and what it adds to the free editors on the web. Every price, place to
// buy and list on /app is read from here, so when the app goes on sale this file is the one thing that changes.

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
  /** What the app adds. */
  readonly app: readonly string[]
}

export const APP_OFFER: AppOffer = {
  phone: {
    price: '$19.99',
    devices: 'iPhone, iPad and Android',
    buy: [
      { label: 'App Store', url: null },
      { label: 'Google Play', url: null },
    ],
  },
  computer: {
    price: '$39.99',
    devices: 'Mac, Windows and Linux',
    buy: [{ label: 'Buy for your computer', url: null }],
  },
  // Which editors stay free on the web is the Owner's call; this is the split the apps audit recommends.
  web: [
    'Levels for 2D games, with Characters and Add tiles',
    'The Tuner',
    'Play and Publish, once you open the free editor on your own game',
  ],
  app: [
    'Levels for 3D games, with Walk and 3D Characters',
    'Feel, Audio, Writer and Sequence',
    'Schematic',
    'Sync with GitHub',
    'Every editor on your phone',
  ],
}
