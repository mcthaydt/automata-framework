// The helpers a package's real-browser suite layout tests share (`@automata/editor/suite/testing/layout`): open the
// suite at a window size, choose an editor by its tab (or the Editors menu where a phone held sideways folds the tabs
// into it) and look for a region in its one shell. It imports `vitest/browser`, so only a browser
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
  tab,
} from '../testing/suite/suite-layout'
