// The public mirror of the agent package (`mcthaydt/automata-skills`), written by one function so that what the release
// job pushes is what the unit tests, `plugin:validate` and the install suite check. The tree is the plugin as it is in
// `agents/automata`, byte for byte, plus three generated files: the marketplace Claude Code needs to add the repository,
// a README and the licence. The release job runs this with no `pnpm install`, so it imports only Node built-ins.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** The marketplace's name: the part after `@` in `/plugin install automata@automata-skills`. */
export const MIRROR_MARKETPLACE = 'automata-skills'

export interface MirrorOptions {
  /** The framework checkout. */
  readonly repo: string
  /** An empty folder, one holding only `.git`, or one that does not exist yet. */
  readonly out: string
}

/** The mirror cannot be written as asked (the out folder holds files from an earlier push). */
export class MirrorError extends Error {}

export interface MirrorMarketplace {
  readonly name: string
  readonly description: string
  readonly owner: { readonly name: string }
  readonly plugins: readonly [{ readonly name: 'automata'; readonly source: './' }]
}

/** The marketplace file: one plugin, `automata`, whose source is the repository's own root. */
export function mirrorMarketplace(): MirrorMarketplace {
  return {
    name: MIRROR_MARKETPLACE,
    description: 'Skills that teach a coding agent to build games with the Automata Framework.',
    owner: { name: 'mcthaydt' },
    plugins: [{ name: 'automata', source: './' }],
  }
}

/** The repository's front page. Public text for a person who has never seen the framework: plain words only. */
export function mirrorReadme(version: string): string {
  return `# Automata skills

Teaches your coding agent to build games with the Automata Framework: the framework's rules, how to add a feature test first, the exact API, and what \`automata check\` finds. It also runs \`automata check\` for you after each change to your game's gameplay code and before your agent says it is done.

## Install

In Claude Code, type these two lines:

\`\`\`
/plugin marketplace add mcthaydt/${MIRROR_MARKETPLACE}
/plugin install automata@${MIRROR_MARKETPLACE}
\`\`\`

For other agents (Codex, Cursor and more), run this in your game's folder:

\`\`\`
npx skills add mcthaydt/${MIRROR_MARKETPLACE}
\`\`\`

Version ${version}.

## Please don't edit this repository

Every file here is copied from the Automata Framework each time it is released, so a change made here is lost at the next release.
`
}

/**
 * Writes the mirror tree into `options.out` and returns the paths it wrote, sorted, slash-separated. Refuses a folder
 * holding anything but `.git`: a file left from an older push would otherwise ship, so the release job empties the
 * clone first and this check makes forgetting that a failure instead of a stale file.
 */
export function writeMirror(options: MirrorOptions): string[] {
  const source = join(options.repo, 'agents/automata')
  if (!existsSync(join(source, '.claude-plugin/plugin.json')))
    throw new MirrorError(`${source} is not the agent package (no .claude-plugin/plugin.json)`)
  if (existsSync(options.out)) {
    const stale = readdirSync(options.out).filter((name) => name !== '.git')
    if (stale.length > 0)
      throw new MirrorError(`${options.out} holds ${stale.join(', ')}: empty it except .git first`)
  }

  const { version } = JSON.parse(readFileSync(join(source, '.claude-plugin/plugin.json'), 'utf8')) as {
    version: string
  }
  mkdirSync(options.out, { recursive: true })
  cpSync(source, options.out, { recursive: true })
  writeFileSync(
    join(options.out, '.claude-plugin/marketplace.json'),
    `${JSON.stringify(mirrorMarketplace(), null, 2)}\n`,
  )
  writeFileSync(join(options.out, 'README.md'), mirrorReadme(version))
  cpSync(join(options.repo, 'LICENSE'), join(options.out, 'LICENSE'))
  return listFiles(options.out).sort()
}

/** Every file below `dir` as a slash path relative to it; `.git` is not part of the mirror. */
function listFiles(dir: string, prefix = ''): string[] {
  return readdirSync(join(dir, prefix), { withFileTypes: true }).flatMap((entry) => {
    const path = prefix === '' ? entry.name : `${prefix}/${entry.name}`
    if (entry.isDirectory()) return entry.name === '.git' && prefix === '' ? [] : listFiles(dir, path)
    return [path]
  })
}
