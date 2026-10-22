# Glass backdrop images

The blurred ambient-light images behind the app's glass surfaces, exported so they can be opened in an image
editor to try effects.

| File | What it is |
| --- | --- |
| `backdrop-field.png` | The ambient light field, unblurred (the screen background) |
| `backdrop-thin.png` | Blurred, sigma 8 dp (thin glass) |
| `backdrop-regular.png` | Blurred, sigma 12 dp (regular glass) |
| `backdrop-strong.png` | Blurred, sigma 18 dp (strong glass) |

All are 1236 x 2676 px (412 x 892 dp at 3x) and use the dark "intelligence console" theme colours.

## How they are made

`node scripts/export-backdrops.mjs` renders them from the same shapes, positions and theme colours as
`components/glass/GlassBackdrop.tsx`. They are a faithful reproduction, not a copy of the app's own files: the app
draws them with Skia on the phone and keeps them in its private cache folder, which a release build does not let
adb read.

## How the app reuses them

The app renders each image once, saves it as a PNG file in its cache folder (named after the colours, screen size
and blur it was made for) and warms all four before the splash screen hides. Every glass surface on every screen
then shows the same file, and a later launch finds the files already there and renders nothing. To change how the
glass looks, edit the shapes or colours in `GlassBackdrop.tsx` (the file names change with them, so old files are
simply left unused) and, if you want a matching preview, in `scripts/export-backdrops.mjs`.
