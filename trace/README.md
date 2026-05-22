# Trace / Hold to Reveal prototype v2

This version is closer to a normal phone gallery layout.

## Flow

1. Choose a photo.
2. Tap **Add point**.
3. Tap the photo where the hidden voice point should live.
4. Add a small cue and record a voice note.
5. Save the point.
6. Add more points if needed.
7. Tap **Save photo** to enter viewer mode.
8. In viewer mode, the points are hidden.
9. Hold the black space around the photo to make the trace and points glow.
10. Press and hold directly on the hidden area or glowing point to open the card and play the voice note.
11. Release to hide the card and stop the audio.

The prototype does not permanently save photos or audio. Everything stays only while the page is open.

## Run

Open the folder in VS Code and use Live Server on `index.html`.

For phone testing with microphone recording, use localhost or an HTTPS link such as Netlify, Vercel, or GitHub Pages.


Version 3 fix: hidden memory areas now respond to press-and-hold directly. The card opens after a short hold and audio starts while holding.


Version 6: restored from working v3. Pop-up and hold-to-reveal logic kept from v3. Only safe visual changes were added: thinner trace line, no popup categories, and different hint/active glow.


## Fixed version notes

- Removed the bottom phone navigation bar.
- Changed the font to a more readable phone-safe system font.
- Increased key text sizes for phone testing.
- Removed the separate visible Choose photo button.
- The empty photo area now opens the photo picker when tapped.


## Fixed version notes v2

- Removed the connecting trace lines completely.
- Kept only the glowing points.
- Reduced the photo opacity during hint mode so hidden points are easier to spot.
- Made the point circles smaller.


## Fixed version notes v3

- Photo opacity now lowers only while holding the outside black area to search for traces.
- When the user holds a found point and listens, the photo stays at full opacity.


## Patch notes

- Recording popups now show a live recording timer.
- Added a delete button after recording a voice note.
- Hold-to-listen playback now stops counting when the audio ends.
- The memory popup is placed closer to the selected point and is less opaque, so it should not jump strangely into the centre of the photo.


## Final tweak notes

- Font changed to a readable elegant serif stack: Georgia / Palatino / Times New Roman fallback.
- The small written cue is limited to 6 words maximum.


## Final tweak notes v2

- Added long-press protection for Trace so holding points should not select the page or open the browser text menu.
- Text entry still works normally inside the popup textarea.


## Trace popup placement fix

- The voice memory card is now translucent.
- When there is black gallery space above or below the photo, the card appears there instead of covering the photo.
- On small screens or tall photos without enough outside space, a lighter overlay is used at the image edge.


## Trace popup placement fix v2

- The voice memory card now stays close to the selected point.
- It tries to appear above the point first, and below only if there is not enough room.
- The card is more transparent so more of the photo remains visible.
