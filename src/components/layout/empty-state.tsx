import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  actions,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actions?: Array<{ href: string; label: string; variant?: "default" | "secondary" | "outline" }>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-[var(--surface)] px-6 py-12 text-center",
        className,
      )}
    >
      {Icon && (
        <Icon
          className="mx-auto h-10 w-10 text-[var(--text-muted)]"
          aria-hidden
        />
      )}
      <p className="mt-4 font-display text-lg font-semibold text-white">
        {title}
      </p>
      {description && (
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--text-muted)]">
          {description}
        </p>
      )}
      {actions && actions.length > 0 && (
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {actions.map((a) => (
            <Link key={a.href + a.label} href={a.href}>
              <Button variant={a.variant ?? "default"} size="sm">
                {a.label}
              </Button>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
