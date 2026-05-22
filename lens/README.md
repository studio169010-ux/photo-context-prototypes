# Lens Prototype

A phone-focused web prototype for testing the inputter and viewer flow.

## Files

- `index.html` is the main page.
- `css/style.css` controls the visual design.
- `js/script.js` controls photo upload, category input, audio recording, saving, and lens dragging.
- `assets/` is where you can place your own images if you want.

## How to run in VS Code

1. Open this folder in VS Code.
2. Install the Live Server extension if you do not already have it.
3. Right click `index.html`.
4. Choose **Open with Live Server**.

## How the prototype works

1. Start on the photo screen.
2. Choose a photo.
3. Press **Add story**.
4. Each lens category has its own separate text and voice recording. Switching between People, Moment, Perspective, and Hidden will not copy text across categories.
5. Press **Save**.
6. The viewer lenses appear on the photo.
7. Drag a lens strip over the photo. The transparent story layer opens with the strip like a curtain.
8. Tap an open lens strip to close it again. You can also tap the photo outside the lens to close it.
9. Press **Play voice** inside the reveal layer to hear the recording.
10. Press **Edit story** to reopen and change what was saved.

## Notes

The saved story and recorded audio only stay while the page is open. Refreshing the page clears them. This is intentional so the prototype stays lightweight for testing.

Microphone recording usually works through Live Server on desktop. On a phone, it usually needs an HTTPS link, for example Netlify, Vercel, or GitHub Pages.

Version 4 notes
- The lens is no longer a floating panel. The transparent story layer is attached to the stripe and opens over the image as you drag.
- Tapping an open stripe closes it like a curtain.
- The instruction text has been moved away from the bottom navigation and is hidden once stories are saved.


Version 5 note: lens handles now open sideways like curtains across the photo. Top and bottom tabs do not drag vertically. Tap an open tab to close it.


Version 8 tweak: panel opacity adjusted and reveal text contrast increased.


## Fixed version notes

- Removed the fake phone navigation bar at the bottom.
- The photo placeholder area now works as the photo upload button before a photo is chosen.
- Changed the prototype font to a more readable phone-safe system font.
- Increased reveal/modal text sizes for phone testing.
- Fixed reveal text overflow so long text should stay inside the lens curtain, especially for Perspective.


Small fix: removed the extra Tap photo area to choose label. The photo placeholder is still clickable.


## Patch notes

- Recording popups now show a live recording timer.
- Added a delete recording button after a voice note is recorded.
- Voice playback buttons now show elapsed/duration and reset when finished.


## Final tweak notes

- Lens handles now open on tap as well as drag.
- Font changed to a readable elegant serif stack: Georgia / Palatino / Times New Roman fallback.
