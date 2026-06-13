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
