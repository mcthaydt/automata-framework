import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { repositoryRoot } from './root.ts'

/** One of the framework's guides (`docs/guides/<slug>.md`), served at `/docs/<slug>`. */
export interface Guide {
  readonly slug: string
  /** The guide's `# ` heading. */
  readonly title: string
  /** Its first paragraph, for the docs index and the page's meta description. */
  readonly description: string
  /** The Markdown below the heading, with links to other guides pointing at their pages. */
  readonly content: string
}

const HEADING = /^# (.+)\n+/

/** `./other.md#part` becomes `/docs/other#part`; every other link is left as written. */
function relinkGuides(markdown: string): string {
  return markdown.replace(
    /\]\(\.\/([a-z0-9-]+)\.md(#[^)]*)?\)/g,
    (_all, name: string, hash = '') => `](/docs/${name}${hash})`,
  )
}

function readGuide(dir: string, file: string): Guide {
  const text = readFileSync(join(dir, file), 'utf8')
  const heading = HEADING.exec(text)
  // A guide without a heading has no title to list it by: stop the build and name the file.
  if (heading === null) throw new Error(`docs/guides/${file}: a guide starts with a "# " heading`)
  const content = text.slice(heading[0].length)
  const description = (content.split(/\n\n/)[0] ?? '').replace(/\s+/g, ' ').trim()
  return { slug: file.slice(0, -'.md'.length), title: heading[1].trim(), description, content: relinkGuides(content) }
}

/** Every guide in `docs/guides/`, by file name. */
export function readGuides(root: string = repositoryRoot): Guide[] {
  const dir = join(root, 'docs/guides')
  return readdirSync(dir)
    .filter((file) => file.endsWith('.md'))
    .sort()
    .map((file) => readGuide(dir, file))
}
