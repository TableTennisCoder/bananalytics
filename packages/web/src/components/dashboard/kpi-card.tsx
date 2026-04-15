import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  description?: string;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function KpiCard({ title, value, icon, description, trend, className }: KpiCardProps) {
  return (
    <Card className={cn("border-border", className)}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="text-muted-foreground">{icon}</div>
        </div>
        <div className="mt-2">
          <p className="text-2xl font-bold">{value}</p>
          {description && (
            <p
              className={cn(
                "mt-1 text-xs",
                trend === "up" && "text-green-500",
                trend === "down" && "text-red-500",
                (!trend || trend === "neutral") && "text-muted-foreground",
              )}
            >
              {description}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
