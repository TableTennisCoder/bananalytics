"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCohortRevenue } from "@/hooks/use-cohort-revenue";
import { formatNumber } from "@/lib/format";
import type { CohortRevenue } from "@/types/revenue";

/**
 * Lifetime value by acquisition cohort.
 *
 * The revenue summary says what was earned in a window; retention says who came
 * back. Neither answers whether the people you are signing up now are worth
 * more than the ones you signed up in spring — which is the only number that
 * tells you a pricing or onboarding change worked.
 *
 * Read it down a column, not across a row: at the same age, is each cohort
 * worth more than the one before it?
 */
export function CohortRevenueTable() {
  const [interval, setInterval] = useState<"week" | "month">("week");
  const { data, isLoading, error } = useCohortRevenue(interval);

  const money = (value: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: data?.currency || "EUR",
      maximumFractionDigits: 2,
    }).format(value);

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base font-medium">Revenue per Cohort</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Cumulative revenue per acquired person, by how long ago they arrived.
              Compare a column downwards: newer cohorts should be worth more at the
              same age.
            </p>
          </div>
          <div className="flex rounded-md border border-border p-0.5">
            {(["week", "month"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setInterval(option)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  interval === option
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {option === "week" ? "Weekly" : "Monthly"}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : error ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Could not load cohort revenue.
          </p>
        ) : !data?.cohorts?.length || !data?.ages?.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No cohorts with revenue in this range yet.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Cohort
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                      People
                    </th>
                    {data.ages.map((age) => (
                      <th
                        key={age}
                        className="px-3 py-2 text-right text-xs font-medium text-muted-foreground"
                      >
                        Day {age}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                      To date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.cohorts.map((cohort) => (
                    <CohortRow key={cohort.cohort} cohort={cohort} money={money} />
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              An empty cell means the cohort has not reached that age yet — not that
              it earned nothing. Figures are in {data.currency || "the unlabelled currency"}.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function CohortRow({
  cohort,
  money,
}: {
  cohort: CohortRevenue;
  money: (value: number) => string;
}) {
  return (
    <tr className="hover:bg-muted/30">
      <td className="whitespace-nowrap px-3 py-2 font-medium">{cohort.cohort}</td>
      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
        {formatNumber(cohort.people)}
      </td>
      {cohort.per_person.map((value, i) => (
        <td key={i} className="px-3 py-2 text-right tabular-nums">
          {value === null ? (
            <span className="text-muted-foreground/40">—</span>
          ) : (
            money(value)
          )}
        </td>
      ))}
      <td className="px-3 py-2 text-right font-medium tabular-nums text-primary">
        {money(cohort.total_per_person)}
      </td>
    </tr>
  );
}
