# World Cup 2026 Sweepstakes Tracker

Read-only static tracker for a family and friends World Cup sweepstakes. 

Netlify function triggered on a cron schedule dispatches GitHub Action which fetches from football-data.org, runs it through a state engine, and commits - `data/snapshot.json`; Front in is React SPA that polls that file from the repo's raw URL.
## Local dev

```sh
npm install
npm run sample   # only required before first real data fetch
npm run dev
```

`npm test` runs the one deliberate test (third-place R32 allocation —
see PRD, Testing Decisions).

## Go-live checklist

Real draw data (`data/tournament.json`, `data/players.json`) and the snapshot
URL in `src/App.jsx` are already in place — `npm test` validates all of them.
Remaining:

1. **Day-one API spike** — with a football-data.org token, run
   `FOOTBALL_DATA_TOKEN=... npm run update` and confirm: 2026 coverage,
   per-match `lastUpdated`, top-scorer data, and that `score.fullTime` is
   populated during `IN_PLAY`. If any fail, reimplement `lib/footballData.js`
   against API-Football (same return shape).
2. **GitHub repo** — make `johnkennedy9147/WC-Sweep` public (raw-URL polling
   and free-tier Pages need it); add the `FOOTBALL_DATA_TOKEN` Actions secret;
   under Settings → Pages set the source to **GitHub Actions** (the deploy
   workflow uses `deploy-pages`, not branch publishing).
3. Push to `main` — the deploy workflow publishes the site; the data cron
   (`.github/workflows/update-data.yml`) starts committing snapshots during
   match windows. Trigger either manually via *Run workflow* to smoke-test.

## Mid-tournament edits

The snapshot bakes the draw in: after editing `data/players.json` (e.g. fixing
a typo'd team code), manually run the **Update tournament data** workflow —
otherwise the fix only reaches the site at the next cron tick inside a match
window, which could be hours away.
