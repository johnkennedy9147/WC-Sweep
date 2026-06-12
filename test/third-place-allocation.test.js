// The single deliberate test in this codebase (see PRD, Testing Decisions):
// fixture-driven verification of the third-place ranking and R32 allocation.
// It can't be eyeball-verified from a rendered bracket until the group stage
// ends — at which point the builder is on holiday.
import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveState, allocateThirds } from '../lib/engine.js';

// Twelve complete groups. In each, team 0 wins all three (9 pts), team 1 wins
// two (6 pts), team 2 — the third-placed team — beats team 3 by a margin that
// shrinks with the group letter, so the best-8 thirds are exactly groups A–H.
function buildFixtureMatches() {
  const matches = [];
  let id = 1;
  for (let gi = 0; gi < 12; gi++) {
    const g = String.fromCharCode(65 + gi); // A..L
    const t = [0, 1, 2, 3].map((n) => ({ id: `${g}${n}`, name: `Team ${g}${n}` }));
    const game = (home, away, hGoals, aGoals) =>
      matches.push({
        id: id++,
        stage: 'GROUP',
        group: g,
        utcDate: `2026-06-${String(12 + gi).padStart(2, '0')}T18:00:00Z`,
        status: 'FINISHED',
        lastUpdated: '2026-06-27T22:00:00Z',
        home, away,
        score: { home: hGoals, away: aGoals },
        winner: hGoals > aGoals ? 'HOME' : hGoals < aGoals ? 'AWAY' : null,
      });
    game(t[0], t[1], 1, 0);
    game(t[0], t[2], 1, 0);
    game(t[0], t[3], 1, 0);
    game(t[1], t[2], 1, 0);
    game(t[1], t[3], 1, 0);
    game(t[2], t[3], 14 - gi, 0); // third place: 3 pts, GD = 12-gi (A) … 1 (L)
  }
  return matches;
}

const fixtureTournament = {
  groups: Array.from({ length: 12 }, (_, gi) => {
    const g = String.fromCharCode(65 + gi);
    return { id: g, teams: [0, 1, 2, 3].map((n) => ({ id: `${g}${n}`, name: `Team ${g}${n}` })) };
  }),
  bracketTemplate: {},
  // Synthetic allocation table entry for the A–H combination.
  thirdPlaceAllocation: {
    ABCDEFGH: { M73: 'C', M74: 'A', M77: 'E', M78: 'B', M83: 'F', M84: 'D', M87: 'H', M88: 'G' },
  },
};

const fixturePlayers = [{ name: 'Tester', colour: '#fff', teams: [] }];

test('best-8 thirds are ranked correctly and allocated per the table', () => {
  const state = deriveState({
    matches: buildFixtureMatches(),
    scorers: [],
    fetchedAt: '2026-06-28T00:00:00Z',
    players: fixturePlayers,
    tournament: fixtureTournament,
  });

  assert.equal(state.thirdPlace.confirmed, true);
  const qualified = state.thirdPlace.rows.filter((r) => r.qualified).map((r) => r.group);
  assert.deepEqual(qualified, ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
  assert.deepEqual(
    state.thirdPlace.rows.map((r) => r.group),
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'],
  );
  assert.deepEqual(state.thirdPlace.allocation, fixtureTournament.thirdPlaceAllocation.ABCDEFGH);

  // Group-stage statuses follow: 1st/2nd through, qualifying thirds through,
  // non-qualifying thirds and 4th out.
  const groupA = state.groups.find((g) => g.id === 'A');
  assert.deepEqual(groupA.standings.map((r) => r.status), ['through', 'through', 'through', 'out']);
  const groupL = state.groups.find((g) => g.id === 'L');
  assert.deepEqual(groupL.standings.map((r) => r.status), ['through', 'through', 'out', 'out']);
});

test('allocation falls back to TBD (null) for combinations missing from the table', () => {
  assert.equal(allocateThirds(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'I'], fixtureTournament.thirdPlaceAllocation), null);
  assert.equal(allocateThirds(['A', 'B'], null), null);
  // Key is order-insensitive.
  assert.deepEqual(
    allocateThirds(['H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'], fixtureTournament.thirdPlaceAllocation),
    fixtureTournament.thirdPlaceAllocation.ABCDEFGH,
  );
});
