# Outstanding work — fixes and go-live tasks

Findings from a full review of the code against `PRD.md` (2026-06-12, tournament now underway).
Status updated 2026-06-12 after an implementation pass. ✅ = done, ⏳ = blocked on a manual step.

Legend: 🔴 blocks go-live · 🟠 correctness bug · 🟡 should fix · ⚪ nice-to-have

---

## 1. Go-live blockers (data + config)

### 1.1 ✅ Encode the real tournament structure in `data/tournament.json`

Real groups, `bracketTemplate.R32` (FIFA matches 73–88) and the full 495-combination
`thirdPlaceAllocation` table are in place. `test/tournament-data.test.js` validates all of
it structurally (group shape, slot sources, every C(12,8) combination coherent).

### 1.2 ✅ Replace the sample draw in `data/players.json`

Real draw entered (one player 7 teams, one 6, seven × 5). Validated by
`test/tournament-data.test.js`: every TLA exists in `tournament.json`, all 48 teams
drawn exactly once.

### 1.3 ✅ Set the real snapshot URL

`src/App.jsx` points at `raw.githubusercontent.com/johnkennedy9147/WC-Sweep/main/...`.
Also fixed `vite.config.js` `base` from `/world-cup/` to `/WC-Sweep/` (repo name mismatch
would have 404'd every asset on Pages).

### 1.4 ⏳ Initial commit + GitHub wiring (manual)

Remote `johnkennedy9147/WC-Sweep` exists but is **empty and private**. Remaining, in order:

- commit everything and push to `main`;
- make the repo **public** — raw-URL polling and free-tier Pages require it;
- add the `FOOTBALL_DATA_TOKEN` Actions secret;
- Settings → Pages → source = **GitHub Actions**;
- manually `workflow_dispatch` both workflows to smoke-test the pipeline end-to-end.

### 1.5 ⏳ Day-one API spike (manual — needs a token)

Run `FOOTBALL_DATA_TOKEN=... npm run update` against the live API and confirm:

1. 2026 World Cup coverage on the free tier;
2. per-match `lastUpdated` present (feeds the freshness badge);
3. top-scorer data present;
4. **`score.fullTime` is populated during `IN_PLAY`** — the engine counts live
   matches via `fullTime`; if v4 only fills it at full time, live group standings
   silently won't move.

If any fail: reimplement `lib/footballData.js` against API-Football (same return shape).
Also worth checking on day one: whether the provider's R32 match ordering agrees with
the bracket — match-to-slot pairing is now identity-based (see 2.2), but matches with
no known teams still fall back to kickoff order.

---

## 2. Engine correctness bugs

### 2.1 ✅ Undetermined ties across a qualification boundary

`applyGroupStatuses()` now detects undetermined tie clusters straddling the 2/3 or 3/4
boundary in complete groups and leaves every clustered row non-final (`alive`) — no
speculative `out`/`through`, no team marked dead. `thirdPlace.confirmed` additionally
requires that no group's third-place *identity* is undetermined. Covered by
`test/engine-behaviour.test.js`.

### 2.2 ✅ Bracket slots paired by kickoff-date index

`buildBracket()` now pairs API matches to template slots by team identity whenever
either side is known; kickoff order is only the fallback for matches that carry no
teams (which also carry no scores to misattribute). Covered by
`test/engine-behaviour.test.js`.

### 2.3 ✅ Engine never feeds group results into the bracket

`resolveR32Sources()` fills R32 slots from confirmed group outcomes (complete group,
row not in an unresolved tie): winners, runners-up, and — once `thirdPlace.confirmed` —
third-placed teams via the Annex C allocation (`1X` keys). API-supplied teams win over
derived ones. Covered by `test/engine-behaviour.test.js`.

### 2.4 ✅ The champion displayed as eliminated

Champions / runners-up / third place are now terminal *achievements* (`finish` field):
chips render 🏆/🥈/🥉 instead of ✕ + strikethrough, and the leaderboard breaks
aliveCount ties by best finish so the winning player tops the final table. Covered by
`test/engine-behaviour.test.js`.

---

## 3. Should-fix before the group stage ends

### 3.1 ✅ Validate the draw mapping in the update script

`scripts/update-snapshot.js` exits non-zero, listing the offending player/ids, if
`players.json` references a team not in `tournament.json`. (Also enforced at test time
by `test/tournament-data.test.js`.)

### 3.2 ✅ WhatsApp link preview (tags only, by choice)

`og:url` + SVG favicon added. `og:image` is present but commented out in `index.html` —
drop a 1200×630 PNG into `public/og-image.png` and uncomment.

### 3.3 ✅ Document the players.json → snapshot propagation gap

README "Mid-tournament edits" section: run the *Update tournament data* workflow
manually after editing `players.json`.

---

## 4. Nice-to-have / cosmetic

### 4.1 ✅ Freshness badge amber during rest periods

Snapshot now carries `liveNow` + `nextKickoffUtc`; the badge only goes amber when play
should be happening (a match live, or a not-yet-counted kickoff has passed) and the
data is >45 min old. Idle rest days stay grey.

### 4.2 ✅ Head-to-head tiebreak reapplied recursively

`breakTies()` recurses on sub-clusters that remain level after a mini-table pass
(FIFA's reapplication); only a pass that separates nobody flags `undetermined`.

### 4.3 ✅ Pre-matchday thirds table

Hidden behind a placeholder until at least one counted result exists.

### 4.4 ✅ Prize cards after the final with an unmapped finalist

`prizes.winner/runnerUp` carry a `decided` flag; the card shows "Decided — team not in
the draw" instead of regressing to a stale "in the running" list.

---

## Done / verified during review

- `npm test` — 9 tests pass (allocation mechanism, real-data validation, engine behaviour).
- `npm run build` — clean Vite production build.
- Architecture verified against PRD: pure engine, isolated API client, raw-URL
  polling, path-filtered deploy, `fetchedAt`-excluded change detection, freshness from
  `max(match.lastUpdated)` with `fetchedAt` fallback, ties visualised not resolved.
- Earlier session fix: bracket TBD slots passed the whole template object as `label`
  (would have crashed React); now passes the string.
