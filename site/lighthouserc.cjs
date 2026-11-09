// Lighthouse CI: the budgets for the pages a visitor lands on, judged on the median of three mobile runs.
// The preview listens on a port taken from portsFor, so AF_RUNNER_PORT_OFFSET moves it with the runner copy.
const { portsFor } = require('../packages/tools/src/shared/ship/ports/ports-for.ts')

const port = portsFor(`${__dirname}/..`, process.env).server + 52
const origin = `http://127.0.0.1:${port}`

const median = (key, bound) => ['error', { [key]: bound, aggregationMethod: 'median-run' }]

// Every page is held to the same lines.
const assertions = {
  'categories:performance': median('minScore', 0.9),
  'largest-contentful-paint': median('maxNumericValue', 2500),
  'cumulative-layout-shift': median('maxNumericValue', 0.1),
  'total-blocking-time': median('maxNumericValue', 200),
}

const pages = ['/', '/start', '/examples', '/docs', '/examples/core-basic-window', '/examples/shapes-rects']
// A page's URL as a pattern; the two example pages share one line.
const patterns = ['/', '/start', '/examples', '/docs', '/examples/(core-basic-window|shapes-rects)']

module.exports = {
  ci: {
    collect: {
      url: pages.map((page) => `${origin}${page}`),
      startServerCommand: `node scripts/serve-static.ts build ${port} --compressed`,
      startServerReadyPattern: 'Serving',
      numberOfRuns: 3,
      settings: { chromeFlags: '--no-sandbox --disable-dev-shm-usage' },
    },
    assert: {
      assertMatrix: patterns.map((pattern) => ({
        matchingUrlPattern: `^${origin.replace(/\./g, '\\.')}${pattern}$`,
        assertions,
      })),
    },
    upload: { target: 'filesystem', outputDir: '.lighthouseci/reports' },
  },
}
