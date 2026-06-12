# PRD: World Cup 2026 Sweepstakes Tracker

## Problem Statement

A family/friends group of 9 people is running a traditional pub-style sweepstakes for the FIFA World Cup 2026: 48 teams have been drawn between them offline (one player has 7 teams, one has 6, seven have 5 each), with prizes for the winner (£25), runner-up (£10) and tournament top scorer (£10). During the month-long tournament, players want to follow the action without having to manually cross-reference a fixture list against a draw sheet pinned to someone's fridge. They want to know, at a glance:

- Which of *their* teams are still alive
- Who is currently in the running for each of the three prizes
- How the group stage looks live, and which teams from "their" group will likely advance
- How the knockout bracket fills in as group results come through

The builder wants to deliver this with minimum infrastructure and zero on-call burden, because they will be on holiday with limited connectivity for a week during the tournament. The builder is not the sweepstakes organiser; the site's job is to display the truth of the tournament, not adjudicate disputes or pay prizes.

## Solution

A public, read-only static web tracker hosted on GitHub Pages, shared via a WhatsApp link. The page auto-refreshes as new match data lands, sourced from a free football data API (football-data.org, with API-Football as a swap-in fallback if free-tier coverage of the 2026 tournament is inadequate). A scheduled GitHub Action polls the API every ~10 minutes during match windows, normalises the response, and commits an updated JSON snapshot back to the repository. The page polls that snapshot directly from the repository's raw content URL, so fresh data reaches open tabs without waiting for a site redeploy — deploys happen only when the site's code changes.

The site presents four primary views — a leaderboard, the 12 group tables, the knockout bracket from R32 onward, and the top-scorer race — each tagged with the drawing player's name and colour so the sweepstakes overlay is the dominant signal, not an afterthought. A page-level "Data as of X minutes ago" indicator is calculated from the freshest upstream `lastUpdated` timestamp the API returned, not from when our local poll happened to run, so players see honest source freshness rather than pipeline freshness.

The draw mapping (player → list of teams) lives in a hand-edited JSON file in the repository, edited once before kick-off and not changed thereafter. There is no auth, no admin UI, no manual result-entry path, no fallback if the API or Action breaks — the builder has explicitly accepted that risk in exchange for not having to babysit anything from holiday. The page surfaces staleness via the freshness indicator so players self-diagnose.

## User Stories

