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
  return {
    slug: file.slice(0, -'.md'.length),
    title: heading[1].trim(),
    description,
    content: relinkGuides(content),
  }
}

/** The files `docs/guides/index.md` links to, in its order: `[How it works](./how-it-works.md)` is `how-it-works.md`. */
function listedGuides(dir: string): string[] {
  const index = readFileSync(join(dir, 'index.md'), 'utf8')
  return [...index.matchAll(/\]\(\.\/([a-z0-9-]+\.md)\)/g)].map((link) => link[1])
}

/**
 * Every guide `docs/guides/index.md` lists, in its order: the docs' nav, search and agents' text all read this list.
 * A guide the index does not list stays out of the site (a draft can sit in the folder); a listed guide that is
 * missing stops the build, so a rename cannot drop a page without anyone noticing.
 */
export function readGuides(root: string = repositoryRoot): Guide[] {
  const dir = join(root, 'docs/guides')
  const present = new Set(readdirSync(dir))
  return listedGuides(dir).map((file) => {
    if (!present.has(file)) throw new Error(`docs/guides/index.md lists ${file}, which does not exist`)
    return readGuide(dir, file)
  })
}
