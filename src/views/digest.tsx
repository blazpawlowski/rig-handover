import type { DigestNight, DigestRow } from '../digest/types.js';

// Plan morning-digest § 2a. Retries of 3 or more and any fail are marked: warn colour for the
// screen, a "!" for anyone reading the HTML or a grey screenshot.
export const RETRY_MARK = 3;

// String(): hono/jsx renders a bare 0 as nothing.
const Mark = ({ on, value }: { on: boolean; value: string | number }) =>
  on ? <strong class="warn">{String(value)} !</strong> : <>{String(value)}</>;

const dash = (v: string | null) => v ?? '—';

function Row({ row }: { row: DigestRow }) {
  return (
    <tr>
      <td>{row.job}</td>
      <td>{dash(row.owner)}</td>
      <td>{String(row.runs)}</td>
      <td><Mark on={row.retries >= RETRY_MARK} value={row.retries} /></td>
      <td><Mark on={row.lastStatus === 'fail'} value={row.lastStatus} /></td>
      <td>{dash(row.lastError)}</td>
      <td>{row.firstAt}</td>
      <td>{row.lastAt}</td>
    </tr>
  );
}

export function DigestPage({ digest }: { digest: DigestNight }) {
  return (
    <>
      <h1>digest · {digest.night}</h1>
      {digest.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th><th>owner</th><th>runs</th><th>retries</th><th>last status</th>
              <th>last error</th><th>first</th><th>last</th>
            </tr>
          </thead>
          <tbody>
            {digest.rows.map((row) => (
              <Row row={row} />
            ))}
          </tbody>
        </table>
      )}
      {digest.badLines > 0 && (
        <p class="warn">
          {digest.badLines} {digest.badLines === 1 ? 'line' : 'lines'} in the log didn't parse and {digest.badLines === 1 ? 'is' : 'are'} left out.
        </p>
      )}
      <p class="mute"><a href="/">status board</a></p>
    </>
  );
}

export function NoDigest({ night }: { night: string }) {
  return (
    <>
      <h1>digest · {night}</h1>
      <p class="mute">no run log for this night</p>
      <p class="mute"><a href="/">status board</a></p>
    </>
  );
}
