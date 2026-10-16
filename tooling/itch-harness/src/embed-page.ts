export interface EmbedPageOptions {
  /** The game's index.html on the game origin. */
  readonly gameUrl: string
  /** Deny the frame storage, as a browser that blocks third-party storage does. */
  readonly blockStorage: boolean
}

/**
 * Features the frame may use. Modelled on itch.io's HTML5 embed (`allowfullscreen` plus an `allow` list with
 * `fullscreen *`); the real page is checked by the Owner's first itch.io push (PUB.5), not here.
 */
const ALLOW = 'autoplay; fullscreen *; gamepad; gyroscope; accelerometer'

/**
 * Without `allow-same-origin` the frame's origin is opaque, so every storage API throws a SecurityError: the
 * closest thing a test can make to itch.io's frame being denied third-party storage. Scripts, pointer lock
 * and popups stay allowed, as a game needs them.
 */
const BLOCKED_STORAGE_SANDBOX = 'allow-scripts allow-pointer-lock allow-popups allow-forms'

function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

/** The page on the embedding origin: one iframe on the game's origin, filling the viewport. */
export function embedPage(options: EmbedPageOptions): string {
  const sandbox = options.blockStorage ? ` sandbox="${BLOCKED_STORAGE_SANDBOX}"` : ''
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>itch-like embed (AF test harness)</title>
    <style>
      html, body { margin: 0; width: 100%; height: 100%; background: #222; }
      iframe { display: block; width: 100%; height: 100%; border: 0; }
    </style>
  </head>
  <body>
    <iframe id="game_drop" title="game" src="${escapeAttribute(options.gameUrl)}" allow="${ALLOW}" allowfullscreen scrolling="no"${sandbox}></iframe>
  </body>
</html>
`
}
