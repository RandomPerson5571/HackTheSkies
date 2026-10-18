# App sound effects

The app plays feedback through `expo-audio` in `src/lib/sensory.ts`:

- `kenney/click_001.wav`: buttons, selections, and opening sheets/dialogs
- `../../../../assets/interfaceclick.mp3`: joining a challenge and taking a photo
- `../../../../assets/openbook.mp3`: bookmarking a restaurant or journaling food
- `../../../../assets/alert.mp3`: camera and NFC scan alerts
- `../../../../assets/alert.mp3`: successful actions, discoveries, and scan alerts
- `../../../../assets/error.mp3`: errors and incorrect answers
- `../../../../assets/badge.mp3`: badge unlocks

Native haptics remain enabled. Audio failures never block an interaction.
