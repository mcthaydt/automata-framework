// The flow graph as a Mermaid state diagram, written beside the artifact so a reviewer can see the screen
// flow a change produces (GitHub renders `.mmd` and fenced `mermaid` blocks).

import type { FlowGraph } from './check-flow'

export function flowMermaid(graph: FlowGraph): string {
  const lines = ['stateDiagram-v2', `  [*] --> ${graph.entry}`]
  for (const t of graph.transitions) {
    const style = t.transition === 'cut' ? '' : ` (${t.transition})`
    lines.push(`  ${t.from} --> ${t.to}: ${t.event}${style}`)
  }
  for (const screen of graph.terminal) lines.push(`  ${screen} --> [*]`)
  return `${lines.join('\n')}\n`
}
