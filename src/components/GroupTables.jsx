import PlayerTag from './PlayerTag.jsx';

const STATUS_LABEL = {
  through: 'Through',
  out: 'Out',
  projected: 'On course',
  thirds: '3rd-place race',
};

export default function GroupTables({ snapshot }) {
  return (
    <>
      {snapshot.groups.map((g) => (
        <section key={g.id} className="group">
          <h2>
            Group {g.id} {g.complete && <span className="badge">Final</span>}
          </h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th className="left">Team</th>
                  <th className="left">Drawn by</th>
                  <th>P</th><th>W</th><th>D</th><th>L</th>
                  <th>GF</th><th>GA</th><th>GD</th><th>Pts</th>
                  <th className="left">Status</th>
                </tr>
              </thead>
              <tbody>
                {g.standings.map((r) => (
                  <tr key={r.teamId} className={`s-${r.status}`}>
                    <td>{r.position}{r.undetermined && <abbr title="Level on all computable tiebreakers — order undetermined">=</abbr>}</td>
                    <td className="left team-name">{r.name}</td>
                    <td className="left"><PlayerTag drawnBy={r.drawnBy} /></td>
                    <td>{r.played}</td><td>{r.won}</td><td>{r.drawn}</td><td>{r.lost}</td>
                    <td>{r.gf}</td><td>{r.ga}</td><td>{r.gd}</td><td className="pts">{r.points}</td>
                    <td className="left status">{STATUS_LABEL[r.status] ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <section className="group">
        <h2>
          Best third-placed teams{' '}
          <span className="badge">{snapshot.thirdPlace.confirmed ? 'Final' : 'Top 8 qualify'}</span>
        </h2>
        {/* Twelve 0-point teams ranked alphabetically is noise — wait for a result. */}
        {!snapshot.thirdPlace.rows.some((r) => r.played > 0) ? (
          <p className="muted small">Appears once the first results are in.</p>
        ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th className="left">Team</th>
                <th>Grp</th>
                <th className="left">Drawn by</th>
                <th>Pts</th><th>GD</th><th>GF</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.thirdPlace.rows.map((r) => (
                <tr key={r.teamId} className={r.qualified ? 's-thirds' : 's-alive'}>
                  <td>{r.rank}{r.undetermined && '='}</td>
                  <td className="left team-name">{r.name}</td>
                  <td>{r.group}</td>
                  <td className="left"><PlayerTag drawnBy={r.drawnBy} /></td>
                  <td className="pts">{r.points}</td><td>{r.gd}</td><td>{r.gf}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </section>
    </>
  );
}
