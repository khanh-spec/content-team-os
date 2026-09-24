"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";

const TABS = [
  { href: "", label: "Overview" },
  { href: "/studio", label: "Content Studio" },
  { href: "/documents", label: "Brand Library" },
  { href: "/feedback", label: "Feedback Log" },
  { href: "/research", label: "Local Research" },
  { href: "/visibility", label: "AI Visibility" },
  { href: "/opportunities", label: "Opportunities" },
  { href: "/settings", label: "Brand Profile" },
];

export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto">
      {TABS.map((t) => {
        const href = base + t.href;
        const active = t.href === "" ? pathname === base : pathname.startsWith(href);
        return (
          <Link
            key={t.href}
            href={href}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium",
              active ? "border-brand-700 text-brand-800" : "border-transparent text-ink-500 hover:text-ink-800",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
