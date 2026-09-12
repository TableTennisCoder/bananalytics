import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeltaProps {
  current: number;
  previous: number | undefined;
  /** Set when a falling number is the good outcome, e.g. a churn rate. */
  lowerIsBetter?: boolean;
  /** What the comparison is against, shown after the percentage. */
  label?: string;
  className?: string;
}

/**
 * The change against the preceding period.
 *
 * Renders nothing without a previous value: an absent comparison and a
 * comparison of zero are different things, and drawing "0%" for the first
 * would claim a fact nobody measured.
 *
 * Growth from zero is shown as "new" rather than a percentage, because any
 * percentage of nothing is either infinite or misleading.
 */
export function Delta({ current, previous, lowerIsBetter, label = "vs. previous period", className }: DeltaProps) {
  if (previous === undefined) return null;

  if (previous === 0) {
    if (current === 0) {
      return (
        <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}>
          <Minus className="h-3 w-3" />
          no change · {label}
        </span>
      );
    }
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs text-green-500", className)}>
        <ArrowUp className="h-3 w-3" />
        new · {label}
      </span>
    );
  }

  const change = ((current - previous) / Math.abs(previous)) * 100;

  // Below a tenth of a percent this is noise, not a trend.
  if (Math.abs(change) < 0.1) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}>
        <Minus className="h-3 w-3" />
        flat · {label}
      </span>
    );
  }

  const rising = change > 0;
  const good = lowerIsBetter ? !rising : rising;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        good ? "text-green-500" : "text-red-500",
        className,
      )}
    >
      {rising ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {rising ? "+" : ""}
      {change.toFixed(1)}% · <span className="font-normal text-muted-foreground">{label}</span>
    </span>
  );
}
