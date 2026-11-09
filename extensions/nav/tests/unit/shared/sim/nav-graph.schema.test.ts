// `nav-graph`: the clinic's graph parses, and each bad reference is reported at its path.
import { expect, it } from 'vitest'
import { navGraphSchema } from '#src/shared/sim/nav-graph.schema.ts'
import { clinicGraph } from '#src/testing/clinic.ts'

const issues = (graph: unknown) => {
  const result = navGraphSchema.safeParse(graph)
  return result.success ? [] : result.error.issues.map((i) => ({ path: i.path, message: i.message }))
}
const tiny = { nodes: { a: { x: 0, z: 0 }, b: { x: 1, z: 0 } }, edges: [['a', 'b']] }

it('takes the clinic graph', () => {
  expect(issues(clinicGraph())).toEqual([])
})

it('fails an edge to an unknown node, a duplicate edge and a node that is not a point, at their paths', () => {
  expect(issues({ ...tiny, edges: [['a', 'c']] })).toEqual([
    { path: ['edges', 0, 1], message: 'no node "c" in nodes' },
  ])
  expect(
    issues({
      ...tiny,
      edges: [
        ['a', 'b'],
        ['b', 'a', 'door'],
      ],
    }),
  ).toEqual([{ path: ['edges', 1], message: 'edge b–a is listed twice' }])
  expect(issues({ ...tiny, nodes: { ...tiny.nodes, c: { x: 1 } } }).map((i) => i.path)).toEqual([
    ['nodes', 'c', 'z'],
  ])
})
