![Live rank](https://make.fun/badge/gta6-01/achzul/palm-harbor-heat/rank.svg)
![Live reward](https://make.fun/badge/gta6-01/achzul/palm-harbor-heat/reward.svg)
![make.fun bounty badge](https://make.fun/badge/gta6-01.svg)

Entry for the make.fun bounty: [Make GTA 6](https://make.fun/bounty/gta6-01)

# Palm Harbor Heat

An original open-world crime game for the browser, built with three.js and
plain static files. No build step, no network requests: serve `game/` with any
static file server and open `game/index.html` in a desktop browser.

You are Nico Vega, a driver running errands for Marisol "Sol" Duarte of
Harborlight Garage in Palm Harbor, a golden-hour coastal city with a 9x9 street
grid, a beach and a marina. Walk it, steal and drive its cars, dodge or face
the Palm Harbor PD, and work through a three-job story chain plus a repeatable
boost list.

## What is in the game

- A living city: traffic that drives the grid and brakes for trouble, and
  pedestrians who stroll the blocks and flee when things get loud.
- A wanted system: heat builds from theft, collisions and gunfire, turns into
  1-5 stars, and brings cruisers that chase and try to box you in. Break line
  of sight and the heat decays; get caught on foot and you are busted.
- Missions: "First Run" ($250), "Hot Metal" ($600) and "The Getaway" ($1,200),
  then the repeatable "Boost List" ($300 a car).
- Combat: a pistol with tracers and sparks, plus a paying target range on the
  beach at Sandy Range ($15 a hit).
- HUD with a live canvas minimap, wanted stars, health, cash, objective banner
  and speedometer; a start screen, pause, and a localStorage save that keeps
  your cash and story progress between visits.
- Sound synthesized with WebAudio: engine hum, sirens, gunshots, crashes and
  mission stings. No audio files.

## Controls

- WASD: walk / drive, Shift: sprint, Space: handbrake
- E: enter or exit a car, talk to Sol, pick up
- Mouse: look and aim, click: fire the pistol
- P: pause, M: mute

## Layout

- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to the
  output directory and writes `dossier.json` with the vendored
  `vendor/makefun-game.ts`.
- `serve.ts` — a tiny static server for playing locally (`node serve.ts`,
  then http://localhost:8080).
- `game/` — the game itself: `index.html` plus one module per system under
  `game/src/`, three.js vendored under `game/vendor/`.
- `screenshots/` — real renders of the game, taken from the running build.
