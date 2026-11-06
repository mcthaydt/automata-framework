import {
  AI_CONTEXT_FILES,
  AI_PROJECT_PROMPT,
  AI_REVIEW_CHECKS,
  AI_RULES,
  AI_TASKS,
  AI_VERIFY_COMMANDS,
} from './ai-guidance'
import { CHEATSHEET_MODULES } from './cheatsheet'
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

## AI & Agent Skills
- [Automata AI Portal](/ai): Project context, architectural rules, and verification guidance.
- [Full documentation](/llms-full.txt): The framework's defined documentation corpus and its complete API reference for version ${version}, generated from the package declarations.
- [API reference](/llms-api.txt): Every export of the ${version} packages with its signature and doc comment, generated from the package declarations.
- [Site guides](/llms-guides.txt): The guides, task prompts and selected API examples on this site.

## API Reference
${CHEATSHEET_MODULES.map((module) => `- [${module.title}](/cheatsheet#${module.id}): ${module.description}`).join('\n')}
`.trim() + '\n'
  )
}

/** `/llms-guides.txt`: every docs page, the AI workflow and the selected API examples, in full. */
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

---

# AI workflow
URL: /ai

## Project context
${AI_CONTEXT_FILES.map((file) => `- ${file.path}: ${file.purpose}`).join('\n')}

## Architectural boundaries
${AI_RULES.map((rule) => `### ${rule.title}\n\n${rule.detail}`).join('\n\n')}

## First task prompt
\`\`\`text
${AI_PROJECT_PROMPT}
\`\`\`

${AI_TASKS.map((task) => `## ${task.title}\n\n${task.description}\nAPI: ${task.apiHref}\n\n\`\`\`text\n${task.prompt}\n\`\`\``).join('\n\n')}

## Review and verify
${AI_REVIEW_CHECKS.map((check) => `- ${check}`).join('\n')}

\`\`\`sh
${AI_VERIFY_COMMANDS}
\`\`\`

---

# Selected API reference
URL: /cheatsheet
These examples and abbreviated contracts describe selected APIs, not every export.
The current checkout's instructions and TypeScript definitions take precedence.

${CHEATSHEET_MODULES.map((module) => `## ${module.title}\nImport: ${module.name}\nURL: /cheatsheet#${module.id}\nSource: https://github.com/mcthaydt/automata-framework/blob/main/${module.sourcePath}\n\n${module.description}\n\n\`\`\`ts\n${module.example}\n\`\`\`\n\n${module.entries.map((entry) => `### ${entry.name}\n\n${entry.description}\n${entry.receiver ? `Instance method on ${entry.receiver}.\n` : ''}\n\`\`\`ts\n${entry.signature}\n\`\`\`\nReturns: ${entry.returnType}\n${(entry.parameters ?? []).map((parameter) => `- ${parameter.name} (${parameter.type}): ${parameter.desc}`).join('\n')}\n${(entry.notes ?? []).map((note) => `- ${note}`).join('\n')}`).join('\n\n')}`).join('\n\n---\n\n')}
`.trim() + '\n'
  )
}
