import { parseMarkdown, type ParsedBlock } from './utils/markdown'

// The page /inside shows is the framework's generated docs/stack.md (PRODUCT spec §8), unchanged. This turns it into
// blocks the site can render: an introduction and one section per library. It changes no words; it only drops the
// generated-file comment and points a link to a framework file at that file on GitHub.

const FRAMEWORK_DOCS = 'https://github.com/mcthaydt/automata-framework/blob/main/docs/'
const RENDERABLE = new Set<ParsedBlock['type']>(['p', 'h2', 'table', 'ul'])

export interface StackSection {
  id: string
  title: string
  blocks: ParsedBlock[]
}

export function stackTitle(markdown: string): string {
  const heading = markdown.split('\n').find(line => line.startsWith('# '))
  if (!heading) throw new Error('the stack page has no title')
  return heading.slice(2).trim()
}

export function stackSections(markdown: string): { intro: ParsedBlock[]; sections: StackSection[] } {
  const text = markdown
    .split('\n')
    .filter(line => !/^<!--.*-->$/.test(line.trim()))
    .join('\n')
    // A relative link (versions.md) is a file in the framework's docs folder, which the site does not serve.
    .replace(/\]\((?!https?:|#|\/)([^)]+)\)/g, (_match, target: string) => `](${new URL(target, FRAMEWORK_DOCS).href})`)
  const intro: ParsedBlock[] = []
  const sections: StackSection[] = []
  for (const block of parseMarkdown(text)) {
    if (!RENDERABLE.has(block.type)) throw new Error(`the stack page uses a ${block.type} block, which /inside cannot render`)
    if (block.type === 'h2') sections.push({ id: block.headingId!, title: block.content!, blocks: [] })
    else (sections.at(-1)?.blocks ?? intro).push(block)
  }
  return { intro, sections }
}
