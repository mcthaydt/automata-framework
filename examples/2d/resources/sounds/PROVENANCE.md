# Sound provenance: `examples/resources/sounds`

| Asset | Used by | Made by | How | Date |
|---|---|---|---|---|
| `chime.wav` (0.6 s, 22 050 Hz mono 16-bit PCM) | `audio/audio-sound.ts` | Synthesized for this example; no recording or sample library | A short Node script (no audio library): an E6 sine (1318.51 Hz, 0.6) plus a B6 sine (1975.53 Hz, 0.25), a 5 ms linear attack and an `exp(−7t)` decay, scaled by 0.8 and written as a RIFF WAV | 2026-10-17 |
| `ui-press.wav` (0.12 s, 22 050 Hz mono 16-bit PCM) | `audio/audio-ui-sounds.ts` | Synthesized for this example; no recording or sample library | The same short Node script as `chime.wav` (no audio library): an A5 sine (880 Hz) plus a 1760 Hz partial at 0.3, a 3 ms attack and an `exp(−30t)` decay, scaled by 0.5, written as a RIFF WAV | 2026-11-11 |
| `ui-back.wav` (0.14 s, 22 050 Hz mono 16-bit PCM) | `audio/audio-ui-sounds.ts` | Synthesized for this example; no recording or sample library | The same short Node script as `chime.wav` (no audio library): an A4 sine (440 Hz) plus a 660 Hz partial at 0.3, a 3 ms attack and an `exp(−26t)` decay, scaled by 0.5, written as a RIFF WAV | 2026-11-11 |
| `ui-focus.wav` (0.05 s, 22 050 Hz mono 16-bit PCM) | `audio/audio-ui-sounds.ts` | Synthesized for this example; no recording or sample library | The same short Node script as `chime.wav` (no audio library): a 1320 Hz sine, a 2 ms attack and an `exp(−70t)` decay, scaled by 0.25, written as a RIFF WAV | 2026-11-11 |

SHA-256 `355ccd5e6b1b8c7e1d6c8925b03575e59cfd7e006233ff84e84f7597e6cd650b`. The Owner may replace it; how it sounds is an Owner gate (M5.3 plan).

SHA-256 of the three interface sounds: `ui-press.wav` `6a9cb031a81fd7a3d90e63078577f352fe6a263c541e37bc7e026cde6eb0b3e3`, `ui-back.wav` `c484471d03bd8a11c267aa599ff08f2120bcf9e5824ff5578ac2e84b11b8733e`, `ui-focus.wav` `96ad55186dddfe48bb48fb2c91c5d2d4e0d475650b37db64b54ab0271d4404cc`.
