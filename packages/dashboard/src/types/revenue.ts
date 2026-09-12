/** Revenue booked in one time bucket. */
export interface RevenuePoint {
  bucket: string;
  revenue: number;
  transactions: number;
  paying_users: number;
}

/** Aggregated revenue for a range, denominated in a single currency. */
export interface RevenueSummary {
  /** Currency the figures are in. Empty when events stated none. */
  currency: string;
  /** Every currency with revenue in range — a total covers only one of them. */
  available_currencies: string[];

  total_revenue: number;
  transactions: number;
  /** Distinct people who spent anything. */
  paying_users: number;
  /** Everyone seen in range, paying or not — the denominator behind ARPU. */
  active_users: number;

  /** Revenue per active person. */
  arpu: number;
  /** Revenue per *paying* person. */
  arppu: number;
  average_order_value: number;
  /** Percentage of active people who paid. */
  paying_share: number;

  timeseries: RevenuePoint[];

  /** The preceding window, when the request asked to compare. */
  previous?: RevenueTotals;
}

/**
 * Formats an amount in its currency. Falls back to a plain number when the
 * events carried no currency, rather than inventing one.
 */
export function formatMoney(amount: number, currency: string): string {
  if (!currency) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(amount);
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // An unknown code would otherwise throw and blank the whole figure.
    return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(amount)} ${currency}`;
  }
}

/**
 * The same figures for the window immediately before the one queried.
 *
 * Present only when the request asked to compare. A number on its own says
 * what is; the pair says whether it is moving.
 */
export interface RevenueTotals {
  total_revenue: number;
  transactions: number;
  paying_users: number;
  active_users: number;
  arpu: number;
  arppu: number;
  average_order_value: number;
  paying_share: number;
}

/** One acquisition cohort and what it has earned per person since. */
export interface CohortRevenue {
  /** ISO date the cohort's interval starts on. */
  cohort: string;
  people: number;
  /**
   * Cumulative revenue per acquired person at each reported age. null means
   * the cohort has not reached that age yet — which is not the same as having
   * earned nothing, and must not be drawn as zero.
   */
  per_person: (number | null)[];
  total_per_person: number;
}

/**
 * Whether the people you acquire are becoming more or less valuable.
 *
 * Retention says whether they come back; the revenue summary says what they
 * spent in a window. Only this says whether June's signups are worth more than
 * May's — the question a pricing or onboarding change is trying to move.
 */
export interface CohortRevenueReport {
  currency: string;
  available_currencies: string[];
  /** Ages in days that per_person is measured at. */
  ages: number[];
  interval: string;
  cohorts: CohortRevenue[];
}
