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
  /** The heading of its price card. */
  readonly name: string
  readonly price: string
  readonly devices: string
  readonly buy: readonly PlaceToBuy[]
  /** What this download gives: setup it takes away, or what only an app can do on that device. Never an editor, sync
   * or keeping your work: those are free on the web (the Owner, 2026-11-08 21:25 and 2026-11-09 01:46). */
  readonly gives: readonly string[]
}

export interface AppOffer {
  readonly phone: Purchase
  readonly computer: Purchase
  /** What the editors in the browser do, free. */
  readonly web: readonly string[]
}

export const APP_OFFER: AppOffer = {
  // Two separate purchases (the Owner, 2026-11-09 01:50). The iPad comes first: it is where games get made. Each list
  // is from /mnt/project-files/gtm/2026-11-09-paid-app-features.md; "coming later" marks what the apps plan adds.
  phone: {
    name: 'Phone and tablet',
    price: APP_PRICES.phone,
    devices: 'iPad, iPhone and Android',
    buy: [
      { label: 'App Store', url: null },
      { label: 'Google Play', url: null },
    ],
    gives: [
      'Opens full screen from your home screen, with no browser bars',
      'Your games are real folders in the Files app, ready to AirDrop or back up',
      'Apple Pencil: double-tap it to switch to the eraser (coming later)',
      'Real vibration when you test your game on an iPhone (coming later)',
      'Your coding agent can use the editors over your own Wi-Fi (coming later)',
    ],
  },
  computer: {
    name: 'Computer',
    price: APP_PRICES.computer,
    devices: 'Mac, Windows and Linux',
    buy: [{ label: 'Buy for your computer', url: null }],
    gives: [
      'Nothing to set up: no terminal, nothing else to install',
      'It keeps itself up to date',
      'One button makes a download of your game for Mac, Windows and Linux (coming later)',
      'One button puts your game on itch.io (coming later)',
      'Your coding agent can use the editors too (coming later)',
    ],
  },
  // The Owner, 2026-11-08 21:25: "all editors are free on Web, you only have to pay to download". This replaces the
  // 14:53 split (essentials on the web, the full suite in the app).
  web: [
    'All the editors, for 2D and 3D games: Levels, Characters, Add tiles, the Tuner, Feel, Audio, Schematic and more',
    'Your games on every device: sign in with GitHub and they stay in sync',
    'Play and Publish, once you open the free editor on your own game',
  ],
}
