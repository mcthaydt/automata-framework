import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { Effect } from 'effect'
import { type FileError, tryFile } from '../../node/errors.ts'
import { ItchBuildInvalid } from '../errors.ts'
import { buildFiles } from './build-files.ts'

// The framework draws a game's text from Geist, baked into the build as two font pages. The SIL Open Font License asks
// that a copy of the font in any form carry the copyright notice and the licence, so a build that holds a page
// carries the full licence text beside it (the pages' modules also keep a one-line notice a minifier leaves alone).
const FONT_PAGE = /af-hud-(?:latin|cyrillic)/
const LICENCE_FILE = 'geist-OFL.txt'
const FRAMEWORK = '@automata/framework'
/** Where the licence goes in the build, and so in the zip. */
const FONT_LICENCE_PATH = `licenses/${LICENCE_FILE}`

/** The licence file in the framework package the game installed, looking upwards from the game's folder. */
function installedLicence(gameDir: string): string | undefined {
  let dir = resolve(gameDir)
  for (;;) {
    const file = join(dir, 'node_modules', FRAMEWORK, 'licenses', LICENCE_FILE)
    if (existsSync(file)) return file
    const parent = dirname(dir)
    if (parent === dir) return undefined
    dir = parent
  }
}

const carriesFont = (distDir: string): boolean =>
  buildFiles(distDir)
    .filter((file) => file.endsWith('.js'))
    .some((file) => FONT_PAGE.test(readFileSync(join(distDir, file), 'utf8')))

/**
 * Puts the Geist licence into the build when the build holds the font, so `ship prepare` (the zip) and butler (the
 * folder) both carry it. A build without the font is left as it is. If the font is there and the licence cannot be
 * found in the game's installed framework, it fails and says what to do, because shipping the font without its licence
 * is not allowed.
 */
export function addFontLicence(
  distDir: string,
  gameDir: string | undefined,
): Effect.Effect<void, FileError | ItchBuildInvalid> {
  return Effect.gen(function* () {
    if (!(yield* tryFile(distDir, () => carriesFont(distDir)))) return
    const source = gameDir === undefined ? undefined : installedLicence(gameDir)
    if (source === undefined)
      return yield* new ItchBuildInvalid({
        check: 'font-licence',
        problems: [
          `${FONT_LICENCE_PATH}: this game carries the Geist font, whose licence must ship with it, and ${FRAMEWORK}'s ` +
            `licences/${LICENCE_FILE} was not found in the game's node_modules; install the game's packages and try again`,
        ],
      })
    yield* tryFile(distDir, () => {
      mkdirSync(join(distDir, 'licenses'), { recursive: true })
      writeFileSync(join(distDir, FONT_LICENCE_PATH), readFileSync(source))
    })
  })
}
