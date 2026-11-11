---
'@automata/3d': patch
'@automata/world-kit': patch
---
Glowing swatches (a bulb, a neon, a lit window) draw at their own step whatever the light and dim with their lamp, a lit window shows a room behind its glass, the light's occluders are cut at a wall's doorways and windows so light passes them, static props take the baked room light and a moved prop has its light taken again, and the base scenes name a camera view for each room at the distance that frames it. The kit's bloom rings what glows, as the source's does.
