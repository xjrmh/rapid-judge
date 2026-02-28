"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftRight, Layers, Scale } from "lucide-react";
import { cn } from "@/lib/utils";

const EVAL_LINKS = [
  { href: "/evaluate/single", label: "Single", icon: Scale },
  { href: "/evaluate/pairwise", label: "Pairwise", icon: ArrowLeftRight },
  { href: "/evaluate/batch", label: "Batch", icon: Layers },
];

export function EvaluateSubnav() {
  const pathname = usePathname();

  return (
    <div className="mb-6 tab-header">
      <h1 className="tab-title">Evaluate</h1>
      <p className="tab-subtitle">
        Run ad-hoc evaluations with consistent judge, rubric, and scoring controls.
      </p>
      <nav className="flex flex-wrap items-center gap-2">
        {EVAL_LINKS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors",
                active
                  ? "border-primary bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
