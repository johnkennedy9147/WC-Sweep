// Validates the REAL data files — the artefacts the PRD warns about most.
// The allocation table can't be eyeball-verified from a rendered bracket until
// the group stage ends, so structural invariants are checked here instead:
// every one of the C(12,8) = 495 combinations must be present and internally
// coherent, and the draw in players.json must reference real teams.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const tournament = JSON.parse(fs.readFileSync('data/tournament.json', 'utf8'));
const players = JSON.parse(fs.readFileSync('data/players.json', 'utf8')).players;

const GROUP_LETTERS = 'ABCDEFGHIJKL'.split('');
// FIFA Annex C: the eight group-winner slots that face a third-placed team.
const THIRD_FACING_SLOTS = ['1A', '1B', '1D', '1E', '1G', '1I', '1K', '1L'];

test('groups: 12 groups of 4 with unique team ids', () => {
  assert.deepEqual(tournament.groups.map((g) => g.id), GROUP_LETTERS);
  const ids = tournament.groups.flatMap((g) => g.teams.map((t) => t.id));
  assert.equal(ids.length, 48);
  assert.equal(new Set(ids).size, 48);
  for (const id of ids) assert.match(id, /^[A-Z]{3}$/);
});

test('bracketTemplate.R32: 16 slots covering FIFA matches 73-88', () => {
  const slots = tournament.bracketTemplate.R32;
  assert.equal(slots.length, 16);
  assert.deepEqual(
    slots.map((s) => s.match).sort((a, b) => a - b),
    Array.from({ length: 16 }, (_, i) => 73 + i),
  );

  const winners = [];
  const runnersUp = [];
  let thirds = 0;
  for (const slot of slots) {
    for (const side of [slot.home, slot.away]) {
      assert.equal(typeof side.label, 'string');
      if (side.source === 'thirdPlace') {
        thirds++;
        // Each third-place side faces a group winner, whose letter keys Annex C.
        const facing = [slot.home, slot.away].find((s) => s.source === 'winner');
        assert.ok(facing, `match ${slot.match}: third-place side has no facing winner`);
        assert.ok(THIRD_FACING_SLOTS.includes(`1${facing.group}`), `match ${slot.match}`);
      } else {
        assert.ok(['winner', 'runnerUp'].includes(side.source));
        assert.ok(GROUP_LETTERS.includes(side.group));
        (side.source === 'winner' ? winners : runnersUp).push(side.group);
      }
    }
  }
  // All 12 winners and 12 runners-up enter R32 exactly once; 8 slots take thirds.
  assert.deepEqual([...winners].sort(), GROUP_LETTERS);
  assert.deepEqual([...runnersUp].sort(), GROUP_LETTERS);
  assert.equal(thirds, 8);
});

test('thirdPlaceAllocation: all 495 combinations, each internally coherent', () => {
  const table = tournament.thirdPlaceAllocation;
  const keys = Object.keys(table);
  assert.equal(keys.length, 495); // C(12,8)

  for (const key of keys) {
    const letters = key.split('');
    assert.equal(letters.length, 8, key);
    assert.deepEqual(letters, [...letters].sort(), `${key} not sorted`);
    assert.equal(new Set(letters).size, 8, `${key} has duplicates`);
    for (const l of letters) assert.ok(GROUP_LETTERS.includes(l), key);

    const mapping = table[key];
    assert.deepEqual(Object.keys(mapping).sort(), THIRD_FACING_SLOTS, key);
    const assigned = Object.values(mapping);
    assert.equal(new Set(assigned).size, 8, `${key} assigns a third twice`);
    for (const l of assigned) {
      assert.ok(letters.includes(l), `${key}: assigns 3rd of group ${l}, which didn't qualify`);
    }
  }
});

test('players.json: real draw shape, valid teams, every team drawn exactly once', () => {
  const counts = players.map((p) => p.teams.length).sort((a, b) => a - b);
  assert.deepEqual(counts, [5, 5, 5, 5, 5, 5, 5, 6, 7]);

  const tournamentIds = new Set(tournament.groups.flatMap((g) => g.teams.map((t) => t.id)));
  const drawn = players.flatMap((p) => p.teams);
  assert.equal(drawn.length, 48);
  assert.equal(new Set(drawn).size, 48, 'a team is drawn twice');
  for (const id of drawn) assert.ok(tournamentIds.has(id), `unknown team id ${id}`);
});
