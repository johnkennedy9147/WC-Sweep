// Tournament State Engine — pure derivation, no I/O.
// Input: normalised matches + scorers (from the API client), the draw mapping
// (players.json) and static structure (tournament.json).
// Output: the full derived state the front-end renders (data/snapshot.json).

const ROUNDS = ['R32', 'R16', 'QF', 'SF', 'THIRD', 'FINAL'];
const ROUND_SIZES = { R32: 16, R16: 8, QF: 4, SF: 2, THIRD: 1, FINAL: 1 };
const ROUND_NAMES = {
  R32: 'Round of 32',
  R16: 'Round of 16',
  QF: 'Quarter-finals',
  SF: 'Semi-finals',
  THIRD: 'Third place',
  FINAL: 'Final',
};
// Shown in empty bracket slots when tournament.json's bracketTemplate has no
// specific source label for that slot yet.
const FALLBACK_SLOT_LABEL = {
  R32: 'Group qualifier',
  R16: 'R32 winner',
  QF: 'R16 winner',
  SF: 'QF winner',
  THIRD: 'SF loser',
  FINAL: 'SF winner',
};
const COUNTED = new Set(['FINISHED', 'IN_PLAY', 'PAUSED']);

export function deriveState({ matches, scorers, fetchedAt, players, tournament }) {
  const drawnBy = buildDrawMap(players);
  const groups = buildGroups(matches, tournament, drawnBy);
  const thirdPlace = buildThirdPlace(groups, tournament);
  applyGroupStatuses(groups, thirdPlace);
  const bracket = buildBracket(matches, tournament, drawnBy, groups, thirdPlace);
  const teams = buildTeamStatus(groups, thirdPlace, matches);
  const leaderboard = buildLeaderboard(players, teams);
  const topScorers = buildTopScorers(scorers, drawnBy);
  const prizes = buildPrizes(leaderboard, teams, topScorers, matches, drawnBy);

  return {
    fetchedAt,
    sourceLastUpdated: maxIso(matches.map((m) => m.lastUpdated)),
    // Lets the freshness badge distinguish "idle between matches" from "stale
    // while play should be happening" (a not-yet-started match whose kickoff
    // has passed means our data is behind).
    liveNow: matches.some((m) => m.status === 'IN_PLAY' || m.status === 'PAUSED'),
    nextKickoffUtc: minIso(matches.filter((m) => !COUNTED.has(m.status)).map((m) => m.utcDate)),
    groups,
    thirdPlace,
    bracket,
    leaderboard,
    topScorers,
    prizes,
  };
}

// Given the 8 qualifying group letters and the allocation table from
// tournament.json, return the slot mapping for that combination, or null when
// the table doesn't (yet) cover it — the bracket then shows TBD labels rather
// than a wrong pairing.
export function allocateThirds(qualifiedGroups, allocationTable) {
  if (!allocationTable) return null;
  const key = [...qualifiedGroups].sort().join('');
  return allocationTable[key] ?? null;
}

function buildDrawMap(players) {
  const map = new Map();
  for (const p of players) {
    for (const teamId of p.teams) map.set(teamId, { name: p.name, colour: p.colour });
  }
  return map;
}

// --- Group stage -----------------------------------------------------------

function buildGroups(matches, tournament, drawnBy) {
  const groupMatches = matches.filter((m) => m.stage === 'GROUP' && m.group);
  const ids = new Set(tournament.groups.map((g) => g.id));
  for (const m of groupMatches) ids.add(m.group);
  return [...ids].sort().map((id) => {
    const ms = groupMatches.filter((m) => m.group === id);
    const structural = tournament.groups.find((g) => g.id === id);
    return buildGroupTable(id, ms, structural, drawnBy);
  });
}

