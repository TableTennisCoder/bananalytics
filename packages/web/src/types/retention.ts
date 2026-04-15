/** A single retention cohort data point. */
export interface RetentionCohort {
  cohort: string;
  cohort_size: number;
  period: number;
  retained: number;
}

/** Processed retention data for the heatmap. */
export interface RetentionRow {
  cohort: string;
  cohort_size: number;
  periods: Record<number, number>; // period -> retained percentage
}
