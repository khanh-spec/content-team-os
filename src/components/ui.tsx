import Link from "next/link";
import { twMerge } from "tailwind-merge";
import type { ComponentProps, ReactNode } from "react";
import { stage } from "@/lib/pipeline";

/** Join class names; later Tailwind utilities override earlier ones (e.g. p-0 over p-5). */
export function cn(...classes: (string | false | null | undefined)[]) {
  return twMerge(classes.filter(Boolean).join(" "));
}

type ButtonProps = ComponentProps<"button"> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" };

const buttonStyles = {
  primary: "bg-brand-700 text-white hover:bg-brand-600 disabled:bg-brand-300 disabled:text-ink-600",
  secondary: "bg-surface-2 text-ink-800 ring-1 ring-ink-300 hover:bg-ink-100 disabled:text-ink-400",
  ghost: "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
  danger: "bg-surface text-red-300 ring-1 ring-red-500/30 hover:bg-red-500/10",
};

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed",
        size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-4 py-2 text-sm",
        buttonStyles[variant],
        className,
      )}
      {...props}
    />
  );
}

export function ButtonLink({ variant = "primary", className, ...props }: ComponentProps<typeof Link> & { variant?: keyof typeof buttonStyles }) {
  return (
    <Link
      className={cn("inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition", buttonStyles[variant], className)}
      {...props}
    />
  );
}

const field = "w-full rounded-lg border border-ink-300 bg-surface-2 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={cn(field, props.className)} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea {...props} className={cn(field, "min-h-24 leading-relaxed", props.className)} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={cn(field, "pr-8", props.className)} />;
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="text-sm font-medium text-ink-800">{label}</span>
      {children}
      {hint && <span className="block text-xs text-ink-500">{hint}</span>}
    </label>
  );
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-xl border border-ink-200 bg-surface p-5", className)} {...props} />;
}

export function SectionTitle({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-ink-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

const badgeTones = {
  gray: "bg-ink-100 text-ink-700 ring-ink-300",
  green: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/40",
  amber: "bg-amber-500/10 text-amber-300 ring-amber-500/40",
  red: "bg-red-500/10 text-red-300 ring-red-500/40",
  blue: "bg-blue-500/10 text-blue-300 ring-blue-500/40",
  brand: "bg-brand-100 text-brand-800 ring-brand-300",
  violet: "bg-violet-500/10 text-violet-300 ring-violet-500/40",
  teal: "bg-teal-500/10 text-teal-300 ring-teal-500/40",
};

export function Badge({ tone = "gray", children, className }: { tone?: keyof typeof badgeTones; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset", badgeTones[tone], className)}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const s = stage(status);
  return <Badge tone={s.tone as keyof typeof badgeTones}>{s.label}</Badge>;
}

export const pillarTone = { company: "brand", customers: "blue", competitors: "violet" } as const;
export const severityTone = { high: "red", medium: "amber", low: "gray" } as const;

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-ink-300 bg-surface px-6 py-10 text-center">
      <p className="font-medium text-ink-800">{title}</p>
      {children && <div className="mt-1 text-sm text-ink-500">{children}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cn("inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent", className)} />;
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-500/30">{children}</p>;
}

export function Stat({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-ink-200 bg-surface p-4">
      {icon && <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-100 text-brand-800 ring-1 ring-brand-300">{icon}</span>}
      <div className="min-w-0">
        <p className="text-xl font-semibold text-ink-900 tabular-nums">{value}</p>
        <p className="text-xs text-ink-500">{label}</p>
        {hint && <p className="mt-0.5 truncate text-xs text-ink-400">{hint}</p>}
      </div>
    </div>
  );
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function pct(n: number | null | undefined) {
  return n == null ? "–" : `${Math.round(n * 100)}%`;
}
