// @automata/audio-synth/stage: a game's own audio player, for `defineGame({ audio })`. Cues for the sim's events, and the
// imported music switched by the game's state. Presentation only.

export { type AudioStageOptions, audioStage } from '../app/audio-stage'
export {
  DEFAULT_FADE_SECONDS,
  type MusicPlayer,
  type MusicPlayerOptions,
} from '../features/synth/music-player'
export { isTrackFile, trackAlias, tracksFrom } from '../shared/tracks'
