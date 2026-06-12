// Fixture-driven checks of the engine behaviours that can't be eyeballed until
// the tournament reaches them: boundary ties withholding verdicts, the engine
// deriving R32 slots from group results, and podium finishes ranking the
// leaderboard after the final.
import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveState } from '../lib/engine.js';

let nextId = 1;
function game(group, home, away, hGoals, aGoals, stage = 'GROUP') {
  return {
    id: nextId++,
    stage,
    group: stage === 'GROUP' ? group : null,
    utcDate: `2026-06-15T${String(10 + (nextId % 12)).padStart(2, '0')}:00:00Z`,
    status: 'FINISHED',
    lastUpdated: '2026-06-27T22:00:00Z',
    home,
    away,
    score: { home: hGoals, away: aGoals },
    winner: hGoals > aGoals ? 'HOME' : hGoals < aGoals ? 'AWAY' : null,
  };
}

const teamsOf = (g) => [0, 1, 2, 3].map((n) => ({ id: `${g}${n}`, name: `Team ${g}${n}` }));

// Twelve complete groups, same shape as third-place-allocation.test.js:
// team 0 wins all (9 pts), team 1 wins two (6 pts), team 2 third with a GD
// margin that shrinks with the group letter — best-8 thirds are groups A–H.
function completeGroups() {
  const matches = [];
  for (let gi = 0; gi < 12; gi++) {
    const g = String.fromCharCode(65 + gi);
    const t = teamsOf(g);
    matches.push(
      game(g, t[0], t[1], 1, 0),
      game(g, t[0], t[2], 1, 0),
      game(g, t[0], t[3], 1, 0),
      game(g, t[1], t[2], 1, 0),
      game(g, t[1], t[3], 1, 0),
      game(g, t[2], t[3], 14 - gi, 0),
    );
  }
  return matches;
}

const structure = (extra = {}) => ({
  groups: Array.from({ length: 12 }, (_, gi) => {
    const g = String.fromCharCode(65 + gi);
    return { id: g, teams: teamsOf(g) };
  }),
  bracketTemplate: {},
  thirdPlaceAllocation: {},
  ...extra,
});

const derive = (matches, tournament, players = [{ name: 'Tester', colour: '#fff', teams: [] }]) =>
  deriveState({ matches, scorers: [], fetchedAt: '2026-06-28T00:00:00Z', players, tournament });

test('a 3rd/4th tie unresolvable by head-to-head yields no verdict for either team', () => {
  // Group A: A2 and A3 finish identical on every criterion and drew their
  // mutual match — who is third is genuinely undetermined.
  const matches = completeGroups().filter((m) => m.group !== 'A');
  const t = teamsOf('A');
  matches.push(
    game('A', t[0], t[1], 2, 0),
    game('A', t[0], t[2], 2, 0),
    game('A', t[0], t[3], 2, 0),
    game('A', t[1], t[2], 1, 0),
    game('A', t[1], t[3], 1, 0),
    game('A', t[2], t[3], 1, 1),
  );
  const state = derive(matches, structure());

  const groupA = state.groups.find((g) => g.id === 'A');
  const [a2, a3] = groupA.standings.filter((r) => r.position >= 3);
  assert.equal(a2.undetermined, true);
  assert.equal(a3.undetermined, true);
  // No confirmed verdicts across the 3/4 boundary…
  assert.equal(a2.status, 'alive');
  assert.equal(a3.status, 'alive');
  // …no team marked dead, and no speculative thirds allocation.
  const board = derive(matches, structure(), [
    { name: 'P', colour: '#fff', teams: [a2.teamId, a3.teamId] },
  ]).leaderboard[0];
  assert.deepEqual(board.teams.map((x) => x.alive), [true, true]);
  assert.equal(state.thirdPlace.confirmed, false);
});

test('complete groups fill R32 slots from the engine, API matches pair by identity', () => {
  const bracketTemplate = {
    R32: [
      {
        match: 73,
        home: { source: 'winner', group: 'A', label: 'Winner Group A' },
        away: { source: 'runnerUp', group: 'B', label: 'Runner-up Group B' },
      },
      {
        match: 74,
        home: { source: 'winner', group: 'E', label: 'Winner Group E' },
        away: { source: 'thirdPlace', groups: ['A', 'B', 'C', 'D', 'F'], label: 'Best 3rd A/B/C/D/F' },
      },
    ],
  };
  const thirdPlaceAllocation = {
    ABCDEFGH: { '1A': 'H', '1B': 'G', '1D': 'B', '1E': 'C', '1G': 'A', '1I': 'F', '1K': 'D', '1L': 'E' },
  };
  const matches = completeGroups();
  // One R32 result arrives from the API. Its kickoff is the earliest, so
  // date-index pairing would wrongly park it in slot 0 (match 73) — identity
  // pairing must put it in slot 1 (match 74: E0 v third of C).
  matches.push({
    ...game(null, { id: 'E0', name: 'Team E0' }, { id: 'C2', name: 'Team C2' }, 1, 0, 'R32'),
    utcDate: '2026-06-01T00:00:00Z',
  });

  const state = derive(matches, structure({ bracketTemplate, thirdPlaceAllocation }));
  const r32 = state.bracket.rounds.find((r) => r.stage === 'R32');

  // Slot 0 has no API match yet: teams derived from confirmed group results.
  assert.equal(r32.matches[0].status, 'SCHEDULED');
  assert.equal(r32.matches[0].home.teamId, 'A0');
  assert.equal(r32.matches[0].away.teamId, 'B1');
  // Slot 1 carries the API result, including the allocated third (1E → C).
  assert.equal(r32.matches[1].status, 'FINISHED');
  assert.equal(r32.matches[1].home.teamId, 'E0');
  assert.equal(r32.matches[1].away.teamId, 'C2');
  assert.equal(r32.matches[1].winner, 'HOME');
});

test('the champion is an achievement, not an elimination', () => {
  const matches = completeGroups();
  matches.push(game(null, { id: 'A0', name: 'Team A0' }, { id: 'B0', name: 'Team B0' }, 2, 1, 'FINAL'));
  const players = [
    { name: 'Zoe', colour: '#fff', teams: ['A0'] }, // champion, alphabetically last
    { name: 'Adam', colour: '#000', teams: ['B0'] },
  ];
  const state = derive(matches, structure(), players);

  const [first, second] = state.leaderboard;
  assert.equal(first.name, 'Zoe');
  assert.equal(first.rank, 1);
  assert.equal(first.teams[0].finish, 'champions');
  assert.equal(second.name, 'Adam');
  assert.equal(second.rank, 2);
  assert.equal(second.teams[0].finish, 'runnersUp');

  assert.equal(state.prizes.winner.holder, 'Zoe');
  assert.equal(state.prizes.runnerUp.holder, 'Adam');
  assert.equal(state.prizes.winner.decided, true);
  assert.deepEqual(state.prizes.winner.inTheRunning, []);
});
