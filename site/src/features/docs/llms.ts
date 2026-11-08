import { DISTRIBUTION_TARGETS } from '../../shared/content/targets'
import type { DocSection } from './docs-loader'

// The text files for coding agents (llmstxt.org): /llms.txt indexes the site, /llms-guides.txt holds the site's
// guides in full. /llms-full.txt and /llms-api.txt are the framework's API index, unchanged (routes/llms-*.txt).

/** `/llms.txt`: what the site has, one link per page. `version` is the API index's. */
export function llmsIndex(docs: readonly DocSection[], version: string): string {
  return (
    `# Automata Framework

> Automata is a deterministic 2D game framework for the web. ${DISTRIBUTION_TARGETS}

## Documentation
${docs.map((d) => `- [${d.title}](/docs/${d.slug}): ${d.description}`).join('\n')}

## Plain text for agents
- [Full documentation](/llms-full.txt): Every guide and Reference page in one file, for version ${version}.
- [API reference](/llms-api.txt): Every export of the ${version} packages with its signature and doc comment, generated from the package declarations.
- [Site guides](/llms-guides.txt): Every guide on this site, in full.

`.trim() + '\n'
  )
}

/** `/llms-guides.txt`: every guide, in full, in the docs' order. */
export function llmsGuides(docs: readonly DocSection[]): string {
  return (
    `# Automata Framework — Site Guides for Coding Agents

> Automata is a deterministic 2D game framework for the web. ${DISTRIBUTION_TARGETS}
> Start with How it works: it holds the rules every game keeps.

---

${docs
  .map(
    (d) => `## Document: ${d.title}
URL: /docs/${d.slug}
Description: ${d.description}

${d.content}`,
  )
  .join('\n\n---\n\n')}

`.trim() + '\n'
  )
}
