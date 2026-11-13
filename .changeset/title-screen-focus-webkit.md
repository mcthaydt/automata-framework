---
'@automata/framework': patch
---
A screen's first control now gets focus on WebKit. WebKit drops `focus()` on a control that was added a moment ago, so the title screen could open with nothing focused and a keyboard or gamepad player could not press Play. The flow asks again on each display frame, for about half a second, until the control has focus or focus goes elsewhere.
