// Generates a deterministic SAMPLE data/snapshot.json by running synthetic
// match data through the real engine — used for local dev and for eyeballing
// the engine's output before the real API is wired up.
import fs from 'node:fs';
import { deriveState } from '../lib/engine.js';

const players = JSON.parse(fs.readFileSync('data/players.json', 'utf8')).players;
const tournament = JSON.parse(fs.readFileSync('data/tournament.json', 'utf8'));

const rand = mulberry32(20260611);
const now = Date.now();
let nextId = 1;
const matches = [];

// Group fixtures: matchday 1 finished for groups A–H, one live match in group
// I, everything else scheduled — roughly "day two of the tournament".
const PAIRINGS = [
  [[0, 1], [2, 3]],
  [[0, 2], [1, 3]],
  [[0, 3], [1, 2]],
];
tournament.groups.forEach((group, gi) => {
  PAIRINGS.forEach((pairs, md) => {
    pairs.forEach(([hi, ai], pi) => {
      const finished = md === 0 && gi < 8;
      const live = md === 0 && gi === 8 && pi === 0;
      const kickoff = new Date(now - 26 * 3600_000 + (gi * 3 + md * 36) * 3600_000);
      matches.push({
        id: nextId++,
        stage: 'GROUP',
        group: group.id,
        utcDate: kickoff.toISOString(),
        status: finished ? 'FINISHED' : live ? 'IN_PLAY' : 'TIMED',
        lastUpdated: finished
          ? new Date(now - (20 + Math.floor(rand() * 90)) * 60_000).toISOString()
          : live
            ? new Date(now - 3 * 60_000).toISOString()
            : new Date(now - 6 * 3600_000).toISOString(),
        home: group.teams[hi],
        away: group.teams[ai],
        score: finished || live
          ? { home: Math.floor(rand() * 4), away: Math.floor(rand() * 3) }
          : { home: null, away: null },
        winner: null,
      });
    });
  });
});

// Knockout fixtures exist but have no teams yet — exercises slot labels.
for (const [stage, count] of [['R32', 16], ['R16', 8], ['QF', 4], ['SF', 2], ['THIRD', 1], ['FINAL', 1]]) {
  for (let i = 0; i < count; i++) {
    matches.push({
      id: nextId++,
      stage,
      group: null,
      utcDate: null,
      status: 'SCHEDULED',
      lastUpdated: new Date(now - 6 * 3600_000).toISOString(),
      home: null,
      away: null,
      score: { home: null, away: null },
      winner: null,
    });
  }
}

// Golden boot sample with a deliberate tie at the top (ties stay ties).
const scorers = [
  { playerName: 'K. Mbappé', teamId: 'FRA', teamName: 'France', goals: 2 },
  { playerName: 'J. Álvarez', teamId: 'ARG', teamName: 'Argentina', goals: 2 },
  { playerName: 'H. Kane', teamId: 'ENG', teamName: 'England', goals: 1 },
  { playerName: 'V. Gyökeres', teamId: 'POR', teamName: 'Portugal', goals: 1 },
  { playerName: 'S. Giménez', teamId: 'MEX', teamName: 'Mexico', goals: 1 },
  { playerName: 'N. Williams', teamId: 'ESP', teamName: 'Spain', goals: 1 },
];

const snapshot = deriveState({
  matches,
  scorers,
  fetchedAt: new Date(now).toISOString(),
  players,
  tournament,
});
fs.writeFileSync('data/snapshot.json', JSON.stringify(snapshot, null, 1) + '\n');
console.log(`Sample snapshot written: ${matches.length} matches, ${scorers.length} scorers.`);

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
