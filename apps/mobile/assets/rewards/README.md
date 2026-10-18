# Food rewards

Original, self-contained SVG illustrations for Cibo. All artwork uses local paths,
shapes, and gradients, with no fonts, scripts, or external resources.

- `trophy-*.svg`: 12 achievement trophies and four restaurant cuisine badges.
- `frame-*.svg`: five avatar overlays with transparent centers.
- `banner-*.svg`: three archived cover patterns, no longer displayed in the app.

Frames unlock at levels 1, 5, 10, 15, and 20. Levels use 200 XP per level, including completed quest and bonus XP.
Automatic decoration follows the current rank; users can choose an earlier
unlocked frame or remove the frame. Avatar palettes are available immediately.
Only earned trophies can be featured on the profile.

`RewardArt.tsx` maps bundled files for Expo on native and web. Customization
preferences are stored inside the existing profile document.
