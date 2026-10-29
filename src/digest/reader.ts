import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestNight, DigestRow, ReadNight, RunLine } from './types.js';

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

export const readNight: ReadNight = (runsDir, night) => {
  if (!NIGHT.test(night)) return null;
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
  return digest(night, text);
};
