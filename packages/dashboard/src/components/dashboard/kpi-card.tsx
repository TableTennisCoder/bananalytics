import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  /**
   * Shown under the value. Takes a node rather than a string so a card can
   * carry a <Delta>, which colours itself by direction.
   */
  description?: React.ReactNode;
  className?: string;
}

export function KpiCard({ title, value, icon, description, className }: KpiCardProps) {
  return (
    <Card className={cn("border-border", className)}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="text-muted-foreground">{icon}</div>
        </div>
        <div className="mt-2">
          <p className="text-2xl font-bold">{value}</p>
          {description && <div className="mt-1 text-xs text-muted-foreground">{description}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
