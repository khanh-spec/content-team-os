"use client";

import {
  BookOpen,
  FileText,
  Settings,
  Check,
  ChevronsUpDown,
  FolderKanban,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  MessageSquareText,
  PenLine,
  Plus,
  Radar,
  ShieldCheck,
  Telescope,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/components/ui";

type ProjectOption = { id: string; name: string };

const PROJECT_NAV = [
  { href: "", label: "Overview", icon: LayoutDashboard },
  { href: "/settings", label: "Brand Intelligence", icon: ShieldCheck },
  { href: "/documents", label: "Brand Library", icon: BookOpen },
  { href: "/feedback", label: "Feedback Intelligence", icon: MessageSquareText },
  { href: "/research", label: "Market Research", icon: Telescope },
  { href: "/opportunities", label: "SEO Opportunities", icon: Lightbulb },
  { href: "/briefs", label: "Content Briefs", icon: FileText },
  { href: "/studio", label: "Optimise", icon: PenLine },
  { href: "/visibility", label: "AI Visibility", icon: Radar },
];

export function Sidebar({ projects, email, preview, aiEnabled }: { projects: ProjectOption[]; email: string; preview: boolean; aiEnabled: boolean }) {
  const pathname = usePathname();
  const projectId = pathname.match(/^\/projects\/([0-9a-f-]{36})/)?.[1];
  const current = projects.find((p) => p.id === projectId);

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-ink-200 bg-surface md:sticky md:top-0 md:h-screen md:w-60 md:border-r md:border-b-0">
      <Link href="/" className="flex items-center gap-3 px-4 py-4">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-700 text-sm font-bold tracking-tight text-white">hop</span>
        <span className="leading-tight">
          <span className="block text-sm font-semibold text-ink-900">Content OS</span>
          <span className="block font-mono text-[11px] text-ink-500">brand manager v1.0</span>
        </span>
      </Link>

      <div className="space-y-2 px-3 pb-3">
        <ProjectSwitcher projects={projects} current={current} />
        <Link href="/settings" className="flex items-center justify-between rounded-lg px-3 py-1.5 text-xs text-ink-500 hover:bg-ink-100">
          <span>Mode</span>
          <span className={aiEnabled ? "font-medium text-brand-800" : "font-medium text-teal-300"}>{aiEnabled ? "AI Enhanced" : "Free Intelligence"}</span>
        </Link>
      </div>

      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:overflow-y-auto">
        <NavLink href="/" label="Dashboard" icon={FolderKanban} active={pathname === "/"} />
        <NavLink href="/settings" label="Settings" icon={Settings} active={pathname === "/settings"} />
        {current && (
          <>
            <p className="hidden px-3 pt-4 pb-1 text-[11px] font-medium uppercase tracking-wider text-ink-400 md:block">{current.name}</p>
            {PROJECT_NAV.map((item) => {
              const href = `/projects/${current.id}${item.href}`;
              const active = item.href === "" ? pathname === href : pathname.startsWith(href);
              return <NavLink key={item.href} href={href} label={item.label} icon={item.icon} active={active} />;
            })}
          </>
        )}
      </nav>

      <div className="hidden border-t border-ink-200 px-4 py-3 md:block">
        {preview ? (
          <Link href="/setup" className="block rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300 ring-1 ring-amber-500/30 hover:bg-amber-500/15">
            Preview mode · sample data
            <span className="block text-amber-300/70">Connect Supabase to save work →</span>
          </Link>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs text-ink-500">{email}</span>
            <form action="/auth/signout" method="post">
              <button className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-900" title="Sign out" aria-label="Sign out">
                <LogOut size={15} />
              </button>
            </form>
          </div>
        )}
      </div>
    </aside>
  );
}

function NavLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof PenLine; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
        active ? "bg-brand-100 text-ink-900 ring-1 ring-brand-300" : "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
      )}
    >
      <Icon size={16} className={active ? "text-brand-800" : "text-ink-500"} />
      {label}
    </Link>
  );
}

function ProjectSwitcher({ projects, current }: { projects: ProjectOption[]; current?: ProjectOption }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-left text-sm ring-1 ring-ink-300 hover:bg-ink-100"
        aria-expanded={open}
      >
        <FolderKanban size={15} className="shrink-0 text-ink-500" />
        <span className="flex-1 truncate">{current?.name ?? "Select project"}</span>
        <ChevronsUpDown size={14} className="text-ink-500" />
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-lg bg-surface-2 p-1 shadow-xl ring-1 ring-ink-300">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setOpen(false);
                router.push(`/projects/${p.id}`);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-ink-100"
            >
              <span className="flex-1 truncate">{p.name}</span>
              {p.id === current?.id && <Check size={14} className="text-brand-800" />}
            </button>
          ))}
          <Link
            href="/projects/new"
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center gap-2 rounded-md border-t border-ink-200 px-2.5 py-2 text-sm text-brand-800 hover:bg-ink-100"
          >
            <Plus size={14} /> New project
          </Link>
        </div>
      )}
    </div>
  );
}
