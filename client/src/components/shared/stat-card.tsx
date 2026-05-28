import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  changeClassName?: string;
  icon: LucideIcon;
  iconClassName?: string;
  iconBgClassName?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  change,
  changeClassName,
  icon: Icon,
  iconClassName,
  iconBgClassName,
  className,
}: StatCardProps) {
  return (
    <div className={cn("rounded-2xl border bg-card p-6", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className={cn("rounded-lg bg-primary/10 p-2", iconBgClassName)}>
          <Icon className={cn("size-4 text-primary", iconClassName)} />
        </div>
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {change && (
        <p className={cn("mt-1 text-xs text-emerald-600", changeClassName)}>{change}</p>
      )}
    </div>
  );
}
