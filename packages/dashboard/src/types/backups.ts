/** One execution of the host-side backup script. */
export interface BackupRun {
  started_at: string;
  finished_at: string;
  /** "ok" or "failed". */
  status: string;
  /** Size of the dump. Absent when the run produced none. */
  bytes?: number;
  /** Where the dump landed on the server. */
  path?: string;
  /**
   * The remote a copy actually reached. Empty means the dump exists only on
   * the machine that made it — reported rather than omitted, because that is
   * the state worth doing something about.
   */
  remote: string;
  /** Why a run failed, or why a successful dump has no off-site copy. */
  message?: string;
}

export interface BackupStatus {
  /** The newest run, or null if this installation has never run one. */
  last: BackupRun | null;
  runs: BackupRun[];
}
