import PlayerTag from './PlayerTag.jsx';

// Vertical accordion per round — mobile-first, no sprawling tree.
export default function Bracket({ snapshot }) {
  const rounds = snapshot.bracket.rounds;
  const firstUnfinished =
    rounds.find((r) => r.matches.some((m) => m.status !== 'FINISHED'))?.stage ?? rounds[0].stage;

  return rounds.map((round) => (
    <details key={round.stage} open={round.stage === firstUnfinished}>
      <summary>{round.name}</summary>
      <ul className="bracket-round">
        {round.matches.map((m, i) => (
          <li key={i} className="bracket-match">
            <Side side={m.home} winner={m.winner === 'HOME'} score={m.score.home} />
            <Side side={m.away} winner={m.winner === 'AWAY'} score={m.score.away} />
            {(m.status === 'IN_PLAY' || m.status === 'PAUSED') && <span className="live">Live</span>}
          </li>
        ))}
      </ul>
    </details>
  ));
}

function Side({ side, winner, score }) {
  if (!side.teamId) {
    return (
      <div className="side tbd">
        <span className="team">{side.label}</span>
      </div>
    );
  }
  return (
    <div className={winner ? 'side win' : 'side'}>
      <PlayerTag drawnBy={side.drawnBy} compact />
      <span className="team">{side.name}</span>
      <span className="score">{score ?? ''}</span>
    </div>
  );
}