1. As a **player**, I want to see a leaderboard of players ranked by teams-still-alive, so that I can tell at a glance whether I'm doing well in the sweepstakes.
2. As a **player**, I want each of my teams visually tagged with my name or colour wherever it appears, so that I can scan any view and immediately spot what's "mine".
3. As a **player**, I want to see all 12 group tables live with player tags on every team, so that I can follow groups containing my teams without filtering.
4. As a **player**, I want each group table to show standard standings columns (P, W, D, L, GF, GA, GD, Pts), so that the table is recognisable and trustworthy.
5. As a **player**, I want the group tables to reflect FIFA tiebreakers (points → goal difference → goals for → head-to-head) when teams are level, and positions still level beyond that shown as *undetermined* rather than guessed, so that the "qualified" indicator never contradicts what the broadcasters say.
6. As a **player**, I want to see which two teams from each group are projected/confirmed to advance, so that I know which of my teams are heading to the knockouts.
7. As a **player**, I want the eight best third-placed teams to be calculated and shown (per the 2026 48-team format), so that I'm not surprised when a 3rd-place team I drew sneaks into R32.
8. As a **player**, I want a knockout bracket view starting from the Round of 32, so that I can see the path my surviving teams have to take.
9. As a **player**, I want empty bracket slots to show their qualifying source (e.g. "Group F runner-up" or "3rd-place qualifier"), so that the bracket makes sense before the group stage is fully decided.
10. As a **player**, I want each occupied bracket slot to carry the drawing player's tag, so that I can read prize implications straight off the bracket.
11. As a **player**, I want a top-scorer race table, so that I can see who's contending for the £10 golden boot prize.
12. As a **player**, I want each top scorer tagged with the player who drew their team, so that I know whose pocket the £10 is currently heading for.
13. As a **player**, I want co-leaders in the top-scorer race shown as co-leaders (not artificially ranked), so that ambiguity is visible rather than hidden — the sweepstakes organiser handles tie-breaking, not the site.
14. As a **player**, I want a page-level "Data as of X ago" indicator computed from the upstream API's own `lastUpdated` timestamp, so that the freshness claim reflects real source data rather than the cron tick.
15. As a **player**, I want the freshness indicator to fall back to our local fetch time only when the API doesn't supply a per-resource timestamp, so that I always see *some* honest freshness signal.
16. As a **player**, I want the page to live-update without manual refresh, so that I can leave the tab open during a match and see goals/results appear.
17. As a **player**, I want the page to be designed mobile-first with a dark, sporty, legible theme, so that I can read it on my phone at the pub at night.
18. As a **player**, I want group tables to be horizontally scrollable on narrow screens, so that the standings columns aren't crushed.
19. As a **player**, I want the knockout bracket to render as a vertical, swipeable / accordion layout on narrow screens, so that I'm not pinch-zooming around a sprawling tree.
20. As a **player**, I want a clear visual cue when one of my teams is eliminated — defined as *confirmed out* (group-stage exit confirmed, or a knockout loss), not "mathematically eliminated" mid-group — so that I can mourn appropriately without the site doing speculative maths across the best-thirds race.
21. As a **player**, I want to share the URL in WhatsApp and have it open with a sensible title and preview, so that the link looks legitimate when I forward it.
22. As a **WhatsApp viewer**, I want to land on the page without signing in or registering, so that I can immediately see what this thing is.
23. As the **organiser**, I want the site to display the current "prize-holder" for each of the three prizes, so that the group has a shared canonical view to argue from — without the site pretending to be the source of truth on payout.
24. As the **organiser**, I want top-scorer ties surfaced as ties rather than auto-resolved, so that I can apply the rules I want (split, FIFA tiebreaker, whatever) without fighting the site.
25. As the **builder**, I want the draw mapping (player → teams) to live in a single hand-edited JSON file in the repo, so that I can fix a draw typo with a one-line git commit.
26. As the **builder**, I want the entire backend to be a single GitHub Actions cron job, so that there are zero servers to babysit while on holiday.
27. As the **builder**, I want the polled API response to be normalised inside the Action and committed as a single JSON snapshot, so that the front-end only ever fetches one well-shaped file.
28. As the **builder**, I want all tournament logic (standings, tiebreakers, best-3rd computation, knockout progression, sweepstakes overlay) encapsulated in one pure function, so that I can iterate on the rules in isolation from API plumbing and React rendering.
29. As the **builder**, I want the football API call wrapped in a single client module returning a normalised shape, so that swapping providers (football-data.org → API-Football) is a one-module change.
30. As the **builder**, I want the page-level freshness indicator to compute from `max(match.lastUpdated)`, so that I never accidentally show a misleadingly fresh "updated 12 seconds ago" when only the page bundle is recent.
31. As the **builder**, I want the site hosted as a GitHub Pages project site under my existing `username.github.io`, so that I don't need to set up new DNS or hosting.
32. As the **builder**, I want the React app to poll the snapshot from the repository's raw content URL (cache-busted) on a 30–60 second interval, so that a newly-committed snapshot reaches open tabs without waiting for a Pages redeploy or its CDN cache to expire.
33. As the **builder**, I want the page to show staleness rather than break if the Action stops running, so that a holiday outage is visible-but-non-fatal rather than silently broken.
34. As the **builder**, I want to be free to ignore tests in this build, so that I can ship before the opener and accept the bug risk in exchange for speed.

## Implementation Decisions

**Architecture**

