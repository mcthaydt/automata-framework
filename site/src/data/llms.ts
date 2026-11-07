import type { DocSection } from './site-docs'
import { DISTRIBUTION_TARGETS } from './targets'

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
- [Full documentation](/llms-full.txt): The framework's defined documentation corpus and its complete API reference for version ${version}, generated from the package declarations.
- [API reference](/llms-api.txt): Every export of the ${version} packages with its signature and doc comment, generated from the package declarations.
- [Site guides](/llms-guides.txt): Every guide on this site, in full.

`.trim() + '\n'
  )
}

/** `/llms-guides.txt`: every docs page, in full. */
export function llmsGuides(docs: readonly DocSection[]): string {
  return (
    `# Automata Framework — Site Guides for Coding Agents

> Automata is a deterministic 2D game framework for the web. ${DISTRIBUTION_TARGETS}
> Strict Core Laws: Koota ECS determinism, Effect outside sim, Zero Eval CSP, PixiJS 2D sub-tick alpha interpolation.

---

# The 5 Golden Rules for LLMs
1. Simulation is Pure and Deterministic: NEVER import Effect, browser DOM, or PixiJS inside simulation systems.
2. Effect Outside the Sim: Side effects (I/O, audio, network, saves) run in Effect outside the sim.
3. Zero Eval: Never use eval() or new Function(). Strict CSP compliance required.
4. Sub-tick alpha interpolation: Presentation interpolates positions between ticks: prev.x + (curr.x - prev.x) * alpha.
5. Single State Ownership: Only the sim mutates game entities; UI and presentation only observe truth.

---

${docs
  .map(
    (d) => `## Document: ${d.title} (${d.category})
URL: /docs/${d.slug}
Description: ${d.description}

${d.content}`,
  )
  .join('\n\n---\n\n')}

`.trim() + '\n'
  )
}
