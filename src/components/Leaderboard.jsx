// Podium finishes are achievements, not eliminations — never strike through
// the champion while the prize is being handed over.
const MEDAL = { champions: '🏆', runnersUp: '🥈', third: '🥉' };

export default function Leaderboard({ snapshot }) {
  const { leaderboard, prizes } = snapshot;
  return (
    <>
      <section className="prizes">
        <Prize title="Winner" prize={prizes.winner} />
        <Prize title="Runner-up" prize={prizes.runnerUp} />
        <article className="prize">
          <h3>Top scorer <span className="amount">{prizes.topScorer.amount}</span></h3>
          {prizes.topScorer.holders.length === 0 ? (
            <p className="muted">No goals yet</p>
          ) : (
            <p>
              {prizes.topScorer.holders.join(' & ')}
              <span className="muted"> via {prizes.topScorer.leaders.join(', ')}</span>
            </p>
          )}
          {prizes.topScorer.tie && (
            <p className="muted small">Tied — the organiser settles ties, not this site.</p>
          )}
        </article>
      </section>

      <section>
        {leaderboard.map((p) => (
          <article key={p.name} className="player-card" style={{ '--player': p.colour }}>
            <header>
              <span className="rank">#{p.rank}</span>
              <strong>{p.name}</strong>
              <span className="alive-count">
                {p.aliveCount}/{p.total} alive
              </span>
            </header>
            <ul className="chips">
              {p.teams.map((t) => (
                <li
                  key={t.teamId}
                  className={t.alive ? undefined : MEDAL[t.finish] ? 'medal' : 'out'}
                  title={t.exit ?? undefined}
                >
                  {t.name}
                  {MEDAL[t.finish] ? ` ${MEDAL[t.finish]}` : !t.alive && ' ✕'}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </>
  );
}

function Prize({ title, prize }) {
  return (
    <article className="prize">
      <h3>{title} <span className="amount">{prize.amount}</span></h3>
      {prize.holder ? (
        <p>{prize.holder}</p>
      ) : prize.decided ? (
        <p className="muted small">Decided — team not in the draw</p>
      ) : (
        <p className="muted small">In the running: {prize.inTheRunning.join(', ') || '—'}</p>
      )}
    </article>
  );
}
