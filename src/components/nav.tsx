"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Database,
  FlaskConical,
  LayoutDashboard,
  Scale,
  Settings,
  ShieldCheck,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/evaluate", label: "Evaluate", icon: Scale },
  { href: "/datasets", label: "Datasets", icon: Database },
  { href: "/rubrics", label: "Rubrics", icon: BookOpen },
  { href: "/experiments", label: "Experiments", icon: FlaskConical },
  { href: "/judge-qa", label: "Judge QA", icon: ShieldCheck },
];

const SETTINGS_LINK = { href: "/settings", label: "Settings", icon: Settings };

const MOBILE_LINKS = [...NAV_LINKS, SETTINGS_LINK];

function navLinkClass(active: boolean) {
  return cn(
    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
    active
      ? "bg-muted text-foreground"
      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-4">
          <Link
            href="/"
            className="justify-self-start shrink-0 hover:opacity-80 transition-opacity"
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

          <nav className="hidden sm:flex items-center justify-center gap-1">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className={navLinkClass(isActive(pathname, href))}>
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="hidden sm:flex items-center justify-self-end">
            <Link
              href={SETTINGS_LINK.href}
              className={navLinkClass(isActive(pathname, SETTINGS_LINK.href))}
            >
              <SETTINGS_LINK.icon className="h-4 w-4" />
              {SETTINGS_LINK.label}
            </Link>
          </div>
        </div>

        <div className="flex sm:hidden gap-1 pb-2 overflow-x-auto">
          {MOBILE_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors",
                isActive(pathname, href)
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
