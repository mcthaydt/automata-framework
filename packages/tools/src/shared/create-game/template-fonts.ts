import { existsSync, readFileSync } from 'node:fs'
import { DEFAULT_LANGUAGES } from '../words/default-languages.ts'
import type { TemplateBinaryFile, TemplateFile } from './template-file.ts'

// The font set a new game draws its words in: Fusion Pixel Font in three flavours (so a shared Han character takes each
// language's own shape) and its licence, copied from `vendor/fonts/fusion-pixel-12/` into the game's `assets/fonts/`,
// with the `content/fonts.toml` that names them. The build cuts each to the characters the game shows and renames the
// subsets, because the licence reserves the font's name.
//
// From source the fonts are in the repository's `vendor/`; the published package carries them in `dist/template-fonts/`
// (`tsdown.config.ts` copies them), next to the bundle this file is part of, so the first folder that exists is the one.

const FOLDERS: readonly URL[] = [
  new URL('./template-fonts/', import.meta.url),
  new URL('../../../../../vendor/fonts/fusion-pixel-12/', import.meta.url),
]

/** The folder the font files are in, wherever this code is running from. */
function fontFolder(): URL {
  const found = FOLDERS.find((folder) => existsSync(folder))
  if (found === undefined) throw new Error('The font files for a new game are missing from this install.')
  return found
}

/** One flavour: the file it is in the vendored set, the name `fonts.toml` gives it and what it serves. */
interface Flavour {
  readonly file: string
  readonly name: string
  readonly sha256: string
  readonly locales: readonly string[]
}

// Every flavour holds the same full Latin, so English, Latin American Spanish and Brazilian Portuguese are served by
// the first; the other two cut their own Han shapes. The hashes are the files' own (vendor/fonts/README.md), and a test
// holds this table to what is copied.
const FLAVOURS: readonly Flavour[] = [
  {
    file: 'ja.woff2',
    name: 'ja',
    sha256: 'dd52d6fa0eb8100ee3a4bee142f2c03b3480a815cf0d53722bd208a7f3bd316b',
    locales: ['en', 'es-419', 'pt-BR', 'ja'],
  },
  {
    file: 'ko.woff2',
    name: 'ko',
    sha256: 'f7527814ee81f89ac4596d292c627e4dda645f6b22f5120aaa968ff3ed7d0833',
    locales: ['ko'],
  },
  {
    file: 'zh_hans.woff2',
    name: 'zh-hans',
    sha256: '043eae5e616b0d1e75dc746d3d687b4413f9f1c70c1a09bc4ebb705ef1cc8e32',
    locales: ['zh-Hans'],
  },
]

/** The key the content compiler gives the starter's word in content/feel/feel.toml; a test holds it to the compiler's. */
const BUMP_KEY = 'content_feel_feel_entry_0_word_0_words'

/** "Bump!" in each language the starter ships, written for the word a square says on meeting a wall. */
const BUMP: Readonly<Record<string, string>> = {
  ja: 'ゴツン！',
  ko: '쿵!',
  'es-419': '¡Pum!',
  'pt-BR': 'Bum!',
  'zh-Hans': '砰！',
}

const FONTS_FOLDER = 'assets/fonts'
const LICENSE_FILE = `${FONTS_FOLDER}/OFL.txt`

/** `content/fonts.toml`, in the form the font build reads. */
function fontsToml(): string {
  const rows = FLAVOURS.map(
    (flavour) => `[font.${flavour.name}]
file = "${FONTS_FOLDER}/${flavour.file}"
sha256 = "${flavour.sha256}"
license = "OFL-1.1"
license_file = "${LICENSE_FILE}"
reserved_name = "Fusion Pixel"
locales = [${flavour.locales.map((tag) => `"${tag}"`).join(', ')}]
`,
  )
  return `# The fonts the game draws its words in, and the languages each one serves. Every language the game ships needs a
# font: none falls back to whatever the device has. \`automata-content assets\` cuts each font to the characters the game
# shows (run by \`pnpm dev\` and every build) and writes the faces as content/generated/fonts/fonts.css.
# Add a language by adding its tag to a font's list (and its catalog, content/messages/<tag>.json).

${rows.join('\n')}`
}

/** The fonts, their licence, the list that names them and the catalog of every language but English. */
export const FONT_FILES: readonly (TemplateFile | TemplateBinaryFile)[] = [
  { path: 'content/fonts.toml', content: fontsToml },
  // The starter's one word (Feel's "Bump!") in each language. A game that ships a language has its catalog, and a
  // catalog has exactly the source's keys, which is what makes the language count for the font build and the checks.
  ...DEFAULT_LANGUAGES.slice(1).map((tag) => ({
    path: `content/messages/${tag}.json`,
    content: () => `{\n  "${BUMP_KEY}": ${JSON.stringify(BUMP[tag])}\n}\n`,
  })),
  ...[...FLAVOURS.map((flavour) => flavour.file), 'OFL.txt'].map(
    (file): TemplateBinaryFile => ({
      path: `${FONTS_FOLDER}/${file}`,
      bytes: () => readFileSync(new URL(file, fontFolder())),
    }),
  ),
]
