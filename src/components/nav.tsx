"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Scale, History, BookOpen, ArrowLeftRight, Layers, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const MAIN_LINKS = [
  { href: "/evaluate/single", label: "Single", icon: Scale },
  { href: "/evaluate/pairwise", label: "Pairwise", icon: ArrowLeftRight },
  { href: "/evaluate/batch", label: "Batch", icon: Layers },
  { href: "/evaluate/rubrics", label: "Rubrics", icon: BookOpen },
];

const RIGHT_LINKS = [
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

const ALL_LINKS = [...MAIN_LINKS, ...RIGHT_LINKS];

function navLinkClass(active: boolean) {
  return cn(
    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
    active
      ? "bg-muted text-foreground"
      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
  );
}

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-3 h-14 items-center">
          {/* Logo — left */}
          <Link
            href="/"
            className="hover:opacity-80 transition-opacity"
          >
            <span className="text-xl font-bold tracking-tight hidden sm:inline">
              <span className="italic font-extrabold bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent">
                Rapid
              </span>{" "}
              Judge
            </span>
            <span className="sm:hidden text-xl font-bold italic font-extrabold bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent">
              R
            </span>
          </Link>

          {/* Main nav links — center */}
          <nav className="hidden sm:flex items-center justify-center gap-1">
            {MAIN_LINKS.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className={navLinkClass(pathname.startsWith(href))}>
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>

          {/* History + Settings — right */}
          <div className="hidden sm:flex items-center justify-end gap-1">
            {RIGHT_LINKS.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className={navLinkClass(pathname.startsWith(href))}>
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </div>
        </div>

        {/* Mobile nav */}
        <div className="flex sm:hidden gap-1 pb-2 overflow-x-auto">
          {ALL_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors",
                pathname.startsWith(href)
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
