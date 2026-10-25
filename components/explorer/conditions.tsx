"use client";

import { CloudLightning, Droplets, Thermometer, Wind } from "lucide-react";
import type { Condition, ConditionKind } from "@/lib/conditions";
import { cn } from "@/lib/utils";

const ICON: Record<ConditionKind, typeof Droplets> = { wet: Droplets, storms: CloudLightning, heat: Thermometer, wind: Wind };

const LEVEL_TONE: Record<Condition["level"], string> = {
  caution: "text-[#a8700d]",
  warning: "text-destructive",
};

export function ConditionIcon({ condition, className }: { condition: Condition; className?: string }) {
  const Icon = ICON[condition.kind];
  return <Icon className={cn(LEVEL_TONE[condition.level], className)} aria-label={condition.text} />;
}

/** Wet courts, storms, heat and wind for the shown hour, as small chips under the weather. */
export function ConditionChips({ conditions, className }: { conditions: Condition[]; className?: string }) {
  if (conditions.length === 0) return null;
  return (
    <ul className={cn("flex flex-col items-end gap-1.5", className)}>
      {conditions.map((condition) => (
        <li key={condition.kind} className="glass-panel flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium">
          <ConditionIcon condition={condition} className="size-3.5 shrink-0" />
          {condition.text}
        </li>
      ))}
    </ul>
  );
}
