// `nav-graph` (M6 spec §4.4): a scene's authored walking graph. Nodes are plan points by id; an edge joins two declared
// nodes, and its optional third member names a door that must be open to use it. Each problem is reported at its path,
// so the content compiler names the file and line.
import type { Point } from '@mcthaydt/automata-sectors/sim'
import { z } from 'zod'

export interface NavGraph {
  readonly nodes: Readonly<Record<string, Point>>
  readonly edges: readonly (readonly [string, string, string?])[]
}

const pointSchema = z.strictObject({ x: z.number(), z: z.number() })
const edgeSchema = z.union([z.tuple([z.string(), z.string()]), z.tuple([z.string(), z.string(), z.string()])])

export const navGraphSchema: z.ZodType<NavGraph> = z
  .strictObject({ nodes: z.record(z.string(), pointSchema), edges: z.array(edgeSchema) })
  .superRefine((graph, context) => {
    const seen = new Set<string>()
    graph.edges.forEach((edge, index) => {
      for (const end of [0, 1] as const)
        if (!Object.hasOwn(graph.nodes, edge[end]))
          context.addIssue({
            code: 'custom',
            path: ['edges', index, end],
            message: `no node "${edge[end]}" in nodes`,
          })
      // An edge is undirected, so a→b and b→a are the same edge.
      const key = edge[0] < edge[1] ? `${edge[0]}\n${edge[1]}` : `${edge[1]}\n${edge[0]}`
      if (seen.has(key))
        context.addIssue({
          code: 'custom',
          path: ['edges', index],
          message: `edge ${edge[0]}–${edge[1]} is listed twice`,
        })
      seen.add(key)
    })
  })
