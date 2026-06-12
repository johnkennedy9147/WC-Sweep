import { useEffect, useState } from 'react';
import FreshnessBadge from './components/FreshnessBadge.jsx';
import Leaderboard from './components/Leaderboard.jsx';
import GroupTables from './components/GroupTables.jsx';
import Bracket from './components/Bracket.jsx';
import TopScorers from './components/TopScorers.jsx';

// Data is read from the repo's raw URL, not the deployed bundle, so snapshot
// commits reach open tabs without a redeploy (and without the Pages CDN cache).
const SNAPSHOT_URL = import.meta.env.DEV
  ? '/data/snapshot.json'
  : 'https://raw.githubusercontent.com/johnkennedy9147/WC-Sweep/main/data/snapshot.json';
const POLL_MS = 45_000;

const TABS = [
  ['players', 'Players'],
  ['groups', 'Groups'],
  ['bracket', 'Bracket'],
  ['boot', 'Golden Boot'],
];

export default function App() {
  const [snapshot, setSnapshot] = useState(null);
  const [tab, setTab] = useState('players');

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(`${SNAPSHOT_URL}?t=${Date.now()}`);
        if (res.ok && !cancelled) setSnapshot(await res.json());
      } catch {
        // Stale data is the accepted failure mode; keep showing what we have.
      }
    }
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <>
      <header className="site-header">
        <div className="title-row">
          <h1>World Cup 2026 Sweepstakes</h1>
          <FreshnessBadge snapshot={snapshot} />
        </div>
        <nav>
          {TABS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={tab === id ? 'active' : undefined}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {snapshot === null ? (
          <p className="muted">No tournament data yet — check back soon.</p>
        ) : (
          <>
            {tab === 'players' && <Leaderboard snapshot={snapshot} />}
            {tab === 'groups' && <GroupTables snapshot={snapshot} />}
            {tab === 'bracket' && <Bracket snapshot={snapshot} />}
            {tab === 'boot' && <TopScorers snapshot={snapshot} />}
          </>
        )}
      </main>
    </>
  );
}
