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