- Static single-page app (React + Vite) hosted on GitHub Pages as a project site under the builder's existing `username.github.io` (or Netlify with a preview URL as a fallback).
- All persistent state lives in JSON files in the repository — there is no runtime database.
- A scheduled GitHub Actions workflow runs on a cron during match windows, calls the football data API, runs the normalised response through the Tournament State Engine, writes the result to `data/snapshot.json`, and commits it back to the repo. **Data commits do not trigger a redeploy, by design** — the front-end reads the snapshot straight from the repository, not from the deployed bundle.
- The browser polls `data/snapshot.json` via the repository's **raw content URL** (`raw.githubusercontent.com`, which sends `Access-Control-Allow-Origin: *`) with a cache-busting query param, on a 30–60 second interval, and re-renders. Polling the raw URL rather than the Pages-hosted copy avoids two traps: the Pages CDN's ~10-minute cache, and the fact that commits made with the default `GITHUB_TOKEN` deliberately don't trigger other workflows (so a snapshot commit would never have redeployed the site anyway). Polling cadence is faster than Action cadence on purpose so that any newly-committed snapshot reaches open tabs quickly.

**Modules**

- **Tournament State Engine** — pure function. Inputs: normalised matches (including scorers and per-resource `lastUpdated`), the draw mapping (player → teams), and the static tournament structure (groups, R32 slot rules, best-3rd rules). Output: a derived state object containing every group's standings, the eight best third-placed qualifiers, the populated knockout bracket from R32 onward, per-player "teams alive" counts, the top-scorer leaderboard with player tags, and the page-level freshness timestamp. Owns all FIFA tiebreaker logic and the 2026-specific best-3rd computation. No I/O.
- **Football API Client** — single function returning a normalised tournament snapshot (matches with scores + scorers + per-resource `lastUpdated`). Hides provider auth, rate limits, response shape, and per-resource freshness extraction. Designed so that swapping to API-Football is a one-module change without rippling into the engine.
- **GitHub Actions workflow** — orchestration only. Calls the API client, hands the result + draw mapping + tournament structure to the engine, writes the engine output to `data/snapshot.json`, commits if changed — where "changed" **excludes the envelope's `fetchedAt`**, otherwise every run produces a diff and the repo accrues no-op commits on idle days. Plain script.
- **React view components** — `Leaderboard`, `GroupTable`, `KnockoutBracket`, `TopScorerTable`, `FreshnessBadge`. Pure renderers over the snapshot. No business logic.

**Schema**

- `data/players.json` — hand-edited. Array of `{ name, colour, teams: [teamId, ...] }`. Edited once pre-tournament.
- `data/tournament.json` — static structure for World Cup 2026: groups, group→slot mapping into R32, best-3rd qualification rules. Edited once. Note that the third-place portion is **not** a simple group→slot map: which R32 slot each qualifying third-placed team lands in depends on *which combination* of groups the eight best thirds come from, per FIFA's published allocation procedure. Encoding that table/procedure is the single hairiest data structure in the project — see Further Notes.
- `data/snapshot.json` — written by the Action. Contains the engine's full derived state plus an envelope `{ fetchedAt, sourceLastUpdated, ... }` so the freshness badge has clean inputs.

**Data freshness**

- Page-level "Data as of X ago" is computed from `max(match.lastUpdated)` across the snapshot's matches, falling back to the snapshot envelope's `fetchedAt` only if no per-resource timestamps were available from the API. This is a load-bearing UX decision — never display the page's own load time as the freshness.

**Auth / failure modes**

- No auth. The URL is shared in a private WhatsApp group; that is the access control.
- No admin UI, no manual result-entry path, no API fallback, no alerting. If the API or Action breaks during the builder's holiday, the freshness indicator surfaces the staleness and players self-diagnose. This is a deliberately accepted risk in exchange for zero on-call burden.

**Tie handling**

- Ties (notably top-scorer co-leaders) are *visualised*, not resolved. The site is not the sweepstakes adjudicator.
- The same philosophy applies to group standings: the engine implements points → GD → GF → head-to-head, but FIFA's full chain continues through fair-play points (card data the free APIs likely won't supply) and drawing of lots. If teams are still level after head-to-head, the engine marks the affected positions **undetermined** rather than computing them wrong — with three-match groups this genuinely happens (Japan/Senegal 2018 was separated on fair play).

**Deployment**

- GitHub Pages project site, deployed by a Pages deploy workflow (build Vite → `deploy-pages`) that triggers on pushes touching site code. Data commits from the cron do **not** redeploy the site and don't need to — the front-end reads `data/snapshot.json` from the raw content URL, not the deployed bundle. (This sidesteps the `GITHUB_TOKEN` won't-trigger-workflows restriction rather than fighting it with a PAT.)
- As a project site under `username.github.io/<repo>`, Vite needs `base: '/<repo>/'` configured.