function buildGroupTable(id, ms, structural, drawnBy) {
  const teams = new Map();
  const ensure = (t) => {
    if (!t) return null;
    if (!teams.has(t.id)) {
      teams.set(t.id, {
        teamId: t.id,
        name: t.name,
        drawnBy: drawnBy.get(t.id) ?? null,
        played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0,
      });
    }
    return teams.get(t.id);
  };

  if (structural) for (const t of structural.teams) ensure(t);
  for (const m of ms) { ensure(m.home); ensure(m.away); }

  const counted = ms.filter((m) => COUNTED.has(m.status) && m.score.home != null);
  for (const m of counted) {
    const h = ensure(m.home);
    const a = ensure(m.away);
    h.played++; a.played++;
    h.gf += m.score.home; h.ga += m.score.away;
    a.gf += m.score.away; a.ga += m.score.home;
    if (m.score.home > m.score.away) { h.won++; a.lost++; h.points += 3; }
    else if (m.score.home < m.score.away) { a.won++; h.lost++; a.points += 3; }
    else { h.drawn++; a.drawn++; h.points++; a.points++; }
  }
  for (const t of teams.values()) t.gd = t.gf - t.ga;

  const standings = [...teams.values()];
  sortStandings(standings, counted);
  const complete = ms.length === 6 && ms.every((m) => m.status === 'FINISHED');
  return { id, complete, standings };
}

// FIFA group tiebreakers: points → GD → GF (all group matches), then the same
// three among the tied teams only (head-to-head). Anything still level after
// that needs fair-play points / drawing of lots, which we can't compute — those
// positions are flagged `undetermined` instead of guessed.
function sortStandings(rows, countedMatches) {
  const base = (a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf;
  rows.sort((a, b) => base(a, b) || a.name.localeCompare(b.name));
  for (const r of rows) r.undetermined = false;

  let i = 0;
  while (i < rows.length) {
    let j = i + 1;
    while (j < rows.length && base(rows[i], rows[j]) === 0) j++;
    if (j - i > 1) rows.splice(i, j - i, ...breakTies(rows.slice(i, j), countedMatches));
    i = j;
  }
  rows.forEach((r, idx) => { r.position = idx + 1; });
}

// Head-to-head mini-table among the tied teams, reapplied recursively to any
// sub-group still level after a pass (FIFA reapplies the criteria to the
// remaining tied teams — for two teams their mutual result usually decides).
// A pass that separates nobody is a dead end: fair-play points / drawing of
// lots, which we can't compute — flag the whole sub-group undetermined.
function breakTies(cluster, countedMatches) {
  const mini = miniTable(cluster.map((r) => r.teamId), countedMatches);
  const h2h = (a, b) => {
    const ma = mini.get(a.teamId);
    const mb = mini.get(b.teamId);
    return mb.points - ma.points || mb.gd - ma.gd || mb.gf - ma.gf;
  };
  const sorted = [...cluster].sort((a, b) => h2h(a, b) || a.name.localeCompare(b.name));

  const out = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && h2h(sorted[i], sorted[j]) === 0) j++;
    const sub = sorted.slice(i, j);
    if (sub.length === sorted.length) {
      for (const r of sub) r.undetermined = true;
      out.push(...sub);
    } else if (sub.length > 1) {
      out.push(...breakTies(sub, countedMatches));
    } else {
      out.push(...sub);
    }
    i = j;
  }
  return out;
}

function miniTable(teamIds, matches) {
  const ids = new Set(teamIds);
  const rows = new Map(teamIds.map((id) => [id, { points: 0, gd: 0, gf: 0 }]));
  for (const m of matches) {
    if (!m.home || !m.away || m.score.home == null) continue;
    if (!ids.has(m.home.id) || !ids.has(m.away.id)) continue;
    const h = rows.get(m.home.id);
    const a = rows.get(m.away.id);
    h.gf += m.score.home; h.gd += m.score.home - m.score.away;
    a.gf += m.score.away; a.gd += m.score.away - m.score.home;
    if (m.score.home > m.score.away) h.points += 3;
    else if (m.score.home < m.score.away) a.points += 3;
    else { h.points++; a.points++; }
  }
  return rows;
}

// --- Best third-placed teams (2026: 8 of 12 qualify) -------------------------

