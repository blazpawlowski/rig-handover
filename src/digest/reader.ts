import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestNight, DigestRow, ReadNight, RunLine, RunStatus } from './types.js';

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = new Set(['ok', 'retry', 'fail']);

// A line that doesn't parse, or parses into something that isn't a RunLine, is null.
export function parseLine(line: string): RunLine | null {
  let v: unknown;
  try {
    v = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.at !== 'string' || Number.isNaN(Date.parse(o.at))) return null;
  if (typeof o.job !== 'string' || o.job === '') return null;
  if (typeof o.status !== 'string' || !STATUSES.has(o.status)) return null;
  if (o.owner !== null && typeof o.owner !== 'string') return null;
  if (o.error !== undefined && typeof o.error !== 'string') return null;
  return { at: o.at, job: o.job, status: o.status as RunLine['status'], owner: o.owner, error: o.error };
}

export function digest(night: string, text: string): DigestNight {
  const byJob = new Map<string, RunLine[]>();
  let badLines = 0;
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    const run = parseLine(line);
    if (!run) {
      badLines++;
      continue;
    }
    byJob.set(run.job, [...(byJob.get(run.job) ?? []), run]);
  }

  const rows: DigestRow[] = [...byJob].map(([job, runs]) => {
    // Order by time, not file position; ties keep file order (sort is stable).
    const sorted = [...runs].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    const last = sorted[sorted.length - 1];
    const lastError = sorted.findLast((r) => r.error !== undefined)?.error ?? null;
    return {
      job,
      owner: last.owner,
      runs: sorted.length,
      retries: sorted.filter((r) => r.status === 'retry').length,
      lastStatus: last.status,
      lastError,
      firstAt: sorted[0].at,
      lastAt: last.at,
    };
  });
  rows.sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));

  return { night, rows, badLines };
}

function readLog(runsDir: string, night: string): string | null {
  if (!NIGHT.test(night)) return null;
  try {
    return readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
}

export const readNight: ReadNight = (runsDir, night) => {
  const text = readLog(runsDir, night);
  return text === null ? null : digest(night, text);
};

export type StatusCounts = Record<RunStatus, number>;

// Lines per status for the night, for the status board. Bad lines aren't counted here.
export function countNight(runsDir: string, night: string): StatusCounts | null {
  const text = readLog(runsDir, night);
  if (text === null) return null;
  const counts: StatusCounts = { ok: 0, retry: 0, fail: 0 };
  for (const line of text.split(/\r?\n/)) {
    const run = line.trim() === '' ? null : parseLine(line);
    if (run) counts[run.status]++;
  }
  return counts;
}
