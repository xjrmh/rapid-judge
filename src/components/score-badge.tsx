import { cn, scoreToColorClass } from "@/lib/utils";
import type { ScoreRange } from "@/lib/types";

interface ScoreBadgeProps {
  score: number;
  maxScore: ScoreRange | 100;
  size?: "sm" | "md" | "lg";
  showMax?: boolean;
  className?: string;
}

export function ScoreBadge({
  score,
  maxScore,
  size = "md",
  showMax = true,
  className,
}: ScoreBadgeProps) {
  const colorClass = scoreToColorClass(score, maxScore);

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5 rounded",
    md: "text-sm px-2 py-1 rounded-md font-medium",
    lg: "text-xl px-3 py-1.5 rounded-lg font-bold",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center border",
        colorClass,
        sizeClasses[size],
        className
      )}
    >
      {score}
      {showMax && (
        <span className="opacity-60 text-[0.8em]">/{maxScore}</span>
      )}
    </span>
  );
}

// Score as 0-100 percentage
export function AggregateScoreBadge({
  score,
  size = "lg",
  className,
}: {
  score: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const colorClass = scoreToColorClass(score, 100);

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5 rounded-full font-medium",
    md: "text-base px-2.5 py-1 rounded-md font-semibold",
    lg: "text-2xl px-4 py-2 rounded-lg font-bold",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 border",
        colorClass,
        sizeClasses[size],
        className
      )}
    >
      {score.toFixed(1)}
      <span className="opacity-60 text-[0.7em]">/100</span>
    </span>
  );
}
