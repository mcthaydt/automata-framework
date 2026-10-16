// `node src/cli.ts --game <name>=<folder> ...`: serves the builds in the itch-like harness until stopped, on the
// checkout's ports (ports.ts). playwright.config.ts starts it for the `itch-*` projects.
import { parseGames } from './cli-args.ts'
import { startItchHarness } from './harness.ts'
import { itchHarnessPorts } from './ports.ts'

const games = parseGames(process.argv.slice(2), process.cwd())
const ports = itchHarnessPorts(process.env)
const harness = await startItchHarness({ games, pagePort: ports.page, gamePort: ports.game })
for (const name of Object.keys(games)) console.log(`itch-harness: ${harness.pageOrigin}/?game=${name}`)
