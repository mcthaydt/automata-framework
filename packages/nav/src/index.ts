// @mcthaydt/automata-nav: routes over an authored graph and click-to-walk (M6 spec §4.4). The sim side is the `./sim`
// entry; this entry adds the `nav-graph` content kind and `navExtension`.

export { navExtension } from './nav.extension'
export { navGraphContent } from './nav-graph.content'
export * from './sim/index'
