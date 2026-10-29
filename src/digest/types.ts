// Plan morning-digest § 1. The contract every part of § 2 builds against: the reader fills it,
// the page and the JSON only render it, so they can't disagree (ADR 0001).

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl.
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job for the night. Times are the `at` strings as logged.
export type DigestRow = {
  job: string;
  owner: string | null; // null is kept; views show it as "—"
  runs: number; // lines for this job
  retries: number; // lines with status "retry"
  lastStatus: RunStatus; // status of the latest line
  lastError: string | null; // latest `error` seen for this job, even if it later went ok
  firstAt: string;
  lastAt: string;
};

export type DigestNight = {
  night: string; // YYYY-MM-DD
  rows: DigestRow[]; // sorted by job; empty when nothing ran
  badLines: number; // lines that didn't parse or didn't fit RunLine: counted, never thrown
};

// Reads runsDir/<night>.jsonl. null when there is no file for that night (or the night isn't
// a YYYY-MM-DD date); an empty file is a night where nothing ran, not null.
export type ReadNight = (runsDir: string, night: string) => DigestNight | null;
