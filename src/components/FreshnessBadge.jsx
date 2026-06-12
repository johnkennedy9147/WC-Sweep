import { useEffect, useState } from 'react';

// "Data as of X ago" from the upstream source's own lastUpdated, falling back
// to our fetch time only when the API gave no per-resource timestamps.
// Never the page's own load time.
export default function FreshnessBadge({ snapshot }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const iso = snapshot?.sourceLastUpdated ?? snapshot?.fetchedAt;
  if (!iso) return null;

  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  const label =
    mins < 1 ? 'moments ago'
    : mins < 60 ? `${mins} min ago`
    : `${Math.floor(mins / 60)} h ${mins % 60} min ago`;
  // Between match windows the upstream data legitimately doesn't change for
  // hours — amber only when play should be happening: a match is live, or a
  // not-yet-counted kickoff time has passed without the data moving.
  const playExpected =
    snapshot?.liveNow ||
    (snapshot?.nextKickoffUtc && Date.now() > new Date(snapshot.nextKickoffUtc).getTime());
  return (
    <span className={mins > 45 && playExpected ? 'freshness stale' : 'freshness'}>
      Data as of {label}
    </span>
  );
}