## Testing Decisions

The builder has explicitly opted out of an automated test suite for this build. Rationale:

- One-month event with a hard external deadline (the World Cup itself).
- Family/friends audience — the cost of a bug is eye-rolls, not money or trust.
- The most bug-risky surface (the Tournament State Engine) is a pure function that the builder can sanity-check by feeding it real API snapshots and eyeballing the bracket.

**One exception is carved out**: a single fixture-driven test of the third-place R32 allocation (given a set of eight qualifying groups, assert the slot assignments match FIFA's table). It is the one piece of logic that is both combinatorially easy to get silently wrong and impossible to eyeball-verify from a rendered bracket until the group stage actually ends — at which point the builder is on holiday.

The deliberate-skip is noted here so that a future contributor (or a returning self) knows the lack of tests is a choice, not an oversight. If further tests *were* added later, the natural targets are:

- **Tournament State Engine** — fixture-driven tests using captured API snapshots. Highest bug-risk-per-line (FIFA tiebreakers, the best-8 third-placed-teams calculation, R32 slotting). Pure-function inputs/outputs make it trivial to test.
- **Football API Client** — a recorded contract test (replay a captured response) that would fail loudly if football-data.org changed its schema mid-tournament.

A good test in this codebase would assert external behaviour of the engine — given a snapshot, the leaderboard / bracket / standings come out as expected — and would not poke at internal helpers, intermediate state, or component rendering details.

## Out of Scope

- Running the draw itself — already done offline.
- User accounts, login, per-player "private" pages.
- An admin UI or manual result-entry form.
- Prize payout, dispute resolution, or tie-breaking logic — the organiser handles this off-platform.
- Match predictions / fantasy points / any second game mode beyond the draw.
- Push notifications, email alerts, or any out-of-band notification when goals score.
- Backup data sources or automated provider failover.
- Health checks, uptime monitoring, alerting on Action failure.
- Historical archive / multi-tournament support — single-use site for the 2026 World Cup.
- Internationalisation — English only, GBP only.
- Accessibility audit beyond basic semantic HTML and adequate contrast.

## Further Notes

- **Launching after the opener is fine.** The 2026 World Cup opens the day this PRD is written and the site won't be live for kick-off — but football data APIs return the full competition history on every call, so the first poll after go-live backfills Match 1 (and anything else missed) automatically. No manual catch-up commit is needed.
- **2026 format risk.** The new 48-team / 12-group / best-8-third-placed format is novel; the chosen free API may surface standings in a format that doesn't reflect the new R32 qualification rules. The Tournament State Engine is responsible for computing R32 qualifiers from raw match results regardless of whether the API does it for us.
- **The third-place allocation table is the hardest part of `tournament.json`.** Eight of twelve thirds qualify, and FIFA resolves which R32 slot each one fills via a published procedure over the 495 possible group combinations. It is static, encodable, and the most likely place the bracket silently goes wrong — hence the single carved-out test in Testing Decisions. Budget real time for it.
- **Verify the API free tier on day one, not at swap time.** Three things to confirm before the engine's normalised shape is designed: 2026 competition coverage, per-match `lastUpdated`, and top-scorer data. If any fail, swap to API-Football *first* — the client module's contract should be designed against the provider that will actually serve the tournament.
- **Provider swap is anticipated.** If football-data.org's free tier doesn't include 2026 top-scorer data, the plan is to swap the Football API Client implementation to API-Football's free tier without touching the engine.
- **Polling lag is real — and lumpier than the cron suggests.** Action cron resolution (~10 min) plus GitHub's well-known scheduled-workflow jitter (often 5–15 min at busy times) plus page poll cadence means goals typically appear 10–20 minutes after they happen, with a worst case around 30. The freshness indicator is the contract with players that this is honest, not "live". (Reading the snapshot from the raw content URL already removes the Pages build and CDN-cache delays from this chain.)
- **Builder is on holiday.** No part of this plan requires the builder's intervention during the tournament. The accepted failure mode is "stale page" rather than "down page".
