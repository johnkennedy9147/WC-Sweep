// Orchestration only (run by the GitHub Actions cron): fetch → engine → write.
import fs from 'node:fs';
import { fetchTournamentSnapshot } from '../lib/footballData.js';
import { deriveState } from '../lib/engine.js';

const token = process.env.FOOTBALL_DATA_TOKEN;
if (!token) {
  console.error('FOOTBALL_DATA_TOKEN is not set.');
  process.exit(1);
}

const players = readJson('data/players.json').players;
const tournament = readJson('data/tournament.json');

// A typo'd TLA in players.json would silently render as an always-alive chip
// named after the raw id — fail the Action loudly instead.
const knownTeams = new Set(tournament.groups.flatMap((g) => g.teams.map((t) => t.id)));
const unknown = players.flatMap((p) =>
  p.teams.filter((id) => !knownTeams.has(id)).map((id) => `${p.name}: ${id}`),
);
if (unknown.length) {
  console.error(`players.json references team ids not in tournament.json:\n  ${unknown.join('\n  ')}`);
  process.exit(1);
}

const raw = await fetchTournamentSnapshot({ token });
const next = deriveState({ ...raw, players, tournament });

// Skip the write when nothing but fetchedAt changed, so idle days don't
// accrue no-op commits (the workflow commits only when this file differs).
const path = 'data/snapshot.json';
if (fs.existsSync(path)) {
  const prev = JSON.parse(fs.readFileSync(path, 'utf8'));
  if (sameIgnoringFetchedAt(prev, next)) {
    console.log('No data change; snapshot left untouched.');
    process.exit(0);
  }
}

fs.writeFileSync(path, JSON.stringify(next, null, 1) + '\n');
console.log(`Snapshot updated (source last updated ${next.sourceLastUpdated ?? 'unknown'}).`);

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function sameIgnoringFetchedAt(a, b) {
  return (
    JSON.stringify({ ...a, fetchedAt: null }) === JSON.stringify({ ...b, fetchedAt: null })
  );
}
