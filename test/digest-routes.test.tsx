import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { DigestNight } from '../src/digest/types.js';

// A temp runs dir: runs/ is read-only.
let dir = '';
const app = () =>
  createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: dir });

const line = (o: object) => JSON.stringify(o);

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'rig-routes-'));
  writeFileSync(
    join(dir, '2026-11-01.jsonl'),
    [
      line({ at: '2026-11-01T01:00:00+01:00', job: 'b/job', status: 'ok', owner: 'rook' }),
      line({ at: '2026-11-01T01:05:00+01:00', job: 'a/job', status: 'retry', owner: null, error: 'e1' }),
      line({ at: '2026-11-01T01:06:00+01:00', job: 'a/job', status: 'retry', owner: null, error: 'e2' }),
      line({ at: '2026-11-01T01:07:00+01:00', job: 'a/job', status: 'retry', owner: null, error: 'e3' }),
      line({ at: '2026-11-01T01:08:00+01:00', job: 'a/job', status: 'ok', owner: null }),
      line({ at: '2026-11-01T02:00:00+01:00', job: 'c/job', status: 'fail', owner: 'lane-07', error: 'boom' }),
    ].join('\n') + '\n',
  );
  writeFileSync(join(dir, '2026-11-02.jsonl'), '');
  writeFileSync(
    join(dir, '2026-11-03.jsonl'),
    line({ at: '2026-11-03T01:00:00+01:00', job: 'a/job', status: 'ok', owner: 'rook' }) + '\n{"at":"2026-11-03T0',
  );
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const jobsInPage = (html: string) => [...html.matchAll(/<tr><td>([^<]+)<\/td>/g)].map((m) => m[1]);

describe('GET /digest/:night', () => {
  it('200: one table sorted by job, retries of 3+ and fail marked, null owner as —', async () => {
    const res = await app().request('/digest/2026-11-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(jobsInPage(html)).toEqual(['a/job', 'b/job', 'c/job']);
    expect(html).toContain('<td>a/job</td><td>—</td>');
    expect(html).toContain('<strong class="warn">3 !</strong>');
    expect(html).toContain('<strong class="warn">fail !</strong>');
    expect(html).not.toContain('<script');
  });

  it('404 for a night with no file', async () => {
    const res = await app().request('/digest/2026-01-01');
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('no run log for this night');
  });

  it('404 for a night that is not a date', async () => {
    expect((await app().request('/digest/..%2Fpackage')).status).toBe(404);
  });

  it('the empty night renders "nothing ran"', async () => {
    const res = await app().request('/digest/2026-11-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('a night with a bad line still renders, and says so', async () => {
    const res = await app().request('/digest/2026-11-03');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(jobsInPage(html)).toEqual(['a/job']);
    expect(html).toContain('1 line in the log didn');
  });
});

describe('GET /api/digest/:night', () => {
  it('200: the same jobs, in the same order, as the page', async () => {
    const res = await app().request('/api/digest/2026-11-01');
    const body = (await res.json()) as DigestNight;
    expect(res.status).toBe(200);
    const page = await (await app().request('/digest/2026-11-01')).text();
    expect(body.rows.map((r) => r.job)).toEqual(jobsInPage(page));
    expect(body.rows[0]).toMatchObject({ job: 'a/job', owner: null, runs: 4, retries: 3, lastStatus: 'ok', lastError: 'e3' });
  });

  it('404 for a night with no file', async () => {
    const res = await app().request('/api/digest/2026-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no run log for this night', night: '2026-01-01' });
  });

  it('the empty night has no rows', async () => {
    const res = await app().request('/api/digest/2026-11-02');
    expect(await res.json()).toEqual({ night: '2026-11-02', rows: [], badLines: 0 });
  });

  it('a night with a bad line counts it', async () => {
    const body = (await (await app().request('/api/digest/2026-11-03')).json()) as DigestNight;
    expect(body.badLines).toBe(1);
    expect(body.rows).toHaveLength(1);
  });
});

describe('status board', () => {
  it('links each night on disk to its digest, with its counts', async () => {
    const html = await (await app().request('/')).text();
    for (const n of ['2026-11-01', '2026-11-02', '2026-11-03']) {
      expect(html).toContain(`<a href="/digest/${n}">${n}</a>`);
      expect((await app().request(`/digest/${n}`)).status).toBe(200);
    }
    expect(html).toMatch(/2026-11-01<\/a> · ok 2 · <span class="warn">retry 3<\/span> · <span class="warn">fail 1<\/span>/);
  });
});
