// @automata/nav: routes over an authored graph and click-to-walk. The sim side is the `./sim`
// entry; this entry adds the `nav-graph` content kind and `navExtension`.

export { createNavExtension, navExtension } from '../app/nav.extension'
export { navGraphContent } from '../shared/nav-graph.content'
export * from './sim'
