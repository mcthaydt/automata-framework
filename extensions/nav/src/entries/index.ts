// @automata/nav: routes over an authored graph and click-to-walk. The sim side is the `./sim`
// entry; this entry adds the `nav-graph` content kind and `navExtension`.

export { navExtension } from '../features/graph/nav.extension'
export { navGraphContent } from '../features/graph/nav-graph.content'
export * from './sim'
