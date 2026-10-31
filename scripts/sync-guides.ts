import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// M8.6w: the framework's `docs/guide` rendered as site docs. The folder does not exist before M8.6b, and then the site has
// no framework guides and no error. A guide is a Markdown file with front matter (`title`, `description`, optional
// `order`); the site keeps no hand copy (M8-D14), so a file that cannot be read as a guide stops the sync and names itself.

export interface GuideSection {
  id: string
  slug: string
  title: string
  category: 'Guides'
  description: string
  content: string
}

const FRONT_MATTER = /^---\n([\s\S]*?)\n---\n+/

function parseFrontMatter(file: string, text: string): { fields: Record<string, string>; body: string } {
  const match = FRONT_MATTER.exec(text)
  if (!match) throw new Error(`${file}: a guide starts with front matter (--- title, description --- ...)`)
  const fields: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const at = line.indexOf(':')
    if (at > 0) fields[line.slice(0, at).trim()] = line.slice(at + 1).trim()
  }
  return { fields, body: text.slice(match[0].length) }
}

/** `./other.md#part` becomes `/docs/guide-other#part`; every other link is left as written. */
function relinkGuides(markdown: string): string {
  return markdown.replace(/\]\(\.\/([a-z0-9-]+)\.md(#[^)]*)?\)/g, (_all, name: string, hash = '') => `](/docs/guide-${name}${hash})`)
}

export function readGuides(frameworkDir: string): GuideSection[] {
  const dir = join(frameworkDir, 'docs', 'guide')
  if (!existsSync(dir)) return []
  const guides = readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((name) => {
      const { fields, body } = parseFrontMatter(name, readFileSync(join(dir, name), 'utf8'))
      for (const required of ['title', 'description']) {
        if (!fields[required]) throw new Error(`${name}: front matter has no ${required}`)
      }
      const order = fields.order === undefined ? 1000 : Number(fields.order)
      if (!Number.isFinite(order)) throw new Error(`${name}: order is not a number`)
      const slug = `guide-${name.slice(0, -3)}`
      const section: GuideSection = {
        id: slug,
        slug,
        title: fields.title,
        category: 'Guides',
        description: fields.description,
        content: relinkGuides(body),
      }
      return { order, name, section }
    })
  return guides.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)).map((guide) => guide.section)
}
