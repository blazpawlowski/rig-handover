import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

describe('run log reader', () => {
  it('reads 2026-10-28 into 5 jobs and counts the bad line', () => {
    const n = readNight('runs', '2026-10-28')!;
    expect(n.night).toBe('2026-10-28');
    expect(n.badLines).toBe(1);
    expect(n.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('folds each job into one row', () => {
    const rows = Object.fromEntries(readNight('runs', '2026-10-28')!.rows.map((r) => [r.job, r]));
    expect(rows['fixtures/refresh']).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    expect(rows['notes/backup']).toMatchObject({ runs: 1, retries: 0, lastStatus: 'fail', lastError: 'quota exceeded' });
    expect(rows['lane/sync']).toMatchObject({ runs: 8, retries: 1, lastStatus: 'ok', lastError: 'lock held' });
    expect(rows['rig/rotate-logs']).toMatchObject({ runs: 1, lastStatus: 'ok', lastError: null });
  });

  it('keeps a row whose owner is null', () => {
    const row = readNight('runs', '2026-10-28')!.rows.find((r) => r.job === 'digest/render');
    expect(row).toMatchObject({ owner: null, runs: 1, lastStatus: 'ok' });
  });

  it('reads a clean night with no bad lines', () => {
    const n = readNight('runs', '2026-10-27')!;
    expect(n.badLines).toBe(0);
    expect(n.rows).toHaveLength(4);
  });

  it('returns null for a night with no file, or a night that is not a date', () => {
    expect(readNight('runs', '2026-01-01')).toBeNull();
    expect(readNight('runs', '../package')).toBeNull();
  });

  describe('in a temp runs dir', () => {
    let dir = '';
    afterEach(() => rmSync(dir, { recursive: true, force: true }));
    const night = (text: string) => {
      dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
      writeFileSync(join(dir, '2026-11-01.jsonl'), text);
      return readNight(dir, '2026-11-01')!;
    };

    it('renders an empty file as a night where nothing ran', () => {
      expect(night('')).toEqual({ night: '2026-11-01', rows: [], badLines: 0 });
    });

    it('counts lines that parse but are not run lines, and never throws', () => {
      const n = night(
        [
          '{"at":"2026-11-01T01:00:00+01:00","job":"a","status":"ok","owner":"x"}',
          '{"at":"2026-11-01T01:00:00+01:00","job":"a","status":"weird","owner":"x"}',
          '[1,2]',
          'null',
          '{"job":"a","status":"ok","owner":"x"}',
          '',
        ].join('\r\n'),
      );
      expect(n.badLines).toBe(4);
      expect(n.rows).toHaveLength(1);
    });

    it('takes the last status by time, not by file order', () => {
      const n = night(
        [
          '{"at":"2026-11-01T02:00:00+01:00","job":"a","status":"ok","owner":"x"}',
          '{"at":"2026-11-01T01:00:00+01:00","job":"a","status":"fail","owner":"x","error":"boom"}',
        ].join('\n'),
      );
      expect(n.rows[0]).toMatchObject({ lastStatus: 'ok', lastError: 'boom', firstAt: '2026-11-01T01:00:00+01:00' });
    });
  });
});
