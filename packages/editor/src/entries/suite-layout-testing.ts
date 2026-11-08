// The helpers a package's real-browser suite layout tests share (`@automata/editor/suite/testing/layout`): open the
// suite at a window size, choose an editor by its tab (or under More where a phone's bar has no room) and look for a region in its one shell. It imports `vitest/browser`, so only a browser
// test may load it.
export {
  chooseEditor,
  dockToggle,
  editorControl,
  editorList,
  inShell,
  inView,
  moreButton,
  noPageScroll,
  type OpenedSuite,
  openSuite,
  openSuiteHome,
  tab,
} from '../testing/suite/suite-layout'
