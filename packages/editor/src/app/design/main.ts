import '../../shared/kit/tokens.css'
import '../../shared/kit/tool-chrome.css'
import '../../shared/kit/fonts.css'
import { mount } from 'svelte'
import DesignBoard from './DesignBoard.svelte'

// The design board: every kit component in each state it can be put in without a pointer, on one page, so the look is
// checked in one place (`pnpm --filter @automata/editor design:board` screenshots it). Served by `vite` in
// development only: `design.html` is not an input of the build, so it never ships. `?dialog` opens the dialog.
const target = document.getElementById('app')
if (target === null) throw new Error('design.html has no #app')
mount(DesignBoard, { target, props: { dialogOpen: new URLSearchParams(location.search).has('dialog') } })
