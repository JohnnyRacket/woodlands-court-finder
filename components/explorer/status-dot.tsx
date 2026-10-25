import { cn } from "@/lib/utils";

/** A status color dot; hollow for "no data". */
export function StatusDot({ color, hollow, className, title }: { color: string; hollow?: boolean; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={cn("shrink-0 rounded-full", className)}
      style={hollow ? { boxShadow: `inset 0 0 0 1.5px ${color}` } : { backgroundColor: color }}
    />
  );
}
