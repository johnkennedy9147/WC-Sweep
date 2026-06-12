// Football API Client — football-data.org v4.
// The only module that knows the provider's auth, endpoints, and response
// shape. Swapping to API-Football means reimplementing fetchTournamentSnapshot
// with the same return shape and touching nothing else.

const BASE = 'https://api.football-data.org/v4';

const STAGE_MAP = {
  GROUP_STAGE: 'GROUP',
  LAST_32: 'R32',
  ROUND_OF_32: 'R32',
  PLAYOFF_ROUND: 'R32',
  LAST_16: 'R16',
  ROUND_OF_16: 'R16',
  QUARTER_FINALS: 'QF',
  SEMI_FINALS: 'SF',
  THIRD_PLACE: 'THIRD',
  THIRD_PLACE_PLAYOFF: 'THIRD',
  FINAL: 'FINAL',
};

export async function fetchTournamentSnapshot({ token, competition = 'WC' }) {
  const [matchesBody, scorersBody] = await Promise.all([
    get(`/competitions/${competition}/matches`, token),
    get(`/competitions/${competition}/scorers?limit=60`, token),
  ]);
  return {
    fetchedAt: new Date().toISOString(),
    matches: (matchesBody.matches ?? []).map(normaliseMatch).filter(Boolean),
    scorers: (scorersBody.scorers ?? []).map(normaliseScorer),
  };
}

async function get(path, token) {
  const res = await fetch(BASE + path, { headers: { 'X-Auth-Token': token } });
  if (!res.ok) throw new Error(`football-data.org returned ${res.status} for ${path}`);
  return res.json();
}

export function normaliseMatch(m) {
  const stage = STAGE_MAP[m.stage];
  if (!stage) return null;
  return {
    id: m.id,
    stage,
    // v4 sends "GROUP_A"; older payloads/docs show "Group A". Accept both.
    group: m.group ? m.group.replace(/^GROUP_|^Group /, '') : null,
    utcDate: m.utcDate ?? null,
    status: m.status,
    lastUpdated: m.lastUpdated ?? null,
    home: normaliseTeam(m.homeTeam),
    away: normaliseTeam(m.awayTeam),
    score: {
      home: m.score?.fullTime?.home ?? null,
      away: m.score?.fullTime?.away ?? null,
    },
    winner:
      m.score?.winner === 'HOME_TEAM' ? 'HOME'
      : m.score?.winner === 'AWAY_TEAM' ? 'AWAY'
      : null,
  };
}

// Knockout fixtures appear with null/placeholder teams before pairings are
// known; normalise those to null so the engine renders slot-source labels.
function normaliseTeam(t) {
  if (!t || !t.tla) return null;
  return { id: t.tla, name: t.shortName || t.name };
}

function normaliseScorer(s) {
  return {
    playerName: s.player?.name ?? 'Unknown',
    teamId: s.team?.tla ?? null,
    teamName: s.team?.shortName || s.team?.name || null,
    goals: s.goals ?? 0,
  };
}
