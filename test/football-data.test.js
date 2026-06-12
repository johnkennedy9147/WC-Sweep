// Regression: v4 sends group as "GROUP_A" (not the documented "Group A").
// The unstripped form created phantom GROUP_A…GROUP_L groups alongside the
// real A…L, so live results never reached the draw mapping.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliseMatch } from '../lib/footballData.js';

test('group ids are normalised to bare letters for both API spellings', () => {
  const base = {
    id: 1,
    stage: 'GROUP_STAGE',
    utcDate: '2026-06-11T19:00:00Z',
    status: 'FINISHED',
    lastUpdated: '2026-06-11T21:00:00Z',
    homeTeam: { tla: 'MEX', name: 'Mexico', shortName: 'Mexico' },
    awayTeam: { tla: 'RSA', name: 'South Africa', shortName: 'South Africa' },
    score: { fullTime: { home: 2, away: 1 }, winner: 'HOME_TEAM' },
  };
  assert.equal(normaliseMatch({ ...base, group: 'GROUP_A' }).group, 'A');
  assert.equal(normaliseMatch({ ...base, group: 'Group A' }).group, 'A');
  assert.equal(normaliseMatch({ ...base, group: null }).group, null);
});
