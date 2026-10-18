# App sound effects

All cues play through `expo-audio` in `src/lib/sensory.ts`. Shared
`FeedbackPressable` controls cover button presses and selections; `useMenuSound`
covers sheets and dialogs. Feature handlers supply scan, save, error, discovery,
quest, badge, and level-up cues.

The `kenney/` WAV files are PCM conversions of the supplied CC0 Interface Sounds
in the repository's `assets/kenney_interface-sounds/Audio/` folder. Their original
filenames and license are preserved. WAV makes these assets usable on iOS,
Android, and web without depending on OGG support.

- `click_001`: buttons
- `tick_001`: light taps
- `select_001`: tabs, map places, selections
- `open_001` / `close_001`: menus and dialogs
- `confirmation_001`: saves
- `back_001`: removals
- `confirmation_002`: successful operations
- `error_001`: failed operations and invalid input
- `question_001`: scanning

The existing custom WAV cues (`reward`, `chest`, `sparkle`, `discover`, `badge`,
and `levelup`) provide distinct celebrations beyond the interface pack.

Players are reused, preloaded on native, and released when the app leaves the
foreground. Repeated presses are throttled and bigger rewards take precedence
over smaller cues. Playback respects iOS silent mode and mixes with other audio.
Audio failures never block an interaction. Native haptics remain enabled.
