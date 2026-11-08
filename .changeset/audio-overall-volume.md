---
'@automata/audio-synth': patch
---
The audio table's `master_gain` is now heard in a game: `audioStage` plays every cue and every music track at the overall volume the file says, and follows a change to it while the music plays (`MixerOptions.master`, `MusicPlayer.setMaster`).
