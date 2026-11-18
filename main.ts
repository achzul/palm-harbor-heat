// Palm Harbor Heat — hand-in program for the make.fun gta6-01 bounty.
//
// The game is the static site in game/ (index.html plus its ES modules, three.js
// vendored under game/vendor/): it plays offline in a desktop browser with no
// build step and no network request. This program copies game/ and screenshots/
// into the output directory and writes dossier.json there, using the kit's
// vendored buildDossier so the site can rebuild the same bytes and compare.
//
// Run it the way the grader does, or locally with an output directory of your
// choice standing in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoDir, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoDir, 'screenshots'))) {
  cpSync(join(repoDir, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The caps below are the scorer's own limits for this bounty, so a dossier this
// program writes is one the scorer accepts: at most 160 KiB of source text for
// the judge, at most 4 screenshots of 256 KiB each, and game/ within its file
// count, byte and path limits.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
