import PlayerTag from './PlayerTag.jsx';

export default function TopScorers({ snapshot }) {
  const rows = snapshot.topScorers;
  const coLeaders = rows.filter((r) => r.rank === 1).length > 1;

  if (rows.length === 0) {
    return <p className="muted">No goals recorded yet.</p>;
  }
  return (
    <section className="group">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th className="left">Scorer</th>
              <th className="left">Team</th>
              <th className="left">Drawn by</th>
              <th>Goals</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.playerName}-${r.teamId}`} className={r.rank === 1 ? 's-thirds' : undefined}>
                <td>{r.rank}{r.rank === 1 && coLeaders && '='}</td>
                <td className="left team-name">{r.playerName}</td>
                <td className="left">{r.teamName}</td>
                <td className="left"><PlayerTag drawnBy={r.drawnBy} /></td>
                <td className="pts">{r.goals}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