function buildThirdPlace(groups, tournament) {
  const rows = groups
    .map((g) => {
      const r = g.standings.find((s) => s.position === 3);
      // identityUndetermined: the group's own sort couldn't separate this row
      // from a neighbour, so *which team* is third is still unknown.
      return r ? { group: g.id, groupComplete: g.complete, identityUndetermined: r.undetermined, ...r } : null;
    })
    .filter(Boolean);

  const cmp = (a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf;
  rows.sort((a, b) => cmp(a, b) || a.group.localeCompare(b.group));
  rows.forEach((r, i) => {
    r.rank = i + 1;
    r.qualified = i < 8;
    r.undetermined = false;
  });
  for (let i = 0; i < rows.length - 1; i++) {
    if (cmp(rows[i], rows[i + 1]) === 0) {
      rows[i].undetermined = true;
      rows[i + 1].undetermined = true;
    }
  }

  const allComplete = groups.length > 0 && groups.every((g) => g.complete);
  const boundaryTie = rows.length > 8 && cmp(rows[7], rows[8]) === 0;
  const identityUnknown = rows.some((r) => r.identityUndetermined);
  const confirmed = allComplete && !boundaryTie && !identityUnknown;
  const allocation = confirmed
    ? allocateThirds(rows.filter((r) => r.qualified).map((r) => r.group), tournament.thirdPlaceAllocation)
    : null;

  return { rows, confirmed, allocation };
}

// Statuses: 'through' / 'out' are confirmed; 'projected' (top-2 spot, group
// unfinished), 'thirds' (currently inside the best-8 race), 'alive' otherwise.
function applyGroupStatuses(groups, thirdPlace) {
  const thirdsByTeam = new Map(thirdPlace.rows.map((r) => [r.teamId, r]));
  for (const g of groups) {
    const speculative = g.complete ? boundarySpanningTies(g.standings) : new Set();
    for (const row of g.standings) {
      if (g.complete && !speculative.has(row.teamId)) {
        if (row.position <= 2) row.status = 'through';
        else if (row.position === 3) {
          const t = thirdsByTeam.get(row.teamId);
          if (thirdPlace.confirmed) row.status = t?.qualified ? 'through' : 'out';
          else row.status = t?.qualified ? 'thirds' : 'alive';
        } else row.status = 'out';
      } else if (g.complete) {
        // Tied across a qualification boundary: positions are alphabetical
        // placeholders, so no confirmed verdict until externally resolved.
        row.status = 'alive';
      } else if (row.position <= 2) row.status = 'projected';
      else if (row.position === 3 && thirdsByTeam.get(row.teamId)?.qualified) row.status = 'thirds';
      else row.status = 'alive';
    }
  }
}

// Teams whose unresolved tie cluster straddles the 2/3 or 3/4 boundary — their
// qualification class is genuinely unknown, never a verdict (PRD stories 5/20).
// Consecutive undetermined rows are treated as one cluster; that can merge two
// independent ties, which errs on the side of withholding verdicts.
function boundarySpanningTies(standings) {
  const speculative = new Set();
  let i = 0;
  while (i < standings.length) {
    if (!standings[i].undetermined) { i++; continue; }
    let j = i;
    while (j < standings.length && standings[j].undetermined) j++;
    const lo = standings[i].position;
    const hi = standings[j - 1].position;
    if ((lo <= 2 && hi >= 3) || (lo <= 3 && hi >= 4)) {
      for (const r of standings.slice(i, j)) speculative.add(r.teamId);
    }
    i = j;
  }
  return speculative;
}

// --- Knockout bracket --------------------------------------------------------

function buildBracket(matches, tournament, drawnBy, groups, thirdPlace) {
  const rounds = ROUNDS.map((stage) => {
    const ms = matches
      .filter((m) => m.stage === stage)
      .sort((a, b) => (a.utcDate ?? '').localeCompare(b.utcDate ?? '') || a.id - b.id);
    const templates = tournament.bracketTemplate?.[stage] ?? [];
    const derived = templates.map((t) => resolveR32Sources(t, groups, thirdPlace));
    const assigned = assignMatchesToSlots(ms, derived, ROUND_SIZES[stage]);
    const slots = [];
    for (let i = 0; i < ROUND_SIZES[stage]; i++) {
      slots.push(formatSlot(assigned[i], templates[i], stage, drawnBy, derived[i]));
    }
    return { stage, name: ROUND_NAMES[stage], matches: slots };
  });
  return { rounds };
}

// Engine-derived slot teams (PRD Further Notes: compute R32 qualifiers from raw
// results regardless of whether the API does). Only confirmed outcomes count:
// the group must be complete and the row must not sit in an unresolved tie.
function resolveR32Sources(template, groups, thirdPlace) {
  const confirmedRow = (groupId, position) => {
    const g = groups.find((x) => x.id === groupId);
    if (!g?.complete) return null;
    const row = g.standings.find((r) => r.position === position);
    return row && !row.undetermined ? { id: row.teamId, name: row.name } : null;
  };
  const resolveSide = (side) => {
    if (!side) return null;
    if (side.source === 'winner') return confirmedRow(side.group, 1);
    if (side.source === 'runnerUp') return confirmedRow(side.group, 2);
    if (side.source === 'thirdPlace') {
      if (!thirdPlace.confirmed || !thirdPlace.allocation) return null;
      // Annex C keys each third-place opponent by the group-winner slot it
      // faces ("1A" …), so the facing side tells us which key to look up.
      const facing = [template.home, template.away].find((s) => s?.source === 'winner');
      const letter = facing ? thirdPlace.allocation[`1${facing.group}`] : null;
      const r = letter ? thirdPlace.rows.find((x) => x.group === letter) : null;
      return r ? { id: r.teamId, name: r.name } : null;
    }
    return null;
  };
  return { home: resolveSide(template.home), away: resolveSide(template.away) };
}

// Pair API matches with template slots by team identity wherever either side
// is known — kickoff order is not a reliable key (two fixtures can share a
// kickoff time), and the template is in FIFA match-number order, not date
// order. Matches with no known teams fall back to filling free slots in
// kickoff order; their labels may be off until pairings firm up, but they
// carry no teams or scores to misattribute.
function assignMatchesToSlots(ms, derived, size) {
  const assigned = new Array(size).fill(null);
  const leftover = [];
  for (const m of ms) {
    const ids = [m.home?.id, m.away?.id].filter(Boolean);
    const slot = ids.length
      ? derived.findIndex(
          (d, i) => !assigned[i] && d && [d.home?.id, d.away?.id].some((x) => x && ids.includes(x)),
        )
      : -1;
    if (slot >= 0) assigned[slot] = m;
    else leftover.push(m);
  }
  for (const m of leftover) {
    const free = assigned.findIndex((x) => x === null);
    if (free >= 0) assigned[free] = m;
  }
  return assigned;
}

function formatSlot(match, template, stage, drawnBy, derived) {
  const side = (team, label) => {
    if (team) return { teamId: team.id, name: team.name, drawnBy: drawnBy.get(team.id) ?? null };
    return { label: label ?? FALLBACK_SLOT_LABEL[stage] };
  };
  // API-supplied teams win over engine-derived ones.
  const home = match?.home ?? derived?.home ?? null;
  const away = match?.away ?? derived?.away ?? null;
  return {
    status: match?.status ?? 'SCHEDULED',
    utcDate: match?.utcDate ?? null,
    home: side(home, template?.home?.label),
    away: side(away, template?.away?.label),
    score: match?.score ?? { home: null, away: null },
    winner: match?.winner ?? null,
  };
}

// --- Per-team fate (alive / exit), feeding the leaderboard and prizes --------

function buildTeamStatus(groups, thirdPlace, matches) {
  const teams = new Map();
  for (const g of groups) {
    for (const row of g.standings) {
      teams.set(row.teamId, {
        teamId: row.teamId,
        name: row.name,
        alive: true,
        exit: null, // set once a team can no longer win the tournament
        finish: null, // terminal achievement: 'champions' | 'runnersUp' | 'third'
      });
    }
  }
  for (const g of groups) {
    for (const row of g.standings) {
      if (row.status === 'out') {
        const t = teams.get(row.teamId);
        t.alive = false;
        t.exit = 'Group stage';
      }
    }
  }

  for (const stage of ROUNDS) {
    for (const m of matches) {
      if (m.stage !== stage || m.status !== 'FINISHED' || !m.winner || !m.home || !m.away) continue;
      const winner = teams.get((m.winner === 'HOME' ? m.home : m.away).id);
      const loser = teams.get((m.winner === 'HOME' ? m.away : m.home).id);
      if (!winner || !loser) continue;
      if (stage === 'SF') {
        loser.exit = 'Semi-finals'; // still alive: plays the third-place match
      } else if (stage === 'THIRD') {
        // A medal is an achievement, not an elimination (PRD: never show the
        // podium struck through while the prize is being settled).
        winner.alive = false; winner.exit = 'Third place'; winner.finish = 'third';
        loser.alive = false; loser.exit = 'Fourth place';
      } else if (stage === 'FINAL') {
        winner.alive = false; winner.exit = 'Champions'; winner.finish = 'champions';
        loser.alive = false; loser.exit = 'Runners-up'; loser.finish = 'runnersUp';
      } else {
        loser.alive = false;
        loser.exit = ROUND_NAMES[stage];
      }
    }
  }
  return teams;
}

// After the final every aliveCount is 0 — podium finishes break the tie so the
// champion's player tops the table rather than sorting alphabetically.
const FINISH_RANK = { champions: 0, runnersUp: 1, third: 2 };

function buildLeaderboard(players, teams) {
  const board = players.map((p) => {
    const ts = p.teams.map((teamId) => {
      const t = teams.get(teamId);
      return t
        ? { teamId, name: t.name, alive: t.alive, exit: t.exit, finish: t.finish }
        : { teamId, name: teamId, alive: true, exit: null, finish: null };
    });
    return {
      name: p.name,
      colour: p.colour,
      teams: ts,
      aliveCount: ts.filter((t) => t.alive).length,
      total: ts.length,
      bestFinish: Math.min(...ts.map((t) => FINISH_RANK[t.finish] ?? 9)),
    };
  });
  board.sort(
    (a, b) => b.aliveCount - a.aliveCount || a.bestFinish - b.bestFinish || a.name.localeCompare(b.name),
  );
  board.forEach((p, i) => {
    const tied =
      i > 0 && board[i - 1].aliveCount === p.aliveCount && board[i - 1].bestFinish === p.bestFinish;
    p.rank = tied ? board[i - 1].rank : i + 1;
  });
  return board;
}

// --- Golden boot --------------------------------------------------------------

function buildTopScorers(scorers, drawnBy) {
  const rows = scorers
    .map((s) => ({ ...s, drawnBy: drawnBy.get(s.teamId) ?? null }))
    .sort((a, b) => b.goals - a.goals || a.playerName.localeCompare(b.playerName));
  rows.forEach((r, i) => {
    r.rank = i > 0 && rows[i - 1].goals === r.goals ? rows[i - 1].rank : i + 1;
  });
  return rows;
}

// --- Prizes --------------------------------------------------------------------

function buildPrizes(leaderboard, teams, topScorers, matches, drawnBy) {
  const final = matches.find((m) => m.stage === 'FINAL' && m.status === 'FINISHED' && m.winner);
  let winnerHolder = null;
  let runnerUpHolder = null;
  if (final) {
    const w = final.winner === 'HOME' ? final.home : final.away;
    const l = final.winner === 'HOME' ? final.away : final.home;
    winnerHolder = drawnBy.get(w.id)?.name ?? null;
    runnerUpHolder = drawnBy.get(l.id)?.name ?? null;
  }

  // "In the running" = drew at least one team that can still reach the final.
  const inTheRunning = leaderboard
    .filter((p) => p.teams.some((t) => t.alive && !t.exit))
    .map((p) => p.name);

  const leaders = topScorers.filter((s) => s.rank === 1);
  // decided distinguishes "final played, nobody drew that team" (only possible
  // via a draw typo) from "not yet decided" — never regress to "in the running".
  const decided = Boolean(final);
  return {
    winner: { amount: '£25', holder: winnerHolder, decided, inTheRunning: decided ? [] : inTheRunning },
    runnerUp: { amount: '£10', holder: runnerUpHolder, decided, inTheRunning: decided ? [] : inTheRunning },
    topScorer: {
      amount: '£10',
      // Ties are visualised, never resolved — the organiser adjudicates.
      tie: leaders.length > 1,
      leaders: leaders.map((l) => l.playerName),
      holders: [...new Set(leaders.map((l) => l.drawnBy?.name).filter(Boolean))],
    },
  };
}

function maxIso(values) {
  const present = values.filter(Boolean).sort();
  return present.length ? present[present.length - 1] : null;
}

function minIso(values) {
  const present = values.filter(Boolean).sort();
  return present.length ? present[0] : null;
}
