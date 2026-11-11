---
'@automata/audio-synth': patch
---

The audio file may carry a `steps` table (`[steps] default = "step"`, `[steps.floors] tile = "stepTile"`): the cue a step makes on each floor surface, with a default. `stepCue(table, floor)` gives the cue for a sector's `floorTexture`; a cue the file does not define is a content problem naming the floor and the cue.
