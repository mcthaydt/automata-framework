// The helpers a package's real-browser suite layout tests share (`@automata/editor/suite/testing/layout`): open the
// suite at a window size and look for a tab or a region in its one shell. It imports `vitest/browser`, so only a browser
// test may load it.
export {
  dockToggle,
  editorList,
  inShell,
  inView,
  noPageScroll,
  type OpenedSuite,
  openSuite,
  tab,
} from '../testing/suite/suite-layout'
