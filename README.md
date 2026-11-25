# Unwind

A relaxing web puzzle prototype inspired by the core mechanic of Arrows – Puzzle Escape (Lessmore). The name, art, levels and sound are original.

## Run it
Play it at https://migasang.github.io/Unwind/

The root `index.html` is the page GitHub Pages serves. It's a copy of `dist/index.html`, so copy it again after rebuilding. You can also open it directly in a browser.

## Change it
- `src/engine.js`: game rules, level generator and solver, with no browser code
- `src/game.js`: drawing, sound, input, menus and analytics
- `src/index.template.html`: page and styles
- `src/music.js`: music themes and the note synth
- `src/levels.json`: the 48 generated levels
- `src/guide.js`: Guiding Light rules and map generator (shared with the room server)
- `src/guide-ui.js`: Guiding Light screen, inlined into `game.js` at build time

```
node tools/make-levels.js   # regenerate and prove levels solvable, prints a report
node tools/test-rules.js    # rule tests, no browser needed
node tools/build.js         # rebuild dist/
```
`tools/test-browser.js <screenshot-folder>` plays all 48 levels with real clicks and measures the audio. It needs Playwright.

## Guiding Light
A two-player mode: one player keeps the lighthouse and shines its beam, the other sails a boat home through a dark sea by catching waves next to it. Maps are generated from a seed (Small 9x9, Medium 11x11, Large 15x15). Normal has rocks, whirlpools, barrels and sea serpents; Hard adds tall rocks that block the light, wind and sail, a lamp that works every other round and faster serpents. Play on one device (passing it between turns) or online, where the room server checks every move with `src/guide.js`.

## Analytics
All events go through `track()` in `src/game.js` and are stored in the player's browser only. Add `#debug` to the address (or `?debug=1` on your own host) to see the level funnel and event log. Connect a real analytics service in that one function before measuring retention.

## Mechanics
- Base: tap an arrow to send it off the board. If it hits another arrow it bounces back and costs a life.
- Twins leave together. Compass arrows turn a quarter per launch. Sleepers wait for their star arrow. Mirrors turn arrows on their way out. Patient arrows wait for a number of launches.
- Sets: Calm (24 levels), Hard (12 levels, 2 lives, no hints), Timed (12 levels), Today's puzzle, and Open water (endless, with optional Harder and Timed switches and 3x, 5x or 10x map area).
- `src/music.js` holds the four music themes. Every sound is a separate note, with no continuous drone.

## Rights
© 2026 Miguel. All rights reserved. No licence is granted to copy, modify, publish or use this work commercially without written agreement.
